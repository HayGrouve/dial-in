import { useEffect, useRef, useState } from 'react'
import type { BrewMethod } from '../lib/db'
import { METHODS, METHOD_ORDER } from '../lib/methods'
import { Check, Chevron } from './icons'

/** Methods shown as chips; the rest live in the "More" menu. */
const PRIMARY: BrewMethod[] = ['espresso', 'pourover']
const SECONDARY = METHOD_ORDER.filter((m) => !PRIMARY.includes(m))

const chip = (active: boolean) =>
  `flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
    active ? 'border-espresso bg-espresso text-foam' : 'border-husk bg-oat text-roast hover:border-crema'
  }`

export function MethodPicker({ value, onChange }: { value: BrewMethod; onChange: (m: BrewMethod) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const secondaryActive = SECONDARY.includes(value)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="mb-4 flex gap-1.5" role="radiogroup" aria-label="Brew method">
      {PRIMARY.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} className={chip(value === k)}>
          {METHODS[k].label}
        </button>
      ))}

      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={chip(secondaryActive)}
        >
          {secondaryActive ? METHODS[value].label : 'More'}
          <Chevron width={16} height={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div role="menu" className="card absolute top-full right-0 z-30 mt-1.5 w-44 overflow-hidden py-1 shadow-lg shadow-espresso/15">
            {SECONDARY.map((k) => (
              <button
                key={k}
                type="button"
                role="menuitemradio"
                aria-checked={value === k}
                onClick={() => {
                  onChange(k)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-husk/60"
              >
                {METHODS[k].label}
                {value === k && <Check width={16} height={16} className="text-crema-deep" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
