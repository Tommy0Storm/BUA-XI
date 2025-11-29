
export type LogType = 'info' | 'warn' | 'error' | 'success' | 'action';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: LogType;
  message: string;
  detail?: string;
}

export const dispatchLog = (type: LogType, message: string, detail?: string) => {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('bua-console-log', {
    detail: {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('en-ZA', { hour12: false }),
      type,
      message,
      detail
    } as LogEntry
  });
  window.dispatchEvent(event);
};
