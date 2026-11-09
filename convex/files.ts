import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, mutation } from './_generated/server'
import { requireSubject } from './lib/auth'

/** A one-time URL the app posts a compressed bag photo to; it answers with the storage id. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSubject(ctx)
    return ctx.storage.generateUploadUrl()
  },
})

/** How long a file no coffee holds is kept: covers Undo, and a form left open mid-save. */
export const SWEEP_MARGIN_MS = 24 * 60 * 60 * 1000

/**
 * The daily sweep (`crons.ts`): deletes stored files no coffee holds, once
 * they are older than the margin and no coffee let go of them within it.
 * Finish, Restock and edits never delete a replaced photo, so Undo works.
 */
export const sweep = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const cutoff = Date.now() - SWEEP_MARGIN_MS
    const page = await ctx.db.system
      .query('_storage')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff))
      .paginate({ numItems: 100, cursor: cursor ?? null })
    for (const file of page.page) {
      const held = await ctx.db
        .query('coffees')
        .withIndex('by_photo', (q) => q.eq('photo', file._id))
        .first()
      const releases = await ctx.db
        .query('releasedPhotos')
        .withIndex('by_storage', (q) => q.eq('storageId', file._id))
        .collect()
      if (releases.some((r) => r.releasedAt >= cutoff)) continue
      for (const r of releases) await ctx.db.delete(r._id)
      if (!held) await ctx.storage.delete(file._id)
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.files.sweep, { cursor: page.continueCursor })
  },
})
