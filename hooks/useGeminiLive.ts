
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AUDIO_CONFIG, LANGUAGE_TOOL } from '../constants';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, hasSpeech } from '../utils/audioUtils';
import { ConnectionStatus, Persona } from '../types';

export interface UseGeminiLiveProps {
  apiKey: string | undefined;
  persona: Persona;
}

const VOLUME_GAIN = 1.5;
const MAX_RETRIES = 3;

// Audio Worklet Code to run in a separate thread
// We use a Blob to load this dynamically without needing a separate file in /public
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
    // Return true to keep the processor alive
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
  const detectedLanguageRef = useRef(detectedLanguage);
  
  const lastUserSpeechTimeRef = useRef<number>(Date.now());
  const silenceCheckIntervalRef = useRef<number | null>(null);
  
  // --- STATE CONTROL REFS ---
  const connectionIdRef = useRef<string | null>(null);
  const isIntentionalDisconnectRef = useRef<boolean>(false);
  const statusRef = useRef<ConnectionStatus>('disconnected');
  const connectStartTimeRef = useRef<number>(0);
  const conversationHistoryRef = useRef<TranscriptEntry[]>([]);
  
  // Synchronous Gate: strictly tracks if we believe the socket is open
  const isConnectedRef = useRef<boolean>(false);
  
  // Recursive connect reference
  const connectRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  useEffect(() => {
    detectedLanguageRef.current = detectedLanguage;
  }, [detectedLanguage]);

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

  const calculateBackoff = (attempt: number) => {
    // Exponential backoff: 1s, 2s, 4s, 8s... capped at 10s
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  };

  // --- TRIPSWITCH: EMAIL DISPATCH LOGIC ---
  const dispatchTranscript = useCallback(() => {
    const duration = Date.now() - connectStartTimeRef.current;
    
    // Condition: Session must be longer than 20 seconds
    if (duration > 20000 && conversationHistoryRef.current.length > 0) {
        console.log(`[BuaX1] ⚡ TRIPSWITCH: Session Duration ${Math.round(duration/1000)}s > 20s. Dispatching Transcript...`);
        
        console.group("📧 EMAILING TRANSCRIPT TO: tommy@vcb-ai.online");
        console.log("Subject: Bua X1 Session Transcript");
        console.log(`Time: ${new Date().toLocaleString()}`);
        console.log(`Duration: ${Math.round(duration/1000)}s`);
        console.table(conversationHistoryRef.current);
        console.groupEnd();

        // Simulate Network Request Delay
        setTimeout(() => {
            setTranscriptSent(true);
            // Auto-hide the notification flag after a while
            setTimeout(() => setTranscriptSent(false), 5000);
        }, 800);
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
            // Do NOT nullify analysers here immediately if we want to visualizer to fade out gently
            // But for safety, we usually keep the refs for the next session
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

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          stopAudio();
      };
  }, [stopAudio]);

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

  const connect = useCallback(async () => {
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
    const myConnectionId = `session-${Date.now()}-${Math.random()}`;
    connectionIdRef.current = myConnectionId;

    try {
      setStatus('connecting');
      setError(null);
      
      // Clean previous session data
      setDetectedLanguage('Auto-Detect');
      setTranscript('');
      conversationHistoryRef.current = []; // Reset history for new session
      
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

      // 1. Output Pipeline
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
      
      gainNode.connect(compressor);
      compressor.connect(outputAnalyser);
      outputAnalyser.connect(outputCtx.destination);
      gainNodeRef.current = gainNode;

      // 2. Input Pipeline
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1
          } 
      });
      
      // Check again
      if (connectionIdRef.current !== myConnectionId) {
          stream.getTracks().forEach(t => t.stop());
          return;
      }
      streamRef.current = stream;

      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyser.smoothingTimeConstant = 0.3;
      inputAnalyserRef.current = inputAnalyser;
      
      // --- GEMINI CONNECTION ---
      const ai = new GoogleGenAI({ apiKey: currentKey });
      
      let tools = [];
      if (currentPersona.id === 'thabo') {
          tools = [{ googleSearch: {} }];
      } else {
          tools = [...LANGUAGE_TOOL];
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: currentPersona.voiceName } }
            },
            systemInstruction: currentPersona.baseInstruction,
            tools: tools,
            outputAudioTranscription: {}, 
            inputAudioTranscription: {}, 
        },
        callbacks: {
          onopen: async () => {
            console.log('[BuaX1] WebSocket Opened');
            if (connectionIdRef.current !== myConnectionId) return; // Stale connection

            // MARK: Gate Open
            isConnectedRef.current = true;
            setStatus('connected');
            retryCountRef.current = 0; // Success! Reset retries.
            lastUserSpeechTimeRef.current = Date.now();

            // Demo Timer
            demoTimerRef.current = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                         disconnect("Demo time limit reached.");
                         return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            
            // Silence Check
            silenceCheckIntervalRef.current = window.setInterval(() => {
                const now = Date.now();
                if (isMicMutedRef.current || activeSourcesRef.current.size > 0) {
                    lastUserSpeechTimeRef.current = now; 
                    return;
                }
                if (now - lastUserSpeechTimeRef.current > 60000) { 
                     disconnect("Chat ended due to extended silence.");
                }
            }, 1000);

            // Audio Processing Setup with AudioWorklet
            try {
                // Initialize Worklet
                // Use a Blob to create a worker file on the fly
                // 'application/javascript; charset=utf-8' is safer for strict browsers
                const blob = new Blob([WORKLET_CODE], { type: "application/javascript; charset=utf-8" });
                const blobUrl = URL.createObjectURL(blob);
                
                try {
                    await inputCtx.audioWorklet.addModule(blobUrl);
                } catch (moduleErr) {
                    console.error("[BuaX1] Failed to add worklet module:", moduleErr);
                    throw new Error("Audio engine failed to load.");
                } finally {
                    // Always revoke the URL to prevent memory leaks
                    URL.revokeObjectURL(blobUrl);
                }

                const source = inputCtx.createMediaStreamSource(stream);
                const workletNode = new AudioWorkletNode(inputCtx, 'pcm-processor');

                // Handle internal processor errors
                workletNode.onprocessorerror = (err) => {
                    console.error("[BuaX1] Worklet Processor Error:", err);
                    // If the processor crashes, we can't continue audio capture
                    disconnect("Audio processor crashed.");
                };

                workletNode.port.onmessage = (event) => {
                    // 1. Synchronous Gate Check
                    if (!isConnectedRef.current || connectionIdRef.current !== myConnectionId) return;

                    const inputData = event.data; // Float32Array from worklet

                    // Mute logic: Zero out the buffer if mic is muted
                    if (isMicMutedRef.current) {
                        for(let i=0; i<inputData.length; i++) inputData[i] = 0;
                    }

                    // Strict VAD
                    if (hasSpeech(inputData) && !isMicMutedRef.current) {
                        lastUserSpeechTimeRef.current = Date.now();
                        setTranscript(''); 
                    }

                    const pcmBlob = createPcmBlob(inputData, inputCtx.sampleRate);
                    
                    sessionPromise.then(session => {
                        // 2. Gate Check again inside Promise
                        if (!isConnectedRef.current || connectionIdRef.current !== myConnectionId) return;
                        
                        try {
                            session.sendRealtimeInput({ media: pcmBlob } as any);
                        } catch(e) {
                            // Suppress send errors if connection is dropping
                        }
                    });
                };

                source.connect(inputAnalyser);
                source.connect(workletNode);
                
                // IMPORTANT: Worklet needs a sink to function (clock signal), BUT we don't want to hear ourself.
                // So we connect it to a dummy gain node with 0 volume, then to destination.
                // This prevents the audio graph from being garbage collected or paused.
                const muteGain = inputCtx.createGain();
                muteGain.gain.value = 0;
                workletNode.connect(muteGain);
                muteGain.connect(inputCtx.destination);
                
                sourceRef.current = source;
                workletNodeRef.current = workletNode;

            } catch (err) {
                console.error("[BuaX1] Worklet Setup Failed", err);
                disconnect("Audio subsystem failed. Please refresh.");
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
             if (!isConnectedRef.current || connectionIdRef.current !== myConnectionId) return;

             const currentEpoch = interruptionEpochRef.current;
             lastUserSpeechTimeRef.current = Date.now();

             // Transcript & History Buffering
             if (msg.serverContent?.outputTranscription?.text) {
                 const txt = msg.serverContent.outputTranscription.text;
                 setTranscript(prev => prev + txt);
                 conversationHistoryRef.current.push({
                     role: 'model',
                     text: txt,
                     timestamp: Date.now()
                 });
             }
             
             if (msg.serverContent?.inputTranscription?.text) {
                 const txt = msg.serverContent.inputTranscription.text;
                 conversationHistoryRef.current.push({
                     role: 'user',
                     text: txt,
                     timestamp: Date.now()
                 });
             }

             // Tool Calls
             if (msg.toolCall) {
                const calls = msg.toolCall.functionCalls;
                if (calls?.length) {
                    const call = calls[0];
                    if (call.name === 'report_language_change') {
                        interruptionEpochRef.current += 1;
                        activeSourcesRef.current.forEach(s => { try{s.stop()}catch(e){} });
                        activeSourcesRef.current.clear();
                        if (outputCtx) nextStartTimeRef.current = outputCtx.currentTime;

                        const lang = call.args ? (call.args['language'] as string) : null;
                        if (lang) setDetectedLanguage(lang);

                        const isSame = lang === detectedLanguageRef.current;
                        const responseContent = isSame
                            ? `[SYSTEM: MONITORING. You are correctly speaking ${lang}.]`
                            : `[SYSTEM: SWITCH to ${lang}. Acknowledge change. FORCE Accent.]`;

                        sessionPromise.then(session => {
                            if (!isConnectedRef.current) return;
                            try {
                                session.sendToolResponse({
                                    functionResponses: [{
                                        id: call.id,
                                        name: call.name,
                                        response: { result: responseContent }
                                    }]
                                });
                            } catch(e){}
                        });
                    }
                }
             }

             // Interruption
             if (msg.serverContent?.interrupted) {
                interruptionEpochRef.current += 1;
                activeSourcesRef.current.forEach(s => { try{s.stop()}catch(e){} });
                activeSourcesRef.current.clear();
                setTranscript(''); // Clear text on model interrupt
                if (outputCtx) nextStartTimeRef.current = outputCtx.currentTime;
                return;
             }
             
             // Audio Output
             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData && outputCtx && gainNodeRef.current && outputCtx.state !== 'closed') {
                 try {
                    const rawBytes = base64ToUint8Array(audioData);
                    const audioBuffer = await decodeAudioData(rawBytes, outputCtx, AUDIO_CONFIG.outputSampleRate, 1);

                    if (currentEpoch !== interruptionEpochRef.current) return;

                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(gainNodeRef.current);
                    
                    const startTime = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                    source.start(startTime);
                    nextStartTimeRef.current = startTime + audioBuffer.duration;
                    
                    activeSourcesRef.current.add(source);
                    source.onended = () => activeSourcesRef.current.delete(source);
                 } catch (err) {
                     // console.error(err);
                 }
             }
          },
          onclose: () => {
            console.log('[BuaX1] WebSocket Closed');
            // Gate Close
            isConnectedRef.current = false;
            
            if (connectionIdRef.current !== myConnectionId) return; // Ignore if already reset

            const duration = Date.now() - connectStartTimeRef.current;
            const isImmediateFailure = duration < 4000;

            // SCENARIO 1: Immediate Failure (Likely Quota or Key Issue)
            if (isImmediateFailure) {
                if (currentKeyIndexRef.current < apiKeys.length - 1) {
                    console.warn(`[BuaX1] Quota Limit detected. Rotating API Key ${currentKeyIndexRef.current} -> ${currentKeyIndexRef.current + 1}`);
                    currentKeyIndexRef.current += 1;
                    retryCountRef.current = 0; // Reset retries for new key
                    stopAudio();
                    setTimeout(() => { if (connectRef.current) connectRef.current(); }, 1000);
                    return;
                }
            }
            
            // SCENARIO 2: Transient Network Failure (Retry same key)
            if (!isIntentionalDisconnectRef.current && statusRef.current !== 'error') {
                 if (retryCountRef.current < MAX_RETRIES) {
                     const delay = calculateBackoff(retryCountRef.current);
                     console.warn(`[BuaX1] Connection lost. Retrying in ${delay}ms... (Attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);
                     retryCountRef.current += 1;
                     stopAudio();
                     
                     setTimeout(() => { 
                         if (connectRef.current && !isIntentionalDisconnectRef.current) connectRef.current(); 
                     }, delay);
                     return;
                 }
            }

            // SCENARIO 3: Fatal Error or Max Retries Reached
            if (!isIntentionalDisconnectRef.current && statusRef.current !== 'error') {
                 // Tripswitch: Send transcript on fatal drop
                 dispatchTranscript();

                 let msg = "Connection interrupted.";
                 if (isImmediateFailure) {
                     msg = "Connection rejected. Please check API Quota.";
                 } else if (retryCountRef.current >= MAX_RETRIES) {
                     msg = "Unstable connection. Max retries exceeded.";
                 }
                 
                 setError(msg);
                 setStatus('error');
            } else if (isIntentionalDisconnectRef.current) {
                 setStatus('disconnected');
            }
            
            stopAudio();
          },
          onerror: (err) => {
            if (connectionIdRef.current !== myConnectionId) return;
            isConnectedRef.current = false;
            
            console.error("[BuaX1] Session Error", err);
            
            // Don't show error UI immediately if we have retries left
            if (retryCountRef.current < MAX_RETRIES) {
               return;
            }

            dispatchTranscript(); 

            setError("Connection failed. Please check your network.");
            setStatus('error');
            stopAudio();
          }
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      if (connectionIdRef.current === myConnectionId) {
          console.error('[BuaX1] Setup Error:', err);
          setStatus('error');
          setError(err.message || "Failed to initialize audio.");
          stopAudio();
      }
    }
  }, [apiKeys, stopAudio, disconnect, dispatchTranscript]);

  useEffect(() => {
      connectRef.current = connect;
  }, [connect]);

  return {
    status,
    connect,
    disconnect: () => disconnect(), 
    inputAnalyserRef, // RETURN REF
    outputAnalyserRef, // RETURN REF
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
