import { query } from './_generated/server'
import { requireSubject } from './lib/auth'
import { withPhotoUrl } from './lib/photos'

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

/**
 * Everything Изнеси writes to the file: your coffees with a URL for each
 * photo, your brews and your equipment. The browser turns the photos into
 * data URLs and gives each row its file id (`src/lib/backup.ts`).
 */
export const exportMine = query({
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
    const equipment = await ctx.db
      .query('equipment')
      .withIndex('by_owner', (q) => q.eq('ownerSubject', subject))
      .unique()
    return {
      coffees: await Promise.all(coffees.map((c) => withPhotoUrl(ctx, c))),
      brews,
      equipment: { grinder: equipment?.grinder, opusInner: equipment?.opusInner, opusDial: equipment?.opusDial },
    }
  },
})
