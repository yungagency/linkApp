import { useEffect, useState, type ReactNode } from 'react'
import { TYPES } from '../config'
import { api } from '../lib/api'
import { Link, navigate, usePath } from '../lib/router'
import { getFavs, toggleFav, useSession } from '../lib/session'
import type { Item, Vitrine, VitrineType } from '../lib/types'
import { errorMessage, formatPrice, isPremiumActive } from '../lib/utils'
import { Icon } from './Icon'
import { NET_EVENTS, isNetworkError, reportNetworkError } from './Network'

export function Logo({ size = 30, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="brand" aria-label="LinkApp">
      <img src="./logo-mark.png" alt="" style={{ width: size, height: size }} />
      {tagline
        ? <span className="brand-stack"><span>Link<b>App</b></span><small>Vos opportunités, en un seul lieu</small></span>
        : <span>Link<b>App</b></span>}
    </span>
  )
}

export function TopBar({ title, back, right }: { title?: ReactNode; back?: string | true; right?: ReactNode }) {
  return (
    <header className="topbar">
      {back && (
        <button className="icon-btn" aria-label="Retour"
          onClick={() => (back === true ? history.back() : navigate(back))}>
          <Icon name="back" />
        </button>
      )}
      <h1 className="ellipsis">{title}</h1>
      {right}
    </header>
  )
}

export function BottomNav() {
  const path = usePath()
  const { vitrine } = useSession()
  const on = (p: string) => (p === '/' ? path === '/' : path.startsWith(p)) ? 'on' : ''
  // Client : 4 onglets. Vendeur : le « + » et « Ma vitrine » apparaissent.
  if (!vitrine) {
    return (
      <nav className="bottom-nav" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }} aria-label="Navigation principale">
        <Link to="/" className={on('/')}><Icon name="home" />Accueil</Link>
        <Link to="/explorer" className={on('/explorer')}><Icon name="search" />Explorer</Link>
        <Link to="/favoris" className={on('/favoris')}><Icon name="heart" />Favoris</Link>
        <Link to="/compte" className={on('/compte') || on('/connexion')}><Icon name="user" />Compte</Link>
      </nav>
    )
  }
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      <Link to="/" className={on('/')}><Icon name="home" />Accueil</Link>
      <Link to="/explorer" className={on('/explorer')}><Icon name="search" />Explorer</Link>
      <Link to="/pro/article/new" ariaLabel="Ajouter un article"><span className="fab"><Icon name="plus" stroke={2.4} /></span></Link>
      <Link to="/pro" className={on('/pro')}><Icon name="store" />Ma vitrine</Link>
      <Link to="/compte" className={on('/compte')}><Icon name="user" />Compte</Link>
    </nav>
  )
}

/** Image ou placeholder coloré selon le type de vitrine. */
export function Media({ src, type, label, className }: { src?: string | null; type: VitrineType; label: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (src && !broken) return <img src={src} alt={label} className={'cover-img ' + (className ?? '')} loading="lazy" onError={() => setBroken(true)} />
  return (
    <div className={`ph ${type} ${className ?? ''}`} role="img" aria-label={label}>
      <span className="ph-ic"><Icon name={TYPES[type].icon} stroke={1.6} /></span>
    </div>
  )
}

export function TypeBadge({ type }: { type: VitrineType }) {
  return <span className={`badge t-${type}`}>{TYPES[type].label}</span>
}

export function PremiumBadge() {
  return <span className="badge premium"><Icon name="crown" size={12} stroke={2.2} />Premium</span>
}

export function useFavs() {
  const [favs, setFavs] = useState<string[]>(getFavs())
  return { favs, toggle: (id: string) => setFavs(toggleFav(id)) }
}

export function VitrineCard({ v, favs }: { v: Vitrine; favs: ReturnType<typeof useFavs> }) {
  const fav = favs.favs.includes(v.id)
  return (
    <a href={`#/v/${v.slug}`} className="card vcard">
      <div className="cover">
        <Media src={v.cover_url} type={v.type} label={v.name} />
        {isPremiumActive(v) && <span className="badge premium float"><Icon name="crown" size={12} stroke={2.2} />Premium</span>}
        <button className={'fav-btn ' + (fav ? 'on' : '')} aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={(e) => { e.preventDefault(); favs.toggle(v.id) }}>
          <Icon name="heart" size={18} filled={fav} />
        </button>
      </div>
      <div className="body">
        <div className="row" style={{ gap: 6 }}><h3 className="ellipsis">{v.name}</h3>{v.verified && <span className="tick" title="Vendeur vérifié"><Icon name="check" size={11} stroke={3} /></span>}</div>
        <div className="row small" style={{ marginTop: 2 }}><Rating v={v} /></div>
        <div className="row small muted" style={{ marginTop: 4 }}>
          <Icon name="pin" size={14} />
          <span className="ellipsis grow">{[v.district, v.city].filter(Boolean).join(', ') || 'Localisation non précisée'}</span>
          <TypeBadge type={v.type} />
        </div>
      </div>
    </a>
  )
}

export function VitrineRow({ v, right }: { v: Vitrine; right?: ReactNode }) {
  return (
    <a href={`#/v/${v.slug}`} className="card vrow">
      <div className="thumb"><Media src={v.logo_url || v.cover_url} type={v.type} label={v.name} /></div>
      <div className="grow">
        <div className="row" style={{ gap: 6 }}>
          <h3 className="ellipsis">{v.name}</h3>
          {v.verified && <span className="tick" title="Vendeur vérifié"><Icon name="check" size={11} stroke={3} /></span>}
          {isPremiumActive(v) && <Icon name="crown" size={14} className="gold" />}
        </div>
        <p className="small muted ellipsis">{v.description || TYPES[v.type].label}</p>
        <p className="tiny muted row" style={{ gap: 8, marginTop: 2 }}><Rating v={v} /><span className="row" style={{ gap: 3 }}><Icon name="pin" size={12} />{v.district || v.city || '—'}</span></p>
      </div>
      {right ?? <Icon name="chevron" className="muted" />}
    </a>
  )
}

export function ItemCard({ item, type, onClick }: { item: Item; type: VitrineType; onClick?: () => void }) {
  return (
    <div className="card icard" onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="img">
        <Media src={item.image_url} type={type} label={item.title} />
        {!item.available && <span className="badge off float">Indisponible</span>}
      </div>
      <div className="body">
        <h3 className="ellipsis small" style={{ fontSize: 14 }}>{item.title}</h3>
        <p className="price">{formatPrice(item.price, item.unit)}</p>
      </div>
    </div>
  )
}

export function Empty({ icon = 'box', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ic"><Icon name={icon} size={26} /></div>
      <h3 style={{ color: 'var(--ink)' }}>{title}</h3>
      {text && <p className="small" style={{ marginTop: 4 }}>{text}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}

export function Skeleton({ h = 80 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} />
}

export function PhotoPicker({ value, onChange, ratio = '1', label = 'Ajouter une photo' }:
  { value: string | null; onChange: (url: string | null) => void; ratio?: string; label?: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <div>
      <label className="photo-pick" style={{ aspectRatio: ratio }}>
        {value ? <img src={value} alt="" /> : (
          <span className="stack" style={{ display: 'grid', justifyItems: 'center' }}>
            <Icon name="image" size={28} />
            <span>{busy ? 'Envoi en cours…' : label}</span>
          </span>
        )}
        <input type="file" accept="image/*" disabled={busy} onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setErr(''); setBusy(true)
          try { onChange(await api.uploadImage(f)) } catch (x) { setErr(errorMessage(x)) } finally { setBusy(false) }
        }} />
      </label>
      {value && <button type="button" className="link" style={{ marginTop: 6 }} onClick={() => onChange(null)}>Retirer la photo</button>}
      {err && <p className="alert err" style={{ marginTop: 8 }}>{err}</p>}
    </div>
  )
}

let toastSetter: ((m: string) => void) | null = null
export function toast(m: string) { toastSetter?.(m) }
export function ToastHost() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    toastSetter = (m) => { setMsg(m); window.setTimeout(() => setMsg(''), 2600) }
    return () => { toastSetter = null }
  }, [])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

/** Petit hook de chargement asynchrone. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    let slow = false
    setLoading(true); setError('')
    // Au-delà de 8 s, on prévient l'utilisateur que la connexion est lente
    const timer = setTimeout(() => { slow = true; window.dispatchEvent(new Event(NET_EVENTS.slow)) }, 8000)
    const end = () => { clearTimeout(timer); if (slow) { slow = false; window.dispatchEvent(new Event(NET_EVENTS.slowDone)) } }
    fn().then((d) => { if (alive) setData(d) })
      .catch((e) => {
        if (isNetworkError(e)) reportNetworkError()
        if (alive) setError(errorMessage(e))
      })
      .finally(() => { end(); if (alive) setLoading(false) })
    return () => { alive = false; end() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  // Quand la connexion revient, on recharge automatiquement
  useEffect(() => {
    const on = () => setTick((t) => t + 1)
    window.addEventListener(NET_EVENTS.retry, on)
    return () => window.removeEventListener(NET_EVENTS.retry, on)
  }, [])
  return { data, error, loading, reload: () => setTick((t) => t + 1) }
}

/** Note en étoiles (lecture seule ou sélection). */
export function Stars({ value, size = 14, onPick }: { value: number; size?: number; onPick?: (n: number) => void }) {
  return (
    <span className="stars" role={onPick ? 'radiogroup' : 'img'} aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        onPick
          ? <button key={n} type="button" aria-label={`${n} étoile${n > 1 ? 's' : ''}`} className={n <= value ? 'on' : ''} onClick={() => onPick(n)}><Icon name="star" size={size} filled={n <= value} /></button>
          : <span key={n} className={n <= Math.round(value) ? 'on' : ''}><Icon name="star" size={size} filled={n <= Math.round(value)} /></span>
      ))}
    </span>
  )
}

/** Note moyenne compacte : ★ 4,6 (12) — ou « Nouveau » sans avis. */
export function Rating({ v }: { v: { rating_avg: number; rating_count: number } }) {
  if (!v.rating_count) return <span className="tiny muted">Nouveau</span>
  return <span className="rating"><Icon name="star" size={13} filled />{String(v.rating_avg).replace('.', ',')} <span className="muted">({v.rating_count})</span></span>
}

export function VerifiedBadge() {
  return <span className="badge verified" title="Identité vérifiée par LinkApp"><Icon name="check" size={12} stroke={2.6} />Vérifié</span>
}
