import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { BagPhoto, Segmented } from '../components/ui'
import { Bean, Gear, Plus, Search } from '../components/icons'
import { db, type Brew } from '../lib/db'
import { METHODS, METHOD_ORDER } from '../lib/methods'

type Filter = 'shelf' | 'finished' | 'all'

export default function Home() {
  const coffees = useLiveQuery(() => db.coffees.orderBy('updatedAt').reverse().toArray())
  const dialed = useLiveQuery(() => db.brews.filter((b) => b.dialedIn).toArray())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('shelf')

  const dialedByCoffee = useMemo(() => {
    const map = new Map<string, Brew[]>()
    for (const b of dialed ?? []) map.set(b.coffeeId, [...(map.get(b.coffeeId) ?? []), b])
    for (const list of map.values()) list.sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method))
    return map
  }, [dialed])

  // Only offer tools once they earn their space: search for a real collection, filters once bags get finished.
  const showSearch = (coffees?.length ?? 0) >= 6
  const showFilter = coffees?.some((c) => c.finished) ?? false
  const activeFilter: Filter = showFilter ? filter : 'all'

  const q = showSearch ? query.trim().toLowerCase() : ''
  const visible = (coffees ?? []).filter((c) => {
    if (activeFilter === 'shelf' && c.finished) return false
    if (activeFilter === 'finished' && !c.finished) return false
    if (!q) return true
    return [c.name, c.roaster, c.origin, c.region, c.producer, c.process, c.varietal, ...c.tastingNotes]
      .some((s) => s?.toLowerCase().includes(q))
  })

  return (
    <>
      <header className="flex items-start justify-between pt-[max(env(safe-area-inset-top),1.25rem)] pb-5">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Dial In</h1>
          <p className="mt-1 text-balance text-roast">Every coffee, and exactly how you ground it.</p>
        </div>
        <Link href="/settings" className="rounded-full p-2 text-roast hover:text-espresso" aria-label="Settings">
          <Gear />
        </Link>
      </header>

      {(showSearch || showFilter) && (
        <div className="mb-5 space-y-3">
          {showSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-roast" width={18} height={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search roaster, origin, notes…"
                className="input !pl-10"
                type="search"
              />
            </div>
          )}
          {showFilter && (
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'shelf', label: 'On the shelf' },
                { value: 'finished', label: 'Finished' },
                { value: 'all', label: 'All' },
              ]}
            />
          )}
        </div>
      )}

      {coffees && coffees.length === 0 && <EmptyState />}

      {coffees && coffees.length > 0 && visible.length === 0 && (
        <p className="py-16 text-center text-roast">
          {q ? 'No coffees match that search.' : activeFilter === 'shelf' ? 'Shelf is empty — time to buy beans.' : 'Nothing here yet.'}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3">
        {visible.map((c) => {
          const settings = dialedByCoffee.get(c.id) ?? []
          return (
            <li key={c.id}>
              <Link href={`/coffee/${c.id}`} className="card group block overflow-hidden transition hover:border-crema">
                <div className="relative">
                  <BagPhoto blob={c.photo} className="aspect-[4/5] w-full transition group-hover:scale-[1.02]" />
                  {c.finished && (
                    <span className="absolute top-2 left-2 rounded-full bg-espresso/80 px-2 py-0.5 text-[11px] font-medium text-foam">Finished</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="truncate text-xs text-roast">{c.roaster}</div>
                  <div className="truncate font-display text-[17px] leading-snug font-semibold">{c.name}</div>
                  {settings.length > 0 ? (
                    <dl className="mt-2.5 space-y-0.5 border-t border-husk pt-2.5">
                      {settings.map((b) => (
                        <div key={b.id} className="flex items-baseline justify-between gap-2 text-sm">
                          <dt className="min-w-0 truncate text-roast">{METHODS[b.method].label}</dt>
                          <dd className="num max-w-[60%] truncate font-display font-semibold">{b.grindSetting}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-2.5 border-t border-husk pt-2.5 text-sm text-roast/70">Not dialed in yet</p>
                  )}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {coffees && coffees.length > 0 && (
        <Link
          href="/coffee/new"
          className="btn-primary fixed right-[max(1.25rem,calc(50vw-24rem+1rem))] bottom-[max(env(safe-area-inset-bottom),1.25rem)] z-30 !px-5 !py-3.5 shadow-lg shadow-espresso/25"
        >
          <Plus /> New coffee
        </Link>
      )}
    </>
  )
}

function EmptyState() {
  return (
    <div className="card mt-6 px-6 py-12 text-center">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-crema/15 text-crema-deep">
        <Bean width={30} height={30} />
      </div>
      <h2 className="font-display text-2xl font-semibold">Your grind memory starts here</h2>
      <p className="mx-auto mt-2 max-w-sm text-roast">
        Snap the bag, log your shots, and pin the setting that tastes right. Next time you buy it again, the number is waiting.
      </p>
      <Link href="/coffee/new" className="btn-primary mt-6">
        <Plus width={18} height={18} /> Add your first coffee
      </Link>
    </div>
  )
}
