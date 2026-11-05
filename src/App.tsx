import { useEffect, type ReactNode } from 'react'
import { BottomNav, Skeleton, ToastHost } from './components/ui'
import { api } from './lib/api'
import { match, navigate, usePath } from './lib/router'
import { useSession } from './lib/session'
import { Account, BecomeSeller, Favorites } from './pages/Account'
import { Login, Register } from './pages/Auth'
import Explore from './pages/Explore'
import Home from './pages/Home'
import VitrinePage from './pages/VitrinePage'
import Admin from './pages/admin/Admin'
import Dashboard from './pages/pro/Dashboard'
import ItemForm from './pages/pro/ItemForm'
import Subscription from './pages/pro/Subscription'
import VitrineForm from './pages/pro/VitrineForm'

function Redirect({ to }: { to: string }) {
  useEffect(() => { navigate(to, true) }, [to])
  return null
}

export default function App() {
  const path = usePath()
  const { profile, vitrine, loading } = useSession()
  const base = path.split('?')[0]!
  const query = match(base, path) ?? {}
  const needsAuth = base.startsWith('/pro') || base === '/admin'

  let page: ReactNode
  let nav = true
  let wide = false
  let m: Record<string, string> | null

  if (needsAuth && loading) page = <div className="page stack"><Skeleton h={60} /><Skeleton h={160} /></div>
  else if (needsAuth && !profile) page = <Redirect to={base.startsWith('/pro') ? '/devenir-vendeur' : '/connexion?next=' + encodeURIComponent(base)} />
  else if (base === '/') page = <Home />
  else if (base === '/explorer') page = <Explore params={query} />
  else if ((m = match('/v/:slug', base))) { page = <VitrinePage slug={m.slug!} />; nav = false }
  else if (base === '/favoris') page = <Favorites />
  else if (base === '/connexion') { page = profile ? <Redirect to={query.next || '/compte'} /> : <Login next={query.next} />; nav = false }
  else if (base === '/inscription') { page = <Register next={query.next} />; nav = false }
  else if (base === '/compte') page = <Account />
  else if (base === '/devenir-vendeur') { page = <BecomeSeller />; nav = false }
  else if (base === '/pro/vitrine') { page = <VitrineForm />; nav = false }
  else if (base.startsWith('/pro') && !vitrine) page = <Redirect to="/pro/vitrine" />
  else if (base === '/pro') page = <Dashboard />
  else if ((m = match('/pro/article/:id', base))) { page = <ItemForm id={m.id!} />; nav = false }
  else if (base === '/pro/abonnement') { page = <Subscription />; nav = false }
  else if (base === '/admin') {
    if (profile?.role !== 'admin') page = <Redirect to="/" />
    else { page = <Admin />; nav = false; wide = true }
  } else page = <Redirect to="/" />

  return (
    <div className={'shell ' + (wide ? 'wide' : '')} style={nav ? undefined : { paddingBottom: 24 }}>
      {api.mode === 'demo' && (
        <div className="demo-banner"><b>Mode démo</b> · données sur cet appareil uniquement</div>
      )}
      {page}
      {nav && <BottomNav />}
      <ToastHost />
    </div>
  )
}
