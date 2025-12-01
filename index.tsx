import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// PERFORMANCE: Force passive event listeners for scroll-blocking events
// This fixes warnings from third-party scripts (Grammarly, Google, etc.)
(function() {
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    const passiveEvents = ['touchstart', 'touchmove', 'touchend', 'wheel', 'mousewheel'];
    if (passiveEvents.includes(type)) {
      const opts = typeof options === 'object' ? { ...options, passive: true } : { passive: true, capture: !!options };
      return originalAddEventListener.call(this, type, listener, opts);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
})();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Avoid creating multiple roots during HMR / devtools re-initialization — reuse if already created
declare global {
  interface Window { __BUA_ROOT?: ReturnType<typeof ReactDOM.createRoot>; }
}

const root = window.__BUA_ROOT ?? ReactDOM.createRoot(rootElement);
window.__BUA_ROOT = root;

root.render(<App />);