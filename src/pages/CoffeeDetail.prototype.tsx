// PROTOTYPE, throwaway. Lives only on the `prototype/coffee-page-actions` branch; never merge.
//
// Issue #7: three placements for Finish / Bought it again on the coffee page, switchable via
// `?variant=A|B|C` on the existing /coffee/:id route (no param = today's page). Each covers both
// states; Finish and restock really flip `finished` in IndexedDB, and the placeholder undo toast
// flips it back.
//
//   A  Top bar     Finish bag sits beside Edit over the photo. Finished: photo greys out, a
//                  "Bag finished" badge takes Finish's spot, Log a brew drops under the setting card.
//   B  Status row  A shelf-status row under the rating holds Finish bag. Finished: the row reads
//                  "Bag finished" and its button becomes Log a brew.
//   C  Split bar   Finish shares the sticky bar with Log a brew. Finished: the bar becomes
//                  Bought it again + a small Log, and a Finished tag joins the roaster line.
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { Back, Check, Plus, Trash } from '../components/icons'
import { PrototypeSwitcher } from '../components/PrototypeSwitcher'
import { BagPhoto, PhotoViewer, Rating } from '../components/ui'
import { arrowKeys } from '../lib/a11y'
import { db, deleteCoffee, type Brew, type BrewMethod, type Coffee } from '../lib/db'
import { logLabel, METHODS, settingsFor } from '../lib/methods'
import { About, SettingCard, TryRow } from './CoffeeDetail'

export const PROTO_VARIANTS = [
  { key: 'A', name: 'Top bar' },
  { key: 'B', name: 'Status row' },
  { key: 'C', name: 'Split bar' },
]

type Setting = ReturnType<typeof settingsFor>[number]

const glass = 'rounded-full bg-canvas/70 px-4 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-canvas/95'
const chip = 'btn border border-line bg-surface !px-4 !py-2 text-ink hover:bg-canvas'

export default function CoffeeDetailPrototype({ variant, coffee, brews }: { variant: string; coffee: Coffee; brews: Brew[] }) {
  const id = coffee.id
  const [, navigate] = useLocation()
  const params = new URLSearchParams(useSearch())
  const [viewing, setViewing] = useState(false)
  const [toast, setToast] = useState<{ text: string; undoTo: boolean; at: number } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const settings = settingsFor(brews)
  const current = settings.find((s) => s.brew.method === params.get('method')) ?? settings[0]
  const pick = (method: BrewMethod) => {
    const p = new URLSearchParams(params)
    p.set('method', method)
    navigate(`/coffee/${id}?${p}`, { replace: true })
  }

  const setFinished = (finished: boolean, undoable = true) => {
    void db.coffees.update(id, { finished, updatedAt: Date.now() })
    setToast(undoable ? { text: finished ? 'Finished.' : 'Back on your shelf.', undoTo: !finished, at: Date.now() } : null)
  }
  const finish = () => setFinished(true)
  const restock = () => setFinished(false)
  const rate = (rating: number | undefined) => db.coffees.update(id, { rating, updatedAt: Date.now() })
  const remove = async () => {
    if (!confirm(`Delete “${coffee.name}” and all ${brews.length} ${brews.length === 1 ? 'brew' : 'brews'}?`)) return
    await deleteCoffee(id)
    navigate('/', { replace: true })
  }

  const done = coffee.finished
  const logHref = `/coffee/${id}/brew/new${current ? `?method=${current.brew.method}` : ''}`
  const logText = current ? logLabel(current.brew.method) : 'Log a brew'
  const edit = (
    <Link href={`/coffee/${id}/edit`} className={glass}>
      Edit
    </Link>
  )
  const big = '!py-4 !text-base'

  let topRight: ReactNode = edit
  let tag: ReactNode = null
  let underRating: ReactNode = null
  let afterCard: ReactNode = null
  let bar: ReactNode

  if (variant === 'A') {
    topRight = (
      <div className="flex items-center gap-2">
        {done ? (
          <span className="flex items-center gap-1.5 rounded-full border border-ink/25 px-3.5 py-[7px] text-sm text-ink/85">
            <span className="h-2 w-2 rounded-full border border-current" aria-hidden /> Bag finished
          </span>
        ) : (
          <button type="button" onClick={finish} className={`${glass} flex items-center gap-1.5`}>
            <Check width={16} height={16} /> Finish bag
          </button>
        )}
        {edit}
      </div>
    )
    afterCard = done && (
      <Link href={logHref} className="btn-ghost mt-4 !flex w-full">
        <Plus width={16} height={16} /> {logText}
      </Link>
    )
    bar = done ? (
      <button type="button" onClick={restock} className={`btn-primary !flex w-full ${big}`}>
        Bought it again
      </button>
    ) : (
      <Link href={logHref} className={`btn-primary !flex w-full ${big}`}>
        <Plus width={18} height={18} /> {logText}
      </Link>
    )
  } else if (variant === 'B') {
    underRating = (
      <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-tint py-2 pr-2 pl-4">
        <span className={`h-2 w-2 shrink-0 rounded-full ${done ? 'border border-muted' : 'bg-accent'}`} aria-hidden />
        <span className={`flex-1 text-sm ${done ? 'text-muted' : ''}`}>{done ? 'Bag finished' : 'On your shelf'}</span>
        {done ? (
          <Link href={logHref} className={chip}>
            <Plus width={16} height={16} /> Log a brew
          </Link>
        ) : (
          <button type="button" onClick={finish} className={chip}>
            <Check width={16} height={16} /> Finish bag
          </button>
        )}
      </div>
    )
    bar = done ? (
      <button type="button" onClick={restock} className={`btn-primary !flex w-full ${big}`}>
        Bought it again
      </button>
    ) : (
      <Link href={logHref} className={`btn-primary !flex w-full ${big}`}>
        <Plus width={18} height={18} /> {logText}
      </Link>
    )
  } else {
    tag = done && <span className="shrink-0 rounded-full bg-tint px-2.5 py-0.5 text-xs font-medium text-ink">Finished</span>
    const side = `btn shrink-0 border border-line bg-surface text-ink hover:bg-tint ${big}`
    bar = done ? (
      <div className="flex gap-2">
        <button type="button" onClick={restock} className={`btn-primary !flex flex-1 ${big}`}>
          Bought it again
        </button>
        <Link href={logHref} className={side} aria-label={logText}>
          <Plus width={18} height={18} /> Log
        </Link>
      </div>
    ) : (
      <div className="flex gap-2">
        <Link href={logHref} className={`btn-primary !flex flex-1 ${big}`}>
          <Plus width={18} height={18} /> {logText}
        </Link>
        <button type="button" onClick={finish} className={side}>
          <Check width={18} height={18} /> Finish
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="relative -mx-4 sm:mx-0 sm:mt-4 sm:overflow-hidden sm:rounded-t-[28px]">
        <button
          type="button"
          onClick={() => coffee.photo && setViewing(true)}
          disabled={!coffee.photo}
          aria-label={coffee.photo ? 'View bag photo' : undefined}
          className={`block w-full transition duration-500 ${variant === 'A' && done ? 'opacity-60 grayscale' : ''}`}
        >
          <BagPhoto blob={coffee.photo} alt={`Bag of ${coffee.name}`} className="h-[min(48dvh,420px)] w-full" iconSize={56} />
        </button>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-canvas/40 via-transparent via-35% to-canvas to-85%" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <Link href="/" className="rounded-full bg-canvas/70 p-2.5 backdrop-blur-md transition hover:bg-canvas/95" aria-label="Back to shelf">
            <Back />
          </Link>
          {topRight}
        </div>
      </div>

      <div className="relative -mt-24 pb-32">
        <div className="rise">
          <div className="flex min-w-0 items-center gap-2">
            {tag}
            <p className="truncate text-sm text-muted">{[coffee.roaster, coffee.origin].filter(Boolean).join(', ')}</p>
          </div>
          <h1 className="mt-1 text-[40px] leading-[1.02] break-words font-semibold tracking-[-0.03em]">{coffee.name}</h1>
          {coffee.tastingNotes.length > 0 && <p className="mt-2 text-lg text-accent-fg">{coffee.tastingNotes.join(', ')}</p>}
          <div className="mt-2 -ml-1">
            <Rating value={coffee.rating} onChange={rate} size={20} />
          </div>
          {underRating}
        </div>

        <Brews settings={settings} current={current} pick={pick} afterCard={afterCard} />

        <About coffee={coffee} />

        <div className="mt-10">
          <button type="button" onClick={remove} className="btn-ghost !text-bitter">
            <Trash width={16} height={16} /> Delete
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),1rem)+4.75rem)] z-30 px-4">
        {toast && (
          <div key={toast.at} className="rise pointer-events-auto mx-auto flex max-w-[44rem] items-center gap-3 rounded-full bg-ink py-1.5 pr-1.5 pl-5 text-sm text-canvas shadow-lg shadow-black/30">
            <span className="flex-1">{toast.text}</span>
            <button type="button" onClick={() => setFinished(toast.undoTo, false)} className="rounded-full px-4 py-2 font-semibold underline underline-offset-2 hover:bg-canvas/10">
              Undo
            </button>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-canvas from-50% to-transparent px-4 pt-8 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="mx-auto max-w-[44rem]">{bar}</div>
      </div>

      {viewing && coffee.photo && <PhotoViewer blob={coffee.photo} alt={`Bag of ${coffee.name}`} onClose={() => setViewing(false)} />}
      <PrototypeSwitcher variants={PROTO_VARIANTS} state={done ? 'finished' : 'on the shelf'} />
    </>
  )
}

/** Method tabs, setting card and "How you got here", as on today's page, with a slot under the card. */
function Brews({ settings, current, pick, afterCard }: { settings: Setting[]; current?: Setting; pick: (m: BrewMethod) => void; afterCard: ReactNode }) {
  if (!current)
    return (
      <>
        <p className="card mt-8 p-6 text-balance text-muted">No brews yet. Log your first one and the setting to remember will live here.</p>
        {afterCard}
      </>
    )
  return (
    <>
      {settings.length > 1 && (
        <div className="-mx-4 mt-7 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label="Brew method" onKeyDown={arrowKeys}>
          {settings.map(({ brew }) => {
            const on = brew.method === current.brew.method
            return (
              <button
                key={brew.method}
                type="button"
                role="tab"
                id={`tab-${brew.method}`}
                aria-selected={on}
                aria-controls="method-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => pick(brew.method)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${on ? 'bg-ink text-canvas' : 'bg-surface text-muted hover:text-ink'}`}
              >
                {METHODS[brew.method].label}
              </button>
            )
          })}
        </div>
      )}

      <div {...(settings.length > 1 ? { role: 'tabpanel', id: 'method-panel', 'aria-labelledby': `tab-${current.brew.method}` } : {})}>
        <SettingCard key={current.brew.method} brew={current.brew} provisional={current.provisional} tries={current.tries} />
        {afterCard}
        {current.tries.length > 1 && (
          <section className="mt-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">How you got here</h2>
            <ol className="relative ml-2 border-l border-line">
              {current.tries.map((b) => (
                <TryRow key={b.id} brew={b} />
              ))}
            </ol>
          </section>
        )}
      </div>
    </>
  )
}
