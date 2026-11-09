import { ClerkProvider, useAuth } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { clerkUrls } from './lib/clerk'
import { migrateGrinder } from './lib/prefs'
import { initTheme } from './lib/theme'

initTheme()
void migrateGrinder()

// Online only: Кафето never registers a service worker. If this origin still has
// Dial In's (an old preview), drop it so it cannot keep serving a stale shell.
void navigator.serviceWorker?.getRegistrations().then((all) => all.forEach((r) => void r.unregister()))

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
const { signInUrl, signUpUrl } = clerkUrls(import.meta.env)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      afterSignOutUrl="/"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </StrictMode>,
)
