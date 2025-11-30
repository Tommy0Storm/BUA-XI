import { useEffect, useRef, useState } from "react";
import { GoogleGenAI, Modality, LiveServerMessage, Session } from "@google/genai";
import { createGeminiClientOptions, MODELS } from '../../gemini.config';
import { normalizePcmSimple, float32ToPCM16, createPcmBlob } from '../../utils/audioUtils';
import { getOutputContext, createAudioContext } from '../../utils/audio';
import { defer } from '../../utils/uiUtils';

export default function LiveTest() {
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState("");

  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
  const clientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartRef = useRef(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        setStatus("Init Audio...");
        inputCtxRef.current = createAudioContext(16000);
        // reuse the shared output context
        outputCtxRef.current = getOutputContext();

        nextStartRef.current = outputCtxRef.current.currentTime;

        setStatus("Init Client...");
        // Let the SDK determine the correct endpoint for live sessions. Do not set apiUrl/apiVersion manually.
        clientRef.current = new GoogleGenAI(createGeminiClientOptions(apiKey) as any);

        await initSession();
      } catch (err: any) {
        setError(err.message);
      }
    };

    setTimeout(() => { defer(() => init()); }, 0);
    return cleanupAll;
  }, []);

  async function initSession() {
    const client = clientRef.current;
    if (!client) return;

    setStatus("Connecting…");

    try {
      if (sessionRef.current) {
        // ensure any previous session is cleaned up before creating a new one
        try { await cleanupAll(); } catch (e) {}
      }

      const session = await client.live.connect({
        model: MODELS.nativeAudio,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Orus",
              },
            },
          },
        },
        callbacks: {
          onopen: () => {
            setStatus("Connected");
          },
          onmessage: onMessage,
          onclose: (ev) => {
            setStatus("Closed: " + ev.reason);
          },
          onerror: (e) => {
            setError(e.message);
          },
        },
      });

      sessionRef.current = session;
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function onMessage(msg: LiveServerMessage) {
    const outCtx = outputCtxRef.current;
    if (!outCtx) return;

    const turn = msg.serverContent?.modelTurn;
    if (!turn || !(turn as any).turnComplete) return; // only play final chunk
    const audio = turn.parts?.[0]?.inlineData;
    if (audio && audio.data) {
      const decoded = Uint8Array.from(atob(audio.data as string), c => c.charCodeAt(0));

      try {
        const buffer = await outCtx.decodeAudioData(decoded.buffer);

        // play immediately with a tiny offset to reduce latency
        const startTime = outCtx.currentTime + 0.01;

        const source = outCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(outCtx.destination);
        source.onended = () => {
          sourcesRef.current.delete(source);
        };

        source.start(startTime);
        nextStartRef.current = startTime + buffer.duration;
        sourcesRef.current.add(source);
      } catch (e) {}
    }

    if (msg.serverContent?.interrupted) {
      for (const s of sourcesRef.current.values()) {
        try {
          s.stop();
        } catch {}
      }
      sourcesRef.current.clear();
      nextStartRef.current = 0;
    }
  }

  async function startRecording() {
    if (isRecordingRef.current) return;

    try {
      setStatus("Mic Request…");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      mediaStreamRef.current = stream;

      const inputCtx = inputCtxRef.current!;
      inputCtx.resume();

      const source = inputCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const processor = inputCtx.createScriptProcessor(256, 1, 1);
      processor.onaudioprocess = (evt) => {
        if (!isRecordingRef.current) return;
        const pcm = evt.inputBuffer.getChannelData(0);
        sendPCM(pcm);
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processorRef.current = processor;

      isRecordingRef.current = true;
      setStatus("Recording…");
    } catch (err: any) {
      setError(err.message);
      stopRecording();
    }
  }

  function sendPCM(float32: Float32Array) {
    const session = sessionRef.current;
    if (!session) return;
    // avoid early audio sending while session completes startup
    if (!(session as any).__safeToSpeak) return;
    // Normalize quickly to avoid loud/quiet swings and reduce CPU cost
    const normalized = normalizePcmSimple(float32, 0.12);
    const blob = createPcmBlob(normalized, 16000);
    // SDK type differs in some builds — cast to any to avoid compile type mismatch here
    session.sendRealtimeInput({ media: blob as any });
  }

  function stopRecording() {
    isRecordingRef.current = false;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    setStatus("Stopped");
  }

  function cleanupAll() {
    stopRecording();
    sessionRef.current?.close();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Live API Test</h1>

      <p>Status: {status}</p>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <button onClick={() => defer(() => startRecording())}>Start Recording</button>
      <button onClick={() => defer(() => stopRecording())}>Stop Recording</button>
      <button onClick={() => defer(() => initSession())}>Reset Session</button>
    </div>
  );
}
