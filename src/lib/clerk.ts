/** The `VITE_CLERK_*` variables `ClerkProvider` gets as props. */
type ClerkEnv = {
  VITE_CLERK_SIGN_IN_URL?: string
  VITE_CLERK_SIGN_UP_URL?: string
}

/**
 * Where Вход and the sign-up go. `@clerk/react` reads only the publishable key
 * from env, so these reach `ClerkProvider` as props. Production sets both to the
 * hub's `https://onovaza.com/vhod`; unset (Preview, Development) means the dev
 * instance's Account Portal. An empty value counts as unset.
 */
export function clerkUrls(env: ClerkEnv): { signInUrl?: string; signUpUrl?: string } {
  return {
    signInUrl: env.VITE_CLERK_SIGN_IN_URL?.trim() || undefined,
    signUpUrl: env.VITE_CLERK_SIGN_UP_URL?.trim() || undefined,
  }
}
