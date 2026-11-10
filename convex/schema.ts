import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { brewFields, coffeeDetails } from './lib/fields'

// Every row belongs to one person, keyed by the Clerk `subject` that
// `requireSubject` returns. Rows brought over from Dial In keep its UUID in
// `legacyId`, so running the import twice adds nothing.

export default defineSchema({
  coffees: defineTable({
    ownerSubject: v.string(),
    legacyId: v.optional(v.string()),
    ...coffeeDetails,
    finished: v.boolean(),
    /** Milliseconds, kept from the Dial In file on import, not `_creationTime`. */
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_updatedAt', ['ownerSubject', 'updatedAt'])
    .index('by_owner_legacyId', ['ownerSubject', 'legacyId'])
    /** Which coffee holds a file: the photo sweep and the check that a photo is yours. */
    .index('by_photo', ['photo']),

  brews: defineTable({
    ownerSubject: v.string(),
    coffeeId: v.id('coffees'),
    legacyId: v.optional(v.string()),
    ...brewFields,
    /** Stamped from the grinder in `equipment` when the brew is saved. */
    grinder: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_owner_createdAt', ['ownerSubject', 'createdAt'])
    .index('by_owner_method_createdAt', ['ownerSubject', 'method', 'createdAt'])
    .index('by_coffee_method', ['coffeeId', 'method'])
    .index('by_owner_legacyId', ['ownerSubject', 'legacyId']),

  /** One row per person: what used to be three localStorage keys. */
  equipment: defineTable({
    ownerSubject: v.string(),
    grinder: v.optional(v.string()),
    /** Where the Fellow Opus inner ring sits, -6 to +6. */
    opusInner: v.optional(v.number()),
    /** The Opus helper is on. */
    opusDial: v.optional(v.boolean()),
  }).index('by_owner', ['ownerSubject']),

  /**
   * When a coffee let go of a photo (a restock or an edit replaced it). The
   * daily sweep keeps the file for a margin after this, so Undo can put it back.
   */
  releasedPhotos: defineTable({
    storageId: v.id('_storage'),
    releasedAt: v.number(),
  }).index('by_storage', ['storageId']),

  /** Svix ids of Clerk webhooks already handled, so a retry runs nothing twice. */
  processedWebhookEvents: defineTable({
    svixId: v.string(),
  }).index('by_svix', ['svixId']),
})
