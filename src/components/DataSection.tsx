import { useMutation } from 'convex/react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { api } from '../../convex/_generated/api'
import { BackupError, buildExport, exportFileName, importBackup, saveFile, type ImportApi, type ImportProgress } from '../lib/backup'
import { convex } from '../lib/convex'
import { brewsCount, coffeesCount } from '../lib/count'
import { clearGeminiKey } from '../lib/gemini-key'
import { uploadPhoto } from '../lib/image'
import { Section } from './ui'

const AKAUNT = 'https://onovaza.com/akaunt'
const CONFIRM_WORD = 'ИЗТРИЙ'

/** The importer's calls, through the app's Convex client. */
const convexImportApi: ImportApi = {
  existing: () => convex.query(api.import.existing, {}),
  uploadPhoto,
  coffees: (args) => convex.mutation(api.import.coffees, args),
  brews: (args) => convex.mutation(api.import.brews, args),
  equipment: (args) => convex.mutation(api.import.equipment, args),
}

/** A status line under an action: what is happening now, what happened, or what went wrong. */
type Status = { tone: 'busy' | 'done' | 'error'; text: string } | null

const importLine = (p: ImportProgress) =>
  p.step === 'photos' ? `Качвам снимките: ${p.done} от ${p.total}…` : `Внасям варенията: ${p.done} от ${p.total}…`

/**
 * Settings → Данни: Изнеси, Внеси от Dial In, Изтрий данните, and where to
 * delete the whole Акаунт. `onErase` runs once the erase has started, so
 * Settings can empty the Gemini key field.
 */
export default function DataSection({ counts, onErase }: { counts?: { coffees: number; brews: number }; onErase: () => void }) {
  const [exportStatus, setExportStatus] = useState<Status>(null)
  /** A file ready to save when the share sheet asked for a fresh tap. */
  const [pending, setPending] = useState<File>()
  const [importStatus, setImportStatus] = useState<Status>(null)
  const [eraseStatus, setEraseStatus] = useState<Status>(null)
  const [erasing, setErasing] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const deleteMyData = useMutation(api.erase.deleteMyData)

  // The erase runs in the background; the counts reach zero when it is done.
  if (erasing && counts && counts.coffees === 0 && counts.brews === 0) {
    setErasing(false)
    setEraseStatus({ tone: 'done', text: 'Данните ти са изтрити. Започваш на чисто.' })
  }

  const save = async (file: File) => {
    try {
      const how = await saveFile(file)
      setPending(undefined)
      setExportStatus(how === 'cancelled' ? null : { tone: 'done', text: how === 'shared' ? 'Файлът е запазен.' : 'Файлът е изтеглен.' })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setPending(file)
        setExportStatus({ tone: 'done', text: 'Файлът е готов.' })
      } else {
        setExportStatus({ tone: 'error', text: 'Файлът не се запази. Опитай пак.' })
      }
    }
  }

  const runExport = async () => {
    setBusy(true)
    setPending(undefined)
    setEraseStatus(null)
    setExportStatus({ tone: 'busy', text: 'Приготвям файла…' })
    try {
      const data = await convex.query(api.data.exportMine, {})
      const file = await buildExport(data, undefined, (done, total) =>
        setExportStatus({ tone: 'busy', text: `Събирам снимките: ${done} от ${total}…` }),
      )
      await save(new File([JSON.stringify(file)], exportFileName(), { type: 'application/json' }))
    } catch {
      setExportStatus({ tone: 'error', text: 'Изнасянето не стана. Провери връзката и опитай пак.' })
    } finally {
      setBusy(false)
    }
  }

  const runImport = async (file: File) => {
    setBusy(true)
    setEraseStatus(null)
    setImportStatus({ tone: 'busy', text: 'Чета файла…' })
    try {
      const added = await importBackup(await file.text(), convexImportApi, (p) => setImportStatus({ tone: 'busy', text: importLine(p) }))
      setImportStatus({ tone: 'done', text: `Внесох ${coffeesCount(added.coffees)} и ${brewsCount(added.brews)}.` })
    } catch (e) {
      setImportStatus({
        tone: 'error',
        text:
          e instanceof BackupError
            ? e.message
            : 'Внасянето спря. Провери връзката и опитай пак: каквото вече е внесено, няма да се внесе втори път.',
      })
    } finally {
      setBusy(false)
    }
  }

  const erase = async () => {
    setEraseStatus({ tone: 'busy', text: 'Изтривам данните ти…' })
    try {
      await deleteMyData()
      clearGeminiKey()
      onErase()
      setExportStatus(null)
      setImportStatus(null)
      setErasing(true)
    } catch {
      setEraseStatus({ tone: 'error', text: 'Изтриването не започна. Провери връзката и опитай пак.' })
    }
  }

  return (
    <Section title="Данни" hint={counts && `${coffeesCount(counts.coffees)} · ${brewsCount(counts.brews)}`}>
      <p className="text-sm text-muted">Дневникът ти се пази в Акаунта ти и е един и същ на всяко устройство.</p>

      <Block title="Изнеси">
        <p className="text-sm text-muted">Един файл с всичките ти кафета, варения и снимки. С него можеш да ги внесеш пак.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" disabled={busy || erasing} onClick={() => void runExport()}>
            Изнеси
          </button>
          {pending && (
            <button type="button" className="btn-primary" onClick={() => void save(pending)}>
              Запази файла
            </button>
          )}
        </div>
        <StatusLine status={exportStatus} />
      </Block>

      <Block title="Внеси от Dial In">
        <p className="text-sm text-muted">
          Файл, изнесен от Dial In или от онова за кафето. Каквото вече е тук, не се внася втори път, така че можеш да го внесеш пак без страх.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Cleared, so picking the same file again runs again.
            e.target.value = ''
            if (file) void runImport(file)
          }}
        />
        <button type="button" className="btn-ghost" disabled={busy || erasing} onClick={() => fileInput.current?.click()}>
          Внеси от Dial In
        </button>
        <StatusLine status={importStatus} />
      </Block>

      <Block title="Изтрий данните си в онова за кафето">
        <p className="text-sm text-muted">
          Изтрива всичките ти кафета, варения, снимки, мелачката и настройките на Opus. Няма връщане. Акаунтът ти остава и не излизаш от него.
          Ключът за Gemini също изчезва от това устройство.
        </p>
        <EraseButton
          disabled={busy || erasing}
          exportStatus={exportStatus}
          onOpen={() => {
            setExportStatus(null)
            setPending(undefined)
          }}
          onExport={runExport}
          onSavePending={pending && (() => void save(pending))}
          onConfirm={erase}
        />
        <StatusLine status={eraseStatus} />
      </Block>

      <div className="space-y-2 border-t border-line pt-4 text-sm text-muted">
        <p>
          Искаш да изтриеш целия си Акаунт? Това става в{' '}
          <a className="font-semibold text-accent-fg underline" href={AKAUNT}>
            Акаунт
          </a>
          .
        </p>
        <p className="flex gap-4">
          <a className="underline underline-offset-4 hover:text-ink" href="https://onovaza.com/poveritelnost#kafeto">
            Поверителност
          </a>
          <a className="underline underline-offset-4 hover:text-ink" href="https://onovaza.com/usloviya#kafeto">
            Условия
          </a>
        </p>
      </div>
    </Section>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 border-t border-line pt-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function StatusLine({ status }: { status: Status }) {
  // The live region stays mounted so each new line is announced.
  return (
    <p role="status" className={`text-sm empty:hidden ${status?.tone === 'error' ? 'font-medium text-bitter' : status?.tone === 'done' ? 'text-ink' : 'text-muted'}`}>
      {status?.text}
    </p>
  )
}

/**
 * Изтрий данните and its dialog: first the export on offer, then type ИЗТРИЙ.
 * A native <dialog>, so focus stays inside and Escape closes it.
 */
function EraseButton({
  disabled,
  exportStatus,
  onOpen,
  onExport,
  onSavePending,
  onConfirm,
}: {
  disabled: boolean
  exportStatus: Status
  onOpen: () => void
  onExport: () => Promise<void>
  /** The share sheet asked for a fresh tap: this saves the file that is ready. */
  onSavePending?: () => void
  onConfirm: () => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<'offer' | 'confirm'>('offer')
  const [typed, setTyped] = useState('')
  const [exporting, setExporting] = useState(false)
  const titleId = useId()
  const inputId = useId()
  const matches = typed.trim().toLocaleUpperCase('bg') === CONFIRM_WORD

  const open = () => {
    onOpen()
    setStep('offer')
    setTyped('')
    dialog.current?.showModal()
  }
  const close = () => dialog.current?.close()

  return (
    <>
      <button type="button" className="btn border border-bitter/60 text-bitter hover:bg-bitter/10" disabled={disabled} onClick={open}>
        Изтрий данните
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[28px] bg-surface p-6 text-ink shadow-[0_12px_40px_-12px_rgb(6_14_11/0.5)] backdrop:bg-black/55 backdrop:backdrop-blur-[2px]"
      >
        {step === 'offer' ? (
          <div className="space-y-4">
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              Първо изнеси данните си?
            </h2>
            <p className="text-sm text-muted">
              Изтриването започва веднага и няма връщане. Ако искаш копие, изнеси файла сега. Можеш да го внесеш пак по всяко време.
            </p>
            <StatusLine status={exportStatus} />
            {onSavePending && (
              <button type="button" className="btn-primary" onClick={onSavePending}>
                Запази файла
              </button>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={close}>
                Откажи
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true)
                  await onExport()
                  setExporting(false)
                }}
              >
                Изнеси
              </button>
              <button type="button" className="btn-primary" disabled={exporting} onClick={() => setStep('confirm')}>
                Продължи
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!matches) return
              close()
              void onConfirm()
            }}
          >
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              Изтрий данните си в онова за кафето
            </h2>
            <p className="text-sm text-muted">Всичките ти кафета, варения и снимки изчезват веднага. Акаунтът ти остава.</p>
            <div>
              <label htmlFor={inputId} className="label">
                Напиши {CONFIRM_WORD}, за да потвърдиш
              </label>
              <input
                id={inputId}
                className="input"
                name="confirm"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={close}>
                Откажи
              </button>
              <button type="submit" className="btn bg-bitter text-on-accent hover:brightness-105" disabled={!matches}>
                Изтрий данните
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}
