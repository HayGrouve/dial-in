import { useEffect, type KeyboardEvent, type MouseEvent } from 'react'

/**
 * Warns before leaving a form with unsaved changes: the browser prompt covers reloads and closing
 * the tab, and the returned click handler goes on in-app links that lead away from the form.
 */
export function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])
  return (e: MouseEvent) => {
    if (dirty && !confirm('Discard your changes?')) e.preventDefault()
  }
}

/** Arrow keys for radio groups and tab lists: focus and select the previous/next option. */
export function arrowKeys(e: KeyboardEvent<HTMLElement>) {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
  if (!step) return
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=radio], [role=tab]')]
  const i = items.indexOf(document.activeElement as HTMLElement)
  if (i < 0) return
  e.preventDefault()
  const next = items[(i + step + items.length) % items.length]
  next.focus()
  next.click()
}
