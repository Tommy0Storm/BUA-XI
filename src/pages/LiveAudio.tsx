import { useEffect, useRef, useState } from 'react';
import { decodeAudio, getOutputContext, createAudioContext } from '../../utils/audio';
import { createPcmBlob, normalizePcmSimple } from '../../utils/audioUtils';
import { createLiveSession, startSessionOnce, endSessionOnce } from '../../gemini.session';
import { AUDIO_INPUT, AUDIO_OUTPUT, MODELS } from '../../gemini.config';
import { defer } from '../../utils/uiUtils';

// Prevent HMR from remounting and killing sessions
if ((import.meta as any)?.hot) {
  (import.meta as any).hot.accept(() => {});
}

export default function LiveAudioPage() {
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [session, setSession] = useState<any>(null);

  const inputContext = useRef<AudioContext | null>(null);
  // reuse a single shared output context across mounts
  const outputContext = useRef<AudioContext | null>(null);
  const processor = useRef<ScriptProcessorNode | null>(null);
  const micStream = useRef<MediaStream | null>(null);

  const nextStartTime = useRef(0);

  useEffect(() => {
    inputContext.current = createAudioContext(AUDIO_INPUT.sampleRate as number);
    // Do not create/close global output context per component — reuse a singleton
    outputContext.current = getOutputContext();
    return () => {
      try { inputContext.current?.close(); } catch (e) {
        console.error('Error closing input context:', e);
      }
      // don't close the shared output context here — it's reused across remounts/HMR
    };
  }, []);

  // During hot reloads / dev remounts we want to avoid aggressively terminating the
  // shared session. Only auto-end the global session in production to avoid premature close during HMR.
  useEffect(() => {
    return () => {
      if ((import.meta as any).env.MODE === 'production') {
        endSessionOnce();
      } else {
        console.info('Skipping endSession in dev/HMR to avoid premature close');
      }
    };
  }, []);

  // Microtask wrapper + internal start to avoid double-fires and overlapping sessions
  const internalStartSession = async () => {
    if (session) {
      // If a session already exists, close it first so we don't overlap
      console.warn('Session already active — closing previous session before starting a new one.');
      try { await endSession(); } catch (e) { console.error('Error ending previous session:', e); }
    }

    setStatus('Connecting…');

    try {
      // Create the session as usual — the session singleton guard is applied by startSessionOnce
      const s = await createLiveSession({
        model: MODELS.nativeAudio,
        callbacks: {
          onopen: () => {
            setConnected(true);
            setStatus('Connected');
          },
          onmessage: async (msg: any) => {
              try {
                const turn = msg.serverContent?.modelTurn;
                if (!turn || !turn.turnComplete) return; // only play final chunk
                const audio = turn.parts?.find((p: any) => p.inlineData)?.inlineData;
                if (!audio?.data) return;
              // some SDKs deliver raw Uint8Array already, some base64 strings — try to handle both
              let raw: Uint8Array;
              if (typeof audio.data === 'string') {
                raw = Uint8Array.from(atob(audio.data), (c) => c.charCodeAt(0));
              } else {
                raw = audio.data as Uint8Array;
              }

              try {
                const buffer = await decodeAudio(raw, outputContext.current as AudioContext);

                const src = (outputContext.current as AudioContext).createBufferSource();
                src.buffer = buffer;
                src.connect((outputContext.current as AudioContext).destination);

                const start = (outputContext.current as AudioContext).currentTime + 0.01;
                src.start(start);
                nextStartTime.current = start + buffer.duration;
              } catch (e) {
                console.error('[LiveAudio] Decode error:', e);
              }
              } catch (err) {
                // Defensive: don't crash the session on decode/play errors — just log
                console.error('[LiveAudio] onmessage handler failure', err);
              }
          },
          onclose: () => {
            setConnected(false);
            setStatus('Closed');
            setSession(null);
          },
          onerror: (err: any) => {
            setStatus('Error: ' + (err?.message || String(err)));
          }
        }
      });

      setSession(s);
      setStatus('Connected');
      setConnected(true);
      return s;
    } catch (e: any) {
      setStatus('Error: ' + (e?.message || String(e)));
    }
  };

  // debounce start to avoid accidental double-click / double-mounted starts
  const startPendingRef = useRef(false);
  const startSession = () => {
    if (startPendingRef.current) return;
    startPendingRef.current = true;
    setTimeout(async () => {
      startPendingRef.current = false;
      await startSessionOnce(() => internalStartSession());
    }, 50);
  };

  const startRecording = async () => {
    if (!session) return;

    setRecording(true);
    setStatus('Recording…');

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micStream.current = stream;

    const ctx = inputContext.current!;
    const src = ctx.createMediaStreamSource(stream);

    processor.current = ctx.createScriptProcessor(AUDIO_INPUT.bufferSize as number, AUDIO_INPUT.channels as number, AUDIO_INPUT.channels as number);
    processor.current.onaudioprocess = (e) => {
      if (!recording) return;
      if (!(session as any)?.__safeToSpeak) return; // prevent early audio during session startup
      const pcm = e.inputBuffer.getChannelData(0);
      // Normalize with a cheap RMS scaler before creating the PCM blob
      const normalized = normalizePcmSimple(pcm, 0.12);
      const blob = createPcmBlob(normalized, AUDIO_INPUT.sampleRate as number);
      try { session.sendRealtimeInput({ media: blob as any }); } catch (err) { console.error('Error sending realtime input:', err); }
    };

    src.connect(processor.current);
    try { processor.current.connect(ctx.destination); } catch {}
  };

  const stopRecording = () => {
    setRecording(false);

    if (processor.current) {
      try { processor.current.disconnect(); } catch (e) { console.error('Error disconnecting processor:', e); }
      processor.current = null;
    }

    if (micStream.current) {
      micStream.current.getTracks().forEach((t) => t.stop());
      micStream.current = null;
    }

    setStatus('Stopped');
  };

  const endSession = async () => {
    if (session) {
      try { await (session.close?.() ?? Promise.resolve()); } catch (e) { console.error('Error closing session:', e); }
      setSession(null);
    }
    setConnected(false);
    setRecording(false);
    setStatus('Closed manually');
    // give the runtime a moment to settle
    await new Promise((r) => setTimeout(r, 50));
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Live Audio – Gemini Native Audio</h1>
      <p>Status: {status}</p>

      {!connected && (
        <button onClick={() => defer(() => startSession())} style={{ marginRight: 8 }}>Start Session</button>
      )}

      {connected && !recording && (
        <button onClick={() => defer(() => startRecording())} style={{ marginRight: 8 }}>Start Recording</button>
      )}

      {recording && (
        <button onClick={() => defer(() => stopRecording())} style={{ marginRight: 8 }}>Stop Recording</button>
      )}

      {connected && (
        <button onClick={() => defer(() => { endSession(); endSessionOnce(); })} style={{ marginLeft: 20 }}>End Session</button>
      )}
    </div>
  );
}
