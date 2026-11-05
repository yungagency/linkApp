import { useState } from 'react'
import { Link, navigate, usePath } from '../lib/router'
import { useSession } from '../lib/session'
import { Icon } from './Icon'
import { Logo } from './ui'

/** Barre de navigation pour ordinateur et tablette (cachée sur téléphone). */
export function DesktopHeader() {
  const path = usePath()
  const { profile, vitrine } = useSession()
  const [q, setQ] = useState('')
  const on = (p: string) => ((p === '/' ? path === '/' : path.startsWith(p)) ? 'on' : '')
  return (
    <header className="desk-header">
      <div className="desk-inner">
        <a href="#/" aria-label="Accueil LinkApp"><Logo size={34} /></a>
        <form className="search desk-search" onSubmit={(e) => { e.preventDefault(); navigate('/explorer?q=' + encodeURIComponent(q)) }}>
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit, une boutique, un service…" aria-label="Rechercher" />
        </form>
        <nav className="desk-links">
          <Link to="/" className={on('/')}>Accueil</Link>
          <Link to="/explorer" className={on('/explorer')}>Explorer</Link>
          <Link to="/favoris" className={on('/favoris')}>Favoris</Link>
          <Link to="/compte" className={on('/compte')}>{profile ? 'Mon compte' : 'Se connecter'}</Link>
        </nav>
        {vitrine
          ? <a className="btn sm" href="#/pro"><Icon name="store" size={16} />Ma vitrine</a>
          : <a className="btn sm" href="#/devenir-vendeur"><Icon name="store" size={16} />Devenir vendeur</a>}
      </div>
    </header>
  )
}
