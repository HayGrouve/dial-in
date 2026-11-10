import { useAuth, useClerk } from '@clerk/react'
import { useCallback, useEffect } from 'react'
import { clearGeminiKey, getGeminiKey } from './gemini-key'

/**
 * Изход, in one place: everything that signs out goes through here, so the
 * Gemini key goes first and a shared device does not keep it. Lands on `/`,
 * which shows the start page.
 */
export function useSignOut() {
  const clerk = useClerk()
  return useCallback(() => {
    clearGeminiKey()
    return clerk.signOut({ redirectUrl: '/' })
  }, [clerk])
}

/**
 * Drops a Gemini key that is not the signed-in person's as soon as Clerk
 * knows who that is: signed out (Изход on the hub) or someone else.
 */
export function useGeminiKeyGuard() {
  const { isLoaded, userId } = useAuth()
  useEffect(() => {
    if (isLoaded) getGeminiKey(userId)
  }, [isLoaded, userId])
}

/** Вход on the hub (Production) or the dev Account Portal, back to the page you were on. */
export function useSignIn() {
  const clerk = useClerk()
  return useCallback(() => clerk.redirectToSignIn({ redirectUrl: window.location.href }), [clerk])
}
