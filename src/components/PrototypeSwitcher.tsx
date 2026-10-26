// PROTOTYPE: floating variant switcher for throwaway UI prototypes. Never ship this.
// Shown in dev and on Vercel preview deployments (which build in production mode).
import { useEffect, type ReactNode } from 'react'

export const PROTOTYPE_ENABLED = import.meta.env.DEV || (typeof location !== 'undefined' && location.hostname.includes('vercel.app'))

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
  extra,
}: {
  variants: { key: string; name: string }[]
  current: string
  onChange: (key: string) => void
  extra?: ReactNode
}) {
  const index = Math.max(0, variants.findIndex((v) => v.key === current))
  const step = (d: number) => onChange(variants[(index + d + variants.length) % variants.length].key)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select, [contenteditable]') || t.isContentEditable)) return
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!PROTOTYPE_ENABLED) return null
  const v = variants[index]
  // Sits top-centre rather than bottom-centre: the bottom of this page belongs to the
  // "New coffee" button and the undo toast, which are part of what's being judged.
  return (
    <div
      className="fixed top-[max(env(safe-area-inset-top),0.5rem)] left-1/2 z-[70] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-dashed border-fuchsia-300/70 bg-black/85 p-1 font-sans text-[13px] text-white shadow-lg backdrop-blur"
      role="group"
      aria-label="Prototype variant switcher"
    >
      <button type="button" onClick={() => step(-1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15" aria-label="Previous variant">
        ‹
      </button>
      <span className="px-1.5 whitespace-nowrap" aria-live="polite">
        <b>{v.key}</b> <span className="text-white/70">{v.name}</span>
      </span>
      <button type="button" onClick={() => step(1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15" aria-label="Next variant">
        ›
      </button>
      {extra}
    </div>
  )
}
