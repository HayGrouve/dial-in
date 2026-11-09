/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { SWEEP_MARGIN_MS } from './files'
import schema from './schema'

// Convex skips files with more than one dot, so tests never deploy.
const modules = import.meta.glob(['./**/*.ts', './_generated/*.js', '!./**/*.*.ts'])

const ME = { subject: 'user_me', issuer: 'https://clerk.test' }
const THEM = { subject: 'user_them', issuer: 'https://clerk.test' }
const DAY = 24 * 60 * 60 * 1000

const espresso = { method: 'espresso' as const, grindSetting: '14', preinfusion: false, dialedIn: false }

function setup() {
  const t = convexTest(schema, modules)
  return { t, me: t.withIdentity(ME), them: t.withIdentity(THEM) }
}

type T = ReturnType<typeof convexTest>

const store = (t: T, text = 'bag') => t.run((ctx) => ctx.storage.store(new Blob([text], { type: 'image/jpeg' })))
const fileExists = (t: T, id: Id<'_storage'>) => t.run(async (ctx) => (await ctx.db.system.get(id)) !== null)

afterEach(() => {
  vi.useRealTimers()
})

describe('another subject', () => {
  test("cannot read, change or delete your coffees, brews, equipment or photos", async () => {
    const { t, me, them } = setup()
    const photo = await store(t)
    const coffee = await me.mutation(api.coffees.create, { name: 'Hambela', roaster: 'Onyx', tastingNotes: [], photo })
    const brew = await me.mutation(api.brews.save, { coffeeId: coffee, ...espresso })
    await me.mutation(api.equipment.set, { grinder: 'Niche Zero', opusInner: 2, opusDial: true })

    // Reads come back empty, as if the rows did not exist.
    expect(await them.query(api.coffees.get, { id: coffee })).toBeNull()
    expect(await them.query(api.coffees.listMine, {})).toEqual([])
    expect(await them.query(api.brews.get, { id: brew })).toBeNull()
    expect(await them.query(api.brews.listMine, {})).toEqual([])
    expect(await them.query(api.brews.byCoffee, { coffeeId: coffee })).toEqual([])
    expect(await them.query(api.brews.byCoffees, { coffeeIds: [coffee] })).toEqual([])
    expect(await them.query(api.brews.prefill, { coffeeId: coffee })).toBeNull()
    expect(await them.query(api.equipment.get, {})).toEqual({ grinder: '', opusInner: 0, opusDial: false })
    expect(await them.query(api.data.counts, {})).toEqual({ coffees: 0, brews: 0 })

    // Writes fail.
    const details = { name: 'Mine now', roaster: 'Onyx', tastingNotes: [] }
    await expect(them.mutation(api.coffees.update, { id: coffee, ...details })).rejects.toThrow(/notFound/)
    await expect(them.mutation(api.coffees.rate, { id: coffee, rating: 1 })).rejects.toThrow(/notFound/)
    await expect(them.mutation(api.coffees.finish, { id: coffee })).rejects.toThrow(/notFound/)
    await expect(them.mutation(api.coffees.restock, { id: coffee })).rejects.toThrow(/notFound/)
    await expect(them.mutation(api.coffees.restore, { id: coffee, set: { finished: true }, unset: [] })).rejects.toThrow(/notFound/)
    await expect(them.mutation(api.coffees.remove, { id: coffee })).rejects.toThrow(/notFound/)
    await expect(them.mutation(api.brews.save, { coffeeId: coffee, ...espresso })).rejects.toThrow(/notFound/)
    await expect(them.mutation(api.brews.save, { id: brew, coffeeId: coffee, ...espresso, grindSetting: '1' })).rejects.toThrow(/notFound/)
    await expect(them.mutation(api.brews.setDialedIn, { id: brew, value: true })).rejects.toThrow(/notFound/)
    await expect(them.mutation(api.brews.remove, { id: brew })).rejects.toThrow(/notFound/)

    // Your photo can't go on their coffee, so they can't read its URL or delete it through theirs.
    await expect(them.mutation(api.coffees.create, { ...details, photo })).rejects.toThrow(/photoNotFound/)
    const theirs = await them.mutation(api.coffees.create, details)
    await expect(them.mutation(api.coffees.update, { id: theirs, ...details, photo })).rejects.toThrow(/photoNotFound/)
    await expect(them.mutation(api.coffees.restock, { id: theirs, changes: { photo } })).rejects.toThrow(/photoNotFound/)
    await expect(them.mutation(api.coffees.restore, { id: theirs, set: { photo }, unset: [] })).rejects.toThrow(/photoNotFound/)

    // Their equipment is their own row.
    await them.mutation(api.equipment.set, { grinder: 'Comandante' })
    expect(await me.query(api.equipment.get, {})).toEqual({ grinder: 'Niche Zero', opusInner: 2, opusDial: true })

    // Nothing of yours changed.
    const mine = await me.query(api.coffees.get, { id: coffee })
    expect(mine).toMatchObject({ name: 'Hambela', finished: false, photo })
    expect(mine?.photoUrl).toMatch(/^https:/)
    expect(await me.query(api.brews.get, { id: brew })).toMatchObject({ grindSetting: '14', dialedIn: false })
    expect(await fileExists(t, photo)).toBe(true)
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 1, brews: 1 })
  })

  test('signed out reads and writes throw', async () => {
    const { t } = setup()
    await expect(t.query(api.coffees.listMine, {})).rejects.toThrow(/signedOut/)
    await expect(t.mutation(api.files.generateUploadUrl, {})).rejects.toThrow(/signedOut/)
  })
})

test('an unknown or malformed id reads as null', async () => {
  const { me } = setup()
  expect(await me.query(api.coffees.get, { id: 'not-an-id' })).toBeNull()
  expect(await me.query(api.coffees.get, { id: '3f2b5a1e-0000-4000-8000-000000000000' })).toBeNull()
  expect(await me.query(api.brews.get, { id: 'nope' })).toBeNull()
})

describe('brews', () => {
  test('setDialedIn keeps one dialed-in brew per coffee and method', async () => {
    const { t, me } = setup()
    const coffee = await me.mutation(api.coffees.create, { name: 'Hambela', roaster: 'Onyx', tastingNotes: [] })
    const a = await me.mutation(api.brews.save, { coffeeId: coffee, ...espresso, grindSetting: '12' })
    const b = await me.mutation(api.brews.save, { coffeeId: coffee, ...espresso, grindSetting: '13' })
    const pour = await me.mutation(api.brews.save, { coffeeId: coffee, ...espresso, method: 'pourover', dialedIn: true })
    const dialed = async () =>
      (await me.query(api.brews.byCoffee, { coffeeId: coffee })).filter((x) => x.dialedIn).map((x) => x._id).sort()

    await me.mutation(api.brews.setDialedIn, { id: a, value: true })
    expect(await dialed()).toEqual([a, pour].sort())

    const before = (await me.query(api.coffees.get, { id: coffee }))!.updatedAt
    await new Promise((r) => setTimeout(r, 2))
    await me.mutation(api.brews.setDialedIn, { id: b, value: true })
    expect(await dialed()).toEqual([b, pour].sort())
    expect((await me.query(api.coffees.get, { id: coffee }))!.updatedAt).toBeGreaterThan(before)

    // Saving a brew as dialed in does the same.
    const c = await me.mutation(api.brews.save, { coffeeId: coffee, ...espresso, grindSetting: '14', dialedIn: true })
    expect(await dialed()).toEqual([c, pour].sort())

    await me.mutation(api.brews.setDialedIn, { id: c, value: false })
    expect(await dialed()).toEqual([pour])

    // Another coffee's pin is untouched.
    const other = await me.mutation(api.coffees.create, { name: 'Other', roaster: 'Onyx', tastingNotes: [] })
    const o = await me.mutation(api.brews.save, { coffeeId: other, ...espresso, dialedIn: true })
    await me.mutation(api.brews.setDialedIn, { id: a, value: true })
    expect(await t.run((ctx) => ctx.db.get(o))).toMatchObject({ dialedIn: true })
  })

  test('a new brew is stamped with the grinder; an edit keeps its own', async () => {
    const { me } = setup()
    const coffee = await me.mutation(api.coffees.create, { name: 'Hambela', roaster: 'Onyx', tastingNotes: [] })
    await me.mutation(api.equipment.set, { grinder: '  Niche Zero ' })
    const brew = await me.mutation(api.brews.save, { coffeeId: coffee, ...espresso })
    expect(await me.query(api.brews.get, { id: brew })).toMatchObject({ grinder: 'Niche Zero' })
    await me.mutation(api.equipment.set, { grinder: 'Comandante' })
    await me.mutation(api.brews.save, { id: brew, coffeeId: coffee, ...espresso, grindSetting: '15' })
    expect(await me.query(api.brews.get, { id: brew })).toMatchObject({ grinder: 'Niche Zero', grindSetting: '15' })
  })

  test('prefill finds the last brew by coffee and by method', async () => {
    const { me } = setup()
    const hambela = await me.mutation(api.coffees.create, { name: 'Hambela', roaster: 'Onyx', tastingNotes: [] })
    const fresh = await me.mutation(api.coffees.create, { name: 'Fresh', roaster: 'Onyx', tastingNotes: [] })
    expect(await me.query(api.brews.prefill, { coffeeId: fresh })).toEqual({ method: 'espresso', same: null, other: null })

    await me.mutation(api.brews.save, { coffeeId: hambela, ...espresso, grindSetting: '12' })
    const last = await me.mutation(api.brews.save, { coffeeId: hambela, ...espresso, method: 'pourover', grindSetting: '24' })
    const here = await me.query(api.brews.prefill, { coffeeId: hambela })
    expect(here).toMatchObject({ method: 'pourover', same: { _id: last } })
    expect((await me.query(api.brews.prefill, { coffeeId: hambela, method: 'espresso' }))?.same?.grindSetting).toBe('12')

    const elsewhere = await me.query(api.brews.prefill, { coffeeId: fresh })
    expect(elsewhere).toMatchObject({ method: 'pourover', same: null, other: { _id: last } })
  })
})

describe('coffees', () => {
  test('finish, restock and restore round-trip, photo included', async () => {
    const { t, me } = setup()
    const oldPhoto = await store(t, 'old')
    const id = await me.mutation(api.coffees.create, { name: 'Hambela', roaster: 'Onyx', tastingNotes: [], photo: oldPhoto })
    const original = (await me.query(api.coffees.get, { id }))!

    const finished = await me.mutation(api.coffees.finish, { id })
    expect(await me.query(api.coffees.get, { id })).toMatchObject({ finished: true })
    await me.mutation(api.coffees.restore, finished)
    expect(await me.query(api.coffees.get, { id })).toEqual(original)

    await me.mutation(api.coffees.finish, { id })
    const finishedCoffee = (await me.query(api.coffees.get, { id }))!
    const newPhoto = await store(t, 'new')
    const restocked = await me.mutation(api.coffees.restock, { id, changes: { photo: newPhoto, origin: 'Ethiopia', tastingNotes: ['jasmine'] } })
    expect(await me.query(api.coffees.get, { id })).toMatchObject({ finished: false, photo: newPhoto, origin: 'Ethiopia', tastingNotes: ['jasmine'] })
    // The replaced photo stays in storage, so Undo can put it back.
    expect(await fileExists(t, oldPhoto)).toBe(true)

    await me.mutation(api.coffees.restore, restocked)
    const undone = (await me.query(api.coffees.get, { id }))!
    expect(undone).toEqual(finishedCoffee)
    expect(undone.origin).toBeUndefined()

    // A restock that took a photo off, undone, puts it back too.
    const noPhoto = await me.mutation(api.coffees.create, { name: 'Bare', roaster: 'Onyx', tastingNotes: [] })
    const r = await me.mutation(api.coffees.restock, { id: noPhoto, changes: { photo: newPhoto } })
    expect(r.unset).toContain('photo')
    await me.mutation(api.coffees.restore, r)
    expect((await me.query(api.coffees.get, { id: noPhoto }))!.photo).toBeUndefined()
  })

  test('update replaces the details; cleared fields go', async () => {
    const { me } = setup()
    const id = await me.mutation(api.coffees.create, { name: 'Hambela', roaster: 'Onyx', origin: 'Ethiopia', tastingNotes: ['jasmine'], rating: 4 })
    await me.mutation(api.coffees.update, { id, name: 'Hambela Alaka', roaster: 'Onyx', tastingNotes: [] })
    const c = (await me.query(api.coffees.get, { id }))!
    expect(c).toMatchObject({ name: 'Hambela Alaka', tastingNotes: [], finished: false })
    expect(c.origin).toBeUndefined()
    expect(c.rating).toBeUndefined()
    await expect(me.mutation(api.coffees.rate, { id, rating: 6 })).rejects.toThrow(/badRating/)
  })

  test('remove deletes the brews, the coffee and its photo', async () => {
    const { t, me } = setup()
    const photo = await store(t)
    const id = await me.mutation(api.coffees.create, { name: 'Hambela', roaster: 'Onyx', tastingNotes: [], photo })
    await me.mutation(api.brews.save, { coffeeId: id, ...espresso })
    await me.mutation(api.coffees.remove, { id })
    expect(await me.query(api.coffees.get, { id })).toBeNull()
    expect(await me.query(api.brews.listMine, {})).toEqual([])
    expect(await fileExists(t, photo)).toBe(false)
  })
})

describe('files.sweep', () => {
  test('deletes only files no coffee holds, past the margin', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const start = new Date('2026-11-01T12:00:00Z').getTime()
    vi.setSystemTime(start)
    const { t, me } = setup()

    const held = await store(t, 'held')
    const orphan = await store(t, 'orphan upload')
    const replaced = await store(t, 'replaced long ago')
    const justReplaced = await store(t, 'replaced just now')
    const id = await me.mutation(api.coffees.create, { name: 'Hambela', roaster: 'Onyx', tastingNotes: [], photo: replaced })
    const other = await me.mutation(api.coffees.create, { name: 'Other', roaster: 'Onyx', tastingNotes: [], photo: justReplaced })
    // `replaced` is let go of now; `justReplaced` two days later, right before the sweep.
    await me.mutation(api.coffees.update, { id, name: 'Hambela', roaster: 'Onyx', tastingNotes: [], photo: held })

    vi.setSystemTime(start + 2 * DAY)
    const fresh = await store(t, 'uploaded a moment ago')
    await me.mutation(api.coffees.finish, { id: other })
    const undo = await me.mutation(api.coffees.restock, { id: other, changes: { photo: fresh } })

    await t.mutation(internal.files.sweep, {})

    expect(await fileExists(t, held)).toBe(true)
    expect(await fileExists(t, orphan)).toBe(false)
    expect(await fileExists(t, replaced)).toBe(false)
    expect(await fileExists(t, justReplaced)).toBe(true)
    expect(await fileExists(t, fresh)).toBe(true)

    // So Undo still works after the sweep.
    await me.mutation(api.coffees.restore, undo)
    expect((await me.query(api.coffees.get, { id: other }))!.photoUrl).toMatch(/^https:/)

    // Once the margin has passed, the photo the undo replaced goes too.
    vi.setSystemTime(start + 2 * DAY + SWEEP_MARGIN_MS + 1)
    await t.mutation(internal.files.sweep, {})
    expect(await fileExists(t, fresh)).toBe(false)
    expect(await fileExists(t, justReplaced)).toBe(true)
    expect(await fileExists(t, held)).toBe(true)
  })
})
