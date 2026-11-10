import { useUser } from '@clerk/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useSignOut } from '../lib/session'

const AKAUNT = 'https://onovaza.com/akaunt'

/**
 * The avatar in Home's header, with exactly two items: Акаунт (the hub) and
 * Изход. Not Clerk's `<UserButton>`: its menu is English and opens the Account
 * Portal, which production turns off. A WAI-ARIA menu button: Enter, Space or
 * the arrows open it, the arrows move, Escape closes and hands focus back.
 */
export default function AccountMenu() {
  const { user } = useUser()
  const signOut = useSignOut()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  // Which item to focus once the menu renders.
  const focusOnOpen = useRef<'first' | 'last'>('first')
  const id = useId()

  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]

  useEffect(() => {
    if (!open) return
    const list = items()
    ;(focusOnOpen.current === 'last' ? list.at(-1) : list[0])?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const openAt = (where: 'first' | 'last') => {
    focusOnOpen.current = where
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openAt(e.key === 'ArrowUp' ? 'last' : 'first')
    }
  }

  const onMenuKey = (e: KeyboardEvent) => {
    const list = items()
    const i = list.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => {
      e.preventDefault()
      list[(n + list.length) % list.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(list.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') setOpen(false)
  }

  const name = user?.firstName || user?.primaryEmailAddress?.emailAddress || ''
  const initial = name.charAt(0).toUpperCase() || '?'

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        id={`${id}-button`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-label="Меню на Акаунта"
        onClick={() => (open ? setOpen(false) : openAt('first'))}
        onKeyDown={onButtonKey}
        className="grid size-11 place-items-center rounded-full hover:bg-surface"
      >
        <Avatar imageUrl={user?.hasImage ? user.imageUrl : undefined} initial={initial} />
      </button>
      {open && (
        <div
          ref={menu}
          id={`${id}-menu`}
          role="menu"
          aria-labelledby={`${id}-button`}
          lang="bg"
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-40 mt-1 min-w-44 rounded-[20px] border border-line bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgb(6_14_11/0.45)]"
        >
          <a role="menuitem" href={AKAUNT} tabIndex={-1} onClick={() => setOpen(false)} className={item}>
            Акаунт
          </a>
          <button
            role="menuitem"
            type="button"
            tabIndex={-1}
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
            className={item}
          >
            Изход
          </button>
        </div>
      )}
    </div>
  )
}

const item =
  'flex w-full items-center rounded-2xl px-4 py-3 text-left text-[15px] text-ink outline-none hover:bg-tint focus-visible:bg-tint focus-visible:[outline:2px_solid_var(--accent)] focus-visible:-outline-offset-2'

/** The photo when you have one, otherwise your initial. Falls back to the initial if it fails to load. */
function Avatar({ imageUrl, initial }: { imageUrl?: string; initial: string }) {
  const [failed, setFailed] = useState(false)
  if (imageUrl && !failed) {
    return <img src={imageUrl} alt="" onError={() => setFailed(true)} className="size-8 rounded-full object-cover" />
  }
  return (
    <span aria-hidden className="grid size-8 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent-fg">
      {initial}
    </span>
  )
}
