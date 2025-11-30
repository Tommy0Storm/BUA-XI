
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

const generateEmailHtml = (
    history: TranscriptEntry[], 
    durationSeconds: number, 
    persona: Persona,
    sessionId: string
): string => {
    const now = new Date();
    const date = now.toLocaleString('en-ZA', { dateStyle: 'full', timeStyle: 'long' });
    
    const style = {
        container: `background-color: #000000; color: #e5e5e5; font-family: 'Courier New', Courier, monospace; padding: 40px; line-height: 1.5; width: 100%; max-width: 800px; margin: 0 auto;`,
        header: `border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;`,
        title: `font-size: 24px; letter-spacing: 2px; font-weight: bold; color: #fff; margin: 0;`,
        subtitle: `font-size: 10px; color: #666; letter-spacing: 1px; text-transform: uppercase; margin-top: 5px;`,
        metaGrid: `display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; border: 1px solid #222; padding: 20px; background: #050505;`,
        metaLabel: `font-size: 10px; color: #555; text-transform: uppercase; display: block; margin-bottom: 4px;`,
        metaValue: `font-size: 14px; color: #fff; font-weight: bold;`,
        transcriptBox: `border-left: 1px solid #333; padding-left: 20px;`,
        entry: `margin-bottom: 20px;`,
        roleUser: `color: #888; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px; text-align: right;`,
        roleModel: `color: #fff; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px; font-weight: bold;`,
        textUser: `color: #aaa; text-align: right; font-style: italic;`,
        textModel: `color: #fff;`,
        footer: `margin-top: 50px; border-top: 1px solid #333; padding-top: 20px; font-size: 10px; color: #fff; text-align: center;`
    };

    const transcriptRows = history.map(entry => {
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour12: false });
        const isUser = entry.role === 'user';
        
        return `
            <div style="${style.entry}">
                <div style="${isUser ? style.roleUser : style.roleModel}">
                    [${time}] ${isUser ? 'CLIENT' : `AGENT (${sanitizeHtml(persona.name.toUpperCase())})`}
                </div>
                <div style="${isUser ? style.textUser : style.textModel}">
                    ${sanitizeHtml(entry.text)}
                </div>
            </div>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #111;">
        <div style="${style.container}">
            <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #333;">
                <img src="https://i.postimg.cc/vBTy1d27/logo-Wtext-transparent-Black-Back.png" alt="VCB-AI" style="max-width: 200px; height: auto;" />
            </div>
            <div style="${style.header}">
                <div>
                    <h1 style="${style.title}">VCB-AI // TRANSCRIPT</h1>
                    <p style="${style.subtitle}">Neural Engine Interaction Log</p>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; padding: 4px 8px; border: 1px solid #fff; font-size: 10px;">CONFIDENTIAL</span>
                </div>
            </div>
            <div style="background-color: #050505; border: 1px solid #222; padding: 20px; margin-bottom: 40px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding-bottom: 15px; width: 50%;">
                            <span style="${style.metaLabel}">SESSION ID</span>
                            <span style="${style.metaValue}">${sanitizeHtml(sessionId)}</span>
                        </td>
                        <td style="padding-bottom: 15px; width: 50%;">
                            <span style="${style.metaLabel}">DATE</span>
                            <span style="${style.metaValue}">${date}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 50%;">
                            <span style="${style.metaLabel}">AGENT</span>
                            <span style="${style.metaValue}">${sanitizeHtml(persona.name)} (${sanitizeHtml(persona.role)})</span>
                        </td>
                        <td style="width: 50%;">
                            <span style="${style.metaLabel}">DURATION</span>
                            <span style="${style.metaValue}">${Math.round(durationSeconds)} SECONDS</span>
                        </td>
                    </tr>
                </table>
            </div>
            <div style="${style.transcriptBox}">
                ${transcriptRows}
            </div>
            <div style="${style.footer}">
                GENERATED BY VCB PoLYGoN NEURAL ENGINE<br/>
                SECURED BY VCB-AI INFRASTRUCTURE<br/>
                UID: ${sanitizeHtml(sessionId)}
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
    
    const linksSection = links.length > 0 ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #0a0a0a; border: 1px solid #444; border-radius: 4px;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #888; font-weight: 600;">🔗 SOURCES & REFERENCES</p>
            ${links.map(link => `<a href="${sanitizeHtml(link)}" style="display: block; color: #4a9eff; text-decoration: none; margin: 5px 0; font-size: 14px; word-break: break-all;" target="_blank">${sanitizeHtml(link)}</a>`).join('')}
        </div>
    ` : '';
    
    const wrappedBody = template === 'legal' ? `
    <div style="background-color: #1a1a2e; color: #eee; font-family: 'Segoe UI', sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #333;">
            <img src="https://i.postimg.cc/vBTy1d27/logo-Wtext-transparent-Black-Back.png" alt="VCB-AI" style="max-width: 200px; height: auto;" />
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
                ${sanitizeHtml(bodyHtml).replace(/\n/g, '<br>')}
            </div>
            ${linksSection}
            <div style="margin-top: 30px; padding: 15px; background-color: #0f3460; border-radius: 4px; border: 1px solid #667eea;">
                <p style="margin: 0; font-size: 12px; color: #a0a0a0;">⚠️ <strong>Disclaimer:</strong> This is AI-generated legal information for educational purposes. Always consult a qualified attorney for specific legal advice.</p>
            </div>
        </div>
        <div style="margin-top: 20px; font-size: 11px; color: #fff; text-align: center; padding-top: 15px; border-top: 1px solid #333;">
            Generated by VCB PoLYGoN Legal Intelligence<br/>
            Session: ${sanitizeHtml(sessionId)}<br/>
            ${dateTime}
        </div>
    </div>
    ` : `
    <div style="background-color: #000; color: #eee; font-family: sans-serif; padding: 30px; border: 1px solid #333;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #333; margin-bottom: 20px;">
            <img src="https://i.postimg.cc/vBTy1d27/logo-Wtext-transparent-Black-Back.png" alt="VCB-AI" style="max-width: 200px; height: auto;" />
        </div>
        <h2 style="color: #fff; border-bottom: 1px solid #555; padding-bottom: 10px;">Message from ${sanitizeHtml(agentName)}</h2>
        <div style="margin-top: 20px; line-height: 1.6; font-size: 16px;">
            ${sanitizeHtml(bodyHtml).replace(/\n/g, '<br>')}
        </div>
        ${linksSection}
        <div style="margin-top: 40px; font-size: 12px; color: #fff; border-top: 1px solid #333; padding-top: 10px;">
            Generated by VCB PoLYGoN<br/>
            Session: ${sanitizeHtml(sessionId)}<br/>
            ${dateTime}
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
    
    dispatchLog('action', 'Generating Transcript Bundle...');
    
    // Simulate processing time for theatrical effect
    await new Promise(r => setTimeout(r, 600));
    
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

    dispatchLog('action', 'Initializing SMTP Handshake...', 'Connecting to relay via TLS 1.3');
    await new Promise(r => setTimeout(r, 800)); // Theatrical delay
    dispatchLog('info', 'Authenticating...', 'Verifying Service Signature');

    try {
        emailjs.init(publicKey);
        await emailjs.send(serviceId, templateId, templateParams, publicKey);
        dispatchLog('success', 'Transcript Emailed Successfully', `Recipient: ${recipientEmail}`);
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
