
import React, { useEffect, useState, useRef } from 'react';
import { LogEntry } from '../utils/consoleUtils';
import { Terminal, ShieldCheck, Activity, ChevronRight, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';

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

  // Render different styles based on log type ("Announced" logs)
  const renderLogContent = (log: LogEntry) => {
    switch (log.type) {
        case 'action':
            return (
                <div className="bg-blue-500/10 border-l-2 border-blue-500 p-3 rounded-r-md my-2 animate-fade-in-left">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
                        <Cpu size={12} />
                        EXECUTE PROTOCOL
                    </div>
                    <div className="text-blue-100 font-medium">{log.message}</div>
                    {log.detail && <div className="text-blue-400/60 text-xs mt-1 font-mono">{log.detail}</div>}
                </div>
            );
        case 'success':
            return (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-md my-2 animate-fade-in shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
                        <CheckCircle2 size={12} />
                        SUCCESS
                    </div>
                    <div className="text-emerald-100 font-medium">{log.message}</div>
                    {log.detail && <div className="text-emerald-500/60 text-xs mt-1 font-mono">{log.detail}</div>}
                </div>
            );
        case 'error':
            return (
                <div className="bg-red-500/10 border-l-2 border-red-500 p-3 rounded-r-md my-2">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider mb-1">
                        <AlertTriangle size={12} />
                        CRITICAL FAILURE
                    </div>
                    <div className="text-red-100 font-medium">{log.message}</div>
                    {log.detail && <div className="text-red-400/60 text-xs mt-1 font-mono">{log.detail}</div>}
                </div>
            );
        default:
            return (
                <div className="py-1 flex gap-3 hover:bg-white/5 px-2 rounded -mx-2 transition-colors">
                    <span className="text-gray-600 shrink-0 select-none font-mono text-xs pt-0.5">[{log.timestamp}]</span>
                    <div className="break-all">
                        <span className={`font-bold uppercase mr-2 text-[10px] tracking-wider opacity-70 
                            ${log.type === 'warn' ? 'text-yellow-500' : 'text-gray-400'}`}>
                            {log.type}
                        </span>
                        <span className="text-gray-300">{log.message}</span>
                        {log.detail && <div className="text-gray-500 text-xs mt-0.5 font-mono pl-2 border-l border-gray-700">{log.detail}</div>}
                    </div>
                </div>
            );
    }
  };

  return (
    <div className="relative rounded-[2.5rem] bg-[#09090b] border border-white/10 p-2 shadow-2xl overflow-hidden group hover:scale-[1.01] transition-transform duration-500 w-full h-full min-h-[450px]">
      {/* Background Grid & Scanlines */}
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_2px,3px_100%]"></div>
      
      {/* Terminal Container */}
      <div className="bg-black/90 backdrop-blur-xl rounded-[2rem] p-6 h-full flex flex-col relative border border-white/5 z-20">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-4 border-b border-white/10 pb-4">
           <div className="flex gap-2">
               <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
               <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
               <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
           </div>
           <div className="ml-auto flex items-center gap-3 text-xs font-mono">
             <span className="text-gray-500">PORT: 443</span>
             <span className="flex items-center gap-2 text-emerald-500/80">
                <Activity size={14} className="animate-pulse" />
                LIVE_STREAM
             </span>
           </div>
        </div>

        {/* Logs Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto font-sans text-sm space-y-1 custom-scrollbar pr-2 pb-4 scroll-smooth">
           {logs.map((log) => (
             <div key={log.id}>
                {renderLogContent(log)}
             </div>
           ))}
           
           {/* Blinking Cursor */}
           <div className="flex items-center gap-2 mt-4 text-emerald-500/50 animate-pulse">
               <ChevronRight size={14} />
               <div className="w-2 h-4 bg-emerald-500/50"></div>
           </div>
        </div>

        {/* Floating Status Badge */}
        <div className="absolute bottom-6 right-6 px-4 py-2 bg-gray-900/90 backdrop-blur-md border border-white/10 text-white rounded-lg font-bold text-xs shadow-xl flex items-center gap-2 ring-1 ring-white/5">
           <ShieldCheck size={14} className="text-emerald-500" />
           SOC2 COMPLIANT LOGGER
        </div>
      </div>
    </div>
  );
};
