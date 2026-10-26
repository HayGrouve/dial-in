import { useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useLocation, useSearch } from 'wouter'
import { BagPhoto } from '../components/ui'
import { Bean, Chevron, Gear, Plus, Search } from '../components/icons'
import { db, type Brew, type Coffee } from '../lib/db'
import { formatTime, METHODS, METHOD_SHORT, nextMove, relativeDay, settingsFor } from '../lib/methods'
import { finishWithUndo, restockWithUndo, toastAnchor } from '../lib/toast'

// Stretches a link over its whole row, so the row opens the coffee everywhere except its button
// (a button can't sit inside a link). The row needs `relative`; its button is `relative` to sit on top.
const stretched =
  'rounded-[inherit] after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:outline-offset-2 focus-visible:after:[outline:2px_solid_var(--accent)]'

export default function Home() {
  const coffees = useLiveQuery(() => db.coffees.orderBy('updatedAt').reverse().toArray())
  const brews = useLiveQuery(() => db.brews.orderBy('createdAt').reverse().toArray())
  // Search and the Finished list live in the URL, so coming back from a coffee restores them.
  const [, navigate] = useLocation()
  const params = new URLSearchParams(useSearch())
  const query = params.get('q') ?? ''
  const showFinished = params.has('finished')
  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    const search = next.toString()
    navigate(search ? `/?${search}` : '/', { replace: true })
  }
  const setQuery = (q: string) => setParam('q', q)
  const setShowFinished = (show: boolean) => setParam('finished', show ? '1' : undefined)
  // Manage turns the shelf row into a list with a Finish button per coffee.
  const [managing, setManaging] = useState(false)

  if (!coffees || !brews) return null

  const brewsOf = (id: string) => brews.filter((b) => b.coffeeId === id)
  const shelf = coffees.filter((c) => !c.finished)
  const finished = coffees.filter((c) => c.finished)
  // Finishing the last coffee empties the shelf; leave Manage so it doesn't come back switched on.
  if (managing && shelf.length === 0) setManaging(false)
  // A short shelf fits on screen, so finishing from Up Next or the coffee page is enough. Once
  // Manage is on, Done stays until you leave it, even if finishing drops the shelf below four.
  const showManage = managing || shelf.length >= 4

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
        <h1 className="text-lg font-semibold tracking-tight" translate="no">
          Dial In
        </h1>
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
            name="q"
            autoComplete="off"
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
                <li key={c.id} className="relative flex items-center gap-3 rounded-[20px] p-2 hover:bg-surface">
                  <Link href={`/coffee/${c.id}`} className={`flex min-w-0 flex-1 items-center gap-3 ${stretched}`}>
                    <BagPhoto blob={c.photo} alt="" className="aspect-[4/5] w-12 shrink-0 rounded-xl" iconSize={18} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="truncate text-sm text-muted">{c.finished ? `${c.roaster}, finished` : c.roaster}</div>
                      {/* A finished coffee's pill takes the trailing edge, so its settings move under the name. */}
                      {c.finished && <SettingsLine brews={brewsOf(c.id)} />}
                    </div>
                    {!c.finished && <SettingsLine brews={brewsOf(c.id)} />}
                  </Link>
                  {/* Finishing lives on Up Next, Manage and the coffee page; search only restocks. */}
                  {c.finished && <BoughtItAgain coffee={c} />}
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
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold tracking-tight">On the shelf</h2>
                {/* 44px tall, pulled into the heading's line so the row keeps its height. */}
                {showManage && (
                  <button type="button" onClick={() => setManaging(!managing)} className={`-my-2 min-h-11 ${managing ? 'btn-primary' : 'btn-ghost'}`}>
                    {managing ? 'Done' : 'Manage'}
                  </button>
                )}
              </div>
              {managing ? (
                <ul className="space-y-2">
                  {shelf.map((c, i) => (
                    <li key={c.id} className="rise" style={{ '--i': i } as React.CSSProperties}>
                      <ManageRow coffee={c} />
                    </li>
                  ))}
                </ul>
              ) : (
                <ShelfRow shelf={shelf} brewsOf={brewsOf} />
              )}
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
              <h2 className="text-xl font-semibold tracking-tight">
                <button
                  type="button"
                  onClick={() => setShowFinished(!showFinished)}
                  aria-expanded={showFinished}
                  className="group flex w-full items-center justify-between rounded-full py-2 text-left"
                >
                  Finished
                  <span className="flex items-center gap-1 text-sm font-normal tracking-normal text-muted transition group-hover:text-ink">
                    {finished.length} {finished.length === 1 ? 'bag' : 'bags'}
                    <Chevron width={16} height={16} className={`transition-transform ${showFinished ? 'rotate-180' : ''}`} />
                  </span>
                </button>
              </h2>
              {showFinished && (
                <ul className="mt-2 space-y-1">
                  {finished.map((c) => (
                    <li key={c.id} className="relative flex items-center gap-2 rounded-full py-1 pr-1 pl-1.5 hover:bg-surface">
                      {/* The photo tells apart two bags with the same name from different roasters. */}
                      <Link href={`/coffee/${c.id}`} className={`flex min-w-0 flex-1 items-center gap-3 ${stretched}`}>
                        <BagPhoto blob={c.photo} alt="" className="size-11 shrink-0 rounded-full" iconSize={16} />
                        <span className="flex min-w-0 flex-col py-1.5">
                          <span className="truncate">{c.name}</span>
                          <SettingsLine brews={brewsOf(c.id)} />
                        </span>
                      </Link>
                      <BoughtItAgain coffee={c} />
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
          ref={toastAnchor}
          href="/coffee/new"
          className="btn fixed right-[max(1rem,calc(50vw-24rem+1rem))] bottom-[max(env(safe-area-inset-bottom),1rem)] z-30 bg-ink !px-5 !py-3.5 text-canvas hover:bg-ink/90 shadow-[0_12px_32px_-12px_rgb(6_14_11/0.6)]"
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
      <div className="mt-5 flex gap-2">
        <Link href={`/coffee/${coffee.id}/brew/new?method=${setting.method}`} className="btn-primary min-w-0 flex-1 !px-4 !py-3.5 !text-base">
          <Plus width={18} height={18} className="shrink-0" /> <span className="truncate">Log another {m.label.toLowerCase()}</span>
        </Link>
        <button type="button" onClick={() => finishWithUndo(coffee)} className="btn-ghost shrink-0 !px-4" aria-label={`Finish bag of ${coffee.name}`}>
          Finish bag
        </button>
      </div>
    </section>
  )
}

function ShelfRow({ shelf, brewsOf }: { shelf: Coffee[]; brewsOf: (id: string) => Brew[] }) {
  const row = useRef<HTMLUListElement>(null)
  const atStart = useRef(true)
  // Scroll snap holds on to the card it was snapped to, so a coffee restocked to the front would land
  // out of view. If the row was at its start, it stays there and the coffee lands in view.
  const front = shelf[0].id
  useLayoutEffect(() => {
    if (atStart.current) row.current?.scrollTo({ left: 0 })
  }, [front])
  return (
    <ul
      ref={row}
      onScroll={(e) => {
        atStart.current = e.currentTarget.scrollLeft < 8
      }}
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {shelf.map((c, i) => (
        <li key={c.id} className="rise w-[42vw] max-w-[180px] shrink-0 snap-start" style={{ '--i': i } as React.CSSProperties}>
          <ShelfCard coffee={c} brews={brewsOf(c.id)} />
        </li>
      ))}
    </ul>
  )
}

function ShelfCard({ coffee, brews }: { coffee: Coffee; brews: Brew[] }) {
  return (
    <Link href={`/coffee/${coffee.id}`} className="group block">
      <BagPhoto blob={coffee.photo} alt="" className="aspect-[4/5] w-full rounded-[20px] transition group-active:scale-[0.98]" />
      <div className="mt-2.5 truncate font-medium">{coffee.name}</div>
      <div className="truncate text-sm text-muted">{coffee.roaster}</div>
      <div className="mt-1">
        <SettingsLine brews={brews} />
      </div>
    </Link>
  )
}

/** A shelf coffee in Manage mode: the whole row opens it, the button finishes it. */
function ManageRow({ coffee }: { coffee: Coffee }) {
  return (
    <div className="relative flex items-center gap-3 rounded-[20px] bg-surface p-2 transition hover:bg-tint">
      <Link href={`/coffee/${coffee.id}`} className={`flex min-w-0 flex-1 items-center gap-3 ${stretched}`}>
        <BagPhoto blob={coffee.photo} alt="" className="aspect-[4/5] w-12 shrink-0 rounded-xl" iconSize={18} />
        <div className="min-w-0">
          <div className="truncate font-medium">{coffee.name}</div>
          <div className="truncate text-sm text-muted">{coffee.roaster}</div>
        </div>
      </Link>
      <button type="button" onClick={() => finishWithUndo(coffee)} className="btn-ghost relative min-h-11 shrink-0" aria-label={`Finish ${coffee.name}`}>
        Finish
      </button>
    </div>
  )
}

/** Restocks a finished coffee in place: the toast confirms it, and the page stays where it is. */
function BoughtItAgain({ coffee }: { coffee: Coffee }) {
  return (
    <button type="button" onClick={() => restockWithUndo(coffee)} className="btn-ghost relative min-h-11 shrink-0 !px-4" aria-label={`Bought it again: ${coffee.name}`}>
      Bought it again
    </button>
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
      <h2 className="text-2xl font-semibold tracking-tight">Your grind memory starts here</h2>
      <p className="mx-auto mt-2 max-w-sm text-muted">
        Snap the bag, log your shots, and pin the setting that tastes right. Next time you buy it again, the number is waiting.
      </p>
      <Link href="/coffee/new" className="btn-primary mt-6 !px-6 !py-3">
        <Plus width={18} height={18} /> Add your first coffee
      </Link>
    </div>
  )
}
