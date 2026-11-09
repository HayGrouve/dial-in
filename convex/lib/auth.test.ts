/// <reference types="vite/client" />
import type { UserIdentity } from 'convex/server'
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'
import schema from '../schema'
import { requireSubject } from './auth'

// Convex skips files with more than one dot, so tests never deploy.
const modules = import.meta.glob(['../**/*.ts', '../_generated/*.js', '!../**/*.*.ts'])

const ME = { subject: 'user_me', issuer: 'https://clerk.test' }
const KAFETO = 'https://kafeto.onovaza.com'

function subjectOf(identity?: Partial<UserIdentity>) {
  const t = convexTest(schema, modules)
  const as = identity ? t.withIdentity(identity) : t
  return as.run((ctx) => requireSubject(ctx))
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requireSubject', () => {
  test('signed out throws', async () => {
    await expect(subjectOf()).rejects.toThrow(/signedOut/)
  })

  describe('without CLERK_AUTHORIZED_PARTIES', () => {
    test('returns the subject and skips the azp check', async () => {
      expect(await subjectOf(ME)).toBe('user_me')
      expect(await subjectOf({ ...ME, azp: 'https://elsewhere.example' })).toBe('user_me')
    })

    test('an empty value counts as unset', async () => {
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', ' , ')
      expect(await subjectOf(ME)).toBe('user_me')
    })
  })

  describe('with CLERK_AUTHORIZED_PARTIES set', () => {
    test('a listed azp passes', async () => {
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', KAFETO)
      expect(await subjectOf({ ...ME, azp: KAFETO })).toBe('user_me')
    })

    test('any origin from a comma separated list passes', async () => {
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', `http://localhost:3104, ${KAFETO}`)
      expect(await subjectOf({ ...ME, azp: KAFETO })).toBe('user_me')
      expect(await subjectOf({ ...ME, azp: 'http://localhost:3104' })).toBe('user_me')
    })

    test('a missing azp throws', async () => {
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', KAFETO)
      await expect(subjectOf(ME)).rejects.toThrow(/unauthorizedParty/)
    })

    test('a foreign azp throws', async () => {
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', KAFETO)
      await expect(subjectOf({ ...ME, azp: 'https://smetkata.onovaza.com' })).rejects.toThrow(
        /unauthorizedParty/,
      )
    })

    test('signed out still throws signedOut', async () => {
      vi.stubEnv('CLERK_AUTHORIZED_PARTIES', KAFETO)
      await expect(subjectOf()).rejects.toThrow(/signedOut/)
    })
  })
})
