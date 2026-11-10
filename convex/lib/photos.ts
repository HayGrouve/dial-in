import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/** A coffee as the app reads it: the row plus a URL for its photo. */
export async function withPhotoUrl(ctx: QueryCtx, coffee: Doc<'coffees'>) {
  const photoUrl = coffee.photo ? ((await ctx.storage.getUrl(coffee.photo)) ?? undefined) : undefined
  return { ...coffee, photoUrl }
}

/**
 * A photo may go on your coffee only if it is a stored file no one else's
 * coffee holds or recently let go of: a fresh upload, or one of your own
 * (Undo putting one back).
 */
export async function assertPhotoUsable(ctx: MutationCtx, subject: string, photo: Id<'_storage'> | undefined) {
  if (!photo) return
  if (!(await ctx.db.system.get(photo))) throw new ConvexError({ code: 'photoNotFound' })
  const holders = await ctx.db
    .query('coffees')
    .withIndex('by_photo', (q) => q.eq('photo', photo))
    .collect()
  if (holders.some((c) => c.ownerSubject !== subject)) throw new ConvexError({ code: 'photoNotFound' })
  if (await releasedByOther(ctx, subject, photo)) throw new ConvexError({ code: 'photoNotFound' })
}

/** Someone else's coffee let go of this file (it waits for their Undo or the sweep). */
export async function releasedByOther(ctx: QueryCtx, subject: string, photo: Id<'_storage'>) {
  const releases = await ctx.db
    .query('releasedPhotos')
    .withIndex('by_storage', (q) => q.eq('storageId', photo))
    .collect()
  return releases.some((r) => r.ownerSubject !== undefined && r.ownerSubject !== subject)
}

/**
 * The coffee's photo changes from `before` to `after`. The old file stays in
 * storage for the sweep (`files.sweep`), so Undo can put it back.
 */
export async function releasePhoto(
  ctx: MutationCtx,
  subject: string,
  before: Id<'_storage'> | undefined,
  after: Id<'_storage'> | undefined,
) {
  if (!before || before === after) return
  await ctx.db.insert('releasedPhotos', { storageId: before, releasedAt: Date.now(), ownerSubject: subject })
}

/** Deletes a file now, unless another coffee still holds it. */
export async function deletePhotoIfUnheld(ctx: MutationCtx, photo: Id<'_storage'> | undefined) {
  if (!photo) return
  const holder = await ctx.db
    .query('coffees')
    .withIndex('by_photo', (q) => q.eq('photo', photo))
    .first()
  if (holder) return
  const releases = await ctx.db
    .query('releasedPhotos')
    .withIndex('by_storage', (q) => q.eq('storageId', photo))
    .collect()
  for (const r of releases) await ctx.db.delete(r._id)
  if (await ctx.db.system.get(photo)) await ctx.storage.delete(photo)
}
