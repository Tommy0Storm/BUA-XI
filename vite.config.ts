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
        // Inject env vars for production build (GitHub Actions sets VITE_* prefixed vars)
        'import.meta.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY),
        'import.meta.env.VITE_EMAILJS_SERVICE_ID': JSON.stringify(env.VITE_EMAILJS_SERVICE_ID || env.EMAILJS_SERVICE_ID),
        'import.meta.env.VITE_EMAILJS_TEMPLATE_ID': JSON.stringify(env.VITE_EMAILJS_TEMPLATE_ID || env.EMAILJS_TEMPLATE_ID),
        'import.meta.env.VITE_EMAILJS_PUBLIC_KEY': JSON.stringify(env.VITE_EMAILJS_PUBLIC_KEY || env.EMAILJS_PUBLIC_KEY)
      }
    };
  } catch (error) {
    console.error('Error loading Vite config:', error);
    throw error;
  }
});