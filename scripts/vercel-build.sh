#!/bin/sh
# Vercel's build command (vercel.json).
#
# - Production (the `main` branch after the cutover merge): `convex deploy`
#   typechecks and pushes the functions and schema to Convex prod with
#   CONVEX_DEPLOY_KEY (set in Vercel Production only), then runs `pnpm build`
#   with VITE_CONVEX_URL pointing at prod.
# - Everything else (`kafeto` and feature branch previews): the app only.
#   Previews talk to the dev deployment from the Preview env; the functions
#   get there from `npx convex dev --once`, run by hand, never from a build.
#
# `set -eu`: a failed push or build fails the Vercel build.
set -eu

if [ "${VERCEL_ENV:-}" = "production" ]; then
  npx convex deploy --cmd 'pnpm build'
else
  pnpm build
fi
