// PROTOTYPE, throwaway (#12). Match rule from #10, the restock write, and the fake scans used to
// judge the offer without a Gemini key. The restock really writes to IndexedDB; Undo on the toast
// (or `/?seed=prototype`) puts the coffee back exactly as it was.
import { useLiveQuery } from 'dexie-react-hooks'
import { showProtoToast } from '../components/ProtoToast.prototype'
import { db, type Brew, type Coffee } from './db'
import { METHODS, settingsFor } from './methods'
import type { ScannedFields } from './scan'

export type Draft = Omit<Coffee, 'id' | 'createdAt' | 'updatedAt'>

/** Case, accents, punctuation and extra whitespace don't count. No fuzzy matching. */
export const normalise = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const matchKey = (name: string, roaster: string) => {
  const n = normalise(name)
  const r = normalise(roaster)
  return n && r ? `${r}\u0000${n}` : ''
}

export interface Match {
  coffee: Coffee
  brews: Brew[]
  /** The pinned setting, else the latest try. */
  setting?: { brew: Brew; provisional: boolean; tries: Brew[] }
}

/** Every coffee with the same roaster + name, most recently updated first. */
export function useMatches(key: string): Match[] | undefined {
  return useLiveQuery(async () => {
    if (!key) return []
    const all = await db.coffees.toArray()
    const hits = all.filter((c) => matchKey(c.name, c.roaster) === key).sort((a, b) => b.updatedAt - a.updatedAt)
    return Promise.all(
      hits.map(async (coffee) => {
        const brews = await db.brews.where('coffeeId').equals(coffee.id).reverse().sortBy('createdAt')
        const settings = settingsFor(brews)
        return { coffee, brews, setting: settings.find((s) => !s.provisional) ?? settings[0] }
      }),
    )
  }, [key])
}

const FIELDS = [
  ['origin', 'Country'],
  ['region', 'Region'],
  ['process', 'Process'],
  ['varietal', 'Varietal'],
  ['producer', 'Producer'],
  ['altitude', 'Altitude'],
  ['roastLevel', 'Roast level'],
  ['bagWeight', 'Bag size'],
  ['tastingNotes', 'Tasting notes'],
  ['rating', 'Rating'],
  ['notes', 'Notes'],
] as const satisfies readonly (readonly [keyof Draft, string])[]

const isEmpty = (v: unknown) => (Array.isArray(v) ? v.length === 0 : v == null || v === '')
const show = (key: string, v: unknown) =>
  Array.isArray(v) ? v.join(', ') : key === 'bagWeight' ? `${v}g` : key === 'rating' ? `${v} stars` : String(v)

export interface FillPlan {
  photo: 'replace' | 'add' | 'none'
  /** Empty on the coffee, present in the new draft: these fill in. */
  filled: { label: string; value: string }[]
  /** Present on both and different: the coffee keeps its own value. */
  kept: { label: string; value: string; ignored: string }[]
}

/** What accepting a restock would change, under #10's "fill only empty fields" rule. */
export function fillPlan(coffee: Coffee, draft: Draft): FillPlan {
  const filled: FillPlan['filled'] = []
  const kept: FillPlan['kept'] = []
  for (const [key, label] of FIELDS) {
    const theirs = coffee[key]
    const ours = draft[key]
    if (isEmpty(ours)) continue
    if (isEmpty(theirs)) filled.push({ label, value: show(key, ours) })
    else if (show(key, theirs).toLowerCase() !== show(key, ours).toLowerCase()) kept.push({ label, value: show(key, theirs), ignored: show(key, ours) })
  }
  return { photo: draft.photo ? (coffee.photo ? 'replace' : 'add') : 'none', filled, kept }
}

/** Puts a finished coffee back on the shelf, with the new photo and only-empty fields filled in. */
export async function restock(coffee: Coffee, draft: Draft) {
  const before = await db.coffees.get(coffee.id)
  if (!before) return
  const next: Coffee = { ...before, finished: false, updatedAt: Date.now() }
  if (draft.photo) next.photo = draft.photo
  for (const [key] of FIELDS) if (isEmpty(before[key]) && !isEmpty(draft[key])) (next as unknown as Record<string, unknown>)[key] = draft[key]
  await db.coffees.put(next)
  showProtoToast({ message: `Back on the shelf: ${before.name}`, undo: () => void db.coffees.put(before) })
}

const DAY = 86_400_000
export function ago(t: number) {
  const days = Math.floor((Date.now() - t) / DAY)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  return `${Math.round(days / 30)} months ago`
}

/** "Espresso, Niche Zero, 18g to 38g in 28s" */
export function settingLine(brew: Brew) {
  const m = METHODS[brew.method]
  const amounts = brew.dose != null && brew.yield != null ? `${brew.dose}g to ${brew.yield}g` : brew.dose != null ? `${brew.dose}g` : undefined
  return [m.label, brew.grinder, [amounts, brew.timeSec != null && `in ${brew.timeSec}s`].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

// ---- Simulated scans (dev / preview only) ----

export interface ScanPreset {
  label: string
  fields: ScannedFields
  hue: number
}

/** Spelled slightly differently from the seed on purpose, to show the normalised match. */
export const SCAN_PRESETS: ScanPreset[] = [
  {
    label: 'finished',
    hue: 18,
    fields: {
      name: 'SANTA ROSA PACAMARA',
      roaster: 'Kiln & Crow',
      origin: 'El Salvador',
      region: 'Chalatenango',
      producer: 'Finca Santa Rosa',
      altitude: '1650 masl',
      process: 'Honey',
      roastLevel: 'Medium-light',
      tastingNotes: ['plum', 'red apple', 'cocoa nib'],
      bagWeight: 250,
    },
  },
  {
    label: 'shelf',
    hue: 210,
    fields: { name: 'Sidama Bensa', roaster: 'Northbound Roasters', origin: 'Ethiopia', process: 'Natural', tastingNotes: ['blueberry', 'jasmine'], bagWeight: 250 },
  },
  {
    label: 'several',
    hue: 140,
    fields: { name: 'Halo Beriti', roaster: 'Tanager & Co', origin: 'Ethiopia', region: 'Yirgacheffe', process: 'Washed', roastLevel: 'Light', tastingNotes: ['bergamot', 'peach', 'honey'], bagWeight: 250 },
  },
  {
    label: 'none',
    hue: 280,
    fields: { name: 'Finca Deborah Geisha', roaster: 'Hatch Coffee', origin: 'Panama', process: 'Washed', tastingNotes: ['jasmine', 'mandarin'] },
  },
]

/** A stand-in "front of the bag" photo, so the photo-replace rule is visible after a restock. */
export function fakeBagPhoto(preset: ScanPreset): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 800
  const g = c.getContext('2d')!
  g.fillStyle = `hsl(${preset.hue} 25% 22%)`
  g.fillRect(0, 0, 640, 800)
  g.fillStyle = `hsl(${preset.hue} 45% 62%)`
  g.beginPath()
  g.roundRect(110, 90, 420, 640, 28)
  g.fill()
  g.fillStyle = '#f4efe2'
  g.fillRect(160, 300, 320, 260)
  g.fillStyle = '#1b1b1b'
  g.textAlign = 'center'
  g.font = '600 26px sans-serif'
  g.fillText(preset.fields.roaster ?? '', 320, 350)
  g.font = '700 34px sans-serif'
  const words = (preset.fields.name ?? '').split(' ')
  words.forEach((w, i) => g.fillText(w, 320, 410 + i * 42))
  g.font = '500 20px sans-serif'
  g.fillText('NEW BAG (simulated)', 320, 700)
  return new Promise((resolve) => c.toBlob((b) => resolve(b!), 'image/jpeg', 0.85))
}
