import type { Doc } from '../../convex/_generated/dataModel'
import { brewFields, coffeeDetails, type BrewFields, type CoffeeDetails } from '../../convex/lib/fields'

// The log lives in Convex (`convex/coffees.ts`, `convex/brews.ts`); these are
// its shapes as the app reads them, and the picklists the forms offer.

export type { BrewFields, CoffeeDetails }

/** Roast levels as stored: English keys, kept from Dial In. Shown through `roastLabel`. */
export const ROAST_LEVELS = ['Light', 'Medium-light', 'Medium', 'Medium-dark', 'Dark'] as const
export type RoastLevel = (typeof ROAST_LEVELS)[number]

const ROAST_LABELS: Record<RoastLevel, string> = {
  Light: 'Светло',
  'Medium-light': 'Средно светло',
  Medium: 'Средно',
  'Medium-dark': 'Средно тъмно',
  Dark: 'Тъмно',
}

/** The Bulgarian label for a stored roast level; anything else shows as it was typed. */
export const roastLabel = (level: string) => (level in ROAST_LABELS ? ROAST_LABELS[level as RoastLevel] : level)

/**
 * Suggestions for the free-text process field. Older coffees keep whatever
 * was typed, English included.
 */
export const PROCESSES = ['Измита', 'Натурална', 'Хъни', 'Анаеробна', 'Карбонова мацерация', 'Мокро белена', 'Експериментална'] as const

/** A coffee as `coffees.listMine` and `coffees.get` return it, with a URL for the bag photo. */
export type Coffee = Doc<'coffees'> & { photoUrl?: string }
export type Brew = Doc<'brews'>
export type BrewMethod = Brew['method']
export type Taste = NonNullable<Brew['taste']>

const pick = (keys: object, row: object) =>
  Object.fromEntries(Object.keys(keys).flatMap((k) => (k in row ? [[k, (row as Record<string, unknown>)[k]]] : [])))

/** The fields Edit coffee holds, without ids, owner, times or the photo URL. */
export const detailsOf = (coffee: Coffee) => pick(coffeeDetails, coffee) as CoffeeDetails

/** The fields the brew form holds, without ids, owner, grinder or time. */
export const brewFieldsOf = (brew: Brew) => pick(brewFields, brew) as BrewFields
