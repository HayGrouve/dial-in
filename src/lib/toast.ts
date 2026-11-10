import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { useSyncExternalStore } from 'react'
import { api } from '../../convex/_generated/api'
import { convex } from './convex'
import type { Coffee } from './db'

/** Puts back what a reversible action changed. */
export type Undo = () => Promise<void>

/** What a new bag brings on Bought it again: a photo, details to fill in. */
export type RestockChanges = NonNullable<FunctionArgs<typeof api.coffees.restock>['changes']>

/** Finish and Restock return the fields they replaced; Undo hands them back to `coffees.restore`. */
const undoWith =
  (replaced: FunctionReturnType<typeof api.coffees.finish>): Undo =>
  async () => {
    await convex.mutation(api.coffees.restore, replaced)
  }

/** An action that just happened, with a way to take it back. */
export interface Toast {
  id: number
  /** What happened, set apart from the coffee name: "Свърши:", "Пак на рафта:". */
  lead: string
  name: string
  undo: Undo
}

// One toast for the whole app, outside React state, so it survives navigation between pages.
let toast: Toast | null = null
let inset = 0
let lastId = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Shows a toast with Undo, replacing any toast already showing. */
export function showToast(next: Omit<Toast, 'id'>) {
  toast = { ...next, id: ++lastId }
  emit()
}

/** Hides the toast; with an id, only if that toast is still the one showing. */
export function dismissToast(id?: number) {
  if (!toast || (id !== undefined && toast.id !== id)) return
  toast = null
  emit()
}

export function useToast() {
  return useSyncExternalStore(subscribe, () => toast)
}

/** Finishes a coffee and offers to undo it. */
export async function finishWithUndo(coffee: Pick<Coffee, '_id' | 'name'>) {
  const replaced = await convex.mutation(api.coffees.finish, { id: coffee._id })
  showToast({ lead: 'Свърши:', name: coffee.name, undo: undoWith(replaced) })
}

/**
 * Puts a finished coffee back on the shelf and offers to undo it. `changes` carries anything the
 * new bag brings (an uploaded photo, details to fill in); undo restores the previous record exactly.
 */
export async function restockWithUndo(coffee: Pick<Coffee, '_id' | 'name'>, changes?: RestockChanges) {
  const replaced = await convex.mutation(api.coffees.restock, { id: coffee._id, changes })
  showToast({ lead: 'Пак на рафта:', name: coffee.name, undo: undoWith(replaced) })
}

/**
 * Ref for the control a page pins to the bottom of the screen (a sticky action button, a floating
 * button): the toast sits just above it instead of covering it. One per page.
 */
export function toastAnchor(el: HTMLElement | null) {
  if (!el) return
  const measure = () => {
    inset = Math.max(0, window.innerHeight - el.getBoundingClientRect().top)
    emit()
  }
  const observer = new ResizeObserver(measure)
  observer.observe(el)
  window.addEventListener('resize', measure)
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', measure)
    inset = 0
    emit()
  }
}

/** Space taken by the page's pinned bottom control, in px; 0 when it has none. */
export function useToastInset() {
  return useSyncExternalStore(subscribe, () => inset)
}
