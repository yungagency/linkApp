import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

/**
 * Routeur par hash (#/explorer) : fonctionne tel quel en PWA, sur Vercel
 * et dans Capacitor (fichiers locaux), sans configuration serveur.
 */
export function currentPath(): string {
  return location.hash.replace(/^#/, '') || '/'
}

export function navigate(to: string, replace = false) {
  const h = '#' + to
  if (replace) history.replaceState(null, '', h)
  else location.hash = to
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function usePath(): string {
  const [p, setP] = useState(currentPath())
  useEffect(() => {
    const on = () => { setP(currentPath()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return p
}

/** match('/v/:slug', '/v/la-ferme') -> { slug: 'la-ferme' } */
export function match(pattern: string, path: string): Record<string, string> | null {
  const [clean, query = ''] = path.split('?')
  const a = pattern.split('/').filter(Boolean)
  const b = clean!.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(':')) params[a[i]!.slice(1)] = decodeURIComponent(b[i]!)
    else if (a[i] !== b[i]) return null
  }
  new URLSearchParams(query).forEach((v, k) => { params[k] = v })
  return params
}

export function Link(props: { to: string; className?: string; children: ReactNode; ariaLabel?: string }) {
  return <a href={'#' + props.to} className={props.className} aria-label={props.ariaLabel}>{props.children}</a>
}
