import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The address path the app is served from (/<repo-name>/). The deploy workflow
  // sets VITE_BASE from the repo name, so you normally never touch this.
  base: process.env.VITE_BASE || '/luna/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
