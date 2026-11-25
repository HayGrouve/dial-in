/**
 * The Gemini API key for reading bag labels. It stays on this device and is
 * never exported, but it belongs to whoever pasted it: saved together with
 * their Clerk `subject`, and read only while that same person is signed in.
 * Anyone else (or nobody) signed in drops it, which covers Изход on the hub;
 * Изход here clears it first (`useSignOut`), and so does Изтрий данните.
 */
const KEY = 'kafeto-gemini-key'

type Saved = { key: string; subject: string }

function read(): Saved | undefined {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v === 'object' && 'key' in v && 'subject' in v) {
      const { key, subject } = v
      if (typeof key === 'string' && typeof subject === 'string' && key && subject) return { key, subject }
    }
  } catch {
    // Not JSON: not ours.
  }
  return undefined
}

/** The key, if `subject` pasted it. Anything else stored is removed. */
export function getGeminiKey(subject: string | null | undefined): string {
  const saved = read()
  if (saved && subject && saved.subject === subject) return saved.key
  if (localStorage.getItem(KEY) !== null) clearGeminiKey()
  return ''
}

/** Saves `key` for `subject`; an empty key, or no one signed in, removes it. */
export function setGeminiKey(key: string, subject: string | null | undefined) {
  const v = key.trim()
  if (v && subject) localStorage.setItem(KEY, JSON.stringify({ key: v, subject } satisfies Saved))
  else clearGeminiKey()
}

/** Removes the key, whoever pasted it. For Изход and Изтрий данните. */
export function clearGeminiKey() {
  localStorage.removeItem(KEY)
}
