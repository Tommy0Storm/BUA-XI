// gemini.session.ts
// cspell:disable genai
import { GoogleGenAI } from '@google/genai';
import { createGeminiClientOptions, MODELS, DEFAULT_LIVE_CONFIG } from './gemini.config';
import { createWatchdog } from './src/debug/live-watchdog';

// Module-level session singleton (helps avoid double-mounts / accidental multi-starts)
let sessionRef: any = null;

export async function startSessionOnce(createSessionFn: () => Promise<any>) {
  if (sessionRef) {
    console.warn('Session already active - skipping start.');
    return sessionRef;
  }
  try {
    sessionRef = await createSessionFn();
    return sessionRef;
  } catch (error) {
    console.error('Error starting session:', error);
    throw error;
  }
}

export async function endSessionOnce() {
  if (!sessionRef) return;
  try {
    await sessionRef.close?.();
    sessionRef = null;
  } catch (error) {
    console.error('Error ending session:', error);
    sessionRef = null; // Ensure it's cleared even on error
  }
}

export async function createLiveSession({
  model = MODELS.nativeAudio,
  config = DEFAULT_LIVE_CONFIG,
  callbacks = {},
  apiKeyOverride,
}: {
  model?: string;
  config?: any;
  callbacks?: any;
  apiKeyOverride?: string;
}) {
  const client = new GoogleGenAI(
    createGeminiClientOptions(apiKeyOverride)
  );

  const watchdog = createWatchdog();

  // Defensive wrapper: do not let onmessage errors bubble up and kill the watchdog/session.
  const wrappedCallbacks = {
    ...callbacks,
    onopen: (...args: any[]) => {
      try {
        watchdog.markOpened();
      } catch (e) {}
      try { callbacks.onopen?.(...args); } catch (err) { watchdog.markError(err); throw err; }
    },
    onmessage: (msg: any) => {
      try {
        watchdog.markTraffic('onmessage');
      } catch (e) {}
      try {
        // Protect user callbacks from throwing; log but don't rethrow so the session stays alive.
        callbacks.onmessage?.(msg);
      } catch (err) {
        try {
          watchdog.markError(err);
        } catch (e) {}
        console.error('[Live] onmessage handler error', err);
        // intentionally do not rethrow — let watchdog track the error and keep the session alive
      }
    },
    onclose: (ev: any) => {
      try { watchdog.markClosed(ev); } catch (e) {}
      try { callbacks.onclose?.(ev); } catch (err) { watchdog.markError(err); }
    },
    onerror: (err: any) => {
      try { watchdog.markError(err); } catch (e) {}
      try { callbacks.onerror?.(err); } catch (err2) { watchdog.markError(err2); }
    }
  } as any;

  const session = await client.live.connect({ model, config, callbacks: wrappedCallbacks } as any);

  // Mark session as unsafe for mic/interrupt for a short window after open
  try {
    (session as any).__safeToSpeak = false;
    setTimeout(() => {
      try {
        (session as any).__safeToSpeak = true;
      } catch (e) {
        console.error('Error setting safeToSpeak:', e);
      }
    }, 1200);
  } catch (e) {
    console.error('Error initializing safeToSpeak:', e);
  }

  // Wrap sendClientContent to mark when the first turn is sent (helps detect silent opens)
  try {
    const originalSend = (session as any).sendClientContent?.bind(session);
    if (originalSend) {
      (session as any).sendClientContent = async (...args: any[]) => {
        try {
          watchdog.markTurnSent();
        } catch (e) {
          console.error('Watchdog markTurnSent error:', e);
        }
        return originalSend(...args);
      };
    }
  } catch (e) {
    console.error('Error wrapping sendClientContent:', e);
  }

  return session;
}

export default createLiveSession;
