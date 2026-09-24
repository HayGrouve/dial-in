import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { Moon, Monitor, Sun } from '../components/icons'
import { Field, Header, Section } from '../components/ui'
import { exportBackup, importBackup } from '../lib/backup'
import { db } from '../lib/db'
import { getGrinder, setGrinder } from '../lib/prefs'
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

export default function Settings() {
  const counts = useLiveQuery(async () => ({ coffees: await db.coffees.count(), brews: await db.brews.count() }))
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string>()
  const [theme, setTheme] = useState(getThemePref)
  const [grinder, setGrinderDraft] = useState(getGrinder)

  const onImport = async (file?: File) => {
    if (!file) return
    try {
      const r = await importBackup(file)
      setGrinderDraft(getGrinder())
      setMessage(`Imported ${r.coffees} coffees and ${r.brews} brews.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  return (
    <>
      <Header back="/" title="Settings" />

      <div className="space-y-4">
        <Section title="Appearance">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => {
              const active = theme === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setThemePref(value)
                    setTheme(value)
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-medium transition ${
                    active ? 'border-crema bg-crema/10 text-espresso' : 'border-husk text-roast hover:border-crema/60'
                  }`}
                >
                  <Icon className={active ? 'text-crema-deep' : ''} />
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
              placeholder="e.g. Niche Zero, Comandante C40"
              value={grinder}
              onChange={(e) => {
                setGrinderDraft(e.target.value)
                setGrinder(e.target.value)
              }}
            />
          </Field>
        </Section>

        <Section title="Your data" hint={`${counts?.coffees ?? 0} coffees · ${counts?.brews ?? 0} brews`}>
          <p className="text-sm text-roast">Everything lives only on this device. Export a backup now and then, or to move to a new phone.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => void exportBackup()}>
              Export backup
            </button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              Import backup
            </button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImport(e.target.files?.[0])} />
          {message && <p className="text-sm font-medium text-crema-deep">{message}</p>}
        </Section>

        <Section title="Dial-in cheat sheet" summary="Five rules for dialing in a new bag" collapsible defaultOpen={false}>
          <ol className="space-y-3">
            {CHEAT_SHEET.map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="num w-5 shrink-0 font-display text-xl font-semibold text-crema">{i + 1}</span>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-roast">{body}</div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  )
}
