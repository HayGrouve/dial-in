// PROTOTYPE, throwaway (#12): how and when the returning-coffee offer appears in New coffee.
// Three variants on the existing /coffee/new route, switchable via `?variant=A|B|C`:
//   A  Live inline: a panel under Roaster as soon as roaster + name match (typing or scan).
//   B  Welcome-back sheet: a bottom sheet right after a scan, or once you leave the name/roaster fields.
//   C  Check on save: nothing while editing; "Add coffee" opens a review step with the match(es).
// Use the "Scan: finished / shelf / several / none" chips in the top bar to simulate a label scan without a Gemini key.
// Lives only on the `prototype/returning-coffee-offer` branch; never merge.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { BagScanner } from '../components/BagScanner'
import { Back, Check, Close, Pin } from '../components/icons'
import { PrototypeSwitcher, type PrototypeAction } from '../components/PrototypeSwitcher'
import { BagPhoto, Field, Header, Rating, Section, Segmented, TagInput } from '../components/ui'
import { useLeaveGuard } from '../lib/a11y'
import { db, newId, PROCESSES, ROAST_LEVELS, type Brew, type Coffee } from '../lib/db'
import { ago, fakeBagPhoto, fillPlan, matchKey, restock, SCAN_PRESETS, settingLine, useMatches, type Draft, type FillPlan, type Match } from '../lib/match.prototype'
import { dotted, formatTime, METHODS, ratio } from '../lib/methods'
import type { ScannedFields } from '../lib/scan'
import './CoffeeForm.prototype.css'

export const PROTO_VARIANTS = [
  { key: 'A', name: 'Live inline' },
  { key: 'B', name: 'Welcome-back sheet' },
  { key: 'C', name: 'Check on save' },
] as const

type VariantKey = (typeof PROTO_VARIANTS)[number]['key']

const empty: Draft = { name: '', roaster: '', tastingNotes: [], finished: false }

/** Simulated label scans for the switcher bar: a stand-in front photo, then the scanned fields. */
export function scanActions(onPhoto: (b: Blob) => void, onScan: (f: ScannedFields) => void): PrototypeAction[] {
  return SCAN_PRESETS.map((p) => ({
    label: p.label,
    onClick: () =>
      void fakeBagPhoto(p).then((photo) => {
        onPhoto(photo)
        onScan(p.fields)
      }),
  }))
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

export default function CoffeeFormPrototype({ variant }: { variant: VariantKey }) {
  const [, navigate] = useLocation()
  const [draft, setDraft] = useState<Draft>(empty)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const guard = useLeaveGuard(dirty && !saving)
  const roasters = useLiveQuery(async () => [...new Set((await db.coffees.toArray()).map((c) => c.roaster))].sort(), [])

  // Which key the user waved off with "Add as new anyway"; a different match offers again.
  const [dismissed, setDismissed] = useState('')
  const source = useRef<'typing' | 'scan'>('typing')
  const [sheet, setSheet] = useState(false)
  const [sheetShownFor, setSheetShownFor] = useState('')
  const [blurTick, setBlurTick] = useState(0)
  const [step, setStep] = useState<'form' | 'review'>('form')

  const key = matchKey(draft.name, draft.roaster)
  // A shows live while typing, so it waits for a pause; B and C read the current key.
  const settledKey = useDebounced(key, 450)
  const offerKey = variant === 'A' ? settledKey : key
  const matches = useMatches(offerKey) ?? []
  const offered = matches.length > 0 && dismissed !== offerKey

  const set = <K extends keyof Draft>(k: K, value: Draft[K]) => {
    setDirty(true)
    setDraft((d) => ({ ...d, [k]: value }))
  }
  const text = (k: keyof Draft) => ({
    name: k,
    autoComplete: 'off',
    value: (draft[k] as string | undefined) ?? '',
    onChange: (e: { target: { value: string } }) => set(k, (e.target.value || undefined) as never),
  })

  // Label details only fill fields that are still empty, so nothing typed by hand is overwritten.
  const applyScan = (fields: ScannedFields) => {
    source.current = 'scan'
    setDirty(true)
    setDraft((d) => {
      const next = { ...d }
      for (const [k, value] of Object.entries(fields) as [keyof ScannedFields, ScannedFields[keyof ScannedFields]][]) {
        const current = d[k]
        const isEmpty = Array.isArray(current) ? current.length === 0 : current == null || current === ''
        if (isEmpty && value != null && !(Array.isArray(value) && value.length === 0)) next[k] = value as never
      }
      return next
    })
  }

  // B: interrupt right after a scan, or once focus leaves both name and roaster, never mid-word.
  useEffect(() => {
    if (variant !== 'B' || !offered || sheetShownFor === key) return
    const typing = document.activeElement?.matches('input[name=coffeeName], input[name=roaster]')
    if (source.current === 'scan' || !typing) {
      setSheetShownFor(key)
      setSheet(true)
    }
  }, [variant, offered, key, sheetShownFor, blurTick])

  const addNew = async () => {
    setSaving(true)
    const now = Date.now()
    const coffee: Coffee = { ...draft, id: newId(), createdAt: now, updatedAt: now }
    await db.coffees.add(coffee)
    navigate(`/coffee/${coffee.id}`, { replace: true })
  }
  const accept = async (m: Match) => {
    setSaving(true)
    if (m.coffee.finished) await restock(m.coffee, draft)
    navigate(`/coffee/${m.coffee.id}`, { replace: true })
  }
  const addAnyway = () => {
    setDismissed(offerKey)
    setSheet(false)
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (variant === 'C' && offered) {
      setStep('review')
      window.scrollTo(0, 0)
      return
    }
    void addNew()
  }

  const reset = () => {
    setDraft(empty)
    setDirty(false)
    setDismissed('')
    setSheet(false)
    setSheetShownFor('')
    setStep('form')
    source.current = 'typing'
  }

  const switcher = (
    <PrototypeSwitcher
      variants={[...PROTO_VARIANTS]}
      state={matches.length ? `${matches.length} match${matches.length > 1 ? 'es' : ''}${dismissed === offerKey ? ', dismissed' : ''}` : 'no match'}
      actions={[...scanActions((p) => set('photo', p), applyScan), { label: 'reset', onClick: reset }]}
      actionsLabel="Scan:"
    />
  )

  if (variant === 'C' && step === 'review' && offered) {
    return (
      <>
        <ReviewStep matches={matches} draft={draft} saving={saving} onBack={() => setStep('form')} onAccept={accept} onAddNew={() => void addNew()} />
        {switcher}
      </>
    )
  }

  const origin = dotted(draft.origin, draft.region, draft.process, draft.varietal, draft.producer, draft.altitude)
  const roast = dotted(draft.roastLevel && `${draft.roastLevel} roast`, draft.bagWeight && `${draft.bagWeight}g`)
  const typed = (k: 'name' | 'roaster', v: string) => {
    source.current = 'typing'
    set(k, v)
  }

  return (
    <form onSubmit={save} className="pb-8">
      <Header title="New coffee" back="/" onBack={guard} />

      <div className="space-y-4">
        <BagScanner front={draft.photo} onFront={(photo) => set('photo', photo)} onScanned={applyScan} onLeave={guard} />

        <Section title="The essentials" hint="Enough to find it again">
          <Field label="Coffee name *">
            <input
              className="input"
              name="coffeeName"
              autoComplete="off"
              required
              placeholder="e.g. Ethiopia Guji Hambela…"
              value={draft.name}
              onChange={(e) => typed('name', e.target.value)}
              onBlur={() => setBlurTick((t) => t + 1)}
            />
          </Field>
          <Field label="Roaster *">
            <input
              className="input"
              name="roaster"
              autoComplete="off"
              required
              list="roasters"
              placeholder="e.g. Onyx Coffee Lab…"
              value={draft.roaster}
              onChange={(e) => typed('roaster', e.target.value)}
              onBlur={() => setBlurTick((t) => t + 1)}
            />
            <datalist id="roasters">{roasters?.map((r) => <option key={r} value={r} />)}</datalist>
          </Field>
          {variant === 'A' && matches.length > 0 && (
            <InlineOffer
              key={offerKey}
              matches={matches}
              draft={draft}
              dismissed={!offered}
              saving={saving}
              onAccept={accept}
              onAddNew={addAnyway}
              onShow={() => setDismissed('')}
            />
          )}
          <Field label="Tasting notes" group>
            <TagInput label="Tasting notes" value={draft.tastingNotes} onChange={(v) => set('tastingNotes', v)} placeholder="blueberry, jasmine, cocoa…" />
          </Field>
          <Field label="Your rating" group>
            <Rating value={draft.rating} onChange={(v) => set('rating', v)} size={28} />
          </Field>
        </Section>

        <Section title="Origin" summary={origin || 'Country, process, varietal — from the label'} collapsible defaultOpen={false}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country">
              <input className="input" placeholder="Ethiopia" {...text('origin')} />
            </Field>
            <Field label="Region">
              <input className="input" placeholder="Guji" {...text('region')} />
            </Field>
            <Field label="Process">
              <input className="input" list="processes" placeholder="Washed" {...text('process')} />
              <datalist id="processes">{PROCESSES.map((p) => <option key={p} value={p} />)}</datalist>
            </Field>
            <Field label="Varietal">
              <input className="input" placeholder="Heirloom" {...text('varietal')} />
            </Field>
            <Field label="Producer / farm">
              <input className="input" placeholder="Washing station" {...text('producer')} />
            </Field>
            <Field label="Altitude">
              <input className="input" placeholder="1900–2100 masl" {...text('altitude')} />
            </Field>
          </div>
        </Section>

        <Section title="Roast" summary={roast || 'Level and bag size'} collapsible defaultOpen={false}>
          <Field label="Roast level" group>
            <Segmented
              value={draft.roastLevel}
              onChange={(v) => set('roastLevel', draft.roastLevel === v ? undefined : v)}
              options={ROAST_LEVELS.map((r) => ({ value: r, label: r }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bag size (g)">
              <input
                className="input num"
                name="bagWeight"
                autoComplete="off"
                type="number"
                inputMode="numeric"
                placeholder="250"
                value={draft.bagWeight ?? ''}
                onChange={(e) => set('bagWeight', e.target.value ? Number(e.target.value) : undefined)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Notes" summary={draft.notes || 'Where you bought it, price, what to try next'} collapsible defaultOpen={false}>
          <textarea className="input min-h-24" aria-label="Notes" placeholder="Where you bought it, price, what to try next…" {...text('notes')} />
        </Section>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-canvas from-60% px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {variant === 'B' && offered && !sheet && (
          <button type="button" onClick={() => setSheet(true)} className="mb-2 flex w-full items-center gap-3 rounded-full bg-surface py-1.5 pr-4 pl-1.5 text-left text-sm shadow-sm ring-1 ring-line">
            <BagPhoto blob={matches[0].coffee.photo} className="h-9 w-9 shrink-0 rounded-full" iconSize={16} />
            <span className="min-w-0 flex-1 truncate">
              {matches.length > 1 ? `${matches.length} coffees match this name` : matches[0].coffee.finished ? `You’ve had ${matches[0].coffee.name}` : `${matches[0].coffee.name} is on your shelf`}
            </span>
            <span className="shrink-0 font-semibold text-accent-fg">Review</span>
          </button>
        )}
        <button type="submit" disabled={saving} className="btn-primary w-full !py-3.5">
          Add coffee
        </button>
      </div>

      {variant === 'B' && sheet && offered && (
        <WelcomeSheet matches={matches} draft={draft} saving={saving} onAccept={accept} onAddNew={addAnyway} onClose={() => setSheet(false)} />
      )}
      {switcher}
    </form>
  )
}

// ---------- shared bits ----------

function stateLine(c: Coffee) {
  return c.finished ? `Finished ${ago(c.updatedAt)}` : `On your shelf, last touched ${ago(c.updatedAt)}`
}

/** One plain sentence about what accepting a restock does to the existing coffee. */
function planSentence(plan: FillPlan, brews: Brew[]) {
  const parts: string[] = []
  if (plan.photo === 'replace') parts.push('Your new photo replaces the bag photo.')
  if (plan.photo === 'add') parts.push('Your new photo becomes the bag photo.')
  if (plan.filled.length) parts.push(`Fills in ${list(plan.filled.map((f) => f.label.toLowerCase()))}.`)
  if (plan.kept.length) parts.push(`Keeps its own ${list(plan.kept.map((f) => f.label.toLowerCase()))}.`)
  parts.push(brews.length ? `Your ${brews.length} ${brews.length === 1 ? 'brew comes' : 'brews come'} with it.` : 'No brews logged on it yet.')
  return parts.join(' ')
}
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

function SettingInline({ setting, big, short }: { setting: Match['setting']; big?: boolean; short?: boolean }) {
  if (!setting) return <p className="text-sm text-muted">No brews logged.</p>
  const { brew, provisional } = setting
  return (
    <p className="flex items-baseline gap-2">
      <span className={`shrink-0 font-mono font-semibold tracking-tight ${provisional ? 'text-muted' : 'text-accent-fg'} ${big ? 'text-3xl' : 'text-xl'}`}>{brew.grindSetting}</span>
      <span className="min-w-0 text-sm leading-snug text-muted">
        {!provisional && <Pin width={13} height={13} className="mr-1 inline -translate-y-px text-accent-fg" />}
        {provisional ? `Still dialing, ${METHODS[brew.method].label.toLowerCase()}` : short ? [METHODS[brew.method].label, brew.grinder].filter(Boolean).join(', ') : settingLine(brew)}
      </span>
    </p>
  )
}

const actionLabel = (m: Match) => (m.coffee.finished ? 'Bought it again' : 'Open it')

// ---------- Variant A: live inline panel under the roaster field ----------

function InlineOffer({
  matches,
  draft,
  dismissed,
  saving,
  onAccept,
  onAddNew,
  onShow,
}: {
  matches: Match[]
  draft: Draft
  dismissed: boolean
  saving: boolean
  onAccept: (m: Match) => void
  onAddNew: () => void
  onShow: () => void
}) {
  if (dismissed) {
    return (
      <p className="-mt-1 text-sm text-muted" aria-live="polite">
        Adding as a separate coffee.{' '}
        <button type="button" onClick={onShow} className="font-semibold text-accent-fg underline">
          Show the match
        </button>
      </p>
    )
  }

  const one = matches.length === 1 ? matches[0] : undefined
  return (
    <div className="rise rounded-[20px] bg-tint p-3" role="region" aria-label="Matching coffee" aria-live="polite">
      {one ? (
        <>
          <div className="flex gap-3">
            <BagPhoto blob={one.coffee.photo} className="h-[76px] w-[60px] shrink-0 rounded-xl" iconSize={22} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{one.coffee.finished ? 'You’ve had this one before' : 'You already have this'}</p>
              <p className="truncate text-sm text-muted">{stateLine(one.coffee)}</p>
              <div className="mt-1">
                <SettingInline setting={one.setting} />
              </div>
            </div>
          </div>
          {one.coffee.finished && <p className="mt-2 text-xs leading-relaxed text-muted">{planSentence(fillPlan(one.coffee, draft), one.brews)}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button type="button" disabled={saving} onClick={() => onAccept(one)} className="btn-primary !py-2">
              {actionLabel(one)}
            </button>
            <button type="button" onClick={onAddNew} className="text-sm font-medium text-muted underline hover:text-ink">
              Add as new anyway
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="px-1 text-[15px] font-semibold">You have {matches.length} coffees with this name</p>
          <p className="px-1 text-sm text-muted">Newest first. Pick the one this bag belongs to.</p>
          <ul className="mt-2 divide-y divide-line">
            {matches.map((m) => (
              <li key={m.coffee.id} className="flex items-start gap-3 px-1 py-3">
                <BagPhoto blob={m.coffee.photo} className="h-[60px] w-12 shrink-0 rounded-lg" iconSize={16} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{stateLine(m.coffee)}</p>
                  <SettingInline setting={m.setting} short />
                  <button type="button" disabled={saving} onClick={() => onAccept(m)} className={`${m.coffee.finished ? 'btn-primary' : 'btn-ghost'} mt-2 !px-4 !py-2`}>
                    {actionLabel(m)}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onAddNew} className="mt-1 px-1 text-sm font-medium text-muted underline hover:text-ink">
            Add as new anyway
          </button>
        </>
      )}
    </div>
  )
}

// ---------- Variant B: "Welcome back" bottom sheet ----------

function WelcomeSheet({
  matches,
  draft,
  saving,
  onAccept,
  onAddNew,
  onClose,
}: {
  matches: Match[]
  draft: Draft
  saving: boolean
  onAccept: (m: Match) => void
  onAddNew: () => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState(0)
  const m = matches[Math.min(picked, matches.length - 1)]
  const primary = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    primary.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [onClose])

  const several = matches.length > 1
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button type="button" aria-label="Not now" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-in relative max-h-[88dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-surface px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
        <button type="button" onClick={onClose} className="absolute top-3 right-3 rounded-full p-2 text-muted hover:bg-tint hover:text-ink" aria-label="Not now">
          <Close width={18} height={18} />
        </button>

        <div className="flex items-end gap-4 pr-8">
          <BagPhoto blob={m.coffee.photo} className="h-[104px] w-[84px] shrink-0 rounded-[18px]" iconSize={28} />
          <div className="min-w-0 pb-1">
            <p className="text-sm text-muted">{m.coffee.finished ? 'Welcome back,' : 'You already have'}</p>
            <h2 id={titleId} className="text-[28px] leading-[1.05] font-semibold tracking-[-0.02em] break-words">
              {m.coffee.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {m.coffee.roaster}, {m.coffee.finished ? `finished ${ago(m.coffee.updatedAt)}` : 'on your shelf'}
            </p>
          </div>
        </div>

        {several && <p className="mt-4 text-sm text-muted">You have {matches.length} coffees with this name, newest first. Which one is this bag?</p>}
        {several && (
          <div role="radiogroup" aria-label="Which one" className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
            {matches.map((x, i) => (
              <button
                key={x.coffee.id}
                type="button"
                role="radio"
                aria-checked={i === picked}
                onClick={() => setPicked(i)}
                className={`shrink-0 rounded-2xl border px-3 py-2 text-left text-sm transition ${i === picked ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:bg-tint'}`}
              >
                <span className="block font-medium">{x.coffee.finished ? `Finished ${ago(x.coffee.updatedAt)}` : 'On your shelf'}</span>
                <span className="block font-mono text-xs opacity-80">
                  {x.setting ? `${x.setting.brew.grindSetting} ${METHODS[x.setting.brew.method].label.toLowerCase()}` : 'no brews'}
                </span>
              </button>
            ))}
          </div>
        )}

        <SettingHero setting={m.setting} />

        {m.coffee.finished ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">{planSentence(fillPlan(m.coffee, draft), m.brews)}</p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">Opening it leaves this form. Nothing you scanned or typed here is saved.</p>
        )}

        <div className="mt-5 space-y-2">
          <button ref={primary} type="button" disabled={saving} onClick={() => onAccept(m)} className="btn-primary w-full !py-4 !text-base">
            {m.coffee.finished && <Check width={18} height={18} />} {actionLabel(m)}
          </button>
          <button type="button" onClick={onAddNew} className="btn-ghost w-full !py-3.5">
            Add as new anyway
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingHero({ setting }: { setting: Match['setting'] }) {
  if (!setting) return <p className="mt-5 rounded-[20px] bg-canvas p-5 text-sm text-muted">No brews logged on it, so there’s no setting to come back to.</p>
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
      <div className={`mt-1 font-mono text-[84px] leading-none font-semibold tracking-[-0.07em] ${provisional ? 'text-muted' : 'text-accent-fg'}`}>{brew.grindSetting}</div>
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

// ---------- Variant C: review step on Save ----------

function ReviewStep({
  matches,
  draft,
  saving,
  onBack,
  onAccept,
  onAddNew,
}: {
  matches: Match[]
  draft: Draft
  saving: boolean
  onBack: () => void
  onAccept: (m: Match) => void
  onAddNew: () => void
}) {
  const [picked, setPicked] = useState(0)
  const m = matches[Math.min(picked, matches.length - 1)]
  const several = matches.length > 1
  const plan = fillPlan(m.coffee, draft)
  const pinned = m.setting && !m.setting.provisional ? m.setting.brew : undefined

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col">
      <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 bg-canvas/85 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
        <button type="button" onClick={onBack} className="-ml-2 rounded-full p-2 text-muted hover:text-ink" aria-label="Back to the form">
          <Back />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">Before you add it</h1>
      </header>

      {/* Prototype only: room for the floating switcher, so it doesn't cover the headline. */}
      <div className="h-14" aria-hidden />
      <div className="rise">
        <h2 className="text-[30px] leading-[1.05] font-semibold tracking-[-0.02em]">
          {several ? `You have ${matches.length} coffees called ${m.coffee.name}` : m.coffee.finished ? 'You’ve had this coffee before' : 'This one is already on your shelf'}
        </h2>
        <p className="mt-2 text-muted">
          {several
            ? 'Newest first. Pick the one this bag belongs to, or keep it separate.'
            : m.coffee.finished
              ? 'Put it back on the shelf with its brews and setting, or keep this bag as a separate coffee.'
              : 'Open the one you have, or keep this bag as a separate coffee.'}
        </p>
      </div>

      <div role={several ? 'radiogroup' : undefined} aria-label={several ? 'Matching coffees' : undefined} className="mt-6 space-y-2">
        {matches.map((x, i) => {
          const on = i === picked
          const body = (
            <>
              <BagPhoto blob={x.coffee.photo} className="h-[84px] w-[68px] shrink-0 rounded-[16px]" iconSize={22} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{x.coffee.name}</p>
                <p className="text-sm text-muted">
                  {x.coffee.roaster}, {stateLine(x.coffee).toLowerCase()}
                </p>
                <div className="mt-1">
                  <SettingInline setting={x.setting} />
                </div>
              </div>
            </>
          )
          return several ? (
            <button
              key={x.coffee.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(i)}
              className={`card flex w-full items-center gap-3 p-3 text-left ring-2 transition ${on ? 'ring-accent' : 'ring-transparent hover:ring-line'}`}
            >
              {body}
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-accent bg-accent text-on-accent' : 'border-line'}`} aria-hidden>
                {on && <Check width={14} height={14} />}
              </span>
            </button>
          ) : (
            <div key={x.coffee.id} className="card flex items-center gap-3 p-3">
              {body}
            </div>
          )
        })}
      </div>

      {m.coffee.finished ? (
        <section className="mt-8">
          <h3 className="mb-3 text-xl font-semibold tracking-tight">What Bought it again does</h3>
          <dl className="card divide-y divide-line px-4">
            <Row term="Back on your shelf" desc={`${m.brews.length} ${m.brews.length === 1 ? 'brew' : 'brews'}${pinned ? `, pinned ${METHODS[pinned.method].label.toLowerCase()} at ${pinned.grindSetting}` : ''}`} />
            {plan.photo !== 'none' && <Row term="Bag photo" desc={plan.photo === 'replace' ? 'Replaced by the one you just took' : 'The one you just took'} />}
            {plan.filled.length > 0 && (
              <Row
                term="Filled in, were empty"
                desc={
                  <ul className="space-y-0.5">
                    {plan.filled.map((f) => (
                      <li key={f.label}>
                        <span className="text-muted">{f.label}:</span> {f.value}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
            {plan.kept.length > 0 && (
              <Row
                term="Kept as it was"
                desc={
                  <ul className="space-y-1">
                    {plan.kept.map((f) => (
                      <li key={f.label}>
                        <span className="text-muted">{f.label}:</span> {f.value}
                        <span className="block text-xs text-muted">The label says {f.ignored}. Edit it by hand if that’s right.</span>
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
          </dl>
        </section>
      ) : (
        <p className="card mt-8 p-4 text-sm text-muted">Opening it leaves this form. Nothing you typed or scanned here is saved.</p>
      )}

      <div className="sticky bottom-0 -mx-4 mt-auto space-y-2 bg-gradient-to-t from-canvas from-70% px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <button type="button" onClick={onAddNew} disabled={saving} className="btn-ghost w-full !bg-canvas !py-3">
          Add as new anyway
        </button>
        <button type="button" onClick={() => onAccept(m)} disabled={saving} className="btn-primary w-full !py-3.5">
          {actionLabel(m)}
        </button>
      </div>
    </div>
  )
}

function Row({ term, desc }: { term: string; desc: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-3 text-sm">
      <dt className="font-medium">{term}</dt>
      <dd className="min-w-0 break-words">{desc}</dd>
    </div>
  )
}
