import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { SettingCard } from '../components/SettingCard'
import { Pin, Plus, Trash } from '../components/icons'
import { BagPhoto, Header, PhotoViewer, Rating, Section } from '../components/ui'
import { db, deleteCoffee, setDialedIn, type Brew } from '../lib/db'
import { dotted, formatTime, METHODS, METHOD_ORDER, ratio, shortDate, TASTES } from '../lib/methods'

const tasteColor = { sour: 'text-citrus', balanced: 'text-roast', bitter: 'text-char' } as const

export default function CoffeeDetail() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const [viewing, setViewing] = useState(false)
  const coffee = useLiveQuery(() => db.coffees.get(id), [id])
  const brews = useLiveQuery(() => db.brews.where('coffeeId').equals(id).reverse().sortBy('createdAt'), [id])

  if (coffee === undefined || brews === undefined) return null
  if (!coffee) return <p className="py-20 text-center text-roast">Coffee not found.</p>

  // One card per method used: the pinned brew, or the latest attempt as a fallback.
  const settings = METHOD_ORDER.flatMap((m) => {
    const forMethod = brews.filter((b) => b.method === m)
    const pinned = forMethod.find((b) => b.dialedIn)
    if (pinned) return [{ brew: pinned, provisional: false }]
    return forMethod[0] ? [{ brew: forMethod[0], provisional: true }] : []
  })

  const facts = [
    ['Origin', dotted(coffee.origin, coffee.region)],
    ['Process', coffee.process],
    ['Varietal', coffee.varietal],
    ['Producer', coffee.producer],
    ['Altitude', coffee.altitude],
    ['Roast', coffee.roastLevel],
    ['Bag', coffee.bagWeight && `${coffee.bagWeight}g`],
  ].filter(([, v]) => v) as [string, string][]

  const toggleFinished = () => db.coffees.update(id, { finished: !coffee.finished, updatedAt: Date.now() })

  const remove = async () => {
    if (!confirm(`Delete "${coffee.name}" and all ${brews.length} brews?`)) return
    await deleteCoffee(id)
    navigate('/', { replace: true })
  }

  return (
    <>
      <Header
        back="/"
        right={
          <Link href={`/coffee/${id}/edit`} className="btn-ghost !px-4 !py-1.5">
            Edit
          </Link>
        }
      />

      {/* Identity card: what the coffee is on top, the bag's status and actions in the footer */}
      <div className="card overflow-hidden">
        <div className="flex gap-4 p-4">
          <button
            type="button"
            onClick={() => coffee.photo && setViewing(true)}
            className="shrink-0 self-start overflow-hidden rounded-xl border border-husk"
            aria-label={coffee.photo ? 'View bag photo' : undefined}
            disabled={!coffee.photo}
          >
            <BagPhoto blob={coffee.photo} className="aspect-[4/5] w-24 sm:w-28" iconSize={28} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold tracking-wider text-crema-deep uppercase">{coffee.roaster}</div>
            <h1 className="mt-1 font-display text-2xl leading-tight font-semibold tracking-tight">{coffee.name}</h1>
            {coffee.tastingNotes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {coffee.tastingNotes.map((t) => (
                  <span key={t} className="rounded-full bg-crema/15 px-2.5 py-0.5 text-sm text-crema-deep">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-husk px-4 py-2">
          <span className="min-w-0 truncate text-sm text-roast">
            {coffee.finished ? 'Finished' : 'On the shelf'}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={toggleFinished}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-espresso transition hover:bg-husk"
            >
              {coffee.finished ? 'Restock' : 'Finish bag'}
            </button>
            <button
              onClick={remove}
              className="rounded-full p-2 text-char transition hover:bg-char/10"
              aria-label="Delete coffee"
              title="Delete coffee"
            >
              <Trash width={16} height={16} />
            </button>
          </div>
        </div>
      </div>

      {/* The reason the app exists: the numbers to return to */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold">Your settings</h2>
        {settings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-husk px-5 py-6 text-center text-sm text-balance text-roast">
            No brews yet. Log your first shot to start dialing in.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {settings.map(({ brew, provisional }) => (
              <Link key={brew.id} href={`/coffee/${id}/brew/${brew.id}`} className="block rounded-2xl">
                <SettingCard brew={brew} provisional={provisional} />
              </Link>
            ))}
          </div>
        )}
        <Link href={`/coffee/${id}/brew/new`} className="btn-primary mt-3 w-full !py-3.5">
          <Plus width={18} height={18} /> Log a brew
        </Link>
      </section>

      <div className="mt-6 space-y-4">
        {brews.length > 0 && (
          <Section
            title="Dial-in log"
            summary={dotted(`${brews.length} ${brews.length === 1 ? 'brew' : 'brews'}`, `last ${shortDate(brews[0].createdAt)}`)}
            collapsible
            defaultOpen={false}
            flush
          >
            <ul className="divide-y divide-husk">
              {brews.map((b) => <BrewRow key={b.id} brew={b} />)}
            </ul>
          </Section>
        )}

        {(facts.length > 0 || coffee.notes) && (
          <Section title="About this coffee" summary={dotted(coffee.origin, coffee.process, coffee.roastLevel && `${coffee.roastLevel} roast`) || 'Details and notes'} collapsible defaultOpen={false}>
            {facts.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs tracking-wide text-roast uppercase">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {coffee.notes && <p className="text-sm whitespace-pre-line text-roast">{coffee.notes}</p>}
          </Section>
        )}

      </div>

      {viewing && coffee.photo && <PhotoViewer blob={coffee.photo} onClose={() => setViewing(false)} />}
    </>
  )
}

function BrewRow({ brew }: { brew: Brew }) {
  const m = METHODS[brew.method]
  const specs = dotted(
    brew.dose != null && brew.yield != null ? `${brew.dose}g → ${brew.yield}g` : brew.dose != null && `${brew.dose}g`,
    ratio(brew.dose, brew.yield),
    formatTime(brew.timeSec),
    shortDate(brew.createdAt),
  )

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link href={`/coffee/${brew.coffeeId}/brew/${brew.id}`} className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="num font-display text-xl font-semibold">{brew.grindSetting}</span>
          <span className="text-xs font-semibold tracking-wider text-crema-deep uppercase">{m.label}</span>
          {brew.taste && (
            <span className={`text-xs font-medium ${tasteColor[brew.taste]}`}>{TASTES[brew.taste].label}</span>
          )}
        </div>
        <p className="num mt-0.5 text-sm text-roast">{specs}</p>
        {brew.rating && <div className="mt-1"><Rating value={brew.rating} size={13} /></div>}
      </Link>
      <button
        onClick={() => setDialedIn(brew, !brew.dialedIn)}
        className={`rounded-full p-2.5 transition ${brew.dialedIn ? 'bg-crema/15 text-crema-deep' : 'text-roast/50 hover:bg-husk hover:text-espresso'}`}
        aria-label={brew.dialedIn ? 'Unpin dialed-in setting' : 'Pin as dialed-in setting'}
        title={brew.dialedIn ? 'Dialed in' : 'Pin as dialed in'}
      >
        <Pin width={18} height={18} />
      </button>
    </li>
  )
}
