import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fmtInner, fmtOuter, fmtSize, formatOpus, OPUS_MAX, OPUS_MIN, opusMicrons, opusPosition, parseOpus, toTwelfths } from '../lib/opus'
import { getOpusInner, setOpusInner } from '../lib/prefs'

const TICK = 14
const clamp = (t: number) => Math.min(OPUS_MAX, Math.max(OPUS_MIN, t))

/**
 * A big scrollable wheel for the Fellow Opus: pick a grind size by feel and it tells you
 * where to set the outer and inner rings. Writes the result into the grind setting.
 */
export function OpusDial({ value, fallback, onChange }: { value: string; fallback?: string; onChange: (v: string) => void }) {
  const ruler = useRef<HTMLDivElement>(null)
  /** Size we jumped to because it was typed in the field; that scroll must not rewrite the field. */
  const typedTo = useRef<number>(undefined)
  const [home, setHome] = useState(getOpusInner)
  const [size, setSize] = useState(() => {
    const start = parseOpus(value) ?? parseOpus(fallback)
    return start ? toTwelfths(start) : 72
  })
  // Show the rings exactly as written in the field when they match; otherwise work them out.
  const written = parseOpus(value)
  const pos = written && toTwelfths(written) === size ? written : opusPosition(size, home)

  const scrollTo = (t: number, behavior: ScrollBehavior = 'smooth') => {
    ruler.current?.scrollTo({ left: clamp(t) * TICK, behavior })
  }

  useLayoutEffect(() => {
    scrollTo(size, 'instant')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount only

  // Follow edits typed straight into the grind field.
  useEffect(() => {
    const typed = written && toTwelfths(written)
    if (typed == null || typed === size) return
    typedTo.current = typed
    scrollTo(typed, 'instant')
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps -- react to the field, not our own scrolling

  const onScroll = () => {
    const t = clamp(Math.round((ruler.current?.scrollLeft ?? 0) / TICK))
    if (t === size) return
    setSize(t)
    const typed = t === typedTo.current
    typedTo.current = undefined
    if (typed) return
    const p = opusPosition(t, home)
    if (p) onChange(formatOpus(p))
  }

  const step = (d: number) => scrollTo(size + d)

  return (
    <div className="space-y-3 rounded-[20px] border border-line bg-canvas/60 p-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <div className="label !mb-0.5">Outer ring</div>
          <div className="num font-mono text-3xl font-semibold">{pos ? fmtOuter(pos.outer) : '—'}</div>
        </div>
        <div>
          <div className="label !mb-0.5">Inner ring</div>
          <div className={`num font-mono text-3xl font-semibold ${pos && pos.inner !== home ? 'text-accent-fg' : ''}`}>{pos ? fmtInner(pos.inner) : '—'}</div>
        </div>
      </div>

      <div className="relative">
        <div
          ref={ruler}
          role="slider"
          tabIndex={0}
          aria-label="Opus grind size"
          aria-valuemin={OPUS_MIN / 12}
          aria-valuemax={OPUS_MAX / 12}
          aria-valuenow={size / 12}
          aria-valuetext={pos ? `Outer ${fmtOuter(pos.outer)}, inner ${fmtInner(pos.inner)}, about ${opusMicrons(size)} microns` : undefined}
          onScroll={onScroll}
          onKeyDown={(e) => {
            const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -3, PageUp: 3 }[e.key]
            if (!d) return
            e.preventDefault()
            step(d)
          }}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-lg py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingInline: `calc(50% - ${TICK / 2}px)` }}
        >
          {Array.from({ length: OPUS_MAX + 1 }, (_, i) => (
            <div key={i} className="flex shrink-0 snap-center flex-col items-center" style={{ width: TICK }}>
              <div
                className={`w-0.5 rounded-full ${
                  i % 12 === 0 ? 'h-9 bg-ink' : i % 3 === 0 ? 'h-6 bg-muted' : 'h-3 bg-accent'
                }`}
              />
              <span className="num mt-1 h-4 text-xs text-muted">{i % 12 === 0 ? i / 12 : ''}</span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute top-1 left-1/2 h-11 w-1 -translate-x-1/2 rounded-full bg-accent-fg" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-canvas" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-canvas" />
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost !px-4" onClick={() => step(-1)} disabled={size <= OPUS_MIN}>
          − Finer
        </button>
        <div className="num flex-1 text-center text-sm leading-tight text-muted">
          Size <span className="font-semibold text-ink">{fmtSize(size)}</span>
          <div className="text-xs">≈ {opusMicrons(size)} µm</div>
        </div>
        <button type="button" className="btn-ghost !px-4" onClick={() => step(1)} disabled={size >= OPUS_MAX}>
          Coarser +
        </button>
      </div>

      {pos && pos.inner !== home ? (
        <div className="flex items-center gap-3 rounded-lg bg-accent/10 p-2.5 text-sm">
          <p className="flex-1">
            Move the inner ring from <b className="num">{fmtInner(home)}</b> to <b className="num">{fmtInner(pos.inner)}</b> — it sits under the load bin.
          </p>
          <button
            type="button"
            className="btn-ghost shrink-0 !px-3 !py-1.5"
            onClick={() => {
              setOpusInner(pos.inner)
              setHome(pos.inner)
            }}
          >
            Done
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted">Short amber ticks are the in-between sizes the inner ring unlocks.</p>
      )}
    </div>
  )
}
