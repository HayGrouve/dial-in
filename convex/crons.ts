import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Replaced bag photos wait here instead of being deleted on the spot, so Undo
// on a restock can put the old one back.
crons.daily('sweep photos no coffee holds', { hourUTC: 3, minuteUTC: 30 }, internal.files.sweep, {})

export default crons
