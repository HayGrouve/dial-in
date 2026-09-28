/**
 * Fellow Opus (first generation) grind math.
 *
 * The outer ring runs 1–11 in quarter steps. Each inner-ring notch shifts the whole
 * outer scale by 1/6 of a number (+ coarser, − finer), up to 6 notches either way.
 * Together they reach every 1/12 of a number from 0 to 12 — including the "hidden"
 * sizes between the outer ring's quarter marks.
 *
 * Grind sizes are kept as integer twelfths so the math stays exact.
 */

export const OPUS_MIN = 0
export const OPUS_MAX = 144
export const INNER_LIMIT = 6

export interface OpusPosition {
  /** Outer ring setting, 1–11 in quarter steps. */
  outer: number
  /** Inner ring notch, −6…+6. */
  inner: number
}

/** Ring positions for a grind size, moving the inner ring as little as possible from `home`. */
export function opusPosition(twelfths: number, home = 0): OpusPosition | undefined {
  let best: OpusPosition | undefined
  for (let inner = -INNER_LIMIT; inner <= INNER_LIMIT; inner++) {
    const o = twelfths - 2 * inner
    if (o % 3 !== 0 || o < 12 || o > 132) continue
    const better = !best || Math.abs(inner - home) < Math.abs(best.inner - home) || (Math.abs(inner - home) === Math.abs(best.inner - home) && Math.abs(inner) < Math.abs(best.inner))
    if (better) best = { outer: o / 12, inner }
  }
  return best
}

export const fmtOuter = (outer: number) => String(Number(outer.toFixed(2)))
export const fmtInner = (inner: number) => (inner > 0 ? `+${inner}` : String(inner))
export const fmtSize = (twelfths: number) => String(Number((twelfths / 12).toFixed(2)))

/** The text stored on a brew: "5.25", or "5.25 · +1" when the inner ring is off zero. */
export function formatOpus({ outer, inner }: OpusPosition) {
  return inner ? `${fmtOuter(outer)} · ${fmtInner(inner)}` : fmtOuter(outer)
}

/** Reads a grind setting written by `formatOpus` back into ring positions, if it is a real Opus setting. */
export function parseOpus(text: string | undefined): OpusPosition | undefined {
  const m = text?.trim().match(/^(\d{1,2}(?:\.\d+)?)(?:\s*·\s*([+-]?\d))?$/)
  if (!m) return undefined
  const outer = Number(m[1])
  const inner = m[2] ? Number(m[2]) : 0
  if (outer < 1 || outer > 11 || !Number.isInteger(outer * 4) || Math.abs(inner) > INNER_LIMIT) return undefined
  return { outer, inner }
}

export const toTwelfths = ({ outer, inner }: OpusPosition) => outer * 12 + 2 * inner
