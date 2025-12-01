// utils/workletCode.ts

export const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 256;
    this.buffer = new Float32Array(this.bufferSize);
    this.index = 0;
    this.isMuted = false;
    this.safeToSpeak = false;
    
    this.port.onmessage = (e) => {
      if (e.data.type === 'setMuted') {
        this.isMuted = e.data.value;
      } else if (e.data.type === 'setSafeToSpeak') {
        this.safeToSpeak = e.data.value;
      }
    };
  }
  
  process(inputs, outputs, parameters) {
    if (!this.safeToSpeak || this.isMuted) return true;
    
    const input = inputs[0];
    if (input.length > 0) {
      let pcm = input[0];
      
      // RMS normalization - targetRms 0.1 to prevent noise
      let sumSquares = 0;
      for (let i = 0; i < pcm.length; i++) {
        sumSquares += pcm[i] * pcm[i];
      }
      const rms = Math.sqrt(sumSquares / pcm.length);
      
      if (rms > 0.001) {
        const targetRms = 0.1;
        const gain = Math.min(targetRms / rms, 2.5);
        const normalized = new Float32Array(pcm.length);
        
        for (let i = 0; i < pcm.length; i++) {
          let v = pcm[i] * gain;
          // Soft limiting to prevent clipping
          if (v > 1) v = 1 - (1 / (v + 1e-6));
          if (v < -1) v = -1 + (1 / (-v + 1e-6));
          normalized[i] = v;
        }
        pcm = normalized;
      }
      
      // Buffer and send
      for (let i = 0; i < pcm.length; i++) {
        this.buffer[this.index++] = pcm[i];
        if (this.index >= this.bufferSize) {
          this.port.postMessage({ type: 'audio', data: this.buffer.slice(), rms });
          this.index = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;