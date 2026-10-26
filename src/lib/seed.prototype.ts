// PROTOTYPE (issue #9): dev/preview-only sample data for the home-screen finish/restock variants.
// Visit `/?seed=prototype` (or press "Reseed" in the variant switcher). Writes fixed `proto-*` ids,
// so it resets those coffees without touching anything else in the database.
import { db, type Brew, type BrewMethod, type Coffee, type Taste } from './db'

const HOUR = 3_600_000
const DAY = 24 * HOUR

type SeedBrew = { method: BrewMethod; grind: string; dose?: number; out?: number; time?: number; taste?: Taste; dialedIn?: boolean; ago: number }
type SeedCoffee = { id: string; name: string; roaster: string; origin: string; process: string; notes: string[]; finished: boolean; updatedAgo: number; brews: SeedBrew[] }

const COFFEES: SeedCoffee[] = [
  {
    id: 'proto-kenya',
    name: 'Kenya Gichathaini',
    roaster: 'Square Mile',
    origin: 'Kenya',
    process: 'Washed',
    notes: ['Blackcurrant', 'Grapefruit'],
    finished: false,
    updatedAgo: 2 * HOUR,
    brews: [
      { method: 'espresso', grind: '2.8', dose: 18, out: 30, time: 24, taste: 'sour', ago: 3 * DAY },
      { method: 'espresso', grind: '2.4', dose: 18, out: 38, time: 29, taste: 'balanced', dialedIn: true, ago: 2 * DAY },
      { method: 'espresso', grind: '2.4', dose: 18, out: 38, time: 28, taste: 'balanced', ago: 2 * HOUR },
    ],
  },
  {
    id: 'proto-guji',
    name: 'Ethiopia Guji Hambela',
    roaster: 'Tim Wendelboe',
    origin: 'Ethiopia',
    process: 'Natural',
    notes: ['Strawberry', 'Jasmine'],
    finished: false,
    updatedAgo: 1 * DAY,
    brews: [
      { method: 'pourover', grind: '24', dose: 15, out: 250, time: 170, dialedIn: true, ago: 4 * DAY },
      { method: 'espresso', grind: '11', dose: 18, out: 40, time: 27, dialedIn: true, ago: 1 * DAY },
    ],
  },
  {
    id: 'proto-lychee',
    name: 'Colombia El Paraíso Lychee',
    roaster: 'Onyx',
    origin: 'Colombia',
    process: 'Anaerobic',
    notes: ['Lychee', 'Rose'],
    finished: false,
    updatedAgo: 3 * DAY,
    brews: [{ method: 'espresso', grind: '9.5', dose: 18, out: 36, time: 30, dialedIn: true, ago: 3 * DAY }],
  },
  {
    id: 'proto-daterra',
    name: 'Brazil Daterra Sweet Collection',
    roaster: 'Origin',
    origin: 'Brazil',
    process: 'Natural',
    notes: ['Milk chocolate', 'Hazelnut'],
    finished: false,
    updatedAgo: 5 * DAY,
    brews: [{ method: 'espresso', grind: '16', dose: 18, out: 36, time: 28, dialedIn: true, ago: 5 * DAY }],
  },
  {
    id: 'proto-huye',
    name: 'Rwanda Huye Mountain',
    roaster: 'Kiss the Hippo',
    origin: 'Rwanda',
    process: 'Washed',
    notes: ['Red apple', 'Black tea'],
    finished: false,
    updatedAgo: 6 * DAY,
    brews: [
      { method: 'espresso', grind: '14', dose: 18, out: 36, time: 22, taste: 'sour', ago: 7 * DAY },
      { method: 'espresso', grind: '12.5', dose: 18, out: 36, time: 25, taste: 'sour', ago: 6 * DAY },
    ],
  },
  {
    id: 'proto-geisha',
    name: 'Panama Elida Geisha',
    roaster: 'Gardelli',
    origin: 'Panama',
    process: 'Washed',
    notes: ['Bergamot', 'Peach'],
    finished: true,
    updatedAgo: 20 * DAY,
    brews: [{ method: 'pourover', grind: '22', dose: 15, out: 250, time: 180, dialedIn: true, ago: 24 * DAY }],
  },
  {
    id: 'proto-kayanza',
    name: 'Burundi Kayanza',
    roaster: 'Assembly',
    origin: 'Burundi',
    process: 'Honey',
    notes: ['Plum', 'Cocoa'],
    finished: true,
    updatedAgo: 40 * DAY,
    brews: [{ method: 'espresso', grind: '13', dose: 18, out: 38, time: 28, dialedIn: true, ago: 45 * DAY }],
  },
]

export async function seedPrototype() {
  const now = Date.now()
  const coffees: Coffee[] = COFFEES.map((c) => ({
    id: c.id,
    name: c.name,
    roaster: c.roaster,
    origin: c.origin,
    process: c.process,
    tastingNotes: c.notes,
    finished: c.finished,
    createdAt: now - 60 * DAY,
    updatedAt: now - c.updatedAgo,
  }))
  const brews: Brew[] = COFFEES.flatMap((c) =>
    c.brews.map((b, i) => ({
      id: `${c.id}-brew-${i}`,
      coffeeId: c.id,
      method: b.method,
      grindSetting: b.grind,
      dose: b.dose,
      yield: b.out,
      timeSec: b.time,
      preinfusion: false,
      taste: b.taste,
      dialedIn: b.dialedIn ?? false,
      createdAt: now - b.ago,
    })),
  )
  await db.transaction('rw', db.coffees, db.brews, async () => {
    await db.brews.where('coffeeId').startsWith('proto-').delete()
    await db.coffees.bulkPut(coffees)
    await db.brews.bulkPut(brews)
  })
}
