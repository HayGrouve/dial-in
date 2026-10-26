// PROTOTYPE, throwaway. Lives only on the `prototype/coffee-page-actions` branch; never merge.
import { useEffect } from 'react'
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

/**
 * Floating variant switcher: ← / → (buttons or arrow keys) cycle `?variant=`, keeping every other
 * search param (like `?method=`). No `?variant=` means today's page, which sits between C and A.
 *
 * Sits at the top of the screen rather than the bottom: on the coffee page the bottom edge is
 * exactly what's being judged (sticky button, undo toast), so the switcher stays out of it.
 */
export function PrototypeSwitcher({ variants, state }: { variants: PrototypeVariant[]; state?: string }) {
  const [path, navigate] = useLocation()
  const search = useSearch()
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
    <div
      className="fixed top-[calc(max(env(safe-area-inset-top),0.75rem)+3.25rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/90 p-1 font-mono text-xs text-white shadow-lg ring-2 ring-fuchsia-500"
      role="toolbar"
      aria-label="Prototype variants"
    >
      <button type="button" className={arrow} onClick={() => go(-1)} aria-label="Previous variant">
        ‹
      </button>
      <div className="min-w-0 px-1 text-center leading-tight whitespace-nowrap">
        <div className="font-semibold">{current ? `${current.key} · ${current.name}` : "Today's page"}</div>
        {state && <div className="text-[10px] text-fuchsia-300">{state}</div>}
      </div>
      <button type="button" className={arrow} onClick={() => go(1)} aria-label="Next variant">
        ›
      </button>
    </div>
  )
}
