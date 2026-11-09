import { ConvexError, v, type Infer } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { requireSubject } from './lib/auth'
import { coffeeDetails } from './lib/fields'
import { assertPhotoUsable, deletePhotoIfUnheld, releasePhoto, withPhotoUrl } from './lib/photos'

/** Your coffee with this id, or null: unknown, malformed and someone else's all read the same. */
export async function readOwnCoffee(ctx: QueryCtx, subject: string, id: string): Promise<Doc<'coffees'> | null> {
  const coffeeId = ctx.db.normalizeId('coffees', id)
  const coffee = coffeeId && (await ctx.db.get(coffeeId))
  return coffee && coffee.ownerSubject === subject ? coffee : null
}

async function ownCoffee(ctx: MutationCtx, subject: string, id: Id<'coffees'>) {
  const coffee = await readOwnCoffee(ctx, subject, id)
  if (!coffee) throw new ConvexError({ code: 'notFound' })
  return coffee
}

function checkRating(rating: number | undefined) {
  if (rating !== undefined && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    throw new ConvexError({ code: 'badRating' })
  }
}

/** Newest change first, as the shelf shows them. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const subject = await requireSubject(ctx)
    const coffees = await ctx.db
      .query('coffees')
      .withIndex('by_owner_updatedAt', (q) => q.eq('ownerSubject', subject))
      .order('desc')
      .collect()
    return Promise.all(coffees.map((c) => withPhotoUrl(ctx, c)))
  },
})

/** Takes any string, so a route with a malformed id renders not-found instead of throwing. */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const subject = await requireSubject(ctx)
    const coffee = await readOwnCoffee(ctx, subject, id)
    return coffee && withPhotoUrl(ctx, coffee)
  },
})

export const create = mutation({
  args: coffeeDetails,
  handler: async (ctx, details) => {
    const subject = await requireSubject(ctx)
    checkRating(details.rating)
    await assertPhotoUsable(ctx, subject, details.photo)
    const now = Date.now()
    return ctx.db.insert('coffees', { ...details, ownerSubject: subject, finished: false, createdAt: now, updatedAt: now })
  },
})

/** Edit coffee: the form's fields replace the stored ones, so a cleared field is removed. */
export const update = mutation({
  args: { id: v.id('coffees'), ...coffeeDetails },
  handler: async (ctx, { id, ...details }) => {
    const subject = await requireSubject(ctx)
    const coffee = await ownCoffee(ctx, subject, id)
    checkRating(details.rating)
    await assertPhotoUsable(ctx, subject, details.photo)
    const { ownerSubject, legacyId, finished, createdAt } = coffee
    await ctx.db.replace(id, { ownerSubject, legacyId, finished, createdAt, ...details, updatedAt: Date.now() })
    await releasePhoto(ctx, coffee.photo, details.photo)
  },
})

export const rate = mutation({
  args: { id: v.id('coffees'), rating: v.optional(v.number()) },
  handler: async (ctx, { id, rating }) => {
    const subject = await requireSubject(ctx)
    await ownCoffee(ctx, subject, id)
    checkRating(rating)
    await ctx.db.patch(id, { rating, updatedAt: Date.now() })
  },
})

/** The coffee, its brews and its photo file. */
export const remove = mutation({
  args: { id: v.id('coffees') },
  handler: async (ctx, { id }) => {
    const subject = await requireSubject(ctx)
    const coffee = await ownCoffee(ctx, subject, id)
    const brews = await ctx.db
      .query('brews')
      .withIndex('by_coffee_method', (q) => q.eq('coffeeId', id))
      .collect()
    for (const brew of brews) await ctx.db.delete(brew._id)
    await ctx.db.delete(id)
    await deletePhotoIfUnheld(ctx, coffee.photo)
  },
})

// Finish and Restock return what they replaced; Undo hands it to `restore`.

// Every detail but the name and roaster; all optional but the tasting notes.
const { name: _name, roaster: _roaster, ...restockable } = coffeeDetails
const optionalDetails = { ...restockable, tastingNotes: v.optional(restockable.tastingNotes) }

/** What a new bag can change on a restock: a photo, and details to fill in. */
const restockChanges = v.object(optionalDetails)

/** The fields Finish, Restock and Undo touch, with the value to put back. */
const restoreSet = v.object({ ...optionalDetails, finished: v.optional(v.boolean()), updatedAt: v.optional(v.number()) })

/** Fields that were empty before and go back to empty. */
const clearable = v.union(
  v.literal('origin'),
  v.literal('region'),
  v.literal('producer'),
  v.literal('varietal'),
  v.literal('process'),
  v.literal('altitude'),
  v.literal('roastLevel'),
  v.literal('bagWeight'),
  v.literal('notes'),
  v.literal('rating'),
  v.literal('photo'),
)

export type Restore = { id: Id<'coffees'>; set: Infer<typeof restoreSet>; unset: Infer<typeof clearable>[] }

/**
 * Applies `changes` and moves the coffee to the front of its list. Returns
 * exactly the fields it replaced, `updatedAt` included, so Undo doesn't
 * reorder the shelf. A replaced photo is left for the sweep, so Undo can put
 * it back.
 */
async function changeCoffee(ctx: MutationCtx, id: Id<'coffees'>, changes: Infer<typeof restoreSet>): Promise<Restore> {
  const subject = await requireSubject(ctx)
  const coffee = await ownCoffee(ctx, subject, id)
  checkRating(changes.rating)
  await assertPhotoUsable(ctx, subject, changes.photo)
  const next = { ...changes, updatedAt: Date.now() }
  const set: Record<string, unknown> = {}
  const unset: Infer<typeof clearable>[] = []
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    const before = coffee[key]
    if (before === undefined) unset.push(key as Infer<typeof clearable>)
    else set[key] = before
  }
  await ctx.db.patch(id, next)
  if ('photo' in next) await releasePhoto(ctx, coffee.photo, next.photo)
  return { id, set: set as Restore['set'], unset }
}

/** The bag is used up: the coffee moves off the shelf. */
export const finish = mutation({
  args: { id: v.id('coffees') },
  handler: (ctx, { id }) => changeCoffee(ctx, id, { finished: true }),
})

/** Another bag of a finished coffee: back on the shelf, with whatever the new bag brings. */
export const restock = mutation({
  args: { id: v.id('coffees'), changes: v.optional(restockChanges) },
  handler: (ctx, { id, changes }) => changeCoffee(ctx, id, { ...changes, finished: false }),
})

/** Undo for Finish and Restock: puts back what they returned. */
export const restore = mutation({
  args: { id: v.id('coffees'), set: restoreSet, unset: v.array(clearable) },
  handler: async (ctx, { id, set, unset }) => {
    const subject = await requireSubject(ctx)
    const coffee = await ownCoffee(ctx, subject, id)
    checkRating(set.rating)
    await assertPhotoUsable(ctx, subject, set.photo)
    const cleared = Object.fromEntries(unset.map((key) => [key, undefined]))
    await ctx.db.patch(id, { ...set, ...cleared })
    if ('photo' in set || unset.includes('photo')) await releasePhoto(ctx, coffee.photo, set.photo)
  },
})
