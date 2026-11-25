import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { readOwnCoffee } from './coffees'
import { requireSubject } from './lib/auth'
import { brewFields, brewMethod } from './lib/fields'

/** Your brew with this id, or null: unknown, malformed and someone else's all read the same. */
async function readOwnBrew(ctx: QueryCtx, subject: string, id: string) {
  const brewId = ctx.db.normalizeId('brews', id)
  const brew = brewId && (await ctx.db.get(brewId))
  return brew && brew.ownerSubject === subject ? brew : null
}

async function ownBrew(ctx: MutationCtx, subject: string, id: Id<'brews'>) {
  const brew = await readOwnBrew(ctx, subject, id)
  if (!brew) throw new ConvexError({ code: 'notFound' })
  return brew
}

/** Newest first; brews logged in the same millisecond keep the order they were saved in, as indexes do. */
const newestFirst = (a: Doc<'brews'>, b: Doc<'brews'>) => b.createdAt - a.createdAt || b._creationTime - a._creationTime

/** A coffee's brews, newest first. */
async function brewsOf(ctx: QueryCtx, subject: string, coffeeId: Id<'coffees'>) {
  const brews = await ctx.db
    .query('brews')
    .withIndex('by_coffee_method', (q) => q.eq('coffeeId', coffeeId))
    .collect()
  return brews.filter((b) => b.ownerSubject === subject).sort(newestFirst)
}

/**
 * Marks one brew as the setting to return to, clearing the others for the same
 * coffee and method, and moves the coffee to the front of the shelf.
 */
async function applyDialedIn(ctx: MutationCtx, brew: Doc<'brews'>, value: boolean) {
  if (value) {
    const same = await ctx.db
      .query('brews')
      .withIndex('by_coffee_method', (q) => q.eq('coffeeId', brew.coffeeId).eq('method', brew.method))
      .collect()
    for (const other of same) {
      if (other._id !== brew._id && other.dialedIn) await ctx.db.patch(other._id, { dialedIn: false })
    }
  }
  await ctx.db.patch(brew._id, { dialedIn: value })
  await ctx.db.patch(brew.coffeeId, { updatedAt: Date.now() })
}

/** Every brew of yours, newest first, for the shelf. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const subject = await requireSubject(ctx)
    return ctx.db
      .query('brews')
      .withIndex('by_owner_createdAt', (q) => q.eq('ownerSubject', subject))
      .order('desc')
      .collect()
  },
})

/** A coffee's brews, newest first; empty for a coffee that isn't yours. */
export const byCoffee = query({
  args: { coffeeId: v.string() },
  handler: async (ctx, { coffeeId }) => {
    const subject = await requireSubject(ctx)
    const coffee = await readOwnCoffee(ctx, subject, coffeeId)
    return coffee ? brewsOf(ctx, subject, coffee._id) : []
  },
})

/** The brews of several coffees, newest first: the Welcome back sheet's matches. */
export const byCoffees = query({
  args: { coffeeIds: v.array(v.string()) },
  handler: async (ctx, { coffeeIds }) => {
    const subject = await requireSubject(ctx)
    const all: Doc<'brews'>[] = []
    for (const id of new Set(coffeeIds)) {
      const coffee = await readOwnCoffee(ctx, subject, id)
      if (coffee) all.push(...(await brewsOf(ctx, subject, coffee._id)))
    }
    return all.sort(newestFirst)
  },
})

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => readOwnBrew(ctx, await requireSubject(ctx), id),
})

/**
 * What a new brew starts from. Without a method: the method last brewed on
 * this coffee, else the last brewed anywhere, else espresso. Then the last
 * brew of that method on this coffee (`same`) and on any coffee (`other`).
 * Null for a coffee that isn't yours.
 */
export const prefill = query({
  args: { coffeeId: v.string(), method: v.optional(brewMethod) },
  handler: async (ctx, args) => {
    const subject = await requireSubject(ctx)
    const coffee = await readOwnCoffee(ctx, subject, args.coffeeId)
    if (!coffee) return null
    let method = args.method
    if (!method) {
      const [lastHere] = await brewsOf(ctx, subject, coffee._id)
      const lastAny =
        lastHere ??
        (await ctx.db
          .query('brews')
          .withIndex('by_owner_createdAt', (q) => q.eq('ownerSubject', subject))
          .order('desc')
          .first())
      method = lastAny?.method ?? 'espresso'
    }
    const sameMethod = await ctx.db
      .query('brews')
      .withIndex('by_coffee_method', (q) => q.eq('coffeeId', coffee._id).eq('method', method))
      .collect()
    const same = sameMethod.filter((b) => b.ownerSubject === subject).sort(newestFirst)[0] ?? null
    const other = await ctx.db
      .query('brews')
      .withIndex('by_owner_method_createdAt', (q) => q.eq('ownerSubject', subject).eq('method', method))
      .order('desc')
      .first()
    return { method, same, other }
  },
})

/**
 * Log a brew (no `id`) or edit one. A new brew is stamped with your grinder
 * from `equipment`; an edited one keeps the grinder it was logged on.
 */
export const save = mutation({
  args: { id: v.optional(v.id('brews')), coffeeId: v.id('coffees'), ...brewFields },
  handler: async (ctx, { id, coffeeId, ...fields }) => {
    const subject = await requireSubject(ctx)
    let brewId: Id<'brews'>
    if (id) {
      const brew = await ownBrew(ctx, subject, id)
      const { ownerSubject, legacyId, grinder, createdAt } = brew
      await ctx.db.replace(id, { ownerSubject, coffeeId: brew.coffeeId, legacyId, grinder, createdAt, ...fields })
      brewId = id
    } else {
      const coffee = await readOwnCoffee(ctx, subject, coffeeId)
      if (!coffee) throw new ConvexError({ code: 'notFound' })
      const equipment = await ctx.db
        .query('equipment')
        .withIndex('by_owner', (q) => q.eq('ownerSubject', subject))
        .unique()
      brewId = await ctx.db.insert('brews', {
        ...fields,
        ownerSubject: subject,
        coffeeId: coffee._id,
        grinder: equipment?.grinder || undefined,
        createdAt: Date.now(),
      })
    }
    await applyDialedIn(ctx, (await ctx.db.get(brewId))!, fields.dialedIn)
    return brewId
  },
})

export const remove = mutation({
  args: { id: v.id('brews') },
  handler: async (ctx, { id }) => {
    const subject = await requireSubject(ctx)
    await ownBrew(ctx, subject, id)
    await ctx.db.delete(id)
  },
})

/** Pin or unpin a brew as the setting for its coffee and method. */
export const setDialedIn = mutation({
  args: { id: v.id('brews'), value: v.boolean() },
  handler: async (ctx, { id, value }) => {
    const subject = await requireSubject(ctx)
    await applyDialedIn(ctx, await ownBrew(ctx, subject, id), value)
  },
})
