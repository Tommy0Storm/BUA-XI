import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AUDIO_CONFIG, LANGUAGE_TOOL } from '../constants';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, hasSpeech } from '../utils/audioUtils';
import { ConnectionStatus, Persona } from '../types';

export interface UseGeminiLiveProps {
  apiKey: string | undefined;
  persona: Persona;
}

const VOLUME_GAIN = 1.5; // Reduced from 3.0 to 1.5 to prevent compressor pumping

export function useGeminiLive({ apiKey, persona }: UseGeminiLiveProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [volume, setVolume] = useState(0); // For visualizer (Input OR Output)
  const [detectedLanguage, setDetectedLanguage] = useState<string>('Auto-Detect');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  
  // Timer State - Defaults to 120, but updated on connect
  const [timeLeft, setTimeLeft] = useState(120);

  // API Key Management
  const apiKeys = useMemo(() => 
    apiKey ? apiKey.split(',').map(k => k.trim()).filter(k => k.length > 0) : [], 
  [apiKey]);
  const currentKeyIndexRef = useRef(0);

  // Refs for audio management to avoid re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const inputGainRef = useRef<GainNode | null>(null); 
  
  // Analysers for Visualization
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeAnimationRef = useRef<number | null>(null);

  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<Promise<any> | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Interruption Handling: "Epoch" tracks the current conversational turn.
  // Incrementing this invalidates any pending audio chunks from previous turns.
  const interruptionEpochRef = useRef<number>(0);
  
  // Demo Limit Refs
  const demoTimerRef = useRef<number | null>(null);
  
  // Refs for props that might change during connection
  const personaRef = useRef<Persona>(persona);
  const isMutedRef = useRef(isMuted);
  const isMicMutedRef = useRef(isMicMuted);
  const detectedLanguageRef = useRef(detectedLanguage); // Ref to track language without re-renders

  // Silence Detection Refs
  const lastUserSpeechTimeRef = useRef<number>(Date.now());
  const silenceCheckIntervalRef = useRef<number | null>(null);
  
  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  useEffect(() => {
    detectedLanguageRef.current = detectedLanguage;
  }, [detectedLanguage]);

  // Handle mute toggling on active audio context
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (gainNodeRef.current && gainNodeRef.current.context) {
        const ctx = gainNodeRef.current.context;
        const currentTime = ctx.currentTime;
        // Use setTargetAtTime for smooth volume transitions (prevents clicks)
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

  const stopAudio = useCallback(() => {
    console.log('[GeminiLive] Stopping Audio...');
    
    // Clear demo timer
    if (demoTimerRef.current) {
        window.clearInterval(demoTimerRef.current);
        demoTimerRef.current = null;
    }

    // Cancel volume animation
    if (volumeAnimationRef.current) {
        cancelAnimationFrame(volumeAnimationRef.current);
        volumeAnimationRef.current = null;
    }

    // Clear silence interval
    if (silenceCheckIntervalRef.current) {
        window.clearInterval(silenceCheckIntervalRef.current);
        silenceCheckIntervalRef.current = null;
    }

    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
    }
    if (inputGainRef.current) {
        inputGainRef.current.disconnect();
        inputGainRef.current = null;
    }
    if (inputAnalyserRef.current) {
        inputAnalyserRef.current.disconnect();
        inputAnalyserRef.current = null;
    }
    if (outputAnalyserRef.current) {
        outputAnalyserRef.current.disconnect();
        outputAnalyserRef.current = null;
    }

    // Stop output audio
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) { /* ignore */ }
    });
    activeSourcesRef.current.clear();
    
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    setVolume(0);
    console.log('[GeminiLive] Audio Stopped.');
  }, []);

  const disconnect = useCallback(async (errorMessage?: string) => {
    console.log('[GeminiLive] Disconnecting session...');
    if (sessionRef.current) {
        try {
            const session = await sessionRef.current;
            session.close();
            console.log('[GeminiLive] Session closed successfully.');
        } catch (e) {
            console.error('[GeminiLive] Error closing session:', e);
        }
    }
    sessionRef.current = null;
    setStatus('disconnected');
    setDetectedLanguage('Auto-Detect');
    if (errorMessage) {
        setError(errorMessage);
    }
    stopAudio();
  }, [stopAudio]);

  const connect = useCallback(async () => {
    if (apiKeys.length === 0) {
      console.error('[GeminiLive] API Key Missing');
      setError('API Key is missing.');
      return;
    }

    // Use the current key index to select the key
    const currentKey = apiKeys[currentKeyIndexRef.current];
    console.log(`[GeminiLive] Connecting with key index: ${currentKeyIndexRef.current}`);

    try {
      console.log('[GeminiLive] Starting Connection...');
      setStatus('connecting');
      setError(null);
      setDetectedLanguage('Auto-Detect');
      
      const currentPersona = personaRef.current;
      
      // SET TIME LIMIT BASED ON PERSONA (Default 120s, or override)
      const timeLimit = currentPersona.maxDurationSeconds || 120;
      setTimeLeft(timeLimit);
      
      // Reset interruption tracking
      interruptionEpochRef.current = 0;

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      const inputCtx = new AudioContextClass({ sampleRate: AUDIO_CONFIG.inputSampleRate }); 
      const outputCtx = new AudioContextClass({ sampleRate: AUDIO_CONFIG.outputSampleRate });
      
      await outputCtx.resume();
      await inputCtx.resume();
      
      audioContextRef.current = outputCtx;
      inputContextRef.current = inputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // --- OUTPUT SETUP ---
      // Graph: Source -> Gain (Boost) -> Compressor -> Analyser -> Destination
      
      // Dynamics Compressor: Modified to be smoother and less aggressive to prevent "pumping"
      const compressor = outputCtx.createDynamicsCompressor();
      compressor.threshold.value = -20; // Lower threshold to start engaging earlier but softer
      compressor.knee.value = 30; // Soft knee
      compressor.ratio.value = 3; // Reduced ratio (was 12) for gentle compression
      compressor.attack.value = 0.003; 
      compressor.release.value = 0.25;

      const outputAnalyser = outputCtx.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyser.smoothingTimeConstant = 0.3; // Responsive
      outputAnalyserRef.current = outputAnalyser;

      const gainNode = outputCtx.createGain();
      // Apply initial volume boost (Modified to 1.5x)
      gainNode.gain.value = isMutedRef.current ? 0 : VOLUME_GAIN;
      
      // Connect Graph
      gainNode.connect(compressor);
      compressor.connect(outputAnalyser);
      outputAnalyser.connect(outputCtx.destination);
      
      gainNodeRef.current = gainNode;

      // --- INPUT SETUP ---
      console.log('[GeminiLive] Requesting Mic Access...');
      // Request explicit echo cancellation and noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1
          } 
      });
      console.log('[GeminiLive] Mic Access Granted');
      streamRef.current = stream;

      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyser.smoothingTimeConstant = 0.3; // Responsive
      inputAnalyserRef.current = inputAnalyser;

      // --- VISUALIZER LOOP ---
      const updateVolume = () => {
        let maxVol = 0;

        // 1. Get Input Volume (if mic not muted)
        if (inputAnalyserRef.current && !isMicMutedRef.current) {
            const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
            inputAnalyserRef.current.getByteTimeDomainData(data);
            let sum = 0;
            for(let i=0; i<data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v*v;
            }
            maxVol = Math.sqrt(sum / data.length);
        }

        // 2. Get Output Volume (Bot speaking)
        if (outputAnalyserRef.current) {
             const data = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
             outputAnalyserRef.current.getByteTimeDomainData(data);
             let sum = 0;
             for(let i=0; i<data.length; i++) {
                 const v = (data[i] - 128) / 128;
                 sum += v*v;
             }
             const outVol = Math.sqrt(sum / data.length);
             // If bot is speaking, use that volume (boosted slightly for visual impact)
             if (outVol > maxVol) maxVol = outVol;
        }
        
        setVolume(maxVol);
        volumeAnimationRef.current = requestAnimationFrame(updateVolume);
      };
      volumeAnimationRef.current = requestAnimationFrame(updateVolume);


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
        },
        callbacks: {
          onopen: () => {
            console.log('[GeminiLive] WebSocket Opened / Session Connected');
            setStatus('connected');
            lastUserSpeechTimeRef.current = Date.now();

            // --- DEMO LIMIT TIMER (Dynamic Duration) ---
            demoTimerRef.current = window.setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                         console.log('[GeminiLive] Demo time limit reached.');
                         disconnect("Demo time limit reached. Please reload or contact sales.");
                         return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            
            // Silence Detection
            silenceCheckIntervalRef.current = window.setInterval(() => {
                const now = Date.now();
                
                if (isMicMutedRef.current || activeSourcesRef.current.size > 0) {
                    lastUserSpeechTimeRef.current = now; 
                    return;
                }

                const silenceDuration = now - lastUserSpeechTimeRef.current;
                if (silenceDuration > 60000) { 
                     disconnect("Chat ended due to extended silence. Hamba kahle! 👋");
                }
            }, 1000);

            // Input Processing
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            const inputGain = inputCtx.createGain();
            inputGain.gain.value = 0; // Mute input to speakers to prevent echo
            inputGainRef.current = inputGain;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              if (isMicMutedRef.current) {
                  for (let i = 0; i < inputData.length; i++) {
                      inputData[i] = 0;
                  }
              }

              // Use robust VAD from audioUtils
              if (hasSpeech(inputData) && !isMicMutedRef.current) {
                  lastUserSpeechTimeRef.current = Date.now();
              }

              const pcmBlob = createPcmBlob(inputData, inputCtx.sampleRate);
              sessionPromise.then(session => {
                // TS Cast as 'any' to avoid "Type 'string' has no properties in common with type 'Content'"
                // This seems to be a type definition issue in the SDK beta vs the runtime requirement.
                session.sendRealtimeInput({ media: pcmBlob } as any);
              });
            };

            // Connect Input Graph
            source.connect(inputAnalyser); // For visualizer
            source.connect(processor);     // For streaming
            processor.connect(inputGain);
            inputGain.connect(inputCtx.destination);
            
            sourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (msg: LiveServerMessage) => {
             // 1. Capture the epoch when the message arrives.
             const currentEpoch = interruptionEpochRef.current;

             lastUserSpeechTimeRef.current = Date.now();

             // Tool Calls
             if (msg.toolCall) {
                const calls = msg.toolCall.functionCalls;
                if (calls && calls.length > 0) {
                    const call = calls[0];
                    
                    if (call.name === 'report_language_change') {
                        // FIX: Treat language change as a "soft interruption" to prevent double-speak/echo
                        // If the model started speaking BEFORE calling this tool, we must silence that audio
                        console.log("[GeminiLive] Language Tool Triggered. Silencing pre-switch audio.");
                        interruptionEpochRef.current += 1;
                        activeSourcesRef.current.forEach(src => {
                            try { src.stop(); src.disconnect(); } catch(e){}
                        });
                        activeSourcesRef.current.clear();
                        if (outputCtx) { nextStartTimeRef.current = outputCtx.currentTime; }

                        // FIX: Added safe access to optional args
                        const lang = call.args ? (call.args['language'] as string) : null;
                        
                        if (lang) {
                            setDetectedLanguage(lang);
                        }

                        // Determine strictness based on whether language ACTUALLY changed
                        // Note: detectedLanguageRef is updated via useEffect, so current Ref is technically the 'old' language until next render
                        const isSameLanguage = lang === detectedLanguageRef.current;
                        
                        // STRICTER INSTRUCTION PROTOCOL
                        const responseContent = isSameLanguage
                            ? `[SYSTEM: MONITORING. You are correctly speaking ${lang}. CRITICAL: MAINTAIN AUTHENTIC SOUTH AFRICAN ACCENT. Do not drift into American or Indian intonations.]`
                            : `[SYSTEM: LANGUAGE SWITCH to ${lang} CONFIRMED. EXECUTE: 1. Acknowledge change (e.g. "Askies, let's speak ${lang}"). 2. SPEAK ONLY ${lang}. 3. FORCE South African Accent. 4. BAN American/Indian accents.]`;

                        sessionPromise.then(session => {
                            session.sendToolResponse({
                                functionResponses: [{
                                    id: call.id,
                                    name: call.name,
                                    response: { result: responseContent }
                                }]
                            });
                        });
                    }
                }
             }

             // Interruption Logic
             if (msg.serverContent?.interrupted) {
                console.log("[GeminiLive] Interruption detected. stopping audio.");
                // Increment epoch to invalidate any processing/pending chunks
                interruptionEpochRef.current += 1;
                
                // Immediate hard stop of all audio sources
                activeSourcesRef.current.forEach(src => {
                    try { 
                        src.stop();
                        src.disconnect();
                    } catch(e) {}
                });
                activeSourcesRef.current.clear();
                
                // Reset output time to current to avoid gaps or delays
                if (outputCtx) {
                    nextStartTimeRef.current = outputCtx.currentTime;
                }
                return;
             }
             
             // Audio Output
             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData) {
                 if (outputCtx && gainNodeRef.current && outputCtx.state !== 'closed') {
                     try {
                        // Decode (Async operation)
                        const rawBytes = base64ToUint8Array(audioData);
                        const audioBuffer = await decodeAudioData(
                            rawBytes, 
                            outputCtx, 
                            AUDIO_CONFIG.outputSampleRate, 
                            1
                        );

                        // 2. CHECK EPOCH: If interruption happened while we were decoding, DROP this chunk.
                        // This prevents "ghost" audio from playing after user interrupted.
                        if (currentEpoch !== interruptionEpochRef.current) {
                            console.log("[GeminiLive] Dropping stale audio chunk after interruption.");
                            return;
                        }

                        const source = outputCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(gainNodeRef.current);
                        
                        const startTime = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                        source.start(startTime);
                        nextStartTimeRef.current = startTime + audioBuffer.duration;
                        
                        activeSourcesRef.current.add(source);
                        source.onended = () => {
                            activeSourcesRef.current.delete(source);
                        };
                     } catch (err) {
                         console.error("[GeminiLive] Error decoding audio chunk", err);
                     }
                 }
             }
          },
          onclose: () => {
            setStatus('disconnected');
          },
          onerror: (err) => {
            console.error("[GeminiLive] Error", err);
            setError("Connection lost.");
            setStatus('error');
          }
        }
      });

      // Handle Key Rotation/Failover on initial connection failure
      sessionPromise.catch(async (err) => {
         // Only retry if we haven't manually disconnected (sessionRef check)
         if (sessionRef.current !== sessionPromise) {
             return;
         }

         console.warn(`[GeminiLive] Connection failed with key index ${currentKeyIndexRef.current}`, err);

         // If we have more keys to try
         if (currentKeyIndexRef.current < apiKeys.length - 1) {
             console.log("[GeminiLive] Switching to backup API key...");
             currentKeyIndexRef.current += 1;
             
             // Cleanup current failed attempt
             stopAudio();
             
             // Add slight delay to ensure cleanup settles, then retry
             setTimeout(() => connect(), 200);
         } else {
             // All keys exhausted
             console.error("[GeminiLive] All API keys exhausted.");
             setStatus('error');
             setError("Connection failed. Quota may be depleted.");
             stopAudio();
         }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error('[GeminiLive] Connection Setup Error:', err);
      setStatus('error');
      setError(err.message || "Failed to connect");
      stopAudio();
    }
  }, [apiKeys, stopAudio, disconnect]); // Dependencies updated

  return {
    status,
    connect,
    disconnect: () => disconnect(), 
    volume,
    detectedLanguage,
    error,
    isMuted,
    toggleMute,
    isMicMuted,
    toggleMic,
    timeLeft // Exposed for UI
  };
}
