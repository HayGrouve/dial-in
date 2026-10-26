import type { Coffee, restockCoffee } from './db'

/** Case, accents, punctuation and extra whitespace don't count: "Kiln & Crow" reads as "kiln crow". */
export const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Identifies a Coffee by roaster and name; empty until both are given. */
export function matchKey({ name, roaster }: Pick<Coffee, 'name' | 'roaster'>) {
  const n = normalise(name)
  const r = normalise(roaster)
  return n && r ? `${r}\n${n}` : ''
}

/**
 * Coffees, finished or on the shelf, with the same roaster and name, most recently updated first.
 * A new harvest under the same name is the same Coffee. No fuzzy matching: near misses don't count.
 */
export function findMatches(coffees: Coffee[], draft: Pick<Coffee, 'name' | 'roaster'>) {
  const key = matchKey(draft)
  if (!key) return []
  return coffees.filter((c) => matchKey(c) === key).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Details a new bag can fill in, labelled as they read in a sentence, in form order. */
const DETAILS = {
  origin: 'country',
  region: 'region',
  process: 'process',
  varietal: 'varietal',
  producer: 'producer',
  altitude: 'altitude',
  roastLevel: 'roast level',
  bagWeight: 'bag size',
  tastingNotes: 'tasting notes',
  rating: 'rating',
  notes: 'notes',
} as const satisfies Partial<Record<keyof Coffee, string>>

type RestockChanges = NonNullable<Parameters<typeof restockCoffee>[1]>

const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
const comparable = (v: unknown) => (Array.isArray(v) ? v.map((x) => normalise(String(x))).sort().join('\n') : normalise(String(v)))

export interface RestockPlan {
  /** For `restockWithUndo`: the new photo, and details only where the coffee has none. */
  changes: RestockChanges
  /** Details the new bag fills in. */
  filled: string[]
  /** Details the coffee keeps, though the new bag says otherwise. */
  kept: string[]
}

/** What Bought it again does to a finished coffee. Nothing already filled in is overwritten. */
export function restockPlan(coffee: Coffee, draft: Partial<Coffee>): RestockPlan {
  const changes: RestockChanges = draft.photo ? { photo: draft.photo } : {}
  const filled: string[] = []
  const kept: string[] = []
  for (const [key, label] of Object.entries(DETAILS) as [keyof typeof DETAILS, string][]) {
    const ours = draft[key]
    const theirs = coffee[key]
    if (isEmpty(ours)) continue
    if (isEmpty(theirs)) {
      changes[key] = ours as never
      filled.push(label)
    } else if (comparable(ours) !== comparable(theirs)) {
      kept.push(label)
    }
  }
  return { changes, filled, kept }
}
