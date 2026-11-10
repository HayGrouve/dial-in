import { query } from './_generated/server'
import { requireSubject } from './lib/auth'

/** Settings' count line; at cutover the owner compares it with Dial In's. */
export const counts = query({
  args: {},
  handler: async (ctx) => {
    const subject = await requireSubject(ctx)
    const coffees = await ctx.db
      .query('coffees')
      .withIndex('by_owner_updatedAt', (q) => q.eq('ownerSubject', subject))
      .collect()
    const brews = await ctx.db
      .query('brews')
      .withIndex('by_owner_createdAt', (q) => q.eq('ownerSubject', subject))
      .collect()
    return { coffees: coffees.length, brews: brews.length }
  },
})
