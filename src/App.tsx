import { useConvexAuth } from 'convex/react'
import { Route, Switch } from 'wouter'
import ConnectionBanner from './components/ConnectionBanner'
import Toast from './components/Toast'
import { NotFound } from './components/ui'
import { useGeminiKeyGuard } from './lib/session'
import BrewForm from './pages/BrewForm'
import CoffeeDetail from './pages/CoffeeDetail'
import CoffeeForm from './pages/CoffeeForm'
import Home from './pages/Home'
import Settings from './pages/Settings'
import Start from './pages/Start'

export default function App() {
  useGeminiKeyGuard()
  return (
    <>
      <ConnectionBanner />
      <Routes />
    </>
  )
}

function Routes() {
  // Convex's view, not Clerk's: signed in means the token has reached Convex.
  const { isLoading, isAuthenticated } = useConvexAuth()
  if (isLoading) return null
  // Signed out, every route shows the start page in place, so Влез comes back to it.
  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-[env(safe-area-inset-bottom)]">
        <Start />
      </main>
    )
  }

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/settings" component={Settings} />
          <Route path="/coffee/new" component={CoffeeForm} />
          <Route path="/coffee/:id/edit" component={CoffeeForm} />
          <Route path="/coffee/:id/brew/new" component={BrewForm} />
          <Route path="/coffee/:id/brew/:brewId" component={BrewForm} />
          <Route path="/coffee/:id" component={CoffeeDetail} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Toast />
    </>
  )
}
