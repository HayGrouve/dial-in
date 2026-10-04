import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams, useSearch } from 'wouter'
import { MethodPicker } from '../components/MethodPicker'
import { OpusDial } from '../components/OpusDial'
import { Field, Header, Section, Segmented, Toggle } from '../components/ui'
import { useLeaveGuard } from '../lib/a11y'
import { db, newId, setDialedIn, type Brew, type BrewMethod, type Taste } from '../lib/db'
import { dotted, METHODS, ratio, TASTES } from '../lib/methods'
import { getGrinder, getOpusDial } from '../lib/prefs'

type Draft = Omit<Brew, 'id' | 'coffeeId' | 'createdAt'>

const blank = (method: BrewMethod): Draft => ({ method, grindSetting: '', preinfusion: false, dialedIn: false })

/**
 * Starting values for a new brew: the previous attempt on this coffee if there is one,
 * otherwise the equipment-side settings from the last coffee brewed this way.
 */
async function prefill(coffeeId: string, method: BrewMethod): Promise<{ draft: Draft; hint?: string }> {
  const recent = await db.brews.where('method').equals(method).reverse().sortBy('createdAt')
  const same = recent.find((b) => b.coffeeId === coffeeId)
  if (same) {
    const { grindSetting, dose, yield: y, timeSec, preinfusion, preinfusionSec, temperature, bloomSec } = same
    return { draft: { ...blank(method), grindSetting, dose, yield: y, timeSec, preinfusion, preinfusionSec, temperature, bloomSec } }
  }
  const other = recent[0]
  if (other) {
    const { dose, yield: y, preinfusion, preinfusionSec, temperature, bloomSec } = other
    return { draft: { ...blank(method), dose, yield: y, preinfusion, preinfusionSec, temperature, bloomSec }, hint: other.grindSetting }
  }
  return { draft: blank(method) }
}

export default function BrewForm() {
  const { id: coffeeId, brewId } = useParams<{ id: string; brewId?: string }>()
  const [, navigate] = useLocation()
  // "Log an espresso" on the coffee page opens the form on that method.
  const asked = new URLSearchParams(useSearch()).get('method')
  const startMethod = asked && asked in METHODS ? (asked as BrewMethod) : undefined
  const coffee = useLiveQuery(() => db.coffees.get(coffeeId), [coffeeId])
  const grinder = getGrinder()
  const opusDial = getOpusDial()
  const [draft, setDraft] = useState<Draft>()
  const [grindHint, setGrindHint] = useState<string>()
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const guard = useLeaveGuard(dirty && !saving)

  useEffect(() => {
    if (brewId) {
      void db.brews.get(brewId).then((b) => b && setDraft(b))
      return
    }
    void (async () => {
      const last = await db.brews.where('coffeeId').equals(coffeeId).reverse().sortBy('createdAt')
      const lastAny = last[0] ?? (await db.brews.orderBy('createdAt').last())
      const p = await prefill(coffeeId, startMethod ?? lastAny?.method ?? 'espresso')
      setDraft(p.draft)
      setGrindHint(p.hint)
    })()
  }, [coffeeId, brewId, startMethod])

  if (!draft || !coffee) return null

  const m = METHODS[draft.method]
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDirty(true)
    setDraft((d) => d && { ...d, [key]: value })
  }
  const num = (key: 'dose' | 'yield' | 'timeSec' | 'preinfusionSec' | 'temperature' | 'bloomSec') => ({
    name: key,
    autoComplete: 'off',
    value: draft[key] ?? '',
    onChange: (e: { target: { value: string } }) => set(key, e.target.value === '' ? undefined : Number(e.target.value)),
    type: 'number',
    inputMode: 'decimal' as const,
    step: 'any',
    className: 'input num',
  })

  const changeMethod = async (method: BrewMethod) => {
    if (brewId) return set('method', method)
    setDirty(true)
    const p = await prefill(coffeeId, method)
    setDraft({ ...p.draft, taste: draft.taste, notes: draft.notes })
    setGrindHint(p.hint)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const brew: Brew = brewId
      ? { ...(draft as Brew) }
      : { ...draft, grinder: grinder || undefined, id: newId(), coffeeId, createdAt: Date.now() }
    await db.brews.put(brew)
    await setDialedIn(brew, brew.dialedIn)
    navigate(`/coffee/${coffeeId}`, { replace: true })
  }

  const remove = async () => {
    if (!brewId || !confirm('Delete this brew?')) return
    await db.brews.delete(brewId)
    navigate(`/coffee/${coffeeId}`, { replace: true })
  }

  const r = ratio(draft.dose, draft.yield)
  const extras = dotted(
    m.isEspresso && draft.preinfusion && `Pre-infusion${draft.preinfusionSec ? ` ${draft.preinfusionSec}s` : ''}`,
    m.hasBloom && draft.bloomSec && `Bloom ${draft.bloomSec}s`,
    draft.temperature && `${draft.temperature}°C`,
  )
  const extrasTitle = m.isEspresso ? 'Pre-infusion & temperature' : m.hasBloom ? 'Bloom & temperature' : 'Temperature'

  return (
    <form onSubmit={save} className="pb-8">
      <Header
        back={`/coffee/${coffeeId}`}
        onBack={guard}
        title={
          <span className="block min-w-0">
            <span className="block truncate">{brewId ? 'Edit brew' : 'Log a brew'}</span>
            <span className="block truncate font-sans text-xs font-normal text-muted">{coffee.name}, {coffee.roaster}</span>
          </span>
        }
      />

      <MethodPicker value={draft.method} onChange={(k) => void changeMethod(k)} />

      <div className="space-y-4">
        <Section
          title="Grind setting"
          hint={
            grinder ? (
              <>On {brewId && draft.grinder ? draft.grinder : grinder}{grindHint && ` · last ${m.label.toLowerCase()} on another coffee: ${grindHint}`}</>
            ) : (
              <>
                <Link href="/settings" onClick={guard} className="font-medium text-accent-fg underline underline-offset-2">Set your grinder</Link> once in Settings
              </>
            )
          }
        >
          <div>
            <input
              className="input num h-20 !py-0 text-center font-mono !text-4xl font-semibold text-accent-fg"
              aria-label="Grind setting"
              name="grindSetting"
              autoComplete="off"
              required
              // Straight to the one field that matters; skipped when the Opus wheel is the input.
              autoFocus={!brewId && !opusDial}
              placeholder={grindHint ?? '15'}
              value={draft.grindSetting}
              onChange={(e) => set('grindSetting', e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted">Any notation — 14, 2.5, 1.5.2, 22 clicks</p>
          </div>
          {opusDial && <OpusDial value={draft.grindSetting} fallback={grindHint} onChange={(v) => set('grindSetting', v)} />}
        </Section>

        <Section title="Recipe" hint={m.isEspresso ? 'Start around 1:2 in 25–30s' : `Start around 1:${m.defaultRatio}`}>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Dose (g)">
              <input {...num('dose')} placeholder="18" />
            </Field>
            <Field label={m.isEspresso ? 'Out (g)' : 'Water (g)'}>
              <input {...num('yield')} placeholder={String(18 * m.defaultRatio)} />
            </Field>
            <Field label="Time (s)">
              <input {...num('timeSec')} placeholder={m.isEspresso ? '28' : '180'} />
            </Field>
          </div>
          <p className="num text-sm text-muted">
            Ratio <span className="font-semibold text-ink">{r ?? '—'}</span>
          </p>
        </Section>

        <Section title={extrasTitle} summary={extras || 'Optional'} collapsible defaultOpen={!!extras}>
          {m.isEspresso && <Toggle checked={draft.preinfusion} onChange={(v) => set('preinfusion', v)} label="Pre-infusion" />}
          <div className="grid grid-cols-2 gap-3">
            {m.isEspresso && draft.preinfusion && (
              <Field label="Pre-infusion (s)">
                <input {...num('preinfusionSec')} placeholder="8" />
              </Field>
            )}
            {m.hasBloom && (
              <Field label="Bloom (s)">
                <input {...num('bloomSec')} placeholder="45" />
              </Field>
            )}
            <Field label="Water temp (°C)">
              <input {...num('temperature')} placeholder={m.isEspresso ? '93' : '96'} />
            </Field>
          </div>
        </Section>

        <Section title="Tasting" hint="How did it come out?">
          <div>
            <Segmented<Taste>
              value={draft.taste}
              onChange={(t) => set('taste', draft.taste === t ? undefined : t)}
              options={[
                { value: 'sour', label: TASTES.sour.label, className: 'border-sour bg-sour text-on-accent' },
                { value: 'balanced', label: TASTES.balanced.label, className: 'border-accent bg-accent text-on-accent' },
                { value: 'bitter', label: TASTES.bitter.label, className: 'border-bitter bg-bitter text-on-accent' },
              ]}
            />
            {draft.taste && <p className="mt-2 text-sm text-muted">{TASTES[draft.taste].hint}</p>}
          </div>
          <Field label="Notes">
            <textarea className="input min-h-16" name="notes" placeholder="Channeling? Milk drink? Next time…" value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
          </Field>
        </Section>

        <div className={`rounded-[28px] border p-4 transition ${draft.dialedIn ? 'border-accent bg-accent/10' : 'border-transparent bg-surface'}`}>
          <Toggle
            checked={draft.dialedIn}
            onChange={(v) => set('dialedIn', v)}
            label={
              <span>
                <span className="block font-semibold">This is the one</span>
                <span className="text-sm text-muted">Pin as your {m.label.toLowerCase()} setting</span>
              </span>
            }
          />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex gap-2 bg-gradient-to-t from-canvas from-60% px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {brewId && (
          <button type="button" className="btn-ghost !text-bitter" onClick={remove}>
            Delete
          </button>
        )}
        <button type="submit" disabled={saving} className="btn-primary flex-1 !py-3.5">
          {brewId ? 'Save' : 'Save brew'}
        </button>
      </div>
    </form>
  )
}
