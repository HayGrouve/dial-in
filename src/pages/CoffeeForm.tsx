import { useMutation, useQuery } from 'convex/react'
import { useState, type FormEvent } from 'react'
import { useLocation, useParams } from 'wouter'
import { api } from '../../convex/_generated/api'
import { BagScanner } from '../components/BagScanner'
import { Field, Header, Loading, NotFound, Rating, Section, Segmented, TagInput } from '../components/ui'
import { ReviewPill, WelcomeBackSheet } from '../components/WelcomeBackSheet'
import { useLeaveGuard } from '../lib/a11y'
import { detailsOf, PROCESSES, ROAST_LEVELS, type Coffee, type CoffeeDetails } from '../lib/db'
import { uploadPhoto } from '../lib/image'
import { findMatches, matchKey, restockPlan } from '../lib/match'
import { dotted } from '../lib/methods'
import type { ScannedFields } from '../lib/scan'
import { restockWithUndo } from '../lib/toast'

type Draft = Omit<CoffeeDetails, 'photo'>

const empty: Draft = { name: '', roaster: '', tastingNotes: [] }

export default function CoffeeForm() {
  const { id } = useParams<{ id?: string }>()
  const [, navigate] = useLocation()
  const [draft, setDraft] = useState<Draft>(empty)
  // The bag photo: a Blob picked here and not uploaded yet, or the stored photo's URL, left as it is.
  const [photo, setPhoto] = useState<Blob | string>()
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const guard = useLeaveGuard(dirty && !saving)
  const coffees = useQuery(api.coffees.listMine)
  const editing = useQuery(api.coffees.get, id ? { id } : 'skip')
  const createCoffee = useMutation(api.coffees.create)
  const updateCoffee = useMutation(api.coffees.update)
  // Edit coffee: the stored values fill the form once, then the form owns them.
  const [loadedId, setLoadedId] = useState<string>()
  if (editing && loadedId !== editing._id) {
    setLoadedId(editing._id)
    const { photo: _stored, ...details } = detailsOf(editing)
    setDraft(details)
    setPhoto(editing.photoUrl)
  }
  const roasters = coffees && [...new Set(coffees.map((c) => c.roaster))].sort()

  // New coffee only: a coffee you've had before is offered back instead of added twice. The offer
  // is made once per match (`offered`), and not again after Add as new anyway (`declined`).
  const [offered, setOffered] = useState('')
  const [declined, setDeclined] = useState('')
  const [sheet, setSheet] = useState(false)
  // Set on leaving the name or roaster field and after a scan, so the offer never opens mid-word.
  // Settled during the next render, once the scanned fields are in the draft.
  const [check, setCheck] = useState(false)
  const key = id ? '' : matchKey(draft)
  const matches = key && coffees ? findMatches(coffees, draft) : []
  const offer = matches.length > 0 && key !== declined
  if (check && coffees) {
    setCheck(false)
    if (offer && key !== offered) {
      setOffered(key)
      setSheet(true)
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDirty(true)
    setDraft((d) => ({ ...d, [key]: value }))
  }
  const text = (key: keyof Draft) => ({
    name: key,
    autoComplete: 'off',
    value: (draft[key] as string | undefined) ?? '',
    onChange: (e: { target: { value: string } }) => set(key, (e.target.value || undefined) as never),
  })

  // Label details only fill fields that are still empty, so nothing typed by hand is overwritten.
  const applyScan = (fields: ScannedFields) => {
    setDirty(true)
    setCheck(true)
    setDraft((d) => {
      const next = { ...d }
      for (const [key, value] of Object.entries(fields) as [keyof ScannedFields, ScannedFields[keyof ScannedFields]][]) {
        const current = d[key]
        const empty = Array.isArray(current) ? current.length === 0 : current == null || current === ''
        if (empty && value != null && !(Array.isArray(value) && value.length === 0)) next[key] = value as never
      }
      return next
    })
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    // Enter in the name field submits without leaving it: offer the match first, as leaving would.
    if (offer && key !== offered) {
      setOffered(key)
      setSheet(true)
      return
    }
    setSaving(true)
    setFailed(false)
    try {
      // A new photo goes up first; an untouched one keeps its file; a removed one leaves the coffee.
      const stored = photo instanceof Blob ? await uploadPhoto(photo) : photo ? editing?.photo : undefined
      if (editing) {
        await updateCoffee({ ...draft, photo: stored, id: editing._id })
        navigate(`/coffee/${editing._id}`, { replace: true })
      } else {
        const created = await createCoffee({ ...draft, photo: stored })
        navigate(`/coffee/${created}`, { replace: true })
      }
    } catch {
      setSaving(false)
      setFailed(true)
    }
  }

  // Leaving the form on purpose: `saving` turns the unsaved-changes guard off.
  const restock = async (coffee: Coffee) => {
    setSaving(true)
    setFailed(false)
    try {
      const newPhoto = photo instanceof Blob ? await uploadPhoto(photo) : undefined
      await restockWithUndo(coffee, { ...restockPlan(coffee, draft).changes, ...(newPhoto && { photo: newPhoto }) })
      navigate(`/coffee/${coffee._id}`, { replace: true })
    } catch {
      setSaving(false)
      setFailed(true)
      setSheet(false)
    }
  }
  const open = (coffee: Coffee) => {
    setSaving(true)
    navigate(`/coffee/${coffee._id}`, { replace: true })
  }
  const addNew = () => {
    setDeclined(key)
    setSheet(false)
  }

  // A malformed, deleted or someone else's id reads as null.
  if (id && editing === null) return <NotFound />
  if (id && loadedId !== id) return <Loading />

  const origin = dotted(draft.origin, draft.region, draft.process, draft.varietal, draft.producer, draft.altitude)
  const roast = dotted(draft.roastLevel && `${draft.roastLevel} roast`, draft.bagWeight && `${draft.bagWeight}g`)

  return (
    <form onSubmit={save} className="pb-8">
      <Header title={id ? 'Edit coffee' : 'New coffee'} back={id ? `/coffee/${id}` : '/'} onBack={guard} />

      <div className="space-y-4">
        <BagScanner
          front={photo}
          onFront={(p) => {
            setDirty(true)
            setPhoto(p)
          }}
          onScanned={applyScan}
          onLeave={guard}
        />

        <Section title="The essentials" hint="Enough to find it again">
          <Field label="Coffee name *">
            <input className="input" name="coffeeName" autoComplete="off" required placeholder="e.g. Ethiopia Guji Hambela…" value={draft.name} onChange={(e) => set('name', e.target.value)} onBlur={() => setCheck(true)} />
          </Field>
          <Field label="Roaster *">
            <input className="input" name="roaster" autoComplete="off" required list="roasters" placeholder="e.g. Onyx Coffee Lab…" value={draft.roaster} onChange={(e) => set('roaster', e.target.value)} onBlur={() => setCheck(true)} />
            <datalist id="roasters">{roasters?.map((r) => <option key={r} value={r} />)}</datalist>
          </Field>
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
        {failed && (
          <p role="alert" className="mb-2 text-center text-sm font-medium text-bitter">
            Не се запази. Провери връзката и опитай пак.
          </p>
        )}
        {offer && !sheet && offered === key && <ReviewPill matches={matches} onClick={() => setSheet(true)} />}
        <button type="submit" disabled={saving} className="btn-primary w-full !py-3.5">
          {id ? 'Save changes' : 'Add coffee'}
        </button>
      </div>

      {offer && sheet && (
        <WelcomeBackSheet matches={matches} draft={draft} newPhoto={photo instanceof Blob} busy={saving} onRestock={(c) => void restock(c)} onOpen={open} onAddNew={addNew} onClose={() => setSheet(false)} />
      )}
    </form>
  )
}
