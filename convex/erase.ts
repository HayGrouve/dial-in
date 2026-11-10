import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, mutation, type MutationCtx } from './_generated/server'
import { requireSubject } from './lib/auth'
import { deletePhotoIfUnheld } from './lib/photos'

// Изтрий данните, and `user.deleted` from Clerk: everything Кафето holds about
// one `subject` goes. There is no users table, so the erase works by
// `ownerSubject`, in scheduled batches that stay inside a mutation's limits.
// Only rows created before it started are erased: you stay signed in and can
// start again at once, and what you add meanwhile is kept.

/** Coffees per step; each takes its brews and photo with it. */
const COFFEES_PER_STEP = 25
/** Leftover brews or released photos per step. */
const ROWS_PER_STEP = 500

/** Deletes the equipment row now and schedules the rest. */
export async function startErase(ctx: MutationCtx, subject: string) {
  const equipment = await ctx.db
    .query('equipment')
    .withIndex('by_owner', (q) => q.eq('ownerSubject', subject))
    .collect()
  for (const row of equipment) await ctx.db.delete(row._id)
  await ctx.scheduler.runAfter(0, internal.erase.step, { subject, before: Date.now() })
}

/** Изтрий данните: the signed-in person wipes their log. No undo. */
export const deleteMyData = mutation({
  args: {},
  handler: async (ctx) => {
    await startErase(ctx, await requireSubject(ctx))
  },
})

/**
 * One batch: coffees with their brews and photo files first, then brews left
 * without a coffee, then photos a coffee let go of. Reschedules itself until
 * nothing created before `before` is left.
 */
export const step = internalMutation({
  args: { subject: v.string(), before: v.number() },
  handler: async (ctx, args) => {
    const { subject, before } = args
    const again = () => ctx.scheduler.runAfter(0, internal.erase.step, args)

    const coffees = await ctx.db
      .query('coffees')
      .withIndex('by_owner', (q) => q.eq('ownerSubject', subject).lte('_creationTime', before))
      .take(COFFEES_PER_STEP)
    for (const coffee of coffees) {
      const brews = await ctx.db
        .query('brews')
        .withIndex('by_coffee_method', (q) => q.eq('coffeeId', coffee._id))
        .collect()
      for (const brew of brews) await ctx.db.delete(brew._id)
      await ctx.db.delete(coffee._id)
      await deletePhotoIfUnheld(ctx, coffee.photo)
    }
    if (coffees.length > 0) return void (await again())

    const brews = await ctx.db
      .query('brews')
      .withIndex('by_owner', (q) => q.eq('ownerSubject', subject).lte('_creationTime', before))
      .take(ROWS_PER_STEP)
    for (const brew of brews) await ctx.db.delete(brew._id)
    if (brews.length > 0) return void (await again())

    const released = await ctx.db
      .query('releasedPhotos')
      .withIndex('by_owner', (q) => q.eq('ownerSubject', subject).lte('_creationTime', before))
      .take(ROWS_PER_STEP)
    for (const row of released) {
      // An earlier row for the same file may have taken this one with it.
      if (!(await ctx.db.get(row._id))) continue
      await ctx.db.delete(row._id)
      await deletePhotoIfUnheld(ctx, row.storageId)
    }
    if (released.length > 0) await again()
  },
})
