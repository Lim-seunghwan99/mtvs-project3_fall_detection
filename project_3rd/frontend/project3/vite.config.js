import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['workshops-islands-essays-decreased.trycloudflare.com/', 'initial-slightly-contractor-neutral.trycloudflare.com'],
  }
})