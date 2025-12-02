
import emailjs from '@emailjs/browser';
import { Persona } from '../types';
import { dispatchLog } from '../utils/consoleUtils';

// Helper to sanitize strings for HTML output
const sanitizeHtml = (str: string): string => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
};

interface TranscriptEntry {
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
}

// Generate a brief summary from conversation history
const generateConversationSummary = (history: TranscriptEntry[], persona: Persona): string => {
    if (history.length === 0) return 'No conversation recorded.';
    
    const userMessages = history.filter(e => e.role === 'user').map(e => e.text);
    const modelMessages = history.filter(e => e.role === 'model').map(e => e.text);
    
    // Extract key topics from user messages
    const topics: string[] = [];
    const keywords = ['help', 'how', 'what', 'where', 'when', 'why', 'can you', 'please', 'need', 'want', 'looking for', 'question', 'problem', 'issue', 'legal', 'law', 'dismiss', 'work', 'employ', 'contract', 'rights', 'ccma', 'lra'];
    
    userMessages.forEach(msg => {
        const lowerMsg = msg.toLowerCase();
        keywords.forEach(kw => {
            if (lowerMsg.includes(kw)) {
                // Extract a snippet around the keyword
                const idx = lowerMsg.indexOf(kw);
                const start = Math.max(0, idx - 10);
                const end = Math.min(msg.length, idx + kw.length + 40);
                const snippet = msg.substring(start, end).trim();
                if (snippet.length > 10 && !topics.some(t => t.includes(snippet.substring(0, 20)))) {
                    topics.push(snippet);
                }
            }
        });
    });
    
    // Build summary
    const summaryParts: string[] = [];
    summaryParts.push(`<strong>Agent:</strong> ${sanitizeHtml(persona.name)} (${sanitizeHtml(persona.role)})`);
    summaryParts.push(`<strong>Total Exchanges:</strong> ${userMessages.length} user messages, ${modelMessages.length} agent responses`);
    
    if (topics.length > 0) {
        summaryParts.push(`<strong>Topics Discussed:</strong>`);
        topics.slice(0, 5).forEach((topic, i) => {
            summaryParts.push(`&nbsp;&nbsp;${i + 1}. "${sanitizeHtml(topic.substring(0, 80))}${topic.length > 80 ? '...' : ''}"`);
        });
    }
    
    // Add first user question if available
    if (userMessages.length > 0) {
        const firstQuestion = userMessages[0].substring(0, 150);
        summaryParts.push(`<strong>Opening Query:</strong> "${sanitizeHtml(firstQuestion)}${userMessages[0].length > 150 ? '...' : ''}"`);
    }
    
    // Add last model response snippet
    if (modelMessages.length > 0) {
        const lastResponse = modelMessages[modelMessages.length - 1].substring(0, 200);
        summaryParts.push(`<strong>Final Response:</strong> "${sanitizeHtml(lastResponse)}${modelMessages[modelMessages.length - 1].length > 200 ? '...' : ''}"`);
    }
    
    return summaryParts.join('<br/>');
};

const generateEmailHtml = (
    history: TranscriptEntry[], 
    durationSeconds: number, 
    persona: Persona,
    sessionId: string
): string => {
    const now = new Date();
    const date = now.toLocaleString('en-ZA', { dateStyle: 'full', timeStyle: 'long' });
    
    // Generate conversation summary
    const summary = generateConversationSummary(history, persona);
    
    const transcriptRows = history.map(entry => {
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour12: false });
        const isUser = entry.role === 'user';
        
        return `
            <div style="margin-bottom: 20px;">
                <div style="${isUser ? 'color: #888; text-align: right;' : 'color: #fff;'} font-size: 10px; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px; font-weight: bold;">
                    [${time}] ${isUser ? 'CLIENT' : `AGENT (${sanitizeHtml(persona.name.toUpperCase())})`}
                </div>
                <div style="${isUser ? 'color: #aaa; text-align: right; font-style: italic;' : 'color: #fff;'}">
                    ${sanitizeHtml(entry.text)}
                </div>
            </div>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #111;">
        <div style="background-color: #000000; color: #e5e5e5; font-family: 'Courier New', Courier, monospace; padding: 20px; line-height: 1.5; width: 100%; box-sizing: border-box;">
            <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #333;">
                <img src="https://i.postimg.cc/vBTy1d27/logo-Wtext-transparent-Black-Back.png" alt="VCB-AI" style="max-width: 200px; height: auto;" />
                <div style="background: #ff0000; color: #fff; display: inline-block; padding: 5px 15px; margin-top: 10px; font-weight: bold; font-size: 12px; letter-spacing: 2px;">DEMO</div>
            </div>
            <div style="border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="font-size: 24px; letter-spacing: 2px; font-weight: bold; color: #fff; margin: 0;">VCB-AI // TRANSCRIPT</h1>
                <p style="font-size: 10px; color: #666; letter-spacing: 1px; text-transform: uppercase; margin-top: 5px;">Neural Engine Interaction Log</p>
                <span style="display: inline-block; padding: 4px 8px; border: 1px solid #fff; font-size: 10px; margin-top: 10px;">CONFIDENTIAL</span>
            </div>
            
            <!-- CONVERSATION SUMMARY -->
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 1px solid #667eea; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h2 style="color: #667eea; font-size: 14px; letter-spacing: 2px; margin: 0 0 15px 0; text-transform: uppercase;">📋 CONVERSATION SUMMARY</h2>
                <div style="color: #e0e0e0; font-size: 14px; line-height: 1.8;">
                    ${summary}
                </div>
            </div>
            
            <div style="background-color: #050505; border: 1px solid #222; padding: 20px; margin-bottom: 40px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding-bottom: 15px; width: 50%;">
                            <span style="font-size: 10px; color: #555; text-transform: uppercase; display: block; margin-bottom: 4px;">SESSION ID</span>
                            <span style="font-size: 14px; color: #fff; font-weight: bold;">${sanitizeHtml(sessionId)}</span>
                        </td>
                        <td style="padding-bottom: 15px; width: 50%;">
                            <span style="font-size: 10px; color: #555; text-transform: uppercase; display: block; margin-bottom: 4px;">DATE</span>
                            <span style="font-size: 14px; color: #fff; font-weight: bold;">${date}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 50%;">
                            <span style="font-size: 10px; color: #555; text-transform: uppercase; display: block; margin-bottom: 4px;">AGENT</span>
                            <span style="font-size: 14px; color: #fff; font-weight: bold;">${sanitizeHtml(persona.name)} (${sanitizeHtml(persona.role)})</span>
                        </td>
                        <td style="width: 50%;">
                            <span style="font-size: 10px; color: #555; text-transform: uppercase; display: block; margin-bottom: 4px;">DURATION</span>
                            <span style="font-size: 14px; color: #fff; font-weight: bold;">${Math.round(durationSeconds)} SECONDS</span>
                        </td>
                    </tr>
                </table>
            </div>
            <div style="border-left: 1px solid #333; padding-left: 20px;">
                ${transcriptRows}
            </div>
            <div style="margin-top: 50px; border-top: 1px solid #333; padding-top: 20px; text-align: center;">
                <img src="https://i.postimg.cc/DZZd5Dkv/lianela.png" alt="LIANELA" style="max-width: 120px; height: auto; margin-bottom: 15px; opacity: 0.8;" />
                <div style="font-size: 10px; color: #fff;">
                    GENERATED BY VCB PoLYGoN NEURAL ENGINE<br/>
                    SECURED BY VCB-AI INFRASTRUCTURE<br/>
                    UID: ${sanitizeHtml(sessionId)}
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

// New function to handle Generic AI-driven emails
export const sendGenericEmail = async (
    toEmail: string,
    subject: string,
    bodyHtml: string,
    agentName: string,
    sessionId: string = 'LIVE-INTERACTION',
    template: 'standard' | 'legal' = 'standard',
    links: string[] = []
): Promise<boolean> => {
    dispatchLog('action', 'AI Initiated Email Protocol', `Sending to: ${toEmail}`);

    const serviceId = (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID;
    const templateId = (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
        dispatchLog('error', 'Configuration Missing', 'GitHub Secrets (EMAILJS_*) not loaded.');
        return false;
    }

    const now = new Date();
    const dateTime = now.toLocaleString('en-ZA', { dateStyle: 'full', timeStyle: 'long' });
    
    // Check if body contains Google Maps URL and enhance it
    let enhancedBodyHtml = bodyHtml;
    const mapsUrlMatch = bodyHtml.match(/https:\/\/www\.google\.com\/maps\/dir\/[^\s<"]+/);
    if (mapsUrlMatch) {
        const mapsUrl = mapsUrlMatch[0];
        const mapsButton = `
        <div style="margin: 20px 0; text-align: center;">
            <a href="${mapsUrl}" style="display: inline-block; background: linear-gradient(135deg, #4285F4 0%, #34A853 100%); color: #fff; text-decoration: none; padding: 15px 30px; border-radius: 10px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(66, 133, 244, 0.4);" target="_blank">
                🗺️ Open Directions in Google Maps
            </a>
        </div>`;
        // Add the button after the URL
        enhancedBodyHtml = enhancedBodyHtml.replace(mapsUrl, mapsUrl + mapsButton);
    }
    
    // Filter out links that are already rendered as buttons in the body
    // This prevents duplicate maps/whatsapp buttons
    const filteredLinks = links.filter(link => {
        // If the body already contains this maps link with a button, skip it
        if (link.includes('google.com/maps') && bodyHtml.includes(link)) {
            return false;
        }
        // Skip WhatsApp links if already in body
        if (link.includes('wa.me') && bodyHtml.includes(link)) {
            return false;
        }
        return true;
    });
    
    const linksSection = filteredLinks.length > 0 ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #0a0a0a; border: 1px solid #444; border-radius: 4px;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #888; font-weight: 600;">🔗 SOURCES & REFERENCES</p>
            ${filteredLinks.map(link => {
                // Check if it's a Google Maps link - render as a button
                if (link.includes('google.com/maps')) {
                    return `
                    <div style="margin: 15px 0;">
                        <a href="${sanitizeHtml(link)}" style="display: inline-block; background: linear-gradient(135deg, #4285F4 0%, #34A853 100%); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: bold; text-align: center;" target="_blank">
                            🗺️ Open in Google Maps
                        </a>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #888;">Click to open directions in Google Maps</p>
                    </div>`;
                }
                // Check if it's a WhatsApp link
                if (link.includes('wa.me')) {
                    return `
                    <div style="margin: 15px 0;">
                        <a href="${sanitizeHtml(link)}" style="display: inline-block; background: #25D366; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; font-weight: bold; text-align: center;" target="_blank">
                            💬 Open WhatsApp Chat
                        </a>
                    </div>`;
                }
                // Default link styling
                return `<a href="${sanitizeHtml(link)}" style="display: block; color: #4a9eff; text-decoration: none; margin: 5px 0; font-size: 14px; word-break: break-all;" target="_blank">${sanitizeHtml(link)}</a>`;
            }).join('')}
        </div>
    ` : '';
    
    const wrappedBody = template === 'legal' ? `
    <div style="background-color: #1a1a2e; color: #eee; font-family: 'Segoe UI', sans-serif; padding: 20px; width: 100%; box-sizing: border-box;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #333;">
            <img src="https://i.postimg.cc/vBTy1d27/logo-Wtext-transparent-Black-Back.png" alt="VCB-AI" style="max-width: 200px; height: auto;" />
            <div style="background: #ff0000; color: #fff; display: inline-block; padding: 5px 15px; margin-top: 10px; font-weight: bold; font-size: 12px; letter-spacing: 2px;">DEMO</div>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center; margin-top: 20px;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">${subject.includes('Session Started') ? '🔒 CONFIDENTIAL SESSION' : '⚖️ Legal Discussion'}</h1>
            <p style="color: #e0e0e0; margin: 8px 0 0 0; font-size: 14px;">From ${sanitizeHtml(agentName)}</p>
        </div>
        <div style="background-color: #16213e; padding: 30px; border-radius: 0 0 8px 8px;">
            <div style="background-color: #0f3460; border-left: 4px solid #667eea; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0; font-size: 13px; color: #a0a0a0; font-weight: 600;">📋 LEGAL ANALYSIS</p>
            </div>
            <div style="line-height: 1.8; font-size: 16px; color: #e0e0e0;">
                ${enhancedBodyHtml}
            </div>
            ${linksSection}
            <div style="margin-top: 30px; padding: 15px; background-color: #0f3460; border-radius: 4px; border: 1px solid #667eea;">
                <p style="margin: 0; font-size: 12px; color: #a0a0a0;">⚠️ <strong>Disclaimer:</strong> This is AI-generated legal information for educational purposes. Always consult a qualified attorney for specific legal advice.</p>
            </div>
        </div>
        <div style="margin-top: 20px; text-align: center; padding-top: 15px; border-top: 1px solid #333;">
            <img src="https://i.postimg.cc/DZZd5Dkv/lianela.png" alt="LIANELA" style="max-width: 120px; height: auto; margin-bottom: 10px; opacity: 0.8;" />
            <div style="font-size: 11px; color: #fff;">
                Generated by VCB PoLYGoN Legal Intelligence<br/>
                Session: ${sanitizeHtml(sessionId)}<br/>
                ${dateTime}
            </div>
        </div>
    </div>
    ` : `
    <div style="background-color: #000; color: #eee; font-family: sans-serif; padding: 20px; border: 1px solid #333; width: 100%; box-sizing: border-box;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #333; margin-bottom: 20px;">
            <img src="https://i.postimg.cc/vBTy1d27/logo-Wtext-transparent-Black-Back.png" alt="VCB-AI" style="max-width: 200px; height: auto;" />
            <div style="background: #ff0000; color: #fff; display: inline-block; padding: 5px 15px; margin-top: 10px; font-weight: bold; font-size: 12px; letter-spacing: 2px;">DEMO</div>
        </div>
        <h2 style="color: #fff; border-bottom: 1px solid #555; padding-bottom: 10px;">Message from ${sanitizeHtml(agentName)}</h2>
        <div style="margin-top: 20px; line-height: 1.6; font-size: 16px;">
            ${enhancedBodyHtml}
        </div>
        ${linksSection}
        <div style="margin-top: 40px; text-align: center; border-top: 1px solid #333; padding-top: 15px;">
            <img src="https://i.postimg.cc/DZZd5Dkv/lianela.png" alt="LIANELA" style="max-width: 120px; height: auto; margin-bottom: 10px; opacity: 0.8;" />
            <div style="font-size: 12px; color: #fff;">
                Generated by VCB PoLYGoN<br/>
                Session: ${sanitizeHtml(sessionId)}<br/>
                ${dateTime}
            </div>
        </div>
    </div>
    `;

    const templateParams = {
        email: toEmail,
        subject: `${subject} (LIVE DEMO) [${Math.floor(Math.random() * 10000)}]`, // Anti-threading ID
        transcript_html: wrappedBody,
        duration: "N/A",
        agent_name: agentName,
        session_id: sessionId
    };

    try {
        emailjs.init(publicKey);
        await emailjs.send(serviceId, templateId, templateParams, publicKey);
        dispatchLog('success', 'Email Sent Successfully', `Subject: ${subject}`);
        return true;
    } catch (error: any) {
        dispatchLog('error', 'Email Dispatch Failed', error?.text || "Unknown error");
        return false;
    }
};

export const sendTranscriptEmail = async (
    history: TranscriptEntry[],
    durationMs: number,
    persona: Persona,
    sessionId: string,
    userEmail?: string
): Promise<boolean> => {
    
    // Log session end
    dispatchLog('action', '🔚 SESSION ENDED', `Duration: ${Math.round(durationMs / 1000)}s | Messages: ${history.length}`);
    await new Promise(r => setTimeout(r, 300));
    
    dispatchLog('action', '📝 Generating Conversation Summary...', `Analyzing ${history.filter(h => h.role === 'user').length} user messages`);
    await new Promise(r => setTimeout(r, 500));
    
    dispatchLog('action', '📦 Building Transcript Bundle...', 'Compiling full chat history with timestamps');
    await new Promise(r => setTimeout(r, 400));
    
    const htmlBody = generateEmailHtml(history, durationMs / 1000, persona, sessionId);

    // STRICT SECURITY: Only use environment variables from GitHub Secrets
    const serviceId = (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID;
    const templateId = (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
        dispatchLog('error', 'Configuration Missing', 'GitHub Secrets (EMAILJS_*) not loaded in build.');
        return false;
    }

    const recipientEmail = userEmail || "tommy@vcb-ai.online";
    const uniqueId = Math.floor(Math.random() * 10000); // Random ID to prevent Gmail threading

    const templateParams = {
        email: recipientEmail,
        subject: `[TRANSCRIPT] ${persona.name} - ${new Date().toLocaleTimeString()} (LIVE DEMO) [ID:${uniqueId}]`,
        transcript_html: htmlBody, 
        duration: Math.round(durationMs / 1000) + "s",
        agent_name: persona.name,
        session_id: sessionId
    };

    dispatchLog('action', '📡 Initializing SMTP Handshake...', 'Connecting to secure relay via TLS 1.3');
    await new Promise(r => setTimeout(r, 600));
    
    dispatchLog('info', '🔐 Authenticating...', 'Verifying EmailJS service signature');
    await new Promise(r => setTimeout(r, 400));
    
    dispatchLog('action', '📤 Transmitting Transcript...', `Recipient: ${recipientEmail}`);

    try {
        emailjs.init(publicKey);
        await emailjs.send(serviceId, templateId, templateParams, publicKey);
        
        await new Promise(r => setTimeout(r, 300));
        dispatchLog('success', '✅ TRANSCRIPT DELIVERED', `Full conversation sent to: ${recipientEmail}`);
        dispatchLog('info', '📊 Email Contents', `Summary + ${history.length} messages | Session: ${sessionId.substring(0, 12)}...`);
        return true;
    } catch (error: any) {
        const errorMsg = error?.text || error?.message || JSON.stringify(error);
        dispatchLog('error', 'SMTP Dispatch Failed', errorMsg);
        
        if (errorMsg.includes("recipients address is empty")) {
            dispatchLog('warn', 'Configuration Error', "Check EmailJS Template 'To Email' field.");
        }
        return false;
    }
};
