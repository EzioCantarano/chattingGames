
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Aggiungi questo
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    basicSsl()
  ], 
  server: {
    port: 8080
  }
})