import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    base: './', // CRITICAL: Ensures assets load correctly on GitHub Pages
    define: {
      // Polyfill process.env.API_KEY so your code works in production
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})
