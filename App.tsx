import React from 'react';
import { ChatWidget } from './components/ChatWidget';
import { ExternalLink, Cpu, Globe, Mic, ChevronRight, Zap, ArrowRight, ShieldCheck, FileText, Lock } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 font-[Quicksand] selection:bg-black selection:text-white overflow-x-hidden">
      
      {/* Animation Styles */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fadeUp 0.8s cubic-bezier(0.2, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed w-full z-50 transition-all duration-300 glass border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3 cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-lg relative overflow-hidden transition-transform group-hover:scale-105">
                    <div className="absolute inset-0 bg-gradient-to-tr from-green-500 via-yellow-500 to-red-500 opacity-30 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <Zap className="text-white w-5 h-5 relative z-10" fill="currentColor" />
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-lg tracking-tight text-gray-900 leading-none">VCB-AI</span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] leading-none mt-1 group-hover:text-black transition-colors">Enterprise</span>
                </div>
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
                {['Solutions', 'Developers', 'Pricing'].map((item) => (
                    <a key={item} href="#" className="hover:text-black transition-colors relative group py-2">
                        {item}
                        <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-black transition-all duration-300 group-hover:w-full"></span>
                    </a>
                ))}
            </div>

            <div className="flex items-center gap-4">
                <a href="#" className="hidden sm:flex text-sm font-bold text-gray-900 hover:text-gray-600 transition-colors">
                    Login
                </a>
                <a href="#" className="bg-gray-100 text-gray-900 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-200 transition-all flex items-center group">
                    Contact Sales
                </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-36 pb-24 overflow-hidden">
        
        {/* Ambient Background */}
        <div className="absolute inset-0 w-full h-full bg-noise opacity-40 pointer-events-none z-0"></div>
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

        <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
            <div className="flex flex-col items-center justify-center text-center animate-fade-up">
                
                {/* PREMIUM SYSTEM BADGE */}
                <div className="relative inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#0a0a0a] border border-gray-800 shadow-xl mb-12 hover:scale-105 transition-transform cursor-default group overflow-hidden">
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] animate-shimmer"></div>
                    
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/90 group-hover:text-white transition-colors">
                        Bua X1 Neural Engine Online
                    </span>
                    <div className="h-4 w-[1px] bg-white/20 mx-1"></div>
                    <span className="text-[10px] font-mono text-emerald-400">v2.5.0 STABLE</span>
                </div>
                
                {/* Headline */}
                <h1 className="max-w-5xl text-5xl sm:text-7xl font-extrabold tracking-tight text-gray-900 mb-8 leading-[1.1]">
                    The Digital Soundprint <br className="hidden sm:block" />
                    <span className="relative whitespace-nowrap">
                        <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-yellow-500 to-red-600">
                           of South Africa.
                        </span>
                        <svg className="absolute -bottom-2 w-full h-3 text-yellow-300 opacity-40 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                            <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                        </svg>
                    </span>
                </h1>
                
                <p className="text-xl sm:text-2xl text-gray-500 mb-12 leading-relaxed font-medium max-w-2xl mx-auto">
                    Deploy authentic, multilingual AI agents that understand context, slang, and culture. 
                    <span className="text-gray-900 font-semibold"> 11 Languages. Zero Latency.</span>
                </p>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    <button className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold text-lg hover:border-gray-300 hover:shadow-lg transition-all flex items-center justify-center gap-2 group">
                        <FileText size={18} className="text-gray-400 group-hover:text-black transition-colors" />
                        API Documentation
                    </button>
                    <button className="w-full sm:w-auto px-8 py-4 bg-transparent text-gray-500 border border-transparent rounded-2xl font-bold text-lg hover:text-black transition-all flex items-center justify-center gap-2">
                        Enterprise Access
                    </button>
                </div>
            </div>
        </div>

        {/* Feature Grid (Premium Style) */}
        <div className="max-w-7xl mx-auto px-6 sm:px-8 mt-24 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Card 1 */}
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                        <Globe size={180} />
                    </div>
                    <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-500">
                        <Globe className="text-gray-900 w-6 h-6 stroke-[1.5]" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">Hyper-Local</h3>
                    <p className="text-gray-500 leading-relaxed font-medium text-lg">
                        Our models code-switch effortlessly between English and Tsotsitaal, understanding "Now Now" vs "Just Now".
                    </p>
                </div>

                {/* Card 2 */}
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                        <Lock size={180} />
                    </div>
                    <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-500">
                        <Lock className="text-gray-900 w-6 h-6 stroke-[1.5]" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">Enterprise Grade</h3>
                    <p className="text-gray-500 leading-relaxed font-medium text-lg">
                        SOC2 compliant infrastructure ready to integrate with your CRM, Salesforce, or internal support ticketing.
                    </p>
                </div>

                {/* Card 3 */}
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                        <Zap size={180} />
                    </div>
                    <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-500">
                        <Zap className="text-gray-900 w-6 h-6 stroke-[1.5]" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">Sub-500ms Latency</h3>
                    <p className="text-gray-500 leading-relaxed font-medium text-lg">
                        Powered by the Bua X1 Engine, achieving conversational fluidity that feels indistinguishable from human.
                    </p>
                </div>
            </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12 relative z-10">
          <div className="max-w-7xl mx-auto px-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                  <div className="w-6 h-6 bg-black rounded-lg flex items-center justify-center">
                    <Zap size={12} className="text-white" fill="currentColor" />
                  </div>
                  <span className="font-bold text-gray-900">VCB-AI</span>
              </div>
              <p className="text-gray-400 font-medium text-sm">© 2025 VCB-AI Online. Proudly South African.</p>
          </div>
      </footer>

      <ChatWidget />
    </div>
  );
};

export default App;
