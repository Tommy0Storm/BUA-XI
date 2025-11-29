
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AUDIO_CONFIG, LIVE_API_TOOLS } from '../constants';
import { createPcmBlob, decodeAudioData, hasSpeech, base64ToUint8Array } from '../utils/audioUtils';
import { ConnectionStatus, Persona } from '../types';
import { sendTranscriptEmail, sendGenericEmail } from '../services/emailService';
import { dispatchLog } from '../utils/consoleUtils';

export interface UseGeminiLiveProps {
  apiKey: string | undefined;
  persona: Persona;
  speechThreshold?: number; // Configurable VAD threshold
  userEmail?: string;
}

const VOLUME_GAIN = 1.5;

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

export function useGeminiLive({ apiKey, persona, speechThreshold = 0.01, userEmail }: UseGeminiLiveProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('Auto-Detect');
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [transcriptSent, setTranscriptSent] = useState(false);

  const apiKeys = useMemo(() => 
    apiKey ? apiKey.split(',').map(k => k.trim()).filter(k => k.length > 0) : [], 
  [apiKey]);
  const currentKeyIndexRef = useRef(0);
  const retryCountRef = useRef(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<Promise<any> | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const demoTimerRef = useRef<number | null>(null);
  const personaRef = useRef<Persona>(persona);
  const isMutedRef = useRef(isMuted);
  const isMicMutedRef = useRef(isMicMuted);
  const userEmailRef = useRef(userEmail);
  
  const lastUserSpeechTimeRef = useRef<number>(Date.now());
  const connectionIdRef = useRef<string | null>(null);
  const isIntentionalDisconnectRef = useRef<boolean>(false);
  const statusRef = useRef<ConnectionStatus>('disconnected');
  const connectStartTimeRef = useRef<number>(0);
  const conversationHistoryRef = useRef<TranscriptEntry[]>([]);
  
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');
  
  const isConnectedRef = useRef<boolean>(false);
  const connectRef = useRef<((isRetry?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);

  useEffect(() => {
    userEmailRef.current = userEmail;
  }, [userEmail]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (gainNodeRef.current && gainNodeRef.current.context) {
        const ctx = gainNodeRef.current.context;
        gainNodeRef.current.gain.setTargetAtTime(isMuted ? 0 : VOLUME_GAIN, ctx.currentTime, 0.05);
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

  const dispatchTranscript = useCallback(async () => {
    const duration = Date.now() - connectStartTimeRef.current;
    
    if (duration > 20000 && conversationHistoryRef.current.length > 0) {
        dispatchLog('action', 'Tripswitch Activated', `Duration: ${Math.round(duration/1000)}s`);
        
        const success = await sendTranscriptEmail(
            conversationHistoryRef.current,
            duration,
            personaRef.current,
            connectionIdRef.current || 'unknown-session',
            userEmailRef.current
        );

        if (success) {
            setTranscriptSent(true);
            setTimeout(() => setTranscriptSent(false), 5000);
        }
    } else {
        dispatchLog('info', 'Session Ended', 'Duration < 20s. No transcript needed.');
    }
  }, []);

  const stopAudio = useCallback(() => {
    isConnectedRef.current = false;
    connectionIdRef.current = null;
    
    // Strict Worklet Disposal
    if (workletNodeRef.current) {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.onprocessorerror = null;
        try { 
          workletNodeRef.current.disconnect(); 
        } catch(e) {
          // Ignore disconnect errors if graph is already broken
        }
        workletNodeRef.current = null;
    }

    if (demoTimerRef.current) {
        window.clearInterval(demoTimerRef.current);
        demoTimerRef.current = null;
    }

    if (inputContextRef.current) {
      try { 
          if(inputContextRef.current.state !== 'closed') inputContextRef.current.close(); 
      } catch(e) {}
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
        try { 
            if (audioContextRef.current.state !== 'closed') audioContextRef.current.close(); 
        } catch(e) {}
        audioContextRef.current = null;
    }
  }, []);

  const disconnect = useCallback(async (errorMessage?: string) => {
    dispatchLog('info', 'Closing Session Link...');
    
    dispatchTranscript();

    isIntentionalDisconnectRef.current = true;
    isConnectedRef.current = false;

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
    
    stopAudio();
    isConnectedRef.current = false;
    setTranscriptSent(false);

    const currentKey = apiKeys[currentKeyIndexRef.current];
    dispatchLog('info', 'Connecting...', `Attempt ${retryCountRef.current + 1} | Key Index: ${currentKeyIndexRef.current}`);

    const myConnectionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    connectionIdRef.current = myConnectionId;

    try {
      setStatus('connecting');
      setError(null);
      
      setDetectedLanguage('Auto-Detect');
      setTranscript('');
      conversationHistoryRef.current = [];
      currentInputTranscriptionRef.current = '';
      currentOutputTranscriptionRef.current = '';
      
      const currentPersona = personaRef.current;
      setTimeLeft(currentPersona.maxDurationSeconds || 120);
      
      isIntentionalDisconnectRef.current = false;
      connectStartTimeRef.current = Date.now();

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: AUDIO_CONFIG.inputSampleRate }); 
      const outputCtx = new AudioContextClass({ sampleRate: AUDIO_CONFIG.outputSampleRate });
      
      await Promise.all([
          outputCtx.resume().catch(e => console.warn("Output Resume failed", e)), 
          inputCtx.resume().catch(e => console.warn("Input Resume failed", e))
      ]);
      
      if (connectionIdRef.current !== myConnectionId) return;

      audioContextRef.current = outputCtx;
      inputContextRef.current = inputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // --- OUTPUT DSP CHAIN ---
      // Dynamics Compressor to normalize output volume
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

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
            sampleRate: AUDIO_CONFIG.inputSampleRate,
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true, // Hardware AGC
            noiseSuppression: true // Hardware NS
        } 
      });
      streamRef.current = stream;

      // --- INPUT DSP CHAIN ---
      const source = inputCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      // 1. High Pass Filter (Remove Rumble/Low Freq Noise)
      const highPassFilter = inputCtx.createBiquadFilter();
      highPassFilter.type = 'highpass';
      highPassFilter.frequency.value = 85; // Standard cutoff for human voice
      highPassFilter.Q.value = 0.5;

      // 2. Dynamic Input Leveler (Soft Compressor)
      // Boosts quiet voices, limits loud ones.
      const inputLeveler = inputCtx.createDynamicsCompressor();
      inputLeveler.threshold.value = -24;
      inputLeveler.knee.value = 30;
      inputLeveler.ratio.value = 3; // Gentle ratio for leveling
      inputLeveler.attack.value = 0.003;
      inputLeveler.release.value = 0.25;

      // 3. Noise Gate (Hard Compressor)
      // Clamps down when volume is very low to remove hiss
      const noiseGate = inputCtx.createDynamicsCompressor();
      noiseGate.threshold.value = -50; 
      noiseGate.knee.value = 40;
      noiseGate.ratio.value = 20; // High ratio acts as a gate
      noiseGate.attack.value = 0;
      noiseGate.release.value = 0.1;

      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyser.smoothingTimeConstant = 0.5;
      inputAnalyserRef.current = inputAnalyser;

      // Connect Chain: Source -> HPF -> Leveler -> Gate -> Analyser -> Worklet
      source.connect(highPassFilter);
      highPassFilter.connect(inputLeveler);
      inputLeveler.connect(noiseGate);
      noiseGate.connect(inputAnalyser);

      // Worklet Loading with Cross-Browser Compatibility
      const blob = new Blob([WORKLET_CODE], { type: "application/javascript; charset=utf-8" });
      const workletUrl = URL.createObjectURL(blob);
      let workletNode: AudioWorkletNode;

      try {
        await inputCtx.audioWorklet.addModule(workletUrl);
        workletNode = new AudioWorkletNode(inputCtx, 'pcm-processor');
      } catch (err: any) {
        dispatchLog('error', 'Audio Worklet Init Failed', err.message);
        throw new Error(`Failed to initialize Audio Worklet: ${err.message}`);
      } finally {
        // Explicitly revoke to prevent memory leak
        URL.revokeObjectURL(workletUrl); 
      }
      
      workletNodeRef.current = workletNode;
      
      workletNode.onprocessorerror = (err) => {
        console.error("AudioWorklet Processor Error:", err);
        if (isConnectedRef.current) {
            disconnect('Audio processor crashed. Please reconnect.');
        }
      };
      
      inputAnalyser.connect(workletNode);
      // Connect Worklet to destination via zero-gain to keep graph alive without feedback
      const nullGain = inputCtx.createGain();
      nullGain.gain.value = 0;
      workletNode.connect(nullGain);
      nullGain.connect(inputCtx.destination);

      const ai = new GoogleGenAI({ apiKey: currentKey });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: currentPersona.voiceName } }
            },
            systemInstruction: currentPersona.baseInstruction,
            // Updated Tools to include both Language and Email functions
            tools: LIVE_API_TOOLS,
            inputAudioTranscription: {}, 
            outputAudioTranscription: {}
        },
        callbacks: {
            onopen: () => {
                if (connectionIdRef.current !== myConnectionId) return;
                dispatchLog('success', 'Neural Link Established', `Session ID: ${myConnectionId.substr(0,12)}...`);
                setStatus('connected');
                isConnectedRef.current = true;
                retryCountRef.current = 0;
                
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

                const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData) {
                    try {
                        const audioBuffer = await decodeAudioData(
                            base64ToUint8Array(audioData) as any, // FIXED: Cast to any to resolve Uint8Array<ArrayBufferLike> type conflict
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
                        // Suppress decode errors from partial chunks
                    }
                }

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

                // TOOL CALL HANDLING
                if (msg.toolCall?.functionCalls) {
                   for (const call of msg.toolCall.functionCalls) {
                       
                       // 1. Language Change Tool
                       if (call.name === 'report_language_change') {
                           const lang = (call.args as any).language;
                           setDetectedLanguage(lang);
                           dispatchLog('action', 'Language Shift Detected', `Switching to ${lang}`);
                           sessionPromise.then(session => session.sendToolResponse({
                               functionResponses: [{
                                   id: call.id,
                                   name: call.name,
                                   response: { result: 'ok' }
                               }]
                           }));
                       }
                       
                       // 2. Send Email Tool
                       else if (call.name === 'send_email') {
                           const args = call.args as any;
                           const targetEmail = args.recipient_email || userEmailRef.current; // Fallback to user email if not specified
                           
                           dispatchLog('info', 'Processing AI Email Request', `Subject: ${args.subject}`);
                           
                           const success = await sendGenericEmail(
                               targetEmail || "tommy@vcb-ai.online", // Ultimate fallback
                               args.subject,
                               args.body,
                               personaRef.current.name,
                               connectionIdRef.current || 'active-session'
                           );

                           sessionPromise.then(session => session.sendToolResponse({
                               functionResponses: [{
                                   id: call.id,
                                   name: call.name,
                                   response: { result: success ? "Email sent successfully." : "Failed to send email." }
                               }]
                           }));
                       }
                   }
                }

                if (serverContent?.interrupted) {
                    activeSourcesRef.current.forEach(src => {
                        try { src.stop(); } catch(e){}
                    });
                    activeSourcesRef.current.clear();
                    nextStartTimeRef.current = outputCtx.currentTime;
                    currentOutputTranscriptionRef.current = ''; 
                }
            },
            onclose: (e) => {
                 const duration = Date.now() - connectStartTimeRef.current;
                 
                 // Smart Error Handling for Quota vs Network
                 if (duration < 4000 && apiKeys.length > 1 && !isIntentionalDisconnectRef.current) {
                     dispatchLog('warn', 'Quota Exceeded / Key Invalid', 'Rotating Credentials...');
                     currentKeyIndexRef.current = (currentKeyIndexRef.current + 1) % apiKeys.length;
                     retryCountRef.current = 0;
                     setTimeout(() => { if (connectRef.current) connectRef.current(true); }, 1000); 
                     return;
                 }

                if (!isIntentionalDisconnectRef.current) {
                    // Exponential Backoff: 1s -> 2s -> 4s -> 8s (Max 10s)
                    const backoffDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
                    retryCountRef.current += 1;
                    dispatchLog('warn', 'Connection Lost', `Auto-reconnecting in ${backoffDelay}ms...`);
                    stopAudio(); 
                    setTimeout(() => { if (connectRef.current) connectRef.current(true); }, backoffDelay);
                }
            },
            onerror: (err) => {
                 isConnectedRef.current = false;
            }
        }
      });
      
      sessionRef.current = sessionPromise;

      workletNode.port.onmessage = (event) => {
          if (isConnectedRef.current && !isMicMutedRef.current) {
               const inputBuffer = event.data;
               // Use configurable threshold for VAD
               if (hasSpeech(inputBuffer, speechThreshold)) lastUserSpeechTimeRef.current = Date.now();
               const pcmBlob = createPcmBlob(inputBuffer, AUDIO_CONFIG.inputSampleRate);
               
               sessionPromise.then(session => {
                   if(isConnectedRef.current) {
                        try {
                           session.sendRealtimeInput({ media: pcmBlob });
                        } catch(e) {}
                   }
               }).catch(e => {});
          }
      };

    } catch (err: any) {
        dispatchLog('error', 'Connection Failed', err.message);
        setStatus('error');
        setError(err.message || "Failed to connect");
        stopAudio();
    }
  }, [apiKeys, persona, stopAudio, disconnect, speechThreshold]);

  useEffect(() => {
      connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    return () => { stopAudio(); };
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
