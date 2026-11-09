import { db } from './db'

const GRINDER_KEY = 'kafeto-grinder'

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

const OPUS_KEY = 'kafeto-opus-dial'
const OPUS_INNER_KEY = 'kafeto-opus-inner'

/** Opt-in Fellow Opus dial helper on the brew form. Off unless turned on in Settings. */
export function getOpusDial() {
  return localStorage.getItem(OPUS_KEY) === '1'
}

export function setOpusDial(on: boolean) {
  if (on) localStorage.setItem(OPUS_KEY, '1')
  else localStorage.removeItem(OPUS_KEY)
}

/** Where the Opus inner (calibration) ring currently sits, −6…+6 notches. */
export function getOpusInner() {
  const n = Number(localStorage.getItem(OPUS_INNER_KEY))
  return Number.isInteger(n) && Math.abs(n) <= 6 ? n : 0
}

export function setOpusInner(n: number) {
  if (n) localStorage.setItem(OPUS_INNER_KEY, String(n))
  else localStorage.removeItem(OPUS_INNER_KEY)
}
