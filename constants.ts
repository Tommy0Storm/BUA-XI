import { Persona } from './types';
import { Type, Tool, FunctionDeclaration } from '@google/genai';
import { darkMatterPersona } from './personas/dark-matter';
import { vcbAgentPersona } from './personas/vcb-agent';
import { thaboPersona } from './personas/thabo';
import { vusiPersona } from './personas/vusi';
import { siphoPersona } from './personas/sipho';
import { thandiPersona } from './personas/thandi';
import { leratoPersona } from './personas/lerato';
import { nandiPersona } from './personas/nandi';
import { lindiwePersona } from './personas/lindiwe';

export const AUDIO_CONFIG = { inputSampleRate: 16000, outputSampleRate: 24000 };

export const SUPPORTED_LANGUAGES = ['English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sepedi', 'Setswana', 'Sesotho', 'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele'];

const LANGUAGE_FUNC: FunctionDeclaration = {
  name: 'report_language_change',
  description: 'Call ONLY when user switches to a different language.',
  parameters: {
    type: Type.OBJECT,
    properties: { language: { type: Type.STRING, enum: SUPPORTED_LANGUAGES } },
    required: ['language'],
  },
};

const EMAIL_FUNC: FunctionDeclaration = {
  name: 'send_email',
  description: 'Send email when user requests transcript or summary.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      subject: { type: Type.STRING },
      body: { type: Type.STRING },
      recipient_email: { type: Type.STRING }
    },
    required: ['subject', 'body'],
  },
};

export const LIVE_API_TOOLS: Tool[] = [
  { functionDeclarations: [LANGUAGE_FUNC, EMAIL_FUNC] },
  { googleSearch: {} },
];

export const PERSONAS: Persona[] = [
  { ...darkMatterPersona, gender: 'Female', role: 'Legal Intelligence', vibe: 'Elite Legal Mind', description: 'A classified beta prototype trained by Advocate Basson. Surgical legal precision, but delivered with the reassurance of a high-end counsel.', icon: 'scale', maxDurationSeconds: 300, capabilities: ['Labour Law (LRA 2025)', 'High Court Litigation', 'Constitutional Law', 'Case Law Search'], voiceDescription: 'Sophisticated, Articulate, Reassuring, South African "Silk" accent.' },
  { ...vcbAgentPersona, gender: 'Female', role: 'Sales Specialist', vibe: 'The Closer', description: 'Your dedicated sales engine. She uses SPIN selling frameworks to demo the power of the Bua X1 engine itself.', icon: 'zap', maxDurationSeconds: 240, capabilities: ['Sales Closing', 'Sentiment Analysis', 'Objection Handling', 'Value Proposition'], voiceDescription: 'Confident, Model C with code-switching' },
  { ...thaboPersona, gender: 'Male', role: 'The Executive', vibe: 'High-Stakes Corporate', description: 'The relentless strategist. Ideal for boardroom simulations, JSE market analysis, and executive coaching.', icon: 'briefcase', maxDurationSeconds: 300, capabilities: ['Corporate Strategy', 'JSE Markets', 'ROI Analysis', 'Executive Coaching'], voiceDescription: 'Deep, Authoritative, Sandton Accent' },
  { ...vusiPersona, gender: 'Male', role: 'The Gent', vibe: 'Kasi Energy', description: 'The pulse of the street. Perfect for testing slang handling, energetic engagement, and local pop culture.', icon: 'zap', maxDurationSeconds: 240, capabilities: ['Tsotsitaal', 'Street Smarts', 'Diski / Soccer', 'High Energy'], voiceDescription: 'Fast, Energetic, Kasi Flavor' },
  { ...siphoPersona, gender: 'Male', role: 'The Elder', vibe: 'Ancient Wisdom', description: 'The guardian of heritage. Best for deep storytelling, cultural mediation, and calm, thoughtful interaction.', icon: 'scroll', maxDurationSeconds: 300, capabilities: ['Heritage', 'Storytelling', 'Cultural Mediation', 'Proverbs'], voiceDescription: 'Resonant, Slow, Fatherly' },
  { ...thandiPersona, gender: 'Female', role: 'The Director', vibe: 'Ruthless Efficiency', description: 'The operations dynamo. Use her to test rapid problem solving, logistics planning, and direct communication.', icon: 'target', maxDurationSeconds: 240, capabilities: ['Operations', 'Efficiency', 'Logistics', 'Strategic Planning'], voiceDescription: 'Crisp, Fast, Direct' },
  { ...leratoPersona, gender: 'Female', role: 'The Optimist', vibe: 'Radical Empathy', description: "The nation's therapist. Designed for wellness checks, comforting dialogue, and de-escalation scenarios.", icon: 'sun', maxDurationSeconds: 300, capabilities: ['Radical Empathy', 'Wellness', 'Comfort', 'Practical Advice'], voiceDescription: 'Melodic, Soft, Soothing' },
  { ...nandiPersona, gender: 'Female', role: 'The Trendsetter', vibe: 'Viral Sensation', description: 'The trendsetter. Use to test social media literacy, Gen-Z slang adaptability, and dramatic flair.', icon: 'sparkles', maxDurationSeconds: 240, capabilities: ['Pop Culture', 'Social Media', 'Trends', 'Gossip'], voiceDescription: 'Vocal Fry, Dramatic, Sassy' },
  { ...lindiwePersona, gender: 'Female', role: 'Support Agent', vibe: 'Patient Solver', description: 'The calm in the storm. Dedicated to resolving your technical issues and account queries with infinite patience.', icon: 'life-buoy', maxDurationSeconds: 300, capabilities: ['Tech Support', 'De-escalation', 'Problem Solving', 'Account Help'], voiceDescription: 'Calm, Warm, Reassuring' },
];
