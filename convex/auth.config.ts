import type { AuthConfig } from 'convex/server'

// `customJwt` rather than Clerk's `domain` shorthand: under `domain` Convex's
// OIDC parser swallows `azp`, under `customJwt` it reaches `getUserIdentity()`
// as a custom claim, so `requireSubject` can check it (HayGrouve/onova-za#24).
// Read at push time, from the deployment's env:
// dev `https://<name>.clerk.accounts.dev`, prod `https://clerk.onovaza.com`.
const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN!

export default {
  providers: [
    {
      type: 'customJwt',
      issuer,
      jwks: `${issuer}/.well-known/jwks.json`,
      algorithm: 'RS256',
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig
