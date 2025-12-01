# BUA-X1 Project Overview

## Purpose
BUA-X1 (VCB PoLYGoT AI Voice Engine) is a production-grade multilingual voice chat application supporting all 11 official South African languages. It uses Google's Gemini Live API with native audio streaming for real-time bidirectional voice conversations with AI personas.

## Core Features
- Real-time bidirectional voice communication (Native Audio via Gemini Live API)
- Vision/Camera integration for visual context sharing
- 11 South African language support with natural code-switching
- Multiple AI personas with distinct personalities and roles
- Comprehensive tool calling (email, maps, search, calendar, reminders, etc.)
- Enterprise-grade transcript emailing via EmailJS
- Push-to-talk and voice activity detection modes

## Tech Stack
- **Frontend**: React 18 + TypeScript
- **Build**: Vite 7.2.4
- **Styling**: Tailwind CSS 3.4
- **AI Backend**: Google Gemini Live API (@google/genai ^1.30.0)
- **Email**: EmailJS (@emailjs/browser)
- **Icons**: Lucide React

## Key Dependencies
```json
{
  "@google/genai": "^1.30.0",    // Gemini Live API client
  "@emailjs/browser": "^4.1.0",  // Email service
  "lucide-react": "^0.344.0",    // Icons
  "react": "^18.2.0"
}
```

## Target Users
- South African businesses needing multilingual AI assistants
- Call centers requiring 11-language support
- Legal services (LRA document queries)
- Sales teams with persona-based AI agents
