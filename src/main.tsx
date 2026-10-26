import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { migrateGrinder } from './lib/prefs'
import { seedPrototypeData } from './lib/seed.prototype'
import { initTheme } from './lib/theme'

initTheme()
void migrateGrinder()
void seedPrototypeData() // PROTOTYPE: `/?seed=prototype` in dev / Vercel previews

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
