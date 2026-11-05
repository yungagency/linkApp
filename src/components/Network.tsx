import { useEffect, useRef, useState } from 'react'
import { LOGO_DATA } from '../assets/logoData'
import { Icon } from './Icon'

/**
 * Animation « problème de connexion » : différente de l'ouverture.
 * La marque est au centre d'un radar (ondes qui partent, satellite qui tourne)
 * tant que l'app cherche le réseau ; elle passe au vert quand la connexion revient.
 *
 * Déclencheurs :
 *  - le téléphone passe hors ligne (événement navigateur)
 *  - une requête échoue faute de réseau  → window event 'linkapp:net-error'
 *  - un chargement dépasse 8 s             → 'linkapp:slow' / 'linkapp:slow-done'
 */
type State = 'hidden' | 'offline' | 'slow' | 'back'

export const NET_EVENTS = { error: 'linkapp:net-error', slow: 'linkapp:slow', slowDone: 'linkapp:slow-done', retry: 'linkapp:retry' }

export function reportNetworkError() { window.dispatchEvent(new Event(NET_EVENTS.error)) }
export function isNetworkError(e: unknown) {
  const m = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e)
  return /Failed to fetch|NetworkError|Load failed|network/i.test(m) || !navigator.onLine
}

export function NetworkStatus() {
  const [state, setState] = useState<State>(navigator.onLine ? 'hidden' : 'offline')
  const slowCount = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const goBack = () => {
      if (stateRef.current === 'hidden') return
      setState('back')
      window.dispatchEvent(new Event(NET_EVENTS.retry))
      setTimeout(() => setState((s) => (s === 'back' ? 'hidden' : s)), 1600)
    }
    const offline = () => setState('offline')
    const netError = () => setState((s) => (s === 'hidden' || s === 'slow' ? 'offline' : s))
    const slow = () => { slowCount.current++; setState((s) => (s === 'hidden' ? 'slow' : s)) }
    const slowDone = () => {
      slowCount.current = Math.max(0, slowCount.current - 1)
      if (slowCount.current === 0) setState((s) => (s === 'slow' ? 'hidden' : s))
    }
    window.addEventListener('online', goBack)
    window.addEventListener('offline', offline)
    window.addEventListener(NET_EVENTS.error, netError)
    window.addEventListener(NET_EVENTS.slow, slow)
    window.addEventListener(NET_EVENTS.slowDone, slowDone)
    return () => {
      window.removeEventListener('online', goBack)
      window.removeEventListener('offline', offline)
      window.removeEventListener(NET_EVENTS.error, netError)
      window.removeEventListener(NET_EVENTS.slow, slow)
      window.removeEventListener(NET_EVENTS.slowDone, slowDone)
    }
  }, [])

  // Hors ligne : on retente toutes les 5 s sans que l'utilisateur ait à toucher l'écran
  useEffect(() => {
    if (state !== 'offline') return
    const t = setInterval(() => { if (navigator.onLine) ping().then((ok) => ok && back()) }, 5000)
    return () => clearInterval(t)
  }, [state])

  const back = () => {
    setState('back')
    window.dispatchEvent(new Event(NET_EVENTS.retry))
    setTimeout(() => setState((s) => (s === 'back' ? 'hidden' : s)), 1600)
  }

  if (state === 'hidden') return null

  // Chargement lent : discret, en bas de l'écran
  if (state === 'slow') {
    return (
      <div className="net-pill" role="status">
        <span className="net-pill-orbit"><img src={LOGO_DATA} alt="" /></span>
        <span><b>Connexion lente</b><br /><span className="tiny">Chargement en cours, merci de patienter…</span></span>
      </div>
    )
  }

  const ok = state === 'back'
  return (
    <div className={'net-screen ' + (ok ? 'ok' : '')} role="alertdialog" aria-live="assertive">
      <div className="net-radar">
        <span className="wave" /><span className="wave w2" /><span className="wave w3" />
        <span className="orbit"><span className="sat" /></span>
        <div className="net-core">
          <img src={LOGO_DATA} alt="" />
          {ok && <span className="net-check"><Icon name="check" size={18} stroke={3} /></span>}
        </div>
      </div>
      <h2>{ok ? 'Connexion rétablie' : 'Connexion perdue'}</h2>
      <p>{ok ? 'Vos données se mettent à jour.' : 'Vérifiez vos données mobiles ou votre Wi-Fi. Nous réessayons automatiquement.'}</p>
      {!ok && (
        <button className="btn" onClick={async () => { if (await ping()) back() }}>
          <Icon name="search" size={16} />Réessayer
        </button>
      )}
      {!ok && <span className="net-dots" aria-hidden="true"><i /><i /><i /></span>}
    </div>
  )
}

/** Vérifie qu'on joint vraiment Internet (pas seulement le Wi-Fi local). */
async function ping(): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    await fetch('./manifest.webmanifest?ping=' + Date.now(), { cache: 'no-store' })
    return true
  } catch { return false }
}

/** Loader de marque (orbite) pour les chargements de page. */
export function BrandLoader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="brand-loader" role="status" aria-label={label}>
      <span className="bl-orbit"><img src={LOGO_DATA} alt="" /></span>
      <span className="small muted">{label}</span>
    </div>
  )
}
