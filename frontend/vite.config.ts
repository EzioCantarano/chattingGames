
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Aggiungi questo

// https://vite.dev
export default defineConfig({
  plugins: [react(), tailwindcss()], // Inserisci il plugin qui
})