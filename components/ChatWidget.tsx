
import React, { useState } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { PERSONAS } from '../constants';
import AudioVisualizer from './AudioVisualizer';
import { 
  MessageCircle, X, Mic, MicOff, Volume2, VolumeX, Check, LogOut, 
  Briefcase, Zap, Scroll, Target, Sun, Sparkles, User, ChevronRight, Activity, Clock, Play
} from 'lucide-react';

// Helper to map string keys to Lucide Components
const getPersonaIcon = (iconKey: string, size: number = 24, className: string = "") => {
  const props = { size, className };
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
  
  const isTimeLow = timeLeft <= 10;

  // --- CONNECTED STATE (SOPHISTICATED VOICE MODAL) ---
  if (status === 'connected' && isOpen) {
      return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center animate-fade-in-up origin-bottom-right font-sans">
             <div className="w-[22rem] h-[36rem] bg-[#09090b] rounded-[2.5rem] shadow-2xl overflow-hidden relative flex flex-col border border-white/10 ring-1 ring-black/50">
                
                {/* SA Flag Gradient Line */}
                <div className="absolute top-0 w-full h-1.5 z-30 flex">
                    <div className="h-full w-1/4 bg-[#E03C31]"></div>
                    <div className="h-full w-1/4 bg-[#FFB612]"></div>
                    <div className="h-full w-1/4 bg-[#007749]"></div>
                    <div className="h-full w-1/4 bg-[#001489]"></div>
                </div>

                {/* Subtle Pattern Background */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
                     style={{
                         backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
                         backgroundSize: '20px 20px'
                     }}>
                </div>
                <div className={`absolute top-0 inset-x-0 h-80 bg-gradient-to-b opacity-20 pointer-events-none ${selectedPersona.gender === 'Male' ? 'from-green-900' : 'from-yellow-900'} to-transparent`}></div>

                {/* Header */}
                <div className="w-full pt-8 px-6 flex justify-between items-start z-20">
                    <div>
                        <div className="flex items-center space-x-2 mb-1">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
                            <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Live Uplink</span>
                        </div>
                        {/* Countdown Timer Display */}
                         <div className={`flex items-center space-x-1.5 mt-1 ${isTimeLow ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>
                            <Clock size={10} />
                            <span className="text-xs font-mono font-bold">{formattedTime}</span>
                        </div>
                    </div>
                    <button 
                        onClick={toggleWidget} 
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition backdrop-blur-md"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Main Visual Content */}
                <div className="flex-1 flex flex-col items-center justify-center relative z-10 -mt-6">
                    
                    {/* Integrated Visualizer & Avatar */}
                    <div className="relative w-64 h-64 flex items-center justify-center">
                        {/* The Visualizer Ring */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-60 scale-125 pointer-events-none">
                            <AudioVisualizer 
                                isActive={!isMicMuted} 
                                volume={volume} 
                                mode="circle"
                                color={selectedPersona.gender === 'Male' ? '#22c55e' : '#eab308'} 
                            />
                        </div>
                        
                        {/* The Avatar - Pulses/Vibrates with volume */}
                        <div 
                            className="relative z-10 w-32 h-32 rounded-full bg-gradient-to-br from-gray-800 to-gray-950 border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] flex items-center justify-center p-1 transition-transform duration-75 ease-out"
                            style={{ 
                                transform: `scale(${1 + (volume * 0.4)})` // Vibration Effect
                            }}
                        >
                             <div className="w-full h-full rounded-full bg-[#0c0c0c] flex items-center justify-center overflow-hidden relative">
                                 {/* Inner Glow */}
                                 <div className={`absolute inset-0 opacity-20 ${selectedPersona.gender === 'Male' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                 {getPersonaIcon(selectedPersona.icon, 52, selectedPersona.gender === 'Male' ? "text-green-400" : "text-yellow-400")}
                             </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="text-center mt-2 space-y-1 z-20">
                        <h3 className="text-3xl font-bold text-white tracking-tight drop-shadow-lg">{selectedPersona.name}</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{selectedPersona.role}</p>
                        
                        <div className="mt-4 inline-flex items-center px-4 py-1.5 rounded-full bg-white/5 border border-white/5 backdrop-blur-md shadow-lg">
                            <Activity size={12} className={`mr-2 ${selectedPersona.gender === 'Male' ? 'text-green-500' : 'text-yellow-500'}`} />
                            <p className="text-xs text-gray-300">
                                Language: <span className="text-white font-semibold">{detectedLanguage}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="w-full p-6 z-20 pb-8">
                     <div className="w-full p-2 rounded-[2rem] bg-white/5 border border-white/5 backdrop-blur-xl flex items-center justify-between shadow-2xl relative overflow-hidden">
                         {/* Shine effect */}
                         <div className="absolute top-0 left-0 w-full h-1/2 bg-white/5 pointer-events-none"></div>

                         <button 
                            onClick={toggleMic}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 ${
                                isMicMuted 
                                ? 'bg-red-500/20 text-red-500 ring-1 ring-red-500/50' 
                                : 'hover:bg-white/10 text-gray-400 hover:text-white'
                            }`}
                         >
                             {isMicMuted ? <MicOff size={22} /> : <Mic size={22} />}
                         </button>

                         <button 
                            onClick={disconnect}
                            className="flex-1 mx-3 h-14 rounded-[1.6rem] bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold tracking-wide text-sm flex items-center justify-center shadow-lg shadow-red-900/40 transition-all active:scale-[0.98] group relative overflow-hidden"
                         >
                             <span className="relative z-10 flex items-center">
                                <LogOut size={18} className="mr-2" />
                                End Session
                             </span>
                         </button>

                         <button 
                            onClick={toggleMute}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 ${
                                isMuted 
                                ? 'bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500/50' 
                                : 'hover:bg-white/10 text-gray-400 hover:text-white'
                            }`}
                         >
                             {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                         </button>
                     </div>
                </div>

             </div>
        </div>
      );
  }

  // --- STANDARD SELECTION STATE ---
  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {isOpen && status !== 'connected' && (
        <div className="mb-4 w-[22rem] sm:w-[26rem] bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col transition-all duration-300 ease-in-out transform origin-bottom-right max-h-[85vh]">
          
          <div className="relative bg-gray-900 p-6 flex justify-between items-start shrink-0">
             {/* SA Flag Gradient Line */}
             <div className="absolute top-0 left-0 w-full h-1 flex">
                <div className="h-full w-1/4 bg-[#E03C31]"></div>
                <div className="h-full w-1/4 bg-[#FFB612]"></div>
                <div className="h-full w-1/4 bg-[#007749]"></div>
                <div className="h-full w-1/4 bg-[#001489]"></div>
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center space-x-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <h3 className="font-bold text-white text-lg tracking-tight">VCB-AI Neural Link</h3>
                </div>
                <p className="text-xs text-gray-400 font-medium">Select a specialist for your needs</p>
            </div>
            
            <button onClick={toggleWidget} className="hover:bg-white/10 p-2 rounded-full transition text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50/50 custom-scrollbar p-4">
                
                {status === 'connecting' && (
                     <div className="flex flex-col items-center justify-center py-12">
                        <div className="relative w-12 h-12 mb-4">
                            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-t-yellow-500 animate-spin"></div>
                        </div>
                        <span className="text-sm font-bold text-gray-700">Establishing Uplink...</span>
                     </div>
                )}

                {status === 'error' && (
                    <div className="mb-4 p-4 bg-red-50 rounded-2xl border border-red-100 flex flex-col items-center text-center">
                        <p className="text-sm text-red-600 font-medium mb-2">{error || "Connection failed."}</p>
                        <button onClick={() => connect()} className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition">Retry Connection</button>
                    </div>
                )}

                {status !== 'connecting' && (
                    <div className="space-y-4">
                        {PERSONAS.map(persona => (
                            <button
                                key={persona.id}
                                onClick={() => handlePersonaSelect(persona.id)}
                                className={`w-full group relative p-5 rounded-3xl border text-left transition-all duration-300 flex flex-col space-y-3
                                    ${selectedPersonaId === persona.id 
                                        ? 'bg-white border-yellow-400 shadow-xl shadow-yellow-100 ring-1 ring-yellow-400/20' 
                                        : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-lg'
                                    }
                                `}
                            >
                                <div className="flex items-start space-x-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300
                                        ${selectedPersonaId === persona.id 
                                            ? 'bg-yellow-50 text-yellow-600 scale-105' 
                                            : 'bg-gray-50 text-gray-500 group-hover:bg-gray-100 group-hover:text-gray-900'
                                        }
                                    `}>
                                        {getPersonaIcon(persona.icon, 28)}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className={`font-bold text-base ${selectedPersonaId === persona.id ? 'text-gray-900' : 'text-gray-700'}`}>
                                                {persona.name}
                                            </span>
                                            {selectedPersonaId === persona.id ? (
                                                <div className="bg-yellow-100 text-yellow-700 p-1 rounded-full">
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                // Preview Button
                                                <div 
                                                    role="button"
                                                    onClick={(e) => playPreview(persona.id, persona.gender, e)}
                                                    className="p-1.5 rounded-full bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                    title="Hear Voice Preview"
                                                >
                                                    {playingPreview === persona.id ? <Activity size={14} className="animate-pulse" /> : <Play size={14} fill="currentColor" />}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-2">{persona.role}</div>
                                        
                                        {/* Voice Description Badge */}
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                                                <Volume2 size={10} className="mr-1" />
                                                {persona.voiceDescription}
                                            </span>
                                        </div>

                                        <p className="text-xs text-gray-500 leading-relaxed mb-3">{persona.description}</p>
                                    </div>
                                </div>

                                {/* Capabilities Tags */}
                                <div className="flex flex-wrap gap-1.5 pl-[4.5rem]">
                                    {persona.capabilities.map((cap, idx) => (
                                        <span key={idx} className={`text-[10px] px-2 py-1 rounded-md font-medium border
                                             ${selectedPersonaId === persona.id
                                                ? 'bg-yellow-50 border-yellow-100 text-yellow-700'
                                                : 'bg-gray-50 border-gray-100 text-gray-500'
                                             }
                                        `}>
                                            {cap}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
          </div>

          {status !== 'connecting' && (
              <div className="p-5 bg-white border-t border-gray-100">
                  <button
                      onClick={connect}
                      className="w-full py-4 rounded-2xl font-bold text-white shadow-xl shadow-green-900/10 bg-[#09090b] hover:bg-black transition-all transform active:scale-[0.98] flex items-center justify-center space-x-3 group relative overflow-hidden"
                  >
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      <div className="p-1.5 bg-white/20 rounded-full">
                        <Mic size={18} className="text-white" />
                      </div>
                      <span className="text-lg">Start Session</span>
                      <ChevronRight size={18} className="opacity-50 group-hover:translate-x-1 transition-transform" />
                  </button>
              </div>
          )}
        </div>
      )}

      {!isOpen && (
        <div className="relative group">
            {/* Live DEMO Label */}
            <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-white text-gray-900 font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg border border-gray-100 flex items-center whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                Live DEMO
                {/* Arrow */}
                <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-white transform rotate-45 border-r border-t border-gray-100"></div>
            </div>

            <button
                onClick={toggleWidget}
                className="w-16 h-16 bg-black text-white rounded-[20px] shadow-2xl flex items-center justify-center hover:bg-gray-900 transition-all transform hover:scale-110 hover:-rotate-3 active:scale-95 group relative overflow-hidden ring-4 ring-white"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-green-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <MessageCircle size={30} strokeWidth={1.5} className="relative z-10 group-hover:scale-110 transition-transform" />
                
                <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse"></div>
            </button>
        </div>
      )}
    </div>
  );
};
