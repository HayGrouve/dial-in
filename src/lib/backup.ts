import { bestBrewRatings, db, type Brew, type Coffee } from './db'
import { blobToDataUrl, dataUrlToBlob } from './image'
import { getGrinder, setGrinder } from './prefs'

interface BackupFile {
  app: 'dial-in'
  version: 1
  exportedAt: string
  coffees: (Omit<Coffee, 'photo'> & { photo?: string })[]
  brews: Brew[]
  grinder?: string
}

export async function exportBackup() {
  const coffees = await db.coffees.toArray()
  const data: BackupFile = {
    app: 'dial-in',
    version: 1,
    exportedAt: new Date().toISOString(),
    coffees: await Promise.all(
      coffees.map(async (c) => ({ ...c, photo: c.photo ? await blobToDataUrl(c.photo) : undefined })),
    ),
    brews: await db.brews.toArray(),
    grinder: getGrinder() || undefined,
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `dial-in-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Merges a backup into the local database; entries with matching ids are overwritten. */
export async function importBackup(file: File) {
  const data = JSON.parse(await file.text()) as BackupFile
  if (data.app !== 'dial-in') throw new Error('This is not a Dial In backup file.')
  // Older backups rated each brew; move those ratings onto the coffee.
  const best = bestBrewRatings(data.brews)
  const brews = data.brews.map((b: Brew & { rating?: number }) => {
    const copy = { ...b }
    delete copy.rating
    return copy as Brew
  })
  const coffees: Coffee[] = await Promise.all(
    data.coffees.map(async (c) => ({
      ...c,
      rating: c.rating ?? best.get(c.id),
      photo: c.photo ? await dataUrlToBlob(c.photo) : undefined,
    })),
  )
  await db.transaction('rw', db.coffees, db.brews, async () => {
    await db.coffees.bulkPut(coffees)
    await db.brews.bulkPut(brews)
  })
  if (data.grinder && !getGrinder()) setGrinder(data.grinder)
  return { coffees: coffees.length, brews: brews.length }
}
