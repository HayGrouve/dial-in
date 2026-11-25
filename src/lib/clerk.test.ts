import { describe, expect, test } from 'vitest'
import main from '../main.tsx?raw'
import { clerkUrls } from './clerk'

const VHOD = 'https://onovaza.com/vhod'

describe('clerkUrls', () => {
  test('takes both URLs from the VITE_CLERK_* variables', () => {
    expect(clerkUrls({ VITE_CLERK_SIGN_IN_URL: VHOD, VITE_CLERK_SIGN_UP_URL: `${VHOD}?nov=1` })).toEqual({
      signInUrl: VHOD,
      signUpUrl: `${VHOD}?nov=1`,
    })
  })

  test('unset or empty leaves them undefined, so Clerk uses the Account Portal', () => {
    expect(clerkUrls({})).toEqual({ signInUrl: undefined, signUpUrl: undefined })
    expect(clerkUrls({ VITE_CLERK_SIGN_IN_URL: '', VITE_CLERK_SIGN_UP_URL: ' ' })).toEqual({
      signInUrl: undefined,
      signUpUrl: undefined,
    })
  })
})

describe('main.tsx', () => {
  test('ClerkProvider gets its URLs from import.meta.env, nothing hard-coded', () => {
    expect(main).toMatch(/clerkUrls\(import\.meta\.env\)/)
    expect(main).not.toMatch(/onovaza\.com|accounts\.dev/)
  })
})
