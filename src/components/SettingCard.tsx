import type { Brew } from '../lib/db'
import { dotted, formatTime, METHODS, ratio } from '../lib/methods'

/** The hero "remember this" card: the grind number big, the recipe beneath. */
export function SettingCard({ brew, provisional }: { brew: Brew; provisional?: boolean }) {
  const m = METHODS[brew.method]
  const amounts = brew.dose != null && brew.yield != null ? `${brew.dose}g → ${brew.yield}g` : brew.dose != null && `${brew.dose}g in`
  const recipe = dotted(amounts, ratio(brew.dose, brew.yield), formatTime(brew.timeSec))
  const extras = dotted(
    brew.preinfusion && `Pre-infusion${brew.preinfusionSec ? ` ${brew.preinfusionSec}s` : ''}`,
    brew.bloomSec && `Bloom ${brew.bloomSec}s`,
    brew.temperature && `${brew.temperature}°C`,
  )

  return (
    <div
      className={`h-full rounded-2xl border p-4 transition hover:border-crema ${
        provisional ? 'border-dashed border-husk bg-oat' : 'border-crema/40 bg-[linear-gradient(135deg,var(--oat)_40%,color-mix(in_oklab,var(--crema)_14%,var(--oat)))]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-semibold tracking-wider uppercase">
        <span className="text-crema-deep">{m.label}</span>
        {provisional && <span className="font-medium tracking-normal text-roast normal-case">Last try · not pinned yet</span>}
      </div>
      <div className="mt-2 flex items-end gap-3">
        <div className={`num font-display leading-none font-semibold tracking-tight ${brew.grindSetting.length > 6 ? 'text-4xl' : 'text-5xl'}`}>{brew.grindSetting || '—'}</div>
        {brew.grinder && <div className="pb-1 text-sm text-roast">on {brew.grinder}</div>}
      </div>
      {recipe && <p className="num mt-3 text-[15px] text-espresso/90">{recipe}</p>}
      {extras && <p className="num mt-0.5 text-sm text-roast">{extras}</p>}
    </div>
  )
}
