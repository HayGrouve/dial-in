import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useParams, useSearch } from 'wouter'
import { Back, Pin, Plus, Trash } from '../components/icons'
import { BagPhoto, PhotoViewer, Rating } from '../components/ui'
import { arrowKeys } from '../lib/a11y'
import { db, deleteCoffee, setDialedIn, type Brew, type BrewMethod, type Coffee } from '../lib/db'
import { formatTime, logLabel, METHODS, nextMove, ratio, relativeDay, settingsFor } from '../lib/methods'

const TASTE_WORD = { sour: 'Sour', balanced: 'Balanced', bitter: 'Bitter' } as const

export default function CoffeeDetail() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const [viewing, setViewing] = useState(false)
  // The method tab lives in the URL so back-navigation and links land on the same tab.
  const picked = new URLSearchParams(useSearch()).get('method') as BrewMethod | null
  const pick = (method: BrewMethod) => navigate(`/coffee/${id}?method=${method}`, { replace: true })
  const coffee = useLiveQuery(() => db.coffees.get(id), [id])
  const brews = useLiveQuery(() => db.brews.where('coffeeId').equals(id).reverse().sortBy('createdAt'), [id])

  if (coffee === undefined || brews === undefined) return null
  if (!coffee) return <p className="py-20 text-center text-muted">Coffee not found.</p>

  const settings = settingsFor(brews)
  const current = settings.find((s) => s.brew.method === picked) ?? settings[0]

  const toggleFinished = () => db.coffees.update(id, { finished: !coffee.finished, updatedAt: Date.now() })
  const rate = (rating: number | undefined) => db.coffees.update(id, { rating, updatedAt: Date.now() })
  const remove = async () => {
    if (!confirm(`Delete “${coffee.name}” and all ${brews.length} ${brews.length === 1 ? 'brew' : 'brews'}?`)) return
    await deleteCoffee(id)
    navigate('/', { replace: true })
  }

  return (
    <>
      {/* Full-bleed bag photo fading into the page; the name sits over its lower edge */}
      <div className="relative -mx-4 sm:mx-0 sm:mt-4 sm:overflow-hidden sm:rounded-t-[28px]">
        <button
          type="button"
          onClick={() => coffee.photo && setViewing(true)}
          disabled={!coffee.photo}
          aria-label={coffee.photo ? 'View bag photo' : undefined}
          className="block w-full"
        >
          <BagPhoto blob={coffee.photo} alt={`Bag of ${coffee.name}`} className="h-[min(48dvh,420px)] w-full" iconSize={56} />
        </button>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-canvas/40 via-transparent via-35% to-canvas to-85%" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <Link href="/" className="rounded-full bg-canvas/70 p-2.5 backdrop-blur-md transition hover:bg-canvas/95" aria-label="Back to shelf">
            <Back />
          </Link>
          <Link href={`/coffee/${id}/edit`} className="rounded-full bg-canvas/70 px-4 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-canvas/95">
            Edit
          </Link>
        </div>
      </div>

      <div className="relative -mt-24 pb-32">
        <div className="rise">
          <p className="truncate text-sm text-muted">{[coffee.roaster, coffee.origin].filter(Boolean).join(', ')}</p>
          <h1 className="mt-1 text-[40px] leading-[1.02] break-words font-semibold tracking-[-0.03em]">{coffee.name}</h1>
          {coffee.tastingNotes.length > 0 && <p className="mt-2 text-lg text-accent-fg">{coffee.tastingNotes.join(', ')}</p>}
          <div className="mt-2 -ml-1">
            <Rating value={coffee.rating} onChange={rate} size={20} />
          </div>
        </div>

        {current ? (
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
        ) : (
          <p className="card mt-8 p-6 text-balance text-muted">No brews yet. Log your first one and the setting to remember will live here.</p>
        )}

        <About coffee={coffee} />

        <div className="mt-10 flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggleFinished} className="btn-ghost">
            {coffee.finished ? 'Bought it again' : 'Finish bag'}
          </button>
          <button type="button" onClick={remove} className="btn-ghost !text-bitter">
            <Trash width={16} height={16} /> Delete
          </button>
          {coffee.finished && <span className="text-sm text-muted">This bag is finished.</span>}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-canvas from-50% to-transparent px-4 pt-8 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <Link
          href={`/coffee/${id}/brew/new${current ? `?method=${current.brew.method}` : ''}`}
          className="btn-primary mx-auto !flex w-full max-w-[44rem] !py-4 !text-base"
        >
          <Plus width={18} height={18} /> {current ? logLabel(current.brew.method) : 'Log a brew'}
        </Link>
      </div>

      {viewing && coffee.photo && <PhotoViewer blob={coffee.photo} alt={`Bag of ${coffee.name}`} onClose={() => setViewing(false)} />}
    </>
  )
}

/** The number to come back to, the recipe around it, and what to do next. */
function SettingCard({ brew, provisional, tries }: { brew: Brew; provisional: boolean; tries: Brew[] }) {
  const m = METHODS[brew.method]
  const latest = tries[0]
  const move = latest.taste && nextMove(latest.taste)
  const extras = [
    brew.preinfusion && `Pre-infusion${brew.preinfusionSec ? ` ${brew.preinfusionSec}s` : ''}`,
    brew.bloomSec && `Bloom ${brew.bloomSec}s`,
    brew.temperature && `${brew.temperature}°C`,
  ].filter(Boolean)
  const stats = [
    ['Dose', brew.dose != null && `${brew.dose}g`],
    [m.isEspresso ? 'Out' : 'Water', brew.yield != null && `${brew.yield}g`],
    ['Ratio', ratio(brew.dose, brew.yield)],
    ['Time', formatTime(brew.timeSec)],
  ] as const

  return (
    <section className="rise card mt-6 p-5">
      <Link href={`/coffee/${brew.coffeeId}/brew/${brew.id}`} className="block">
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <span>{provisional ? 'Still dialing' : 'Your setting'}</span>
          {brew.grinder && <span className="truncate">{brew.grinder}</span>}
        </div>
        <div
          className={`mt-1 font-mono leading-none font-semibold text-accent-fg ${
            brew.grindSetting.length > 6 ? 'text-5xl tracking-tight' : 'text-[96px] tracking-[-0.07em]'
          }`}
        >
          {brew.grindSetting || '—'}
        </div>
        <dl className="mt-6 grid grid-cols-4 gap-2">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 font-mono text-[17px] font-medium">{v || '—'}</dd>
            </div>
          ))}
        </dl>
        {extras.length > 0 && <p className="mt-3 font-mono text-sm text-muted">{extras.join(', ')}</p>}
      </Link>

      <div className="mt-5 flex items-center gap-3 rounded-[20px] bg-tint px-4 py-3 text-sm">
        <p className="flex-1">
          {move ? (
            <>
              Last try at <span className="font-mono">{latest.grindSetting}</span> {move}
            </>
          ) : provisional ? (
            <>
              Tasting right? Pin <span className="font-mono">{latest.grindSetting}</span> so it’s waiting next time.
            </>
          ) : (
            <>
              Pinned {relativeDay(brew.createdAt).toLowerCase()}, after {tries.length} {tries.length === 1 ? 'try' : 'tries'}.
            </>
          )}
        </p>
        {provisional && !move && (
          <button type="button" onClick={() => setDialedIn(latest, true)} className="btn shrink-0 bg-ink !px-4 !py-2 text-canvas">
            <Pin width={16} height={16} /> Pin
          </button>
        )}
      </div>
    </section>
  )
}

function TryRow({ brew: b }: { brew: Brew }) {
  return (
    <li className="relative pb-5 pl-6 last:pb-0">
      <span
        className={`absolute top-2 -left-[5px] h-[9px] w-[9px] rounded-full ${b.dialedIn ? 'bg-accent' : 'border border-muted bg-canvas'}`}
        aria-hidden
      />
      <div className="flex items-start gap-2">
        <Link href={`/coffee/${b.coffeeId}/brew/${b.id}`} className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-lg font-semibold">{b.grindSetting}</span>
            <span className="text-sm">{b.taste ? TASTE_WORD[b.taste] : 'No verdict'}</span>
            <span className="ml-auto shrink-0 text-sm text-muted">{relativeDay(b.createdAt)}</span>
          </div>
          <p className="font-mono text-xs text-muted">
            {[b.dose != null && b.yield != null ? `${b.dose}g to ${b.yield}g` : b.dose != null && `${b.dose}g`, formatTime(b.timeSec)].filter(Boolean).join(', ')}
          </p>
          {b.notes && <p className="mt-1 text-sm break-words text-muted">{b.notes}</p>}
        </Link>
        <button
          type="button"
          onClick={() => setDialedIn(b, !b.dialedIn)}
          className={`-mt-1 rounded-full p-2 transition ${b.dialedIn ? 'text-accent-fg' : 'text-muted/60 hover:bg-surface hover:text-ink'}`}
          aria-label="Pin as dialed-in setting"
          aria-pressed={b.dialedIn}
        >
          <Pin width={18} height={18} />
        </button>
      </div>
    </li>
  )
}

function About({ coffee }: { coffee: Coffee }) {
  const facts = [
    ['Process', coffee.process],
    ['Varietal', coffee.varietal],
    ['Region', coffee.region],
    ['Producer', coffee.producer],
    ['Altitude', coffee.altitude],
    ['Roast', coffee.roastLevel],
    ['Bag', coffee.bagWeight && `${coffee.bagWeight}g`],
  ].filter(([, v]) => v) as [string, string][]
  if (!facts.length && !coffee.notes) return null
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">About the coffee</h2>
      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="font-medium break-words">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {coffee.notes && <p className="mt-4 text-sm break-words whitespace-pre-line text-muted">{coffee.notes}</p>}
    </section>
  )
}
