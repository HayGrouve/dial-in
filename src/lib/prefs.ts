import { db } from './db'

const GRINDER_KEY = 'dial-in-grinder'

/** The single grinder the user owns; stamped onto every new brew. */
export function getGrinder() {
  return localStorage.getItem(GRINDER_KEY) ?? ''
}

export function setGrinder(name: string) {
  const v = name.trim()
  if (v) localStorage.setItem(GRINDER_KEY, v)
  else localStorage.removeItem(GRINDER_KEY)
}

/** First run after the grinder moved to Settings: adopt the grinder from the latest brew. */
export async function migrateGrinder() {
  if (localStorage.getItem(GRINDER_KEY) !== null) return
  const last = await db.brews.orderBy('createdAt').reverse().filter((b) => !!b.grinder).first()
  if (last?.grinder) setGrinder(last.grinder)
}

const API_KEY = 'dial-in-gemini-key'

/** Gemini API key for reading bag labels. Stays on this device; never exported in backups. */
export function getApiKey() {
  return localStorage.getItem(API_KEY) ?? ''
}

export function setApiKey(key: string) {
  const v = key.trim()
  if (v) localStorage.setItem(API_KEY, v)
  else localStorage.removeItem(API_KEY)
}
