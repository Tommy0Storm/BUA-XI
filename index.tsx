import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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