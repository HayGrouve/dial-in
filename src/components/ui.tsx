import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'wouter'
import { Back, Bean, Chevron, Close, Star } from './icons'

export function Header({ title, back, right, onBack }: { title?: ReactNode; back?: string; right?: ReactNode; onBack?: (e: MouseEvent) => void }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 bg-canvas/85 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur">
      {back && (
        <Link href={back} onClick={onBack} className="-ml-2 rounded-full p-2 text-muted hover:text-ink" aria-label="Back">
          <Back />
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{title}</h1>
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
      <h2 className="text-lg leading-tight font-semibold tracking-tight">{title}</h2>
      {sub && <p className="mt-0.5 truncate text-sm text-muted">{sub}</p>}
    </div>
  )

  return (
    <section className="card overflow-hidden">
      {collapsible ? (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
          {heading}
          <Chevron className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <div className="flex items-center gap-3 p-4 pb-3">{heading}</div>
      )}
      {isOpen && <div className={flush ? 'border-t border-line' : 'space-y-4 px-4 pb-4'}>{children}</div>}
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
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              active ? (o.className ?? 'border-ink bg-ink text-canvas') : 'border-line text-muted hover:bg-tint hover:text-ink'
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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span className="text-[15px]">{label}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-canvas shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

export function Rating({ value, onChange, size = 22 }: { value?: number; onChange?: (v: number | undefined) => void; size?: number }) {
  const read = onChange ? { role: 'group', 'aria-label': 'Rating' } : { role: 'img', 'aria-label': value ? `${value} of 5 stars` : 'Not rated' }
  return (
    <div className="flex gap-0.5 text-accent" {...read}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            aria-label={n === 1 ? '1 star' : `${n} stars`}
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? undefined : n)}
            className="rounded-full p-0.5 hover:brightness-110"
          >
            <Star filled={!!value && n <= value} width={size} height={size} />
          </button>
        ) : (
          <Star key={n} filled={!!value && n <= value} width={size} height={size} />
        ),
      )}
    </div>
  )
}

/** Must not sit inside a <label>: the chips are buttons, and a label would click the first one. */
export function TagInput({ value, onChange, placeholder, label }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; label: string }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...new Set([...value, ...parts])])
    setDraft('')
  }
  return (
    <div className="input flex flex-wrap items-center gap-1.5 !py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
      {value.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(value.filter((v) => v !== t))}
          className="rounded-full bg-accent/15 px-2.5 py-0.5 text-sm text-accent-fg hover:bg-accent/25"
          aria-label={`Remove ${t}`}
        >
          {t} <span aria-hidden>×</span>
        </button>
      ))}
      <input
        aria-label={label}
        name={label}
        autoComplete="off"
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
        className="min-w-24 flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted/60"
      />
    </div>
  )
}

export function BagPhoto({ blob, className = '', iconSize = 36, alt = 'Coffee bag' }: { blob?: Blob; className?: string; iconSize?: number; alt?: string }) {
  const img = useRef<HTMLImageElement>(null)

  // Object URLs are an external resource: create per blob, revoke on change/unmount.
  useEffect(() => {
    if (!blob || !img.current) return
    const url = URL.createObjectURL(blob)
    img.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  if (blob) return <img ref={img} alt={alt} className={`object-cover ${className}`} />
  return (
    <div className={`grid place-items-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--accent)_14%,var(--tint)),var(--tint)_70%)] text-muted/50 ${className}`}>
      <Bean width={iconSize} height={iconSize} />
    </div>
  )
}

/** Full-screen view of a bag photo; tap anywhere to close. */
export function PhotoViewer({ blob, alt, onClose }: { blob: Blob; alt?: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)

  // Modal: focus the close button, lock page scroll, and hand focus back on the way out.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    close.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      opener?.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bag photo"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center overscroll-contain bg-black/85 p-4 backdrop-blur-sm"
    >
      <BagPhoto blob={blob} alt={alt} className="max-h-full max-w-full rounded-[20px] !object-contain" />
      <button
        ref={close}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        // The close button is the only focusable element, so Tab stays on it.
        onKeyDown={(e) => e.key === 'Tab' && e.preventDefault()}
        className="absolute top-[max(env(safe-area-inset-top),1rem)] right-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
        aria-label="Close"
      >
        <Close />
      </button>
    </div>
  )
}
