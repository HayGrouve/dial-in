import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { Back, Bean, Chevron, Close, Star } from './icons'

export function Header({ title, back, right }: { title?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 bg-foam/85 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
      {back && (
        <Link href={back} className="-ml-2 rounded-full p-2 text-roast hover:text-espresso" aria-label="Back">
          <Back />
        </Link>
      )}
      <div className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{title}</div>
      {right}
    </header>
  )
}

/**
 * A titled card that groups related content. Collapsible sections show `summary`
 * (e.g. the values already filled in) while closed, so nothing is hidden silently.
 */
export function Section({
  title,
  hint,
  summary,
  collapsible,
  defaultOpen = true,
  flush,
  children,
}: {
  title: ReactNode
  hint?: ReactNode
  summary?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  /** Drop body padding, for lists that manage their own row spacing. */
  flush?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = !collapsible || open
  const sub = !isOpen && summary ? summary : hint
  const heading = (
    <div className="min-w-0 flex-1">
      <h2 className="font-display text-lg leading-tight font-semibold">{title}</h2>
      {sub && <p className="mt-0.5 truncate text-sm text-roast">{sub}</p>}
    </div>
  )

  return (
    <section className="card overflow-hidden">
      {collapsible ? (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
          {heading}
          <Chevron className={`shrink-0 text-roast transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <div className="flex items-center gap-3 p-4 pb-3">{heading}</div>
      )}
      {isOpen && <div className={flush ? 'border-t border-husk' : 'space-y-4 px-4 pb-4'}>{children}</div>}
    </section>
  )
}

/** Labelled form row. Use `group` for button groups, which must not sit inside a <label>. */
export function Field({ label, children, className = '', group }: { label: string; children: ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </Tag>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | undefined
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; className?: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              active ? (o.className ?? 'border-espresso bg-espresso text-foam') : 'border-husk bg-oat text-roast hover:border-crema'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-1 text-left">
      <span className="text-[15px]">{label}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-crema' : 'bg-husk'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-oat shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  )
}

export function Rating({ value, onChange, size = 22 }: { value?: number; onChange?: (v: number | undefined) => void; size?: number }) {
  return (
    <div className="flex gap-0.5 text-crema">
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" aria-label={`${n} stars`} onClick={() => onChange(value === n ? undefined : n)} className="p-0.5">
            <Star filled={!!value && n <= value} width={size} height={size} />
          </button>
        ) : (
          <Star key={n} filled={!!value && n <= value} width={size} height={size} />
        ),
      )}
    </div>
  )
}

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))])
    setDraft('')
  }
  return (
    <div className="input flex flex-wrap items-center gap-1.5 !py-2">
      {value.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(value.filter((v) => v !== t))}
          className="rounded-full bg-crema/15 px-2.5 py-0.5 text-sm text-crema-deep"
          title="Remove"
        >
          {t} ×
        </button>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent py-0.5 outline-none placeholder:text-roast/60"
      />
    </div>
  )
}

export function BagPhoto({ blob, className = '', iconSize = 36 }: { blob?: Blob; className?: string; iconSize?: number }) {
  const img = useRef<HTMLImageElement>(null)

  // Object URLs are an external resource: create per blob, revoke on change/unmount.
  useEffect(() => {
    if (!blob || !img.current) return
    const url = URL.createObjectURL(blob)
    img.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  if (blob) return <img ref={img} alt="Coffee bag" className={`object-cover ${className}`} />
  return (
    <div className={`grid place-items-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--crema)_18%,var(--husk)),var(--husk)_70%)] text-roast/50 ${className}`}>
      <Bean width={iconSize} height={iconSize} />
    </div>
  )
}

/** Full-screen view of a bag photo; tap anywhere to close. */
export function PhotoViewer({ blob, onClose }: { blob: Blob; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-label="Bag photo" onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-sm">
      <BagPhoto blob={blob} className="max-h-full max-w-full rounded-2xl !object-contain" />
      <button type="button" className="absolute top-[max(env(safe-area-inset-top),1rem)] right-4 rounded-full bg-white/15 p-2 text-white" aria-label="Close">
        <Close />
      </button>
    </div>
  )
}
