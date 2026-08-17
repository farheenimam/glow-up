import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GlowMatch frontend build config.
// In dev, /api requests are proxied to the local backend so no keys ever
// touch the browser bundle — see backend/server.js for the real calls.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
