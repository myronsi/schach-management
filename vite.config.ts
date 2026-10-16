import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(() => ({
  server: {
    port: 8080,
  },
  plugins: [
    react(),
    // Add development-only plugins here, e.g.:
    // ...(mode === 'development' ? [someDevPlugin()] : [])
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));