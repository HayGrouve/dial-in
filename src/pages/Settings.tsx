import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Moon, Monitor, Sun } from '../components/icons'
import { Field, Header, Section, Toggle } from '../components/ui'
import { arrowKeys } from '../lib/a11y'
import { exportBackup, importBackup } from '../lib/backup'
import { db } from '../lib/db'
import { getApiKey, getGrinder, getOpusDial, setApiKey, setGrinder, setOpusDial } from '../lib/prefs'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'

const CHEAT_SHEET = [
  ['Start from a recipe', 'Espresso: 18g in → 36g out (1:2) in 25–30s. Pour over: 1:15–1:17.'],
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function Settings() {
  const counts = useLiveQuery(async () => ({ coffees: await db.coffees.count(), brews: await db.brews.count() }))
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string>()
  const [theme, setTheme] = useState(getThemePref)
  const [grinder, setGrinderDraft] = useState(getGrinder)
  const [apiKey, setApiKeyDraft] = useState(getApiKey)
  const [opusDial, setOpusDialDraft] = useState(getOpusDial)

  const onImport = async (file?: File) => {
    if (!file) return
    try {
      const r = await importBackup(file)
      setGrinderDraft(getGrinder())
      setMessage(`Imported ${plural(r.coffees, 'coffee')} and ${plural(r.brews, 'brew')}.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed.')
    }
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

        <Section title="Equipment" hint="Used for every new brew">
          <Field label="Grinder">
            <input
              className="input"
              name="grinder"
              autoComplete="off"
              placeholder="e.g. Niche Zero, Comandante C40…"
              value={grinder}
              onChange={(e) => {
                setGrinderDraft(e.target.value)
                setGrinder(e.target.value)
              }}
            />
          </Field>
          <Toggle
            checked={opusDial}
            onChange={(v) => {
              setOpusDial(v)
              setOpusDialDraft(v)
            }}
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
                setApiKey(e.target.value)
              }}
            />
          </Field>
          <p className="text-sm text-muted">
            Bag photos are sent to Google Gemini to read the label. The key stays on this device and is not included in backups. Get one at{' '}
            <a className="font-semibold text-accent-fg underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            .
          </p>
        </Section>

        <Section title="Your data" hint={counts && `${plural(counts.coffees, 'coffee')} · ${plural(counts.brews, 'brew')}`}>
          <p className="text-sm text-muted">Everything lives only on this device. Export a backup now and then, or to move to a new phone.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => void exportBackup()}>
              Export backup
            </button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              Import backup
            </button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImport(e.target.files?.[0])} />
          <p className="text-sm font-medium text-accent-fg empty:sr-only" role="status">
            {message}
          </p>
        </Section>

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
