import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireSubject } from './lib/auth'

/** Your grinder and Opus settings, with the defaults for a person who has set none. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const subject = await requireSubject(ctx)
    const row = await ctx.db
      .query('equipment')
      .withIndex('by_owner', (q) => q.eq('ownerSubject', subject))
      .unique()
    return { grinder: row?.grinder ?? '', opusInner: row?.opusInner ?? 0, opusDial: row?.opusDial ?? false }
  },
})

/** Changes the fields given and leaves the rest. An empty grinder clears it. */
export const set = mutation({
  args: { grinder: v.optional(v.string()), opusInner: v.optional(v.number()), opusDial: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const subject = await requireSubject(ctx)
    const { opusInner, opusDial } = args
    if (opusInner !== undefined && !(Number.isInteger(opusInner) && Math.abs(opusInner) <= 6)) {
      throw new ConvexError({ code: 'badOpusInner' })
    }
    const changes = {
      ...('grinder' in args ? { grinder: args.grinder?.trim() || undefined } : {}),
      ...(opusInner !== undefined ? { opusInner } : {}),
      ...(opusDial !== undefined ? { opusDial } : {}),
    }
    const row = await ctx.db
      .query('equipment')
      .withIndex('by_owner', (q) => q.eq('ownerSubject', subject))
      .unique()
    if (row) await ctx.db.patch(row._id, changes)
    else await ctx.db.insert('equipment', { ownerSubject: subject, ...changes })
  },
})
