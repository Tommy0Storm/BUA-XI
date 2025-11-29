
import React, { useState, useMemo, useEffect } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { PERSONAS } from '../constants';
import AudioVisualizer from './AudioVisualizer';
import { 
  X, Mic, MicOff, LogOut, 
  Briefcase, Zap, Scroll, Target, Sun, Sparkles, User, ChevronRight, Play, BarChart2,
  AlertCircle, LifeBuoy, ArrowUpRight, Captions, CheckCircle2
} from 'lucide-react';

// --- VOICE UI KIT PRIMITIVES ---

// 1. Icon Helper
const getPersonaIcon = (iconKey: string, size: number = 24, className: string = "") => {
  const props = { size, className, strokeWidth: 1.5 }; 
  switch (iconKey) {
    case 'briefcase': return <Briefcase {...props} />;
    case 'zap': return <Zap {...props} />;
    case 'scroll': return <Scroll {...props} />;
    case 'target': return <Target {...props} />;
    case 'sun': return <Sun {...props} />;
    case 'sparkles': return <Sparkles {...props} />;
    case 'life-buoy': return <LifeBuoy {...props} />;
    default: return <User {...props} />;
  }
};

// 2. Sentence Parser for Cinematic Transcript
const getLastSentence = (text: string): string => {
    if (!text) return "";
    const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
    if (!matches || matches.length === 0) return text;
    return matches[matches.length - 1].trim();
};

// 3. Control Button Component
interface ControlBtnProps {
    active: boolean; 
    onClick: () => void; 
    icon: React.ReactNode;
    variant?: 'default' | 'danger' | 'primary' | 'secondary';
    label?: string;
}

const ControlBtn: React.FC<ControlBtnProps> = ({ 
    active, 
    onClick, 
    icon, 
    variant = 'default',
    label 
}) => {
    const baseClass = "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200 relative group active:scale-95";
    
    let colorClass = "bg-gray-800 text-white hover:bg-gray-700"; 
    
    if (variant === 'danger') {
        colorClass = "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20";
    } else if (variant === 'primary' && active) {
        colorClass = "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20";
    } else if (variant === 'default' && active) {
        colorClass = "bg-white text-black hover:bg-gray-200";
    } else if (variant === 'secondary') {
        colorClass = active ? "bg-white text-black" : "bg-gray-800/50 text-white hover:bg-gray-800";
    }

    return (
        <button onClick={onClick} className={`${baseClass} ${colorClass}`}>
            {icon}
            {label && (
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                    {label}
                </span>
            )}
        </button>
    );
};

// --- MAIN WIDGET COMPONENT ---

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(PERSONAS[0].id);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const [showCaptions, setShowCaptions] = useState(true);
  const apiKey = process.env.API_KEY;

  const selectedPersona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];

  const { status, connect, disconnect, inputAnalyserRef, outputAnalyserRef, detectedLanguage, transcript, error, isMuted, toggleMute, isMicMuted, toggleMic, timeLeft, transcriptSent } = useGeminiLive({
    apiKey,
    persona: selectedPersona,
  });

  const activeSubtitle = useMemo(() => getLastSentence(transcript), [transcript]);

  const toggleWidget = () => {
    if (isOpen) {
      if (status === 'connected') disconnect();
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  };

  const handlePersonaSelect = (id: string) => {
    setSelectedPersonaId(id);
  };

  const playPreview = (personaId: string, gender: string, e: React.MouseEvent) => {
      e.stopPropagation(); 
      if (playingPreview) return;

      setPlayingPreview(personaId);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const baseFreq = gender === 'Male' ? 130 : 220;
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(baseFreq - 20, ctx.currentTime + 0.5);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
      
      setTimeout(() => {
          setPlayingPreview(null);
          ctx.close();
      }, 1200);
  };

  const formattedTime = useMemo(() => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      return `${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  }, [timeLeft]);

  const isTimeLow = timeLeft <= 30;

  // --- VIEW: CONNECTED (VOICE STAGE) ---
  if ((status === 'connected' || status === 'connecting') && isOpen) {
      return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center animate-fade-in-up origin-bottom-right font-sans">
             
             {/* Main Container - The "Stage" */}
             <div className="w-[24rem] h-[38rem] bg-[#09090b] rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden relative flex flex-col border border-white/10 ring-1 ring-black/50">
                
                {/* 1. Voice Header */}
                <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 shadow-sm">
                        <div className={`w-2 h-2 rounded-full ${status === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
                        <span className={`text-xs font-mono font-medium tracking-wide ${isTimeLow ? 'text-red-400' : 'text-gray-300'}`}>
                            {status === 'connecting' ? 'CONNECTING...' : formattedTime}
                        </span>
                    </div>
                    
                    <button onClick={toggleWidget} className="p-2 text-white/50 hover:text-white transition-colors pointer-events-auto rounded-full hover:bg-white/10">
                        <X size={20} strokeWidth={1.5} />
                    </button>
                </div>

                {/* 2. The Visualizer Stage */}
                <div className="flex-1 flex flex-col items-center justify-center relative bg-grid-pattern select-none">
                     {/* Ambient Glow */}
                     <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000 ${selectedPersona.gender === 'Male' ? 'bg-emerald-600' : 'bg-amber-600'}`}></div>

                     {/* Avatar & Visualizer */}
                     <div className="relative w-72 h-72 flex items-center justify-center">
                         <div className="absolute inset-0">
                             <AudioVisualizer 
                                 isActive={status === 'connected'} 
                                 inputAnalyser={inputAnalyserRef.current}
                                 outputAnalyser={outputAnalyserRef.current}
                                 mode="circle"
                                 color={selectedPersona.gender === 'Male' ? '#10b981' : '#f59e0b'} 
                             />
                         </div>
                         
                         {/* Persona Avatar */}
                         <div className="relative z-10 w-24 h-24 rounded-full bg-[#18181b] flex items-center justify-center shadow-2xl border border-white/10">
                              {getPersonaIcon(selectedPersona.icon, 40, selectedPersona.gender === 'Male' ? "text-emerald-400" : "text-amber-400")}
                         </div>
                     </div>

                     {/* Cinematic Transcript Overlay */}
                     <div className="absolute bottom-28 left-0 right-0 px-8 min-h-[4rem] flex flex-col items-center justify-end z-10">
                        {!activeSubtitle || !showCaptions ? (
                            <div className="text-center space-y-1 animate-fade-in opacity-50">
                                <h3 className="text-xl font-semibold text-white tracking-tight">{selectedPersona.name}</h3>
                                <p className="text-xs text-white/40 uppercase tracking-widest font-medium">{selectedPersona.role}</p>
                            </div>
                        ) : (
                            <div className="w-full text-center animate-fade-up">
                                <p className="text-lg font-medium text-white/90 leading-snug drop-shadow-md">
                                    "{activeSubtitle}"
                                </p>
                            </div>
                        )}
                     </div>
                </div>

                {/* 3. Voice Control Bar */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 w-full flex justify-center">
                     <div className="flex items-center gap-2 px-3 py-2 bg-[#18181b]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl ring-1 ring-black/50">
                         
                         <ControlBtn 
                            active={!isMicMuted}
                            onClick={toggleMic}
                            variant={!isMicMuted ? 'primary' : 'secondary'}
                            icon={isMicMuted ? <MicOff size={20} className="text-red-400" /> : <Mic size={20} />}
                            label={isMicMuted ? "Unmute" : "Mute"}
                         />

                         <ControlBtn 
                            active={showCaptions}
                            onClick={() => setShowCaptions(!showCaptions)}
                            variant={showCaptions ? 'default' : 'secondary'}
                            icon={<Captions size={20} className={showCaptions ? "" : "opacity-40"} />}
                            label="Captions"
                         />

                         <div className="w-px h-8 bg-white/10 mx-1"></div>

                         <ControlBtn 
                            active={true}
                            onClick={() => disconnect()}
                            variant="danger"
                            icon={<LogOut size={20} />}
                            label="End Call"
                         />
                     </div>
                </div>

             </div>
        </div>
      );
  }

  // --- VIEW: SELECTION (LAUNCHPAD MODAL) ---
  return (
    <div className="font-sans">
      
      {transcriptSent && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down pointer-events-none">
              <div className="bg-[#18181b] text-white pl-4 pr-6 py-2.5 rounded-full shadow-2xl border border-white/10 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  </div>
                  <div className="flex flex-col leading-none">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">COMPLIANCE</span>
                      <span className="text-sm font-medium">Transcript sent to <span className="text-white font-bold">tommy@vcb-ai.online</span></span>
                  </div>
              </div>
          </div>
      )}

      {isOpen && status !== 'connected' && status !== 'connecting' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={toggleWidget}></div>
      )}

      {isOpen && status !== 'connected' && status !== 'connecting' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
          <div className="pointer-events-auto bg-[#FAFAFA] w-full max-w-6xl h-[90vh] sm:h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-300 border border-white/50">
            
            <div className="bg-white border-b border-gray-100 p-6 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">System Online</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Select Agent</h2>
                </div>
                <button 
                    onClick={toggleWidget}
                    className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
                >
                    <X size={20} className="text-gray-500" />
                </button>
            </div>

            {status === 'error' && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center p-8">
                     <div className="text-center">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={32} className="text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Connection Failed</h3>
                        <p className="text-gray-500 mb-6 max-w-xs mx-auto text-sm">{error || "Neural link unstable."}</p>
                        <button onClick={() => { connect(); }} className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-black transition-colors">
                            Retry Connection
                        </button>
                     </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gray-50/50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
                    {PERSONAS.map(persona => {
                        const isSelected = selectedPersonaId === persona.id;
                        return (
                            <button
                                key={persona.id}
                                onClick={() => handlePersonaSelect(persona.id)}
                                className={`group relative p-5 rounded-2xl border text-left transition-all duration-200 
                                    ${isSelected 
                                        ? 'bg-white border-gray-900 shadow-xl ring-1 ring-gray-900/5' 
                                        : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors
                                        ${isSelected ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-400'}
                                    `}>
                                        {getPersonaIcon(persona.icon, 24)}
                                    </div>
                                    <div 
                                        role="button"
                                        onClick={(e) => playPreview(persona.id, persona.gender, e)}
                                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
                                    >
                                        {playingPreview === persona.id ? <BarChart2 size={18} className="animate-pulse text-emerald-500" /> : <Play size={18} />}
                                    </div>
                                </div>

                                <h3 className="font-bold text-gray-900 mb-1">{persona.name}</h3>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{persona.role}</p>
                                <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">{persona.description}</p>
                                
                                <div className="flex flex-wrap gap-1.5">
                                    {persona.capabilities.slice(0,3).map((cap, i) => (
                                        <span key={i} className="px-2 py-1 bg-gray-50 text-gray-500 text-[10px] font-medium rounded border border-gray-100">
                                            {cap}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white via-white to-transparent pt-12 z-20 pointer-events-none">
                 <div className="max-w-xl mx-auto pointer-events-auto">
                    <button
                        onClick={() => { connect(); }}
                        className="w-full py-4 bg-[#18181b] hover:bg-black text-white rounded-xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 active:scale-[0.99] flex items-center justify-center gap-3 group"
                    >
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <span className="font-bold tracking-wide">INITIALIZE {selectedPersona.name.toUpperCase()}</span>
                        <ArrowUpRight size={18} className="text-gray-400 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>
                 </div>
            </div>
          </div>
        </div>
      )}

      {!isOpen && (
        <div className="fixed bottom-8 right-8 z-50">
            <button
                onClick={toggleWidget}
                className="pl-4 pr-5 py-3 bg-[#18181b] text-white rounded-full shadow-2xl hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all group border border-white/10"
            >
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mr-3 ring-1 ring-emerald-500/30">
                     <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                </div>
                <div className="flex flex-col items-start leading-none mr-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Voice OS</span>
                    <span className="text-sm font-bold">Start Demo</span>
                </div>
                <ChevronRight size={16} className="text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      )}
    </div>
  );
};
