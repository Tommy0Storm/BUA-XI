import React from 'react';
import { ChatWidget } from './components/ChatWidget';
import { ExternalLink, Cpu, Globe, Mic, ChevronRight, Zap } from 'lucide-react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-[Quicksand] selection:bg-yellow-200 selection:text-black">
      
      {/* Custom Styles for Polish */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes gradientX {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradientX 6s ease infinite;
        }
      `}</style>

      {/* Navigation */}
      <nav className="fixed w-full z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center space-x-3 cursor-pointer">
                {/* Brand Logo */}
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-lg relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-yellow-500 to-red-600 opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <Zap className="text-white w-5 h-5 relative z-10" fill="currentColor" />
                </div>
                <div>
                    <span className="font-bold text-xl tracking-tight text-gray-900">VCB-AI</span>
                    <span className="text-xs font-bold text-green-600 block -mt-1 uppercase tracking-wider">Enterprise</span>
                </div>
            </div>
            
            <div className="hidden md:flex items-center space-x-10 text-sm font-semibold text-gray-600">
                <a href="https://vcb-ai.online" className="hover:text-black transition-colors relative group">
                    Services
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 transition-all group-hover:w-full"></span>
                </a>
                <a href="https://vcb-ai.online" className="hover:text-black transition-colors relative group">
                    Developers
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-yellow-500 transition-all group-hover:w-full"></span>
                </a>
                <a href="https://vcb-ai.online" className="hover:text-black transition-colors relative group">
                    Enterprise
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full"></span>
                </a>
            </div>

            <div className="flex items-center space-x-4">
                <a href="https://vcb-ai.online" target="_blank" rel="noreferrer" className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 hover:shadow-gray-300 flex items-center">
                    Get Started
                    <ChevronRight size={16} className="ml-1" />
                </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-24 relative overflow-hidden">
        
        {/* Abstract Backgrounds */}
        <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-gradient-to-b from-green-50 to-transparent rounded-full blur-3xl opacity-60 -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-gradient-to-t from-yellow-50 to-transparent rounded-full blur-3xl opacity-60 -ml-20 -mb-20 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex flex-col items-center justify-center text-center animate-fade-in-up">
                
                {/* Hero Text */}
                <div className="max-w-4xl mb-16">
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-8 hover:border-green-300 transition-colors cursor-default">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                        11 Official languages available
                    </div>
                    
                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 mb-8 leading-[1.1]">
                        Bua XI&trade; <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-yellow-500 to-red-600 animate-gradient-x">The Digital Soundprint of South Africa.</span>
                    </h1>
                    
                    <p className="text-xl text-gray-600 mb-10 leading-relaxed font-medium max-w-2xl mx-auto">
                        Deploy authentic, multilingual AI workforce. From <strong>Call Center Agents</strong> to <strong>Support Chatbots</strong>, 
                        automate your customer engagement with perfect South African dialect and soul.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                        <a href="https://vcb-ai.online" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-4 bg-green-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-green-900/20 hover:bg-green-800 transition transform hover:-translate-y-1 text-center">
                            Contact Us
                        </a>
                        <button className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold text-lg hover:border-gray-300 hover:bg-gray-50 transition flex items-center justify-center group shadow-sm">
                            <ExternalLink size={20} className="mr-2 text-gray-400 group-hover:text-black transition-colors" />
                            View Documentation
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Value Props */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-600 transition-colors">
                        <Globe className="text-green-600 w-7 h-7 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Hyper-Local Dialects</h3>
                    <p className="text-gray-500 leading-relaxed text-sm">
                        Our models don't just speak the language; they understand the culture, the slang, and the context of South Africa.
                    </p>
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
                        <Cpu className="text-blue-600 w-7 h-7 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Enterprise Integration</h3>
                    <p className="text-gray-500 leading-relaxed text-sm">
                        Seamlessly connect VCB-AI agents to your CRM, support tickets, and internal databases for real-world automation.
                    </p>
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-yellow-500 transition-colors">
                        <Mic className="text-yellow-600 w-7 h-7 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Low Latency Voice</h3>
                    <p className="text-gray-500 leading-relaxed text-sm">
                        Powered by Gemini Native Audio 2.5, experience real-time conversations with sub-second response times.
                    </p>
                </div>
            </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
              <p className="text-gray-400 font-medium text-sm">© 2025 VCB-AI Online. Proudly South African.</p>
          </div>
      </footer>

      <ChatWidget />
    </div>
  );
};

export default App;