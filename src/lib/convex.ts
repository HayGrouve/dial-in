import { ConvexReactClient } from 'convex/react'

/** The one Convex client; outside React too, so the toast's Finish and Undo can call it. */
export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
