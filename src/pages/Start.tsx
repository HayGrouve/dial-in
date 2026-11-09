import { Bean } from '../components/icons'
import { useSignIn } from '../lib/session'

/**
 * What you see signed out, on any route: no redirect, so Влез brings you back
 * to the page you opened. Seeded from Home's empty state; copy refined in #34.
 */
export default function Start() {
  const signIn = useSignIn()
  return (
    <div lang="bg" className="flex min-h-dvh flex-col pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="rise card w-full max-w-md px-6 py-12 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent-fg">
            <Bean width={30} height={30} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Онова за кафето</h1>
          <p className="mx-auto mt-2 max-w-sm text-muted">
            Дневник за кафетата ти и как ги вариш. Пази се в Акаунта ти, на всяко устройство.
          </p>
          <button type="button" onClick={() => void signIn()} className="btn-primary mt-6 !px-8 !py-3 !text-base">
            Влез
          </button>
        </div>
      </div>
      <footer className="flex justify-center gap-4 py-4 text-sm text-muted">
        <a href="https://onovaza.com/poveritelnost#kafeto" className="rounded-full px-2 py-1 underline-offset-4 hover:text-ink hover:underline">
          Поверителност
        </a>
        <a href="https://onovaza.com/usloviya#kafeto" className="rounded-full px-2 py-1 underline-offset-4 hover:text-ink hover:underline">
          Условия
        </a>
      </footer>
    </div>
  )
}
