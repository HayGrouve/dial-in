import { Link, Route, Switch } from 'wouter'
import BrewForm from './pages/BrewForm'
import CoffeeDetail from './pages/CoffeeDetail'
import CoffeeForm from './pages/CoffeeForm'
import Home from './pages/Home'
import Settings from './pages/Settings'

export default function App() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/settings" component={Settings} />
        <Route path="/coffee/new" component={CoffeeForm} />
        <Route path="/coffee/:id/edit" component={CoffeeForm} />
        <Route path="/coffee/:id/brew/new" component={BrewForm} />
        <Route path="/coffee/:id/brew/:brewId" component={BrewForm} />
        <Route path="/coffee/:id" component={CoffeeDetail} />
        <Route>
          <p className="py-20 text-center text-muted">
            Nothing brewing here.{' '}
            <Link href="/" className="font-semibold text-accent-fg underline">
              Back to the shelf
            </Link>
          </p>
        </Route>
      </Switch>
    </main>
  )
}
