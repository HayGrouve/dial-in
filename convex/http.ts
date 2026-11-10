import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { parseClerkEvent, verifyClerkWebhook } from './lib/clerkWebhook'

const http = httpRouter()

/**
 * Clerk webhooks (Svix), copied from Сметката. Someone who deletes their
 * Акаунт (`user.deleted`) has their coffee log erased by `erase.step`. Until
 * `CLERK_WEBHOOK_SIGNING_SECRET` is set the endpoint answers 503, so Clerk
 * retries instead of a delivery being lost or trusted unchecked.
 */
http.route({
  path: '/clerk/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
    if (!secret) {
      return new Response('Clerk webhooks are not configured', { status: 503 })
    }

    const payload = await request.text()
    const svixId = request.headers.get('svix-id')
    const verified = await verifyClerkWebhook({
      payload,
      headers: {
        id: svixId,
        timestamp: request.headers.get('svix-timestamp'),
        signature: request.headers.get('svix-signature'),
      },
      secret,
      nowMs: Date.now(),
    })
    if (!verified || !svixId) {
      return new Response('Invalid signature', { status: 400 })
    }

    const event = parseClerkEvent(payload)
    if (!event) return new Response('Malformed event', { status: 400 })

    if (event.type === 'user.deleted' && event.userId) {
      await ctx.runMutation(internal.webhooks.recordUserDeleted, { svixId, subject: event.userId })
    }
    return new Response(null, { status: 200 })
  }),
})

export default http
