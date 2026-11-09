import { useClerk } from '@clerk/react'
import { useCallback } from 'react'

/**
 * Изход, in one place: everything that signs out goes through here, so #33 can
 * clear the Gemini key first. Lands on `/`, which shows the start page.
 */
export function useSignOut() {
  const clerk = useClerk()
  return useCallback(() => clerk.signOut({ redirectUrl: '/' }), [clerk])
}

/** Вход on the hub (Production) or the dev Account Portal, back to the page you were on. */
export function useSignIn() {
  const clerk = useClerk()
  return useCallback(() => clerk.redirectToSignIn({ redirectUrl: window.location.href }), [clerk])
}
