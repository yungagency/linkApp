import { useEffect, useState } from 'react'

const SEEN = 'linkapp-splash'
const MASK = 'url(./logo-mark.png) center / contain no-repeat'
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Animation d'ouverture : la marque apparaît avec un halo et un reflet,
 * le nom se révèle lettre par lettre, puis la signature s'installe.
 * Jouée une fois par session (pas à chaque changement de page).
 */
export function Splash() {
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>(() => {
    try { return sessionStorage.getItem(SEEN) ? 'done' : 'in' } catch { return 'in' }
  })

  useEffect(() => {
    // Retire le logo statique de index.html (affiché avant le chargement du JS)
    document.getElementById('boot')?.remove()
    if (phase === 'done') return
    try { sessionStorage.setItem(SEEN, '1') } catch { /* navigation privée */ }
    const total = reduced() ? 500 : 2300
    const t1 = setTimeout(() => setPhase('out'), total)
    const t2 = setTimeout(() => setPhase('done'), total + 550)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (phase === 'done') return null
  const letters = 'LinkApp'.split('')
  return (
    <div className={'splash ' + (phase === 'out' ? 'out' : '')} aria-hidden="true" onClick={() => setPhase('out')}>
      <div className="splash-glow" />
      <div className="splash-center">
        <div className="splash-mark">
          <span className="splash-ring" />
          <span className="splash-ring r2" />
          <img src="./logo-mark.png" alt="" />
          <span className="splash-shine" style={{ WebkitMask: MASK, mask: MASK }} />
        </div>
        <div className="splash-lockup">
        <div className="splash-word">
          {letters.map((l, i) => (
            <span key={i} className={i >= 4 ? 'app' : ''} style={{ animationDelay: `${0.75 + i * 0.06}s` }}>{l}</span>
          ))}
        </div>
        <p className="splash-tag">Vos opportunités, en un seul lieu</p>
        </div>
      </div>
      <div className="splash-bar"><span /></div>
    </div>
  )
}
