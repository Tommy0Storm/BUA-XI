import React from 'react';
import { ChatWidget } from './components/ChatWidget';
import { ExternalLink, Cpu, Globe, Mic, ChevronRight, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

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
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fadeUp 0.8s cubic-bezier(0.2, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed w-full z-50 transition-all duration-300 glass border-b border-gray-100">
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
                <a href="#" className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center group">
                    Get Started
                    <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-24 overflow-hidden">
        
        {/* Ambient Background */}
        <div className="absolute inset-0 w-full h-full bg-noise opacity-40 pointer-events-none z-0"></div>
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

        <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10">
            <div className="flex flex-col items-center justify-center text-center animate-fade-up">
                
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm mb-10 hover:border-gray-300 transition-colors cursor-default group">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-900 transition-colors">
                        Bua X1 Neural Engine Online
                    </span>
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
                    <button className="w-full sm:w-auto px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg shadow-2xl shadow-gray-200 hover:bg-gray-900 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                        Start Free Trial
                        <ChevronRight size={18} />
                    </button>
                    <button className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold text-lg hover:border-gray-300 hover:shadow-lg transition-all flex items-center justify-center gap-2 group">
                        <ExternalLink size={18} className="text-gray-400 group-hover:text-black transition-colors" />
                        Documentation
                    </button>
                </div>
            </div>
        </div>

        {/* Feature Grid (Bento Style) */}
        <div className="max-w-7xl mx-auto px-6 sm:px-8 mt-24 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Card 1 */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-2xl hover:border-gray-200 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Globe size={120} />
                    </div>
                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                        <Globe className="text-green-600 w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Hyper-Local</h3>
                    <p className="text-gray-500 leading-relaxed font-medium">
                        Our models code-switch effortlessly between English and Tsotsitaal, understanding "Now Now" vs "Just Now".
                    </p>
                </div>

                {/* Card 2 */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-2xl hover:border-gray-200 transition-all duration-500 group relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ShieldCheck size={120} />
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                        <ShieldCheck className="text-blue-600 w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Enterprise Grade</h3>
                    <p className="text-gray-500 leading-relaxed font-medium">
                        SOC2 compliant infrastructure ready to integrate with your CRM, Salesforce, or internal support ticketing.
                    </p>
                </div>

                {/* Card 3 */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-2xl hover:border-gray-200 transition-all duration-500 group relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap size={120} />
                    </div>
                    <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                        <Zap className="text-yellow-600 w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Sub-500ms Latency</h3>
                    <p className="text-gray-500 leading-relaxed font-medium">
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
