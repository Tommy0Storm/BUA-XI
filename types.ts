
export interface AudioConfig {
  inputSampleRate: number;
  outputSampleRate: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface Persona {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  voiceName: string; // The Engine voice name (e.g., Fenrir, Puck)
  role: string;
  vibe: string; // New field for short visual descriptor
  description: string;
  icon: string;
  baseInstruction: string;
  initialGreeting: string; // NEW: Forces specific opening line
  maxDurationSeconds?: number; // Optional override for demo duration
  capabilities: string[];
  voiceDescription: string;
  temperature?: number; // 0.0 (Strict/Legal) to 1.0 (Creative/Chatty)
  requiresCamera?: boolean; // If true, persona requires camera to be on to engage
}

export interface LiveSessionConfig {
  voiceName: string;
  systemInstruction: string;
}