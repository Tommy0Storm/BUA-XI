import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';

// Prevent HMR from remounting this widget and killing sessions
if ((import.meta as any)?.hot) {
    (import.meta as any).hot.accept(() => {});
}

// Helper to sanitize strings for logging and display
const sanitizeString = (str: string): string => {
  return str.replace(/[<>\"']/g, '').substring(0, 100); // Basic sanitization, limit length
};

// Helper: schedule heavier work off the critical rendering path
const scheduleHeavy = (fn: () => void) => {
    setTimeout(() => {
        Promise.resolve().then(() => fn());
    }, 0);
};
import { useGeminiLive } from '../hooks/useGeminiLive';
import { PERSONAS } from '../constants';
import AudioVisualizer from './AudioVisualizer';
import { sendTranscriptEmail } from '../services/emailService';
import { 
  X, Mic, MicOff, LogOut, 
  Briefcase, Zap, Scroll, Target, Sun, Sparkles, User, ChevronRight, Play, BarChart2,
  AlertCircle, LifeBuoy, ArrowUpRight, Captions, CheckCircle2, Scale, Mail, Hand, Video, VideoOff, Globe
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
    case 'scale': return <Scale {...props} />;
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
    disabled?: boolean;
    onMouseDown?: () => void;
    onMouseUp?: () => void;
    onMouseLeave?: () => void;
    className?: string;
}

const ControlBtn: React.FC<ControlBtnProps> = ({
    active,
    onClick,
    icon,
    variant = 'default',
    label,
    disabled = false,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    className = ""
}) => {
    const baseClass = "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 relative group active:scale-95";
    
    let colorClass = "bg-gray-800 text-white hover:bg-gray-700"; 
    
    if (variant === 'danger') {
        colorClass = "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red500/20";
    } else if (variant === 'primary' && active) {
        colorClass = "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20";
    } else if (variant === 'default' && active) {
        colorClass = "bg-white text-black hover:bg-gray-200";
    } else if (variant === 'secondary') {
        colorClass = active ? "bg-white text-black" : "bg-gray-800/50 text-white hover:bg-gray-800";
    }

    if (disabled) {
        colorClass = "bg-gray-600 text-gray-400 cursor-not-allowed opacity-50";
    }

    return (
        <button 
            onClick={onClick} 
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            disabled={disabled}
            title={label}
            className={`${baseClass} ${colorClass} ${className}`}
        >
            {icon}
        </button>
    );
};

// --- MAIN WIDGET COMPONENT ---

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showStage, setShowStage] = useState(false); // Latch state for the stage view
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(PERSONAS[0].id);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const [showCaptions, setShowCaptions] = useState(true);
  const [widgetSize, setWidgetSize] = useState({ width: 720, height: 480 });
  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const [hoveredPersona, setHoveredPersona] = useState<string | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !resizeRef.current) return;
      const rect = resizeRef.current.getBoundingClientRect();
      const newWidth = Math.max(600, e.clientX - rect.left);
      const newHeight = Math.max(500, e.clientY - rect.top);
      setWidgetSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isOpen) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen]);
  
  // Mandatory Email State
  const [userEmail, setUserEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  
  // PTT Local State for Visuals
  const [isPttVisualActive, setIsPttVisualActive] = useState(false);
  // Long press for disconnect - use ref to avoid re-render issues
  const disconnectTimerRef = useRef<number | null>(null);
  const [disconnectHold, setDisconnectHold] = useState(false);
    // Default the normal app to use the native audio model for proper audio output
    const [forcedModel, setForcedModel] = useState<string | null>('gemini-2.5-flash-native-audio-preview-09-2025');

    // Use Vite-provided client env variable; process.env is for Node only
        const apiKey = (import.meta as any).env?.VITE_API_KEY as string | undefined;
        const verboseEnv = (import.meta as any).env?.VITE_VERBOSE_LOGGING === 'true';
        // Enable vision capability - camera only activates when user clicks button
        const enableVisionEnv = (import.meta as any).env?.VITE_ENABLE_VISION !== 'false';

  const selectedPersona = PERSONAS.find(p => p.id === selectedPersonaId) || PERSONAS[0];

  const { status, connect, disconnect, setManualUserAction, inputAnalyserRef, outputAnalyserRef, detectedLanguage, transcript, error, isMuted, toggleMute, isMicMuted, toggleMic, timeLeft, transcriptSent, isPttMode, setPttMode, setPttActive, isVideoActive, toggleVideo, startScreenShare, videoRef, audioDevices, selectedAudioDeviceId, setSelectedAudioDeviceId } = useGeminiLive({
    apiKey,
    persona: selectedPersona,
    userEmail: userEmail,
        verboseLogging: verboseEnv,
      enableVision: enableVisionEnv,
      forcedModel: forcedModel
  });

  const activeSubtitle = useMemo(() => getLastSentence(transcript), [transcript]);

  // Effect to manage the "Stage Latch"
  useEffect(() => {
    if (status === 'connected' || status === 'connecting') {
        setShowStage(true);
    } else if (!isOpen) {
        // Only reset stage when widget fully closes
        const t = setTimeout(() => setShowStage(false), 500);
        return () => clearTimeout(t);
    }
  }, [status, isOpen]);

  // Validate Email
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsEmailValid(emailRegex.test(userEmail));
  }, [userEmail]);
  
  // Keyboard PTT Listener
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (status === 'connected' && isPttMode && e.code === 'Space' && !e.repeat) {
              setPttActive(true);
              setIsPttVisualActive(true);
          }
      };
      
      const handleKeyUp = (e: KeyboardEvent) => {
          if (status === 'connected' && isPttMode && e.code === 'Space') {
              setPttActive(false);
              setIsPttVisualActive(false);
          }
      };
      
      if (isOpen && status === 'connected') {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
      }
      
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      }
  }, [isOpen, status, isPttMode, setPttActive]);

  // Transcript Recovery Check
  useEffect(() => {
      try {
          const backup = localStorage.getItem('bua_transcript_backup');
          if (backup) {
              const data = JSON.parse(backup);
              const age = Date.now() - data.timestamp;
              // If backup is less than 24 hours old, prompt
              if (age < 86400000) {
                  console.log("Found transcript backup");
              } else {
                  localStorage.removeItem('bua_transcript_backup');
              }
          }
      } catch (e) {
          console.error('Error checking transcript backup:', e);
      }
  }, []);
  
  const handleRecoverSession = async () => {
      try {
          const backup = localStorage.getItem('bua_transcript_backup');
          if (backup && isEmailValid) {
              const data = JSON.parse(backup);
              await sendTranscriptEmail(
                  data.history,
                  0, // Unknown duration
                  selectedPersona,
                  "RECOVERED-SESSION",
                  userEmail
              );
              localStorage.removeItem('bua_transcript_backup');
              alert("Transcript recovered and emailed successfully.");
          }
      } catch (e) {
          console.error('Error recovering session:', e);
          alert("Failed to recover session.");
      }
  };

  // Handle Smooth Closing and Auto-Scroll to Console
  const handleDisconnect = useCallback((force = false) => {
    // Log the call stack to identify what's triggering disconnects (sanitized)
    console.error('[DISCONNECT TRACE]', sanitizeString(new Error().stack || ''));
    console.log('[DISCONNECT] Force:', force, 'Status:', status);
    
    // mark manual action if user pressed the UI button
    if (force) setManualUserAction(true);
    disconnect(undefined, force);
    
    // 1. Start Close Animation
    setIsClosing(true);
    
    // 2. Wait for animation, then hide widget and scroll
    setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
        setManualUserAction(false); // Reset flag
        
        // 3. Scroll to Console to show email logs
        const consoleSection = document.getElementById('console-section');
        if (consoleSection) {
            consoleSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 500);
  }, [disconnect, setManualUserAction, status]);

  const toggleWidget = () => {
    if (isOpen) {
      if (status === 'connected') {
          handleDisconnect(true); // Force disconnect when user closes
      } else {
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 300);
      }
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

  const animationClass = isClosing ? "opacity-0 scale-95 translate-y-4" : "opacity-100 scale-100 translate-y-0";

  // --- VIEW: CONNECTED (VOICE STAGE) ---
  // Show stage if we are connected OR if we are latched (during closing animation)
  if ((status === 'connected' || status === 'connecting' || showStage) && isOpen) {
      return (
        <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-center origin-bottom-right font-sans transition-all duration-300 ease-in-out ${animationClass}`}>
             
             {/* Main Container - The "Stage" */}
             <div className="w-[16.8rem] h-[26.6rem] bg-[#09090b] rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden relative flex flex-col border border-white/10 ring-1 ring-black/50">
                
                {/* VIDEO ELEMENT BACKGROUND */}
                <video 
                    ref={videoRef}
                    autoPlay 
                    muted 
                    playsInline 
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isVideoActive ? 'opacity-100' : 'opacity-0'}`}
                    style={{ transform: 'scaleX(-1)' }} // Mirror effect
                />

                {/* Overlay Gradient for Video Readability */}
                <div className={`absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none transition-opacity duration-500 ${isVideoActive ? 'opacity-100' : 'opacity-0'}`}></div>

                {/* 1. Voice Header */}
                <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center">
                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 shadow-sm pointer-events-none">
                        <div className={`w-2 h-2 rounded-full ${status === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
                        <span className={`text-xs font-mono font-medium tracking-wide ${isTimeLow ? 'text-red-400' : 'text-gray-300'}`}>
                            {status === 'connecting' ? 'CONNECTING...' : formattedTime}
                        </span>
                    </div>
                    
                    <button 
                        onClick={() => handleDisconnect(true)}
                        className="p-2 text-white/60 hover:text-white rounded-full hover:bg-white/10 transition-all active:scale-95"
                        title="End Call"
                    >
                        <X size={20} strokeWidth={1.5} />
                    </button>
                </div>

                {/* 2. The Visualizer Stage */}
                <div className="flex-1 flex flex-col items-center justify-center relative select-none">
                     {/* Ambient Glow (Only show if video is OFF) */}
                     {!isVideoActive && (
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none transition-colors duration-1000 ${isPttVisualActive ? 'bg-cyan-500 opacity-40' : (selectedPersona.gender === 'Male' ? 'bg-emerald-600' : 'bg-amber-600')}`}></div>
                     )}
                     
                     {/* PTT Status Overlay */}
                     {isPttMode && (
                        <div className={`absolute top-24 z-20 transition-all duration-200 ${isPttVisualActive ? 'scale-110 opacity-100' : 'scale-100 opacity-50'}`}>
                            <div className={`px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase border ${isPttVisualActive ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]' : 'bg-black/50 text-cyan-500 border-cyan-500/50'}`}>
                                {isPttVisualActive ? 'TRANSMITTING' : 'HOLD SPACEBAR'}
                            </div>
                        </div>
                     )}

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
                         
                         {/* Persona Avatar (Hidden in Video Mode for HUD effect) */}
                         <div className={`relative z-10 w-24 h-24 rounded-full bg-[#18181b] flex items-center justify-center shadow-2xl border transition-all duration-300 ${isVideoActive ? 'opacity-0 scale-50' : 'opacity-100 scale-100'} ${isPttVisualActive ? 'border-cyan-500' : 'border-white/10'}`}>
                              {getPersonaIcon(selectedPersona.icon, 40, selectedPersona.gender === 'Male' ? "text-emerald-400" : "text-amber-400")}
                         </div>
                     </div>

                     {/* Cinematic Transcript Overlay */}
                     <div className="absolute bottom-32 left-0 right-0 px-8 min-h-[4rem] flex flex-col items-center justify-end z-10">
                        {!activeSubtitle || !showCaptions ? (
                            <div className="text-center space-y-1 animate-fade-in opacity-50">
                                <h3 className="text-xl font-semibold text-white tracking-tight">{selectedPersona.name}</h3>
                                <p className="text-xs text-white/40 uppercase tracking-widest font-medium">{selectedPersona.role}</p>
                            </div>
                        ) : (
                            <div className="w-full text-center animate-fade-up">
                                <p className="text-lg font-medium text-white/90 leading-snug drop-shadow-md bg-black/40 backdrop-blur-sm p-3 rounded-xl border border-white/5 inline-block">
                                    "{sanitizeString(activeSubtitle)}"
                                </p>
                            </div>
                        )}
                     </div>
                </div>

                {/* 3. Voice Control Bar */}
                <div className="fixed bottom-8 inset-x-0 flex justify-center z-30">
                     <div className="flex items-center gap-2 px-3 py-2 bg-[#18181b] border border-white/10 rounded-full shadow-2xl">
                         
                         <ControlBtn 
                            active={!isMicMuted}
                            onClick={toggleMic}
                            variant={!isMicMuted ? 'primary' : 'secondary'}
                            icon={isMicMuted ? <MicOff size={16} className="text-red-400" /> : <Mic size={16} />}
                            label={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                         />

                         <ControlBtn 
                            active={isVideoActive}
                            onClick={() => toggleVideo(false)}
                            variant={isVideoActive ? 'primary' : 'secondary'}
                            icon={isVideoActive ? <Video size={16} /> : <VideoOff size={16} className="text-gray-400" />}
                            label={isVideoActive ? "Turn Camera Off" : "Turn Camera On"}
                         />

                         <ControlBtn 
                            active={false}
                            onClick={startScreenShare}
                            variant={'secondary'}
                            icon={<ArrowUpRight size={16} className="text-gray-400" />}
                            label="Share Screen"
                         />
                         
                         <ControlBtn 
                            active={isPttMode}
                            onClick={() => setPttMode(!isPttMode)}
                            variant={isPttMode ? 'primary' : 'secondary'}
                            icon={<Hand size={16} className={isPttMode ? "text-white" : "text-gray-400"} />}
                            label="Toggle Push-to-Talk Mode"
                         />

                         <ControlBtn 
                            active={showCaptions}
                            onClick={() => setShowCaptions(!showCaptions)}
                            variant={showCaptions ? 'default' : 'secondary'}
                            icon={<Captions size={16} className={showCaptions ? "" : "opacity-40"} />}
                            label="Toggle Captions"
                         />

                         <div className="w-px h-6 bg-white/10 mx-1"></div>

                         {status === 'connected' && (
                            <ControlBtn 
                                active={false}
                                onClick={() => handleDisconnect(true)}
                                variant="danger"
                                icon={<LogOut size={16} />}
                                label="End Call"
                            />
                         )}
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
                      <span className="text-sm font-medium">Transcript sent to <span className="text-white font-bold">{sanitizeString(userEmail)}</span></span>
                  </div>
              </div>
          </div>
      )}
      
      {/* Recovery Banner */}
      {localStorage.getItem('bua_transcript_backup') && (
         <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] animate-fade-in w-full max-w-lg px-4">
             <div className="bg-amber-500/10 border border-amber-500/50 backdrop-blur-md text-amber-100 p-4 rounded-xl flex items-center justify-between shadow-2xl">
                 <div className="flex items-center gap-3">
                     <AlertCircle size={20} className="text-amber-500" />
                     <div className="text-sm">
                         <div className="font-bold text-amber-500">System Recovery</div>
                         <div className="text-xs opacity-80">Previous session transcript found.</div>
                     </div>
                 </div>
                 <button 
                    onClick={handleRecoverSession}
                    disabled={!isEmailValid}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${isEmailValid ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                 >
                    Recover & Email
                 </button>
             </div>
         </div>
      )}

      {/* Backdrop */}
      {isOpen && !showStage && (
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`} 
          onClick={toggleWidget}
        ></div>
      )}

      {/* Toast Tooltip */}
      {hoveredPersona && isOpen && !showStage && (() => {
        const persona = PERSONAS.find(p => p.id === hoveredPersona);
        if (!persona) return null;
        return (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-in pointer-events-none">
            <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 max-w-sm">
              <div className="font-bold text-sm mb-1">{persona.name} - {persona.role}</div>
              <div className="text-gray-300 text-xs mb-2">{persona.description}</div>
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Globe size={12} className="text-emerald-400" />
                  <span>Search</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Mail size={12} className="text-blue-400" />
                  <span>Email</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Video size={12} className="text-purple-400" />
                  <span>Vision</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal */}
      {isOpen && !showStage && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none transition-all duration-300 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <div 
            ref={resizeRef}
            style={{ width: `${widgetSize.width}px`, height: `${widgetSize.height}px` }}
            className="pointer-events-auto bg-[#FAFAFA] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden relative border border-white/50"
          >
            {/* Resize Handle */}
            <div 
              onMouseDown={(e) => {
                e.preventDefault();
                isResizingRef.current = true;
                document.body.style.cursor = 'nwse-resize';
                document.body.style.userSelect = 'none';
              }}
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-50 group"
            >
              <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-gray-400 group-hover:border-gray-600 transition-colors"></div>
            </div>
            
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
                        <button onClick={() => scheduleHeavy(() => connect())} className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-black transition-colors">
                            Retry Connection
                        </button>
                     </div>
                </div>
            )}

            <div className="flex-1 p-6 bg-gray-50/50 overflow-hidden flex flex-col">
                <div className="grid grid-cols-3 gap-3 h-full" style={{ gridTemplateRows: `repeat(${Math.ceil(PERSONAS.length / 3)}, minmax(0, 1fr))` }}>
                    {PERSONAS.map(persona => {
                        const isSelected = selectedPersonaId === persona.id;
                        return (
                            <div key={persona.id} className="relative">
                            <button
                                key={persona.id}
                                onClick={() => handlePersonaSelect(persona.id)}
                                onMouseEnter={() => setHoveredPersona(persona.id)}
                                onMouseLeave={() => setHoveredPersona(null)}
                                className={`w-full h-full p-3 rounded-xl border transition-all duration-200 hover:scale-105 flex items-center gap-3
                                    ${isSelected 
                                        ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-900 shadow-xl text-white' 
                                        : 'bg-white border-gray-200 hover:border-gray-400 hover:shadow-lg'
                                    }
                                `}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                                    ${isSelected ? 'bg-white/10 text-white' : 'bg-gray-50 text-gray-600'}
                                `}>
                                    {getPersonaIcon(persona.icon, 20)}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <h3 className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>{persona.name}</h3>
                                    <p className={`text-[9px] font-medium uppercase tracking-wider truncate ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>{persona.role}</p>
                                </div>
                                
                                {isSelected && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <CheckCircle2 size={12} className="text-white" />
                                    </div>
                                )}
                                
                                <div 
                                    role="button"
                                    onClick={(e) => playPreview(persona.id, persona.gender, e)}
                                    className={`absolute bottom-1.5 right-1.5 p-1 rounded-full transition-all ${isSelected ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-900'}`}
                                >
                                    {playingPreview === persona.id ? <BarChart2 size={12} className="animate-pulse" /> : <Play size={12} />}
                                </div>
                            </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sticky Footer for Input & Action */}
            <div className="bg-white border-t border-gray-200 shadow-2xl z-20 flex-shrink-0">
                 <div className="max-w-6xl mx-auto p-3 space-y-2">
                    
                    {/* Top Row: Mic + Email */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Mic Selection */}
                        {audioDevices.length > 0 && audioDevices[0].label && (
                            <div className="relative w-full sm:w-64 group">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <Mic size={16} className="text-gray-400" />
                                </div>
                                <select
                                    value={selectedAudioDeviceId}
                                    onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 appearance-none truncate hover:border-gray-400 transition-colors"
                                >
                                    {audioDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Microphone ${device.deviceId.slice(0,4)}...`}
                                        </option>
                                    ))}
                                </select>
                                 <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-500"></div>
                                </div>
                            </div>
                        )}

                        {/* Email Input */}
                        <div className="relative flex-1 group">
                             <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                 <Mail size={16} className={`transition-colors ${isEmailValid ? 'text-emerald-500' : 'text-gray-400'}`} />
                             </div>
                             <input
                                type="email"
                                id="user_email"
                                name="user_email"
                                placeholder="your.email@example.com"
                                value={userEmail}
                                onChange={(e) => { setUserEmail(e.target.value); setEmailTouched(true); }}
                                className={`w-full pl-10 pr-4 py-2 bg-white border-2 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all
                                    ${emailTouched && !isEmailValid 
                                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100' 
                                        : isEmailValid 
                                            ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-100' 
                                            : 'border-gray-200 focus:border-gray-900 focus:ring-gray-100 hover:border-gray-400'
                                    }
                                `}
                             />
                             {emailTouched && !isEmailValid && (
                                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-red-500 font-bold uppercase tracking-wider bg-red-50 px-2 py-1 rounded">
                                     Required
                                 </span>
                             )}
                        </div>
                    </div>

                    {/* Bottom Row: Model + Action Button */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                        {/* Model Selector */}
                        <div className="relative w-full sm:w-auto sm:flex-1">
                            <select
                                value={forcedModel ?? 'auto'}
                                onChange={(e) => setForcedModel(e.target.value === 'auto' ? null : e.target.value)}
                                className="w-full px-4 py-2 text-xs rounded-xl border-2 border-gray-200 bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 appearance-none hover:border-gray-400 transition-colors"
                                title="Runtime model selection">
                                <option value="gemini-live-2.5-flash-preview">PoLYGLoT Standard</option>
                                <option value="gemini-2.5-flash-native-audio-preview-09-2025">PoLYGLoT Native</option>
                            </select>
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-500"></div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={() => scheduleHeavy(() => connect())}
                            disabled={!isEmailValid}
                            className={`w-full sm:w-auto px-8 py-2 rounded-xl shadow-xl transition-all transform flex items-center justify-center gap-3 group whitespace-nowrap font-bold text-sm
                                ${isEmailValid 
                                    ? 'bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer' 
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border-2 border-gray-200'
                                }
                            `}
                        >
                            {isEmailValid && (
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                            )}
                            <span className="tracking-wide">START {selectedPersona.name.toUpperCase()}</span>
                            <ArrowUpRight size={18} className={`transition-transform ${isEmailValid ? 'group-hover:translate-x-1 group-hover:-translate-y-1' : ''}`} />
                        </button>
                    </div>
                 </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Trigger Button (Visible when closed) */}
      {!isOpen && (
        <div className={`fixed bottom-8 right-8 z-50 transition-all duration-300 ${isClosing ? 'translate-y-20 opacity-0' : 'translate-y-0 opacity-100'}`}>
            <button
                onClick={toggleWidget}
                className="pl-6 pr-7 py-5 bg-gradient-to-r from-green-600 via-yellow-500 to-red-600 text-white rounded-full shadow-[0_20px_60px_rgba(0,0,0,0.5)] hover:shadow-[0_25px_70px_rgba(0,0,0,0.6)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all group border-2 border-white/20 animate-pulse-slow"
            >
                <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center mr-4 ring-2 ring-white/50">
                     <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                </div>
                <div className="flex flex-col items-start leading-none mr-3">
                    <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider mb-1">VCB PoLYGLoT</span>
                    <span className="text-lg font-extrabold">Try Live Demo</span>
                </div>
                <ChevronRight size={20} className="text-white/80 group-hover:text-white group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      )}
    </div>
  );
};