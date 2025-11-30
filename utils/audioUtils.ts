import { Blob } from '@google/genai';

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function float32ToPCM16(data: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(data.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < data.length; i++) {
        const s = Math.max(-1, Math.min(1, data[i]));
        const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(i * 2, val, true);
    }
    return buffer;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  // Use DataView to ensure Little Endian decoding regardless of system architecture
  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Calculate frame count based on bytes (2 bytes per sample per channel)
  const frameCount = Math.floor(data.byteLength / (2 * numChannels));
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // 16-bit PCM is signed. getInt16 handles the sign bit correctly.
      // The 'true' parameter forces Little Endian, which is what Gemini API sends.
      const sampleIndex = i * numChannels + channel;
      const sample = dataView.getInt16(sampleIndex * 2, true);
      // Normalize to [-1.0, 1.0] float
      channelData[i] = sample / 32768.0;
    }
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array, sampleRate: number) {
  const buffer = float32ToPCM16(data);
  
  return {
    data: uint8ArrayToBase64(new Uint8Array(buffer)),
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

// Simple Voice Activity Detection (VAD) to determine if a chunk contains speech
// Added configurable threshold parameter
export function hasSpeech(data: Float32Array, threshold: number = 0.01): boolean {
    let sum = 0;
    const len = data.length;
    for(let i=0; i < len; i++) {
        sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / len);
    return rms > threshold;
}

// Lightweight RMS-based normalization — fast and effective for realtime mic scaling
export function normalizePcmSimple(pcm: Float32Array, target = 0.1): Float32Array {
  let sum = 0;
  const len = pcm.length;
  for (let i = 0; i < len; i++) sum += pcm[i] * pcm[i];
  const rms = Math.sqrt(sum / len) || 1;
  const gain = target / rms;

  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = pcm[i] * gain;
  return out;
}