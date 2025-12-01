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
  description: 'CRITICAL TOOL: Send email to user. Call this IMMEDIATELY when user says "email me", "send me that", "email this", or agrees to receive email. The system automatically includes ALL context (directions, searches, conversation, location). Just provide subject and brief body.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      subject: { type: Type.STRING, description: 'Email subject' },
      body: { type: Type.STRING, description: 'Brief message - system auto-adds full context' },
      recipient_email: { type: Type.STRING, description: 'Optional recipient (defaults to user email)' },
      template: { type: Type.STRING, enum: ['standard', 'legal'], description: 'standard or legal template' }
    },
    required: ['subject', 'body'],
  },
};

const QUERY_LRA_FUNC: FunctionDeclaration = {
  name: 'query_lra_document',
  description: 'Query the LRA Code of Conduct Dismissals (4 Sept 2025) document for specific legal information.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The legal question or topic to search for in the LRA document' }
    },
    required: ['query'],
  },
};

const OPEN_MAPS_FUNC: FunctionDeclaration = {
  name: 'open_maps',
  description: 'Open the default map app with directions or location. Use when user asks for directions, navigation, or "how to get to" a place. After opening maps, if user asks to email directions, the system will automatically include the destination and Google Maps link in the email.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      destination: { type: Type.STRING, description: 'The complete destination address or place name' },
      mode: { type: Type.STRING, enum: ['driving', 'walking', 'transit'], description: 'Travel mode (default: driving)' }
    },
    required: ['destination'],
  },
};

const MAKE_CALL_FUNC: FunctionDeclaration = {
  name: 'make_call',
  description: 'Initiate a phone call. Use when user asks to call someone or a business.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      phone_number: { type: Type.STRING, description: 'Phone number with country code (e.g., +27123456789)' },
      contact_name: { type: Type.STRING, description: 'Name of person/business being called' }
    },
    required: ['phone_number'],
  },
};

const OPEN_WHATSAPP_FUNC: FunctionDeclaration = {
  name: 'open_whatsapp',
  description: 'Open WhatsApp chat with a contact. Use when user asks to WhatsApp someone or send a WhatsApp message.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      phone_number: { type: Type.STRING, description: 'Phone number with country code (e.g., 27123456789, no + sign)' },
      message: { type: Type.STRING, description: 'Pre-filled message text (optional)' }
    },
    required: ['phone_number'],
  },
};

const COPY_TO_CLIPBOARD_FUNC: FunctionDeclaration = {
  name: 'copy_to_clipboard',
  description: 'Copy text to clipboard. Use when user asks to copy information, save text, or wants to paste something later.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'Text to copy to clipboard' }
    },
    required: ['text'],
  },
};

const SET_REMINDER_FUNC: FunctionDeclaration = {
  name: 'set_reminder',
  description: 'Set a timed reminder notification. Use when user asks to be reminded about something.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING, description: 'Reminder message' },
      minutes: { type: Type.NUMBER, description: 'Minutes from now to show reminder' }
    },
    required: ['message', 'minutes'],
  },
};

const SEND_SMS_FUNC: FunctionDeclaration = {
  name: 'send_sms',
  description: 'Open SMS app with pre-filled message. Use when user asks to SMS or text them information.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      phone_number: { type: Type.STRING, description: 'Phone number (optional, defaults to user)' },
      message: { type: Type.STRING, description: 'SMS message text' }
    },
    required: ['message'],
  },
};

const CREATE_CALENDAR_EVENT_FUNC: FunctionDeclaration = {
  name: 'create_calendar_event',
  description: 'Create a calendar event. Use when user asks to schedule, book, or add something to calendar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Event title' },
      date: { type: Type.STRING, description: 'Date in YYYYMMDD format' },
      start_time: { type: Type.STRING, description: 'Start time in HHmm format (e.g., 1430 for 2:30 PM)' },
      end_time: { type: Type.STRING, description: 'End time in HHmm format' },
      details: { type: Type.STRING, description: 'Event description (optional)' }
    },
    required: ['title', 'date', 'start_time'],
  },
};

const SHARE_CONTENT_FUNC: FunctionDeclaration = {
  name: 'share_content',
  description: 'Share text/link via native share menu. Use when user asks to share information with someone.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Share title' },
      text: { type: Type.STRING, description: 'Text to share' },
      url: { type: Type.STRING, description: 'URL to share (optional)' }
    },
    required: ['text'],
  },
};

const FETCH_URL_FUNC: FunctionDeclaration = {
  name: 'fetch_url_content',
  description: 'Fetch detailed content from a URL. Use ONLY when user explicitly asks for more info about a link or you suggest it and user agrees. Never auto-fetch.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: 'The URL to fetch content from' },
      custom_instruction: { type: Type.STRING, description: 'Optional: specific instruction for what to extract or focus on from the page' }
    },
    required: ['url'],
  },
};

export const LIVE_API_TOOLS: Tool[] = [
  { functionDeclarations: [LANGUAGE_FUNC, EMAIL_FUNC, QUERY_LRA_FUNC, OPEN_MAPS_FUNC, MAKE_CALL_FUNC, OPEN_WHATSAPP_FUNC, COPY_TO_CLIPBOARD_FUNC, SET_REMINDER_FUNC, SEND_SMS_FUNC, CREATE_CALENDAR_EVENT_FUNC, SHARE_CONTENT_FUNC, FETCH_URL_FUNC] },
  { googleSearch: {} },
];

export const PERSONAS: Persona[] = [
  { ...darkMatterPersona, gender: 'Female', role: 'Legal Intelligence', vibe: 'Elite Legal Mind', description: 'A classified beta prototype trained by Advocate Basson. Surgical legal precision, but delivered with the reassurance of a high-end counsel.', icon: 'scale', maxDurationSeconds: 300, capabilities: ['Labour Law (LRA 2025)', 'High Court Litigation', 'Constitutional Law', 'Case Law Search'], voiceDescription: 'Sophisticated, Articulate, Reassuring, South African "Silk" accent.' },
  { ...vcbAgentPersona, gender: 'Female', role: 'Sales Specialist', vibe: 'The Closer', description: 'Your dedicated sales engine. She uses SPIN selling frameworks to demo the power of the Bua X1 engine itself.', icon: 'zap', maxDurationSeconds: 300, capabilities: ['Sales Closing', 'Sentiment Analysis', 'Objection Handling', 'Value Proposition'], voiceDescription: 'Confident, Model C with code-switching' },
  { ...thaboPersona, gender: 'Male', role: 'The Executive', vibe: 'High-Stakes Corporate', description: 'The relentless strategist. Ideal for boardroom simulations, JSE market analysis, and executive coaching.', icon: 'briefcase', maxDurationSeconds: 300, capabilities: ['Corporate Strategy', 'JSE Markets', 'ROI Analysis', 'Executive Coaching'], voiceDescription: 'Deep, Authoritative, Sandton Accent' },
  { ...vusiPersona, gender: 'Male', role: 'The Gent', vibe: 'Kasi Energy', description: 'The pulse of the street. Perfect for testing slang handling, energetic engagement, and local pop culture.', icon: 'zap', maxDurationSeconds: 300, capabilities: ['Tsotsitaal', 'Street Smarts', 'Diski / Soccer', 'High Energy'], voiceDescription: 'Fast, Energetic, Kasi Flavor' },
  { ...siphoPersona, gender: 'Male', role: 'The Elder', vibe: 'Ancient Wisdom', description: 'The guardian of heritage. Best for deep storytelling, cultural mediation, and calm, thoughtful interaction.', icon: 'scroll', maxDurationSeconds: 300, capabilities: ['Heritage', 'Storytelling', 'Cultural Mediation', 'Proverbs'], voiceDescription: 'Resonant, Slow, Fatherly' },
  { ...thandiPersona, gender: 'Female', role: 'The Director', vibe: 'Ruthless Efficiency', description: 'The operations dynamo. Use her to test rapid problem solving, logistics planning, and direct communication.', icon: 'target', maxDurationSeconds: 300, capabilities: ['Operations', 'Efficiency', 'Logistics', 'Strategic Planning'], voiceDescription: 'Crisp, Fast, Direct' },
  { ...leratoPersona, gender: 'Female', role: 'The Optimist', vibe: 'Radical Empathy', description: "The nation's therapist. Designed for wellness checks, comforting dialogue, and de-escalation scenarios.", icon: 'sun', maxDurationSeconds: 300, capabilities: ['Radical Empathy', 'Wellness', 'Comfort', 'Practical Advice'], voiceDescription: 'Melodic, Soft, Soothing' },
  { ...nandiPersona, gender: 'Female', role: 'The Trendsetter', vibe: 'Viral Sensation', description: 'The trendsetter. Use to test social media literacy, Gen-Z slang adaptability, and dramatic flair.', icon: 'sparkles', maxDurationSeconds: 300, capabilities: ['Pop Culture', 'Social Media', 'Trends', 'Gossip'], voiceDescription: 'Vocal Fry, Dramatic, Sassy' },
  { ...lindiwePersona, gender: 'Female', role: 'Support Agent', vibe: 'Patient Solver', description: 'The calm in the storm. Dedicated to resolving your technical issues and account queries with infinite patience.', icon: 'life-buoy', maxDurationSeconds: 300, capabilities: ['Tech Support', 'De-escalation', 'Problem Solving', 'Account Help'], voiceDescription: 'Calm, Warm, Reassuring' },
];
