/**
 * PROTOTYPE (issue #9): how do Finish and Restock work from the home screen?
 *
 * Three variants of the home page, switchable via `?variant=A|B|C`, on the existing `/` route.
 * Data comes from the real Dexie database; Finish and Restock really flip `finished` (with undo),
 * so seed throwaway data first with `/?seed=prototype`.
 *
 *   A  Corner buttons   A "Finish" chip on every shelf card, "Finish bag" beside Log on Up Next,
 *                       "Bought it again" pill on Finished rows. Cards fold away in place.
 *   B  Menu + gestures  A visible "…" on each card opens a sheet; long-press is an accelerator
 *                       for the same sheet. Finished rows swipe left to restock, plus the pill.
 *   C  Manage mode      "Manage" on the shelf heading turns the row into a list with Finish
 *                       buttons. Up Next has a quiet "Bag's empty?" finish. Restock scrolls
 *                       you up to watch the coffee land back on the shelf.
 *
 * Throwaway: lives on branch prototype/home-finish-restock and is never merged.
 */
import './Home.prototype.css'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link } from 'wouter'
import { PrototypeSwitcher } from '../components/PrototypeSwitcher'
import { BagPhoto } from '../components/ui'
import { Check, Chevron, Gear, Plus, Search } from '../components/icons'
import { db, type Brew, type Coffee } from '../lib/db'
import { seedPrototype } from '../lib/seed.prototype'
import { formatTime, METHODS, relativeDay, settingsFor } from '../lib/methods'
import { DialingRow, SettingsLine } from './Home'

const VARIANTS = [
  { key: 'A', name: 'Corner buttons' },
  { key: 'B', name: 'Menu + gestures' },
  { key: 'C', name: 'Manage mode' },
]

type Props = {
  variant: string
  setVariant: (v: string) => void
  coffees: Coffee[]
  brews: Brew[]
  query: string
  setQuery: (q: string) => void
  showSearch: boolean
  showFinished: boolean
  setShowFinished: (show: boolean) => void
}

// ---------------------------------------------------------------------------
// Shared mechanics: the actual mutation, motion timing and the placeholder undo toast.
// ---------------------------------------------------------------------------

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
/** `&slowmo` in the URL plays every transition 8x slower, to watch where a coffee goes. */
const slow = () => (new URLSearchParams(location.search).has('slowmo') ? 8 : 1)
const wait = (ms: number) => new Promise((r) => setTimeout(r, reducedMotion() ? 0 : ms * slow()))

type Toast = { id: number; text: string; undo: () => void }

function useShelfMotion() {
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [arriving, setArriving] = useState<Set<string>>(new Set())
  const [pulse, setPulse] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)

  const add = (set: typeof setLeaving, id: string) => set((s) => new Set(s).add(id))
  const remove = (set: typeof setLeaving, id: string) =>
    set((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
  const arrive = (id: string) => {
    add(setArriving, id)
    setTimeout(() => remove(setArriving, id), 1800 * slow())
    // Whatever lands on the shelf lands at its spot in the row; bring the row back so it can be seen.
    setTimeout(() => {
      const card = document.querySelector(`[data-shelf-card="${id}"]`)
      card?.closest('ul')?.scrollTo({ left: Math.max(0, (card as HTMLElement).offsetLeft - 16), behavior: 'smooth' })
    }, 150)
  }

  /** Plays the exit (`exitMs`), flips `finished`, then plays the arrival and shows the undo toast. */
  async function move(c: Coffee, finished: boolean, exitMs: number, after?: () => void) {
    if (leaving.has(c.id)) return
    const before = { finished: c.finished, updatedAt: c.updatedAt }
    add(setLeaving, c.id)
    await wait(exitMs)
    await db.coffees.update(c.id, { finished, updatedAt: Date.now() })
    remove(setLeaving, c.id)
    arrive(c.id)
    if (finished) setPulse((p) => p + 1)
    after?.()
    setToast({
      id: Date.now(),
      text: finished ? `Finished ${c.name}.` : `${c.name} is back on the shelf.`,
      undo: async () => {
        setToast(null)
        await db.coffees.update(c.id, before)
        arrive(c.id)
        if (!finished) setPulse((p) => p + 1)
      },
    })
  }

  const dismissToast = useCallback(() => setToast(null), [])
  return {
    leaving,
    arriving,
    pulse,
    toast,
    dismissToast,
    finish: (c: Coffee, exitMs = 460, after?: () => void) => move(c, true, exitMs, after),
    restock: (c: Coffee, exitMs = 420, after?: () => void) => move(c, false, exitMs, after),
  }
}
type Motion = ReturnType<typeof useShelfMotion>

/** PLACEHOLDER undo toast (its real design is a separate ticket). Stacks above "New coffee". */
function UndoToast({ toast, onDismiss }: { toast: Toast | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 6000 * slow())
    return () => clearTimeout(t)
  }, [toast, onDismiss])
  return (
    <div
      role="status"
      className="pointer-events-none fixed right-[max(1rem,calc(50vw-24rem+1rem))] bottom-[calc(max(env(safe-area-inset-bottom),1rem)+3.75rem)] left-[max(1rem,calc(50vw-24rem+1rem))] z-30 flex justify-end"
    >
      {toast && (
        <div key={toast.id} className="proto-toast pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl bg-ink py-2 pr-2 pl-4 text-sm text-canvas shadow-[0_12px_32px_-12px_rgb(6_14_11/0.6)]">
          <span className="min-w-0">{toast.text}</span>
          <button type="button" onClick={toast.undo} className="min-h-10 shrink-0 rounded-full bg-canvas/15 px-4 font-semibold hover:bg-canvas/25">
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

function FinishedHeading({ count, open, onToggle, pulse }: { count: number; open: boolean; onToggle: () => void; pulse: number }) {
  return (
    <h2 className="text-xl font-semibold tracking-tight">
      <button type="button" onClick={onToggle} aria-expanded={open} className="group flex w-full items-center justify-between rounded-full py-2 text-left">
        Finished
        <span className="flex items-center gap-1 text-sm font-normal tracking-normal text-muted transition group-hover:text-ink">
          <span key={pulse} className={`inline-block ${pulse ? 'proto-pulse' : ''}`}>
            {count} {count === 1 ? 'bag' : 'bags'}
          </span>
          <Chevron width={16} height={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
    </h2>
  )
}

/** The Up Next card's top half (photo, name, setting), identical across variants. */
function UpNextBody({ coffee, brews, last }: { coffee: Coffee; brews: Brew[]; last: Brew }) {
  const setting = settingsFor(brews).find((s) => s.brew.method === last.method)!.brew
  const m = METHODS[setting.method]
  return (
    <>
      <Link href={`/coffee/${coffee.id}`} className="flex gap-4">
        <BagPhoto blob={coffee.photo} alt="" className="aspect-[4/5] w-24 shrink-0 rounded-[20px]" iconSize={28} />
        <div className="min-w-0 py-1">
          <p className="text-sm text-muted">Brewed {relativeDay(last.createdAt).toLowerCase()}</p>
          <h2 className="mt-1 text-2xl leading-tight font-semibold tracking-tight break-words">{coffee.name}</h2>
          <p className="mt-1 truncate text-sm text-muted">{coffee.roaster}</p>
        </div>
      </Link>
      <div className="mt-5 flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <div className="text-sm text-muted">{setting.dialedIn ? m.label : `${m.label}, still dialing`}</div>
          <div className={`truncate font-mono leading-none font-semibold tracking-tighter text-accent-fg ${setting.grindSetting.length > 6 ? 'text-4xl' : 'text-[56px]'}`}>
            {setting.grindSetting || '—'}
          </div>
        </div>
        <p className="shrink-0 pb-1 text-right font-mono text-sm leading-relaxed text-muted">
          {setting.dose != null && <>{setting.dose}g in<br /></>}
          {setting.yield != null && <>{setting.yield}g {m.isEspresso ? 'out' : 'water'}<br /></>}
          {formatTime(setting.timeSec)}
        </p>
      </div>
    </>
  )
}
const logHref = (coffee: Coffee, brews: Brew[], last: Brew) => {
  const setting = settingsFor(brews).find((s) => s.brew.method === last.method)!.brew
  return { href: `/coffee/${coffee.id}/brew/new?method=${setting.method}`, label: METHODS[setting.method].label.toLowerCase() }
}

/** Collapses the Up Next card while its coffee is leaving the shelf. */
function UpNextShell({ leaving, children }: { leaving: boolean; children: ReactNode }) {
  return (
    <div className={`proto-row ${leaving ? 'proto-row-out' : ''}`}>
      <div>
        <section className="rise card p-4">{children}</section>
      </div>
    </div>
  )
}

const shelfRowClass = '[overflow-anchor:none] -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
const shelfItemClass = 'relative w-[42vw] max-w-[180px] shrink-0 snap-start'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePrototype(p: Props) {
  const motion = useShelfMotion()
  useEffect(() => {
    document.documentElement.style.setProperty('--proto-slow', String(slow()))
  })
  const { coffees, brews } = p
  const brewsOf = (id: string) => brews.filter((b) => b.coffeeId === id)
  const shelf = coffees.filter((c) => !c.finished)
  const finished = coffees.filter((c) => c.finished)
  const lastBrew = brews.find((b) => shelf.some((c) => c.id === b.coffeeId))
  const upNext = lastBrew && shelf.find((c) => c.id === lastBrew.coffeeId)
  const dialing = shelf.filter((c) => {
    const bs = brewsOf(c.id)
    return bs.length > 0 && !bs.some((b) => b.dialedIn)
  })
  const q = p.showSearch ? p.query.trim().toLowerCase() : ''
  const results = coffees.filter((c) =>
    [c.name, c.roaster, c.origin, c.region, c.producer, c.process, c.varietal, ...c.tastingNotes].some((s) => s?.toLowerCase().includes(q)),
  )
  const data: VariantData = { shelf, finished, upNext, lastBrew, brewsOf, motion, showFinished: p.showFinished, setShowFinished: p.setShowFinished }

  return (
    <>
      <header className="flex items-center justify-between pt-[max(env(safe-area-inset-top),1rem)] pb-4">
        <h1 className="text-lg font-semibold tracking-tight" translate="no">
          Dial In
        </h1>
        <Link href="/settings" className="-mr-2 rounded-full p-2.5 text-muted hover:bg-surface hover:text-ink" aria-label="Settings">
          <Gear />
        </Link>
      </header>

      {p.showSearch && (
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" width={18} height={18} />
          <input
            value={p.query}
            onChange={(e) => p.setQuery(e.target.value)}
            placeholder="Search roaster, origin, notes…"
            aria-label="Search coffees"
            name="q"
            autoComplete="off"
            className="input !rounded-full !bg-surface !pl-11"
            type="search"
          />
        </div>
      )}

      {q ? (
        <section className="pb-28">
          <ul className="space-y-1">
            {results.map((c) => (
              <li key={c.id}>
                <Link href={`/coffee/${c.id}`} className="flex items-center gap-3 rounded-[20px] p-2 hover:bg-surface">
                  <BagPhoto blob={c.photo} alt="" className="aspect-[4/5] w-12 shrink-0 rounded-xl" iconSize={18} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="truncate text-sm text-muted">{c.finished ? `${c.roaster}, finished` : c.roaster}</div>
                  </div>
                  <SettingsLine brews={brewsOf(c.id)} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {p.variant === 'A' && <VariantA {...data} />}
          {p.variant === 'B' && <VariantB {...data} />}
          {p.variant === 'C' && <VariantC {...data} />}

          {dialing.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-xl font-semibold tracking-tight">Still dialing</h2>
              <div className="space-y-2">
                {dialing.map((c) => (
                  <DialingRow key={c.id} coffee={c} last={brewsOf(c.id)[0]} />
                ))}
              </div>
            </section>
          )}

          {p.variant === 'A' && <FinishedA {...data} />}
          {p.variant === 'B' && <FinishedB {...data} />}
          {p.variant === 'C' && <FinishedC {...data} />}
          <div className="h-24" />
        </>
      )}

      <Link
        href="/coffee/new"
        className="btn fixed right-[max(1rem,calc(50vw-24rem+1rem))] bottom-[max(env(safe-area-inset-bottom),1rem)] z-30 bg-ink !px-5 !py-3.5 text-canvas shadow-[0_12px_32px_-12px_rgb(6_14_11/0.6)] hover:bg-ink/90"
      >
        <Plus width={18} height={18} /> New coffee
      </Link>

      <UndoToast toast={motion.toast} onDismiss={motion.dismissToast} />

      <PrototypeSwitcher
        variants={VARIANTS}
        current={p.variant}
        onChange={p.setVariant}
        extra={
          <button type="button" onClick={() => void seedPrototype()} className="ml-0.5 rounded-full px-2.5 py-1.5 text-white/70 hover:bg-white/15 hover:text-white">
            Reseed
          </button>
        }
      />
    </>
  )
}

type VariantData = {
  shelf: Coffee[]
  finished: Coffee[]
  upNext?: Coffee
  lastBrew?: Brew
  brewsOf: (id: string) => Brew[]
  motion: Motion
  showFinished: boolean
  setShowFinished: (show: boolean) => void
}

function ShelfCardBody({ coffee, brews, glow }: { coffee: Coffee; brews: Brew[]; glow?: boolean }) {
  return (
    <>
      <BagPhoto blob={coffee.photo} alt="" className={`aspect-[4/5] w-full rounded-[20px] transition group-active:scale-[0.98] ${glow ? 'proto-glow' : ''}`} />
      <div className="mt-2.5 truncate font-medium">{coffee.name}</div>
      <div className="truncate text-sm text-muted">{coffee.roaster}</div>
      <div className="mt-1">
        <SettingsLine brews={brews} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Variant A: always-visible buttons. One tap everywhere, cards fold away in place.
// ---------------------------------------------------------------------------

function VariantA({ shelf, upNext, lastBrew, brewsOf, motion }: VariantData) {
  return (
    <>
      {upNext && lastBrew && (
        <UpNextShell key={upNext.id} leaving={motion.leaving.has(upNext.id)}>
          <UpNextBody coffee={upNext} brews={brewsOf(upNext.id)} last={lastBrew} />
          <div className="mt-5 flex gap-2">
            <Link href={logHref(upNext, brewsOf(upNext.id), lastBrew).href} className="btn-primary min-w-0 flex-1 !px-4 !py-3.5 !text-base">
              <Plus width={18} height={18} /> Log another {logHref(upNext, brewsOf(upNext.id), lastBrew).label}
            </Link>
            <button type="button" onClick={() => motion.finish(upNext)} className="btn-ghost shrink-0 !px-4 !py-3.5" aria-label={`Finish bag of ${upNext.name}`}>
              Finish bag
            </button>
          </div>
        </UpNextShell>
      )}

      {shelf.length > 0 && (
        <section className={upNext ? 'mt-10' : ''}>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">On the shelf</h2>
          <ul className={shelfRowClass}>
            {shelf.map((c, i) => {
              const leaving = motion.leaving.has(c.id)
              const arriving = motion.arriving.has(c.id)
              return (
                <li
                  key={c.id}
                  data-shelf-card={c.id}
                  className={`${shelfItemClass} ${leaving ? 'proto-shelf-fold' : arriving ? 'proto-shelf-arrive' : 'rise'}`}
                  style={{ '--i': i } as CSSProperties}
                >
                  <Link href={`/coffee/${c.id}`} className="group block">
                    <ShelfCardBody coffee={c} brews={brewsOf(c.id)} glow={arriving} />
                  </Link>
                  {/* Sibling of the link (a button can't live inside <a>). 44px hit area around a small chip. */}
                  <button
                    type="button"
                    onClick={() => motion.finish(c)}
                    aria-label={`Finish ${c.name}`}
                    className="group/fin absolute right-0 grid h-11 min-w-11 place-items-center pr-1.5"
                    // Bottom-right corner of the 4:5 photo.
                    style={{ top: 'calc(min(42vw, 180px) * 1.25 - 2.75rem)' }}
                  >
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur transition ${
                        leaving ? 'bg-accent text-on-accent' : 'bg-canvas/80 text-ink group-hover/fin:bg-canvas'
                      }`}
                    >
                      {leaving && <Check width={13} height={13} strokeWidth={2.4} />}
                      {leaving ? 'Finished' : 'Finish'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}

function FinishedA({ finished, brewsOf, motion, showFinished, setShowFinished }: VariantData) {
  if (finished.length === 0) return null
  return (
    <section className="mt-10">
      <FinishedHeading count={finished.length} open={showFinished} onToggle={() => setShowFinished(!showFinished)} pulse={motion.pulse} />
      {showFinished && (
        <ul className="mt-2 space-y-1">
          {finished.map((c) => (
            <li key={c.id} className={`proto-row ${motion.leaving.has(c.id) ? 'proto-row-out' : motion.arriving.has(c.id) ? 'proto-row-in' : ''}`}>
              <div className={`flex items-center gap-2 rounded-full py-1 pr-1 pl-4 hover:bg-surface ${motion.arriving.has(c.id) ? 'proto-glow' : ''}`}>
                <Link href={`/coffee/${c.id}`} className="flex min-w-0 flex-1 flex-col py-1.5">
                  <span className="truncate">{c.name}</span>
                  <span className="text-[13px]">
                    <SettingsLine brews={brewsOf(c.id)} />
                  </span>
                </Link>
                <button type="button" onClick={() => motion.restock(c)} className="btn-ghost min-h-11 shrink-0 !px-4" aria-label={`Bought ${c.name} again`}>
                  Bought it again
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Variant B: a visible "…" opens a sheet; long-press opens the same sheet faster.
// Finished rows: swipe left to restock, plus the inline pill.
// ---------------------------------------------------------------------------

const Dots = (p: { className?: string }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={p.className}>
    <circle cx="5.5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="18.5" cy="12" r="1.8" />
  </svg>
)

/** Timer-based long-press (iOS fires no touch `contextmenu`); cancelled by movement, scroll or pointercancel. */
function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const [pressing, setPressing] = useState(false)
  const cancel = () => {
    window.clearTimeout(timer.current)
    start.current = null
    setPressing(false)
  }
  const fire = () => {
    cancel()
    fired.current = true
    onLongPress()
  }
  return {
    pressing,
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0) return
        fired.current = false
        start.current = { x: e.clientX, y: e.clientY }
        setPressing(true)
        timer.current = window.setTimeout(fire, ms)
      },
      onPointerMove: (e: ReactPointerEvent) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      // Android Chrome and desktop right-click fire contextmenu; suppress the browser's own menu.
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault()
        if (!fired.current) fire()
      },
      // A long-press must not also open the coffee when the finger lifts (capture runs before the link's own click).
      onClickCapture: (e: React.MouseEvent) => {
        if (fired.current) {
          e.preventDefault()
          e.stopPropagation()
          fired.current = false
        }
      },
    },
  }
}

function ActionSheet({ coffee, brews, onClose, onFinish }: { coffee: Coffee; brews: Brew[]; onClose: () => void; onFinish: () => void }) {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [onClose])
  const method = brews[0]?.method ?? 'espresso'
  return (
    <div className="proto-scrim fixed inset-0 z-50 flex items-end justify-center bg-black/55" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={coffee.name}
        className="proto-sheet w-full max-w-3xl rounded-t-[28px] bg-surface px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="mb-5 flex items-center gap-3 px-1">
          <BagPhoto blob={coffee.photo} alt="" className="aspect-[4/5] w-12 shrink-0 rounded-xl" iconSize={18} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{coffee.name}</div>
            <div className="truncate text-sm text-muted">{coffee.roaster}</div>
          </div>
        </div>
        <button ref={first} type="button" onClick={onFinish} className="btn-primary w-full !py-3.5 !text-base">
          <Check width={18} height={18} /> Finish bag
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link href={`/coffee/${coffee.id}/brew/new?method=${method}`} className="btn-ghost !py-3.5">
            <Plus width={18} height={18} /> Log a brew
          </Link>
          <Link href={`/coffee/${coffee.id}`} className="btn-ghost !py-3.5">
            Open coffee
          </Link>
        </div>
        <button type="button" onClick={onClose} className="mt-2 w-full rounded-full py-3 text-sm font-semibold text-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  )
}

function MoreButton({ name, onClick, className = '' }: { name: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={`More for ${name}`} aria-haspopup="dialog" className={`grid h-11 w-11 place-items-center ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-canvas/80 text-ink backdrop-blur">
        <Dots />
      </span>
    </button>
  )
}

function ShelfCardB({ coffee, brews, index, motion, onMenu }: { coffee: Coffee; brews: Brew[]; index: number; motion: Motion; onMenu: () => void }) {
  const lp = useLongPress(onMenu)
  const leaving = motion.leaving.has(coffee.id)
  const arriving = motion.arriving.has(coffee.id)
  return (
    <li data-shelf-card={coffee.id} className={`${shelfItemClass} ${leaving ? 'proto-shelf-drop' : arriving ? 'proto-shelf-arrive' : 'rise'}`} style={{ '--i': index } as CSSProperties}>
      <Link
        href={`/coffee/${coffee.id}`}
        {...lp.handlers}
        className={`proto-no-callout group block transition-transform ${lp.pressing ? 'scale-[0.94] duration-[450ms] ease-out' : 'duration-200'}`}
      >
        <ShelfCardBody coffee={coffee} brews={brews} glow={arriving} />
      </Link>
      <MoreButton name={coffee.name} onClick={onMenu} className="absolute top-0 right-0" />
    </li>
  )
}

function VariantB({ shelf, upNext, lastBrew, brewsOf, motion }: VariantData) {
  const [menuFor, setMenuFor] = useState<Coffee | null>(null)
  const upNextPress = useLongPress(() => upNext && setMenuFor(upNext))
  return (
    <>
      {upNext && lastBrew && (
        <UpNextShell key={upNext.id} leaving={motion.leaving.has(upNext.id)}>
          <div className="relative">
            <div {...upNextPress.handlers} className={`proto-no-callout transition-transform ${upNextPress.pressing ? 'scale-[0.97] duration-[450ms]' : 'duration-200'}`}>
              <UpNextBody coffee={upNext} brews={brewsOf(upNext.id)} last={lastBrew} />
            </div>
            <MoreButton name={upNext.name} onClick={() => setMenuFor(upNext)} className="absolute -top-2 -right-2" />
          </div>
          <Link href={logHref(upNext, brewsOf(upNext.id), lastBrew).href} className="btn-primary mt-5 w-full !py-3.5 !text-base">
            <Plus width={18} height={18} /> Log another {logHref(upNext, brewsOf(upNext.id), lastBrew).label}
          </Link>
        </UpNextShell>
      )}

      {shelf.length > 0 && (
        <section className={upNext ? 'mt-10' : ''}>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">On the shelf</h2>
          <ul className={shelfRowClass}>
            {shelf.map((c, i) => (
              <ShelfCardB key={c.id} coffee={c} brews={brewsOf(c.id)} index={i} motion={motion} onMenu={() => setMenuFor(c)} />
            ))}
          </ul>
        </section>
      )}

      {menuFor && (
        <ActionSheet
          coffee={menuFor}
          brews={brewsOf(menuFor.id)}
          onClose={() => setMenuFor(null)}
          onFinish={() => {
            const c = menuFor
            setMenuFor(null)
            // Let the sheet get out of the way before the card drops.
            setTimeout(() => motion.finish(c, 520), reducedMotion() ? 0 : 180 * slow())
          }}
        />
      )}
    </>
  )
}

/** Swipe-left-to-restock row (full-width, so `touch-action: pan-y` keeps page scroll). The pill is the tap route. */
function SwipeRow({ coffee, brews, motion }: { coffee: Coffee; brews: Brew[]; motion: Motion }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  const g = useRef<{ x: number; y: number; axis: 'x' | 'y' | null } | null>(null)
  const dragged = useRef(false)
  const width = () => row.current?.offsetWidth ?? 360

  const end = () => {
    const was = g.current
    g.current = null
    setDragging(false)
    if (was?.axis !== 'x') return
    if (dx < -width() * 0.35) {
      setDx(-width())
      motion.restock(coffee, 260)
    } else setDx(0)
  }
  const leaving = motion.leaving.has(coffee.id)
  const arriving = motion.arriving.has(coffee.id)
  const reveal = Math.min(1, -dx / (width() * 0.35))

  return (
    <li className={`proto-row ${leaving ? 'proto-row-out-left' : arriving ? 'proto-row-in' : ''}`}>
      <div className="relative">
        <div
          className="absolute inset-0 flex items-center justify-end rounded-full bg-accent pr-5 text-sm font-semibold text-on-accent"
          style={{ opacity: dx < 0 ? 0.35 + reveal * 0.65 : 0 }}
          aria-hidden
        >
          <span className={`flex items-center gap-1.5 transition-transform ${reveal >= 1 ? 'scale-110' : ''}`}>
            <Plus width={16} height={16} /> Bought it again
          </span>
        </div>
        <div
          ref={row}
          className={`relative flex touch-pan-y items-center gap-2 rounded-full bg-canvas py-1 pr-1 pl-4 hover:bg-surface ${arriving ? 'proto-glow' : ''} ${dragging ? '' : 'transition-transform duration-300 ease-out'}`}
          style={{ transform: `translateX(${dx}px)` }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return
            g.current = { x: e.clientX, y: e.clientY, axis: null }
            dragged.current = false
          }}
          onPointerMove={(e) => {
            const s = g.current
            if (!s) return
            const ddx = e.clientX - s.x
            const ddy = e.clientY - s.y
            if (!s.axis) {
              if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) {
                s.axis = 'x'
                dragged.current = true
                setDragging(true)
                e.currentTarget.setPointerCapture(e.pointerId)
              } else if (Math.abs(ddy) > 8) s.axis = 'y'
            }
            if (s.axis === 'x') setDx(Math.min(0, ddx))
          }}
          onPointerUp={end}
          onPointerCancel={() => {
            g.current = null
            setDragging(false)
            setDx(0)
          }}
        >
          <Link
            href={`/coffee/${coffee.id}`}
            draggable={false}
            onClick={(e) => dragged.current && e.preventDefault()}
            className="proto-no-callout flex min-w-0 flex-1 flex-col py-1.5"
          >
            <span className="truncate">{coffee.name}</span>
            <span className="text-[13px]">
              <SettingsLine brews={brews} />
            </span>
          </Link>
          <button
            type="button"
            onClick={() => motion.restock(coffee)}
            className="btn-ghost min-h-11 shrink-0 !px-4"
            style={{ opacity: Math.max(0, 1 - reveal * 2) }}
            aria-label={`Bought ${coffee.name} again`}
          >
            Bought it again
          </button>
        </div>
      </div>
    </li>
  )
}

function FinishedB({ finished, brewsOf, motion, showFinished, setShowFinished }: VariantData) {
  if (finished.length === 0) return null
  return (
    <section className="mt-10">
      <FinishedHeading count={finished.length} open={showFinished} onToggle={() => setShowFinished(!showFinished)} pulse={motion.pulse} />
      {showFinished && (
        <>
          <ul className="mt-2 space-y-1">
            {finished.map((c) => (
              <SwipeRow key={c.id} coffee={c} brews={brewsOf(c.id)} motion={motion} />
            ))}
          </ul>
          <p className="mt-3 px-4 text-xs text-muted">Swipe a row left to put it back on the shelf.</p>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Variant C: the shelf stays clean until you ask to manage it.
// ---------------------------------------------------------------------------

function VariantC({ shelf, upNext, lastBrew, brewsOf, motion }: VariantData) {
  const [managing, setManaging] = useState(false)
  return (
    <>
      {upNext && lastBrew && (
        <UpNextShell key={upNext.id} leaving={motion.leaving.has(upNext.id)}>
          <UpNextBody coffee={upNext} brews={brewsOf(upNext.id)} last={lastBrew} />
          <Link href={logHref(upNext, brewsOf(upNext.id), lastBrew).href} className="btn-primary mt-5 w-full !py-3.5 !text-base">
            <Plus width={18} height={18} /> Log another {logHref(upNext, brewsOf(upNext.id), lastBrew).label}
          </Link>
          <button
            type="button"
            onClick={() => motion.finish(upNext)}
            className="mx-auto mt-1 flex min-h-11 items-center rounded-full px-4 text-sm text-muted hover:text-ink"
          >
            Bag's empty?&nbsp;<span className="font-semibold text-ink underline decoration-line underline-offset-4">Finish it</span>
          </button>
        </UpNextShell>
      )}

      {shelf.length > 0 && (
        <section id="proto-shelf" className={`scroll-mt-16 ${upNext ? 'mt-10' : ''}`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">On the shelf</h2>
            <button type="button" onClick={() => setManaging(!managing)} aria-pressed={managing} className={managing ? 'btn-primary min-h-11' : 'btn-ghost min-h-11'}>
              {managing ? 'Done' : 'Manage'}
            </button>
          </div>

          {managing ? (
            <ul className="space-y-2">
              {shelf.map((c, i) => {
                const leaving = motion.leaving.has(c.id)
                return (
                  <li key={c.id} className={`proto-row ${leaving ? 'proto-row-out' : 'rise'}`} style={{ '--i': i } as CSSProperties}>
                    <div className="flex items-center gap-3 rounded-[20px] bg-surface p-2">
                      <Link href={`/coffee/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <BagPhoto blob={c.photo} alt="" className="aspect-[4/5] w-12 shrink-0 rounded-xl" iconSize={18} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{c.name}</div>
                          <div className="truncate text-sm text-muted">{c.roaster}</div>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => motion.finish(c, 420)}
                        className={`btn min-h-11 shrink-0 border ${leaving ? 'border-accent bg-accent text-on-accent' : 'border-line text-ink hover:bg-tint'}`}
                        aria-label={`Finish ${c.name}`}
                      >
                        {leaving ? (
                          <>
                            <Check width={16} height={16} /> Finished
                          </>
                        ) : (
                          'Finish'
                        )}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <ul id="proto-shelf-row" className={shelfRowClass}>
              {shelf.map((c, i) => {
                const leaving = motion.leaving.has(c.id)
                const arriving = motion.arriving.has(c.id)
                return (
                  <li
                    key={c.id}
                    data-shelf-card={c.id}
                    className={`${shelfItemClass} ${leaving ? 'proto-shelf-fold' : arriving ? 'proto-shelf-arrive' : 'rise'}`}
                    style={{ '--i': i } as CSSProperties}
                  >
                    <Link href={`/coffee/${c.id}`} className="group block">
                      <ShelfCardBody coffee={c} brews={brewsOf(c.id)} glow={arriving} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function FinishedC({ finished, brewsOf, motion, showFinished, setShowFinished }: VariantData) {
  if (finished.length === 0) return null
  // Restocking scrolls you up to the shelf so you watch the coffee land at the front of the row.
  const showOnShelf = () => {
    document.getElementById('proto-shelf')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
    document.getElementById('proto-shelf-row')?.scrollTo({ left: 0, behavior: 'smooth' })
  }
  return (
    <section className="mt-10">
      <FinishedHeading count={finished.length} open={showFinished} onToggle={() => setShowFinished(!showFinished)} pulse={motion.pulse} />
      {showFinished && (
        <ul className="mt-2 space-y-2">
          {finished.map((c) => (
            <li key={c.id} className={`proto-row ${motion.leaving.has(c.id) ? 'proto-row-out' : motion.arriving.has(c.id) ? 'proto-row-in' : ''}`}>
              <div className={`flex items-center gap-3 rounded-[20px] p-2 hover:bg-surface ${motion.arriving.has(c.id) ? 'proto-glow' : ''}`}>
                <Link href={`/coffee/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <BagPhoto blob={c.photo} alt="" className="aspect-[4/5] w-10 shrink-0 rounded-xl opacity-60 grayscale" iconSize={16} />
                  <div className="min-w-0">
                    <div className="truncate">{c.name}</div>
                    <div className="text-[13px]">
                      <SettingsLine brews={brewsOf(c.id)} />
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => motion.restock(c, 380, showOnShelf)}
                  className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent-fg hover:bg-tint"
                  aria-label={`Bought ${c.name} again`}
                >
                  <Plus width={16} height={16} /> Bought it again
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
