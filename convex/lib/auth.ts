import type { Auth } from 'convex/server'
import { ConvexError } from 'convex/values'

/**
 * The Clerk `subject` of whoever is signed in. Every query and mutation reads
 * its rows through this one helper, and keys them by what it returns.
 *
 * When `CLERK_AUTHORIZED_PARTIES` is set (comma separated origins, production
 * only: `https://kafeto.onovaza.com`), a token must carry an `azp` from that
 * list. It binds the token to Кафето's origin, so a script on another онова за
 * subdomain can't use the shared session against this deployment
 * (HayGrouve/onova-za#24). Unset on dev, so localhost and previews pass.
 */
export async function requireSubject(ctx: { auth: Auth }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError({ code: 'signedOut' })

  const parties = authorizedParties()
  if (parties) {
    const azp = typeof identity.azp === 'string' ? identity.azp : undefined
    if (!azp || !parties.includes(azp)) {
      throw new ConvexError({ code: 'unauthorizedParty' })
    }
  }

  return identity.subject
}

function authorizedParties(): string[] | undefined {
  const list = (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  return list.length > 0 ? list : undefined
}
