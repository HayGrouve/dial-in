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
  ['Започни от рецепта', 'Еспресо: 18 г кафе → 36 г напитка (1:2) за 25 до 30 с. Турбо: 18 г → 54 г (1:3) за 10 до 15 с, смляно по-едро. Филтър: 1:15 до 1:17.'],
  ['Променяй по едно нещо', 'Дръж дозата и напитката същите; мести само смилането, докато времето влезе в целта.'],
  ['Кисело, водно, бързо?', 'Недоизвлечено. Смели по-фино.'],
  ['Горчиво, грубо, сухо?', 'Преизвлечено. Смели по-едро.'],
  ['После донастрой на вкус', 'Щом времето е в целта, удължи съотношението за повече яснота или го скъси за повече тяло.'],
]

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Системна', icon: Monitor },
  { value: 'light', label: 'Светла', icon: Sun },
  { value: 'dark', label: 'Тъмна', icon: Moon },
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
        <Header back="/" title="Настройки" />
        <Loading />
      </>
    )
  }

  return (
    <>
      <Header back="/" title="Настройки" />

      <div className="space-y-4">
        <Section title="Изглед">
          <div role="radiogroup" aria-label="Тема" onKeyDown={arrowKeys} className="grid grid-cols-3 gap-2">
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

        <Section title="Уреди" hint="За всяко ново варене, на всяко устройство">
          <Field label="Мелачка">
            <input
              className="input"
              name="grinder"
              autoComplete="off"
              placeholder="напр. Niche Zero, Comandante C40…"
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
                <span className="block font-semibold">Колело за Fellow Opus</span>
                <span className="text-sm text-muted">Колело за смилане във формата за варене, което смята и двата пръстена, с междинните размери. За първия Opus, не за Opus 2.</span>
              </span>
            }
          />
        </Section>

        <Section title="Четене на етикета" hint="Попълва новите кафета от снимки">
          <Field label="Ключ за Gemini API">
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
          <p className="text-sm text-ink">
            Ключът остава само на това устройство. Изход и Изтрий данните го изтриват.
          </p>
          <p className="text-sm text-muted">
            Снимките на пакета отиват в Google Gemini, за да се прочете етикетът. Ключът не влиза във файла от Изнеси. Вземи си от{' '}
            <a className="font-semibold text-accent-fg underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            .
          </p>
        </Section>

        <DataSection counts={counts} onErase={() => setApiKeyDraft('')} />

        <Section title="Как да настроиш ново кафе" summary="Пет правила за нов пакет" collapsible defaultOpen={false}>
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
