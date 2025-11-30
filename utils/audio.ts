// utils/audio.ts
import { base64ToUint8Array, float32ToPCM16 } from './audioUtils';

export function createPcmBlob(float32Array: Float32Array, sampleRate?: number) {
  const buffer = float32ToPCM16(float32Array);
  return new Blob([buffer], { type: 'audio/pcm' });
}

export async function decodeAudio(modelData: Uint8Array, context: AudioContext) {
  const arrayBuffer = modelData.buffer.slice(
    modelData.byteOffset,
    modelData.byteOffset + modelData.byteLength
  );

  return await context.decodeAudioData(arrayBuffer as ArrayBuffer);
}

// Shared output AudioContext (singleton) — avoids multiple AudioContexts being created
let sharedOutputCtx: AudioContext | null = null;
export function getOutputContext() {
  if (!sharedOutputCtx) sharedOutputCtx = createAudioContext(24000);
  return sharedOutputCtx;
}

export function createAudioContext(sampleRate: number) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    return new Ctx({ sampleRate });
}

export async function playInlineAudio(
  turn: any,
  outputCtx: AudioContext,
  gainNode: GainNode | null,
  activeSourcesRef: React.MutableRefObject<Set<AudioBufferSourceNode>>,
  decodeFn: (data: Uint8Array, ctx: AudioContext) => Promise<AudioBuffer> = decodeAudio
) {
  if (!turn || !turn.turnComplete) return;

  const audioData = turn.parts?.[0]?.inlineData?.data;
  if (!audioData) return;

  let raw: Uint8Array;
  if (typeof audioData === 'string') {
    raw = base64ToUint8Array(audioData);
  } else {
    raw = audioData;
  }

  try {
    const audioBuffer = await decodeFn(raw, outputCtx);
    const source = outputCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gainNode || outputCtx.destination);
    source.onended = () => activeSourcesRef.current.delete(source);
    const startTime = outputCtx.currentTime + 0.01;
    source.start(startTime);
    activeSourcesRef.current.add(source);
  } catch (e) {}
}

export default { createPcmBlob, decodeAudio };
