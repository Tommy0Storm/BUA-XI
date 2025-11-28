
import React, { useState } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { PERSONAS } from '../constants';
import AudioVisualizer from './AudioVisualizer';
import { 
  MessageCircle, X, Mic, MicOff, Volume2, VolumeX, Check, LogOut, 
  Briefcase, Zap, Scroll, Target, Sun, Sparkles, User, ChevronRight, Activity, Clock, Play, BarChart2
} from 'lucide-react';

// Helper to map string keys to Lucide Components
const getPersonaIcon = (iconKey: string, size: number = 24, className: string = "") => {
  const props = { size, className, strokeWidth: 1.5 }; // Premium thin stroke
  switch (iconKey) {
    case 'briefcase': return <Briefcase {...props} />;
    case 'zap': return <Zap {...props} />;
    case 'scroll': return <Scroll {...props} />;
    case 'target': return <Target {...props} />;
    case 'sun': return <Sun {...props} />;
    case 'sparkles': return <Sparkles {...props} />;
    default: return <User {...props} />;
  }
};

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(PERSONAS[0].id);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const apiKey = process.env.API_KEY;

  const selectedPersona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];

  const { status, connect, disconnect, volume, detectedLanguage, error, isMuted, toggleMute, isMicMuted, toggleMic, timeLeft } = useGeminiLive({
    apiKey,
    persona: selectedPersona,
  });

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
      e.stopPropagation(); // Prevent card selection
      if (playingPreview) return; // Prevent overlap

      setPlayingPreview(personaId);
      
      // Synthetic Voice Preview (simulating gender pitch)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Male ~ 110-140Hz, Female ~ 200-250Hz
      const baseFreq = gender === 'Male' ? 130 : 220;
      
      osc.type = 'triangle'; // Richer sound than sine
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(baseFreq - 20, ctx.currentTime + 0.5); // Slight intonation drop
      
      // Envelope
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

  // Format timer as MM:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  const isTimeLow = timeLeft <= 30;

  // --- CONNECTED STATE (ULTRA PREMIUM VOICE MODAL) ---
  if (status === 'connected' && isOpen) {
      return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center animate-fade-in-up origin-bottom-right font-sans">
             <div className="w-[24rem] h-[40rem] bg-[#050505] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative flex flex-col border border-white/5 ring-1 ring-white/5">
                
                {/* Background FX */}
                <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none z-0"></div>
                <div className={`absolute top-0 inset-x-0 h-96 bg-gradient-to-b opacity-20 pointer-events-none blur-3xl ${selectedPersona.gender === 'Male' ? 'from-green-900 via-emerald-900' : 'from-yellow-900 via-orange-900'} to-transparent`}></div>

                {/* HUD Header */}
                <div className="w-full pt-8 px-8 flex justify-between items-start z-20">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50">Live Uplink</span>
                        </div>
                         <div className={`flex items-center gap-2 ${isTimeLow ? 'text-red-500 animate-pulse' : 'text-white/80'}`}>
                            <Clock size={12} strokeWidth={2} />
                            <span className="text-sm font-mono font-medium tracking-wide">{formattedTime}</span>
                        </div>
                    </div>
                    <button 
                        onClick={toggleWidget} 
                        className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition backdrop-blur-md border border-white/5"
                    >
                        <X size={18} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Main Visual Content */}
                <div className="flex-1 flex flex-col items-center justify-center relative z-10 -mt-10">
                    
                    {/* Integrated Visualizer & Avatar */}
                    <div className="relative w-80 h-80 flex items-center justify-center">
                        {/* The Visualizer Ring - Removed Scale for sharp lines */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-100 pointer-events-none">
                            <AudioVisualizer 
                                isActive={!isMicMuted} 
                                volume={volume} 
                                mode="circle"
                                color={selectedPersona.gender === 'Male' ? '#10b981' : '#f59e0b'} 
                            />
                        </div>
                        
                        {/* The Avatar */}
                        <div 
                            className="relative z-10 w-28 h-28 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 shadow-2xl flex items-center justify-center p-1 transition-transform duration-75 ease-out"
                            style={{ 
                                transform: `scale(${1 + (volume * 0.15)})`
                            }}
                        >
                             <div className="w-full h-full rounded-full bg-gradient-to-b from-white/5 to-black flex items-center justify-center relative overflow-hidden">
                                 <div className={`absolute inset-0 opacity-20 ${selectedPersona.gender === 'Male' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                 {getPersonaIcon(selectedPersona.icon, 48, selectedPersona.gender === 'Male' ? "text-emerald-200" : "text-amber-200")}
                             </div>
                        </div>
                    </div>

                    {/* Persona Info */}
                    <div className="text-center space-y-2 z-20">
                        <h3 className="text-3xl font-bold text-white tracking-tight drop-shadow-2xl">{selectedPersona.name}</h3>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-sm">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">{selectedPersona.role}</span>
                        </div>
                        
                        <div className="mt-4 flex items-center justify-center gap-2">
                             <span className="w-1 h-1 rounded-full bg-white/30"></span>
                             <p className="text-xs text-white/40 tracking-wide">
                                Detect: <span className="text-white font-medium">{detectedLanguage}</span>
                            </p>
                             <span className="w-1 h-1 rounded-full bg-white/30"></span>
                        </div>
                    </div>
                </div>

                {/* Glass Control Bar */}
                <div className="w-full p-6 z-30 pb-10">
                     <div className="w-full p-2.5 rounded-[2rem] glass-dark flex items-center justify-between shadow-2xl relative overflow-hidden group">
                         {/* Ambient Glow */}
                         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none"></div>

                         <button 
                            onClick={toggleMic}
                            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 ${
                                isMicMuted 
                                ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500/30' 
                                : 'hover:bg-white/10 text-white/60 hover:text-white'
                            }`}
                         >
                             {isMicMuted ? <MicOff size={24} strokeWidth={1.5} /> : <Mic size={24} strokeWidth={1.5} />}
                         </button>

                         <button 
                            onClick={disconnect}
                            className="flex-1 mx-3 h-16 rounded-[1.8rem] bg-[#E11D48] hover:bg-[#be123c] text-white font-bold tracking-wide text-sm flex items-center justify-center shadow-[0_8px_20px_rgba(225,29,72,0.3)] hover:shadow-[0_8px_25px_rgba(225,29,72,0.5)] transition-all active:scale-[0.98]"
                         >
                             <span className="flex items-center gap-2">
                                <LogOut size={18} strokeWidth={2} />
                                END SESSION
                             </span>
                         </button>

                         <button 
                            onClick={toggleMute}
                            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 ${
                                isMuted 
                                ? 'bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500/30' 
                                : 'hover:bg-white/10 text-white/60 hover:text-white'
                            }`}
                         >
                             {isMuted ? <VolumeX size={24} strokeWidth={1.5} /> : <Volume2 size={24} strokeWidth={1.5} />}
                         </button>
                     </div>
                </div>
             </div>
        </div>
      );
  }

  // --- STANDARD SELECTION STATE (PREMIUM DOSSIER) ---
  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {isOpen && status !== 'connected' && (
        <div className="mb-6 w-[24rem] bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,1,0.3,1)] transform origin-bottom-right max-h-[80vh]">
          
          {/* Header */}
          <div className="relative bg-[#050505] p-6 pb-8 shrink-0">
             {/* Gradient Accent */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"></div>
             
             {/* Background Pattern */}
             <div className="absolute inset-0 bg-noise opacity-10"></div>
            
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400">System Online</span>
                    </div>
                    <h3 className="font-bold text-white text-xl tracking-tight leading-none">Choose Your Agent</h3>
                    <p className="text-xs text-gray-500 mt-2 font-medium">Specialized AI personas for every context.</p>
                </div>
                <button onClick={toggleWidget} className="hover:bg-white/10 p-2 rounded-full transition text-gray-500 hover:text-white">
                  <X size={20} strokeWidth={1.5} />
                </button>
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto bg-gray-50/80 custom-scrollbar p-3 -mt-4 rounded-t-[1.5rem] relative z-20">
                
                {status === 'connecting' && (
                     <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="relative w-16 h-16">
                            <div className="absolute inset-0 rounded-full border-[3px] border-gray-100"></div>
                            <div className="absolute inset-0 rounded-full border-[3px] border-t-black animate-spin"></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 tracking-wide animate-pulse">Establishing Uplink...</span>
                     </div>
                )}

                {status === 'error' && (
                    <div className="m-2 p-6 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center text-center">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-3">
                            <LogOut size={18} className="text-red-500" />
                        </div>
                        <p className="text-sm text-red-900 font-bold mb-1">Connection Failed</p>
                        <p className="text-xs text-red-600 mb-4 px-4">{error || "The server could not be reached."}</p>
                        <button onClick={() => connect()} className="text-xs font-bold px-6 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition shadow-lg shadow-red-200">Try Again</button>
                    </div>
                )}

                {status !== 'connecting' && (
                    <div className="space-y-3 pb-20">
                        {PERSONAS.map(persona => {
                            const isSelected = selectedPersonaId === persona.id;
                            const isPlaying = playingPreview === persona.id;

                            return (
                            <button
                                key={persona.id}
                                onClick={() => handlePersonaSelect(persona.id)}
                                className={`w-full group relative p-4 rounded-[1.5rem] text-left transition-all duration-300 border-2
                                    ${isSelected 
                                        ? 'bg-white border-black shadow-xl scale-[1.02] z-10' 
                                        : 'bg-white border-transparent hover:border-gray-200 hover:shadow-lg scale-100'
                                    }
                                `}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon Box */}
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500
                                        ${isSelected 
                                            ? 'bg-black text-white shadow-lg' 
                                            : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100 group-hover:text-gray-900'
                                        }
                                    `}>
                                        {getPersonaIcon(persona.icon, 24)}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className={`font-bold text-base leading-none mb-1 ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                                                    {persona.name}
                                                </h4>
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">{persona.role}</span>
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black text-white font-bold">{persona.vibe}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Action Button (Check or Preview) */}
                                            {isSelected ? (
                                                <div className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center shadow-lg transform transition-transform animate-in zoom-in">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <div 
                                                    role="button"
                                                    onClick={(e) => playPreview(persona.id, persona.gender, e)}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                                                        ${isPlaying ? 'bg-green-100 text-green-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-900'}
                                                    `}
                                                >
                                                    {isPlaying ? <BarChart2 size={14} className="animate-pulse" /> : <Play size={14} fill="currentColor" />}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <p className="text-xs text-gray-500 leading-relaxed mt-2 line-clamp-2">{persona.description}</p>
                                        
                                        {/* Tags */}
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {persona.capabilities.slice(0, 3).map((cap, idx) => (
                                                <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded font-medium border border-gray-100 text-gray-400 bg-white">
                                                    {cap}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )})}
                    </div>
                )}
          </div>

          {/* Connect Button Footer */}
          {status !== 'connecting' && (
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-white via-white to-transparent z-30 pt-10">
                  <button
                      onClick={connect}
                      className="w-full py-4 rounded-2xl font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.2)] bg-black hover:bg-gray-900 transition-all transform hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center gap-3 group overflow-hidden relative"
                  >
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                      <Mic size={20} className="text-white/80" />
                      <span className="text-base tracking-wide">INITIALIZE SESSION</span>
                      <ChevronRight size={18} className="opacity-50 group-hover:translate-x-1 transition-transform" />
                  </button>
              </div>
          )}
        </div>
      )}

      {/* Floating Action Button (Closed State) */}
      {!isOpen && (
        <div className="relative group">
            <div className="absolute right-full mr-6 top-1/2 -translate-y-1/2 bg-black text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xl flex items-center whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                Start Live Demo
            </div>

            <button
                onClick={toggleWidget}
                className="w-16 h-16 bg-black text-white rounded-[1.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.3)] flex items-center justify-center hover:bg-gray-900 transition-all transform hover:scale-105 active:scale-95 group relative overflow-hidden ring-4 ring-white"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                {/* Icon Animation */}
                <div className="relative">
                     <MessageCircle size={30} strokeWidth={1.5} className="transition-transform group-hover:-translate-y-1" />
                     <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                
                {/* Notification Dot */}
                <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black animate-pulse"></div>
            </button>
        </div>
      )}
    </div>
  );
};
