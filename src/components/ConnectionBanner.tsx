import { useConvexConnectionState } from 'convex/react'
import { useEffect, useState } from 'react'

/** A blip shorter than this (a reconnect, a tunnel) shows nothing. */
const GRACE_MS = 3000

/**
 * "Няма връзка" while Convex has no WebSocket, after a short grace period, and
 * gone the moment it reconnects. Кафето is online only, so this is the whole
 * offline story. The live region stays mounted so the change is announced.
 */
export default function ConnectionBanner() {
  const { isWebSocketConnected } = useConvexConnectionState()
  const [late, setLate] = useState(false)

  useEffect(() => {
    if (isWebSocketConnected) return
    const timer = setTimeout(() => setLate(true), GRACE_MS)
    return () => {
      clearTimeout(timer)
      setLate(false)
    }
  }, [isWebSocketConnected])

  const show = late && !isWebSocketConnected
  return (
    <div
      role="status"
      lang="bg"
      className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.75rem)] z-50 flex justify-center px-4"
    >
      {show && (
        <p className="rise flex items-center gap-2 rounded-full bg-ink py-2 pr-4 pl-3.5 text-[15px] font-semibold text-canvas shadow-[0_12px_32px_-12px_rgb(6_14_11/0.6)]">
          <span aria-hidden className="size-2 rounded-full bg-bitter" />
          Няма връзка
        </p>
      )}
    </div>
  )
}
