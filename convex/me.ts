import { query } from './_generated/server'
import { requireSubject } from './lib/auth'

/**
 * Who Convex thinks is signed in. Proves the Clerk token reaches Convex
 * (#29) while the coffee log still lives in Dexie; #31 brings the real reads.
 */
export const subject = query({
  args: {},
  handler: (ctx) => requireSubject(ctx),
})
