import { ClerkProvider } from '@clerk/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { clerkUrls } from './lib/clerk'
import { useAuthForConvex } from './lib/convex-auth'
import { convex } from './lib/convex'
import { initTheme } from './lib/theme'

initTheme()

// Online only: Кафето never registers a service worker. If this origin still has
// Dial In's (an old preview), drop it so it cannot keep serving a stale shell.
void navigator.serviceWorker?.getRegistrations().then((all) => all.forEach((r) => void r.unregister()))

const { signInUrl, signUpUrl } = clerkUrls(import.meta.env)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      afterSignOutUrl="/"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuthForConvex}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </StrictMode>,
)
