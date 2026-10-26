// PROTOTYPE, throwaway. A stand-in for the app-wide undo toast from #11 (built separately): one at a
// time, about 6 s, paused while hovered or focused, role=status, sits above the sticky bottom bar.
import { useEffect, useRef, useSyncExternalStore } from 'react'

interface Toast {
  id: number
  message: string
  undo?: () => void
}

let current: Toast | null = null
let seq = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function showProtoToast(t: Omit<Toast, 'id'>) {
  current = { ...t, id: ++seq }
  emit()
}
const dismiss = () => {
  current = null
  emit()
}

export function ProtoToastHost() {
  const toast = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => current,
  )
  const timer = useRef<number>(undefined)
  const start = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(dismiss, 6000)
  }
  const pause = () => window.clearTimeout(timer.current)

  useEffect(() => {
    if (toast) start()
    return pause
  }, [toast])

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),1rem)+4.75rem)] z-40 flex justify-center px-4">
      {toast && (
        <div
          key={toast.id}
          onPointerEnter={pause}
          onPointerLeave={start}
          onFocus={pause}
          onBlur={start}
          className="rise pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-[#11241b] py-2 pr-2 pl-5 text-sm text-[#e9ede6] shadow-xl ring-1 ring-white/10 outline-2 outline-offset-2 outline-fuchsia-500/70 outline-dashed"
        >
          <span className="min-w-0 truncate">{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.()
                dismiss()
              }}
              className="shrink-0 rounded-full px-3 py-1.5 font-semibold text-[#e8a93b] hover:bg-white/10"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
