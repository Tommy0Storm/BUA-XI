# Voice Pipeline Architecture

## CRITICAL AUDIO SETTINGS (DO NOT CHANGE)

### Input Configuration (Microphone → Model)
```typescript
AUDIO_INPUT = {
  sampleRate: 16000,  // MUST be 16kHz for browser mic
  channels: 1,        // Mono only
  bufferSize: 256,    // Low latency buffer
}
```

### Output Configuration (Model → Speaker)
```typescript
AUDIO_OUTPUT = {
  sampleRate: 24000,  // Model ALWAYS generates 24kHz
  channels: 1,        // Mono
}
```

## Model Configuration
```typescript
MODELS = {
  nativeAudio: 'gemini-2.5-flash-native-audio-preview-09-2025',  // ✅ PRIMARY
  livePreview: 'gemini-live-2.5-flash-preview',                   // ⚠️ Fallback
  flashLiveLegacy: 'gemini-2.0-flash-live-001',                   // ❌ Deprecated
}
```

## Audio Pipeline Flow

### Input Path (User Voice → Model)
```
Microphone → MediaStream → AudioWorklet (PCM processor @ 16kHz)
  → RMS Normalization (targetRms=0.1)
  → Float32 to Int16 PCM (little-endian)
  → Base64 encode → Blob
  → session.sendRealtimeInput({ media: blob })
```

### Output Path (Model Response → Speaker)
```
session.onmessage → serverContent.modelTurn.parts[].inlineData.data
  → Base64 decode → Uint8Array
  → decodeAudioData @ 24kHz (little-endian Int16 → Float32)
  → RMS Normalization (targetRms=0.09)
  → AudioBufferSourceNode → GainNode (VOLUME_GAIN=1.5)
  → AudioContext.destination (speaker)
```

## Key Audio Functions

### PCM Encoding (`audioUtils.ts`)
```typescript
// Float32 to 16-bit signed PCM
float32ToPCM16(data: Float32Array): ArrayBuffer

// Create blob for sending to API
createPcmBlob(data: Float32Array, sampleRate: number): { data: base64, mimeType }
```

### PCM Decoding (`audioUtils.ts`)
```typescript
// Decode model response to AudioBuffer
decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate, channels): Promise<AudioBuffer>
```

### Normalization (`audioUtils.ts`)
```typescript
// RMS-based normalization to prevent clipping
normalizePcmSimple(pcm: Float32Array, target = 0.1): Float32Array
```

## AudioWorklet (Real-time Processing)
Location: `utils/workletCode.ts`

Features:
- Real-time RMS normalization (target 0.1)
- Soft limiting to prevent clipping at ±1.0
- Mute/unmute support via port messages
- Safe-to-speak gating during warmup
- 256-sample buffer accumulation

## Session Management

### Critical Refs
- `sessionRef` - Live session promise (await before operations)
- `isConnectedRef` - Guard for all async operations
- `modelIsSpeakingRef` - Track model output for interruption
- `safeToSpeakRef` - Gate mic during warmup period
- `activeSourcesRef` - Set of playing AudioBufferSourceNodes

### Interruption Handling
```typescript
// User speaks during model output → auto-interrupt
session.sendRealtimeInput({ interruption: {} })
activeSourcesRef.forEach(src => src.stop())
nextStartTimeRef.current = ctx.currentTime
```

## Vision Pipeline

### Frame Sending (Camera → Model)
```typescript
// 3 FPS camera loop (333ms intervals)
canvas.toBlob(resolve, 'image/jpeg', 0.6)  // 60% quality
session.sendRealtimeInput({ media: blob })
```

### Vision Modes
- Camera: `facingMode: 'user' | 'environment'`
- Screen Share: `getDisplayMedia()`
- Disabled: Audio-only mode

## Error Handling

### API Key Rotation
- Multiple keys in `VITE_API_KEYS` (comma-separated)
- Blacklist keys for 24h on auth failures (401, 403)
- Auto-rotate to next available key

### Connection Recovery
```typescript
// Exponential backoff with 5s cap
const backoff = Math.min(1000 * Math.pow(2, retryCount), 5000)
```

### Model Compatibility
- "not found for API version" → Model doesn't support bidiGenerateContent
- Retry with same model after backoff (not automatic fallback to different model)

## Context7 SDK Patterns (Reference)

### LiveCallbacks Interface
```typescript
interface LiveCallbacks {
  onopen?: null | () => void;       // Connection established
  onclose?: null | (e: CloseEvent) => void;
  onerror?: null | (e: ErrorEvent) => void;
  onmessage: (e: LiveServerMessage) => void;
}
```

### Session Resumption (Future Enhancement)
```typescript
interface SessionResumptionConfig {
  handle?: string;      // Resume token from previous session
  transparent?: boolean;
}
// Server sends SessionResumptionUpdate with newHandle and resumable flag
```

### ApiError Handling Pattern
```typescript
import { GoogleGenAI, ApiError } from '@google/genai';
try {
  // API call
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 404: // Model not found
      case 429: // Rate limit - exponential backoff
      case 401: // Auth failed - blacklist key
      case 400: // Invalid params
    }
  }
}
```

### Server Message Types
- `setupComplete` - Session ready
- `serverContent` - Model response (audio, transcription)
- `toolCall` - Function call requests
- `toolCallCancellation` - Cancel pending tool calls (on interruption)
- `goAway` - Server will disconnect soon (preemptive reconnect)
- `sessionResumptionUpdate` - New handle for resume

### Audio Buffer Considerations
- Context7 reference uses 2048 buffer (vs our 256)
- Tradeoff: 2048 = fewer messages, higher latency
- Our 256 = lower latency, more overhead (good for real-time)
- Keep 256 for lowest latency unless issues arise