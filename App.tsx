import { useState, useEffect } from 'react';
import { LiveConsole } from './components/LiveConsole';
import { ChatWidget } from './components/ChatWidget';
import { Zap, FileText, Globe, Lock, ShieldCheck, Database, FileSpreadsheet, Send, ChevronLeft, ChevronRight } from 'lucide-react';

export default function App() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showConsole, setShowConsole] = useState(false);
  const [showChatWidget, setShowChatWidget] = useState(false);

  useEffect(() => {
    const handleTranscriptSent = () => {
      setShowChatWidget(false);
      setShowConsole(true);
    };
    window.addEventListener('transcriptSent', handleTranscriptSent);
    return () => window.removeEventListener('transcriptSent', handleTranscriptSent);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 10000);
    return () => clearInterval(timer);
  }, []);



  const slides = [
    <div key="hero" className="h-screen w-screen flex flex-col bg-white overflow-y-auto">
      <div className="w-full bg-white py-4 sm:py-6 px-4 sm:px-8 flex items-center justify-center max-w-[1920px] mx-auto">
        <a href="https://vcb-ai.online" className="flex items-center gap-3 sm:gap-4">
          <img src="logowhite.png" alt="VCB-AI" className="h-20 sm:h-28 lg:h-32 xl:h-36 w-auto" />
          <div className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-black text-gray-900">
            P<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-yellow-500 to-red-500">o</span>LYGl<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-yellow-500 to-red-500">o</span>T <span className="text-gray-700">AI - Engine</span>
          </div>
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-8">
        <div className="relative inline-flex items-center gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-[#0a0a0a] border border-gray-800 shadow-xl mb-8 sm:mb-12">
          <span className="relative flex h-2 w-2 sm:h-3 sm:w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 sm:h-3 sm:w-3 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-white/90">VCB <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-yellow-500 to-red-500">PoLYGLoT</span> AI Engine Online</span>
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold text-gray-900 mb-6 sm:mb-8 leading-tight">
          The First AI That <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-yellow-500 to-red-600">Talks, Hears & Sees</span><br />
          <span className="text-2xl sm:text-4xl lg:text-5xl">in All 11 Official Languages.</span>
        </h1>
        <p className="text-base sm:text-xl lg:text-2xl text-gray-500 mb-6 sm:mb-8 max-w-3xl mx-auto">
          Speak to it in <span className="font-bold text-gray-900">isiZulu</span>. Show it a document in <span className="font-bold text-gray-900">Afrikaans</span>. It responds in <span className="font-bold text-gray-900">Sesotho</span>.
        </p>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-12 max-w-4xl mx-auto">
          {['English', 'isiZulu', 'isiXhosa', 'Afrikaans', 'Sepedi', 'Setswana', 'Sesotho', 'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele'].map((lang) => (
            <span key={lang} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-green-50 via-yellow-50 to-red-50 border border-gray-200 rounded-full text-xs sm:text-sm font-bold text-gray-700">{lang}</span>
          ))}
        </div>
        <p className="text-sm sm:text-base lg:text-lg text-gray-600 mb-8 sm:mb-12 max-w-2xl mx-auto">
          Not just translation. True understanding. Code-switches mid-sentence. Reads street signs in any language. Understands "Now Now" vs "Just Now".
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-2xl sm:rounded-3xl shadow border border-gray-200">
            <Globe className="text-gray-900 w-6 h-6 sm:w-8 sm:h-8 mb-4 mx-auto" />
            <h3 className="text-lg sm:text-xl font-bold mb-2">Multilingual Vision</h3>
            <p className="text-sm sm:text-base text-gray-600">Show it a menu in Afrikaans. Ask in Zulu. It reads, translates, explains—seamlessly.</p>
          </div>
          <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-2xl sm:rounded-3xl shadow border border-gray-200">
            <Lock className="text-gray-900 w-6 h-6 sm:w-8 sm:h-8 mb-4 mx-auto" />
            <h3 className="text-lg sm:text-xl font-bold mb-2">Enterprise Grade</h3>
            <p className="text-sm sm:text-base text-gray-600">SOC2 compliant. Integrates with Salesforce, CRM, support ticketing.</p>
          </div>
          <div className="bg-white p-6 sm:p-8 lg:p-10 rounded-2xl sm:rounded-3xl shadow border border-gray-200">
            <Zap className="text-gray-900 w-6 h-6 sm:w-8 sm:h-8 mb-4 mx-auto" />
            <h3 className="text-lg sm:text-xl font-bold mb-2">Sub-500ms Latency</h3>
            <p className="text-sm sm:text-base text-gray-600">Powered by VCB <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-yellow-500 to-red-600 font-bold">PoLYGLoT</span> AI Engine.</p>
          </div>
        </div>
      </div>
      </div>
    </div>,

    <div key="enterprise" className="h-screen w-screen flex flex-col bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 text-white overflow-y-auto">
      <div className="w-full bg-gray-700 py-4 sm:py-6 px-4 sm:px-8 flex items-center justify-center max-w-[1920px] mx-auto">
        <a href="https://vcb-ai.online" className="flex items-center gap-3 sm:gap-4">
          <img src="logowhite.png" alt="VCB-AI" className="h-20 sm:h-28 lg:h-32 xl:h-36 w-auto" />
          <div className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-black text-white">
            P<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-yellow-500 to-red-500">o</span>LYGl<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-yellow-500 to-red-500">o</span>T <span className="text-gray-300">AI - Engine</span>
          </div>
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-6">
          <Zap size={14} className="text-emerald-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Enterprise Scale</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 sm:mb-6">
          Deploy a 20-Seat Call Center <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-yellow-400">in 5 Minutes.</span>
        </h2>
        <p className="text-base sm:text-lg lg:text-xl text-gray-300 max-w-3xl mx-auto mb-8 sm:mb-12 lg:mb-16">Debt collection, sales, helpdesk support—all speaking 11 languages.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white/10 backdrop-blur-sm p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/20">
            <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center mb-4 mx-auto"><Database className="text-red-400 w-6 h-6" /></div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 text-white">Debt Collection</h3>
            <p className="text-gray-300 text-sm">Empathetic, compliant. Logs promises, updates debtors book, sends emails—automated.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/20">
            <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center mb-4 mx-auto"><Zap className="text-green-400 w-6 h-6" /></div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 text-white">Sales Agents</h3>
            <p className="text-gray-300 text-sm">Handles objections in Afrikaans, books demos, updates Salesforce—real-time.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/20">
            <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4 mx-auto"><ShieldCheck className="text-blue-400 w-6 h-6" /></div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 text-white">Helpdesk Support</h3>
            <p className="text-gray-300 text-sm">Troubleshoots in isiZulu, logs tickets to Zendesk, escalates when needed.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/20">
            <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-4 mx-auto"><FileSpreadsheet className="text-purple-400 w-6 h-6" /></div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 text-white">Instant Scale</h3>
            <p className="text-gray-300 text-sm">20 agents. 200 agents. Deploy in minutes. Just API keys and go.</p>
          </div>
        </div>
      </div>
      </div>
    </div>,

    <div key="vision" className="h-screen w-screen flex flex-col bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white overflow-y-auto">
      <div className="w-full bg-gray-900 py-4 sm:py-6 px-4 sm:px-8 flex items-center justify-center max-w-[1920px] mx-auto">
        <a href="https://vcb-ai.online" className="flex items-center gap-3 sm:gap-4">
          <img src="logowhite.png" alt="VCB-AI" className="h-20 sm:h-28 lg:h-32 xl:h-36 w-auto" />
          <div className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-black text-white">
            P<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-yellow-500 to-red-500">o</span>LYGl<span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-yellow-500 to-red-500">o</span>T <span className="text-gray-300">AI - Engine</span>
          </div>
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 mb-6">
            <Globe size={14} className="text-cyan-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Vision Intelligence</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 sm:mb-6">
            See What I See. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Understand Everything.</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-400 max-w-3xl mx-auto">
            Share your screen, monitor video feeds, watch your farm—VCB <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 font-bold">PoLYGLoT</span> sees, understands, and acts.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white/5 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-cyan-500/50 transition-all">
            <Globe size={32} className="text-cyan-400 mb-4" />
            <h4 className="text-lg sm:text-xl font-bold mb-2">Screen Share</h4>
            <p className="text-gray-400 text-sm">"Can you see my screen?" Yes. It reads your spreadsheet, debugs your code, guides you through software—live.</p>
          </div>
          <div className="bg-white/5 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-emerald-500/50 transition-all">
            <Database size={32} className="text-emerald-400 mb-4" />
            <h4 className="text-lg sm:text-xl font-bold mb-2">Farm Monitoring</h4>
            <p className="text-gray-400 text-sm">"How many cattle in the north field?" It counts. "Any sick animals?" It spots them. 24/7 video feed analysis.</p>
          </div>
          <div className="bg-white/5 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-purple-500/50 transition-all">
            <FileSpreadsheet size={32} className="text-purple-400 mb-4" />
            <h4 className="text-lg sm:text-xl font-bold mb-2">Remote Assistance</h4>
            <p className="text-gray-400 text-sm">"Show me what you see." Your mom shares her phone screen. You guide her through settings—she sees, you see.</p>
          </div>
          <div className="bg-white/5 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-yellow-500/50 transition-all">
            <Send size={32} className="text-yellow-400 mb-4" />
            <h4 className="text-lg sm:text-xl font-bold mb-2">Security Cameras</h4>
            <p className="text-gray-400 text-sm">"Alert me if someone enters the warehouse." It watches your CCTV feed, detects motion, sends WhatsApp alerts.</p>
          </div>
          <div className="bg-white/5 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-red-500/50 transition-all">
            <ShieldCheck size={32} className="text-red-400 mb-4" />
            <h4 className="text-lg sm:text-xl font-bold mb-2">Quality Control</h4>
            <p className="text-gray-400 text-sm">"Check the production line." It monitors video, spots defects, logs issues to your ERP—real-time quality assurance.</p>
          </div>
          <div className="bg-white/5 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 hover:border-blue-500/50 transition-all">
            <Zap size={32} className="text-blue-400 mb-4" />
            <h4 className="text-lg sm:text-xl font-bold mb-2">Wildlife Tracking</h4>
            <p className="text-gray-400 text-sm">"Any elephants near the fence?" Game farm camera feeds analyzed. Alerts when animals approach boundaries.</p>
          </div>
        </div>
      </div>
      </div>
    </div>
  ];

  return (
    <div className="relative h-screen overflow-hidden">

      <div className="h-full transition-all duration-1000 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
        <div className="flex h-full">
          {slides.map((slide, i) => (
            <div key={i} className="min-w-full h-full">{slide}</div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 flex gap-2 items-center">
        {[0, 1, 2].map((i) => (
          <button key={i} onClick={() => setCurrentSlide(i)} className={`w-2 h-2 rounded-full transition-all ${currentSlide === i ? 'bg-white w-8' : 'bg-white/50'}`}></button>
        ))}
      </div>

      {showConsole && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowConsole(false)} className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white text-2xl sm:text-3xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10">×</button>
            <LiveConsole />
          </div>
        </div>
      )}

      {showChatWidget && <ChatWidget />}

    </div>
  );
}
