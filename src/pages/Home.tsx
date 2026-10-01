import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'wouter'
import { BagPhoto } from '../components/ui'
import { Bean, Chevron, Gear, Plus, Search } from '../components/icons'
import { db, type Brew, type Coffee } from '../lib/db'
import { formatTime, METHODS, METHOD_SHORT, nextMove, relativeDay, settingsFor } from '../lib/methods'

export default function Home() {
  const coffees = useLiveQuery(() => db.coffees.orderBy('updatedAt').reverse().toArray())
  const brews = useLiveQuery(() => db.brews.orderBy('createdAt').reverse().toArray())
  const [query, setQuery] = useState('')
  const [showFinished, setShowFinished] = useState(false)

  if (!coffees || !brews) return null

  const brewsOf = (id: string) => brews.filter((b) => b.coffeeId === id)
  const shelf = coffees.filter((c) => !c.finished)
  const finished = coffees.filter((c) => c.finished)

  // The bag brewed most recently is the one you're most likely reaching for again.
  const lastBrew = brews.find((b) => shelf.some((c) => c.id === b.coffeeId))
  const upNext = lastBrew && shelf.find((c) => c.id === lastBrew.coffeeId)
  const dialing = shelf.filter((c) => {
    const bs = brewsOf(c.id)
    return bs.length > 0 && !bs.some((b) => b.dialedIn)
  })

  // Search only earns its space once the collection is big enough to lose a bag in.
  const showSearch = coffees.length >= 6
  const q = showSearch ? query.trim().toLowerCase() : ''
  const results = coffees.filter((c) =>
    [c.name, c.roaster, c.origin, c.region, c.producer, c.process, c.varietal, ...c.tastingNotes].some((s) => s?.toLowerCase().includes(q)),
  )

  return (
    <>
      <header className="flex items-center justify-between pt-[max(env(safe-area-inset-top),1rem)] pb-4">
        <span className="text-lg font-semibold tracking-tight">Dial In</span>
        <Link href="/settings" className="-mr-2 rounded-full p-2.5 text-muted hover:bg-surface hover:text-ink" aria-label="Settings">
          <Gear />
        </Link>
      </header>

      {coffees.length === 0 && <EmptyState />}

      {showSearch && (
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" width={18} height={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roaster, origin, notes…"
            aria-label="Search coffees"
            className="input !rounded-full !bg-surface !pl-11"
            type="search"
          />
        </div>
      )}

      {q ? (
        <section className="pb-28">
          {results.length === 0 ? (
            <p className="py-16 text-center text-muted">No coffees match that search.</p>
          ) : (
            <ul className="space-y-1">
              {results.map((c) => (
                <li key={c.id}>
                  <Link href={`/coffee/${c.id}`} className="flex items-center gap-3 rounded-[20px] p-2 hover:bg-surface">
                    <BagPhoto blob={c.photo} className="aspect-[4/5] w-12 shrink-0 rounded-xl" iconSize={18} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="truncate text-sm text-muted">{c.finished ? `${c.roaster}, finished` : c.roaster}</div>
                    </div>
                    <SettingsLine brews={brewsOf(c.id)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {upNext && lastBrew && <UpNext coffee={upNext} brews={brewsOf(upNext.id)} last={lastBrew} />}

          {shelf.length > 0 && (
            <section className={upNext ? 'mt-10' : ''}>
              <h2 className="mb-4 text-xl font-semibold tracking-tight">On the shelf</h2>
              <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {shelf.map((c, i) => (
                  <li key={c.id} className="rise w-[42vw] max-w-[180px] shrink-0 snap-start" style={{ '--i': i } as React.CSSProperties}>
                    <ShelfCard coffee={c} brews={brewsOf(c.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {coffees.length > 0 && shelf.length === 0 && (
            <p className="rounded-[28px] bg-surface px-6 py-10 text-center text-muted">Shelf is empty. Time to buy beans.</p>
          )}

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

          {finished.length > 0 && (
            <section className="mt-10">
              <button
                type="button"
                onClick={() => setShowFinished(!showFinished)}
                aria-expanded={showFinished}
                className="flex w-full items-center justify-between rounded-full py-2 text-left"
              >
                <span className="text-xl font-semibold tracking-tight">Finished</span>
                <span className="flex items-center gap-1 text-sm text-muted">
                  {finished.length} {finished.length === 1 ? 'bag' : 'bags'}
                  <Chevron width={16} height={16} className={`transition-transform ${showFinished ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {showFinished && (
                <ul className="mt-2 space-y-1">
                  {finished.map((c) => (
                    <li key={c.id}>
                      <Link href={`/coffee/${c.id}`} className="flex items-center justify-between gap-3 rounded-full px-4 py-3 hover:bg-surface">
                        <span className="truncate">{c.name}</span>
                        <SettingsLine brews={brewsOf(c.id)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <div className="h-24" />
        </>
      )}

      {coffees.length > 0 && (
        <Link
          href="/coffee/new"
          className="btn fixed right-[max(1rem,calc(50vw-24rem+1rem))] bottom-[max(env(safe-area-inset-bottom),1rem)] z-30 bg-ink !px-5 !py-3.5 text-canvas shadow-[0_12px_32px_-12px_rgb(6_14_11/0.6)]"
        >
          <Plus width={18} height={18} /> New coffee
        </Link>
      )}
    </>
  )
}

function UpNext({ coffee, brews, last }: { coffee: Coffee; brews: Brew[]; last: Brew }) {
  const setting = settingsFor(brews).find((s) => s.brew.method === last.method)!.brew
  const m = METHODS[setting.method]
  return (
    <section className="rise card p-4">
      <Link href={`/coffee/${coffee.id}`} className="flex gap-4">
        <BagPhoto blob={coffee.photo} className="aspect-[4/5] w-24 shrink-0 rounded-[20px]" iconSize={28} />
        <div className="min-w-0 py-1">
          <p className="text-sm text-muted">Brewed {relativeDay(last.createdAt).toLowerCase()}</p>
          <h1 className="mt-1 text-2xl leading-tight font-semibold tracking-tight">{coffee.name}</h1>
          <p className="mt-1 truncate text-sm text-muted">{coffee.roaster}</p>
        </div>
      </Link>
      <div className="mt-5 flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <div className="text-sm text-muted">{setting.dialedIn ? m.label : `${m.label}, still dialing`}</div>
          <div className={`truncate font-mono leading-none font-semibold tracking-tighter text-accent-fg ${setting.grindSetting.length > 6 ? 'text-4xl' : 'text-[56px]'}`}>
            {setting.grindSetting || '-'}
          </div>
        </div>
        <p className="shrink-0 pb-1 text-right font-mono text-sm leading-relaxed text-muted">
          {setting.dose != null && <>{setting.dose}g in<br /></>}
          {setting.yield != null && <>{setting.yield}g {m.isEspresso ? 'out' : 'water'}<br /></>}
          {formatTime(setting.timeSec)}
        </p>
      </div>
      <Link href={`/coffee/${coffee.id}/brew/new?method=${setting.method}`} className="btn-primary mt-5 w-full !py-3.5 !text-base">
        <Plus width={18} height={18} /> Log another {m.label.toLowerCase()}
      </Link>
    </section>
  )
}

function ShelfCard({ coffee, brews }: { coffee: Coffee; brews: Brew[] }) {
  return (
    <Link href={`/coffee/${coffee.id}`} className="group block">
      <BagPhoto blob={coffee.photo} className="aspect-[4/5] w-full rounded-[20px] transition group-active:scale-[0.98]" />
      <div className="mt-2.5 truncate font-medium">{coffee.name}</div>
      <div className="truncate text-sm text-muted">{coffee.roaster}</div>
      <div className="mt-1">
        <SettingsLine brews={brews} />
      </div>
    </Link>
  )
}

function DialingRow({ coffee, last }: { coffee: Coffee; last: Brew }) {
  const move = last.taste && nextMove(last.taste)
  return (
    <Link href={`/coffee/${coffee.id}`} className="flex items-center gap-4 rounded-[28px] bg-surface p-4 transition hover:bg-tint">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{coffee.name}</div>
        <p className="mt-0.5 text-sm text-muted">
          {move ? (
            <>
              <span className="font-mono text-ink">{last.grindSetting}</span> {move}
            </>
          ) : (
            <>
              Last tried at <span className="font-mono text-ink">{last.grindSetting}</span>. Pin it when it tastes right.
            </>
          )}
        </p>
      </div>
      <Chevron className="shrink-0 -rotate-90 text-muted" width={18} height={18} />
    </Link>
  )
}

function SettingsLine({ brews }: { brews: Brew[] }) {
  const pinned = settingsFor(brews).filter((s) => !s.provisional)
  if (pinned.length === 0) return <span className="shrink-0 text-sm text-muted">{brews.length ? 'Dialing in' : 'Not brewed yet'}</span>
  return (
    <span className="flex shrink-0 flex-wrap gap-x-3 font-mono text-sm">
      {pinned.map(({ brew }) => (
        <span key={brew.id}>
          <span className="text-xs text-muted">{METHOD_SHORT[brew.method]}</span> <span className="font-semibold text-accent-fg">{brew.grindSetting}</span>
        </span>
      ))}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="card mt-6 px-6 py-12 text-center">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent-fg">
        <Bean width={30} height={30} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Your grind memory starts here</h1>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        Snap the bag, log your shots, and pin the setting that tastes right. Next time you buy it again, the number is waiting.
      </p>
      <Link href="/coffee/new" className="btn-primary mt-6 !px-6 !py-3">
        <Plus width={18} height={18} /> Add your first coffee
      </Link>
    </div>
  )
}
