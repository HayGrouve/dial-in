import { v, type Infer } from 'convex/values'

// The fields a person writes, shared by the schema, the mutations' args and the
// app's forms, so the three can't drift apart.

/** `BrewMethod` in `src/lib/db.ts` is derived from this. */
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

export const taste = v.union(v.literal('sour'), v.literal('balanced'), v.literal('bitter'))

/** What New coffee and Edit coffee hold; everything but the owner, ids, `finished` and times. */
export const coffeeDetails = {
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
}

const coffeeDetailsObject = v.object(coffeeDetails)
export type CoffeeDetails = Infer<typeof coffeeDetailsObject>

/** What the brew form holds; the grinder is stamped from `equipment`, not sent. */
export const brewFields = {
  method: brewMethod,
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
}

const brewFieldsObject = v.object(brewFields)
export type BrewFields = Infer<typeof brewFieldsObject>
