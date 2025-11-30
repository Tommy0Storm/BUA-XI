import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  try {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, (process as any).cwd(), '');
    return {
      plugins: [react()],
      base: './', // CRITICAL: Ensures assets load correctly on GitHub Pages
      define: {
        // Polyfill process.env for production usage
        'process.env.API_KEY': JSON.stringify(env.API_KEY),
        'process.env.EMAILJS_SERVICE_ID': JSON.stringify(env.EMAILJS_SERVICE_ID),
        'process.env.EMAILJS_TEMPLATE_ID': JSON.stringify(env.EMAILJS_TEMPLATE_ID),
        'process.env.EMAILJS_PUBLIC_KEY': JSON.stringify(env.EMAILJS_PUBLIC_KEY)
      }
    };
  } catch (error) {
    console.error('Error loading Vite config:', error);
    throw error;
  }
});