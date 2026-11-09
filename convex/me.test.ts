/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob(['./**/*.ts', './_generated/*.js', '!./**/*.*.ts'])

test('me.subject returns the signed-in subject', async () => {
  const t = convexTest(schema, modules)
  const me = t.withIdentity({ subject: 'user_me', issuer: 'https://clerk.test' })
  expect(await me.query(api.me.subject, {})).toBe('user_me')
})

test('me.subject throws signed out', async () => {
  const t = convexTest(schema, modules)
  await expect(t.query(api.me.subject, {})).rejects.toThrow(/signedOut/)
})
