// gemini.config.ts
// Unified config for Gemini Live API (Native Audio + Vision + Text)

// IMPORTANT: API Key environment variable names to check (browser and Node)
export const ENV_KEYS = {
  // Prefer Vite-style variable names for browser builds
  vitePrimary: 'VITE_GEMINI_API_KEY',
  viteAlt: 'VITE_API_KEY',
  // Node / server keys
  primary: 'GEMINI_API_KEY',
  fallback: 'GOOGLE_API_KEY',
};

// Load API key with fallback logic (works in Node and in Vite browser builds)
export function getApiKey(): string {
  // Prefer Vite runtime variable in the browser
  try {
    // @ts-ignore
    const viteKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY as string | undefined;
    if (viteKey && viteKey.trim()) {
      return viteKey.trim().split(',').map(s => s.trim())[0];
    }
  } catch (e) {
    // ignore
  }

  // Server / Node env variables
  const nodeKey = process?.env?.[ENV_KEYS.primary] ||
                  process?.env?.[ENV_KEYS.fallback] ||
                  process?.env?.['API_KEY'];
  if (nodeKey && nodeKey.trim()) {
    return nodeKey.trim();
  }

  throw new Error(
    `[GeminiConfig] No API key found. Set VITE_GEMINI_API_KEY (browser) or ` +
    `${ENV_KEYS.primary} / ${ENV_KEYS.fallback} (server).`
  );
}

// ---------------------------------------------------------------
// MODEL DEFINITIONS
// ---------------------------------------------------------------
/**
 * Available Gemini model identifiers for different use cases.
 */
export const MODELS = {
  // Native audio model - supports actual audio output (use this for voice)
  nativeAudio: 'gemini-2.5-flash-native-audio-preview-09-2025',

  // Live preview model - faster but may not support audio output properly
  livePreview: 'gemini-live-2.5-flash-preview',

  // Old legacy live model (only for debugging)
  flashLiveLegacy: 'gemini-2.0-flash-live-001',
};

// ---------------------------------------------------------------
// AUDIO CONSTANTS
// ---------------------------------------------------------------
/**
 * Audio input configuration for microphone capture.
 */
export const AUDIO_INPUT = {
  sampleRate: 16000, // mic input (browser safe)
  channels: 1,
  bufferSize: 256,
};

export const AUDIO_OUTPUT = {
  sampleRate: 24000, // model native audio sample rate
  channels: 1,
};

// ---------------------------------------------------------------
// SPEECH CONFIG
// ---------------------------------------------------------------
export const SPEECH = {
  defaultVoice: 'Orus',
};

// default live session config for the SDK connect() call
export const DEFAULT_LIVE_CONFIG = {
  responseModalities: ['AUDIO'],
  speechConfig: {
    voiceConfig: { prebuiltVoiceConfig: { voiceName: SPEECH.defaultVoice } }
  },
  sessionResumption: { enabled: true, handle: null },
};

export const VISION = {
  enabled: true,
  sendFrames: true,
  frameRate: 2, // Google best practice: 2 FPS for stability
  maxWidth: 640, // Google best practice: 640x480 for camera
  maxHeight: 480,
};

// Create client options (accept optional override apiKey)
export function createGeminiClientOptions(apiKeyOverride?: string) {
  if (apiKeyOverride && typeof apiKeyOverride === 'string' && apiKeyOverride.trim()) {
    return { apiKey: apiKeyOverride.trim() } as any;
  }

  const apiKey = getApiKey();
  return { apiKey } as any;
}

export default {
  ENV_KEYS,
  MODELS,
  AUDIO_INPUT,
  AUDIO_OUTPUT,
  SPEECH,
  DEFAULT_LIVE_CONFIG,
  VISION,
  getApiKey,
  createGeminiClientOptions,
};
