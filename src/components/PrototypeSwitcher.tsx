// PROTOTYPE, throwaway. Lives only on the `prototype/returning-coffee-offer` branch; never merge.
import { useEffect, useState } from 'react'
import { useLocation, useSearch } from 'wouter'

/**
 * Prototype UI shows in dev and on Vercel preview deployments. Previews build in production mode,
 * so NODE_ENV alone would hide it there.
 */
export const PROTOTYPE = import.meta.env.DEV || location.hostname.includes('vercel.app')

export interface PrototypeVariant {
  key: string
  name: string
}

export interface PrototypeAction {
  label: string
  onClick: () => void
}

/**
 * Floating variant switcher: ‹ / › (buttons or arrow keys) cycle `?variant=`, keeping every other
 * search param. No `?variant=` means today's page, which sits between C and A.
 *
 * Sits at the TOP of the screen: on New coffee the bottom edge is where Save lives, and the offer
 * itself may sit there, so the switcher stays out of it. `actions` render as a second row of chips
 * (e.g. "Simulate scan" presets, so the offer can be judged without a Gemini key).
 */
export function PrototypeSwitcher({
  variants,
  state,
  actions,
  actionsLabel,
}: {
  variants: PrototypeVariant[]
  state?: string
  actions?: PrototypeAction[]
  actionsLabel?: string
}) {
  const [path, navigate] = useLocation()
  const search = useSearch()
  const [open, setOpen] = useState(true)
  const params = new URLSearchParams(search)
  const currentKey = params.get('variant')
  const keys = [null, ...variants.map((v) => v.key)]
  const index = Math.max(0, keys.indexOf(currentKey))
  const current = variants.find((v) => v.key === currentKey)

  const go = (step: number) => {
    const next = keys[(index + step + keys.length) % keys.length]
    const p = new URLSearchParams(search)
    if (next) p.set('variant', next)
    else p.delete('variant')
    const qs = p.toString()
    navigate(`${path}${qs ? `?${qs}` : ''}`, { replace: true })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = document.activeElement as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable], [role=tablist], [role=radiogroup], [role=slider]')) return
      e.preventDefault()
      go(e.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!PROTOTYPE) return null

  const arrow = 'grid h-8 w-8 place-items-center rounded-full text-base hover:bg-white/15'
  return (
    <div className="fixed top-[calc(max(env(safe-area-inset-top),0.75rem)+3.25rem)] left-1/2 z-50 flex w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center gap-1 font-mono text-xs text-white">
      <div className="flex items-center gap-1 rounded-full bg-black/90 p-1 shadow-lg ring-2 ring-fuchsia-500" role="toolbar" aria-label="Prototype variants">
        <button type="button" className={arrow} onClick={() => go(-1)} aria-label="Previous variant">
          ‹
        </button>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="min-w-0 rounded-full px-1 text-center leading-tight whitespace-nowrap" title="Show or hide the simulate buttons">
          <div className="font-semibold">{current ? `${current.key} · ${current.name}` : "Today's page"}</div>
          {state && <div className="text-[10px] text-fuchsia-300">{state}</div>}
        </button>
        <button type="button" className={arrow} onClick={() => go(1)} aria-label="Next variant">
          ›
        </button>
      </div>
      {open && actions && actions.length > 0 && (
        <div className="flex items-center rounded-full bg-black/85 p-0.5 text-[11px] shadow-lg ring-1 ring-fuchsia-500/60" role="toolbar" aria-label={actionsLabel ?? 'Prototype actions'}>
          {actionsLabel && <span className="pr-0.5 pl-2.5 text-fuchsia-300">{actionsLabel}</span>}
          {actions.map((a) => (
            <button key={a.label} type="button" onClick={a.onClick} className="rounded-full px-2 py-1.5 whitespace-nowrap text-fuchsia-50 hover:bg-white/15">
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
