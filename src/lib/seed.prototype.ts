// PROTOTYPE, throwaway. Visit `/?seed=prototype` (dev or Vercel preview) to write sample coffees for
// the returning-coffee offer (#12). Fixed `proto-*` ids, so re-seeding resets them (and undoes any
// restock you accepted); other coffees are untouched.
//   Finished: Santa Rosa Pacamara (Kiln & Crow, pinned espresso 10), Gatomboya AA (Northbound, no pin)
//   Shelf:    Sidama Bensa (Northbound, still dialing)
//   Duplicate pair, both finished: Halo Beriti (Tanager & Co), updated 3 weeks and 4 months ago
import { PROTOTYPE } from '../components/PrototypeSwitcher'
import { db, type Brew, type Coffee } from './db'

const DAY = 86_400_000

export async function seedPrototypeData() {
  const params = new URLSearchParams(location.search)
  if (!PROTOTYPE || params.get('seed') !== 'prototype') return

  const now = Date.now()
  const coffee = (c: Partial<Coffee> & Pick<Coffee, 'id' | 'name' | 'roaster'>, createdDaysAgo: number, updatedDaysAgo = createdDaysAgo): Coffee => ({
    tastingNotes: [],
    finished: false,
    createdAt: now - createdDaysAgo * DAY,
    updatedAt: now - updatedDaysAgo * DAY,
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
        id: 'proto-pacamara',
        name: 'Santa Rosa Pacamara',
        roaster: 'Kiln & Crow',
        origin: 'El Salvador',
        process: 'Honey',
        varietal: 'Pacamara',
        roastLevel: 'Medium',
        bagWeight: 250,
        tastingNotes: ['plum', 'cocoa nib'],
        rating: 4,
        finished: true,
      },
      70,
      36,
    ),
    coffee(
      {
        id: 'proto-gatomboya',
        name: 'Gatomboya AA',
        roaster: 'Northbound Roasters',
        origin: 'Kenya',
        region: 'Nyeri',
        process: 'Washed',
        varietal: 'SL28, SL34',
        roastLevel: 'Light',
        tastingNotes: ['blackcurrant', 'grapefruit'],
        finished: true,
      },
      90,
      60,
    ),
    coffee(
      {
        id: 'proto-sidama',
        name: 'Sidama Bensa',
        roaster: 'Northbound Roasters',
        origin: 'Ethiopia',
        process: 'Natural',
        roastLevel: 'Medium-light',
        bagWeight: 250,
        tastingNotes: ['blueberry', 'jasmine'],
      },
      5,
      1,
    ),
    coffee(
      {
        id: 'proto-beriti-new',
        name: 'Halo Beriti',
        roaster: 'Tanager & Co',
        origin: 'Ethiopia',
        region: 'Yirgacheffe',
        process: 'Washed',
        tastingNotes: ['bergamot', 'peach'],
        rating: 5,
        finished: true,
      },
      50,
      21,
    ),
    coffee(
      {
        id: 'proto-beriti-old',
        name: 'Halo  Beriti',
        roaster: 'Tanager & Co.',
        origin: 'Ethiopia',
        roastLevel: 'Light',
        tastingNotes: ['lemon', 'black tea'],
        rating: 3,
        finished: true,
      },
      160,
      120,
    ),
  ]

  const brews = [
    brew({ coffeeId: 'proto-pacamara', method: 'espresso', grindSetting: '12', dose: 18, yield: 38, timeSec: 22, taste: 'sour' }, 68),
    brew({ coffeeId: 'proto-pacamara', method: 'espresso', grindSetting: '9', dose: 18, yield: 36, timeSec: 33, taste: 'bitter' }, 66),
    brew({ coffeeId: 'proto-pacamara', method: 'espresso', grindSetting: '10', dose: 18, yield: 38, timeSec: 28, temperature: 93, taste: 'balanced', dialedIn: true }, 64),
    brew({ coffeeId: 'proto-gatomboya', method: 'pourover', grinder: 'Comandante C40', grindSetting: '26', dose: 15, yield: 250, timeSec: 170, taste: 'sour' }, 85),
    brew({ coffeeId: 'proto-sidama', method: 'espresso', grindSetting: '14', dose: 18, yield: 40, timeSec: 21, taste: 'sour' }, 3),
    brew({ coffeeId: 'proto-sidama', method: 'espresso', grindSetting: '12', dose: 18, yield: 40, timeSec: 25, taste: 'sour' }, 1),
    brew({ coffeeId: 'proto-beriti-new', method: 'pourover', grinder: 'Comandante C40', grindSetting: '24', dose: 15, yield: 240, timeSec: 180, bloomSec: 40, taste: 'sour' }, 45),
    brew({ coffeeId: 'proto-beriti-new', method: 'pourover', grinder: 'Comandante C40', grindSetting: '22', dose: 15, yield: 240, timeSec: 195, bloomSec: 40, taste: 'balanced', dialedIn: true }, 44),
    brew({ coffeeId: 'proto-beriti-old', method: 'espresso', grindSetting: '8', dose: 18, yield: 40, timeSec: 27, taste: 'balanced', dialedIn: true }, 150),
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
