import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { brewFields, brewMethod, coffeeDetails, type BrewFields, type CoffeeDetails } from '../../convex/lib/fields'

// Данни: Изнеси writes one file with everything, Внеси от Dial In reads it
// back, or a Dial In backup. All the reading happens here in the browser; the
// server only writes rows (`convex/import.ts`).

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

/** A coffee in the file: its id, its details, the photo as a data URL. */
export type FileCoffee = Omit<CoffeeDetails, 'photo'> & {
  id: string
  photo?: string
  finished: boolean
  createdAt: number
  updatedAt: number
}

/** A brew in the file; `coffeeId` is its coffee's id in the same file. */
export type FileBrew = BrewFields & { id: string; coffeeId: string; grinder?: string; createdAt: number }

export interface FileEquipment {
  grinder?: string
  opusInner?: number
  opusDial?: boolean
}

/**
 * What Изнеси writes. Each row's `id` is the Dial In UUID it came from, or
 * its Convex `_id` if it was made here, so importing the file again (here or
 * into another Акаунт) adds nothing twice.
 */
export interface KafetoBackupFile {
  app: 'kafeto'
  version: 2
  exportedAt: string
  coffees: FileCoffee[]
  brews: FileBrew[]
  equipment: FileEquipment
}

/** A file the importer can't read; `message` is shown as it is. */
export class BackupError extends Error {}

export const NOT_A_BACKUP = 'Това не е файл от Dial In или от онова за кафето.'

/** Highest rating per coffee among brews from before ratings moved to the coffee (Dial In's v3). */
export function bestBrewRatings(brews: { coffeeId?: unknown; rating?: unknown }[]) {
  const best = new Map<string, number>()
  for (const b of brews) {
    if (typeof b.coffeeId === 'string' && isRating(b.rating) && b.rating > (best.get(b.coffeeId) ?? 0)) best.set(b.coffeeId, b.rating)
  }
  return best
}

// Reading a file: a Dial In file is whatever its version of the app stored,
// so every field is checked and anything unexpected is dropped, not trusted.

type Loose = Record<string, unknown>

const isObject = (x: unknown): x is Loose => !!x && typeof x === 'object' && !Array.isArray(x)
const text = (x: unknown) => (typeof x === 'string' && x.trim() ? x : undefined)
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const isRating = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5
const time = (x: unknown) => num(x) ?? (typeof x === 'string' && Number.isFinite(Date.parse(x)) ? Date.parse(x) : undefined)

const METHODS = new Set<string>(brewMethod.members.map((m) => m.value))
const TASTES = new Set(['sour', 'balanced', 'bitter'])

function readCoffee(c: Loose, bestRating: number | undefined, now: number): FileCoffee | undefined {
  const id = text(c.id)
  if (!id) return undefined
  const createdAt = time(c.createdAt) ?? now
  return {
    id,
    name: typeof c.name === 'string' ? c.name : '',
    roaster: typeof c.roaster === 'string' ? c.roaster : '',
    origin: text(c.origin),
    region: text(c.region),
    producer: text(c.producer),
    varietal: text(c.varietal),
    process: text(c.process),
    altitude: text(c.altitude),
    roastLevel: text(c.roastLevel),
    tastingNotes: Array.isArray(c.tastingNotes) ? c.tastingNotes.filter((t): t is string => typeof t === 'string' && !!t.trim()) : [],
    bagWeight: num(c.bagWeight),
    notes: text(c.notes),
    rating: isRating(c.rating) ? c.rating : bestRating,
    photo: typeof c.photo === 'string' && c.photo.startsWith('data:') ? c.photo : undefined,
    finished: c.finished === true,
    createdAt,
    updatedAt: time(c.updatedAt) ?? createdAt,
  }
}

function readBrew(b: Loose, now: number): FileBrew | undefined {
  const id = text(b.id)
  const coffeeId = text(b.coffeeId)
  if (!id || !coffeeId) return undefined
  const grind = typeof b.grindSetting === 'number' ? String(b.grindSetting) : b.grindSetting
  return {
    id,
    coffeeId,
    method: typeof b.method === 'string' && METHODS.has(b.method) ? (b.method as BrewFields['method']) : 'other',
    grindSetting: typeof grind === 'string' ? grind : '',
    dose: num(b.dose),
    yield: num(b.yield),
    timeSec: num(b.timeSec),
    preinfusion: b.preinfusion === true,
    preinfusionSec: num(b.preinfusionSec),
    temperature: num(b.temperature),
    bloomSec: num(b.bloomSec),
    taste: typeof b.taste === 'string' && TASTES.has(b.taste) ? (b.taste as BrewFields['taste']) : undefined,
    notes: text(b.notes),
    dialedIn: b.dialedIn === true,
    grinder: text(b.grinder),
    createdAt: time(b.createdAt) ?? now,
  }
}

/** The first row for each id: a file that repeats a row brings it once. */
function firstById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter((r) => !seen.has(r.id) && !!seen.add(r.id))
}

/** Reads a Dial In (v1) or Кафето (v2) file into clean rows; throws `BackupError` for anything else. */
export function parseBackup(json: string, now = Date.now()) {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new BackupError(NOT_A_BACKUP)
  }
  if (!isObject(data) || (data.app !== 'dial-in' && data.app !== 'kafeto')) throw new BackupError(NOT_A_BACKUP)
  const rawCoffees = Array.isArray(data.coffees) ? data.coffees.filter(isObject) : []
  const rawBrews = Array.isArray(data.brews) ? data.brews.filter(isObject) : []

  // Older Dial In files rated each brew; the best of those goes on the coffee.
  const best = bestBrewRatings(rawBrews)
  const coffees = firstById(rawCoffees.flatMap((c) => readCoffee(c, best.get(String(c.id)), now) ?? []))
  const brews = firstById(rawBrews.flatMap((b) => readBrew(b, now) ?? []))

  const eq = isObject(data.equipment) ? data.equipment : {}
  const equipment: FileEquipment = {
    grinder: text(data.grinder) ?? text(eq.grinder),
    opusInner: num(eq.opusInner),
    opusDial: typeof eq.opusDial === 'boolean' ? eq.opusDial : undefined,
  }
  return { app: data.app, coffees, brews, equipment }
}

/** A data URL as a Blob, for upload. */
export function dataUrlToBlob(url: string): Blob {
  const match = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,(.*)$/s.exec(url)
  if (!match) throw new Error('Not a data URL')
  const [, type, , base64, body] = match
  const bytes = base64 ? Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(body))
  return new Blob([bytes], { type: type || 'application/octet-stream' })
}

// Importing: what the browser does with the clean rows.

/** The calls the importer makes; `convexImportApi` in the app, convex-test in the tests. */
export interface ImportApi {
  existing(): Promise<FunctionReturnType<typeof api.import.existing>>
  uploadPhoto(photo: Blob): Promise<Id<'_storage'>>
  coffees(args: FunctionArgs<typeof api.import.coffees>): Promise<FunctionReturnType<typeof api.import.coffees>>
  brews(args: FunctionArgs<typeof api.import.brews>): Promise<FunctionReturnType<typeof api.import.brews>>
  equipment(args: FunctionArgs<typeof api.import.equipment>): Promise<unknown>
}

export type ImportProgress = { step: 'photos' | 'brews'; done: number; total: number }

export const COFFEE_BATCH = 50
export const BREW_BATCH = 200

const COFFEE_KEYS = Object.keys(coffeeDetails).filter((k) => k !== 'photo') as (keyof Omit<CoffeeDetails, 'photo'>)[]
const BREW_KEYS = Object.keys(brewFields) as (keyof BrewFields)[]

/** Copies the listed keys that are set, so no `undefined` reaches Convex. */
function pick<T extends object, K extends keyof T>(row: T, keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.flatMap((k) => (row[k] === undefined ? [] : [[k, row[k]]]))) as Pick<T, K>
}

const chunks = <T>(rows: T[], size: number) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))

/**
 * Внеси от Dial In. Asks which rows you have already (old and new alike),
 * then for each batch of new coffees uploads their photos one by one and
 * writes the batch, then the brews with their coffee ids mapped, then the
 * grinder and Opus settings where yours are unset. Running it again adds
 * nothing. Returns how many coffees and brews were added.
 */
export async function importBackup(json: string, io: ImportApi, onProgress: (p: ImportProgress) => void = () => {}) {
  const file = parseBackup(json)
  const have = await io.existing()
  const coffeeIds = new Map<string, string>(have.coffees)
  const haveBrews = new Set(have.brews)

  const newCoffees = file.coffees.filter((c) => !coffeeIds.has(c.id))
  const photoTotal = newCoffees.filter((c) => c.photo).length
  let photosDone = 0
  let coffeesAdded = 0
  for (const batch of chunks(newCoffees, COFFEE_BATCH)) {
    const rows = []
    for (const c of batch) {
      let photo: Id<'_storage'> | undefined
      if (c.photo) {
        onProgress({ step: 'photos', done: photosDone, total: photoTotal })
        let blob: Blob | undefined
        try {
          blob = dataUrlToBlob(c.photo)
        } catch {
          // A photo that doesn't decode is left out; the coffee still comes in.
        }
        if (blob) photo = await io.uploadPhoto(blob)
        photosDone++
      }
      rows.push({
        legacyId: c.id,
        ...pick(c, COFFEE_KEYS),
        ...(photo ? { photo } : {}),
        finished: c.finished,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })
    }
    const result = await io.coffees({ coffees: rows })
    for (const [legacyId, id] of result.ids) coffeeIds.set(legacyId, id)
    coffeesAdded += result.added
  }
  if (photoTotal > 0) onProgress({ step: 'photos', done: photoTotal, total: photoTotal })

  // A brew whose coffee is in neither the file nor your log has nowhere to go.
  const newBrews = file.brews.filter((b) => !haveBrews.has(b.id) && coffeeIds.has(b.coffeeId))
  let brewsAdded = 0
  let brewsDone = 0
  for (const batch of chunks(newBrews, BREW_BATCH)) {
    onProgress({ step: 'brews', done: brewsDone, total: newBrews.length })
    const rows = batch.map((b) => ({
      legacyId: b.id,
      coffeeId: coffeeIds.get(b.coffeeId)!,
      ...pick(b, BREW_KEYS),
      ...(b.grinder ? { grinder: b.grinder } : {}),
      createdAt: b.createdAt,
    }))
    brewsAdded += (await io.brews({ brews: rows })).added
    brewsDone += batch.length
  }

  const equipment = pick(file.equipment, ['grinder', 'opusInner', 'opusDial'])
  if (Object.keys(equipment).length > 0) await io.equipment(equipment)

  return { coffees: coffeesAdded, brews: brewsAdded }
}

// Exporting.

export type ExportData = FunctionReturnType<typeof api.data.exportMine>

/** Fetches a stored photo and returns it as a data URL. */
export async function fetchPhoto(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Photo download failed: ${res.status}`)
  return blobToDataUrl(await res.blob())
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Изнеси: your log as one Кафето file, each photo fetched one by one and
 * written in as a data URL, so the file alone restores everything.
 */
export async function buildExport(
  data: ExportData,
  getPhoto: (url: string) => Promise<string> = fetchPhoto,
  onProgress: (done: number, total: number) => void = () => {},
  now = new Date(),
): Promise<KafetoBackupFile> {
  const fileId = new Map(data.coffees.map((c) => [c._id as string, c.legacyId ?? c._id]))
  const total = data.coffees.filter((c) => c.photoUrl).length
  let done = 0
  const coffees: FileCoffee[] = []
  for (const c of data.coffees) {
    let photo: string | undefined
    if (c.photoUrl) {
      onProgress(done, total)
      photo = await getPhoto(c.photoUrl)
      done++
    }
    coffees.push({
      id: fileId.get(c._id)!,
      ...pick(c, COFFEE_KEYS),
      ...(photo ? { photo } : {}),
      finished: c.finished,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })
  }
  if (total > 0) onProgress(total, total)
  const brews: FileBrew[] = data.brews.flatMap((b) => {
    const coffeeId = fileId.get(b.coffeeId)
    if (!coffeeId) return []
    return [{ id: b.legacyId ?? b._id, coffeeId, ...pick(b, BREW_KEYS), ...(b.grinder ? { grinder: b.grinder } : {}), createdAt: b.createdAt }]
  })
  return {
    app: 'kafeto',
    version: 2,
    exportedAt: now.toISOString(),
    coffees,
    brews,
    equipment: pick(data.equipment, ['grinder', 'opusInner', 'opusDial']),
  }
}

export const exportFileName = (now = new Date()) => `onova-za-kafeto-${now.toISOString().slice(0, 10)}.json`

/**
 * Saves the file: the share sheet on a phone (where iOS lets a Home Screen
 * app keep a file in Files), a download elsewhere. Throws `NotAllowedError`
 * if the share sheet needs a fresh tap; the caller offers a button for it.
 */
export async function saveFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      throw e
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  // Revoked later, not on the next line: Safari may not have read the file yet.
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
  return 'downloaded'
}
