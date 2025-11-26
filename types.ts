export interface AudioConfig {
  inputSampleRate: number;
  outputSampleRate: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface Persona {
  id: string;
  name: string;
  gender: 'Male' | 'Female';
  voiceName: string; // 
  role: string;
  description: string;
  icon: string;
  baseInstruction: string;
}

export interface LiveSessionConfig {
  voiceName: string;
  systemInstruction: string;
}
