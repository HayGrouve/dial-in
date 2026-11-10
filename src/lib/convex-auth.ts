import { useAuth } from '@clerk/react'
import { useCallback, useLayoutEffect, useRef } from 'react'

/** Tries while online before a missing token counts as signed out: about 30 s in all. */
export const ONLINE_RETRIES = 5

type TokenEnv = {
  /** Clerk still has a session. Read after every miss, so Изход elsewhere ends the wait. */
  isSignedIn(): boolean
  isOnline(): boolean
  /** Resolves when the browser reports it is back online. */
  waitForOnline(): Promise<void>
  sleep(ms: number): Promise<void>
}

/**
 * A Convex token from Clerk that survives a connection drop. Clerk's tokens
 * live a minute, so Convex refreshes them while you are offline; Clerk can't
 * reach its API, gives no token, and Convex reads that as signed out, for
 * good, until a reload (#43). Instead: offline, wait for the connection; online,
 * retry a few times with backoff. Only a miss while Clerk itself reports
 * signed out, or one that outlasts the retries online, gives `null` (Влез).
 */
export async function tokenThroughDrops(
  fetchToken: () => Promise<string | null>,
  env: TokenEnv,
): Promise<string | null> {
  let onlineMisses = 0
  for (;;) {
    let token: string | null = null
    try {
      token = await fetchToken()
    } catch {
      // A network error from Clerk is a miss like any other.
    }
    if (token) return token
    if (!env.isSignedIn()) return null
    if (!env.isOnline()) {
      await env.waitForOnline()
      continue
    }
    if (onlineMisses >= ONLINE_RETRIES) return null
    await env.sleep(1000 * 2 ** onlineMisses)
    onlineMisses++
  }
}

function waitForOnline(): Promise<void> {
  return new Promise((resolve) => window.addEventListener('online', () => resolve(), { once: true }))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type GetToken = ReturnType<typeof useAuth>['getToken']

/**
 * Clerk's `useAuth` for `ConvexProviderWithClerk`, with `getToken` going
 * through `tokenThroughDrops`. Stable across renders: the provider keeps the
 * first `getToken` it sees until the session changes, so this one reads the
 * latest Clerk state from a ref.
 */
export function useAuthForConvex(): ReturnType<typeof useAuth> {
  const auth = useAuth()
  const latest = useRef(auth)
  useLayoutEffect(() => {
    latest.current = auth
  })

  const getToken = useCallback<GetToken>(
    (options) =>
      tokenThroughDrops(() => latest.current.getToken(options), {
        isSignedIn: () => latest.current.isSignedIn === true,
        isOnline: () => navigator.onLine,
        waitForOnline,
        sleep,
      }),
    [],
  )

  return { ...auth, getToken }
}
