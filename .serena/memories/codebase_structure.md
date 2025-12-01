# Codebase Structure

## Root Files
```
bua-x1/
├── App.tsx              # Main app with slideshow + ChatWidget
├── index.tsx            # React entry point
├── index.html           # HTML template
├── index.css            # Global styles (Tailwind)
├── types.ts             # TypeScript interfaces (Persona, ConnectionStatus, etc.)
├── constants.ts         # PERSONAS array, LIVE_API_TOOLS, AUDIO_CONFIG
├── gemini.config.ts     # Model names, audio constants, client options
├── gemini.session.ts    # Session creation wrapper (less used)
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── package.json         # Dependencies and scripts
```

## Core Directories

### /hooks
```
hooks/
└── useGeminiLive.ts     # THE MAIN HOOK - 1600+ lines
                         # Handles: connection, audio, video, tools, state
```

### /components
```
components/
├── ChatWidget.tsx       # Main UI widget (persona selection, voice stage)
├── LiveConsole.tsx      # Debug console with styled logs
└── AudioVisualizer.tsx  # Voice activity visualization
```

### /services
```
services/
├── emailService.ts      # EmailJS integration (transcript + generic emails)
└── documentService.ts   # LRA document queries
```

### /utils
```
utils/
├── audio.ts             # Audio helpers (createPcmBlob, decodeAudio, shared context)
├── audioUtils.ts        # PCM encoding/decoding, base64 conversion
├── workletCode.ts       # AudioWorklet processor code string
├── consoleUtils.ts      # dispatchLog function for UI console
├── toolUtils.ts         # Tool-related utilities
└── uiUtils.ts           # UI helper functions
```

### /personas
```
personas/
├── dark-matter.ts       # LIANELA persona
├── vcb-agent.ts         # VCB Agent (Thuli) persona
├── thabo.ts             # Executive persona
├── vusi.ts              # Kasi energy persona
├── sipho.ts             # Elder persona
├── thandi.ts            # Operations persona
├── lerato.ts            # Wellness persona
├── nandi.ts             # Trendsetter persona
├── lindiwe.ts           # Support persona
└── zama.ts              # Visual companion persona
```

### /src
```
src/
├── debug/
│   └── live-watchdog.ts # Connection monitoring (future)
└── pages/
    ├── LiveAudio.tsx    # Standalone audio page
    └── LiveTest.tsx     # Testing page
```

### /public
```
public/
└── documents/
    └── lra-code-of-conduct-dismissals-2025.txt  # Legal document for queries
```

## Key File Responsibilities

### useGeminiLive.ts (THE BRAIN)
- WebSocket session management
- Audio context creation and management
- Microphone capture via AudioWorklet
- Model audio playback with normalization
- Tool call handling and responses
- Vision/camera frame sending
- Connection state and error handling
- API key rotation and blacklisting
- Auto-reconnect with exponential backoff

### ChatWidget.tsx (THE FACE)
- Persona selection UI
- Voice stage during calls
- Control buttons (mic, camera, PTT, captions)
- Timer and transcript display
- Permission consent modal
- Mobile-responsive design

### constants.ts (THE CONFIG)
- PERSONAS array with all 10 personas
- LIVE_API_TOOLS array with all tool declarations
- AUDIO_CONFIG (sample rates)
- SUPPORTED_LANGUAGES array
