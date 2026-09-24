import type { BrewMethod, Taste } from './db'

interface MethodInfo {
  label: string
  /** Espresso measures beverage out; every other method measures water in. */
  isEspresso: boolean
  hasBloom: boolean
  defaultRatio: number
}

export const METHODS: Record<BrewMethod, MethodInfo> = {
  espresso: { label: 'Espresso', isEspresso: true, hasBloom: false, defaultRatio: 2 },
  pourover: { label: 'Pour over', isEspresso: false, hasBloom: true, defaultRatio: 16 },
  aeropress: { label: 'AeroPress', isEspresso: false, hasBloom: true, defaultRatio: 15 },
  frenchpress: { label: 'French press', isEspresso: false, hasBloom: false, defaultRatio: 15 },
  moka: { label: 'Moka pot', isEspresso: false, hasBloom: false, defaultRatio: 10 },
  coldbrew: { label: 'Cold brew', isEspresso: false, hasBloom: false, defaultRatio: 8 },
  other: { label: 'Other', isEspresso: false, hasBloom: false, defaultRatio: 15 },
}

export const METHOD_ORDER = Object.keys(METHODS) as BrewMethod[]

export const TASTES: Record<Taste, { label: string; hint: string }> = {
  sour: { label: 'Sour / thin', hint: 'Under-extracted — grind finer or raise the ratio.' },
  balanced: { label: 'Balanced', hint: 'Sweet spot. Mark it as dialed in.' },
  bitter: { label: 'Bitter / harsh', hint: 'Over-extracted — grind coarser or shorten the brew.' },
}

export function ratio(dose?: number, out?: number) {
  if (!dose || !out) return undefined
  return `1:${(out / dose).toFixed(1).replace(/\.0$/, '')}`
}

export function formatTime(sec?: number) {
  if (sec == null) return undefined
  if (sec < 90) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function shortDate(date: string | number) {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Joins the truthy parts with a middle dot — used for one-line summaries. */
export const dotted = (...parts: (string | number | false | null | undefined)[]) => parts.filter(Boolean).join(' · ')
