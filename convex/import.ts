import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { checkRating, readOwnCoffee } from './coffees'
import { requireSubject } from './lib/auth'
import { brewFields, coffeeDetails } from './lib/fields'
import { assertPhotoUsable } from './lib/photos'

// Внеси от Dial In (and from Кафето's own file). The browser parses the file
// and uploads the photos; these write the rows. Every row carries the id it
// had in the file as `legacyId`, so a second run of the same file, or a later
// file holding the same rows, adds nothing.
//
// A file id matches one of your rows by its `legacyId` or, for a row made in
// Кафето (exported with its own `_id`), by that `_id`.

/** Your coffee the file id `key` stands for, if you have it already. */
async function findCoffee(ctx: QueryCtx, subject: string, key: string): Promise<Doc<'coffees'> | null> {
  const byLegacy = await ctx.db
    .query('coffees')
    .withIndex('by_owner_legacyId', (q) => q.eq('ownerSubject', subject).eq('legacyId', key))
    .first()
  return byLegacy ?? readOwnCoffee(ctx, subject, key)
}

/** Your brew the file id `key` stands for, if you have it already. */
async function findBrew(ctx: QueryCtx, subject: string, key: string): Promise<Doc<'brews'> | null> {
  const byLegacy = await ctx.db
    .query('brews')
    .withIndex('by_owner_legacyId', (q) => q.eq('ownerSubject', subject).eq('legacyId', key))
    .first()
  if (byLegacy) return byLegacy
  const id = ctx.db.normalizeId('brews', key)
  const brew = id && (await ctx.db.get(id))
  return brew && brew.ownerSubject === subject ? brew : null
}

/**
 * What you have already, every row old or new: file id to `_id` for coffees
 * (so brews in a later file attach to coffees an earlier one brought), and
 * the file ids of brews. The browser skips these before uploading a photo.
 */
export const existing = query({
  args: {},
  handler: async (ctx) => {
    const subject = await requireSubject(ctx)
    const coffees = await ctx.db
      .query('coffees')
      .withIndex('by_owner', (q) => q.eq('ownerSubject', subject))
      .collect()
    const brews = await ctx.db
      .query('brews')
      .withIndex('by_owner', (q) => q.eq('ownerSubject', subject))
      .collect()
    const keys = (row: { _id: string; legacyId?: string }) => (row.legacyId ? [row.legacyId, row._id] : [row._id])
    return {
      coffees: coffees.flatMap((c) => keys(c).map((key) => [key, c._id] as [string, Id<'coffees'>])),
      brews: brews.flatMap(keys),
    }
  },
})

const importedCoffee = v.object({
  legacyId: v.string(),
  ...coffeeDetails,
  finished: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

/**
 * A batch of coffees (about 50). One you have already is skipped, and a photo
 * uploaded for it is deleted again. Returns every file id in the batch with
 * the `_id` it now has, and how many were added.
 */
export const coffees = mutation({
  args: { coffees: v.array(importedCoffee) },
  handler: async (ctx, args) => {
    const subject = await requireSubject(ctx)
    const ids: [string, Id<'coffees'>][] = []
    let added = 0
    for (const { legacyId, ...coffee } of args.coffees) {
      const found = await findCoffee(ctx, subject, legacyId)
      if (found) {
        ids.push([legacyId, found._id])
        if (coffee.photo && coffee.photo !== found.photo) await deleteFreshUpload(ctx, coffee.photo)
        continue
      }
      checkRating(coffee.rating)
      await assertPhotoUsable(ctx, subject, coffee.photo)
      ids.push([legacyId, await ctx.db.insert('coffees', { ...coffee, ownerSubject: subject, legacyId })])
      added++
    }
    return { ids, added }
  },
})

/** Deletes a file no coffee holds: a photo the browser uploaded for a coffee that turned out to exist. */
async function deleteFreshUpload(ctx: MutationCtx, photo: Id<'_storage'>) {
  const holder = await ctx.db
    .query('coffees')
    .withIndex('by_photo', (q) => q.eq('photo', photo))
    .first()
  if (!holder && (await ctx.db.system.get(photo))) await ctx.storage.delete(photo)
}

/**
 * A batch of brews (about 200), `coffeeId` already mapped to yours. Skips a
 * brew you have already and one whose coffee isn't yours. Returns how many
 * were added.
 */
export const brews = mutation({
  args: {
    brews: v.array(
      v.object({ legacyId: v.string(), coffeeId: v.string(), ...brewFields, grinder: v.optional(v.string()), createdAt: v.number() }),
    ),
  },
  handler: async (ctx, args) => {
    const subject = await requireSubject(ctx)
    let added = 0
    for (const { legacyId, coffeeId, ...brew } of args.brews) {
      if (await findBrew(ctx, subject, legacyId)) continue
      const coffee = await readOwnCoffee(ctx, subject, coffeeId)
      if (!coffee) continue
      await ctx.db.insert('brews', { ...brew, ownerSubject: subject, coffeeId: coffee._id, legacyId })
      added++
    }
    return { added }
  },
})

/** The file's grinder and Opus settings, each only where yours is unset. */
export const equipment = mutation({
  args: { grinder: v.optional(v.string()), opusInner: v.optional(v.number()), opusDial: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const subject = await requireSubject(ctx)
    const { opusInner, opusDial } = args
    const grinder = args.grinder?.trim() || undefined
    if (opusInner !== undefined && !(Number.isInteger(opusInner) && Math.abs(opusInner) <= 6)) {
      throw new ConvexError({ code: 'badOpusInner' })
    }
    const row = await ctx.db
      .query('equipment')
      .withIndex('by_owner', (q) => q.eq('ownerSubject', subject))
      .unique()
    const fill = {
      ...(grinder && !row?.grinder ? { grinder } : {}),
      ...(opusInner !== undefined && row?.opusInner === undefined ? { opusInner } : {}),
      ...(opusDial !== undefined && row?.opusDial === undefined ? { opusDial } : {}),
    }
    if (Object.keys(fill).length === 0) return
    if (row) await ctx.db.patch(row._id, fill)
    else await ctx.db.insert('equipment', { ownerSubject: subject, ...fill })
  },
})
