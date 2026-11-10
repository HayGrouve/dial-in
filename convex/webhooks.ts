import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { startErase } from './erase'

/**
 * A verified `user.deleted` from Clerk: notes the Svix id once and erases
 * that person's data the way Изтрий данните does. Returns false for a
 * repeated delivery, which runs nothing.
 */
export const recordUserDeleted = internalMutation({
  args: { svixId: v.string(), subject: v.string() },
  handler: async (ctx, { svixId, subject }) => {
    const seen = await ctx.db
      .query('processedWebhookEvents')
      .withIndex('by_svix', (q) => q.eq('svixId', svixId))
      .first()
    if (seen) return false
    await ctx.db.insert('processedWebhookEvents', { svixId })
    await startErase(ctx, subject)
    return true
  },
})
