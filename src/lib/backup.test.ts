/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import schema from '../../convex/schema'
import {
  BackupError,
  buildExport,
  dataUrlToBlob,
  importBackup,
  NOT_A_BACKUP,
  parseBackup,
  type DialInBackupFile,
  type ImportApi,
  type ImportProgress,
} from './backup'
import fixtureJson from './fixtures/dial-in-v1.json?raw'

// The whole Внеси от Dial In, file to rows, against convex-test. The fixture
// is a made-up Dial In export in the v1 format `main` writes (7 coffees, 5 of
// them with small generated bag photos, 19 brews, one of them for a coffee
// deleted before the export, per-brew ratings on one coffee from before
// Dial In's v3, a `roastDate` from before its v2, and a grinder).

const modules = import.meta.glob(['../../convex/**/*.ts', '../../convex/_generated/*.js', '!../../convex/**/*.*.ts'])

const ME = { subject: 'user_me', issuer: 'https://clerk.test' }
const NEW_PERSON = { subject: 'user_new', issuer: 'https://clerk.test' }

const fixture = JSON.parse(fixtureJson) as DialInBackupFile
const byName = (name: string) => fixture.coffees.find((c) => c.name === name)!

type T = ReturnType<typeof convexTest>
type As = ReturnType<T['withIdentity']>

function setup() {
  const t = convexTest(schema, modules)
  return { t, me: t.withIdentity(ME), fresh: t.withIdentity(NEW_PERSON) }
}

/** The importer's calls, as the app makes them, against convex-test; counts uploads. */
function io(t: T, as: As) {
  const calls = { uploads: 0, coffeeBatches: 0, brewBatches: 0 }
  const api_: ImportApi = {
    existing: () => as.query(api.import.existing, {}),
    uploadPhoto: async (photo) => {
      calls.uploads++
      return t.run((ctx) => ctx.storage.store(photo))
    },
    coffees: (args) => {
      calls.coffeeBatches++
      return as.mutation(api.import.coffees, args)
    },
    brews: (args) => {
      calls.brewBatches++
      return as.mutation(api.import.brews, args)
    },
    equipment: (args) => as.mutation(api.import.equipment, args),
  }
  return Object.assign(api_, { calls })
}

const fileCount = (t: T) => t.run(async (ctx) => (await ctx.db.system.query('_storage').collect()).length)
const bytes = async (blob: Blob) => [...new Uint8Array(await blob.arrayBuffer())]
/** A stored file's type and bytes (a Blob can't leave `t.run`). */
const storedFile = (t: T, id: Id<'_storage'>) =>
  t.run(async (ctx) => {
    const blob = (await ctx.storage.get(id))!
    return { type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())] }
  })

/** What `fetchPhoto` does in the browser, reading convex-test's storage instead of the URL. */
function photoGetter(t: T, data: { coffees: { photo?: Id<'_storage'>; photoUrl?: string }[] }) {
  const ids = new Map(data.coffees.map((c) => [c.photoUrl, c.photo]))
  return async (url: string) => {
    const file = await storedFile(t, ids.get(url)!)
    return `data:${file.type};base64,${btoa(String.fromCharCode(...file.bytes))}`
  }
}

describe('parseBackup', () => {
  test('reads the Dial In fixture into clean rows', () => {
    const file = parseBackup(fixtureJson)
    expect(file.app).toBe('dial-in')
    expect(file.coffees).toHaveLength(7)
    expect(file.brews).toHaveLength(19)
    expect(file.equipment).toEqual({ grinder: 'Fellow Opus', opusInner: undefined, opusDial: undefined })
    // Kiambu's brews were rated 2, 4 and 3 before ratings moved to the coffee.
    expect(file.coffees.find((c) => c.name === 'Kiambu AA')?.rating).toBe(4)
    expect(file.brews.some((b) => 'rating' in b)).toBe(false)
    // Fields Dial In no longer has are dropped.
    expect(file.coffees.some((c) => 'roastDate' in c)).toBe(false)
  })

  test('rejects anything that is not a Dial In or Кафето file', () => {
    for (const bad of ['not json', '[]', '{"app":"something-else","coffees":[]}', '{}']) {
      expect(() => parseBackup(bad)).toThrow(BackupError)
      expect(() => parseBackup(bad)).toThrow(NOT_A_BACKUP)
    }
  })

  test('repairs or drops what a hand-edited file gets wrong', () => {
    const file = parseBackup(
      JSON.stringify({
        app: 'dial-in',
        version: 1,
        coffees: [
          { id: 'c1', name: 'Kept', roaster: 'R', tastingNotes: ['ok', 3, ''], rating: 7, bagWeight: '250', createdAt: '2025-01-01T00:00:00Z' },
          { id: 'c1', name: 'Repeated id', roaster: 'R' },
          { name: 'No id' },
        ],
        brews: [{ id: 'b1', coffeeId: 'c1', method: 'siphon', grindSetting: 14, taste: 'salty', dialedIn: 'yes', createdAt: 5 }],
      }),
      99,
    )
    expect(file.coffees).toEqual([
      expect.objectContaining({ id: 'c1', name: 'Kept', tastingNotes: ['ok'], rating: undefined, bagWeight: undefined, createdAt: Date.parse('2025-01-01T00:00:00Z'), finished: false }),
    ])
    expect(file.brews[0]).toMatchObject({ method: 'other', grindSetting: '14', taste: undefined, dialedIn: false, preinfusion: false, createdAt: 5 })
  })

  test('dataUrlToBlob decodes a photo byte for byte', async () => {
    const blob = dataUrlToBlob('data:image/jpeg;base64,/9j/AA==')
    expect(blob.type).toBe('image/jpeg')
    expect(await bytes(blob)).toEqual([0xff, 0xd8, 0xff, 0x00])
  })
})

describe('importBackup', () => {
  test('brings in the Dial In file: counts, photos, ratings, pins, times and the grinder', async () => {
    const { t, me } = setup()
    const calls = io(t, me)
    const progress: ImportProgress[] = []
    const result = await importBackup(fixtureJson, calls, (p) => progress.push(p))

    // The brew whose coffee was deleted in Dial In has nowhere to go.
    expect(result).toEqual({ coffees: 7, brews: 18 })
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 7, brews: 18 })
    expect(calls.calls.uploads).toBe(5)
    expect(await fileCount(t)).toBe(5)

    // Photos one by one, with a line for each, then the brews.
    expect(progress.filter((p) => p.step === 'photos').map((p) => p.done)).toEqual([0, 1, 2, 3, 4, 5])
    expect(progress.at(-1)).toEqual({ step: 'brews', done: 0, total: 18 })

    const coffees = await me.query(api.coffees.listMine, {})
    const hambela = coffees.find((c) => c.legacyId === byName('Hambela Alaka').id)!
    expect(hambela).toMatchObject({
      name: 'Hambela Alaka',
      roaster: 'Onyx Coffee Lab',
      origin: 'Ethiopia',
      process: 'Washed',
      roastLevel: 'Light',
      tastingNotes: ['jasmine', 'peach', 'bergamot'],
      bagWeight: 250,
      rating: 5,
      finished: false,
      createdAt: byName('Hambela Alaka').createdAt,
      updatedAt: byName('Hambela Alaka').updatedAt,
    })
    // The stored photo is the file's photo, byte for byte.
    expect((await storedFile(t, hambela.photo!)).bytes).toEqual(await bytes(dataUrlToBlob(byName('Hambela Alaka').photo!)))
    expect(coffees.find((c) => c.name === 'Kiambu AA')).toMatchObject({ rating: 4, finished: true })
    expect(coffees.find((c) => c.name === 'Santos Espresso')?.photo).toBeUndefined()

    const brews = await me.query(api.brews.byCoffee, { coffeeId: hambela._id })
    expect(brews).toHaveLength(5)
    expect(brews.filter((b) => b.dialedIn).map((b) => b.method).sort()).toEqual(['espresso', 'pourover'])
    expect(brews.every((b) => b.grinder === 'Fellow Opus')).toBe(true)
    const shot = brews.find((b) => b.method === 'espresso' && b.dialedIn)!
    expect(shot).toMatchObject({ grindSetting: '1.2', dose: 18, yield: 40, timeSec: 29, preinfusion: true, preinfusionSec: 5, taste: 'balanced' })
    expect(await me.query(api.equipment.get, {})).toMatchObject({ grinder: 'Fellow Opus' })
  })

  test('is idempotent: a second run adds nothing and uploads no photo', async () => {
    const { t, me } = setup()
    expect(await importBackup(fixtureJson, io(t, me))).toEqual({ coffees: 7, brews: 18 })
    const second = io(t, me)
    expect(await importBackup(fixtureJson, second)).toEqual({ coffees: 0, brews: 0 })
    expect(second.calls).toEqual({ uploads: 0, coffeeBatches: 0, brewBatches: 0 })
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 7, brews: 18 })
    expect(await fileCount(t)).toBe(5)
  })

  test('brews in a later file attach to coffees an earlier file brought', async () => {
    const { t, me } = setup()
    await importBackup(fixtureJson, io(t, me))

    // The final export, weeks later: one new coffee, new brews on old coffees.
    const hambela = byName('Hambela Alaka')
    const later: DialInBackupFile = {
      ...fixture,
      exportedAt: '2025-10-20T08:00:00.000Z',
      coffees: [
        ...fixture.coffees,
        { id: 'new-coffee-uuid', name: 'Gesha Village', roaster: 'Onyx Coffee Lab', tastingNotes: ['jasmine'], finished: false, createdAt: 1_760_000_000_000, updatedAt: 1_760_000_000_000, photo: hambela.photo },
      ],
      brews: [
        ...fixture.brews,
        { id: 'later-brew-1', coffeeId: hambela.id, method: 'espresso', grindSetting: '1.1', preinfusion: false, dialedIn: false, createdAt: 1_760_000_100_000 },
        { id: 'later-brew-2', coffeeId: 'new-coffee-uuid', method: 'pourover', grindSetting: '6', preinfusion: false, dialedIn: true, createdAt: 1_760_000_200_000 },
      ],
    }
    const calls = io(t, me)
    expect(await importBackup(JSON.stringify(later), calls)).toEqual({ coffees: 1, brews: 2 })
    expect(calls.calls.uploads).toBe(1)

    const coffees = await me.query(api.coffees.listMine, {})
    const old = coffees.find((c) => c.legacyId === hambela.id)!
    const oldBrews = await me.query(api.brews.byCoffee, { coffeeId: old._id })
    expect(oldBrews).toHaveLength(6)
    expect(oldBrews[0]).toMatchObject({ legacyId: 'later-brew-1', grindSetting: '1.1' })
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 8, brews: 20 })
  })

  test('the grinder in the file never replaces yours', async () => {
    const { t, me } = setup()
    await me.mutation(api.equipment.set, { grinder: 'Comandante C40' })
    await importBackup(fixtureJson, io(t, me))
    expect(await me.query(api.equipment.get, {})).toMatchObject({ grinder: 'Comandante C40' })
  })

  test('works in batches: more coffees and brews than one batch holds', async () => {
    const { t, me } = setup()
    const coffees = Array.from({ length: 120 }, (_, i) => ({ id: `c${i}`, name: `Coffee ${i}`, roaster: 'R', tastingNotes: [], finished: false, createdAt: i, updatedAt: i }))
    const brews = Array.from({ length: 450 }, (_, i) => ({ id: `b${i}`, coffeeId: `c${i % 120}`, method: 'espresso', grindSetting: '1', preinfusion: false, dialedIn: false, createdAt: i }))
    const big = JSON.stringify({ app: 'dial-in', version: 1, exportedAt: '', coffees, brews })
    const calls = io(t, me)
    expect(await importBackup(big, calls)).toEqual({ coffees: 120, brews: 450 })
    expect(calls.calls).toMatchObject({ coffeeBatches: 3, brewBatches: 3 })
    expect(await importBackup(big, io(t, me))).toEqual({ coffees: 0, brews: 0 })
  })
})

describe('Изнеси', () => {
  test('a v2 file that restores everything into a new Акаунт, and adds nothing back home', async () => {
    const { t, me, fresh } = setup()
    await importBackup(fixtureJson, io(t, me))
    await me.mutation(api.equipment.set, { opusInner: -2, opusDial: true })
    // A coffee and a brew made in Кафето itself, not from Dial In.
    const native = await me.mutation(api.coffees.create, { name: 'Made here', roaster: 'Onyx', tastingNotes: ['cocoa'] })
    await me.mutation(api.brews.save, { coffeeId: native, method: 'aeropress', grindSetting: '4', preinfusion: false, dialedIn: true })

    const data = await me.query(api.data.exportMine, {})
    const progress: number[] = []
    const file = await buildExport(data, photoGetter(t, data), (done) => progress.push(done), new Date('2026-11-10T09:00:00Z'))
    expect(file).toMatchObject({ app: 'kafeto', version: 2, exportedAt: '2026-11-10T09:00:00.000Z' })
    expect(file.equipment).toEqual({ grinder: 'Fellow Opus', opusInner: -2, opusDial: true })
    expect(file.coffees).toHaveLength(8)
    expect(file.brews).toHaveLength(19)
    expect(progress).toEqual([0, 1, 2, 3, 4, 5])
    // Rows from Dial In keep its id; a row made here carries its own.
    expect(file.coffees.find((c) => c.name === 'Hambela Alaka')?.id).toBe(byName('Hambela Alaka').id)
    expect(file.coffees.find((c) => c.name === 'Made here')?.id).toBe(native)
    // No Convex fields leak into the file.
    for (const c of file.coffees) expect(Object.keys(c).filter((k) => k.startsWith('_') || k === 'ownerSubject' || k === 'legacyId' || k === 'photoUrl')).toEqual([])

    const json = JSON.stringify(file)
    // Into a fresh Акаунт: everything, photos included.
    expect(await importBackup(json, io(t, fresh))).toEqual({ coffees: 8, brews: 19 })
    expect(await fresh.query(api.data.counts, {})).toEqual({ coffees: 8, brews: 19 })
    expect(await fresh.query(api.equipment.get, {})).toEqual({ grinder: 'Fellow Opus', opusInner: -2, opusDial: true })
    const theirHambela = (await fresh.query(api.coffees.listMine, {})).find((c) => c.name === 'Hambela Alaka')!
    expect((await storedFile(t, theirHambela.photo!)).bytes).toEqual(await bytes(dataUrlToBlob(byName('Hambela Alaka').photo!)))
    // And again: nothing new.
    expect(await importBackup(json, io(t, fresh))).toEqual({ coffees: 0, brews: 0 })

    // Back into the Акаунт it came from: nothing new, not even the row made here.
    const home = io(t, me)
    expect(await importBackup(json, home)).toEqual({ coffees: 0, brews: 0 })
    expect(home.calls.uploads).toBe(0)
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 8, brews: 19 })
    // The old Dial In file on top of it adds nothing either.
    expect(await importBackup(fixtureJson, io(t, fresh))).toEqual({ coffees: 0, brews: 0 })
  })
})
