import { beforeEach, describe, expect, test, vi } from 'vitest'
import { clearGeminiKey, getGeminiKey, setGeminiKey } from './gemini-key'

const A = 'user_a'
const B = 'user_b'
const KEY = 'kafeto-gemini-key'

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})

describe('Gemini key', () => {
  test('whoever pasted it reads it back, trimmed', () => {
    setGeminiKey('  AIza123  ', A)
    expect(getGeminiKey(A)).toBe('AIza123')
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ key: 'AIza123', subject: A })
  })

  test('someone else signed in gets nothing, and the key is dropped', () => {
    setGeminiKey('AIza123', A)
    expect(getGeminiKey(B)).toBe('')
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(getGeminiKey(A)).toBe('')
  })

  test('nobody signed in (Изход on the hub) drops it', () => {
    setGeminiKey('AIza123', A)
    expect(getGeminiKey(null)).toBe('')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  test('clearGeminiKey removes it whoever pasted it', () => {
    setGeminiKey('AIza123', A)
    clearGeminiKey()
    expect(getGeminiKey(A)).toBe('')
  })

  test('an empty key, or no subject, saves nothing', () => {
    setGeminiKey('AIza123', A)
    setGeminiKey('   ', A)
    expect(localStorage.getItem(KEY)).toBeNull()
    setGeminiKey('AIza123', undefined)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  test('a bare string or junk under the key is not trusted and is dropped', () => {
    for (const junk of ['AIza123', '{"key":"AIza123"}', '{"key":"","subject":"user_a"}', 'null']) {
      localStorage.setItem(KEY, junk)
      expect(getGeminiKey(A)).toBe('')
      expect(localStorage.getItem(KEY)).toBeNull()
    }
  })
})
