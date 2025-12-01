# Voice Catalog - Gemini Live API

## Overview
This document maps each persona to their assigned voice from Google's Gemini Live API voice catalog. It serves as operational documentation for voice selection and quality assurance.

## Voice Mapping Table

| Persona | Voice Name | Target Accent/Style | Voice Description | Status | Last Verified |
|---------|------------|---------------------|-------------------|--------|---------------|
| **VCB Agent (Thuli)** | `Kore` | South African Model C | Confident, articulate, code-switching capable | ✅ Active | 2025-01-XX |
| **LIANELA (Dark Matter)** | `Puck` | SA "Silk" (Legal) | Sophisticated, reassuring, authoritative | ✅ Active | 2025-01-XX |
| **Thabo** | `Charon` | Sandton Executive | Deep, authoritative, corporate | ✅ Active | 2025-01-XX |
| **Vusi** | `Fenrir` | Kasi Energy | Fast, energetic, street-smart | ✅ Active | 2025-01-XX |
| **Sipho** | `Orbit` | Elder/Wisdom | Resonant, slow, fatherly | ✅ Active | 2025-01-XX |
| **Thandi** | `Aoede` | Direct/Efficient | Crisp, fast, no-nonsense | ✅ Active | 2025-01-XX |
| **Lerato** | `Kore` | Empathetic/Warm | Melodic, soft, soothing | ✅ Active | 2025-01-XX |
| **Nandi** | `Puck` | Gen-Z Trendsetter | Vocal fry, dramatic, sassy | ✅ Active | 2025-01-XX |
| **Lindiwe** | `Aoede` | Support Agent | Calm, warm, reassuring | ✅ Active | 2025-01-XX |

## Voice Characteristics

### Kore
- **Gender**: Female
- **Tone**: Confident, professional
- **Best For**: Sales, empathy, general assistance
- **Accent Fidelity**: Neutral with adaptability
- **Used By**: VCB Agent, Lerato

### Puck
- **Gender**: Neutral/Androgynous
- **Tone**: Sophisticated, articulate
- **Best For**: Legal, professional, trendsetting
- **Accent Fidelity**: Clear enunciation
- **Used By**: LIANELA, Nandi

### Charon
- **Gender**: Male
- **Tone**: Deep, authoritative
- **Best For**: Executive, leadership, strategy
- **Accent Fidelity**: Corporate professional
- **Used By**: Thabo

### Fenrir
- **Gender**: Male
- **Tone**: Energetic, dynamic
- **Best For**: Youth engagement, high energy
- **Accent Fidelity**: Adaptable to slang
- **Used By**: Vusi

### Orbit
- **Gender**: Male
- **Tone**: Resonant, measured
- **Best For**: Wisdom, storytelling, calm authority
- **Accent Fidelity**: Deep, fatherly
- **Used By**: Sipho

### Aoede
- **Gender**: Female
- **Tone**: Clear, efficient
- **Best For**: Support, operations, direct communication
- **Accent Fidelity**: Professional, neutral
- **Used By**: Thandi, Lindiwe

## Testing Protocol

### Voice Quality Checklist
When testing or updating voices, verify:
- [ ] Accent authenticity (South African context)
- [ ] Code-switching capability (where applicable)
- [ ] Emotional range (excitement, concern, reassurance)
- [ ] Pronunciation of SA-specific terms (robot, now-now, just-now, loadshedding)
- [ ] Multi-language support (11 SA languages)
- [ ] Interruption handling (natural stop/resume)

### Sample Test Phrases
Use these to evaluate voice fidelity:
1. "I'll meet you at the robot, just now."
2. "Eish, loadshedding again? Now now we'll sort it out."
3. "Let me check the LRA for that dismissal clause."
4. "Howzit! Sharp sharp, let's get this done."
5. Code-switching: "Yebo, I understand. Let me explain in English..."

## Voice Provider Updates

### Google Gemini Live API Voice Catalog
- **API Endpoint**: Managed by `@google/genai` SDK
- **Voice Selection**: Set via `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`
- **Documentation**: [Google AI Studio - Voice Catalog](https://ai.google.dev/)

### Change Log
| Date | Voice | Change | Reason | Updated By |
|------|-------|--------|--------|------------|
| 2025-01-XX | Initial | All voices mapped | Initial setup | Team |

## Recommendations

### Operational Best Practices
1. **Regular Testing**: Test each voice monthly with sample phrases
2. **User Feedback**: Collect feedback on accent authenticity
3. **A/B Testing**: When Google updates voices, test old vs new
4. **Fallback Strategy**: Define backup voices if primary becomes unavailable
5. **Documentation**: Update this file when voices change

### Future Enhancements
- [ ] Add audio sample links for each voice (when available from Google)
- [ ] Create automated voice testing suite
- [ ] Implement voice quality metrics (user ratings)
- [ ] Add regional accent variations (Cape Town vs Johannesburg)
- [ ] Explore custom voice training for SA accents

## Notes

### Accent Fidelity Limitations
Google's voice catalog may not perfectly replicate specific South African accents (Model C, Kasi, etc.). The `voiceDescription` field in each persona serves as:
1. **Target specification** - What we're aiming for
2. **Documentation** - Why this voice was chosen
3. **QA reference** - What to listen for during testing

### Voice Availability
Voice availability may vary by:
- API tier (free vs paid)
- Geographic region
- Model version (flash vs pro)
- Preview vs production status

Always verify voice availability in your Google AI Studio project before deployment.

## Contact
For voice-related issues or suggestions, contact the development team.
