import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { BrewMethod } from '../lib/db'
import { METHODS, METHOD_ORDER } from '../lib/methods'
import { Check, Chevron } from './icons'

/** Methods shown as chips; the rest live in the "More" menu. */
const PRIMARY: BrewMethod[] = ['espresso', 'pourover']
const SECONDARY = METHOD_ORDER.filter((m) => !PRIMARY.includes(m))

const chip = (active: boolean) =>
  `flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition ${
    active ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:bg-tint hover:text-ink'
  }`

export function MethodPicker({ value, onChange }: { value: BrewMethod; onChange: (m: BrewMethod) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const secondaryActive = SECONDARY.includes(value)

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    // Focus the checked item (or the first) so the arrow keys work straight away.
    const items = menu.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]')
    ;(menu.current?.querySelector<HTMLElement>('[aria-checked=true]') ?? items?.[0])?.focus()
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') return close(true)
    if (e.key === 'Tab') return close(false)
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=menuitemradio]')]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key]
    if (next == null) return
    e.preventDefault()
    items[(next + items.length) % items.length].focus()
  }

  return (
    <div className="mb-4 flex gap-1.5" role="group" aria-label="Brew method">
      {PRIMARY.map((k) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={chip(value === k)}>
          {METHODS[k].label}
        </button>
      ))}

      <div ref={ref} className="relative">
        <button
          ref={trigger}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          className={chip(secondaryActive)}
        >
          {secondaryActive ? METHODS[value].label : 'More'}
          <Chevron width={16} height={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div ref={menu} role="menu" aria-label="More brew methods" onKeyDown={onMenuKey} className="absolute top-full right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-[20px] border border-line bg-surface py-1 shadow-lg shadow-black/20">
            {SECONDARY.map((k) => (
              <button
                key={k}
                type="button"
                role="menuitemradio"
                aria-checked={value === k}
                onClick={() => {
                  onChange(k)
                  close(true)
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-tint"
              >
                {METHODS[k].label}
                {value === k && <Check width={16} height={16} className="text-accent-fg" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
