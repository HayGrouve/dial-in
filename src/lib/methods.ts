import type { Brew, BrewMethod, Taste } from './db'

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

/** Compact method tags for one-line setting summaries. */
export const METHOD_SHORT: Record<BrewMethod, string> = {
  espresso: 'ESP',
  pourover: 'POUR',
  aeropress: 'AERO',
  frenchpress: 'PRESS',
  moka: 'MOKA',
  coldbrew: 'COLD',
  other: 'OTHER',
}

/** What to change after an off brew, phrased to follow the grind setting. */
export function nextMove(taste: Taste) {
  if (taste === 'sour') return 'ran sour. Grind finer or pull a longer ratio.'
  if (taste === 'bitter') return 'ran bitter. Grind coarser or cut the brew short.'
  return undefined
}

/** "Log an espresso", "Log a pour over". */
export const logLabel = (method: BrewMethod) => {
  const label = METHODS[method].label.toLowerCase()
  return `Log ${/^[aeiou]/.test(label) ? 'an' : 'a'} ${label}`
}

export function relativeDay(t: number) {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return shortDate(t)
}

/** One entry per method used: the pinned brew, or the latest try as a fallback. Expects brews newest first. */
export function settingsFor(brews: Brew[]) {
  return METHOD_ORDER.flatMap((m) => {
    const forMethod = brews.filter((b) => b.method === m)
    const pinned = forMethod.find((b) => b.dialedIn)
    if (pinned) return [{ brew: pinned, provisional: false, tries: forMethod }]
    return forMethod[0] ? [{ brew: forMethod[0], provisional: true, tries: forMethod }] : []
  })
}
