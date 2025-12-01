# SERENA MEMORY - BUA-X1 PROJECT NOTES

> **Project**: BUA-X1 (VCB PoLYGoT AI Voice Engine)
> **Last Updated**: December 1, 2025
> **Status**: Active Development - Live Audio + Vision Chat App

---

## 🎯 PROJECT OVERVIEW

**BUA-X1** is a production-grade multilingual voice chat application supporting all 11 official South African languages. It uses Google's Gemini Live API with native audio streaming for real-time voice conversations with AI personas.

### Core Features
- Real-time bidirectional voice communication (Native Audio)
- Vision/Camera integration for visual context
- 11 South African language support with code-switching
- Multiple AI personas with distinct personalities
- Tool calling (email, maps, search, calendar, etc.)
- Enterprise-grade transcript emailing via EmailJS

---

## ⚙️ CRITICAL SETTINGS & CONFIGURATION

### Model Configuration
```typescript
// CRITICAL: These are the only models that work for native audio
MODELS = {
  nativeAudio: 'gemini-2.5-flash-native-audio-preview-09-2025',  // ✅ PREFERRED
  livePreview: 'gemini-live-2.5-flash-preview',                   // ⚠️ Fallback
  flashLiveLegacy: 'gemini-2.0-flash-live-001',                   // ❌ Deprecated
}
```

### Audio Configuration (NEVER CHANGE)
```typescript
// Input from microphone - MUST be 16kHz
AUDIO_INPUT = {
  sampleRate: 16000,  // ALWAYS 16k for browser mic input
  channels: 1,
  bufferSize: 256,    // Stable, low latency
}

// Output from model - ALWAYS 24kHz
AUDIO_OUTPUT = {
  sampleRate: 24000,  // Model generates 24k native audio
  channels: 1,
}
```

### Environment Variables Required
```env
# API Keys (supports multiple comma-separated for rotation)
VITE_GEMINI_API_KEY=AIza...
VITE_API_KEY=AIza...        # Alternative
VITE_API_KEYS=key1,key2,key3  # Multiple keys for rotation

# EmailJS Configuration
VITE_EMAILJS_SERVICE_ID=service_xxx
VITE_EMAILJS_TEMPLATE_ID=template_xxx
VITE_EMAILJS_PUBLIC_KEY=xxx

# Feature Flags
VITE_VERBOSE_LOGGING=false   # Debug logs
VITE_ENABLE_VISION=true      # Camera/Screen share
```

---

## 🔊 VOICE PIPELINE ARCHITECTURE

### Input Flow (User → Model)
```
Microphone → MediaStream → AudioWorklet (PCM normalization @ 16kHz)
    → Float32 to Int16 PCM → Base64 encode → Blob
    → session.sendRealtimeInput({ media: blob })
```

### Output Flow (Model → User)
```
session.onmessage → serverContent.modelTurn.parts[].inlineData.data
    → Base64 decode → Uint8Array → decodeAudioData @ 24kHz
    → AudioBufferSourceNode → GainNode → AudioContext.destination
```

### Key Audio Functions
- `createPcmBlob()` - Converts Float32Array to 16-bit PCM blob
- `decodeAudioData()` - Decodes model response to AudioBuffer
- `normalizePcmSimple()` - RMS-based normalization for consistent levels
- `WORKLET_CODE` - AudioWorklet processor for real-time normalization

### Audio Gain Normalization
```typescript
// Input: targetRms = 0.1 (prevents noise while maintaining speech)
// Output: targetRms = 0.09 (consistent playback volume)
// Soft limiter prevents clipping at ±1.0
```

---

## 📹 VISION PIPELINE

### Camera Frame Sending
```typescript
// Camera loop runs at ~3 FPS (333ms intervals)
// Frames sent as JPEG blobs directly (like Colab reference)
canvas.toBlob(resolve, 'image/jpeg', 0.6)  // 60% quality
session.sendRealtimeInput({ media: blob })
```

### Vision Modes
- **Camera**: User-facing or environment camera
- **Screen Share**: Desktop/window/tab capture
- **Disabled**: No visual context (audio-only)

---

## 🛠️ TOOL CALLING SYSTEM

### Available Tools
| Tool | Purpose | Priority |
|------|---------|----------|
| `send_email` | Send comprehensive emails with context | HIGH |
| `open_maps` | Google Maps directions | HIGH |
| `google_search` | Web search grounding | HIGH |
| `query_lra_document` | Legal document queries | MEDIUM |
| `make_call` | Phone dialer | MEDIUM |
| `open_whatsapp` | WhatsApp messaging | MEDIUM |
| `copy_to_clipboard` | Copy text | LOW |
| `set_reminder` | Browser notifications | LOW |
| `send_sms` | SMS app opening | LOW |
| `create_calendar_event` | Google Calendar | LOW |
| `share_content` | Native share API | LOW |
| `fetch_url_content` | Web page scraping | LOW |
| `prompt_screen_share` | Request screen share | LOW |
| `prompt_camera_share` | Request camera access | LOW |
| `request_location` | Request GPS location | LOW |
| `report_language_change` | Language detection | AUTO |

### Tool Response Pattern
```typescript
session.sendToolResponse({
  functionResponses: [{
    id: call.id,
    name: call.name,
    response: { result: 'Success message with context' }
  }]
})
```

---

## 👤 PERSONA SYSTEM

### Persona Structure
```typescript
interface Persona {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  voiceName: string;        // Gemini voice: Kore, Fenrir, Puck, etc.
  role: string;
  vibe: string;
  description: string;
  baseInstruction: string;  // System prompt
  initialGreeting: string;  // First message
  temperature?: number;     // 0.0-1.0 (creativity)
  requiresCamera?: boolean;
}
```

### Available Personas
1. **LIANELA** - Legal Intelligence (Scale icon)
2. **VCB Agent** - Sales Specialist (Zap icon)
3. **Thabo** - Executive Strategist (Briefcase)
4. **Vusi** - Kasi Energy (Zap)
5. **Sipho** - Elder/Heritage (Scroll)
6. **Thandi** - Operations Director (Target)
7. **Lerato** - Wellness/Empathy (Sun)
8. **Nandi** - Trendsetter/Gen-Z (Sparkles)
9. **Lindiwe** - Support Agent (Life-buoy)
10. **Zama** - Visual Companion (Eye) - *Requires Camera*

---

## 🔧 ERROR HANDLING PATTERNS

### API Key Rotation
```typescript
// Keys are blacklisted for 24h after auth failures
// Automatic rotation through VITE_API_KEYS array
// Only blacklist on: 401, 403, "api key", "invalid key", "quota"
```

### Connection Recovery
```typescript
// Auto-reconnect with exponential backoff
const backoff = Math.min(1000 * Math.pow(2, retryCount), 5000);
// Max 5 seconds between retries
```

### Model Compatibility Errors
```
"not found for API version" → Model doesn't support bidiGenerateContent
"unsupported modality" → Try different model
```

---

## 🎛️ KEY REFS & STATE

### Critical Refs
- `sessionRef` - Live session promise
- `isConnectedRef` - Connection state (prevents send on closed socket)
- `modelIsSpeakingRef` - Model output state (for interruption)
- `safeToSpeakRef` - Gating flag during warmup
- `activeSourcesRef` - Set of playing AudioBufferSourceNodes

### State Management
- `status`: 'disconnected' | 'connecting' | 'connected' | 'error'
- `isMuted` / `isMicMuted` - Separate output/input muting
- `isVideoActive` - Camera state
- `timeLeft` - Demo timer countdown

---

## 📝 COLAB REFERENCE COMPLIANCE

The `colab.txt` file contains Google's tested working configuration. Key compliance points:

1. **Model**: Use `gemini-2.5-flash-native-audio-preview-09-2025`
2. **Sample Rates**: Input 16kHz, Output 24kHz
3. **Audio Format**: 16-bit signed PCM little-endian
4. **Session Config**:
   ```typescript
   responseModalities: [Modality.AUDIO],
   speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
   tools: [...],
   systemInstruction: '...'
   ```
5. **Send Media**: `session.sendRealtimeInput({ media: blob })`
6. **Send Interrupt**: `session.sendRealtimeInput({ interruption: {} })`

---

## 🚀 DEPLOYMENT NOTES

### Build Command
```bash
npm run build  # Vite build
npm run dev    # Development server
```

### File Structure
```
bua-x1/
├── hooks/
│   └── useGeminiLive.ts    # Core voice hook (main logic)
├── components/
│   ├── ChatWidget.tsx      # Main UI widget
│   ├── LiveConsole.tsx     # Debug console
│   └── AudioVisualizer.tsx # Voice visualizer
├── services/
│   ├── emailService.ts     # EmailJS integration
│   └── documentService.ts  # LRA document queries
├── personas/               # AI persona definitions
├── utils/
│   ├── audio.ts            # Audio helpers
│   ├── audioUtils.ts       # PCM encoding/decoding
│   ├── workletCode.ts      # AudioWorklet processor
│   └── consoleUtils.ts     # Logging system
├── constants.ts            # Personas, tools, config
├── types.ts                # TypeScript interfaces
├── gemini.config.ts        # Model & audio constants
└── App.tsx                 # Main app entry
```

---

## ⚠️ KNOWN ISSUES & WORKAROUNDS

1. **HMR Kills Sessions**: Protected with `import.meta.hot.accept()` 
2. **Context Leaks**: Use `isConnectedRef.current` guards before async ops
3. **Audio Playback Overlap**: Deduplication via `playedChunksRef` hash set
4. **Mobile Audio**: Requires user gesture to resume AudioContext
5. **Disconnect Spam**: `isDisconnectingRef` prevents multiple calls

---

## 🔜 ENHANCEMENT PRIORITIES

1. [ ] Implement connection health watchdog
2. [ ] Add audio quality metrics logging
3. [ ] Enhance mobile PTT experience
4. [ ] Add session resumption support
5. [ ] Implement conversation history persistence
6. [ ] Add voice activity detection tuning UI

---

*This document is automatically maintained by Serena for project continuity.*
