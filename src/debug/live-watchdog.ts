// live-watchdog.ts
// Brutally honest session watchdog for diagnosing premature Live API closures.

// Helper to sanitize strings for logging
const sanitizeLog = (str: string): string => {
  return str.replace(/[\n\r\t]/g, ' ').substring(0, 200); // Remove newlines and limit length
};

export function createWatchdog() {
  const log = (msg: string, ...args: any[]) => {
    const sanitizedMsg = sanitizeLog(msg);
    // eslint-disable-next-line no-console
    console.log(`%c[WATCHDOG] ${sanitizedMsg}`, "color:#0ff;font-weight:bold", ...args);
  };

  let opened = false;
  let closed = false;
  let firstTurnSent = false;
  let lastActivity = Date.now();

  // 20s idle timeout check
  const timer = setInterval(() => {
    if (!opened || closed) return;

    const idle = (Date.now() - lastActivity) / 1000;

    if (!firstTurnSent && idle > 10) {
      log("⚠️ Session has been open 10s with NO turn sent.");
      log("This is the #1 cause of sudden session closures.");
    }

    if (idle > 15) {
      log("⚠️ No activity for 15s. Something is stalling.");
    }
  }, 2000);

  return {
    markOpened() {
      opened = true;
      lastActivity = Date.now();
      log("✓ Session opened");
    },

    markClosed(reason?: any) {
      closed = true;
      clearInterval(timer);
      log("✖ Session closed", reason);
    },

    markTurnSent() {
      firstTurnSent = true;
      lastActivity = Date.now();
      log("✓ First turn sent");
    },

    markTraffic(eventName: string) {
      lastActivity = Date.now();
      log(`↺ Activity: ${eventName}`);
    },

    markError(err: any) {
      lastActivity = Date.now();
      log("🔥 ERROR", err);
    }
  };
}

export default { createWatchdog };
