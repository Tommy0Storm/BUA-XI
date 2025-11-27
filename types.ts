
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
  description: string;
  icon: string;
  baseInstruction: string;
  maxDurationSeconds?: number; // Optional override for demo duration
  capabilities: string[];
  voiceDescription: string;
}

export interface LiveSessionConfig {
  voiceName: string;
  systemInstruction: string;
}
