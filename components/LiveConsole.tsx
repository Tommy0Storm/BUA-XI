
import React, { useEffect, useState, useRef } from 'react';
import { LogEntry } from '../utils/consoleUtils';
import { Terminal, ShieldCheck, Activity } from 'lucide-react';

export const LiveConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial Boot Sequence Logs
  useEffect(() => {
    setLogs([
      { id: 'boot-1', timestamp: new Date().toLocaleTimeString('en-ZA'), type: 'info', message: 'Initializing Bua X1 Neural Engine...' },
      { id: 'boot-2', timestamp: new Date().toLocaleTimeString('en-ZA'), type: 'success', message: 'System Online. Waiting for input.' },
    ]);
  }, []);

  // Listen for custom log events
  useEffect(() => {
    const handleLog = (e: Event) => {
      const customEvent = e as CustomEvent<LogEntry>;
      setLogs(prev => [...prev.slice(-50), customEvent.detail]); // Keep last 50 logs
    };

    window.addEventListener('bua-console-log', handleLog);
    return () => window.removeEventListener('bua-console-log', handleLog);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'success': return 'text-emerald-400';
      case 'action': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="relative rounded-[2.5rem] bg-[#0F0F0F] border border-white/10 p-2 shadow-2xl overflow-hidden group hover:scale-[1.02] transition-transform duration-500 w-full h-full min-h-[400px]">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none"></div>
      
      {/* Terminal Container */}
      <div className="bg-black/80 backdrop-blur-md rounded-[2rem] p-6 h-full flex flex-col relative border border-white/5">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
           <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
           <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
           <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
           <div className="ml-auto flex items-center gap-2 text-xs text-emerald-500/80 font-mono">
             <Activity size={14} className="animate-pulse" />
             LIVE_STREAM
           </div>
        </div>

        {/* Logs Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-sm space-y-3 custom-scrollbar pr-2">
           {logs.map((log) => (
             <div key={log.id} className="animate-fade-in-left">
                <div className="flex gap-3">
                   <span className="text-gray-600 shrink-0 select-none">[{log.timestamp}]</span>
                   <span className={`${getLogColor(log.type)} break-all`}>
                     <span className="font-bold uppercase mr-2 text-[10px] tracking-wider opacity-80">{log.type}</span>
                     {log.message}
                   </span>
                </div>
                {log.detail && (
                  <div className="ml-[6.5rem] mt-1 text-xs text-gray-500 border-l border-gray-800 pl-3">
                    {log.detail}
                  </div>
                )}
             </div>
           ))}
        </div>

        {/* Floating Status Badge */}
        <div className="absolute bottom-6 right-6 px-4 py-2 bg-white/5 backdrop-blur-md border border-white/10 text-white rounded-lg font-bold text-xs shadow-lg flex items-center gap-2">
           <ShieldCheck size={14} className="text-emerald-500" />
           SOC2 COMPLIANT LOGGER
        </div>
      </div>
    </div>
  );
};
