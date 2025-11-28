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

export function useGeminiLive({ apiKey, persona }: UseGeminiLiveProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [volume, setVolume] = useState(0);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('Auto-Detect');
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);

  // API Key Management
  const apiKeys = useMemo(() => 
    apiKey ? apiKey.split(',').map(k => k.trim()).filter(k => k.length > 0) : [], 
  [apiKey]);
  const currentKeyIndexRef = useRef(0);

  // Refs for audio management
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const inputGainRef = useRef<GainNode | null>(null); 
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Reusable buffers
  const inputDataArrayRef = useRef<Uint8Array | null>(null);
  const outputDataArrayRef = useRef<Uint8Array | null>(null);
  const volumeAnimationRef = useRef<number | null>(null);

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
  // 1. shouldProcessAudio: Master switch for the audio loop
  const shouldProcessAudioRef = useRef<boolean>(false);
  // 2. isIntentionalDisconnect: Distinguishes between user hitting "End" vs network failure
  const isIntentionalDisconnectRef = useRef<boolean>(false);
  // 3. statusRef: Allows callbacks to know current React state without staleness
  const statusRef = useRef<ConnectionStatus>('disconnected');

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

  const stopAudio = useCallback(() => {
    console.log('[BuaX1] Stopping Audio Subsystems...');
    shouldProcessAudioRef.current = false; 
    
    // Kill the processor loop immediately
    if (processorRef.current) {
        processorRef.current.onaudioprocess = null;
        try { processorRef.current.disconnect(); } catch(e) {}
        processorRef.current = null;
    }

    if (demoTimerRef.current) {
        window.clearInterval(demoTimerRef.current);
        demoTimerRef.current = null;
    }

    if (volumeAnimationRef.current) {
        cancelAnimationFrame(volumeAnimationRef.current);
        volumeAnimationRef.current = null;
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
    [gainNodeRef, inputGainRef, inputAnalyserRef, outputAnalyserRef].forEach(ref => {
        if (ref.current) {
            try { ref.current.disconnect(); } catch(e) {}
            ref.current = null;
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
    
    setVolume(0);
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
    isIntentionalDisconnectRef.current = true;
    shouldProcessAudioRef.current = false;

    if (sessionRef.current) {
        try {
            const session = await sessionRef.current;
            session.close();
        } catch (e) {
            console.warn('[BuaX1] Error closing session:', e);
        }
    }
    sessionRef.current = null;
    
    setStatus('disconnected');
    setDetectedLanguage('Auto-Detect');
    setTranscript('');
    
    if (errorMessage) {
        setError(errorMessage);
        setStatus('error');
    }
    
    stopAudio();
  }, [stopAudio]);

  const connect = useCallback(async () => {
    if (apiKeys.length === 0) {
      setError('API Key is missing.');
      setStatus('error');
      return;
    }

    const currentKey = apiKeys[currentKeyIndexRef.current];
    console.log(`[BuaX1] Connecting with key index: ${currentKeyIndexRef.current}`);

    try {
      setStatus('connecting');
      setError(null);
      setDetectedLanguage('Auto-Detect');
      setTranscript('');
      
      const currentPersona = personaRef.current;
      setTimeLeft(currentPersona.maxDurationSeconds || 120);
      
      // Reset State Flags
      interruptionEpochRef.current = 0;
      shouldProcessAudioRef.current = true;
      isIntentionalDisconnectRef.current = false;

      // --- AUDIO SETUP ---
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: AUDIO_CONFIG.inputSampleRate }); 
      const outputCtx = new AudioContextClass({ sampleRate: AUDIO_CONFIG.outputSampleRate });
      
      await Promise.all([outputCtx.resume(), inputCtx.resume()]);
      
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
      outputDataArrayRef.current = new Uint8Array(outputAnalyser.frequencyBinCount);

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
      streamRef.current = stream;

      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyser.smoothingTimeConstant = 0.3;
      inputAnalyserRef.current = inputAnalyser;
      inputDataArrayRef.current = new Uint8Array(inputAnalyser.frequencyBinCount);

      // 3. Visualizer Loop
      const updateVolume = () => {
        if (!shouldProcessAudioRef.current) return;

        let maxVol = 0;

        if (inputAnalyserRef.current && !isMicMutedRef.current && inputDataArrayRef.current) {
            const data = inputDataArrayRef.current;
            inputAnalyserRef.current.getByteTimeDomainData(data as any);
            let sum = 0;
            for(let i=0; i<data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v*v;
            }
            maxVol = Math.sqrt(sum / data.length);
        }

        if (outputAnalyserRef.current && outputDataArrayRef.current) {
             const data = outputDataArrayRef.current;
             outputAnalyserRef.current.getByteTimeDomainData(data as any);
             let sum = 0;
             for(let i=0; i<data.length; i++) {
                 const v = (data[i] - 128) / 128;
                 sum += v*v;
             }
             const outVol = Math.sqrt(sum / data.length);
             if (outVol > maxVol) maxVol = outVol;
        }
        
        // Safety check for NaN to prevent canvas crash
        if (isNaN(maxVol) || !isFinite(maxVol)) maxVol = 0;

        setVolume(maxVol);
        volumeAnimationRef.current = requestAnimationFrame(updateVolume);
      };
      volumeAnimationRef.current = requestAnimationFrame(updateVolume);

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
            outputAudioTranscription: { model: "gemini-2.5-flash" },
        },
        callbacks: {
          onopen: () => {
            console.log('[BuaX1] WebSocket Opened');
            setStatus('connected');
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

            // Audio Processing Setup
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            const inputGain = inputCtx.createGain();
            inputGain.gain.value = 0; // Mute self
            
            inputGainRef.current = inputGain;

            processor.onaudioprocess = (e) => {
              if (!shouldProcessAudioRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              
              if (isMicMutedRef.current) {
                  inputData.fill(0);
              }

              if (hasSpeech(inputData) && !isMicMutedRef.current) {
                  lastUserSpeechTimeRef.current = Date.now();
                  setTranscript('');
              }

              const pcmBlob = createPcmBlob(inputData, inputCtx.sampleRate);
              
              sessionPromise.then(session => {
                // Double-Check: Are we still running?
                if (!shouldProcessAudioRef.current) return;
                
                try {
                    session.sendRealtimeInput({ media: pcmBlob } as any);
                } catch(e) {
                    // This error is expected if socket closed mid-frame. Ignore.
                }
              });
            };

            source.connect(inputAnalyser);
            source.connect(processor);
            processor.connect(inputGain);
            inputGain.connect(inputCtx.destination);
            
            sourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (msg: LiveServerMessage) => {
             const currentEpoch = interruptionEpochRef.current;
             lastUserSpeechTimeRef.current = Date.now();

             // Transcript
             const txt = msg.serverContent?.outputTranscription?.text;
             if (txt) setTranscript(prev => prev + txt);

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
                            if (!shouldProcessAudioRef.current) return;
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
                setTranscript('');
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
            // FIX: If we are already in Error state (e.g. from onerror), DO NOT overwrite it with 'disconnected'.
            // This prevents the error modal from flickering closed.
            if (!isIntentionalDisconnectRef.current && statusRef.current !== 'error') {
                 // Check if we were 'connected' before. If we were just 'connecting', it's a connection failure.
                 // If we were 'connected', it's a drop.
                 if (statusRef.current === 'connecting') {
                     setError("Unable to establish connection.");
                 } else {
                     setError("Connection interrupted.");
                 }
                 setStatus('error');
            } else if (isIntentionalDisconnectRef.current) {
                 setStatus('disconnected');
            }
            
            stopAudio();
          },
          onerror: (err) => {
            console.error("[BuaX1] Session Error", err);
            setError("Connection failed. Please check your network or quota.");
            setStatus('error'); // Trigger Error UI immediately
            stopAudio();
          }
        }
      });

      // Failover Logic
      sessionPromise.catch(async (err) => {
         if (sessionRef.current !== sessionPromise) return;

         console.warn(`[BuaX1] Connection failed with key index ${currentKeyIndexRef.current}`, err);

         if (currentKeyIndexRef.current < apiKeys.length - 1) {
             console.log("[BuaX1] Switching to backup API key...");
             currentKeyIndexRef.current += 1;
             stopAudio();
             setTimeout(() => connect(), 200);
         } else {
             setStatus('error');
             setError("All connection attempts failed.");
             stopAudio();
         }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error('[BuaX1] Setup Error:', err);
      setStatus('error');
      setError(err.message || "Failed to initialize audio.");
      stopAudio();
    }
  }, [apiKeys, stopAudio, disconnect]);

  return {
    status,
    connect,
    disconnect: () => disconnect(), 
    volume,
    detectedLanguage,
    transcript,
    error,
    isMuted,
    toggleMute,
    isMicMuted,
    toggleMic,
    timeLeft
  };
}
