import Dexie, { type EntityTable } from 'dexie'

export const ROAST_LEVELS = ['Light', 'Medium-light', 'Medium', 'Medium-dark', 'Dark'] as const
export const PROCESSES = [
  'Washed',
  'Natural',
  'Honey',
  'Anaerobic',
  'Carbonic maceration',
  'Wet-hulled',
  'Experimental',
] as const

export type BrewMethod = 'espresso' | 'pourover' | 'aeropress' | 'frenchpress' | 'moka' | 'coldbrew' | 'other'

export type Taste = 'sour' | 'balanced' | 'bitter'

export interface Coffee {
  id: string
  name: string
  roaster: string
  origin?: string
  region?: string
  producer?: string
  varietal?: string
  process?: string
  altitude?: string
  roastLevel?: string
  tastingNotes: string[]
  bagWeight?: number
  notes?: string
  /** 1–5 stars for the coffee itself. */
  rating?: number
  photo?: Blob
  finished: boolean
  createdAt: number
  updatedAt: number
}

export interface Brew {
  id: string
  coffeeId: string
  method: BrewMethod
  grinder?: string
  grindSetting: string
  dose?: number
  /** Espresso: beverage weight out. Other methods: water in. */
  yield?: number
  timeSec?: number
  preinfusion: boolean
  preinfusionSec?: number
  temperature?: number
  bloomSec?: number
  taste?: Taste
  notes?: string
  /** Marks the setting to return to for this coffee + method. */
  dialedIn: boolean
  createdAt: number
}

export const db = new Dexie('dial-in') as Dexie & {
  coffees: EntityTable<Coffee, 'id'>
  brews: EntityTable<Brew, 'id'>
}

db.version(1).stores({
  coffees: 'id, name, roaster, finished, updatedAt',
  brews: 'id, coffeeId, method, createdAt, [coffeeId+method]',
})

// v2: roast date is no longer tracked; drop it from stored coffees.
db.version(2).upgrade((tx) =>
  tx.table('coffees').toCollection().modify((c: Coffee & { roastDate?: string }) => {
    delete c.roastDate
  }),
)

// v3: ratings belong to the coffee, not each brew. Carry over the best brew rating.
db.version(3).upgrade(async (tx) => {
  const brews = tx.table('brews')
  const best = bestBrewRatings(await brews.toArray())
  await tx.table('coffees').toCollection().modify((c: Coffee) => {
    if (c.rating == null && best.has(c.id)) c.rating = best.get(c.id)
  })
  await brews.toCollection().modify((b: Brew & { rating?: number }) => {
    delete b.rating
  })
})

/** Highest rating per coffee among brews stored before ratings moved to coffees. */
export function bestBrewRatings(brews: (Brew & { rating?: number })[]) {
  const best = new Map<string, number>()
  for (const b of brews) if (b.rating && b.rating > (best.get(b.coffeeId) ?? 0)) best.set(b.coffeeId, b.rating)
  return best
}

export const newId = () => crypto.randomUUID()

/** Marks one brew as the dialed-in setting, clearing others for the same coffee + method. */
export async function setDialedIn(brew: Brew, value: boolean) {
  await db.transaction('rw', db.brews, db.coffees, async () => {
    if (value) {
      await db.brews
        .where('[coffeeId+method]')
        .equals([brew.coffeeId, brew.method])
        .modify({ dialedIn: false })
    }
    await db.brews.update(brew.id, { dialedIn: value })
    await db.coffees.update(brew.coffeeId, { updatedAt: Date.now() })
  })
}

export async function deleteCoffee(id: string) {
  await db.transaction('rw', db.brews, db.coffees, async () => {
    await db.brews.where('coffeeId').equals(id).delete()
    await db.coffees.delete(id)
  })
}

/** Puts back what a reversible action changed. */
export type Undo = () => Promise<void>

/**
 * Changes a coffee and moves it to the front of its list. The returned undo puts back exactly the
 * fields it replaced, `updatedAt` included, so undoing doesn't reorder the shelf.
 */
async function changeCoffee(id: string, changes: Partial<Coffee>): Promise<Undo> {
  const next = { ...changes, updatedAt: Date.now() }
  const before = await db.transaction('rw', db.coffees, async () => {
    const coffee = await db.coffees.get(id)
    if (!coffee) throw new Error(`Coffee ${id} not found`)
    await db.coffees.update(id, next)
    return coffee
  })
  // Fields that were empty come back as undefined, which Dexie removes again.
  const previous = Object.fromEntries(Object.keys(next).map((k) => [k, before[k as keyof Coffee]])) as Partial<Coffee>
  return async () => {
    await db.coffees.update(id, previous)
  }
}

/** The bag is used up: the coffee moves off the shelf. */
export function finishCoffee(id: string) {
  return changeCoffee(id, { finished: true })
}

/**
 * Another bag of a finished coffee: it goes back on the shelf. `changes` carries anything the new
 * bag brings (a photo, details to fill in), and undo restores the previous record exactly.
 */
export function restockCoffee(id: string, changes: Partial<Omit<Coffee, 'id' | 'finished' | 'updatedAt'>> = {}) {
  return changeCoffee(id, { ...changes, finished: false })
}
