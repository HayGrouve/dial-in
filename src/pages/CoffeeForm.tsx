import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useParams } from 'wouter'
import { Field, Header, PhotoPicker, Rating, Section, Segmented, TagInput } from '../components/ui'
import { db, newId, PROCESSES, ROAST_LEVELS, type Coffee } from '../lib/db'
import { dotted } from '../lib/methods'

type Draft = Omit<Coffee, 'id' | 'createdAt' | 'updatedAt'>

const empty: Draft = { name: '', roaster: '', tastingNotes: [], finished: false }

export default function CoffeeForm() {
  const { id } = useParams<{ id?: string }>()
  const [, navigate] = useLocation()
  const [draft, setDraft] = useState<Draft>(empty)
  const [loaded, setLoaded] = useState(!id)
  const roasters = useLiveQuery(async () => [...new Set((await db.coffees.toArray()).map((c) => c.roaster))].sort(), [])

  useEffect(() => {
    if (!id) return
    void db.coffees.get(id).then((c) => {
      if (c) setDraft(c)
      setLoaded(true)
    })
  }, [id])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const text = (key: keyof Draft) => ({
    value: (draft[key] as string | undefined) ?? '',
    onChange: (e: { target: { value: string } }) => set(key, (e.target.value || undefined) as never),
  })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const now = Date.now()
    if (id) {
      await db.coffees.update(id, { ...draft, updatedAt: now })
      navigate(`/coffee/${id}`, { replace: true })
    } else {
      const coffee: Coffee = { ...draft, id: newId(), createdAt: now, updatedAt: now }
      await db.coffees.add(coffee)
      navigate(`/coffee/${coffee.id}`, { replace: true })
    }
  }

  if (!loaded) return null

  const origin = dotted(draft.origin, draft.region, draft.process, draft.varietal, draft.producer, draft.altitude)
  const roast = dotted(draft.roastLevel && `${draft.roastLevel} roast`, draft.bagWeight && `${draft.bagWeight}g`)

  return (
    <form onSubmit={save} className="pb-8">
      <Header title={id ? 'Edit coffee' : 'New coffee'} back={id ? `/coffee/${id}` : '/'} />

      <div className="space-y-4">
        <PhotoPicker value={draft.photo} onChange={(photo) => set('photo', photo)} />

        <Section title="The essentials" hint="Enough to find it again">
          <Field label="Coffee name *">
            <input className="input" required placeholder="e.g. Ethiopia Guji Hambela" value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Roaster *">
            <input className="input" required list="roasters" placeholder="e.g. Onyx Coffee Lab" value={draft.roaster} onChange={(e) => set('roaster', e.target.value)} />
            <datalist id="roasters">{roasters?.map((r) => <option key={r} value={r} />)}</datalist>
          </Field>
          <Field label="Tasting notes">
            <TagInput value={draft.tastingNotes} onChange={(v) => set('tastingNotes', v)} placeholder="blueberry, jasmine, cocoa…" />
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
          <textarea className="input min-h-24" placeholder="Where you bought it, price, what to try next…" {...text('notes')} />
        </Section>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-foam from-60% px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <button type="submit" className="btn-primary w-full !py-3.5">
          {id ? 'Save changes' : 'Add coffee'}
        </button>
      </div>
    </form>
  )
}
