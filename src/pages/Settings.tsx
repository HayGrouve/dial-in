import { useAuth } from '@clerk/react'
import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import DataSection from '../components/DataSection'
import { Moon, Monitor, Sun } from '../components/icons'
import { Field, Header, Loading, Section, Toggle } from '../components/ui'
import { arrowKeys } from '../lib/a11y'
import { useEquipment, useSetEquipment } from '../lib/equipment'
import { getGeminiKey, setGeminiKey } from '../lib/gemini-key'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'

const CHEAT_SHEET = [
  ['Start from a recipe', 'Espresso: 18g in → 36g out (1:2) in 25–30s. Turbo: 18g in → 54g out (1:3) in 10–15s, ground coarser. Pour over: 1:15–1:17.'],
  ['Change one thing at a time', 'Hold dose and yield steady; move only the grind until time lands in range.'],
  ['Sour, thin, fast?', 'Under-extracted. Grind finer.'],
  ['Bitter, harsh, dry?', 'Over-extracted. Grind coarser.'],
  ['Then fine-tune by taste', 'Once time is in range, nudge the ratio longer for clarity or shorter for body.'],
]

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export default function Settings() {
  const counts = useQuery(api.data.counts)
  const equipment = useEquipment()
  const setEquipment = useSetEquipment()
  const [theme, setTheme] = useState(getThemePref)
  // What is typed in the grinder field; Convex trims it, so the field keeps its own copy while you type.
  const [grinder, setGrinderDraft] = useState<string>()
  const { userId } = useAuth()
  const [apiKey, setApiKeyDraft] = useState(() => getGeminiKey(userId))
  // Someone else signed in from another tab or the hub: their field starts empty.
  const [keyFor, setKeyFor] = useState(userId)
  if (keyFor !== userId) {
    setKeyFor(userId)
    setApiKeyDraft(getGeminiKey(userId))
  }

  if (!equipment) {
    return (
      <>
        <Header back="/" title="Settings" />
        <Loading />
      </>
    )
  }

  return (
    <>
      <Header back="/" title="Settings" />

      <div className="space-y-4">
        <Section title="Appearance">
          <div role="radiogroup" aria-label="Theme" onKeyDown={arrowKeys} className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => {
              const active = theme === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => {
                    setThemePref(value)
                    setTheme(value)
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-[20px] border py-3 text-sm font-medium transition ${
                    active ? 'border-accent bg-accent/10 text-ink' : 'border-line text-muted hover:border-accent/60'
                  }`}
                >
                  <Icon className={active ? 'text-accent-fg' : ''} />
                  {label}
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Equipment" hint="Used for every new brew, on every device">
          <Field label="Grinder">
            <input
              className="input"
              name="grinder"
              autoComplete="off"
              placeholder="e.g. Niche Zero, Comandante C40…"
              value={grinder ?? equipment.grinder}
              onChange={(e) => {
                setGrinderDraft(e.target.value)
                void setEquipment({ grinder: e.target.value })
              }}
            />
          </Field>
          <Toggle
            checked={equipment.opusDial}
            onChange={(v) => void setEquipment({ opusDial: v })}
            label={
              <span>
                <span className="block font-semibold">Fellow Opus dial</span>
                <span className="text-sm text-muted">A grind wheel on the brew form that works out both rings, including the in-between sizes. For the original Opus, not Opus 2.</span>
              </span>
            }
          />
        </Section>

        <Section title="Label reading" hint="Fill in new coffees from photos of the bag">
          <Field label="Gemini API key">
            <input
              className="input"
              type="password"
              name="geminiApiKey"
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              value={apiKey}
              onChange={(e) => {
                setApiKeyDraft(e.target.value)
                setGeminiKey(e.target.value, userId)
              }}
            />
          </Field>
          <p lang="bg" className="text-sm text-ink">
            Ключът остава само на това устройство. Изход и Изтрий данните го изтриват.
          </p>
          <p className="text-sm text-muted">
            Bag photos are sent to Google Gemini to read the label. The key is not included in backups. Get one at{' '}
            <a className="font-semibold text-accent-fg underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            .
          </p>
        </Section>

        <DataSection counts={counts} onErase={() => setApiKeyDraft('')} />

        <Section title="Dial-in cheat sheet" summary="Five rules for dialing in a new bag" collapsible defaultOpen={false}>
          <ol className="space-y-3">
            {CHEAT_SHEET.map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="num w-5 shrink-0 font-mono text-xl font-semibold text-accent-fg">{i + 1}</span>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-muted">{body}</div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  )
}
