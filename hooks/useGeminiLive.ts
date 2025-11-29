import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AUDIO_CONFIG, LANGUAGE_TOOL } from '../constants';
import { createPcmBlob, decodeAudioData, hasSpeech, base64ToUint8Array } from '../utils/audioUtils';
import { ConnectionStatus, Persona } from '../types';
import { sendTranscriptEmail } from '../services/emailService';

export interface UseGeminiLiveProps {
  apiKey: string | undefined;
  persona: Persona;
}

const VOLUME_GAIN = 1.5;

// Audio Worklet Code to run in a separate thread
const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.index = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.index++] = channelData[i];
        if (this.index >= this.bufferSize) {
          this.port.postMessage(this.buffer);
          this.index = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

interface TranscriptEntry {
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
}

export function useGeminiLive({ apiKey, persona }: UseGeminiLiveProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('Auto-Detect');
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [transcriptSent, setTranscriptSent] = useState(false);

  // API Key Management
  const apiKeys = useMemo(() => 
    apiKey ? apiKey.split(',').map(k => k.trim()).filter(k => k.length > 0) : [], 
  [apiKey]);
  const currentKeyIndexRef = useRef(0);
  const retryCountRef = useRef(0);

  // Refs for audio management
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // Public Analyser Refs (Exposed to Visualizer)
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<Promise<any> | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const interruptionEpochRef = useRef<number>(0);
  const demoTimerRef = useRef<number | null>(null);
  const personaRef = useRef<Persona>(persona);
  const isMutedRef = useRef(isMuted);
  const isMicMutedRef = useRef(isMicMuted);
  
  const lastUserSpeechTimeRef = useRef<number>(Date.now());
  const silenceCheckIntervalRef = useRef<number | null>(null);
  
  // --- STATE CONTROL REFS ---
  const connectionIdRef = useRef<string | null>(null);
  const isIntentionalDisconnectRef = useRef<boolean>(false);
  const statusRef = useRef<ConnectionStatus>('disconnected');
  const connectStartTimeRef = useRef<number>(0);
  const conversationHistoryRef = useRef<TranscriptEntry[]>([]);
  
  // Transcription accumulators
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');
  
  // Synchronous Gate: strictly tracks if we believe the socket is open
  const isConnectedRef = useRef<boolean>(false);
  
  // Retry Logic for recursive connection
  const connectRef = useRef<((isRetry?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (gainNodeRef.current && gainNodeRef.current.context) {
        const ctx = gainNodeRef.current.context;
        const currentTime = ctx.currentTime;
        gainNodeRef.current.gain.setTargetAtTime(isMuted ? 0 : VOLUME_GAIN, currentTime, 0.05);
    }
  }, [isMuted]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const toggleMic = useCallback(() => {
    setIsMicMuted(prev => !prev);
  }, []);

  // --- TRIPSWITCH: EMAIL DISPATCH LOGIC ---
  const dispatchTranscript = useCallback(async () => {
    const duration = Date.now() - connectStartTimeRef.current;
    
    // Condition: Session must be longer than 20 seconds
    if (duration > 20000 && conversationHistoryRef.current.length > 0) {
        console.log(`[BuaX1] ⚡ TRIPSWITCH: Session Duration ${Math.round(duration/1000)}s > 20s. Sending to Email Service...`);
        
        // Pass the ref data to the service
        const success = await sendTranscriptEmail(
            conversationHistoryRef.current,
            duration,
            personaRef.current,
            connectionIdRef.current || 'unknown-session'
        );

        if (success) {
            setTranscriptSent(true);
            setTimeout(() => setTranscriptSent(false), 5000);
        }
    } else {
        console.log(`[BuaX1] Session ended. Duration ${Math.round(duration/1000)}s < 20s. No transcript sent.`);
    }
  }, []);

  const stopAudio = useCallback(() => {
    console.log('[BuaX1] Stopping Audio Subsystems...');
    
    // CRITICAL: Immediate synchronous gate close
    isConnectedRef.current = false;
    connectionIdRef.current = null;
    
    // Kill the worklet
    if (workletNodeRef.current) {
        // Remove event listener to prevent processing errors during shutdown
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.onprocessorerror = null;
        try { workletNodeRef.current.disconnect(); } catch(e) {}
        workletNodeRef.current = null;
    }

    if (demoTimerRef.current) {
        window.clearInterval(demoTimerRef.current);
        demoTimerRef.current = null;
    }

    if (silenceCheckIntervalRef.current) {
        window.clearInterval(silenceCheckIntervalRef.current);
        silenceCheckIntervalRef.current = null;
    }

    if (inputContextRef.current) {
      try { inputContextRef.current.close(); } catch(e) {}
      inputContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch(e) {}
      sourceRef.current = null;
    }
    
    // Disconnect Nodes
    [gainNodeRef, inputAnalyserRef, outputAnalyserRef].forEach(ref => {
        if (ref.current) {
            try { ref.current.disconnect(); } catch(e) {}
        }
    });

    activeSourcesRef.current.forEach(source => {
      try { source.stop(); source.disconnect(); } catch (e) {}
    });
    activeSourcesRef.current.clear();
    
    if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch(e) {}
        audioContextRef.current = null;
    }
    
    console.log('[BuaX1] Audio Stopped.');
  }, []);

  const disconnect = useCallback(async (errorMessage?: string) => {
    console.log('[BuaX1] Disconnecting session (Intentional)...');
    
    // Trigger Tripswitch
    dispatchTranscript();

    isIntentionalDisconnectRef.current = true;
    isConnectedRef.current = false; // Immediate gate

    if (sessionRef.current) {
        try {
            const session = await sessionRef.current;
            session.close();
        } catch (e) {
            console.warn('[BuaX1] Error closing session:', e);
        }
    }
    sessionRef.current = null;
    
    // State sanitation
    setStatus('disconnected');
    setDetectedLanguage('Auto-Detect');
    setTranscript('');
    retryCountRef.current = 0;
    
    if (errorMessage) {
        setError(errorMessage);
        setStatus('error');
    }
    
    stopAudio();
  }, [stopAudio, dispatchTranscript]);

  const connect = useCallback(async (isRetry = false) => {
    if (apiKeys.length === 0) {
      setError('API Key is missing.');
      setStatus('error');
      return;
    }
    
    // Ensure clean slate
    stopAudio();
    isConnectedRef.current = false;
    setTranscriptSent(false); // Reset sent flag

    const currentKey = apiKeys[currentKeyIndexRef.current];
    console.log(`[BuaX1] Connecting with key index: ${currentKeyIndexRef.current} (Attempt ${retryCountRef.current + 1})`);

    // Generate a unique ID for this connection attempt
    const myConnectionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    connectionIdRef.current = myConnectionId;

    try {
      setStatus('connecting');
      setError(null);
      
      // Clean previous session data
      setDetectedLanguage('Auto-Detect');
      setTranscript('');
      conversationHistoryRef.current = []; // Reset history for new session
      currentInputTranscriptionRef.current = '';
      currentOutputTranscriptionRef.current = '';
      
      const currentPersona = personaRef.current;
      setTimeLeft(currentPersona.maxDurationSeconds || 120);
      
      // Reset State Flags
      interruptionEpochRef.current = 0;
      isIntentionalDisconnectRef.current = false;
      connectStartTimeRef.current = Date.now();

      // --- AUDIO SETUP ---
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: AUDIO_CONFIG.inputSampleRate }); 
      const outputCtx = new AudioContextClass({ sampleRate: AUDIO_CONFIG.outputSampleRate });
      
      // Enterprise Stability: Robust context resumption
      await Promise.all([
          outputCtx.resume().catch(e => console.warn("Output Resume failed", e)), 
          inputCtx.resume().catch(e => console.warn("Input Resume failed", e))
      ]);
      
      // If user cancelled while we were waiting for contexts
      if (connectionIdRef.current !== myConnectionId) return;

      audioContextRef.current = outputCtx;
      inputContextRef.current = inputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // 1. Output Pipeline (Speaker)
      const compressor = outputCtx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 30;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003; 
      compressor.release.value = 0.25;

      const outputAnalyser = outputCtx.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyser.smoothingTimeConstant = 0.3;
      outputAnalyserRef.current = outputAnalyser;
      
      const gainNode = outputCtx.createGain();
      gainNode.gain.value = isMutedRef.current ? 0 : VOLUME_GAIN;
      gainNodeRef.current = gainNode;
      
      gainNode.connect(compressor);
      compressor.connect(outputAnalyser);
      outputAnalyser.connect(outputCtx.destination);

      // 2. Input Pipeline (Microphone)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
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
      inputAnalyser.fftSize = 256;
      inputAnalyser.smoothingTimeConstant = 0.5;
      inputAnalyserRef.current = inputAnalyser;
      
      source.connect(inputAnalyser);

      // 3. Audio Worklet - Robust Loading
      const blob = new Blob([WORKLET_CODE], { type: "application/javascript; charset=utf-8" });
      const workletUrl = URL.createObjectURL(blob);
      
      try {
        await inputCtx.audioWorklet.addModule(workletUrl);
      } catch (err: any) {
        throw new Error(`Failed to load audio worklet: ${err.message}`);
      } finally {
        URL.revokeObjectURL(workletUrl); // Cleanup memory
      }
      
      const workletNode = new AudioWorkletNode(inputCtx, 'pcm-processor');
      workletNodeRef.current = workletNode;
      
      workletNode.onprocessorerror = (err) => {
        console.error('[BuaX1] Worklet Processor Error:', err);
        // Don't disconnect immediately for minor glitches, but log it.
        // If it stops processing, the session will time out via silence detection eventually.
      };
      
      inputAnalyser.connect(workletNode);
      // Connect to gain 0 to keep graph alive but mute local feedback
      const nullGain = inputCtx.createGain();
      nullGain.gain.value = 0;
      workletNode.connect(nullGain);
      nullGain.connect(inputCtx.destination);


      // --- GEMINI API CONNECTION ---
      const ai = new GoogleGenAI({ apiKey: currentKey });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: currentPersona.voiceName } }
            },
            systemInstruction: currentPersona.baseInstruction,
            tools: LANGUAGE_TOOL,
            inputAudioTranscription: {}, // Correct empty object for enablement
            outputAudioTranscription: {}  // Correct empty object for enablement
        },
        callbacks: {
            onopen: () => {
                if (connectionIdRef.current !== myConnectionId) return;
                console.log('[BuaX1] Session Connected.');
                setStatus('connected');
                isConnectedRef.current = true;
                
                demoTimerRef.current = window.setInterval(() => {
                    setTimeLeft((prev) => {
                        if (prev <= 1) {
                            disconnect("Demo time limit reached.");
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            },
            onmessage: async (msg: LiveServerMessage) => {
                if (connectionIdRef.current !== myConnectionId) return;

                // Handle Audio
                const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData) {
                    try {
                        const audioBuffer = await decodeAudioData(
                            base64ToUint8Array(audioData),
                            outputCtx,
                            AUDIO_CONFIG.outputSampleRate,
                            1
                        );
                        
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                        
                        const source = outputCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(gainNode);
                        
                        source.onended = () => {
                            activeSourcesRef.current.delete(source);
                        };
                        
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        activeSourcesRef.current.add(source);
                    } catch (e) {
                        console.error("Audio decoding error", e);
                    }
                }

                // Handle Transcription
                const serverContent = msg.serverContent;
                if (serverContent) {
                    if (serverContent.outputTranscription?.text) {
                        currentOutputTranscriptionRef.current += serverContent.outputTranscription.text;
                    }
                    if (serverContent.inputTranscription?.text) {
                        currentInputTranscriptionRef.current += serverContent.inputTranscription.text;
                    }

                    if (serverContent.turnComplete) {
                        const userText = currentInputTranscriptionRef.current.trim();
                        const modelText = currentOutputTranscriptionRef.current.trim();
                        
                        if (userText) {
                            conversationHistoryRef.current.push({
                                role: 'user',
                                text: userText,
                                timestamp: Date.now()
                            });
                        }
                        if (modelText) {
                            conversationHistoryRef.current.push({
                                role: 'model',
                                text: modelText,
                                timestamp: Date.now()
                            });
                            setTranscript(modelText);
                        }
                        
                        currentInputTranscriptionRef.current = '';
                        currentOutputTranscriptionRef.current = '';
                    }
                }

                // Handle Tool Calls (Language Detection)
                // TypeScript Fix: Ensure functionCalls exists before iterating
                if (msg.toolCall && msg.toolCall.functionCalls) {
                   for (const call of msg.toolCall.functionCalls) {
                       if (call.name === 'report_language_change') {
                           const lang = (call.args as any).language;
                           setDetectedLanguage(lang);
                           // Send response back
                           sessionPromise.then(session => session.sendToolResponse({
                               functionResponses: [{
                                   id: call.id,
                                   name: call.name,
                                   response: { result: 'ok' }
                               }]
                           }));
                       }
                   }
                }

                // Handle Interruption
                if (serverContent?.interrupted) {
                    console.log('[BuaX1] Interruption detected');
                    activeSourcesRef.current.forEach(src => {
                        try { src.stop(); } catch(e){}
                    });
                    activeSourcesRef.current.clear();
                    nextStartTimeRef.current = outputCtx.currentTime;
                    currentOutputTranscriptionRef.current = ''; 
                }
            },
            onclose: (e) => {
                 // Immediate Disconnect Handling (Quota/Key issues)
                 const duration = Date.now() - connectStartTimeRef.current;
                 const wasClean = !e.wasClean; // e.wasClean is usually false for errors
                 
                 // If connection died instantly (< 4s), it's likely a bad key or quota limit
                 if (duration < 4000 && apiKeys.length > 1 && !isIntentionalDisconnectRef.current) {
                     console.warn(`[BuaX1] Immediate disconnect detected (Quota?). Rotating API Key from index ${currentKeyIndexRef.current} to ${currentKeyIndexRef.current + 1}`);
                     
                     // Rotate Key
                     currentKeyIndexRef.current = (currentKeyIndexRef.current + 1) % apiKeys.length;
                     
                     // Safe Recursive Retry
                     setTimeout(() => {
                         if (connectRef.current) connectRef.current(true);
                     }, 1000); 
                     return;
                 }

                if (!isIntentionalDisconnectRef.current) {
                    console.warn('[BuaX1] Session closed unexpectedly:', e);
                    disconnect("Connection lost."); 
                }
            },
            onerror: (err) => {
                 console.error('[BuaX1] Session Error:', err);
                 // Don't disconnect here immediately if onclose handles it, 
                 // but for safety, ensure we catch it.
                 isConnectedRef.current = false;
            }
        }
      });
      
      sessionRef.current = sessionPromise;

      workletNode.port.onmessage = (event) => {
          if (isConnectedRef.current && !isMicMutedRef.current) {
               const inputBuffer = event.data;
               
               if (hasSpeech(inputBuffer)) {
                   lastUserSpeechTimeRef.current = Date.now();
               }

               const pcmBlob = createPcmBlob(inputBuffer, AUDIO_CONFIG.inputSampleRate);
               
               // Use sessionPromise directly to ensure we use the active socket
               sessionPromise.then(session => {
                   // Double check gate before sending
                   if(isConnectedRef.current) {
                        try {
                           session.sendRealtimeInput({ media: pcmBlob });
                        } catch(e) {
                            // Suppress "WebSocket is already in CLOSING" errors
                        }
                   }
               }).catch(e => {
                   // ignore send errors
               });
          }
      };

    } catch (err: any) {
        console.error("Connection failed", err);
        setStatus('error');
        setError(err.message || "Failed to connect");
        stopAudio();
    }
  }, [apiKeys, persona, stopAudio, disconnect]);

  // Assign ref for recursive calls
  useEffect(() => {
      connectRef.current = connect;
  }, [connect]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
        stopAudio();
    };
  }, [stopAudio]);

  return {
    status,
    connect,
    disconnect,
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
    transcriptSent
  };
}
