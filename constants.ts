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
import { zamaPersona } from './personas/zama';

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
  description: 'CRITICAL TOOL: Send email with full context to user. Call IMMEDIATELY when: user says "email me", "send me that", "email this", "send to my email", agrees to receive info, or after providing directions/search results/legal advice. System auto-includes: maps directions, search results, conversation context, location. Proactively offer: "Would you like me to email this to you?"',
  parameters: {
    type: Type.OBJECT,
    properties: {
      subject: { type: Type.STRING, description: 'Clear, descriptive subject line' },
      body: { type: Type.STRING, description: 'Detailed message content - be comprehensive, system adds extra context automatically' },
      recipient_email: { type: Type.STRING, description: 'Optional recipient (defaults to user email from system context)' },
      template: { type: Type.STRING, enum: ['standard', 'legal'], description: 'Use legal for legal advice, standard for everything else' }
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
  description: 'Open Google Maps with directions. Use when user asks: "directions to", "how do I get to", "navigate to", "take me to", "where is", or any location/navigation request. ALWAYS offer to email directions after opening: "Would you like me to email you these directions?" The email will include clickable Google Maps link.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      destination: { type: Type.STRING, description: 'Full destination address, place name, or business name' },
      mode: { type: Type.STRING, enum: ['driving', 'walking', 'transit'], description: 'Travel mode - driving (default), walking, or transit/public transport' }
    },
    required: ['destination'],
  },
};

const MAKE_CALL_FUNC: FunctionDeclaration = {
  name: 'make_call',
  description: 'Initiate a phone call on the user\'s device. Use when user says "call", "phone", "ring", or asks to contact someone by voice. Opens the phone dialer with the number pre-filled.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      phone_number: { type: Type.STRING, description: 'Phone number with country code (e.g., +27123456789 for South Africa)' },
      contact_name: { type: Type.STRING, description: 'Name of person/business being called (for confirmation message)' }
    },
    required: ['phone_number'],
  },
};

const OPEN_WHATSAPP_FUNC: FunctionDeclaration = {
  name: 'open_whatsapp',
  description: 'Open WhatsApp to send a message. Use when user says "WhatsApp", "send a WhatsApp", or "message on WhatsApp". Opens WhatsApp with chat and optional pre-filled message.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      phone_number: { type: Type.STRING, description: 'Phone number WITHOUT plus sign, with country code (e.g., 27123456789 for South Africa)' },
      message: { type: Type.STRING, description: 'Pre-filled message text that user can edit before sending (optional)' }
    },
    required: ['phone_number'],
  },
};

const COPY_TO_CLIPBOARD_FUNC: FunctionDeclaration = {
  name: 'copy_to_clipboard',
  description: 'Copy important text to clipboard for easy pasting. Use when: user asks to "copy", "save this", "remember this", or when sharing phone numbers, addresses, reference numbers, important quotes, or any text user might want to paste elsewhere. Confirm what was copied.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'The exact text to copy - format it cleanly for easy use' }
    },
    required: ['text'],
  },
};

const SET_REMINDER_FUNC: FunctionDeclaration = {
  name: 'set_reminder',
  description: 'Set a notification reminder. Use when user says: "remind me", "set a reminder", "alert me", "notify me", "don\'t let me forget". Also proactively offer for important deadlines (e.g., CCMA 30-day referral, payment due dates, appointment times). Always confirm the reminder details.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING, description: 'Clear reminder message with context (what and why)' },
      minutes: { type: Type.NUMBER, description: 'Minutes from now (e.g., 5, 15, 30, 60, 120 for 2 hours, 1440 for 24 hours)' }
    },
    required: ['message', 'minutes'],
  },
};

const SEND_SMS_FUNC: FunctionDeclaration = {
  name: 'send_sms',
  description: 'Open SMS app with pre-filled message. Use when user says: "SMS me", "text me", "send me a text", or when they need information on a basic phone without email/WhatsApp. Good for sending short, important info like addresses, phone numbers, appointment times.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      phone_number: { type: Type.STRING, description: 'Phone number with country code (optional - opens SMS app without recipient if empty)' },
      message: { type: Type.STRING, description: 'SMS message - keep it concise (under 160 chars is one SMS)' }
    },
    required: ['message'],
  },
};

const CREATE_CALENDAR_EVENT_FUNC: FunctionDeclaration = {
  name: 'create_calendar_event',
  description: 'Create a Google Calendar event. Use when user says "schedule", "book", "add to calendar", or "create an event". Opens Google Calendar with event pre-filled.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Event title/name' },
      date: { type: Type.STRING, description: 'Date in YYYYMMDD format (e.g., 20251215 for December 15, 2025)' },
      start_time: { type: Type.STRING, description: 'Start time in HHmm 24-hour format (e.g., 0900 for 9:00 AM, 1430 for 2:30 PM)' },
      end_time: { type: Type.STRING, description: 'End time in HHmm 24-hour format (optional, defaults to start_time)' },
      details: { type: Type.STRING, description: 'Event description or notes (optional)' }
    },
    required: ['title', 'date', 'start_time'],
  },
};

const SHARE_CONTENT_FUNC: FunctionDeclaration = {
  name: 'share_content',
  description: 'Open native share menu to share via any app (WhatsApp, email, social media, etc). Use when user wants to share information with others: "share this", "send this to my friend", "post this". Particularly useful on mobile devices.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Title for the share (appears in some apps)' },
      text: { type: Type.STRING, description: 'Main content to share - make it complete and well-formatted' },
      url: { type: Type.STRING, description: 'Optional URL to include (e.g., Google Maps link, website)' }
    },
    required: ['text'],
  },
};

const FETCH_URL_FUNC: FunctionDeclaration = {
  name: 'fetch_url_content',
  description: 'Fetch and read content from a website URL. Use when: user shares a link and asks "what does this say?", "summarize this page", "read this for me", or when you need to verify/expand on search results. After fetching, offer to email the content. Do NOT auto-fetch without user request.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: 'The full URL to fetch (must include https://)' },
      custom_instruction: { type: Type.STRING, description: 'Optional focus instruction: "extract contact info", "find prices", "summarize main points", etc.' }
    },
    required: ['url'],
  },
};

const PROMPT_SCREEN_SHARE_FUNC: FunctionDeclaration = {
  name: 'prompt_screen_share',
  description: 'Request user to share their screen/desktop so you can see and help guide them. Use like a buddy: "Hey, would you mind showing me your screen? I\'d love to help you through this!", "Share your desktop with me and I\'ll guide you step by step", "I\'d really like to see what you\'re looking at - can you share your screen?". Use when: user needs help navigating software, has technical issues, wants guidance through a process, or mentions they\'re stuck on something visual.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: { type: Type.STRING, description: 'Friendly reason for requesting screen share - be warm and helpful, like a buddy wanting to assist' }
    },
    required: ['reason'],
  },
};

const PROMPT_CAMERA_SHARE_FUNC: FunctionDeclaration = {
  name: 'prompt_camera_share',
  description: 'Request user to share their camera so you can see what they see. Use like a buddy: "Could you show me with your camera? I\'d love to see what you\'re dealing with!", "Point your phone camera at it - let me take a look!", "I really want to help - would you mind showing me?". Use when: user describes something physical they need help with (product, document, error on screen, broken item, something they want identified), or when visual context would help you provide better assistance.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: { type: Type.STRING, description: 'Friendly reason for requesting camera - be warm and curious, like a friend wanting to help' }
    },
    required: ['reason'],
  },
};

const REQUEST_LOCATION_FUNC: FunctionDeclaration = {
  name: 'request_location',
  description: 'Request user to share their GPS location when you need it for location-based services. Use when: user asks for nearby places, directions, local recommendations, weather, or any service that requires knowing where they are. Say warmly: "I\'d love to help you find that! Could you share your location with me?", "To give you the best recommendations, I need to know where you are - mind sharing your location?", "Let me find that for you - just need your location first!"',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: { type: Type.STRING, description: 'Friendly reason for needing location - be helpful and explain why it will benefit them' }
    },
    required: ['reason'],
  },
};

export const LIVE_API_TOOLS: Tool[] = [
  { functionDeclarations: [LANGUAGE_FUNC, EMAIL_FUNC, QUERY_LRA_FUNC, OPEN_MAPS_FUNC, MAKE_CALL_FUNC, OPEN_WHATSAPP_FUNC, COPY_TO_CLIPBOARD_FUNC, SET_REMINDER_FUNC, SEND_SMS_FUNC, CREATE_CALENDAR_EVENT_FUNC, SHARE_CONTENT_FUNC, FETCH_URL_FUNC, PROMPT_SCREEN_SHARE_FUNC, PROMPT_CAMERA_SHARE_FUNC, REQUEST_LOCATION_FUNC] },
  { googleSearch: {} },
];

export const PERSONAS: Persona[] = [
  { ...darkMatterPersona, name: 'LIANELA', gender: 'Female', role: 'Legal Intelligence', vibe: 'Elite Legal Mind', description: 'A classified beta prototype trained by Advocate Basson. Surgical legal precision, but delivered with the reassurance of a high-end counsel.', icon: 'scale', maxDurationSeconds: 300, capabilities: ['Labour Law (LRA 2025)', 'High Court Litigation', 'Constitutional Law', 'Case Law Search'], voiceDescription: 'Sophisticated, Articulate, Reassuring, South African "Silk" accent.' },
  { ...vcbAgentPersona, gender: 'Female', role: 'Sales Specialist', vibe: 'The Closer', description: 'Your dedicated sales engine. She uses SPIN selling frameworks to demo the power of the Bua X1 engine itself.', icon: 'zap', maxDurationSeconds: 300, capabilities: ['Sales Closing', 'Sentiment Analysis', 'Objection Handling', 'Value Proposition'], voiceDescription: 'Confident, Model C with code-switching' },
  { ...thaboPersona, gender: 'Male', role: 'The Executive', vibe: 'High-Stakes Corporate', description: 'The relentless strategist. Ideal for boardroom simulations, JSE market analysis, and executive coaching.', icon: 'briefcase', maxDurationSeconds: 300, capabilities: ['Corporate Strategy', 'JSE Markets', 'ROI Analysis', 'Executive Coaching'], voiceDescription: 'Deep, Authoritative, Sandton Accent' },
  { ...vusiPersona, gender: 'Male', role: 'The Gent', vibe: 'Kasi Energy', description: 'The pulse of the street. Perfect for testing slang handling, energetic engagement, and local pop culture.', icon: 'zap', maxDurationSeconds: 300, capabilities: ['Tsotsitaal', 'Street Smarts', 'Diski / Soccer', 'High Energy'], voiceDescription: 'Fast, Energetic, Kasi Flavor' },
  { ...siphoPersona, gender: 'Male', role: 'The Elder', vibe: 'Ancient Wisdom', description: 'The guardian of heritage. Best for deep storytelling, cultural mediation, and calm, thoughtful interaction.', icon: 'scroll', maxDurationSeconds: 300, capabilities: ['Heritage', 'Storytelling', 'Cultural Mediation', 'Proverbs'], voiceDescription: 'Resonant, Slow, Fatherly' },
  { ...thandiPersona, gender: 'Female', role: 'The Director', vibe: 'Ruthless Efficiency', description: 'The operations dynamo. Use her to test rapid problem solving, logistics planning, and direct communication.', icon: 'target', maxDurationSeconds: 300, capabilities: ['Operations', 'Efficiency', 'Logistics', 'Strategic Planning'], voiceDescription: 'Crisp, Fast, Direct' },
  { ...leratoPersona, gender: 'Female', role: 'The Optimist', vibe: 'Radical Empathy', description: "The nation's therapist. Designed for wellness checks, comforting dialogue, and de-escalation scenarios.", icon: 'sun', maxDurationSeconds: 300, capabilities: ['Radical Empathy', 'Wellness', 'Comfort', 'Practical Advice'], voiceDescription: 'Melodic, Soft, Soothing' },
  { ...nandiPersona, gender: 'Female', role: 'The Trendsetter', vibe: 'Viral Sensation', description: 'The trendsetter. Use to test social media literacy, Gen-Z slang adaptability, and dramatic flair.', icon: 'sparkles', maxDurationSeconds: 300, capabilities: ['Pop Culture', 'Social Media', 'Trends', 'Gossip'], voiceDescription: 'Vocal Fry, Dramatic, Sassy' },
  { ...lindiwePersona, gender: 'Female', role: 'Support Agent', vibe: 'Patient Solver', description: 'The calm in the storm. Dedicated to resolving your technical issues and account queries with infinite patience.', icon: 'life-buoy', maxDurationSeconds: 300, capabilities: ['Tech Support', 'De-escalation', 'Problem Solving', 'Account Help'], voiceDescription: 'Calm, Warm, Reassuring' },
  { ...zamaPersona, gender: 'Female', role: 'Visual Companion', vibe: 'Your Eyes, Your Friend', description: 'Camera-REQUIRED interactive companion. She sees YOU - your face, expressions, surroundings. Turn on your camera to engage!', icon: 'eye', maxDurationSeconds: 300, capabilities: ['Facial Expression Reading', 'Emotion Detection', 'Environment Analysis', 'Visual Curiosity'], voiceDescription: 'Warm, Observant, Playfully Curious', requiresCamera: true },
];
