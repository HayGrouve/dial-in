import { useConvex, useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams, useSearch } from 'wouter'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { MethodPicker } from '../components/MethodPicker'
import { OpusDial } from '../components/OpusDial'
import { Field, Header, Loading, NotFound, Section, Segmented, Toggle } from '../components/ui'
import { useLeaveGuard } from '../lib/a11y'
import { brewFieldsOf, type BrewFields, type BrewMethod, type Taste } from '../lib/db'
import { useEquipment } from '../lib/equipment'
import { dotted, formatTime, METHODS, ratio, TASTES } from '../lib/methods'

type Draft = BrewFields

const blank = (method: BrewMethod): Draft => ({ method, grindSetting: '', preinfusion: false, dialedIn: false })

/**
 * Starting values for a new brew from `brews.prefill`: the previous attempt on this coffee if there
 * is one, otherwise the equipment-side settings from the last coffee brewed this way.
 */
function fromPrefill({ method, same, other }: NonNullable<FunctionReturnType<typeof api.brews.prefill>>): { draft: Draft; hint?: string } {
  if (same) {
    const { grindSetting, dose, yield: y, timeSec, preinfusion, preinfusionSec, temperature, bloomSec } = same
    return { draft: { ...blank(method), grindSetting, dose, yield: y, timeSec, preinfusion, preinfusionSec, temperature, bloomSec } }
  }
  if (other) {
    const { dose, yield: y, preinfusion, preinfusionSec, temperature, bloomSec } = other
    return { draft: { ...blank(method), dose, yield: y, preinfusion, preinfusionSec, temperature, bloomSec }, hint: other.grindSetting }
  }
  return { draft: blank(method) }
}

export default function BrewForm() {
  const { id: coffeeId, brewId } = useParams<{ id: string; brewId?: string }>()
  const [, navigate] = useLocation()
  // "Запиши еспресо" on the coffee page opens the form on that method.
  const asked = new URLSearchParams(useSearch()).get('method')
  const startMethod = asked && asked in METHODS ? (asked as BrewMethod) : undefined
  const convex = useConvex()
  const coffee = useQuery(api.coffees.get, { id: coffeeId })
  const equipment = useEquipment()
  const saveBrew = useMutation(api.brews.save)
  const removeBrew = useMutation(api.brews.remove)
  const [draft, setDraft] = useState<Draft>()
  // Editing: the brew as loaded (null when the id is unknown), for its id and the grinder it was logged on.
  const [editing, setEditing] = useState<{ id: Id<'brews'>; grinder?: string } | null>()
  const [grindHint, setGrindHint] = useState<string>()
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const guard = useLeaveGuard(dirty && !saving)

  // Read once, not live: the form owns the values from here on.
  useEffect(() => {
    let live = true
    if (brewId) {
      void convex.query(api.brews.get, { id: brewId }).then((b) => {
        if (!live) return
        if (!b || b.coffeeId !== coffeeId) return setEditing(null)
        setEditing({ id: b._id, grinder: b.grinder })
        setDraft(brewFieldsOf(b))
      })
    } else {
      void convex.query(api.brews.prefill, { coffeeId, method: startMethod }).then((p) => {
        if (!live || !p) return
        const { draft, hint } = fromPrefill(p)
        setDraft(draft)
        setGrindHint(hint)
      })
    }
    return () => {
      live = false
    }
  }, [convex, coffeeId, brewId, startMethod])

  if (coffee === null || editing === null) return <NotFound />
  if (!draft || !coffee || !equipment) return <Loading />

  const { grinder, opusDial } = equipment
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
    if (editing) return set('method', method)
    setDirty(true)
    const p = await convex.query(api.brews.prefill, { coffeeId, method })
    if (!p) return
    const next = fromPrefill(p)
    setDraft({ ...next.draft, taste: draft.taste, notes: draft.notes })
    setGrindHint(next.hint)
  }

  // The grinder is stamped by Convex on a new brew; an edited brew keeps its own.
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFailed(false)
    try {
      await saveBrew({ ...draft, id: editing?.id, coffeeId: coffee._id })
      navigate(`/coffee/${coffeeId}`, { replace: true })
    } catch {
      setSaving(false)
      setFailed(true)
    }
  }

  const remove = async () => {
    if (!editing || !confirm('Да изтрия това варене?')) return
    setSaving(true)
    await removeBrew({ id: editing.id })
    navigate(`/coffee/${coffeeId}`, { replace: true })
  }

  const r = ratio(draft.dose, draft.yield)
  const extras = dotted(
    m.isEspresso && draft.preinfusion && `Преинфузия${draft.preinfusionSec ? ` ${formatTime(draft.preinfusionSec)}` : ''}`,
    m.hasBloom && draft.bloomSec && `Цъфтеж ${formatTime(draft.bloomSec)}`,
    draft.temperature && `${draft.temperature}°C`,
  )
  const extrasTitle = m.isEspresso ? 'Преинфузия и температура' : m.hasBloom ? 'Цъфтеж и температура' : 'Температура'

  return (
    <form onSubmit={save} className="pb-8">
      <Header
        back={`/coffee/${coffeeId}`}
        onBack={guard}
        title={
          <span className="block min-w-0">
            <span className="block truncate">{brewId ? 'Промени варенето' : 'Запиши варене'}</span>
            <span className="block truncate font-sans text-xs font-normal text-muted">{coffee.name}, {coffee.roaster}</span>
          </span>
        }
      />

      <MethodPicker value={draft.method} onChange={(k) => void changeMethod(k)} />

      <div className="space-y-4">
        <Section
          title="Смилане"
          hint={
            grinder ? (
              <>На {editing?.grinder || grinder}{grindHint && ` · за ${m.noun} на друго кафе: ${grindHint}`}</>
            ) : (
              <>
                <Link href="/settings" onClick={guard} className="font-medium text-accent-fg underline underline-offset-2">Задай мелачката си</Link> веднъж в Настройки
              </>
            )
          }
        >
          <div>
            <input
              className="input num h-20 !py-0 text-center font-mono !text-4xl font-semibold text-accent-fg"
              aria-label="Смилане"
              name="grindSetting"
              autoComplete="off"
              required
              // Straight to the one field that matters; skipped when the Opus wheel is the input.
              autoFocus={!brewId && !opusDial}
              placeholder={grindHint ?? '15'}
              value={draft.grindSetting}
              onChange={(e) => set('grindSetting', e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted">Както го пише мелачката: 14, 2.5, 1.5.2, 22 щраквания</p>
          </div>
          {opusDial && <OpusDial value={draft.grindSetting} fallback={grindHint} onChange={(v) => set('grindSetting', v)} />}
        </Section>

        <Section title="Рецепта" hint={`Започни около 1:${m.defaultRatio}${m.shot ? ` за ${m.shot.range}` : ''}`}>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Доза (г)">
              <input {...num('dose')} placeholder="18" />
            </Field>
            <Field label={m.isEspresso ? 'Напитка (г)' : 'Вода (г)'}>
              <input {...num('yield')} placeholder={String(18 * m.defaultRatio)} />
            </Field>
            <Field label="Време (с)">
              <input {...num('timeSec')} placeholder={String(m.shot?.typical ?? 180)} />
            </Field>
          </div>
          <p className="num text-sm text-muted">
            Съотношение <span className="font-semibold text-ink">{r ?? '·'}</span>
          </p>
        </Section>

        <Section title={extrasTitle} summary={extras || 'По желание'} collapsible defaultOpen={!!extras}>
          {m.isEspresso && <Toggle checked={draft.preinfusion} onChange={(v) => set('preinfusion', v)} label="Преинфузия" />}
          <div className="grid grid-cols-2 gap-3">
            {m.isEspresso && draft.preinfusion && (
              <Field label="Преинфузия (с)">
                <input {...num('preinfusionSec')} placeholder="8" />
              </Field>
            )}
            {m.hasBloom && (
              <Field label="Цъфтеж (с)">
                <input {...num('bloomSec')} placeholder="45" />
              </Field>
            )}
            <Field label="Температура (°C)">
              <input {...num('temperature')} placeholder={m.isEspresso ? '93' : '96'} />
            </Field>
          </div>
        </Section>

        <Section title="Вкус" hint="Как излезе?">
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
          <Field label="Бележки">
            <textarea className="input min-h-16" name="notes" placeholder="Канали? С мляко? Следващия път…" value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
          </Field>
        </Section>

        <div className={`rounded-[28px] border p-4 transition ${draft.dialedIn ? 'border-accent bg-accent/10' : 'border-transparent bg-surface'}`}>
          <Toggle
            checked={draft.dialedIn}
            onChange={(v) => set('dialedIn', v)}
            label={
              <span>
                <span className="block font-semibold">Това е то</span>
                <span className="text-sm text-muted">Закачи като настройката си за {m.noun}</span>
              </span>
            }
          />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap gap-2 bg-gradient-to-t from-canvas from-60% px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {failed && (
          <p role="alert" className="w-full text-center text-sm font-medium text-bitter">
            Не се запази. Провери връзката и опитай пак.
          </p>
        )}
        {editing && (
          <button type="button" className="btn-ghost !text-bitter" onClick={remove}>
            Изтрий
          </button>
        )}
        <button type="submit" disabled={saving} className="btn-primary flex-1 !py-3.5">
          {brewId ? 'Запази' : 'Запази варенето'}
        </button>
      </div>
    </form>
  )
}
