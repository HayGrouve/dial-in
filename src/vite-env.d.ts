/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  /** Production only: `https://onovaza.com/vhod`. */
  readonly VITE_CLERK_SIGN_IN_URL?: string
  /** Production only: `https://onovaza.com/vhod`. */
  readonly VITE_CLERK_SIGN_UP_URL?: string
}
