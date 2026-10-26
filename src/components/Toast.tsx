import { useEffect, useRef, useState } from 'react'
import { dismissToast, useToast, useToastInset, type Toast as ToastData } from '../lib/toast'

const SHOW_MS = 6000
/** Gap between the toast and the page's pinned bottom control. */
const GAP_PX = 12

/**
 * The app's one toast, mounted once outside the routes. The live region stays in the page so
 * screen readers announce each new toast politely; focus never moves to it.
 */
export default function Toast() {
  const toast = useToast()
  const inset = useToastInset()
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-40 flex justify-center px-4"
      style={inset ? { bottom: inset + GAP_PX } : undefined}
    >
      {/* Keyed so a replacing toast starts its own timer and entrance. */}
      {toast && <Body key={toast.id} toast={toast} />}
    </div>
  )
}

function Body({ toast }: { toast: ToastData }) {
  // Paused while a pointer is on it (hover, or a finger pressing) or it holds keyboard focus.
  const [pointer, setPointer] = useState(false)
  const [focus, setFocus] = useState(false)
  const remaining = useRef(SHOW_MS)
  // Where focus was before it entered the toast, to hand it back when the toast goes.
  const cameFrom = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (pointer || focus) return
    const start = Date.now()
    const timer = setTimeout(() => dismissToast(toast.id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - start
    }
  }, [pointer, focus, toast.id])

  const undo = () => {
    dismissToast(toast.id)
    if (cameFrom.current?.isConnected) cameFrom.current.focus()
    void toast.undo()
  }

  return (
    <div
      onPointerEnter={() => setPointer(true)}
      onPointerLeave={() => setPointer(false)}
      onPointerCancel={() => setPointer(false)}
      onFocus={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) cameFrom.current = e.relatedTarget as HTMLElement | null
        setFocus(true)
      }}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocus(false)}
      className="rise pointer-events-auto flex max-w-md min-w-0 items-center gap-3 rounded-full bg-ink py-1.5 pr-1.5 pl-5 text-canvas shadow-[0_12px_32px_-12px_rgb(6_14_11/0.6)]"
    >
      <p className="min-w-0 truncate text-[15px]">
        <span className="font-semibold">{toast.lead}</span> {toast.name}
      </p>
      <button type="button" onClick={undo} className="btn shrink-0 bg-accent !px-4 !py-2 text-on-accent hover:brightness-105">
        Undo
      </button>
    </div>
  )
}
