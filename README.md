# Dial In ☕

A grind-size journal for specialty coffee. Snap the bag, log your shots, pin the setting that tastes right. When you buy that coffee again months later, the number is waiting.

## Features

- **Coffee bags** — photo (camera or library, auto-compressed), roaster, origin, region, producer, varietal, process, altitude, roast level, bag size, tasting notes.
- **Brews per method** — espresso, pour over, AeroPress, French press, moka pot, cold brew. Fields adapt to the method (yield vs water, pre-infusion for espresso, bloom for filter).
- **Your grinder, set once** in Settings → Equipment and stamped on every brew. **Any notation** — `14`, `2.5`, `1.5.2` (rotation.number.click), `24 clicks`.
- **Dial-in log** — dose, yield, live brew ratio, time, temperature, taste (sour / balanced / bitter with a grind-finer/coarser hint), rating, notes.
- **"This is the one"** — pin one brew per method as the setting to remember; it shows big on the coffee page and as chips on the shelf.
- New brews prefill from your last attempt on that coffee, or from your last coffee on that method.
- Shelf / finished / all filters and search. "Bought it again" puts a finished bag back on the shelf.
- Offline PWA, installable on your phone. All data stays on-device (IndexedDB); export/import a JSON backup in Settings.
- Light, dark or follow-the-system theme (Settings → Appearance).
- Forms and pages are grouped into small sections; optional details fold away and show a one-line summary while closed.

## Develop

```sh
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # typecheck + production build to dist/
```

## Deploy to Vercel

The repo is ready for Vercel as-is — `vercel.json` sets the build, sends every route to the app (so deep links like `/coffee/…` survive a reload), and keeps the service worker uncached so updates roll out.

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repo, and deploy. No environment variables are needed.

Or from the terminal: `pnpm dlx vercel` (preview) and `pnpm dlx vercel --prod`.

Then open the URL on your phone and choose **Add to Home Screen**. It installs as an app, works offline, and the camera opens straight from the "Photo of the bag" button.

Your coffees are stored in the browser on each device, not on Vercel. Use **Settings → Export backup** to move them between devices.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS 4 · Dexie (IndexedDB) · wouter · vite-plugin-pwa
