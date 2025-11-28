import React, { useState, useMemo } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { PERSONAS } from '../constants';
import AudioVisualizer from './AudioVisualizer';
import { 
  X, Mic, MicOff, Volume2, VolumeX, LogOut, 
  Briefcase, Zap, Scroll, Target, Sun, Sparkles, User, ChevronRight, Clock, Play, BarChart2,
  Loader2, AlertCircle, RefreshCw, LifeBuoy, Radio, ArrowUpRight, Captions, Signal
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
    case 'life-buoy': return <LifeBuoy {...props} />;
    default: return <User {...props} />;
  }
};

// Helper to parse the stream and show only the active sentence
const getLastSentence = (text: string): string => {
    if (!text) return "";
    // Split by punctuation that ends a sentence (. ? !), keeping the punctuation
    // The lookbehind regex (?<=[.?!]) matches the position right after punctuation
    const sentences = text.split(/(?<=[.?!])\s+/);
    // Return the last segment (which is the one currently being spoken/streamed)
    return sentences[sentences.length - 1];
};

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(PERSONAS[0].id);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const [showCaptions, setShowCaptions] = useState(true);
  const apiKey = process.env.API_KEY;

  const selectedPersona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];

  const { status, connect, disconnect, volume, detectedLanguage, transcript, error, isMuted, toggleMute, isMicMuted, toggleMic, timeLeft } = useGeminiLive({
    apiKey,
    persona: selectedPersona,
  });

  // Calculate the current subtitle to display
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
  if ((status === 'connected' || status === 'connecting') && isOpen) {
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
                            {status === 'connecting' ? (
                                <div className="flex items-center gap-2 text-yellow-400">
                                    <Loader2 size={12} className="animate-spin" />
                                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase">CONNECTING...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50">Live Uplink</span>
                                </div>
                            )}
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
                        {/* The Visualizer Ring */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-100 pointer-events-none">
                            <AudioVisualizer 
                                isActive={!isMicMuted && status === 'connected'} 
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

                    {/* CINEMATIC CAPTIONS */}
                    <div className="absolute bottom-4 left-0 right-0 px-6 z-40 flex flex-col items-center text-center">
                        {!activeSubtitle || !showCaptions ? (
                            <div className="space-y-2 animate-fade-in">
                                <h3 className="text-3xl font-bold text-white tracking-tight drop-shadow-2xl">{selectedPersona.name}</h3>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-sm">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">{selectedPersona.role}</span>
                                </div>
                                <div className="mt-4 flex items-center justify-center gap-2">
                                     <span className="w-1 h-1 rounded-full bg-white/30"></span>
                                     <p className="text-xs text-white/40 tracking-wide">
                                        Language: <span className="text-white font-medium">{detectedLanguage}</span>
                                    </p>
                                     <span className="w-1 h-1 rounded-full bg-white/30"></span>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-fade-up w-full">
                                <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-2xl">
                                    <p className="text-lg md:text-xl font-medium text-white/95 leading-relaxed tracking-wide drop-shadow-lg font-sans">
                                        {activeSubtitle}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Glass Control Bar */}
                <div className="w-full p-6 z-30 pb-10">
                     <div className="w-full p-2.5 rounded-[2rem] glass-dark flex items-center justify-between shadow-2xl relative overflow-hidden group">
                         {/* Ambient Glow */}
                         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none"></div>

                         {/* Mic Toggle */}
                         <button 
                            onClick={toggleMic}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 ${
                                isMicMuted 
                                ? 'bg-red-500/10 text-red-500 ring-1 ring-red-500/30' 
                                : 'hover:bg-white/10 text-white/60 hover:text-white'
                            }`}
                         >
                             {isMicMuted ? <MicOff size={22} strokeWidth={1.5} /> : <Mic size={22} strokeWidth={1.5} />}
                         </button>

                         {/* End Session */}
                         <button 
                            onClick={() => disconnect()}
                            className="flex-1 mx-2 h-14 rounded-[1.5rem] bg-[#E11D48] hover:bg-[#be123c] text-white font-bold tracking-wide text-sm flex items-center justify-center shadow-[0_8px_20px_rgba(225,29,72,0.3)] hover:shadow-[0_8px_25px_rgba(225,29,72,0.5)] transition-all active:scale-[0.98]"
                         >
                             <span className="flex items-center gap-2">
                                <LogOut size={18} strokeWidth={2} />
                                END
                             </span>
                         </button>

                         {/* Caption Toggle */}
                         <button 
                            onClick={() => setShowCaptions(!showCaptions)}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 ${
                                showCaptions
                                ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30' 
                                : 'hover:bg-white/10 text-white/60 hover:text-white'
                            }`}
                         >
                             <Captions size={22} strokeWidth={1.5} />
                         </button>

                         {/* Mute Toggle */}
                         <button 
                            onClick={toggleMute}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 ${
                                isMuted 
                                ? 'bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500/30' 
                                : 'hover:bg-white/10 text-white/60 hover:text-white'
                            }`}
                         >
                             {isMuted ? <VolumeX size={22} strokeWidth={1.5} /> : <Volume2 size={22} strokeWidth={1.5} />}
                         </button>
                     </div>
                </div>
             </div>
        </div>
      );
  }

  // --- SELECTION STATE (LAUNCHPAD MODAL) ---
  return (
    <div className="font-sans">
      {/* Backdrop */}
      {isOpen && status !== 'connected' && status !== 'connecting' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 animate-fade-in transition-opacity duration-300" onClick={toggleWidget}></div>
      )}

      {isOpen && status !== 'connected' && status !== 'connecting' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
          {/* Main Modal Container */}
          <div className="pointer-events-auto bg-white w-full max-w-6xl h-[90vh] sm:h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-300 border border-white/20 ring-1 ring-black/5">
            
            {/* Header */}
            <div className="bg-[#080808] p-5 shrink-0 relative overflow-hidden">
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-b from-purple-500/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-t from-emerald-500/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-bold tracking-[0.2em] uppercase text-emerald-400">
                                Bua X1 Prototype Launcher
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">Select Neural Personality</h2>
                        <p className="text-gray-400 max-w-lg text-sm leading-relaxed">
                            Deploy a specialized agent from the grid below. Each model is fine-tuned for specific South African contexts and languages.
                        </p>
                    </div>
                    <button 
                        onClick={toggleWidget}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all backdrop-blur-sm border border-white/5 group"
                    >
                        <X size={24} className="group-hover:rotate-90 transition-transform duration-300" strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            {/* Error Overlay */}
            {status === 'error' && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur flex items-center justify-center p-8">
                     <div className="max-w-md text-center">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
                            <AlertCircle size={40} className="text-red-500" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Connection Failed</h3>
                        <p className="text-gray-500 mb-8">{error || "The neural link could not be established. Please check your connection and try again."}</p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={() => connect()} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition flex items-center gap-2">
                                <RefreshCw size={18} /> Retry Connection
                            </button>
                            <button onClick={() => { disconnect(); setIsOpen(false); }} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">
                                Close
                            </button>
                        </div>
                     </div>
                </div>
            )}

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 p-4 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-24">
                    {PERSONAS.map(persona => {
                        const isSelected = selectedPersonaId === persona.id;
                        const isPlaying = playingPreview === persona.id;

                        return (
                            <button
                                key={persona.id}
                                onClick={() => handlePersonaSelect(persona.id)}
                                className={`group relative flex flex-col text-left p-6 rounded-[2rem] border transition-all duration-300 h-full
                                    ${isSelected 
                                        ? 'bg-white border-black shadow-2xl scale-[1.02] ring-1 ring-black/5 z-10' 
                                        : 'bg-white border-gray-100 shadow-sm hover:shadow-xl hover:border-gray-200 hover:-translate-y-1'
                                    }
                                `}
                            >
                                {/* Header: Icon + Status */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300
                                        ${isSelected ? 'bg-black text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100 group-hover:text-gray-900'}
                                    `}>
                                        {getPersonaIcon(persona.icon, 28)}
                                    </div>
                                    
                                    {isSelected ? (
                                        <div className="px-3 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-2 animate-in zoom-in">
                                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                                            Selected
                                        </div>
                                    ) : (
                                        <div 
                                            role="button"
                                            onClick={(e) => playPreview(persona.id, persona.gender, e)}
                                            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all hover:scale-110
                                                ${isPlaying 
                                                    ? 'border-green-500 bg-green-50 text-green-600' 
                                                    : 'border-gray-100 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-900'
                                                }
                                            `}
                                        >
                                            {isPlaying ? <BarChart2 size={18} className="animate-pulse" /> : <Play size={18} fill="currentColor" />}
                                        </div>
                                    )}
                                </div>

                                {/* Details */}
                                <div className="flex-1">
                                    <h3 className={`text-xl font-bold mb-2 ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>{persona.name}</h3>
                                    
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wide border border-gray-200">
                                            {persona.role}
                                        </span>
                                        <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wide border border-gray-200">
                                            {persona.vibe}
                                        </span>
                                    </div>
                                    
                                    <p className="text-sm text-gray-500 leading-relaxed font-medium">
                                        {persona.description}
                                    </p>
                                </div>

                                {/* Capability Tags (Bottom) */}
                                <div className="mt-6 pt-4 border-t border-gray-50 flex flex-wrap gap-2">
                                    {persona.capabilities.slice(0,3).map((cap, i) => (
                                        <span key={i} className="text-[10px] text-gray-400 font-semibold bg-gray-50 px-2 py-1 rounded">
                                            {cap}
                                        </span>
                                    ))}
                                    {persona.capabilities.length > 3 && (
                                        <span className="text-[10px] text-gray-400 font-semibold bg-gray-50 px-2 py-1 rounded">+{persona.capabilities.length - 3}</span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-white via-white to-transparent pt-20 z-20 pointer-events-none">
                 <div className="max-w-2xl mx-auto pointer-events-auto">
                    <button
                        onClick={connect}
                        className={`w-full py-3.5 rounded-xl font-bold text-white text-base shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all transform flex items-center justify-center gap-3 group relative overflow-hidden bg-black hover:bg-gray-900 hover:-translate-y-1 active:scale-[0.98]`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                        <div className="flex items-center gap-3">
                            <Mic size={24} className="text-emerald-400" />
                            <span>INITIALIZE SESSION WITH {selectedPersona.name.toUpperCase()}</span>
                            <ArrowUpRight size={24} className="text-gray-500 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                        </div>
                    </button>
                 </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (Closed State) - PILL */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
            <button
                onClick={toggleWidget}
                className="pl-5 pr-6 py-3 bg-black text-white rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.35)] flex items-center justify-center hover:bg-gray-900 transition-all transform hover:scale-105 active:scale-95 group relative overflow-hidden ring-1 ring-white/10"
            >
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                
                {/* Content */}
                <div className="flex items-center gap-3 relative z-10">
                    <div className="relative">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-20 animate-ping"></span>
                        <Radio size={20} className="text-green-400 relative z-10" />
                    </div>
                    <div className="flex flex-col items-start leading-none">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Ready to deploy</span>
                        <span className="text-base font-bold text-white tracking-wide">Test Live Prototype</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all ml-1" />
                </div>
            </button>
        </div>
      )}
    </div>
  );
};
