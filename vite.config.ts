import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so the built app loads from file:// inside Electron.
  base: './',
  resolve: {
    // import.meta.url, not __dirname — this config is loaded as ESM.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Proxying keeps the API same-origin from the browser's point of view, so
    // the session cookie is sent without any CORS or SameSite negotiation —
    // and WebAuthn's origin check sees a single origin, which it requires.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: false,
      },
    },
  },
})
