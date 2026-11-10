/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { Webhook } from 'standardwebhooks'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

// Данни on the server: the import's writes, Изтрий данните and `user.deleted`.
// The whole import, file to rows, is tested in `src/lib/backup.test.ts`.

// Convex skips files with more than one dot, so tests never deploy.
const modules = import.meta.glob(['./**/*.ts', './_generated/*.js', '!./**/*.*.ts'])

const ME = { subject: 'user_me', issuer: 'https://clerk.test' }
const THEM = { subject: 'user_them', issuer: 'https://clerk.test' }

const espresso = { method: 'espresso' as const, grindSetting: '14', preinfusion: false, dialedIn: false }
const coffeeRow = (legacyId: string) => ({ legacyId, name: legacyId, roaster: 'Onyx', tastingNotes: [], finished: false, createdAt: 1, updatedAt: 2 })

function setup() {
  const t = convexTest(schema, modules)
  return { t, me: t.withIdentity(ME), them: t.withIdentity(THEM) }
}

type T = ReturnType<typeof convexTest>

const store = (t: T, text = 'bag') => t.run((ctx) => ctx.storage.store(new Blob([text], { type: 'image/jpeg' })))
const fileExists = (t: T, id: Id<'_storage'>) => t.run(async (ctx) => (await ctx.db.system.get(id)) !== null)

/** Every row of `subject` in every table that holds one, and every stored file. */
const rowsOf = (t: T, subject: string) =>
  t.run(async (ctx) => {
    const mine = { ownerSubject: subject }
    const count = async (table: 'coffees' | 'brews' | 'equipment' | 'releasedPhotos') =>
      (await ctx.db.query(table).collect()).filter((r) => r.ownerSubject === mine.ownerSubject).length
    return {
      coffees: await count('coffees'),
      brews: await count('brews'),
      equipment: await count('equipment'),
      releasedPhotos: await count('releasedPhotos'),
    }
  })
const fileCount = (t: T) => t.run(async (ctx) => (await ctx.db.system.query('_storage').collect()).length)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('import', () => {
  test('existing lists every coffee by file id and by _id, old rows included', async () => {
    const { me, them } = setup()
    const native = await me.mutation(api.coffees.create, { name: 'Made here', roaster: 'Onyx', tastingNotes: [] })
    const { ids } = await me.mutation(api.import.coffees, { coffees: [coffeeRow('dial-in-uuid')] })
    const imported = ids[0][1]
    const brew = await me.mutation(api.brews.save, { coffeeId: native, ...espresso })
    await me.mutation(api.import.brews, { brews: [{ legacyId: 'brew-uuid', coffeeId: imported, ...espresso, createdAt: 5 }] })

    const existing = await me.query(api.import.existing, {})
    expect(new Map(existing.coffees)).toEqual(
      new Map([
        [native, native],
        ['dial-in-uuid', imported],
        [imported, imported],
      ]),
    )
    expect(existing.brews).toEqual(expect.arrayContaining([brew, 'brew-uuid']))
    expect(await them.query(api.import.existing, {})).toEqual({ coffees: [], brews: [] })
  })

  test('coffees: a second run adds nothing and deletes the photo uploaded for it', async () => {
    const { t, me } = setup()
    const first = await store(t, 'first')
    const run1 = await me.mutation(api.import.coffees, { coffees: [{ ...coffeeRow('a'), photo: first }, coffeeRow('b')] })
    expect(run1.added).toBe(2)

    const again = await store(t, 'again')
    const run2 = await me.mutation(api.import.coffees, { coffees: [{ ...coffeeRow('a'), photo: again }, coffeeRow('b')] })
    expect(run2).toEqual({ ids: run1.ids, added: 0 })
    expect(await fileExists(t, again)).toBe(false)
    expect(await fileExists(t, first)).toBe(true)
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 2, brews: 0 })
  })

  test('coffees keep the times from the file', async () => {
    const { me } = setup()
    const { ids } = await me.mutation(api.import.coffees, { coffees: [{ ...coffeeRow('a'), createdAt: 1000, updatedAt: 2000, finished: true }] })
    expect(await me.query(api.coffees.get, { id: ids[0][1] })).toMatchObject({ legacyId: 'a', createdAt: 1000, updatedAt: 2000, finished: true })
  })

  test("coffees can't take someone else's photo", async () => {
    const { t, me, them } = setup()
    const photo = await store(t)
    await me.mutation(api.coffees.create, { name: 'Mine', roaster: 'Onyx', tastingNotes: [], photo })
    await expect(them.mutation(api.import.coffees, { coffees: [{ ...coffeeRow('x'), photo }] })).rejects.toThrow(/photoNotFound/)
  })

  test("brews: skips what you have, and a coffee that isn't yours or doesn't exist", async () => {
    const { me, them } = setup()
    const { ids } = await me.mutation(api.import.coffees, { coffees: [coffeeRow('a')] })
    const mine = ids[0][1]
    const theirs = await them.mutation(api.coffees.create, { name: 'Theirs', roaster: 'Onyx', tastingNotes: [] })
    const brews = [
      { legacyId: 'b1', coffeeId: mine, ...espresso, grinder: 'Niche Zero', createdAt: 5 },
      { legacyId: 'b2', coffeeId: theirs, ...espresso, createdAt: 6 },
      { legacyId: 'b3', coffeeId: 'not-an-id', ...espresso, createdAt: 7 },
    ]
    expect(await me.mutation(api.import.brews, { brews })).toEqual({ added: 1 })
    expect(await me.mutation(api.import.brews, { brews })).toEqual({ added: 0 })
    const [brew] = await me.query(api.brews.byCoffee, { coffeeId: mine })
    expect(brew).toMatchObject({ legacyId: 'b1', grinder: 'Niche Zero', createdAt: 5 })
    expect(await them.query(api.brews.byCoffee, { coffeeId: theirs })).toEqual([])
  })

  test('equipment fills only what is unset', async () => {
    const { me } = setup()
    await me.mutation(api.equipment.set, { grinder: 'Comandante' })
    await me.mutation(api.import.equipment, { grinder: 'Niche Zero', opusInner: 3, opusDial: true })
    expect(await me.query(api.equipment.get, {})).toEqual({ grinder: 'Comandante', opusInner: 3, opusDial: true })
    await me.mutation(api.import.equipment, { opusInner: -2, opusDial: false })
    expect(await me.query(api.equipment.get, {})).toEqual({ grinder: 'Comandante', opusInner: 3, opusDial: true })
    await expect(me.mutation(api.import.equipment, { opusInner: 9 })).rejects.toThrow(/badOpusInner/)
  })

  test('signed out, every call throws', async () => {
    const { t } = setup()
    await expect(t.query(api.import.existing, {})).rejects.toThrow(/signedOut/)
    await expect(t.mutation(api.import.coffees, { coffees: [] })).rejects.toThrow(/signedOut/)
    await expect(t.mutation(api.erase.deleteMyData, {})).rejects.toThrow(/signedOut/)
  })
})

/** A person with a bit of everything: coffees with photos and brews, a replaced photo, equipment. */
async function seedLog(t: T, as: ReturnType<T['withIdentity']>, label: string) {
  const photo = await store(t, `${label} bag`)
  const coffee = await as.mutation(api.coffees.create, { name: `${label} coffee`, roaster: 'Onyx', tastingNotes: [], photo })
  await as.mutation(api.brews.save, { coffeeId: coffee, ...espresso })
  await as.mutation(api.brews.save, { coffeeId: coffee, ...espresso, grindSetting: '12', dialedIn: true })
  // Restocked with a new bag: the old photo waits in releasedPhotos.
  const newBag = await store(t, `${label} new bag`)
  await as.mutation(api.coffees.restock, { id: coffee, changes: { photo: newBag } })
  await as.mutation(api.coffees.create, { name: `${label} second`, roaster: 'Onyx', tastingNotes: [] })
  await as.mutation(api.equipment.set, { grinder: 'Niche Zero', opusDial: true })
  return { photo, newBag }
}

describe('Изтрий данните', () => {
  test('leaves no rows or files of yours, and theirs alone', async () => {
    vi.useFakeTimers()
    const { t, me, them } = setup()
    const mine = await seedLog(t, me, 'mine')
    const theirs = await seedLog(t, them, 'their')
    // Enough coffees to need more than one step.
    await me.mutation(api.import.coffees, { coffees: Array.from({ length: 60 }, (_, i) => coffeeRow(`bulk-${i}`)) })
    expect(await rowsOf(t, ME.subject)).toEqual({ coffees: 62, brews: 2, equipment: 1, releasedPhotos: 1 })
    const theirsBefore = await rowsOf(t, THEM.subject)

    // Time moves on between logging and erasing (the erase takes rows created up to its start).
    vi.advanceTimersByTime(1)
    await me.mutation(api.erase.deleteMyData, {})
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(await rowsOf(t, ME.subject)).toEqual({ coffees: 0, brews: 0, equipment: 0, releasedPhotos: 0 })
    expect(await fileExists(t, mine.photo)).toBe(false)
    expect(await fileExists(t, mine.newBag)).toBe(false)
    expect(await rowsOf(t, THEM.subject)).toEqual(theirsBefore)
    expect(await fileExists(t, theirs.photo)).toBe(true)
    expect(await fileExists(t, theirs.newBag)).toBe(true)
    expect(await fileCount(t)).toBe(2)
    expect(await them.query(api.data.counts, {})).toEqual({ coffees: 2, brews: 2 })
  })

  test('you can start again at once: what you add while it runs is kept', async () => {
    vi.useFakeTimers()
    const { t, me } = setup()
    await seedLog(t, me, 'mine')
    vi.advanceTimersByTime(1)
    await me.mutation(api.erase.deleteMyData, {})
    vi.advanceTimersByTime(1)
    expect(await me.query(api.equipment.get, {})).toEqual({ grinder: '', opusInner: 0, opusDial: false })
    const fresh = await me.mutation(api.coffees.create, { name: 'Fresh start', roaster: 'Onyx', tastingNotes: [] })
    await me.mutation(api.brews.save, { coffeeId: fresh, ...espresso })
    await me.mutation(api.equipment.set, { grinder: 'Comandante' })

    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect((await me.query(api.coffees.listMine, {})).map((c) => c.name)).toEqual(['Fresh start'])
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 1, brews: 1 })
    expect(await me.query(api.equipment.get, {})).toMatchObject({ grinder: 'Comandante' })
  })
})

describe('user.deleted webhook', () => {
  const SECRET = 'whsec_' + btoa('kafeto-endpoint-secret-for-tests')

  function deliver(t: T, body: object, { id = 'msg_1', secret = SECRET } = {}) {
    const payload = JSON.stringify(body)
    const signature = new Webhook(secret).sign(id, new Date(), payload)
    return t.fetch('/clerk/webhook', {
      method: 'POST',
      headers: { 'svix-id': id, 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': signature },
      body: payload,
    })
  }
  const userDeleted = (userId: string) => ({ type: 'user.deleted', object: 'event', data: { id: userId, object: 'user', deleted: true } })

  test('answers 503 and erases nothing while the secret is unset', async () => {
    const { t, me } = setup()
    await seedLog(t, me, 'mine')
    const res = await deliver(t, userDeleted(ME.subject))
    expect(res.status).toBe(503)
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 2, brews: 2 })
  })

  test('rejects a bad signature and erases nothing', async () => {
    vi.stubEnv('CLERK_WEBHOOK_SIGNING_SECRET', SECRET)
    const { t, me } = setup()
    await seedLog(t, me, 'mine')
    const res = await deliver(t, userDeleted(ME.subject), { secret: 'whsec_' + btoa('someone-else') })
    expect(res.status).toBe(400)
    const unsigned = await t.fetch('/clerk/webhook', { method: 'POST', body: JSON.stringify(userDeleted(ME.subject)) })
    expect(unsigned.status).toBe(400)
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 2, brews: 2 })
  })

  test("erases that person's data on a valid user.deleted, and theirs alone", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.stubEnv('CLERK_WEBHOOK_SIGNING_SECRET', SECRET)
    const { t, me, them } = setup()
    const mine = await seedLog(t, me, 'mine')
    await seedLog(t, them, 'their')

    const res = await deliver(t, userDeleted(ME.subject))
    expect(res.status).toBe(200)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(await rowsOf(t, ME.subject)).toEqual({ coffees: 0, brews: 0, equipment: 0, releasedPhotos: 0 })
    expect(await fileExists(t, mine.photo)).toBe(false)
    expect(await them.query(api.data.counts, {})).toEqual({ coffees: 2, brews: 2 })
    const events = await t.run((ctx) => ctx.db.query('processedWebhookEvents').collect())
    expect(events.map((e) => e.svixId)).toEqual(['msg_1'])
  })

  test('a repeated Svix id runs nothing the second time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.stubEnv('CLERK_WEBHOOK_SIGNING_SECRET', SECRET)
    const { t, me } = setup()
    await seedLog(t, me, 'mine')
    expect((await deliver(t, userDeleted(ME.subject), { id: 'msg_same' })).status).toBe(200)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    // You sign up again with the same Clerk id (as in a test) and log a coffee; the retry must not erase it.
    await me.mutation(api.coffees.create, { name: 'After', roaster: 'Onyx', tastingNotes: [] })
    expect((await deliver(t, userDeleted(ME.subject), { id: 'msg_same' })).status).toBe(200)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 1, brews: 0 })
    expect(await t.run((ctx) => ctx.db.query('processedWebhookEvents').collect())).toHaveLength(1)
  })

  test('other event types are acknowledged and ignored', async () => {
    vi.stubEnv('CLERK_WEBHOOK_SIGNING_SECRET', SECRET)
    const { t, me } = setup()
    await seedLog(t, me, 'mine')
    const res = await deliver(t, { type: 'user.updated', object: 'event', data: { id: ME.subject } })
    expect(res.status).toBe(200)
    expect(await me.query(api.data.counts, {})).toEqual({ coffees: 2, brews: 2 })
  })
})
