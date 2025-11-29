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

export function createPcmBlob(data: Float32Array, sampleRate: number): Blob {
  // Use DataView to ensure Little Endian encoding, as required by Gemini API.
  // This prevents issues on devices that might be Big Endian.
  const buffer = new ArrayBuffer(data.length * 2);
  const view = new DataView(buffer);
  
  for (let i = 0; i < data.length; i++) {
    // Clamp values to -1 to 1 before converting
    const s = Math.max(-1, Math.min(1, data[i]));
    // Convert float to 16-bit PCM
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    // Set Int16 with Little Endian = true
    view.setInt16(i * 2, val, true);
  }
  
  return {
    data: uint8ArrayToBase64(new Uint8Array(buffer)),
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

// Simple Voice Activity Detection (VAD) to determine if a chunk contains speech
export function hasSpeech(data: Float32Array, threshold: number = 0.01): boolean {
    let sum = 0;
    const len = data.length;
    for(let i=0; i < len; i++) {
        sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / len);
    return rms > threshold;
}
