import { describe, expect, test } from 'vitest'
import main from '../main.tsx?raw'
import { ONLINE_RETRIES, tokenThroughDrops } from './convex-auth'

/** A scripted Clerk and network: `answers` are what Clerk's getToken gives, in order. */
function setup(answers: (string | null | Error)[], start: { online: boolean; signedIn?: boolean }) {
  const state = { online: start.online, signedIn: start.signedIn ?? true }
  const log: string[] = []
  let calls = 0
  const fetchToken = async () => {
    const answer = answers[Math.min(calls++, answers.length - 1)]
    log.push(`fetch:${answer instanceof Error ? 'error' : answer}`)
    if (answer instanceof Error) throw answer
    return answer
  }
  const env = {
    isSignedIn: () => state.signedIn,
    isOnline: () => state.online,
    waitForOnline: async () => {
      log.push('wait-online')
      state.online = true
    },
    sleep: async (ms: number) => {
      log.push(`sleep:${ms}`)
    },
  }
  return { state, log, run: () => tokenThroughDrops(fetchToken, env) }
}

describe('tokenThroughDrops', () => {
  test('a token from Clerk goes straight through', async () => {
    const { run, log } = setup(['t1'], { online: true })
    expect(await run()).toBe('t1')
    expect(log).toEqual(['fetch:t1'])
  })

  test('offline, it waits for the connection instead of signing you out', async () => {
    const { run, log } = setup([null, new Error('network'), 't2'], { online: false })
    expect(await run()).toBe('t2')
    expect(log).toEqual(['fetch:null', 'wait-online', 'fetch:error', 'sleep:1000', 'fetch:t2'])
  })

  test('online, it retries with backoff and then gives up', async () => {
    const { run, log } = setup([null], { online: true })
    expect(await run()).toBeNull()
    const sleeps = log.filter((l) => l.startsWith('sleep'))
    expect(sleeps).toEqual(['sleep:1000', 'sleep:2000', 'sleep:4000', 'sleep:8000', 'sleep:16000'])
    expect(sleeps).toHaveLength(ONLINE_RETRIES)
    expect(log.filter((l) => l.startsWith('fetch'))).toHaveLength(ONLINE_RETRIES + 1)
  })

  test('Clerk reports signed out: null at once, so Влез shows', async () => {
    const { run, log } = setup([null], { online: false, signedIn: false })
    expect(await run()).toBeNull()
    expect(log).toEqual(['fetch:null'])
  })
})

describe('main.tsx', () => {
  test('Convex gets the drop-proof useAuth, not Clerk’s own', () => {
    expect(main).toMatch(/useAuth=\{useAuthForConvex\}/)
  })
})
