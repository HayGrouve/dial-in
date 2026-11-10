import { count } from './count'
import type { Brew, BrewMethod, Taste } from './db'

interface MethodInfo {
  label: string
  /** Mid-sentence, after "за" or "Запиши": "еспресо", "филтър", "AeroPress". */
  noun: string
  /** Shots from an espresso machine (espresso, turbo) measure beverage out; every other method measures water in. */
  isEspresso: boolean
  hasBloom: boolean
  defaultRatio: number
  /** Machine shots only: the time range to aim for and a typical value. */
  shot?: { range: string; typical: number }
}

export const METHODS: Record<BrewMethod, MethodInfo> = {
  espresso: { label: 'Еспресо', noun: 'еспресо', isEspresso: true, hasBloom: false, defaultRatio: 2, shot: { range: '25 до 30 с', typical: 28 } },
  // A turbo shot sits between espresso and filter: coarser grind, longer ratio, much faster shot.
  turbo: { label: 'Турбо', noun: 'турбо', isEspresso: true, hasBloom: false, defaultRatio: 3, shot: { range: '10 до 15 с', typical: 12 } },
  pourover: { label: 'Филтър', noun: 'филтър', isEspresso: false, hasBloom: true, defaultRatio: 16 },
  aeropress: { label: 'AeroPress', noun: 'AeroPress', isEspresso: false, hasBloom: true, defaultRatio: 15 },
  frenchpress: { label: 'Френска преса', noun: 'френска преса', isEspresso: false, hasBloom: false, defaultRatio: 15 },
  moka: { label: 'Мока', noun: 'мока', isEspresso: false, hasBloom: false, defaultRatio: 10 },
  coldbrew: { label: 'Студено извличане', noun: 'студено извличане', isEspresso: false, hasBloom: false, defaultRatio: 8 },
  other: { label: 'Друго', noun: 'друг метод', isEspresso: false, hasBloom: false, defaultRatio: 15 },
}

export const METHOD_ORDER = Object.keys(METHODS) as BrewMethod[]

export const TASTES: Record<Taste, { label: string; hint: string }> = {
  sour: { label: 'Кисело / водно', hint: 'Недоизвлечено. Смели по-фино или удължи съотношението.' },
  balanced: { label: 'Балансирано', hint: 'Точно попадение. Закачи го като настройка.' },
  bitter: { label: 'Горчиво / грубо', hint: 'Преизвлечено. Смели по-едро или скъси варенето.' },
}

export function ratio(dose?: number, out?: number) {
  if (!dose || !out) return undefined
  return `1:${(out / dose).toFixed(1).replace(/\.0$/, '')}`
}

/** Grams, as the stats show them: "18 г". */
export const grams = (g: number) => `${g}\u00a0г`

export function formatTime(sec?: number) {
  if (sec == null) return undefined
  if (sec < 90) return `${sec}\u00a0с`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "21 август". */
export function shortDate(date: string | number) {
  return new Date(date).toLocaleDateString('bg', { month: 'long', day: 'numeric' })
}

/** Joins the truthy parts with a middle dot, for one-line summaries. */
export const dotted = (...parts: (string | number | false | null | undefined)[]) => parts.filter(Boolean).join(' · ')

/** Compact method tags for one-line setting summaries. */
export const METHOD_SHORT: Record<BrewMethod, string> = {
  espresso: 'ЕСП',
  turbo: 'ТУРБО',
  pourover: 'ФИЛТ',
  aeropress: 'AERO',
  frenchpress: 'ПРЕСА',
  moka: 'МОКА',
  coldbrew: 'СТУД',
  other: 'ДРУГО',
}

/** What to change after an off brew, phrased to follow the grind setting. */
export function nextMove(taste: Taste) {
  if (taste === 'sour') return 'излезе кисело. Смели по-фино или удължи съотношението.'
  if (taste === 'bitter') return 'излезе горчиво. Смели по-едро или скъси варенето.'
  return undefined
}

/** "Запиши еспресо", "Запиши филтър"; "Запиши варене" for Друго. */
export const logLabel = (method: BrewMethod) => (method === 'other' ? 'Запиши варене' : `Запиши ${METHODS[method].noun}`)

const daysSince = (t: number) => Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86_400_000)

/** "днес", "вчера", "преди 3 дни", then the date: "21 август". Lowercase, for mid-sentence. */
export function relativeDay(t: number) {
  const days = daysSince(t)
  if (days <= 0) return 'днес'
  if (days === 1) return 'вчера'
  if (days < 7) return `преди ${count(days, 'ден', 'дни')}`
  return shortDate(t)
}

/** "днес", "вчера", "преди 5 дни", "преди 3 седмици", "преди 4 месеца", "преди 2 години". */
export function ago(t: number) {
  const days = daysSince(t)
  if (days <= 0) return 'днес'
  if (days === 1) return 'вчера'
  if (days < 14) return `преди ${count(days, 'ден', 'дни')}`
  if (days < 60) return `преди ${count(Math.round(days / 7), 'седмица', 'седмици')}`
  if (days < 730) return `преди ${count(Math.round(days / 30.4), 'месец', 'месеца')}`
  return `преди ${count(Math.round(days / 365), 'година', 'години')}`
}

/** Capitalises the first letter, for a relative day at the start of a line. */
export const capitalise = (s: string) => s.charAt(0).toLocaleUpperCase('bg') + s.slice(1)

/** One entry per method used: the pinned brew, or the latest try as a fallback. Expects brews newest first. */
export function settingsFor(brews: Brew[]) {
  return METHOD_ORDER.flatMap((m) => {
    const forMethod = brews.filter((b) => b.method === m)
    const pinned = forMethod.find((b) => b.dialedIn)
    if (pinned) return [{ brew: pinned, provisional: false, tries: forMethod }]
    return forMethod[0] ? [{ brew: forMethod[0], provisional: true, tries: forMethod }] : []
  })
}
