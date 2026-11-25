import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Link, useLocation, useParams, useSearch } from 'wouter'
import { api } from '../../convex/_generated/api'
import { Back, Check, Pin, Plus, Trash } from '../components/icons'
import { BagPhoto, Loading, NotFound, PhotoViewer, Rating } from '../components/ui'
import { arrowKeys } from '../lib/a11y'
import { brewsCount, count } from '../lib/count'
import { roastLabel, type Brew, type BrewMethod, type Coffee } from '../lib/db'
import { capitalise, formatTime, grams, logLabel, METHODS, nextMove, ratio, relativeDay, settingsFor } from '../lib/methods'
import { finishWithUndo, restockWithUndo, toastAnchor } from '../lib/toast'

const TASTE_WORD = { sour: 'Кисело', balanced: 'Балансирано', bitter: 'Горчиво' } as const
/** The status row's button: Пакетът свърши on the shelf, Запиши варене once finished. */
const STATUS_ACTION = 'btn shrink-0 border border-line bg-surface !px-4 !py-2 text-ink hover:bg-canvas'

type PinBrew = (brew: Brew, value: boolean) => void

/** Pins a brew as the setting for its method; the pin moves at once, before Convex confirms it. */
function usePin(coffeeId: string): PinBrew {
  const setDialedIn = useMutation(api.brews.setDialedIn).withOptimisticUpdate((store, { id, value }) => {
    const brews = store.getQuery(api.brews.byCoffee, { coffeeId })
    const target = brews?.find((b) => b._id === id)
    if (!brews || !target) return
    store.setQuery(
      api.brews.byCoffee,
      { coffeeId },
      brews.map((b) => (b._id === id ? { ...b, dialedIn: value } : value && b.method === target.method ? { ...b, dialedIn: false } : b)),
    )
  })
  return (brew, value) => void setDialedIn({ id: brew._id, value })
}

export default function CoffeeDetail() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const [viewing, setViewing] = useState(false)
  // The method tab lives in the URL so back-navigation and links land on the same tab.
  const picked = new URLSearchParams(useSearch()).get('method') as BrewMethod | null
  const pick = (method: BrewMethod) => navigate(`/coffee/${id}?method=${method}`, { replace: true })
  const coffee = useQuery(api.coffees.get, { id })
  const brews = useQuery(api.brews.byCoffee, { coffeeId: id })
  const pin = usePin(id)
  const rateCoffee = useMutation(api.coffees.rate).withOptimisticUpdate((store, { rating }) => {
    const current = store.getQuery(api.coffees.get, { id })
    if (current) store.setQuery(api.coffees.get, { id }, { ...current, rating })
  })
  const removeCoffee = useMutation(api.coffees.remove)

  // A malformed, deleted or someone else's id reads as null.
  if (coffee === null) return <NotFound />
  if (coffee === undefined || brews === undefined) return <Loading />

  const settings = settingsFor(brews)
  const current = settings.find((s) => s.brew.method === picked) ?? settings[0]

  const { finished } = coffee
  const logHref = `/coffee/${id}/brew/new${current ? `?method=${current.brew.method}` : ''}`
  const rate = (rating: number | undefined) => void rateCoffee({ id: coffee._id, rating })
  const remove = () => {
    if (!confirm(brews.length ? `Да изтрия „${coffee.name}“ и ${brews.length === 1 ? 'единственото му варене' : `всичките му ${brewsCount(brews.length)}`}?` : `Да изтрия „${coffee.name}“?`)) return
    // Off the page first, so it never shows the deleted coffee as not found.
    navigate('/', { replace: true })
    void removeCoffee({ id: coffee._id })
  }

  return (
    <>
      {/* Full-bleed bag photo fading into the page; the name sits over its lower edge */}
      <div className="relative -mx-4 sm:mx-0 sm:mt-4 sm:overflow-hidden sm:rounded-t-[28px]">
        <button
          type="button"
          onClick={() => coffee.photoUrl && setViewing(true)}
          disabled={!coffee.photoUrl}
          aria-label={coffee.photoUrl ? 'Виж снимката на пакета' : undefined}
          className="block w-full"
        >
          <BagPhoto src={coffee.photoUrl} alt={`Пакет ${coffee.name}`} className="h-[min(48dvh,420px)] w-full" iconSize={56} />
        </button>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-canvas/40 via-transparent via-35% to-canvas to-85%" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <Link href="/" className="rounded-full bg-canvas/70 p-2.5 backdrop-blur-md transition hover:bg-canvas/95" aria-label="Към рафта">
            <Back />
          </Link>
          <Link href={`/coffee/${id}/edit`} className="rounded-full bg-canvas/70 px-4 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-canvas/95">
            Промени
          </Link>
        </div>
      </div>

      <div className="relative -mt-24 pb-32">
        <div className="rise">
          <div className="flex min-w-0 items-center gap-2">
            {finished && <span className="shrink-0 rounded-full bg-tint px-2.5 py-0.5 text-xs font-medium">Свършено</span>}
            <p className="truncate text-sm text-muted">{[coffee.roaster, coffee.origin].filter(Boolean).join(', ')}</p>
          </div>
          <h1 className="mt-1 text-[40px] leading-[1.02] break-words font-semibold tracking-[-0.03em]">{coffee.name}</h1>
          {coffee.tastingNotes.length > 0 && <p className="mt-2 text-lg text-accent-fg">{coffee.tastingNotes.join(', ')}</p>}
          <div className="mt-2 -ml-1">
            <Rating value={coffee.rating} onChange={rate} size={20} />
          </div>

          {/* Shelf status, holding whichever action isn't in the sticky button */}
          <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-tint py-2 pr-2 pl-4">
            <span className={`h-2 w-2 shrink-0 rounded-full ${finished ? 'border border-muted' : 'bg-accent'}`} aria-hidden />
            <p className={`flex-1 text-sm ${finished ? 'text-muted' : ''}`}>{finished ? 'Пакетът свърши' : 'На рафта ти'}</p>
            {finished ? (
              <Link href={logHref} className={STATUS_ACTION}>
                <Plus width={16} height={16} /> Запиши варене
              </Link>
            ) : (
              <button type="button" onClick={() => finishWithUndo(coffee)} className={STATUS_ACTION}>
                <Check width={16} height={16} /> Пакетът свърши
              </button>
            )}
          </div>
        </div>

        {current ? (
          <>
            {settings.length > 1 && (
              <div className="-mx-4 mt-7 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label="Метод" onKeyDown={arrowKeys}>
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
              <SettingCard key={current.brew.method} brew={current.brew} provisional={current.provisional} tries={current.tries} finished={finished} pin={pin} />

              {current.tries.length > 1 && (
                <section className="mt-8">
                  <h2 className="mb-4 text-xl font-semibold tracking-tight">Как стигна дотук</h2>
                  <ol className="relative ml-2 border-l border-line">
                    {current.tries.map((b) => (
                      <TryRow key={b._id} brew={b} pin={pin} />
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </>
        ) : (
          <p className="card mt-8 p-6 text-balance text-muted">Още няма варения. Запиши първото и настройката, която да помниш, ще стои тук.</p>
        )}

        <About coffee={coffee} />

        <div className="mt-10">
          <button type="button" onClick={remove} className="btn-ghost !text-bitter">
            <Trash width={16} height={16} /> Изтрий
          </button>
        </div>
      </div>

      {/* The main action: log a brew, or restock once the bag is finished. The toast sits above it. */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-canvas from-50% to-transparent px-4 pt-8 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {finished ? (
          <button
            ref={toastAnchor}
            type="button"
            onClick={() => restockWithUndo(coffee)}
            className="btn-primary mx-auto !flex w-full max-w-[44rem] !py-4 !text-base"
          >
            Купих го пак
          </button>
        ) : (
          <Link ref={toastAnchor} href={logHref} className="btn-primary mx-auto !flex w-full max-w-[44rem] !py-4 !text-base">
            <Plus width={18} height={18} /> {current ? logLabel(current.brew.method) : 'Запиши варене'}
          </Link>
        )}
      </div>

      {viewing && coffee.photoUrl && <PhotoViewer src={coffee.photoUrl} alt={`Пакет ${coffee.name}`} onClose={() => setViewing(false)} />}
    </>
  )
}

/** The number to come back to, the recipe around it, and what to do next. */
function SettingCard({ brew, provisional, tries, finished, pin }: { brew: Brew; provisional: boolean; tries: Brew[]; finished: boolean; pin: PinBrew }) {
  const m = METHODS[brew.method]
  const latest = tries[0]
  const move = latest.taste && nextMove(latest.taste)
  const pinned = relativeDay(brew.createdAt)
  const extras = [
    brew.preinfusion && `Преинфузия${brew.preinfusionSec ? ` ${formatTime(brew.preinfusionSec)}` : ''}`,
    brew.bloomSec && `Цъфтеж ${formatTime(brew.bloomSec)}`,
    brew.temperature && `${brew.temperature}°C`,
  ].filter(Boolean)
  const stats = [
    ['Доза', brew.dose != null && grams(brew.dose)],
    [m.isEspresso ? 'Напитка' : 'Вода', brew.yield != null && grams(brew.yield)],
    ['Съотн.', ratio(brew.dose, brew.yield)],
    ['Време', formatTime(brew.timeSec)],
  ] as const

  return (
    <section className="rise card mt-6 p-5">
      <Link href={`/coffee/${brew.coffeeId}/brew/${brew._id}`} className="block">
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          {/* A finished bag's unpinned setting is where the next bag picks up, not still in progress. */}
          <span>{provisional ? (finished ? 'Докъдето стигна' : 'Още настройваш') : 'Настройката ти'}</span>
          {brew.grinder && <span className="truncate">{brew.grinder}</span>}
        </div>
        <div
          className={`mt-1 font-mono leading-none font-semibold text-accent-fg ${
            brew.grindSetting.length > 6 ? 'text-5xl tracking-tight' : 'text-[96px] tracking-[-0.07em]'
          }`}
        >
          {brew.grindSetting || '·'}
        </div>
        <dl className="mt-6 grid grid-cols-4 gap-2">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 font-mono text-[17px] font-medium">{v || '·'}</dd>
            </div>
          ))}
        </dl>
        {extras.length > 0 && <p className="mt-3 font-mono text-sm text-muted">{extras.join(', ')}</p>}
      </Link>

      <div className="mt-5 flex items-center gap-3 rounded-[20px] bg-tint px-4 py-3 text-sm">
        <p className="flex-1">
          {move ? (
            <>
              Последният опит на <span className="font-mono">{latest.grindSetting}</span> {move}
            </>
          ) : provisional ? (
            <>
              Вкусно ли е? Закачи <span className="font-mono">{latest.grindSetting}</span>, за да те чака следващия път.
            </>
          ) : (
            <>
              Закачено {pinned}, след {count(tries.length, 'опит', 'опита')}.
            </>
          )}
        </p>
        {provisional && !move && (
          <button type="button" onClick={() => pin(latest, true)} className="btn shrink-0 bg-ink !px-4 !py-2 text-canvas">
            <Pin width={16} height={16} /> Закачи
          </button>
        )}
      </div>
    </section>
  )
}

function TryRow({ brew: b, pin }: { brew: Brew; pin: PinBrew }) {
  return (
    <li className="relative pb-5 pl-6 last:pb-0">
      <span
        className={`absolute top-2 -left-[5px] h-[9px] w-[9px] rounded-full ${b.dialedIn ? 'bg-accent' : 'border border-muted bg-canvas'}`}
        aria-hidden
      />
      <div className="flex items-start gap-2">
        <Link href={`/coffee/${b.coffeeId}/brew/${b._id}`} className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-lg font-semibold">{b.grindSetting}</span>
            <span className="text-sm">{b.taste ? TASTE_WORD[b.taste] : 'Без оценка'}</span>
            <span className="ml-auto shrink-0 text-sm text-muted">{capitalise(relativeDay(b.createdAt))}</span>
          </div>
          <p className="font-mono text-xs text-muted">
            {[b.dose != null && b.yield != null ? `${grams(b.dose)} към ${grams(b.yield)}` : b.dose != null && grams(b.dose), formatTime(b.timeSec)].filter(Boolean).join(', ')}
          </p>
          {b.notes && <p className="mt-1 text-sm break-words text-muted">{b.notes}</p>}
        </Link>
        <button
          type="button"
          onClick={() => pin(b, !b.dialedIn)}
          className={`-mt-1 rounded-full p-2 transition ${b.dialedIn ? 'text-accent-fg' : 'text-muted/60 hover:bg-surface hover:text-ink'}`}
          aria-label="Закачи като настройка"
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
    ['Обработка', coffee.process],
    ['Сорт', coffee.varietal],
    ['Регион', coffee.region],
    ['Производител', coffee.producer],
    ['Височина', coffee.altitude],
    ['Изпичане', coffee.roastLevel && roastLabel(coffee.roastLevel)],
    ['Пакет', coffee.bagWeight && grams(coffee.bagWeight)],
  ].filter(([, v]) => v) as [string, string][]
  if (!facts.length && !coffee.notes) return null
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">За кафето</h2>
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
