import { useEffect, type ReactNode } from 'react'
import { BrandLoader, NetworkStatus } from './components/Network'
import { DesktopHeader } from './components/DesktopHeader'
import { Splash } from './components/Splash'
import { BottomNav, ToastHost } from './components/ui'
import { api } from './lib/api'
import { match, navigate, usePath } from './lib/router'
import { useSession } from './lib/session'
import { Account, BecomeSeller, Favorites } from './pages/Account'
import { Login, Register } from './pages/Auth'
import { Categories, CategoryPage } from './pages/Categories'
import { Checkout, OrderDetail, OrderList } from './pages/orders/Orders'
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
  const needsAuth = base.startsWith('/pro') || base === '/admin' || base.startsWith('/commande')

  let page: ReactNode
  let nav = true
  let wide = false
  let narrow = false
  let m: Record<string, string> | null

  if (needsAuth && loading) page = <BrandLoader />
  else if (needsAuth && !profile) page = <Redirect to={base.startsWith('/pro') ? '/devenir-vendeur' : '/connexion?next=' + encodeURIComponent(base)} />
  else if (base === '/') page = <Home />
  else if (base === '/explorer') page = <Explore params={query} />
  else if ((m = match('/v/:slug', base))) { page = <VitrinePage slug={m.slug!} />; nav = false }
  else if (base === '/categories') page = <Categories />
  else if ((m = match('/categorie/:id', base))) page = <CategoryPage id={m.id!} />
  else if (base === '/favoris') page = <Favorites />
  else if (base === '/connexion') { page = profile ? <Redirect to={query.next || '/compte'} /> : <Login next={query.next} />; nav = false; narrow = true }
  else if (base === '/inscription') { page = <Register next={query.next} />; nav = false; narrow = true }
  else if (base === '/compte') { page = <Account />; narrow = true }
  else if (base === '/devenir-vendeur') { page = <BecomeSeller />; nav = false; narrow = true }
  else if ((m = match('/commander/:slug/:item', base))) { page = <Checkout slug={m.slug!} itemId={m.item!} mode={query.mode} />; nav = false; narrow = true }
  else if (base === '/commandes') { page = <OrderList mode="buyer" />; narrow = true }
  else if ((m = match('/commande/:id', base))) { page = <OrderDetail id={m.id!} />; nav = false; narrow = true }
  else if (base === '/pro/vitrine') { page = <VitrineForm />; nav = false; narrow = true }
  else if (base.startsWith('/pro') && !vitrine) page = <Redirect to="/pro/vitrine" />
  else if (base === '/pro') page = <Dashboard />
  else if (base === '/pro/commandes') { page = <OrderList mode="seller" />; narrow = true }
  else if ((m = match('/pro/article/:id', base))) { page = <ItemForm id={m.id!} />; nav = false; narrow = true }
  else if (base === '/pro/abonnement') { page = <Subscription />; nav = false; narrow = true }
  else if (base === '/admin') {
    if (profile?.role !== 'admin') page = <Redirect to="/" />
    else { page = <Admin />; nav = false; wide = true }
  } else page = <Redirect to="/" />

  return (
    <div className={'shell ' + (wide ? 'wide ' : '') + (narrow ? 'narrow ' : '') + (nav ? '' : 'no-nav')}>
      {api.mode === 'demo' && (
        <div className="demo-banner"><b>Mode démo</b> · données sur cet appareil uniquement</div>
      )}
      {!wide && <DesktopHeader />}
      {page}
      {nav && <BottomNav />}
      <ToastHost />
      <NetworkStatus />
      <Splash />
    </div>
  )
}
