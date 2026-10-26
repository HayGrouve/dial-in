// PROTOTYPE, throwaway. Visit `/?seed=prototype` (dev or Vercel preview) to write four sample coffees.
// Fixed ids, so re-seeding resets them: two on the shelf with pinned settings, one still dialing,
// one finished. Links: /coffee/proto-kenya, /coffee/proto-colombia, /coffee/proto-ethiopia, /coffee/proto-finished
import { PROTOTYPE } from '../components/PrototypeSwitcher'
import { db, type Brew, type Coffee } from './db'

const DAY = 86_400_000

export async function seedPrototypeData() {
  const params = new URLSearchParams(location.search)
  if (!PROTOTYPE || params.get('seed') !== 'prototype') return

  const now = Date.now()
  const coffee = (c: Partial<Coffee> & Pick<Coffee, 'id' | 'name' | 'roaster'>, daysAgo: number): Coffee => ({
    tastingNotes: [],
    finished: false,
    createdAt: now - daysAgo * DAY,
    updatedAt: now - daysAgo * DAY,
    ...c,
  })
  let n = 0
  const brew = (b: Partial<Brew> & Pick<Brew, 'coffeeId' | 'method' | 'grindSetting'>, daysAgo: number): Brew => ({
    id: `proto-brew-${++n}`,
    grinder: 'Niche Zero',
    preinfusion: false,
    dialedIn: false,
    createdAt: now - daysAgo * DAY - n * 60_000,
    ...b,
  })

  const coffees = [
    coffee(
      {
        id: 'proto-kenya',
        name: 'Gatomboya AA',
        roaster: 'Northbound Roasters',
        origin: 'Kenya',
        region: 'Nyeri',
        varietal: 'SL28, SL34',
        process: 'Washed',
        altitude: '1,800 m',
        roastLevel: 'Light',
        bagWeight: 250,
        tastingNotes: ['Blackcurrant', 'Grapefruit', 'Brown sugar'],
        rating: 5,
      },
      12,
    ),
    coffee(
      {
        id: 'proto-colombia',
        name: 'El Paraíso Lychee',
        roaster: 'Kiln & Crow',
        origin: 'Colombia',
        region: 'Cauca',
        process: 'Anaerobic',
        varietal: 'Castillo',
        roastLevel: 'Light',
        bagWeight: 200,
        tastingNotes: ['Lychee', 'Rose', 'Mango'],
        rating: 4,
      },
      9,
    ),
    coffee(
      {
        id: 'proto-ethiopia',
        name: 'Sidama Bensa',
        roaster: 'Northbound Roasters',
        origin: 'Ethiopia',
        process: 'Natural',
        roastLevel: 'Medium-light',
        bagWeight: 250,
        tastingNotes: ['Blueberry', 'Jasmine'],
      },
      2,
    ),
    coffee(
      {
        id: 'proto-finished',
        name: 'Santa Rosa Pacamara',
        roaster: 'Kiln & Crow',
        origin: 'El Salvador',
        process: 'Honey',
        varietal: 'Pacamara',
        roastLevel: 'Medium',
        bagWeight: 250,
        tastingNotes: ['Plum', 'Cocoa nib'],
        rating: 4,
        finished: true,
      },
      40,
    ),
  ]

  const brews = [
    brew({ coffeeId: 'proto-kenya', method: 'espresso', grindSetting: '15', dose: 18, yield: 36, timeSec: 22, taste: 'sour' }, 11),
    brew({ coffeeId: 'proto-kenya', method: 'espresso', grindSetting: '13', dose: 18, yield: 38, timeSec: 26, taste: 'sour' }, 10),
    brew({ coffeeId: 'proto-kenya', method: 'espresso', grindSetting: '11', dose: 18, yield: 36, timeSec: 34, taste: 'bitter', notes: 'Choked a little, drying finish.' }, 8),
    brew({ coffeeId: 'proto-kenya', method: 'espresso', grindSetting: '12', dose: 18, yield: 40, timeSec: 29, taste: 'balanced', dialedIn: true, temperature: 93 }, 6),
    brew({ coffeeId: 'proto-kenya', method: 'pourover', grindSetting: '48', grinder: 'Comandante C40', dose: 15, yield: 250, timeSec: 195, bloomSec: 40, taste: 'balanced', dialedIn: true }, 4),
    brew({ coffeeId: 'proto-colombia', method: 'pourover', grindSetting: '28', grinder: 'Comandante C40', dose: 15, yield: 240, timeSec: 150, bloomSec: 30, taste: 'sour' }, 8),
    brew({ coffeeId: 'proto-colombia', method: 'pourover', grindSetting: '25', grinder: 'Comandante C40', dose: 15, yield: 240, timeSec: 175, bloomSec: 35, taste: 'balanced', dialedIn: true }, 7),
    brew({ coffeeId: 'proto-colombia', method: 'pourover', grindSetting: '24', grinder: 'Comandante C40', dose: 15, yield: 240, timeSec: 190, bloomSec: 35, taste: 'bitter' }, 3),
    brew({ coffeeId: 'proto-ethiopia', method: 'espresso', grindSetting: '14', dose: 18, yield: 40, timeSec: 21, taste: 'sour' }, 2),
    brew({ coffeeId: 'proto-ethiopia', method: 'espresso', grindSetting: '12', dose: 18, yield: 40, timeSec: 25, taste: 'sour' }, 1),
    brew({ coffeeId: 'proto-finished', method: 'espresso', grindSetting: '11', dose: 18, yield: 38, timeSec: 24, taste: 'sour' }, 39),
    brew({ coffeeId: 'proto-finished', method: 'espresso', grindSetting: '9', dose: 18, yield: 36, timeSec: 31, taste: 'bitter' }, 37),
    brew({ coffeeId: 'proto-finished', method: 'espresso', grindSetting: '10', dose: 18, yield: 38, timeSec: 28, taste: 'balanced', dialedIn: true }, 35),
  ]

  const ids = coffees.map((c) => c.id)
  await db.transaction('rw', db.coffees, db.brews, async () => {
    await db.brews.where('coffeeId').anyOf(ids).delete()
    await db.coffees.bulkPut(coffees)
    await db.brews.bulkPut(brews)
  })

  params.delete('seed')
  const qs = params.toString()
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}`)
}
