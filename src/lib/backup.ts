// Import and export come back with #32 (Данни), reading from and writing to Convex.
// Until then this keeps the shape of a Dial In backup file, which that import reads.

/** A Dial In backup, as Settings → Export backup wrote it on `main`. */
export interface DialInBackupFile {
  app: 'dial-in'
  version: 1
  exportedAt: string
  /** Dial In coffees, keyed by UUID `id`; `photo` is a data URL. */
  coffees: (Record<string, unknown> & { id: string; photo?: string })[]
  /** Dial In brews; older files rate each brew. */
  brews: (Record<string, unknown> & { id: string; coffeeId: string; rating?: number })[]
  grinder?: string
}
