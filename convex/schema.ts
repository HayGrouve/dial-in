import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Every row belongs to one person, keyed by the Clerk `subject` that
// `requireSubject` returns. Rows brought over from Dial In keep its UUID in
// `legacyId`, so running the import twice adds nothing.

/** Must match `BrewMethod` in `src/lib/db.ts`. */
export const brewMethod = v.union(
  v.literal('espresso'),
  v.literal('turbo'),
  v.literal('pourover'),
  v.literal('aeropress'),
  v.literal('frenchpress'),
  v.literal('moka'),
  v.literal('coldbrew'),
  v.literal('other'),
)

/** Must match `Taste` in `src/lib/db.ts`. */
export const taste = v.union(v.literal('sour'), v.literal('balanced'), v.literal('bitter'))

export default defineSchema({
  coffees: defineTable({
    ownerSubject: v.string(),
    legacyId: v.optional(v.string()),
    name: v.string(),
    roaster: v.string(),
    origin: v.optional(v.string()),
    region: v.optional(v.string()),
    producer: v.optional(v.string()),
    varietal: v.optional(v.string()),
    process: v.optional(v.string()),
    altitude: v.optional(v.string()),
    /** The stored English key ('Light', ...); the label is translated on display. */
    roastLevel: v.optional(v.string()),
    tastingNotes: v.array(v.string()),
    /** Grams. */
    bagWeight: v.optional(v.number()),
    notes: v.optional(v.string()),
    /** 1 to 5 stars for the coffee itself. */
    rating: v.optional(v.number()),
    /** The front of the bag, in file storage. */
    photo: v.optional(v.id('_storage')),
    finished: v.boolean(),
    /** Milliseconds, kept from the Dial In file on import, not `_creationTime`. */
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_updatedAt', ['ownerSubject', 'updatedAt'])
    .index('by_owner_legacyId', ['ownerSubject', 'legacyId']),

  brews: defineTable({
    ownerSubject: v.string(),
    coffeeId: v.id('coffees'),
    legacyId: v.optional(v.string()),
    method: brewMethod,
    /** Stamped from the grinder in `equipment` when the brew is saved. */
    grinder: v.optional(v.string()),
    grindSetting: v.string(),
    dose: v.optional(v.number()),
    /** Espresso and turbo: beverage weight out. Other methods: water in. */
    yield: v.optional(v.number()),
    timeSec: v.optional(v.number()),
    preinfusion: v.boolean(),
    preinfusionSec: v.optional(v.number()),
    temperature: v.optional(v.number()),
    bloomSec: v.optional(v.number()),
    taste: v.optional(taste),
    notes: v.optional(v.string()),
    /** The setting to return to for this coffee and method. */
    dialedIn: v.boolean(),
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

  /** Svix ids of Clerk webhooks already handled, so a retry runs nothing twice. */
  processedWebhookEvents: defineTable({
    svixId: v.string(),
  }).index('by_svix', ['svixId']),
})
