import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, Close, Pin } from './icons'
import { BagPhoto } from './ui'
import { arrowKeys } from '../lib/a11y'
import { db, type Brew, type Coffee } from '../lib/db'
import { restockPlan } from '../lib/match'
import { formatTime, METHODS, ratio, settingsFor } from '../lib/methods'

type Setting = ReturnType<typeof settingsFor>[number]

interface Props {
  /** Coffees with the same roaster and name, newest first. */
  matches: Coffee[]
  /** What was scanned or typed on New coffee. */
  draft: Partial<Coffee>
  busy: boolean
  onRestock: (coffee: Coffee) => void
  onOpen: (coffee: Coffee) => void
  onAddNew: () => void
  onClose: () => void
}

/**
 * The returning-coffee offer on New coffee: restock the finished coffee (Bought it again) or open
 * the one already on the shelf, instead of adding a duplicate. Waits for the brews so the setting
 * doesn't pop in after the sheet opens.
 */
export function WelcomeBackSheet(props: Props) {
  const ids = props.matches.map((c) => c.id)
  const brews = useLiveQuery(() => db.brews.where('coffeeId').anyOf(ids).reverse().sortBy('createdAt'), [ids.join()])
  if (!brews) return null
  return <Sheet {...props} brews={brews} />
}

function Sheet({ matches, draft, busy, brews, onRestock, onOpen, onAddNew, onClose }: Props & { brews: Brew[] }) {
  const [pickedId, setPickedId] = useState(matches[0].id)
  const coffee = matches.find((c) => c.id === pickedId) ?? matches[0]
  const dialog = useRef<HTMLDivElement>(null)
  const leadId = useId()
  const nameId = useId()
  const whichId = useId()

  const brewsOf = (c: Coffee) => brews.filter((b) => b.coffeeId === c.id)
  const settingOf = (c: Coffee) => {
    const settings = settingsFor(brewsOf(c))
    return settings.find((s) => !s.provisional) ?? settings[0]
  }

  // Modal: focus the sheet, lock page scroll, and hand focus back on the way out.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Tab cycles through the sheet's controls only.
  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"])')]
    const first = items[0]
    const last = items[items.length - 1]
    const at = document.activeElement
    if (e.shiftKey && (at === first || at === e.currentTarget)) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && at === last) {
      e.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 starting:opacity-0" />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${leadId} ${nameId}`}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="relative max-h-[88dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-surface px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-12px_40px_-12px_rgb(6_14_11/0.5)] outline-none transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] starting:opacity-0 motion-safe:starting:translate-y-1/3"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
        <button type="button" onClick={onClose} className="absolute top-3 right-3 rounded-full p-2 text-muted hover:bg-tint hover:text-ink" aria-label="Not now">
          <Close width={18} height={18} />
        </button>

        <div className="flex items-end gap-4 pr-8">
          <BagPhoto blob={coffee.photo} alt={`Bag of ${coffee.name}`} className="h-[104px] w-[84px] shrink-0 rounded-[20px]" iconSize={28} />
          <div className="min-w-0 pb-1">
            <p id={leadId} className="text-sm text-muted">
              {coffee.finished ? 'Welcome back' : 'You already have this'}
            </p>
            <h2 id={nameId} className="text-[28px] leading-[1.05] font-semibold tracking-[-0.02em] break-words">
              {coffee.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {coffee.roaster}, {coffee.finished ? `finished ${ago(coffee.updatedAt)}` : 'on your shelf'}
            </p>
          </div>
        </div>

        {matches.length > 1 && (
          <div className="mt-5">
            <p id={whichId} className="text-sm text-muted">
              You have {matches.length} coffees with this name. Which one is this bag?
            </p>
            <div role="radiogroup" aria-labelledby={whichId} onKeyDown={arrowKeys} className="-mx-5 mt-1 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none]">
              {matches.map((c) => {
                const on = c.id === coffee.id
                const s = settingOf(c)
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setPickedId(c.id)}
                    className={`shrink-0 rounded-2xl border px-3.5 py-2 text-left text-sm transition ${on ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:bg-tint hover:text-ink'}`}
                  >
                    <span className="block font-medium">{c.finished ? `Finished ${ago(c.updatedAt)}` : 'On your shelf'}</span>
                    <span className="block text-xs opacity-80">
                      {s ? (
                        <>
                          <span className="font-mono">{s.brew.grindSetting}</span> {METHODS[s.brew.method].label.toLowerCase()}
                        </>
                      ) : (
                        'No brews yet'
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <SettingHero setting={settingOf(coffee)} />

        <p className="mt-3 text-sm leading-relaxed text-muted">{summary(coffee, draft, brewsOf(coffee).length)}</p>

        <div className="mt-5 space-y-2">
          <button type="button" disabled={busy} onClick={() => (coffee.finished ? onRestock(coffee) : onOpen(coffee))} className="btn-primary w-full !py-4 !text-base">
            {coffee.finished ? (
              <>
                <Check width={18} height={18} /> Bought it again
              </>
            ) : (
              'Open it'
            )}
          </button>
          <button type="button" disabled={busy} onClick={onAddNew} className="btn-ghost w-full !py-3.5">
            Add as new anyway
          </button>
        </div>
      </div>
    </div>
  )
}

/** The setting to come back to, large, with the recipe around it. */
function SettingHero({ setting }: { setting?: Setting }) {
  if (!setting) return <p className="mt-5 rounded-[20px] bg-canvas p-5 text-sm text-muted">No brews logged on it yet, so there’s no setting to come back to.</p>
  const { brew, provisional } = setting
  const m = METHODS[brew.method]
  const stats = [
    ['Dose', brew.dose != null && `${brew.dose}g`],
    [m.isEspresso ? 'Out' : 'Water', brew.yield != null && `${brew.yield}g`],
    ['Ratio', ratio(brew.dose, brew.yield)],
    ['Time', formatTime(brew.timeSec)],
  ] as const
  return (
    <div className="mt-5 rounded-[20px] bg-canvas p-5">
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          {!provisional && <Pin width={14} height={14} className="text-accent-fg" />}
          {provisional ? `Still dialing, ${m.label.toLowerCase()}` : `Your ${m.label.toLowerCase()} setting`}
        </span>
        {brew.grinder && <span className="truncate">{brew.grinder}</span>}
      </div>
      <div
        className={`mt-1 font-mono leading-none font-semibold ${provisional ? 'text-ink' : 'text-accent-fg'} ${
          brew.grindSetting.length > 6 ? 'text-5xl tracking-tight' : 'text-[84px] tracking-[-0.07em]'
        }`}
      >
        {brew.grindSetting || '—'}
      </div>
      <dl className="mt-4 grid grid-cols-4 gap-2">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-0.5 font-mono text-[15px] font-medium">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** The pill left above Add coffee after Not now; reopens the sheet. */
export function ReviewPill({ matches, onClick }: { matches: Coffee[]; onClick: () => void }) {
  const [first] = matches
  return (
    <button type="button" onClick={onClick} className="mb-2 flex w-full items-center gap-3 rounded-full bg-surface py-1.5 pr-4 pl-1.5 text-left text-sm ring-1 ring-line transition hover:bg-tint">
      <BagPhoto blob={first.photo} alt="" className="h-9 w-9 shrink-0 rounded-full" iconSize={16} />
      <span className="min-w-0 flex-1 truncate">
        {matches.length > 1 ? `${matches.length} coffees match this one` : first.finished ? `You’ve had ${first.name} before` : `${first.name} is on your shelf`}
      </span>
      <span className="shrink-0 font-semibold text-accent-fg">Review</span>
    </button>
  )
}

/** One line on what accepting does, so nothing about a restock is a surprise. */
function summary(coffee: Coffee, draft: Partial<Coffee>, brews: number) {
  if (!coffee.finished) return 'Opening it leaves this form. Nothing you scanned or typed here is saved.'
  const { filled, kept } = restockPlan(coffee, draft)
  const line = [
    draft.photo && 'Your new photo becomes the bag photo.',
    filled.length > 0 && `Fills in ${list(filled)}.`,
    kept.length > 0 && `Keeps its own ${list(kept)}.`,
    brews > 0 && `Your ${brews} ${brews === 1 ? 'brew comes' : 'brews come'} with it.`,
  ]
    .filter(Boolean)
    .join(' ')
  return line || 'It goes back on your shelf as it was.'
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** "today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago". */
function ago(t: number) {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  if (days < 730) return `${Math.round(days / 30.4)} months ago`
  return `${Math.round(days / 365)} years ago`
}
