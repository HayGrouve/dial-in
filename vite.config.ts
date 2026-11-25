import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Online only: no service worker. The Home Screen manifest is a static file in public/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
