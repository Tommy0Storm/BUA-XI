// hooks/useGeminiLive.ts
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createGeminiClientOptions, MODELS, AUDIO_INPUT, AUDIO_OUTPUT, DEFAULT_LIVE_CONFIG } from '../gemini.config';
import { AUDIO_CONFIG, LIVE_API_TOOLS } from '../constants';
import { createPcmBlob } from '../utils/audioUtils';
import { decodeAudioData, hasSpeech, base64ToUint8Array, normalizePcmSimple } from '../utils/audioUtils';
import { getOutputContext } from '../utils/audio';
import { ConnectionStatus, Persona } from '../types';
import { sendTranscriptEmail, sendGenericEmail } from '../services/emailService';
import { dispatchLog } from '../utils/consoleUtils';

// Prevent HMR from remounting and killing sessions
if ((import.meta as any)?.hot) {
  (import.meta as any).hot.accept(() => {});
}
import { WORKLET_CODE } from '../utils/workletCode';

// Sanitize log messages to prevent injection
const sanitizeLog = (str: string) => str.replace(/[\r\n]/g, ' ').slice(0, 200);

// Convert browser Blob to SDK-compatible format {data: base64, mimeType: string}
// The SDK expects this format, NOT raw browser Blobs
async function blobToSdkFormat(blob: Blob): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]; // Remove data:...;base64, prefix
      resolve({ data: base64, mimeType: blob.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Extract URLs from text
const extractLinks = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return [...new Set((text.match(urlRegex) || []).map(url => url.replace(/[.,;!?)]+$/, '')))];
};

export interface UseGeminiLiveProps {
  apiKey?: string | undefined; // optional override
  persona: Persona;
  speechThreshold?: number; // Configurable VAD threshold
  interruptionThreshold?: number; // RMS threshold for auto-interruption (default 0.08)
  userEmail?: string;
  verboseLogging?: boolean; // enable more detailed logs (no secrets)
  enableVision?: boolean; // whether to send camera frames to the model (default true)
  autoInterrupt?: boolean; // whether to automatically interrupt the model when user starts speaking during model output
  forcedModel?: string | null; // optional runtime model override (e.g. 'gemini-2.5-flash-native-audio-preview-09-2025')
}

const VOLUME_GAIN = 1.5;
const KEY_BLACKLIST_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_WAKE_DELAY_MS = 250; // small delay before sending wake text

interface TranscriptEntry {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
}

export function useGeminiLive({
  apiKey: overrideApiKey,
  persona,
  speechThreshold = 0.02, // slightly higher default to reduce false triggers
  interruptionThreshold = 0.25, // RMS threshold - raised to reduce false interrupts from background noise
  userEmail,
  verboseLogging,
  enableVision: enableVisionProp,
  autoInterrupt: autoInterruptProp,
  forcedModel: forcedModelProp
}: UseGeminiLiveProps) {
  // --- state ---
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('Auto-Detect');
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Audio / Device / UI state
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
  const [isVideoActive, setIsVideoActive] = useState(false);

  // refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const isPttModeRef = useRef(false);
  const [isPttMode, setIsPttMode] = useState<boolean>(false);
  const isPttActiveRef = useRef(false);
  const isDispatchingRef = useRef(false);
  const isScreenShareRef = useRef(false); // Track if current video is screen share

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<Promise<any> | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const personaRef = useRef<Persona>(persona);
  const lastUserSpeechTimeRef = useRef<number>(Date.now());
  const connectionIdRef = useRef<string | null>(null);
  const isIntentionalDisconnectRef = useRef<boolean>(false);
  const statusRef = useRef<ConnectionStatus>('disconnected');
  const connectStartTimeRef = useRef<number>(0);
  const conversationHistoryRef = useRef<TranscriptEntry[]>([]);
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');
  const isConnectedRef = useRef<boolean>(false);
  const connectRef = useRef<((isRetry?: boolean, modelOverride?: string | null) => Promise<void>) | null>(null);
  const startVideoRef = useRef<((useScreenShare?: boolean) => Promise<void>) | null>(null);

  // Key rotation & blacklisting
  const rawEnvKeys =
    // priority: explicit override -> VITE_API_KEYS -> fallback single VITE_API_KEY
    overrideApiKey ??
    (import.meta as any).env?.VITE_API_KEYS ??
    (import.meta as any).env?.VITE_API_KEY ??
    '';

  const apiKeys = useMemo(() => {
    return rawEnvKeys
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);
  }, [rawEnvKeys]);

  // verbose logging flag (can be passed into the hook or enabled via Vite env var)
  const envVerbose = (typeof import.meta !== 'undefined') ? ((import.meta as any).env?.VITE_VERBOSE_LOGGING === 'true') : false;
    const envEnableVision = (typeof import.meta !== 'undefined') ? ((import.meta as any).env?.VITE_ENABLE_VISION !== 'false') : true;
  // prefer explicit prop, else env var
  const verbose = typeof verboseLogging === 'boolean' ? verboseLogging : envVerbose;
  const enableVisionResolved = typeof enableVisionProp === 'boolean' ? enableVisionProp : envEnableVision;
  const enableVisionRef = useRef<boolean>(enableVisionResolved);
  const autoInterruptRef = useRef<boolean>(typeof autoInterruptProp === 'boolean' ? autoInterruptProp : true);
  const lastInterruptionTsRef = useRef<number>(0);
  const safeToSpeakRef = useRef<boolean>(false);
  // runtime model override (prefer this, then modelOverride param to connect)
  const forcedModelRef = useRef<string | null>(forcedModelProp ?? null);

  // Mirror refs for values used inside audio worklets / callbacks
  const isMutedRef = useRef(isMuted);
  const isMicMutedRef = useRef(isMicMuted);

  // Demo timer ref and time tracking for UI
  const demoTimerRef = useRef<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(persona.maxDurationSeconds || 120);
  const [transcriptSent, setTranscriptSent] = useState<boolean>(false);

  // Store user's location if available
  const userLocationRef = useRef<{latitude: number; longitude: number} | null>(null);

  const failedKeyMapRef = useRef<Record<string, number>>({});
  const currentKeyIndexRef = useRef(0);
  const retryCountRef = useRef(0);
  const manualUserActionRef = useRef(false);

  const wakeSentRef = useRef(false);
  const firstResponseReceivedRef = useRef(false);
  const modelIsSpeakingRef = useRef(false);
  const greetingSentRef = useRef(false);
  const isSwitchingToVideoRef = useRef(false);
  // Track timestamps to detect sessions that fail quickly (bad key or unsupported modality)
  const sessionOpenTimeRef = useRef<number | null>(null);
  const playedChunksRef = useRef<Set<string>>(new Set());
  const visionTopicsRef = useRef<Set<string>>(new Set());
  const lastVisionEmailRef = useRef<number>(0);
  const searchResultsRef = useRef<Array<{query: string; tool: string; timestamp: number}>>([]);
  const lastMapsDestinationRef = useRef<{destination: string; mode: string; timestamp: number} | null>(null);
  const conversationContextRef = useRef<{lastTopic: string; lastResponse: string; timestamp: number} | null>(null);
  const fetchedUrlContentRef = useRef<{url: string; content: string; timestamp: number} | null>(null);

  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  // sync forcedModel prop (from props) into ref when provided at runtime
  useEffect(() => {
    forcedModelRef.current = forcedModelProp ?? null;
  }, [forcedModelProp]);

  useEffect(() => {
    autoInterruptRef.current = typeof autoInterruptProp === 'boolean' ? autoInterruptProp : true;
  }, [autoInterruptProp]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // removed no-op ptt effect

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
    // Sync mute state to worklet
    if (workletNodeRef.current?.port) {
      workletNodeRef.current.port.postMessage({ type: 'setMuted', value: isMicMuted });
    }
  }, [isMicMuted]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (gainNodeRef.current && gainNodeRef.current.context) {
      const ctx = gainNodeRef.current.context;
      gainNodeRef.current.gain.setTargetAtTime(isMuted ? 0 : VOLUME_GAIN, ctx.currentTime, 0.05);
    }
  }, [isMuted]);

  // Key rotation helpers
  const isKeyBlacklisted = useCallback((key: string) => {
    const ts = failedKeyMapRef.current[key];
    if (!ts) return false;
    return Date.now() - ts < KEY_BLACKLIST_MS;
  }, []);

  // Only blacklist keys for DEFINITIVE auth errors (401, 403, leaked)
  const markKeyFailed = useCallback((key: string, reason: string) => {
    failedKeyMapRef.current[key] = Date.now();
    dispatchLog('warn', 'API Key Blacklisted', `Reason: ${reason} (blacklisted for 24h)`);
  }, []);

  // Rotate to next key WITHOUT blacklisting (for transient errors)
  const rotateToNextKey = useCallback(() => {
    if (apiKeys.length <= 1) return;
    currentKeyIndexRef.current = (currentKeyIndexRef.current + 1) % apiKeys.length;
    dispatchLog('info', 'Key Rotation', 'Switching to next available key');
  }, [apiKeys.length]);

  const selectNextAvailableKeyIndex = useCallback(() => {
    if (apiKeys.length === 0) return -1;
    // Start from NEXT key (not current) to ensure rotation
    const start = (currentKeyIndexRef.current + 1) % apiKeys.length;
    for (let i = 0; i < apiKeys.length; i++) {
      const idx = (start + i) % apiKeys.length;
      const key = apiKeys[idx];
      if (!isKeyBlacklisted(key)) {
        currentKeyIndexRef.current = idx;
        return idx;
      }
    }
    // All keys blacklisted - try current key as last resort
    return currentKeyIndexRef.current;
  }, [apiKeys, isKeyBlacklisted]);

  // --- Device enumeration ---
  useEffect(() => {
    let mounted = true;
    const fetchDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        if (!mounted) return;
        setAudioDevices(inputs);
        if (inputs.length > 0) {
          const currentExists = inputs.find(d => d.deviceId === selectedAudioDeviceId);
          if (!selectedAudioDeviceId || !currentExists) {
            const defaultDevice = inputs.find(d => d.deviceId === 'default');
            setSelectedAudioDeviceId(defaultDevice ? defaultDevice.deviceId : inputs[0].deviceId);
          }
        }
      } catch (e) {
        console.warn('Device enumeration failed', e);
      }
    };

    fetchDevices();
    navigator.mediaDevices.addEventListener('devicechange', fetchDevices);
    return () => {
      mounted = false;
      navigator.mediaDevices.removeEventListener('devicechange', fetchDevices);
    };
  }, [selectedAudioDeviceId]);

  // --- Utilities ---
  const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);
  const toggleMic = useCallback(() => setIsMicMuted(prev => !prev), []);
  const setPttMode = useCallback((enabled: boolean) => {
    setIsPttMode(enabled);
    isPttModeRef.current = enabled;
    dispatchLog('info', 'Input Mode Changed', enabled ? 'PTT' : 'VAD');
  }, []);
  const setPttActive = useCallback((active: boolean) => {
    isPttActiveRef.current = active;
  }, []);

  const setManualUserAction = useCallback((isManual: boolean) => {
    manualUserActionRef.current = isManual;
  }, []);

  // --- Video helpers (lightweight; avoid layout thrashing) ---
  const stopVideo = useCallback(() => {
    // Clear interval instead of cancelAnimationFrame (we switched to setInterval for 2 FPS)
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoActive(false);
    // Only emit camera activation/deactivation logs when vision is enabled for this session.
    if (enableVisionRef.current) {
      dispatchLog('info', 'Vision System', 'Camera Deactivated');
    }
  }, []);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    if (isVideoActive) {
      stopVideo();
      setTimeout(() => startVideo(false), 100);
    }
  }, [isVideoActive]);
  
  const startVideo = useCallback(async (useScreenShare = false) => {
    // If vision is disabled for this session, avoid starting camera or prompting for permission
    if (!enableVisionRef.current) {
      dispatchLog('info', 'Vision System', 'Vision disabled — not starting camera');
      setIsVideoActive(false);
      return;
    }
    // CRITICAL: Don't start video if not connected - prevents WebSocket errors
    if (!isConnectedRef.current || !sessionRef.current) {
      dispatchLog('warn', 'Vision System', 'Cannot start video — session not connected');
      return;
    }
    
    // If video is being turned on mid-session (and we're not already in the middle of a 
    // video mode switch), we need to reset the connection to let the backend properly 
    // handle the new modality (audio + video).
    // This prevents "WebSocket is already in CLOSING or CLOSED state" errors.
    // Note: We check !isSwitchingToVideoRef.current to avoid infinite loops - once we've
    // reconnected for video mode, we proceed directly to camera setup.
    if (isConnectedRef.current && !videoStreamRef.current && !isSwitchingToVideoRef.current) {
      dispatchLog('info', 'Vision System', 'Switching to video mode — resetting connection...');
      isSwitchingToVideoRef.current = true;
      isScreenShareRef.current = useScreenShare; // Remember the mode for after reconnect
      disconnect();
      return; // The onclose handler will trigger the reconnection with video
    }
    
    // Reset the flag now that we're proceeding with camera setup after reconnect
    isSwitchingToVideoRef.current = false;
    
    // CRITICAL FOR NATIVE AUDIO MODEL: Pause mic temporarily while we initialize camera
    // This prevents the model from being overwhelmed by simultaneous audio + new video stream
    const wasSafeToSpeak = safeToSpeakRef.current;
    safeToSpeakRef.current = false;
    if (workletNodeRef.current?.port) {
      workletNodeRef.current.port.postMessage({ type: 'setSafeToSpeak', value: false });
    }
    dispatchLog('info', 'Vision System', 'Pausing audio for camera initialization...');
    
    // Brief delay to allow any in-flight audio to complete
    await new Promise(r => setTimeout(r, 200));
    if (!isConnectedRef.current) {
      dispatchLog('warn', 'Vision System', 'Connection lost during stabilization — aborting camera');
      // Restore audio state
      safeToSpeakRef.current = wasSafeToSpeak;
      if (workletNodeRef.current?.port) {
        workletNodeRef.current.port.postMessage({ type: 'setSafeToSpeak', value: wasSafeToSpeak });
      }
      return;
    }
    
    try {
      let stream: MediaStream;
      isScreenShareRef.current = useScreenShare; // Update ref for sendFrame logic
      
      if (useScreenShare) {
        stream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
          audio: false  // CRITICAL: Don't request audio in video stream (mobile compatibility)
        });
      } else {
        // Mobile-safe camera constraints with fallback
        // CRITICAL: audio: false prevents conflict with existing mic stream on mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: isMobile ? 10 : 15, max: 30 },  // Lower for mobile battery
            facingMode: { ideal: facingMode }  // Use 'ideal' not exact for mobile fallback
          },
          audio: false  // CRITICAL: Never request audio here - we have separate mic stream
        };
        
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (constraintErr) {
          // Fallback: try without facingMode constraint (some mobile devices fail with it)
          dispatchLog('warn', 'Vision System', 'Camera constraint failed, trying fallback...');
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
          });
        }
      }
      
      // POST-PERMISSION CHECK: Verify WebSocket didn't close during permission dialog
      if (!isConnectedRef.current) {
        dispatchLog('warn', 'Vision System', 'Connection lost during camera setup — stopping stream');
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Mobile Safari requires playsinline attribute and muted for autoplay
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
      }
      videoStreamRef.current = stream;
      setIsVideoActive(true);
      if (enableVisionRef.current) dispatchLog('success', 'Vision System', useScreenShare ? 'Screen Share Active' : 'Camera Online - Stream Active');

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Track interval ID for cleanup (using setInterval for precise FPS control)
      let intervalId: number | null = null;
      let isSendingFrame = false; // Mutex to prevent overlapping sends
      let consecutiveErrors = 0; // Track consecutive send failures
      const MAX_CONSECUTIVE_ERRORS = 3; // Stop after 3 consecutive failures
      const targetFPS = 2;  // 2 FPS for vision - LOW bandwidth, stable connection
      const frameInterval = 1000 / targetFPS; // 500ms between frames

      // Use setInterval for precise FPS control instead of rAF (which can be too fast)
      // This prevents overwhelming the WebSocket with too many frames
      const sendFrame = async () => {
        // Skip if already sending a frame (prevents overlap)
        if (isSendingFrame) return;
        
        // Triple-check connection state BEFORE any async work
        if (!sessionRef.current || !isConnectedRef.current || !videoRef.current || !ctx) {
          return;
        }
        if (!videoStreamRef.current) return; // Only send frames if camera is actually active
        
        isSendingFrame = true;
        
        try {
          if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            // Resize logic: Higher res for screen share (text readability), lower for camera (bandwidth)
            const isScreen = isScreenShareRef.current;
            const maxWidth = isScreen ? 1280 : 640;
            const maxHeight = isScreen ? 720 : 480;
            
            let targetWidth = videoRef.current.videoWidth;
            let targetHeight = videoRef.current.videoHeight;
            
            if (targetWidth > maxWidth || targetHeight > maxHeight) {
              const scale = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
              targetWidth = Math.floor(targetWidth * scale);
              targetHeight = Math.floor(targetHeight * scale);
            }
            
            if (canvas.width !== targetWidth) canvas.width = targetWidth;
            if (canvas.height !== targetHeight) canvas.height = targetHeight;
            ctx.drawImage(videoRef.current, 0, 0, targetWidth, targetHeight);

            if (enableVisionRef.current && isConnectedRef.current) {
              // Use promise-based toBlob with lower quality for 2 FPS
              // Slightly higher quality for screen share to preserve text edges
              const quality = isScreen ? 0.7 : 0.5;
              const rawBlob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, 'image/jpeg', quality)
              );
              
              // CRITICAL: Re-check connection state AFTER async toBlob
              if (rawBlob && isConnectedRef.current && sessionRef.current) {
                try {
                  // Convert browser Blob to SDK format {data: base64, mimeType: string}
                  // The SDK expects this format, raw browser Blobs serialize to empty objects
                  const sdkBlob = await blobToSdkFormat(rawBlob);
                  
                  const session = await sessionRef.current;
                  // CRITICAL: Final check before send - WebSocket might have closed during await
                  if (isConnectedRef.current) {
                    await session.sendRealtimeInput({ media: sdkBlob });
                    consecutiveErrors = 0; // Reset error counter on success
                    if (verbose) dispatchLog('info', 'DEBUG vision', `Sent frame ${targetWidth}x${targetHeight} @ 2 FPS (${Math.round(sdkBlob.data.length / 1024)}KB base64)`);
                  }
                } catch (e: any) {
                  consecutiveErrors++;
                  // Check if this is a WebSocket closed error or too many failures
                  const errMsg = String(e?.message || e);
                  if (errMsg.includes('CLOSING') || errMsg.includes('CLOSED') || consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    // WebSocket closed or too many errors - stop the interval and don't log spam
                    if (intervalId !== null) {
                      clearInterval(intervalId);
                      intervalId = null;
                      frameIntervalRef.current = null;
                    }
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                      console.warn(`[Vision] Too many consecutive errors (${consecutiveErrors}), stopping frame loop`);
                      dispatchLog('warn', 'Vision System', 'Video stopped due to connection issues');
                    } else {
                      console.warn('[Vision] WebSocket closed, stopping frame loop');
                    }
                  } else if (isConnectedRef.current) {
                    console.warn(`[Vision] Send frame error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, errMsg);
                  }
                }
              }
            }
          }
        } catch (e: any) {
          console.warn('[Vision] Frame loop error:', e?.message || e);
        } finally {
          isSendingFrame = false;
        }
      };
      
      // Start the interval-based loop (more predictable than rAF for low FPS)
      intervalId = window.setInterval(sendFrame, frameInterval);
      
      // Store interval ID in ref for cleanup
      frameIntervalRef.current = intervalId;
      
      // CRITICAL: Send first frame immediately, then restore audio after a brief delay
      // This ensures the model receives the first video frame before audio resumes
      await sendFrame();
      
      // Wait a bit for the model to process the first frame, then restore audio
      setTimeout(() => {
        if (isConnectedRef.current) {
          safeToSpeakRef.current = true;
          if (workletNodeRef.current?.port) {
            workletNodeRef.current.port.postMessage({ type: 'setSafeToSpeak', value: true });
          }
          dispatchLog('success', 'Vision System', 'Camera active, audio restored');
        }
      }, 300);
      
    } catch (err: any) {
      dispatchLog('error', 'Camera Access Denied', err.message || String(err));
      setIsVideoActive(false);
      // Restore audio on error
      safeToSpeakRef.current = true;
      if (workletNodeRef.current?.port) {
        workletNodeRef.current.port.postMessage({ type: 'setSafeToSpeak', value: true });
      }
    }
  }, [verbose, facingMode]);

  const toggleVideo = useCallback((useScreenShare = false) => {
    if (isVideoActive) stopVideo();
    else startVideo(useScreenShare);
  }, [isVideoActive, startVideo, stopVideo]);

  const startScreenShare = useCallback(() => {
    if (isVideoActive) stopVideo();
    startVideo(true);
  }, [isVideoActive, startVideo, stopVideo]);

  // --- Transcript dispatch ---
  const dispatchTranscript = useCallback(async () => {
    if (isDispatchingRef.current) return;
    isDispatchingRef.current = true;

    const duration = Date.now() - connectStartTimeRef.current;
    try { localStorage.removeItem('bua_transcript_backup'); } catch (e) {}

    // Always send transcript if there's conversation history, regardless of duration
    if (conversationHistoryRef.current.length > 0) {
      dispatchLog('action', 'Sending Transcript', `Duration: ${Math.round(duration / 1000)}s`);
      const success = await sendTranscriptEmail(
        conversationHistoryRef.current,
        duration,
        personaRef.current,
        connectionIdRef.current || 'unknown-session',
        userEmail || undefined
      );
      if (success) {
        setTranscriptSent(true);
        setTimeout(() => setTranscriptSent(false), 5000); // Hide after 5 seconds
      }
    } else {
      dispatchLog('info', 'Session Ended', 'No conversation to transcript.');
    }

    isDispatchingRef.current = false;
  }, [userEmail]);

  // --- Audio stop / cleanup ---
  const stopAudio = useCallback(() => {
    isConnectedRef.current = false;
    connectionIdRef.current = null;
    wakeSentRef.current = false;
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }

    stopVideo();

    if (workletNodeRef.current) {
      try {
        if (workletNodeRef.current.port) workletNodeRef.current.port.onmessage = null;
        if (workletNodeRef.current.onprocessorerror) workletNodeRef.current.onprocessorerror = null;
        workletNodeRef.current.disconnect();
      } catch (e) {}
      workletNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (inputContextRef.current) {
      try { if (inputContextRef.current.state !== 'closed') inputContextRef.current.close(); } catch (e) {}
      inputContextRef.current = null;
    }

    if (audioContextRef.current) {
      // Keep the shared output audio context open. We still clear the local ref so the
      // hook won't attempt to reuse the old value on restart.
      audioContextRef.current = null;
    }

    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch (e) {}
      sourceRef.current = null;
    }

    activeSourcesRef.current.forEach(s => {
      try { s.stop(); s.disconnect(); } catch (e) {}
    });
    activeSourcesRef.current.clear();

    [gainNodeRef, inputAnalyserRef, outputAnalyserRef, compressorRef].forEach(r => {
      if (r.current) {
        try { r.current.disconnect(); } catch (e) {}
      }
    });
  }, [stopVideo]);

  // --- Disconnect ---
  const disconnect = useCallback(async (errorMessage?: string, force = false) => {
    // Block accidental programmatic disconnects unless explicitly forced
    if (!force && !manualUserActionRef.current) {
      // Silently block - don't spam console
      return;
    }

    // SECURITY: Removed console.trace - only log to UI via dispatchLog
    if (verbose) dispatchLog('info', 'Disconnect', `force: ${force}`);
    
    // CRITICAL: Immediately stop video frame loop to prevent WebSocket errors
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    // CRITICAL: Immediately stop worklet from sending more audio to prevent
    // "WebSocket is already in CLOSING or CLOSED state" errors
    isConnectedRef.current = false;
    isIntentionalDisconnectRef.current = true;
    if (workletNodeRef.current?.port) {
      workletNodeRef.current.port.onmessage = null;
    }
    
    // Now safe to dispatch transcript (worklet won't spam WebSocket)
    await dispatchTranscript();

    if (sessionRef.current) {
      try {
        const s = await sessionRef.current;
        s.close?.();
      } catch (e) {
        console.warn('[BuaX1] Error closing session:', e);
      }
    }
    sessionRef.current = null;

    setStatus('disconnected');
    setDetectedLanguage('Auto-Detect');
    setTranscript('');
    retryCountRef.current = 0;

    if (errorMessage) {
      setError(errorMessage);
      setStatus('error');
    }

    stopAudio();
  }, [dispatchTranscript, stopAudio]);

  // --- Core connect logic with key rotation + caches ---
  // connect now accepts an optional modelOverride: when provided, use that model
  const connect = useCallback(async (isRetry = false, modelOverride: string | null = null) => {
    // Prevent concurrent connects / overlapping sessions
    if (isConnectedRef.current || sessionRef.current) {
      dispatchLog('warn', 'Connect', 'Session already active or connect in progress — ignoring new connect call');
      return sessionRef.current;
    }
    if (apiKeys.length === 0) {
      setError('API Key is missing. Please set VITE_API_KEYS or VITE_API_KEY in your .env and restart dev server.');
      setStatus('error');
      return;
    }

    // Location must be resolved before connecting
    if (navigator.geolocation && !userLocationRef.current) {
      dispatchLog('info', 'Location', 'Waiting for GPS...');
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            userLocationRef.current = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            dispatchLog('success', '📍 LOCATION LOCKED', `Lat: ${position.coords.latitude.toFixed(4)}, Lon: ${position.coords.longitude.toFixed(4)}`);
            resolve();
          },
          (error) => {
            dispatchLog('warn', 'Location Denied', 'Continuing without location');
            resolve(); // Continue anyway
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    // PRE-AUTHORIZE CAMERA: Skip for now - was causing issues
    // The camera permission will be requested when user clicks camera button
    // if (enableVisionRef.current) { ... }

    // stop any previous audio graph
    stopAudio();
    isConnectedRef.current = false;
    greetingSentRef.current = false;
    setTranscript('');
    setError(null);
    isDispatchingRef.current = false;

    // SECURITY: Only log key counts (not actual keys) and only in verbose mode
    if (verbose) {
      try {
        const now = Date.now();
        const blacklistedCount = Object.entries(failedKeyMapRef.current).filter(([, ts]) => now - ts < KEY_BLACKLIST_MS).length;
        dispatchLog('info', 'Key Status', `${apiKeys.length - blacklistedCount}/${apiKeys.length} keys available`);
      } catch(e) {}
    }

    // rotate/select key
    const nextIndex = selectNextAvailableKeyIndex();
    if (nextIndex === -1) {
      setError('No available API keys (all keys blacklisted).');
      setStatus('error');
      return;
    }
    const currentKey = apiKeys[nextIndex];

    // SECURITY: Never log API keys or key previews to console
    dispatchLog('info', 'Connecting...', `Using key index ${nextIndex} of ${apiKeys.length}`);

    const myConnectionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    connectionIdRef.current = myConnectionId;

    try {
      setStatus('connecting');
      setDetectedLanguage('Auto-Detect');
      conversationHistoryRef.current = [];
      currentInputTranscriptionRef.current = '';
      currentOutputTranscriptionRef.current = '';
      connectStartTimeRef.current = Date.now();
      isIntentionalDisconnectRef.current = false;
      retryCountRef.current = isRetry ? retryCountRef.current + 1 : 0;

      // Create audio contexts - ensure old ones are closed first
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      
      // Close old input context if exists
      if (inputContextRef.current && inputContextRef.current.state !== 'closed') {
        try {
          await inputContextRef.current.close();
        } catch (e) {}
      }
      
      const inputCtx = new AudioContextClass({ sampleRate: AUDIO_CONFIG.inputSampleRate });
      const outputCtx = getOutputContext();

      if (connectionIdRef.current !== myConnectionId) return;

      inputContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;

      // Resume contexts AFTER assignment
      try {
        await inputCtx.resume();
        await outputCtx.resume();
        dispatchLog('success', 'Audio Unlocked', 'Ready');
      } catch (e) {
        dispatchLog('warn', 'Audio', 'Context resume pending');
      }

      nextStartTimeRef.current = outputCtx.currentTime;

      // OUTPUT DSP
      const outputAnalyser = outputCtx.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyserRef.current = outputAnalyser;

      const gainNode = outputCtx.createGain();
      gainNode.gain.value = isMuted ? 0 : VOLUME_GAIN;
      gainNodeRef.current = gainNode;
      gainNode.connect(outputAnalyser);
      outputAnalyser.connect(outputCtx.destination);

      // INPUT DSP - Use ScriptProcessorNode like colab with enhanced mobile settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedAudioDeviceId ? { exact: selectedAudioDeviceId } : undefined,
          sampleRate: AUDIO_CONFIG.inputSampleRate,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true
        }
      });
      streamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 512;
      inputAnalyserRef.current = inputAnalyser;

      // Use AudioWorklet for better performance (non-blocking)
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await inputCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);
      
      const workletNode = new AudioWorkletNode(inputCtx, 'pcm-processor');
      workletNodeRef.current = workletNode;
      
      // Connect: Source -> Analyser -> Worklet
      source.connect(inputAnalyser);
      inputAnalyser.connect(workletNode);
      workletNode.connect(inputCtx.destination);

      // --- Instantiate GoogleGenAI client (with selected API key) ---
      let ai: any;
      try {
        // Respect optional Vite overrides for the GenAI endpoint/version. Cast to `any` to keep
        // this change backward-compatible with the SDK typings while forcing v1 behavior.
        // Let the SDK choose the proper endpoint; do not set apiUrl/apiVersion manually.
        // Use unified client options from config (supports passing an override API key)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ai = new GoogleGenAI(createGeminiClientOptions(currentKey) as any);
      } catch (err: any) {
        // Only blacklist at constructor time if it's an obvious auth problem
        const m = String(err?.message || err || '');
        if (/401|403|api key|invalid key|permission|quota/i.test(m)) {
          markKeyFailed(currentKey, `Client init auth error: ${m.slice(0,80)}`);
        } else {
          // Other constructor issues (e.g., client library problems) are not automatically considered key failures
          dispatchLog('warn', 'Client Init', `Live client initialization failed but not treated as key error: ${m.slice(0,120)}`);
        }
        throw err;
      }

      // --- Optional: caches (best-effort) ---
      let cachesClient: any = null;
      let personaCache: any = null;
      try {
        cachesClient = ai?.caches?.();
        if (cachesClient && typeof cachesClient.create === 'function') {
          // Create a persona-specific cache name (idempotent server-side)
          try {
            personaCache = await cachesClient.create({
              name: `bua-persona-${(personaRef.current.name || 'default').replace(/\s+/g, '-')}`,
              ttlDays: 30
            });
          } catch (e) {
            // Some implementations may throw if cache exists; try to get instead
            try {
              personaCache = await cachesClient.get?.(`bua-persona-${(personaRef.current.name || 'default').replace(/\s+/g, '-')}`);
            } catch (_) {
              personaCache = null;
            }
          }
        }
      } catch (e) {
        // not fatal — continue without caches
        personaCache = null;
      }

      // Build final system instruction; prefer cached if present
      const finalSystemInstruction = personaRef.current.baseInstruction || '';

      let systemInstructionToUse = finalSystemInstruction;
      try {
        if (personaCache && typeof personaCache.get === 'function') {
          const cached = await personaCache.get?.('systemInstruction');
          if (cached) systemInstructionToUse = cached.value ?? cached;
          else {
            // save it
            await personaCache.save?.({ key: 'systemInstruction', value: finalSystemInstruction }).catch(() => {});
          }
        }
      } catch (e) {
        // non-fatal
      }

      // --- Connect live session ---
      // Choose model based on whether vision is enabled for this session - multimodal flash model required for vision
      // If a modelOverride is provided, that takes precedence (used for fallbacks)
      // Always prefer runtime override, otherwise use the native audio preview model for live audio
      const chosenModel = modelOverride ?? forcedModelRef.current ?? MODELS.nativeAudio;
      // SECURITY: Model details not logged
      if (verbose) dispatchLog('info', 'DEBUG', `Vision: ${enableVisionRef.current ? 'enabled' : 'disabled'}`);

      // Build structured prompt with XML markup
      const userEmailContext = userEmail ? `<user_identity>\nUSER EMAIL: ${userEmail}\n</user_identity>` : '';
      
      const locationContext = userLocationRef.current 
        ? `<rule id="location_awareness">\n🌍 USER LOCATION (CRITICAL): The user is currently at GPS coordinates Latitude ${userLocationRef.current.latitude.toFixed(4)}, Longitude ${userLocationRef.current.longitude.toFixed(4)}. This is their EXACT physical location RIGHT NOW. NEVER ask "where are you?" or "what's your location?" - YOU ALREADY KNOW IT. Use these coordinates automatically for: directions (as starting point), nearby searches, distance calculations, and location-based recommendations. When giving directions, always say "from your current location" not "from where you are".\n</rule>`
        : `<rule id="location_awareness">\n⚠️ USER LOCATION: User denied location access. You must ask for their location/address when needed for directions or nearby searches.\n</rule>`;
      
      const toolProtocols = `<tool_protocols>
  <protocol for="send_email">
    After providing search results, directions, or important information, ALWAYS proactively offer to email it by saying "Would you like me to email you these details?" or "I can send this to your email if you'd like." When user agrees, call the send_email tool immediately.
  </protocol>
  <protocol for="open_maps">
    When a user asks for directions:
    1. Use google_search to find the destination and get basic route info
    2. Call open_maps tool to open the map
    3. Verbally describe the route (e.g., "Head south on Main St for 2km, turn left on Oak Ave")
    4. Offer to email the directions with the map link
  </protocol>
  <protocol for="query_lra_document">
    If the user asks a legal question related to dismissals or the LRA, state "Let me consult the LRA document for that" and immediately use the query_lra_document tool.
  </protocol>
  <protocol for="google_search">
    After presenting search results, always offer: "Would you like me to email you these results?"
  </protocol>
  <protocol for="fetch_url_content">
    Only use when user explicitly asks for more info about a link. After fetching, offer to email the content.
  </protocol>
</tool_protocols>`;

      const visionProtocol = enableVisionRef.current ? `<vision_protocol>
  - When the user's camera is active, you MUST comment on relevant objects or context you see
  - If you see a specific item the user mentions, confirm it by saying "I see the [item] you're referring to"
  - Use visual information to enhance your responses and provide context-aware assistance
  - Proactively describe what you observe when it's relevant to the conversation
</vision_protocol>` : '';

      const verbalNuances = `<verbal_nuances>
  <filler_words>
    To sound more natural, incorporate common South African affirmations and hesitations where appropriate:
    - 'Ja' (yes/agreement), 'Nee' (no), 'Eish' (surprise/concern), 'Yoh' (shock/amazement)
    - 'Ag' (oh/ah), 'Shame' (sympathy), 'Haibo' (disbelief)
    Use sparingly - only when it feels genuinely natural to the conversation flow.
  </filler_words>
  <non_speech_sounds>
    You can use natural human reactions when genuinely appropriate:
    - Light laughter or chuckle when something is amusing
    - Brief sigh when empathizing with frustration
    - Thoughtful pause ('hmm') when considering a complex question
    Use these ONLY when it's a very natural human response. Overuse will sound uncanny.
  </non_speech_sounds>
</verbal_nuances>`;

      const globalRules = `<rules_of_engagement>
  ${locationContext}
  <rule id="interruption_handling">
    If interrupted by the user while speaking, IMMEDIATELY stop and listen. Acknowledge with a brief phrase appropriate to your persona (e.g., "Go ahead", "Yes?", "I'm listening"), then let the user speak.
  </rule>
  <rule id="processing_feedback">
    CRITICAL: When you call ANY tool (email, search, maps, etc.), you MUST acknowledge it verbally BEFORE the tool executes. NEVER go silent while processing. Use persona-appropriate phrases like:
    - "Just a sec, let me do that for you..."
    - "One moment, I'm on it..."
    - "Hang on, working on that..."
    - "Sharp sharp, give me a second..."
    - "Let me quickly sort that out..."
    - "Busy with that now..."
    - "Eish, give me a moment..."
    - "Hold on, I'm checking..."
    After the tool completes, confirm the result to the user. NEVER leave the user waiting in silence.
  </rule>
  <rule id="language_detection">
    When user switches language, call report_language_change tool immediately. Mirror the user's language choice throughout the conversation.
  </rule>
  ${visionProtocol}
  ${verbalNuances}
  ${toolProtocols}
</rules_of_engagement>`;
      
      // SECURITY: System instruction details not logged to console
      // Construct final structured system instruction
      const structuredSystemInstruction = `<persona_definition>
${systemInstructionToUse}
</persona_definition>

${userEmailContext}

${globalRules}`;

      // SECURITY: Removed API key logging - only log non-sensitive connection info
      if (verbose) console.log('[CONNECT] Calling ai.live.connect with model:', chosenModel);
      dispatchLog('info', 'Connecting', 'Establishing neural link...');
      
      let sessionPromise: Promise<any>;
      try {
        sessionPromise = ai.live.connect({
        model: chosenModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: personaRef.current.voiceName } }
          },
          systemInstruction: structuredSystemInstruction,
          temperature: personaRef.current.temperature ?? 0.7,
          tools: LIVE_API_TOOLS,
          toolConfig: { googleSearchRetrieval: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0.3 } } }
        },
        callbacks: {
          onopen: () => {
            // Prevent any mic audio / interruptions for warmup period
            safeToSpeakRef.current = false;
            firstResponseReceivedRef.current = false;
            dispatchLog('info', 'DEBUG onopen', 'Gating audio for warmup');
            if (connectionIdRef.current !== myConnectionId) {
              return; // Session mismatch - abort silently
            }
            // record session open time so we can detect very-short lived sessions
            sessionOpenTimeRef.current = Date.now();
            dispatchLog('success', 'Neural Link Established', `Session ID: ${myConnectionId.substr(0, 12)}...`);
            setStatus('connected');
            isConnectedRef.current = true;
            retryCountRef.current = 0;
            if (verbose) dispatchLog('info', 'DEBUG onopen', `Persona:${personaRef.current.name}`);
            
            // Start heartbeat to prevent idle closure
            const heartbeatInterval = setInterval(() => {
              if (!isConnectedRef.current) {
                clearInterval(heartbeatInterval);
                return;
              }
              sessionPromise.then((session: any) => {
                // Double-check connection state after promise resolves
                if (!isConnectedRef.current) {
                  clearInterval(heartbeatInterval);
                  return;
                }
                try {
                  const silentData = new Float32Array(160); // 10ms silence
                  const pcmBlob = createPcmBlob(silentData, AUDIO_CONFIG.inputSampleRate);
                  session.sendRealtimeInput({ media: pcmBlob });
                  if (verbose) dispatchLog('info', 'DEBUG heartbeat', 'Sent');
                } catch (e: any) {
                  // Check if it's a WebSocket closed error
                  const errMsg = String(e?.message || e || '');
                  if (errMsg.includes('CLOSING') || errMsg.includes('CLOSED')) {
                    console.warn('[HEARTBEAT] WebSocket closed, stopping heartbeat');
                    clearInterval(heartbeatInterval);
                    isConnectedRef.current = false;
                  }
                }
              }).catch(() => {
                clearInterval(heartbeatInterval);
              });
            }, 10000); // every 10 seconds

            // Start demo timer
            if (demoTimerRef.current) clearInterval(demoTimerRef.current);
            const maxDuration = personaRef.current.maxDurationSeconds || 120;
            setTimeLeft(maxDuration);
            demoTimerRef.current = window.setInterval(() => {
              setTimeLeft(prev => {
                if (prev <= 1) {
                  if (connectRef.current) {
                    manualUserActionRef.current = true;
                    disconnect('Demo time limit reached.', true);
                  }
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
            
            // Enable mic after brief warmup
            setTimeout(() => {
              safeToSpeakRef.current = true;
              firstResponseReceivedRef.current = true;
              // CRITICAL: Notify worklet that it's safe to send audio now
              if (workletNodeRef.current?.port) {
                workletNodeRef.current.port.postMessage({ type: 'setSafeToSpeak', value: true });
              }
              dispatchLog('success', 'Ready', 'Mic active');
            }, 500);

            // Send greeting (non-blocking)
            if (personaRef.current.initialGreeting) {
              sessionPromise.then((session: any) => {
                try {
                  session.sendClientContent({
                    turns: [{ role: 'user', parts: [{ text: personaRef.current.initialGreeting }] }],
                    turnComplete: true
                  });
                  dispatchLog('success', 'Greeting Sent', personaRef.current.initialGreeting.substring(0, 30));
                } catch (e) {
                  dispatchLog('warn', 'Greeting Failed', String(e));
                }
              }).catch(() => {});
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (connectionIdRef.current !== myConnectionId) return;
            try {
            
            // Check for errors in the message
            if ((msg as any).error) {
              dispatchLog('error', 'Model Error', JSON.stringify((msg as any).error));
            }
            
            // handle audio inline data - collect chunks as they arrive
            const turn = (msg as any).serverContent?.modelTurn;
            // Play audio chunks immediately as they arrive (deduplicate using hash)
            if (turn?.parts) {
              modelIsSpeakingRef.current = true;
              for (const part of turn.parts) {
                if (part.inlineData?.data) {
                  const audioData = part.inlineData.data;
                  const chunkHash = audioData.substring(0, 50);
                  if (playedChunksRef.current.has(chunkHash)) continue;
                  playedChunksRef.current.add(chunkHash);
                  try {
                    const audioBuffer = await decodeAudioData(
                      base64ToUint8Array(audioData) as any,
                      outputCtx,
                      AUDIO_CONFIG.outputSampleRate,
                      1
                    );
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(gainNode);
                    const lastSource = source;
                    source.onended = () => {
                      activeSourcesRef.current.delete(lastSource);
                      if (activeSourcesRef.current.size === 0) {
                        modelIsSpeakingRef.current = false;
                      }
                    };
                    const startTime = Math.max(nextStartTimeRef.current, outputCtx.currentTime + 0.01);
                    source.start(startTime);
                    nextStartTimeRef.current = startTime + audioBuffer.duration;
                    activeSourcesRef.current.add(source);
                    if (verbose) dispatchLog('success', 'Audio Playing', `Chunk ${activeSourcesRef.current.size}`);
                  } catch (e) {
                    dispatchLog('error', 'Audio Decode Failed', String(e));
                  }
                }
              }
            }
            
            // When turn completes, clear played chunks cache and mark model as done
            if ((msg as any).serverContent?.turnComplete) {
              playedChunksRef.current.clear();
              if (activeSourcesRef.current.size === 0) {
                modelIsSpeakingRef.current = false;
              }
            }

            // transcription and toolcalls
            const { serverContent } = (msg as any);
            if (serverContent) {
              if (verbose) {
                try {
                  const summary = {
                    turnComplete: Boolean(serverContent.turnComplete),
                    outputLength: serverContent.outputTranscription?.text?.length ?? 0,
                    inputLength: serverContent.inputTranscription?.text?.length ?? 0,
                    modelTurnParts: (serverContent.modelTurn?.parts?.length ?? 0),
                    interrupted: Boolean(serverContent.interrupted)
                  };
                  dispatchLog('info', 'DEBUG serverContent', JSON.stringify(summary));
                } catch (e) {}
              }
              
              // Log if we're getting input transcription (proves audio is being processed)
              // Filter out noise tags and non-English garbage
              if (serverContent.inputTranscription?.text) {
                const rawText = serverContent.inputTranscription.text;
                const cleanText = rawText.replace(/<noise>/g, '').trim();
                // Only log if it's not just noise or non-Latin characters
                if (cleanText && /[a-zA-Z]/.test(cleanText)) {
                  dispatchLog('success', 'Input Heard', `"${sanitizeLog(cleanText)}"`);
                }
              }
              if (serverContent.outputTranscription?.text) {
                currentOutputTranscriptionRef.current += serverContent.outputTranscription.text;
                setTranscript(currentOutputTranscriptionRef.current);
              }
              if (serverContent.inputTranscription?.text) {
                currentInputTranscriptionRef.current += serverContent.inputTranscription.text;
              }
              if (serverContent.turnComplete) {
                const userText = currentInputTranscriptionRef.current.trim();
                const modelText = currentOutputTranscriptionRef.current.trim();
                if (userText) conversationHistoryRef.current.push({ role: 'user', text: userText, timestamp: Date.now() });
                if (modelText) {
                  conversationHistoryRef.current.push({ role: 'model', text: modelText, timestamp: Date.now() });
                  
                  // Capture conversation context for smart email generation
                  conversationContextRef.current = {
                    lastTopic: userText.substring(0, 100) || 'Discussion',
                    lastResponse: modelText,
                    timestamp: Date.now()
                  };
                  
                  // Auto-track search results for potential email follow-up
                  if (searchResultsRef.current.length > 0 && modelText.length > 100) {
                    const recentSearches = searchResultsRef.current.filter(s => Date.now() - s.timestamp < 30000);
                    if (recentSearches.length > 0 && verbose) {
                      dispatchLog('info', 'Search Results', `Tracked ${recentSearches.length} recent searches - AI should offer to email`);
                    }
                  }
                  
                  // Check if vision was active and model discussed visual topics
                  if (isVideoActive && modelText.length > 50) {
                    const now = Date.now();
                    if (now - lastVisionEmailRef.current > 30000) { // throttle: 30s between emails
                      const topics = modelText.match(/(?:I see|I notice|looking at|shows?|displays?|appears?|contains?|depicts?)\s+([^.!?]{10,80})/gi);
                      if (topics && topics.length > 0) {
                        lastVisionEmailRef.current = now;
                        topics.slice(0, 3).forEach(async (topic) => {
                          const cleanTopic = topic.trim().substring(0, 100);
                          if (!visionTopicsRef.current.has(cleanTopic)) {
                            visionTopicsRef.current.add(cleanTopic);
                            await sendGenericEmail(
                              userEmail || 'noreply@local',
                              `Vision Analysis: ${cleanTopic.substring(0, 50)}`,
                              `${personaRef.current.name} analyzed your ${isVideoActive ? 'camera/screen' : 'visual input'}:\n\n${modelText}`,
                              personaRef.current.name,
                              connectionIdRef.current || 'unknown',
                              'standard',
                              []
                            );
                          }
                        });
                      }
                    }
                  }
                }
                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
              }
            }

            // Only process tool calls if there are actual function calls array
            if ((msg as any).toolCall?.functionCalls?.length) {
              for (const call of (msg as any).toolCall.functionCalls) {
                if (call.name === 'report_language_change') {
                  if (verbose) dispatchLog('info', 'DEBUG toolCall', `report_language_change args=${JSON.stringify(call.args)}`);
                  setDetectedLanguage((call.args as any).language);
                  sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: 'ok' } }] }));
                } else if (call.name === 'send_email') {
                  dispatchLog('info', '📧 EMAIL TOOL CALLED', `Sending to ${(call.args as any).recipient_email || userEmail}`);
                  try {
                    const template = (call.args as any).template || 'standard';
                    let body = (call.args as any).body || '';
                    let subject = (call.args as any).subject || 'Information from VCB-AI';
                    
                    // BULLETPROOF EMAIL LOGIC - Build comprehensive email from all available context
                    const emailParts: string[] = [];
                    
                    // 1. Include AI's provided body first
                    if (body && body.length > 5) {
                      emailParts.push(body);
                      emailParts.push('\n---\n');
                    }
                    
                    // 2. Add recent maps/directions if available (within 2 minutes)
                    const recentMaps = lastMapsDestinationRef.current;
                    if (recentMaps && Date.now() - recentMaps.timestamp < 120000) {
                      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(recentMaps.destination)}&travelmode=${recentMaps.mode}`;
                      emailParts.push(`📍 DIRECTIONS\nDestination: ${recentMaps.destination}\nTravel Mode: ${recentMaps.mode}\n\nGoogle Maps Link:\n${mapsUrl}\n`);
                      if (!subject.toLowerCase().includes('direction')) {
                        subject = `Directions: ${recentMaps.destination}`;
                      }
                      dispatchLog('info', 'Email Enhanced', 'Added maps directions');
                    }
                    
                    // 3. Add recent search context if available (within 2 minutes)
                    const recentSearches = searchResultsRef.current.filter(s => Date.now() - s.timestamp < 120000);
                    if (recentSearches.length > 0) {
                      emailParts.push(`\n🔍 SEARCH QUERIES\n${recentSearches.map(s => `- ${s.tool}: ${s.query}`).join('\n')}\n`);
                      dispatchLog('info', 'Email Enhanced', `Added ${recentSearches.length} search queries`);
                    }
                    
                    // 4. Add fetched URL content if available (within 2 minutes)
                    const recentUrl = fetchedUrlContentRef.current;
                    if (recentUrl && Date.now() - recentUrl.timestamp < 120000) {
                      emailParts.push(`\n🌐 WEB CONTENT\nSource: ${recentUrl.url}\n\n${recentUrl.content.substring(0, 2000)}\n`);
                      dispatchLog('info', 'Email Enhanced', 'Added fetched URL content');
                    }
                    
                    // 5. Add recent conversation context (within 2 minutes)
                    const recentContext = conversationContextRef.current;
                    if (recentContext && Date.now() - recentContext.timestamp < 120000 && recentContext.lastResponse.length > 50) {
                      emailParts.push(`\n💬 CONVERSATION SUMMARY\nTopic: ${recentContext.lastTopic}\n\nResponse:\n${recentContext.lastResponse}\n`);
                      dispatchLog('info', 'Email Enhanced', 'Added conversation context');
                    }
                    
                    // 6. Add user location if available
                    if (userLocationRef.current) {
                      emailParts.push(`\n📌 YOUR LOCATION\nLatitude: ${userLocationRef.current.latitude.toFixed(4)}\nLongitude: ${userLocationRef.current.longitude.toFixed(4)}\n`);
                    }
                    
                    // 7. Build final comprehensive body with proper HTML formatting
                    let finalBody = emailParts.length > 0 
                      ? emailParts.join('\n')
                      : 'Information from your conversation with VCB-AI.';
                    
                    // Convert plain text to HTML with proper formatting
                    finalBody = finalBody
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/\n/g, '<br>\n')
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\* (.+?)$/gm, '&bull; $1');
                    
                    // Extract all links from the final body
                    const links = extractLinks(finalBody);
                    
                    dispatchLog('info', 'Email Sending', `Subject: ${subject}`);
                    dispatchLog('info', 'Email Content', `${finalBody.length} chars, ${links.length} links`);
                    
                    // Send the comprehensive email
                    const success = await sendGenericEmail(
                      (call.args as any).recipient_email || userEmail || 'noreply@local',
                      subject,
                      finalBody,
                      personaRef.current.name,
                      connectionIdRef.current || 'unknown',
                      template,
                      links
                    );
                    
                    if (success) {
                      dispatchLog('success', 'Email Sent', `${finalBody.length} chars with full context`);
                    } else {
                      dispatchLog('error', 'Email Failed', 'sendGenericEmail returned false');
                    }
                    
                    // Use await to ensure tool response is sent
                    const session = await sessionPromise;
                    await session.sendToolResponse({ 
                      functionResponses: [{ 
                        id: call.id, 
                        name: call.name, 
                        response: { 
                          result: success 
                            ? `Email sent successfully with ${emailParts.length} sections of information` 
                            : 'Email failed to send - check EmailJS configuration' 
                        } 
                      }] 
                    });
                  } catch (e) {
                    dispatchLog('error', 'Email Tool Error', String(e));
                    console.error('[EMAIL TOOL] Exception:', e);
                    try {
                      const session = await sessionPromise;
                      await session.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: `Error sending email: ${String(e)}` } }] });
                    } catch (respErr) {
                      console.error('[EMAIL TOOL] Failed to send error response:', respErr);
                    }
                  }
                } else if (call.name === 'query_lra_document') {
                  if (verbose) dispatchLog('info', 'DEBUG toolCall', `query_lra_document query=${(call.args as any).query}`);
                  const { queryLRADocument } = await import('../services/documentService');
                  const result = await queryLRADocument((call.args as any).query);
                  sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result } }] }));
                } else if (call.name === 'open_maps') {
                  if (verbose) dispatchLog('info', 'DEBUG toolCall', `open_maps destination=${(call.args as any).destination}`);
                  const destination = (call.args as any).destination || '';
                  const mode = (call.args as any).mode || 'driving';
                  
                  // Store the destination for potential email follow-up
                  lastMapsDestinationRef.current = {
                    destination,
                    mode,
                    timestamp: Date.now()
                  };
                  
                  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
                  window.open(mapsUrl, '_blank');
                  dispatchLog('success', 'Maps Opened', `${mode} directions to: ${destination}`);
                  
                  // Return detailed response with email offer prompt
                  const modeLabel = mode === 'transit' ? 'public transport' : mode;
                  sessionPromise.then((s: any) => s.sendToolResponse({ 
                    functionResponses: [{ 
                      id: call.id, 
                      name: call.name, 
                      response: { 
                        result: `SUCCESS: Google Maps opened with ${modeLabel} directions to "${destination}". The map is now showing the route. IMPORTANT: Proactively ask the user: "Would you like me to email you these directions with the Google Maps link so you have them saved?" If they agree, use send_email with subject "Directions to ${destination}" and include the destination, travel mode, and this clickable link: ${mapsUrl}` 
                      } 
                    }] 
                  }));
                } else if (call.name === 'make_call') {
                  const phone = (call.args as any).phone_number;
                  const name = (call.args as any).contact_name || phone;
                  window.location.href = `tel:${phone}`;
                  dispatchLog('success', 'Call Initiated', `Calling: ${name} (${phone})`);
                  sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: `Phone dialer opened to call ${name} at ${phone}. The user can now tap to dial.` } }] }));
                } else if (call.name === 'open_whatsapp') {
                  const phone = (call.args as any).phone_number;
                  const message = (call.args as any).message || '';
                  const messageParam = message ? `?text=${encodeURIComponent(message)}` : '';
                  const whatsappUrl = `https://wa.me/${phone}${messageParam}`;
                  window.open(whatsappUrl, '_blank');
                  dispatchLog('success', 'WhatsApp Opened', `Chat with: +${phone}`);
                  const feedback = message 
                    ? `WhatsApp opened to chat with +${phone}. Message pre-filled: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`
                    : `WhatsApp opened to chat with +${phone}. User can now type their message.`;
                  sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: feedback } }] }));
                } else if (call.name === 'copy_to_clipboard') {
                  const { text } = (call.args as any);
                  const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
                  navigator.clipboard.writeText(text).then(() => {
                    dispatchLog('success', 'Copied', `${text.length} characters copied to clipboard`);
                  }).catch(() => {
                    dispatchLog('warn', 'Copy Failed', 'Clipboard access denied');
                  });
                  sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: `SUCCESS: Copied to clipboard (${text.length} characters): "${preview}". Tell the user they can now paste this anywhere with Ctrl+V (or Cmd+V on Mac).` } }] }));
                } else if (call.name === 'set_reminder') {
                  const { message, minutes } = (call.args as any);
                  const ms = minutes * 60 * 1000;
                  const reminderTime = new Date(Date.now() + ms);
                  const formattedTime = reminderTime.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
                  
                  setTimeout(() => {
                    if ('Notification' in window && Notification.permission === 'granted') {
                      new Notification('VCB PoLYGoN Reminder', { body: message, icon: '/favicon.ico' });
                    } else {
                      alert(`Reminder: ${message}`);
                    }
                  }, ms);
                  
                  dispatchLog('success', 'Reminder Set', `At ${formattedTime}: ${message.substring(0, 30)}...`);
                  
                  if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission();
                  }
                  
                  const timeDesc = minutes < 60 ? `${minutes} minutes` : `${Math.round(minutes/60)} hour${minutes >= 120 ? 's' : ''}`;
                  sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: `SUCCESS: Reminder set for ${timeDesc} from now (at ${formattedTime}). Message: "${message}". The user will receive a notification. Confirm this to the user.` } }] }));
                } else if (call.name === 'send_sms') {
                  const phone = (call.args as any).phone_number || '';
                  const { message } = (call.args as any);
                  const smsUrl = `sms:${phone}${phone ? '?' : ''}body=${encodeURIComponent(message)}`;
                  window.location.href = smsUrl;
                  dispatchLog('success', 'SMS Opened', `Message: ${message.substring(0, 30)}...`);
                  const charCount = message.length;
                  const smsCount = Math.ceil(charCount / 160);
                  const feedback = phone 
                    ? `SUCCESS: SMS app opened to send to ${phone}. Message (${charCount} chars, ${smsCount} SMS): "${message.substring(0, 50)}...". User can review and tap send.`
                    : `SUCCESS: SMS app opened with message pre-filled (${charCount} chars, ${smsCount} SMS). User can select recipient and send.`;
                  sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: feedback } }] }));
                } else if (call.name === 'create_calendar_event') {
                  const { title, date } = (call.args as any);
                  const startTime = (call.args as any).start_time;
                  const endTime = (call.args as any).end_time || startTime;
                  const details = (call.args as any).details || '';
                  const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${date}T${startTime}00/${date}T${endTime}00&details=${encodeURIComponent(details)}`;
                  window.open(calendarUrl, '_blank');
                  // Format date for user feedback
                  const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
                  const formattedTime = `${startTime.substring(0, 2)}:${startTime.substring(2)}`;
                  dispatchLog('success', 'Calendar Opened', `Event: ${title} on ${formattedDate}`);
                  sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: `Google Calendar opened with event "${title}" scheduled for ${formattedDate} at ${formattedTime}. User can review and save.` } }] }));
                } else if (call.name === 'fetch_url_content') {
                  const { url } = (call.args as any);
                  const customInstruction = (call.args as any).custom_instruction || '';
                  dispatchLog('info', '🌐 Fetching URL', url.substring(0, 50));
                  
                  try {
                    // Use a CORS proxy for fetching
                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
                    const response = await fetch(proxyUrl);
                    const data = await response.json();
                    const html = data.contents;
                    
                    // Extract text content (basic HTML stripping)
                    const text = html
                      .replace(/<script[^>]*>.*?<\/script>/gi, '')
                      .replace(/<style[^>]*>.*?<\/style>/gi, '')
                      .replace(/<[^>]+>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim()
                      .substring(0, 5000); // Limit to 5000 chars
                    
                    // Store for email inclusion
                    fetchedUrlContentRef.current = {
                      url,
                      content: text,
                      timestamp: Date.now()
                    };
                    
                    dispatchLog('success', 'URL Content Fetched', `${text.length} chars from ${url.substring(0, 30)}...`);
                    
                    const summary = customInstruction 
                      ? `Content from ${url} (focusing on: ${customInstruction}):\n\n${text}`
                      : `Content from ${url}:\n\n${text}`;
                    
                    sessionPromise.then((s: any) => s.sendToolResponse({ 
                      functionResponses: [{ 
                        id: call.id, 
                        name: call.name, 
                        response: { result: `SUCCESS: Fetched ${text.length} characters from ${url}. Content summary:\n\n${text.substring(0, 1500)}${text.length > 1500 ? '...[truncated]' : ''}\n\nIMPORTANT: After summarizing this content for the user, proactively offer: \"Would you like me to email you this information?\"` } 
                      }] 
                    }));
                  } catch (error) {
                    dispatchLog('error', 'URL Fetch Failed', String(error));
                    sessionPromise.then((s: any) => s.sendToolResponse({ 
                      functionResponses: [{ 
                        id: call.id, 
                        name: call.name, 
                        response: { result: `Failed to fetch URL: ${String(error)}` } 
                      }] 
                    }));
                  }
                } else if (call.name === 'share_content') {
                  const shareData = {
                    title: (call.args as any).title || 'VCB PoLYGoN',
                    text: (call.args as any).text,
                    url: (call.args as any).url
                  };
                  if (navigator.share) {
                    navigator.share(shareData).then(() => {
                      dispatchLog('success', 'Shared', 'Content shared via native share');
                    }).catch(() => {
                      dispatchLog('warn', 'Share Cancelled', 'User cancelled share dialog');
                    });
                    sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: `SUCCESS: Native share dialog opened. User can choose how to share: \"${shareData.text.substring(0, 50)}...\"${shareData.url ? ` with link: ${shareData.url}` : ''}. Available options include WhatsApp, email, social media, etc.` } }] }));
                  } else {
                    navigator.clipboard.writeText(shareData.text + (shareData.url ? ` ${shareData.url}` : ''));
                    dispatchLog('success', 'Copied for Sharing', 'Content copied (share not supported on this device)');
                    sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: `Note: Native sharing not supported on this device. Content has been copied to clipboard instead. User can paste it anywhere with Ctrl+V.` } }] }));
                  }
                } else if (call.name === 'prompt_screen_share') {
                  const reason = (call.args as any).reason || 'to help you better';
                  dispatchLog('info', '🖥️ Screen Share Requested', reason.substring(0, 50));
                  
                  // Trigger the screen share UI
                  startScreenShare();
                  
                  sessionPromise.then((s: any) => s.sendToolResponse({ 
                    functionResponses: [{ 
                      id: call.id, 
                      name: call.name, 
                      response: { 
                        result: `SUCCESS: Screen share dialog has been opened for the user. Reason: "${reason}". The user is now being prompted to select which screen, window, or tab to share. Once they share, you will be able to see their screen in real-time. Be encouraging and let them know you're ready to help guide them through whatever they need!` 
                      } 
                    }] 
                  }));
                } else if (call.name === 'prompt_camera_share') {
                  const reason = (call.args as any).reason || 'to see what you\'re looking at';
                  dispatchLog('info', '📷 Camera Share Requested', reason.substring(0, 50));
                  
                  // Trigger the camera UI (not screen share)
                  toggleVideo(false);
                  
                  sessionPromise.then((s: any) => s.sendToolResponse({ 
                    functionResponses: [{ 
                      id: call.id, 
                      name: call.name, 
                      response: { 
                        result: `SUCCESS: Camera has been activated for the user. Reason: "${reason}". The user's camera is now turning on and you will soon be able to see what they're pointing it at. Be warm and encouraging - let them know you're excited to help and ask them to show you what they need help with!` 
                      } 
                    }] 
                  }));
                } else if (call.name === 'request_location') {
                  const reason = (call.args as any).reason || 'to help with location-based services';
                  dispatchLog('info', '📍 Location Requested', reason.substring(0, 50));
                  
                  // Request location from browser
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        userLocationRef.current = {
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude
                        };
                        dispatchLog('success', '📍 Location Obtained', `Lat: ${position.coords.latitude.toFixed(4)}, Lon: ${position.coords.longitude.toFixed(4)}`);
                        
                        sessionPromise.then((s: any) => s.sendToolResponse({ 
                          functionResponses: [{ 
                            id: call.id, 
                            name: call.name, 
                            response: { 
                              result: `SUCCESS: User has shared their location! GPS Coordinates: Latitude ${position.coords.latitude.toFixed(6)}, Longitude ${position.coords.longitude.toFixed(6)}. You can now use this for nearby searches, directions, local recommendations, weather, etc. The user is at these exact coordinates RIGHT NOW.` 
                            } 
                          }] 
                        }));
                      },
                      (error) => {
                        dispatchLog('warn', '📍 Location Denied', error.message);
                        sessionPromise.then((s: any) => s.sendToolResponse({ 
                          functionResponses: [{ 
                            id: call.id, 
                            name: call.name, 
                            response: { 
                              result: `Location access was denied or unavailable. Error: ${error.message}. Ask the user to enable location permissions in their browser settings, or ask them to describe their location verbally so you can help them.` 
                            } 
                          }] 
                        }));
                      },
                      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                    );
                  } else {
                    sessionPromise.then((s: any) => s.sendToolResponse({ 
                      functionResponses: [{ 
                        id: call.id, 
                        name: call.name, 
                        response: { 
                          result: `Geolocation is not supported by this browser. Ask the user to describe their location verbally so you can help them.` 
                        } 
                      }] 
                    }));
                  }
                } else if (call.name === 'google_search' || call.name === 'google_maps') {
                  const toolName = call.name === 'google_search' ? 'Search' : 'Maps';
                  const query = (call.args as any).query || (call.args as any).location || 'N/A';
                  dispatchLog('info', `${toolName} Tool`, `Query: ${query}`);
                  searchResultsRef.current.push({ query, tool: toolName, timestamp: Date.now() });
                  sessionPromise.then((s: any) => s.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { result: 'Searching...' } }] }));
                }
              }
            }

            // If serverContent includes an interrupted flag, stop active audio
            if ((msg as any).serverContent?.interrupted) {
              if (verbose) dispatchLog('info', 'DEBUG', 'Server reported interrupted; stopping audio sources');
              activeSourcesRef.current.forEach(src => { try { src.stop(); } catch (e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = outputCtx.currentTime;
              currentOutputTranscriptionRef.current = '';
            }

            // Handle toolCallCancellation - cancel pending tool calls when user interrupts
            if ((msg as any).toolCallCancellation?.ids?.length) {
              const cancelledIds = (msg as any).toolCallCancellation.ids;
              dispatchLog('info', 'Tool Calls Cancelled', `IDs: ${cancelledIds.join(', ')}`);
              // Note: Since we execute tools immediately and send responses, this is mostly informational
              // Future: could add pending tool tracking to actually cancel in-flight operations
            }

            // Handle goAway - server will disconnect soon, prepare for reconnect
            if ((msg as any).goAway) {
              const goAwayMsg = (msg as any).goAway;
              dispatchLog('warn', 'Server GoAway', `Server will disconnect. Reason: ${goAwayMsg.reason || 'unspecified'}`);
              // Preemptively prepare for reconnection - don't wait for close event
              if (!isIntentionalDisconnectRef.current) {
                const reconnectDelay = goAwayMsg.gracePeriodMs || 3000;
                dispatchLog('info', 'Reconnecting', `Preparing reconnect in ${reconnectDelay}ms...`);
                setTimeout(() => {
                  if (isConnectedRef.current && connectRef.current) {
                    // Gracefully close and reconnect
                    isIntentionalDisconnectRef.current = true;
                    sessionPromise.then((s: any) => s.close?.()).catch(() => {});
                    sessionRef.current = null;
                    stopAudio();
                    isIntentionalDisconnectRef.current = false;
                    connectRef.current(true);
                  }
                }, Math.max(reconnectDelay - 500, 500)); // Start reconnect slightly before grace period ends
              }
            }

            // Optional: only attempt parsing code/search results (heavier logic) when there are relevant parts
            const modelParts = (msg as any).serverContent?.modelTurn?.parts;
            if (modelParts?.some((p: any) => p.executableCode || p.codeExecutionResult)) {
              // handle code / execution results or search parsing here if needed (kept light by guarding above)
              if (verbose) dispatchLog('info', 'DEBUG', 'Received executable code or execution results in modelTurn parts.');
            }
            } catch (err) {
              dispatchLog('error', 'DEBUG onmessage', `Handler error: ${String(err)} - swallowed`);
            }
          },
          onclose: (e: any) => {
            // WebSocket Close Codes Reference:
            // 1000 = Normal closure (clean disconnect)
            // 1001 = Going away (server/client navigating away)
            // 1002 = Protocol error
            // 1003 = Unsupported data type
            // 1006 = Abnormal closure (no close frame received - connection dropped)
            // 1007 = Invalid frame payload data
            // 1008 = Policy violation (API key leaked/revoked)
            // 1009 = Message too big
            // 1010 = Missing extension
            // 1011 = Internal server error
            // 1012 = Service restart
            // 1013 = Try again later
            // 1014 = Bad gateway
            // 1015 = TLS handshake failure
            // 4000+ = Application-specific (Google API errors)
            const closeCode = e?.code || 0;
            const closeReason = e?.reason || '';
            const wasClean = e?.wasClean ?? false;
            
            // Human-readable close code interpretation
            const codeDescriptions: Record<number, string> = {
              1000: 'Normal closure',
              1001: 'Going away',
              1002: 'Protocol error',
              1003: 'Unsupported data',
              1006: 'Abnormal closure (connection dropped)',
              1007: 'Invalid payload',
              1008: 'Policy violation (API key leaked/revoked)',
              1009: 'Message too big',
              1010: 'Missing extension',
              1011: 'Internal server error',
              1012: 'Service restart',
              1013: 'Try again later',
              1014: 'Bad gateway',
              1015: 'TLS handshake failure',
            };
            const codeDesc = codeDescriptions[closeCode] || (closeCode >= 4000 ? 'Google API error' : 'Unknown');
            
            // SECURITY: Only log to UI, not browser console
            dispatchLog('warn', 'WebSocket Closed', `Code ${closeCode}: ${codeDesc}${closeReason ? ` - ${closeReason}` : ''}`);
            
            // CRITICAL: Immediately stop video frame loop to prevent WebSocket errors
            if (frameIntervalRef.current) {
              clearInterval(frameIntervalRef.current);
              frameIntervalRef.current = null;
            }
            isConnectedRef.current = false; // Stop all sending immediately
            
            // Check if onopen ever fired
            const onopenFired = sessionOpenTimeRef.current !== null;
            
            // Handle specific close codes - 1007 (invalid key) and 1008 (leaked key)
            if (closeCode === 1007 || closeCode === 1008) {
              const reasonText = closeCode === 1008 ? 'leaked/revoked' : 'invalid/not found';
              markKeyFailed(currentKey, `Close code ${closeCode}: API key ${reasonText}`);
              dispatchLog('error', 'API Key Error', `Key ${reasonText}. Rotating to next key...`);
              // CRITICAL: Clear sessionRef so retry can proceed
              sessionRef.current = null;
              // Immediately retry with next key (SECURITY: no key info logged)
              stopAudio();
              setTimeout(async () => {
                try {
                  if (connectRef.current) {
                    await connectRef.current(true);
                  }
                } catch (retryErr) {
                  // Silently handle retry errors - dispatchLog will show status
                }
              }, 500);
              return; // Exit early - don't run other onclose logic
            }
            
            // Handle planned video mode switch - reconnect immediately
            if (isSwitchingToVideoRef.current) {
              dispatchLog('info', 'Vision System', 'Reconnecting for video mode...');
              // DON'T reset isSwitchingToVideoRef here - let startVideo reset it after checking
              sessionRef.current = null;
              // Reconnect immediately, then start video after connection is established
              setTimeout(async () => {
                if (connectRef.current) {
                  await connectRef.current(false);
                  // After reconnect, start video with the saved screen share preference
                  setTimeout(() => {
                    if (isConnectedRef.current && startVideoRef.current) {
                      startVideoRef.current(isScreenShareRef.current);
                    }
                  }, 500);
                }
              }, 100);
              return;
            }
            
            if (!isIntentionalDisconnectRef.current) {
              // log close details for diagnosis
              try { dispatchLog('info', 'DEBUG onclose', `code:${e?.code ?? 'n/a'} reason:${e?.reason ?? 'n/a'}`); } catch(e){}
              // If the connection opened then closed very quickly, it could be
              // - an unsupported model (e.g. native audio model not supporting bidiGenerateContent)
              // - or an auth/permission issue. We must treat these differently.
              const openTs = sessionOpenTimeRef.current;
              const now = Date.now();
              const reason = String(e?.reason || '');
              const codeMsg = String(e?.code || '');

              // Detect explicit model-not-found / unsupported bidiGenerateContent cases
              const modelUnsupported = /not found for API version|not supported for bidiGenerateContent|is not found|unsupported modality/i.test(reason + ' ' + codeMsg);

              // If we failed quickly AND the reason suggests the model doesn't support bidiGenerateContent
              // then this is NOT a key/auth problem — attempt a fallback to a compatible multimodal model
              if (openTs && now - openTs < 3000 && modelUnsupported) {
                dispatchLog('warn','Model Compatibility', 'AI model compatibility issue detected. Retrying...');
                // Prevent retry loops — attempt a single fallback for this attempt
                try { sessionOpenTimeRef.current = null; } catch {}
                sessionRef.current = null; // CRITICAL: Clear session ref so retry can proceed
                const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
                retryCountRef.current += 1;
                stopAudio();
                // Do not switch to different models; retry with the same chosenModel after a backoff.
                setTimeout(() => { if (connectRef.current) connectRef.current(true, chosenModel); }, backoff);
                return; // skip blacklisting for incompatible-model cases
              }

              // For other quick failures, check if they indicate auth/perms and blacklist only on auth-like errors
              if (openTs && now - openTs < 3000) {
                // close reason suggests something else — only blacklist for auth/permission errors
                if (/401|403|api key|unauthor|leaked/i.test(reason + ' ' + codeMsg)) {
                  try { markKeyFailed(currentKey, `Quick close auth error: ${(reason + ' ' + codeMsg).slice(0,80)}`); } catch(e){}
                } else {
                  // quick close but not auth — do not mark key failed, retry with backoff using same key
                  dispatchLog('warn','Connection Lost','Session opened & closed quickly — retrying without blacklisting.');
                }
              }

              // If the close reason contains explicit auth errors, blacklist the key
              try {
                if (/401|403|api key|invalid key|quota|leaked/i.test(reason + ' ' + codeMsg)) {
                  markKeyFailed(currentKey, `Close reason auth failure: ${(reason + ' ' + codeMsg).slice(0,80)}`);
                }
              } catch (err) {}
              sessionOpenTimeRef.current = null;
              sessionRef.current = null; // CRITICAL: Clear session ref so retry can proceed
              const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
              retryCountRef.current += 1;
              dispatchLog('warn', 'Connection Lost', `Auto-reconnecting in ${backoff}ms...`);
              stopAudio();
              setTimeout(() => { if (connectRef.current) connectRef.current(true); }, backoff);
            }
          },
          onerror: (err: any) => {
            // CRITICAL: Immediately stop video frame loop and all sending
            if (frameIntervalRef.current) {
              clearInterval(frameIntervalRef.current);
              frameIntervalRef.current = null;
            }
            isConnectedRef.current = false;
            // Enhanced error classification based on Context7 ApiError patterns
            const errMsg = String(err?.message || err || '');
            const errStatus = err?.status || (errMsg.match(/\b(4\d{2}|5\d{2})\b/)?.[0] ?? null);
            
            dispatchLog('error', 'Session Error', `Status: ${errStatus || 'unknown'} - ${errMsg.slice(0, 150)}`);
            
            try {
              // Classify error by status code pattern
              if (errStatus === '401' || errStatus === '403' || /api key|invalid key|unauthor|permission|leaked/i.test(errMsg)) {
                // Authentication/Permission error - blacklist key
                markKeyFailed(currentKey, `Auth error ${errStatus}: ${errMsg.slice(0,80)}`);
              } else if (errStatus === '429' || /rate limit|quota exceeded|too many requests/i.test(errMsg)) {
                // Rate limit - exponential backoff, don't blacklist key permanently
                const backoffMs = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000); // Cap at 30s for rate limits
                dispatchLog('warn', 'Rate Limited', `Too many requests. Backing off ${backoffMs}ms...`);
                retryCountRef.current += 1;
                stopAudio();
                setTimeout(() => { if (connectRef.current) connectRef.current(true); }, backoffMs);
              } else if (errStatus === '404' || /not found for API version|not supported for bidiGenerateContent|unsupported modality/i.test(errMsg)) {
                // Model incompatibility - not a key problem
                dispatchLog('warn', 'Model Compatibility', 'AI model compatibility issue detected');
              } else if (errStatus === '400' || /invalid|bad request|malformed/i.test(errMsg)) {
                // Invalid request - log for debugging
                dispatchLog('error', 'Invalid Request', `Bad request params: ${errMsg.slice(0, 100)}`);
              } else if (/network|timeout|connection/i.test(errMsg)) {
                // Network error - retry without blacklisting
                dispatchLog('warn', 'Network Error', 'Connection issue - will retry...');
              }
            } catch (e) {
              // Error handling itself failed - log and continue
              console.warn('[ERROR HANDLER] Exception in error handler:', e);
            }
          }
        }
      });
        // SECURITY: Removed connect debug log
      } catch (connectErr: any) {
        dispatchLog('error', 'Connect Error', String(connectErr?.message || connectErr).slice(0, 100));
        throw connectErr;
      }

      sessionRef.current = sessionPromise;
      
      // Add timeout for session establishment (10 seconds)
      const connectionTimeout = setTimeout(() => {
        if (!isConnectedRef.current) {
          dispatchLog('error', 'Connection Timeout', 'Server did not respond. Rotating to next key...');
          // DON'T blacklist on timeout - just rotate to next key (timeout is often transient)
          rotateToNextKey();
          const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
          retryCountRef.current += 1;
          stopAudio();
          setTimeout(() => { if (connectRef.current) connectRef.current(true); }, backoff);
        }
      }, 10000);
      
      // SECURITY: Session status handled via dispatchLog only (no console logs)
      sessionPromise.then((session: any) => {
        clearTimeout(connectionTimeout);
        dispatchLog('info', 'Session Ready', 'WebSocket connection established');
      }).catch((err: any) => {
        clearTimeout(connectionTimeout);
        dispatchLog('error', 'Session Failed', String(err).slice(0, 100));
        // Mark key as failed if it's an auth issue and trigger retry
        const errMsg = String(err?.message || err);
        if (/401|403|leaked|unauthor|api key/i.test(errMsg)) {
          markKeyFailed(currentKey, `Session promise auth error: ${errMsg.slice(0,80)}`);
          const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
          retryCountRef.current += 1;
          stopAudio();
          setTimeout(() => { if (connectRef.current) connectRef.current(true); }, backoff);
        }
      });

      // Setup AudioWorklet message handler (RMS normalization done in worklet)
      workletNode.port.postMessage({ type: 'setSafeToSpeak', value: false });
      workletNode.port.postMessage({ type: 'setMuted', value: isMicMutedRef.current });
      
      workletNode.port.onmessage = (e) => {
        if (e.data.type !== 'audio') return;
        if (!isConnectedRef.current) return;
        // CRITICAL: Don't send audio during warmup period - native audio model is sensitive
        if (!safeToSpeakRef.current) return;
        
        const pcm = e.data.data;
        const { rms } = e.data;
        
        // Auto-interrupt when user speaks (if enabled) - requires sustained loud speech
        if (autoInterruptRef.current && modelIsSpeakingRef.current && rms > interruptionThreshold) {
          const now = Date.now();
          if (now - lastInterruptionTsRef.current > 1200) { // 1.2s debounce to prevent over-interrupting
            lastInterruptionTsRef.current = now;
            activeSourcesRef.current.forEach(src => {
              try { src.stop(); src.disconnect(); } catch (e) {}
            });
            activeSourcesRef.current.clear();
            nextStartTimeRef.current = outputCtx.currentTime;
            modelIsSpeakingRef.current = false;
            (async () => {
              try {
                if (!isConnectedRef.current) return; // Guard before async operation
                const session = await sessionPromise;
                if (!isConnectedRef.current) return; // Guard after await
                await session.sendRealtimeInput({ interruption: {} });
                if (verbose) dispatchLog('info', 'Auto-Interrupt', 'User speaking - audio stopped');
              } catch (e) {
                // Silently ignore if connection closed
                if (isConnectedRef.current && verbose) dispatchLog('warn', 'Interrupt Failed', String(e));
              }
            })();
          }
        }
        
        const blob = createPcmBlob(pcm, AUDIO_CONFIG.inputSampleRate);
        sessionPromise.then(async (session: any) => {
          if (!isConnectedRef.current) return; // Guard: don't send if disconnected
          try {
            await session.sendRealtimeInput({ media: blob });
          } catch (e: any) {
            // Check for WebSocket closed error to prevent spam
            const errMsg = String(e?.message || e);
            if (errMsg.includes('CLOSING') || errMsg.includes('CLOSED')) {
               // If socket is closed, immediately update state to stop further attempts
               isConnectedRef.current = false;
               console.warn('[Audio] WebSocket closed unexpectedly during send');
               return;
            }
            // Silently ignore other errors if we think we're connected (might be transient)
            if (isConnectedRef.current && verbose) dispatchLog('warn', 'Audio Send Failed', errMsg);
          }
        }).catch(() => {});
      };
      
    } catch (err: any) {
      // If connect failed due to auth/instantiation, mark key and try next
      const msg = String(err?.message || err);
      if (msg.toLowerCase().includes('401') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('realtime client constructor')) {
        try {
          const curKey = apiKeys[currentKeyIndexRef.current];
          markKeyFailed(curKey, `Connect catch auth error: ${msg.slice(0,80)}`);
        } catch {}
      }

      dispatchLog('error', 'Connection Failed', msg);
      setStatus('error');
      setError(msg || 'Failed to connect');
      stopAudio();
    }
  }, [apiKeys, persona, selectedAudioDeviceId, stopAudio, speechThreshold, userEmail]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    startVideoRef.current = startVideo;
  }, [startVideo]);

  // Minimal exported API
  return {
    status,
    connect,
    disconnect,
    setManualUserAction,
    inputAnalyserRef,
    outputAnalyserRef,
    detectedLanguage,
    transcript,
    error,
    isMuted,
    toggleMute,
    isMicMuted,
    toggleMic,
    timeLeft,
    transcriptSent,
    isPttMode,
    setPttMode,
    setPttActive,
    isVideoActive,
    toggleVideo,
    startScreenShare,
    switchCamera,
    facingMode,
    videoRef,
    audioDevices,
    selectedAudioDeviceId,
    setSelectedAudioDeviceId
  };
}
