> **This is the `kafeto` branch: Онова за кафето in progress.** It moves Dial In onto the shared онова за Акаунт, with the log in Convex ([#27](https://github.com/HayGrouve/dial-in/issues/27)). `main` stays the live Dial In on dial-in-three.vercel.app until the single cutover merge. Every Кафето PR targets `kafeto`, never `main`.

# Онова за кафето

A grind-size journal for specialty coffee, formerly Dial In. Snap the bag, log your brews, pin the setting that tastes right. When you buy that coffee again months later, the number is waiting. Home Screen name: **Кафето**. The UI is Bulgarian, in informal "ти"; the words it uses are in [GLOSSARY.md](GLOSSARY.md).

## Features

- **Снимай етикета** (label reading): photograph the front and back of the bag and the details fill themselves in (name, roaster, origin, process, varietal, altitude, roast level, tasting notes, bag size). Gemini reads the label with the key you paste in Настройки → Четене на етикета; origin, process and tasting notes come back in Bulgarian. Only empty fields are filled. The key stays on the device, belongs to whoever pasted it, and Изход or Изтрий данните removes it.
- **Кафе** (coffee): photo (camera or library, compressed in the browser, kept in Convex file storage), roaster, origin, region, producer, varietal, process, altitude, roast level, bag size, tasting notes, and 1 to 5 stars for the coffee.
- **Варене per метод** (brews per method): еспресо, турбо, филтър, AeroPress, френска преса, мока, студено извличане, друго. Турбо sits between espresso and filter: a coarser, faster shot at around 1:3 in 10 to 15 s. Fields adapt to the method (напитка or вода, преинфузия for еспресо и турбо, цъфтеж for filter).
- **Мелачка** set once in Настройки → Уреди and stamped on every brew; any notation (`14`, `2.5`, `1.5.2`, `24 щраквания`). Grinder, Opus switch and inner ring live in your Акаунт, so every device has them.
- **Колело за Fellow Opus** (optional): a grind wheel on the brew form that works out the outer and inner ring, including the in-between sizes the inner ring unlocks. For the original Opus, not Opus 2.
- **Настройка** (setting): pin one brew per coffee and method with "Това е то"; it shows big on the coffee page and on the Рафт. Taste (кисело, балансирано, горчиво) suggests which way to move the grind.
- New brews start from your last try on that coffee, or from your last coffee on that method.
- **Рафт**, **Свършени** and search. **Купих го пак** puts a свършено coffee back on the Рафт; New coffee offers it back instead of adding a duplicate.
- **Данни** in Настройки: **Изнеси** (one file with everything, photos included), **Внеси от Dial In** (Dial In and Кафето files; anything already here is skipped), **Изтрий данните** (you stay signed in).
- Signed in with the shared онова за Акаунт (Clerk); online only, with a "Няма връзка" banner when Convex loses its connection. Light, dark or system theme.

## Develop

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # dash check, typecheck and production build to dist/
pnpm typecheck  # app and convex/
pnpm lint
pnpm test       # Convex function tests (convex-test), import, copy checks
npx convex dev --once  # push convex/ to the dev deployment (onova-za-kafeto, EU)
```

`.env.local` (git-ignored) holds `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL` and the dev `VITE_CLERK_PUBLISHABLE_KEY` of the "онова за" Clerk app. On Vercel, `scripts/vercel-build.sh` deploys Convex only for Production; previews build the app against the dev deployment.

Copy rules: Bulgarian, "ти", no em or en dashes anywhere in `src/` (`pnpm build` and `src/dashes.test.ts` fail on one; write ranges as "25 до 30 с"). Count forms go through `src/lib/count.ts`, roast levels keep their stored English keys and show through `roastLabel`.

## Deploy

Vercel project `dial-in`, production from `main` after the cutover ([#35](https://github.com/HayGrouve/dial-in/issues/35)). Production env: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_SIGN_IN_URL`, `VITE_CLERK_SIGN_UP_URL`, `VITE_CONVEX_URL` and `CONVEX_DEPLOY_KEY`; Convex prod: `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_AUTHORIZED_PARTIES`, `CLERK_WEBHOOK_SIGNING_SECRET` (Clerk's `user.deleted` webhook goes to `/clerk/webhook`).

## Stack

Vite · React 19 · TypeScript · Tailwind CSS 4 · Convex (log, bag photos, webhook) · Clerk · wouter · Gemini API (label reading, your own key)
