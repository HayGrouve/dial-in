import { useRef, useState } from 'react'
import { Link } from 'wouter'
import { compressImage } from '../lib/image'
import { getApiKey } from '../lib/prefs'
import type { ScannedFields } from '../lib/scan'
import { Camera, Close } from './icons'
import { BagPhoto } from './ui'

type Side = 'front' | 'back'

type Status =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'done'; found: number }
  | { kind: 'error'; message: string }

/**
 * Front and back photos of the bag. Once both are in (or on request with one), the label is
 * read and the details found are handed to `onScanned`. The front photo is kept as the bag photo.
 */
export function BagScanner({
  front,
  onFront,
  onScanned,
}: {
  front?: Blob
  onFront: (b: Blob | undefined) => void
  onScanned: (fields: ScannedFields) => void
}) {
  // Full-resolution sources for reading the label; the stored front photo is downscaled.
  const [sources, setSources] = useState<{ front?: Blob; back?: Blob }>({})
  const [back, setBack] = useState<Blob>()
  const [busy, setBusy] = useState<Side>()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const run = useRef(0)
  const hasKey = !!getApiKey()

  const scan = async (photos: Blob[]) => {
    const id = ++run.current
    setStatus({ kind: 'reading' })
    try {
      const { scanBag } = await import('../lib/scan')
      const fields = await scanBag(getApiKey(), photos)
      if (id !== run.current) return
      onScanned(fields)
      const found = Object.values(fields).filter((v) => (Array.isArray(v) ? v.length : v != null)).length
      setStatus({ kind: 'done', found })
    } catch (e) {
      if (id === run.current) setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Label reading failed.' })
    }
  }

  const photosFor = (s: { front?: Blob; back?: Blob }) => [s.front ?? front, s.back].filter((b): b is Blob => !!b)

  const take = async (side: Side, file?: File) => {
    if (!file) return
    setBusy(side)
    try {
      const small = await compressImage(file)
      if (side === 'front') onFront(small)
      else setBack(small)
      const next = { ...sources, [side]: file }
      setSources(next)
      if (hasKey && (next.front ?? front) && next.back) void scan(photosFor(next))
    } finally {
      setBusy(undefined)
    }
  }

  const remove = (side: Side) => {
    run.current++
    setStatus({ kind: 'idle' })
    setSources((s) => ({ ...s, [side]: undefined }))
    if (side === 'front') onFront(undefined)
    else setBack(undefined)
  }

  const photos = { front, back }
  const count = photosFor(sources).length

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {(['front', 'back'] as const).map((side) => (
          <Slot key={side} side={side} photo={photos[side]} busy={busy === side} onFile={(f) => void take(side, f)} onRemove={() => remove(side)} />
        ))}
      </div>

      <div className="min-h-5 text-center text-sm text-roast">
        {!hasKey ? (
          count > 0 && (
            <>
              <Link href="/settings" className="font-semibold text-crema-deep underline">Add an API key</Link> to fill in the details from these photos.
            </>
          )
        ) : status.kind === 'reading' ? (
          <span className="animate-pulse font-medium text-crema-deep">Reading the label…</span>
        ) : status.kind === 'done' ? (
          status.found ? `Found ${status.found} details on the label. Give them a quick check.` : 'Nothing readable on the label. Try a sharper photo.'
        ) : status.kind === 'error' ? (
          <>
            <span className="text-red-700 dark:text-red-400">{status.message}</span>{' '}
            <button type="button" className="font-semibold text-crema-deep underline" onClick={() => void scan(photosFor(sources))}>Retry</button>
          </>
        ) : count === 0 ? (
          'Snap the front and back. The details fill themselves in.'
        ) : (
          <>
            {back ? 'Now the front, ' : 'Now the back, '}
            or{' '}
            <button type="button" className="font-semibold text-crema-deep underline" onClick={() => void scan(photosFor(sources))}>read this one</button>
          </>
        )}
      </div>
    </div>
  )
}

function Slot({ side, photo, busy, onFile, onRemove }: { side: Side; photo?: Blob; busy: boolean; onFile: (f?: File) => void; onRemove: () => void }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const label = side === 'front' ? 'Front' : 'Back'

  const input = (ref: typeof cameraRef, capture?: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      {...(capture ? { capture: 'environment' as const } : {})}
      className="hidden"
      onChange={(e) => {
        onFile(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  const pill = 'rounded-full bg-espresso/75 px-3 py-1.5 text-xs font-semibold text-foam backdrop-blur hover:bg-espresso'

  return (
    <div>
      {photo ? (
        <div className="relative">
          <BagPhoto blob={photo} className="aspect-[4/5] w-full rounded-2xl border border-husk" />
          <span className="absolute top-2 left-2 rounded-full bg-espresso/75 px-2.5 py-1 text-xs font-semibold text-foam backdrop-blur">{label}</span>
          <div className="absolute inset-x-2 bottom-2 flex justify-center gap-1.5">
            <button type="button" className={pill} onClick={() => cameraRef.current?.click()}>Retake</button>
            <button type="button" className={pill} onClick={onRemove} aria-label={`Remove ${side} photo`}><Close width={14} height={14} /></button>
          </div>
        </div>
      ) : (
        <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-husk p-3 text-center">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="grid h-14 w-14 place-items-center rounded-full bg-crema/15 text-crema-deep hover:bg-crema/25"
            aria-label={`Photograph the ${side}`}
          >
            <Camera width={26} height={26} />
          </button>
          <div className="text-sm font-semibold">{busy ? 'Processing…' : `${label} of the bag`}</div>
          <button type="button" className="text-xs font-medium text-roast underline" onClick={() => libraryRef.current?.click()}>
            From library
          </button>
        </div>
      )}
      {input(cameraRef, true)}
      {input(libraryRef)}
    </div>
  )
}
