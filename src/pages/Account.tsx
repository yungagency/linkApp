import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Empty, TopBar, VitrineRow, toast, useFavs, useLoad } from '../components/ui'
import { api } from '../lib/api'
import { resetDemo } from '../lib/demoApi'
import { navigate } from '../lib/router'
import { useSession } from '../lib/session'
import { errorMessage } from '../lib/utils'

export function Account() {
  const { profile, vitrine, refresh } = useSession()
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState({ full_name: profile?.full_name ?? '', phone: profile?.phone ?? '' })

  return (
    <>
      <TopBar title={profile ? 'Mon compte' : 'Compte'} />
      <div className="page stack">
        {profile ? (
          <div className="card pad row">
            <div className="ph commerce" style={{ width: 52, height: 52, borderRadius: 16, fontSize: 18 }}>
              {(profile.full_name || profile.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="grow">
              <h2 className="ellipsis">{profile.full_name || 'Sans nom'}</h2>
              <p className="small muted ellipsis">{profile.email}</p>
            </div>
            <span className="badge">{profile.role === 'admin' ? 'Admin' : vitrine ? 'Vendeur' : 'Client'}</span>
          </div>
        ) : (
          <div className="card pad stack">
            <h2>Bienvenue sur LinkApp</h2>
            <p className="small muted">Connectez-vous pour retrouver vos favoris sur tous vos appareils et contacter les vendeurs.</p>
            <div className="grid-2">
              <a className="btn ghost" href="#/connexion">Se connecter</a>
              <a className="btn" href="#/inscription">S'inscrire</a>
            </div>
          </div>
        )}

        {/* Espace vendeur : la porte d'entrée pour devenir vendeur */}
        {vitrine ? (
          <a className="card pad row" href="#/pro">
            <span className="ic" style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--blue-50)', color: 'var(--blue-600)' }}><Icon name="store" size={22} /></span>
            <span className="grow"><b>Mon espace vendeur</b><br /><span className="tiny muted ellipsis">{vitrine.name}</span></span>
            <Icon name="chevron" className="muted" />
          </a>
        ) : (
          <a className="premium-card" href="#/devenir-vendeur" style={{ display: 'block' }}>
            <div className="row">
              <span style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.16)' }}><Icon name="store" size={22} /></span>
              <span className="grow">
                <b style={{ fontSize: 16 }}>Devenir vendeur</b><br />
                <span className="small" style={{ opacity: .85 }}>Commerçant, agriculteur ou prestataire : ouvrez votre vitrine gratuitement.</span>
              </span>
              <Icon name="chevron" />
            </div>
          </a>
        )}

        {edit && profile ? (
          <form className="card pad stack" onSubmit={async (e) => {
            e.preventDefault()
            try { await api.updateProfile(f); await refresh(); setEdit(false); toast('Profil mis à jour') }
            catch (x) { toast(errorMessage(x)) }
          }}>
            <label className="field"><span>Nom complet</span><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></label>
            <label className="field"><span>Téléphone</span><input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
            <div className="grid-2"><button type="button" className="btn ghost" onClick={() => setEdit(false)}>Annuler</button><button className="btn">Enregistrer</button></div>
          </form>
        ) : null}

        <p className="small muted" style={{ fontWeight: 700, marginTop: 18 }}>PARAMÈTRES</p>
        <div className="card menu">
          <a href="#/favoris"><span className="ic"><Icon name="heart" size={18} /></span><span className="grow">Mes favoris</span><Icon name="chevron" className="muted" /></a>
          {profile && (
            <button onClick={() => { setF({ full_name: profile.full_name ?? '', phone: profile.phone ?? '' }); setEdit(true) }}>
              <span className="ic"><Icon name="edit" size={18} /></span><span className="grow">Modifier mes informations</span>
            </button>
          )}
          {profile?.role === 'admin' && (
            <a href="#/admin"><span className="ic"><Icon name="shield" size={18} /></span><span className="grow">Administration</span><Icon name="chevron" className="muted" /></a>
          )}
          {profile && (
            <button onClick={async () => { await api.signOut(); await refresh(); navigate('/', true) }}>
              <span className="ic" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}><Icon name="logout" size={18} /></span>
              <span className="grow">Se déconnecter</span>
            </button>
          )}
        </div>

        {api.mode === 'demo' && (
          <button className="btn ghost block sm" onClick={() => { if (confirm('Effacer toutes les données de démo de cet appareil ?')) resetDemo() }}>
            Réinitialiser les données de démo
          </button>
        )}
      </div>
    </>
  )
}

/** Page d'explication avant de devenir vendeur. */
export function BecomeSeller() {
  const { profile, vitrine } = useSession()
  useEffect(() => { if (vitrine) navigate('/pro', true) }, [vitrine])
  const start = profile ? '#/pro/vitrine' : '#/inscription?next=' + encodeURIComponent('/pro/vitrine')
  const perks = [
    ['store', 'Votre vitrine en 2 minutes', 'Une photo, un nom, vos produits : c’est en ligne.'],
    ['chat', 'Les clients vous écrivent directement', 'Appel ou WhatsApp, sans intermédiaire ni commission.'],
    ['eye', 'Suivez vos visites', 'Voyez combien de personnes consultent votre vitrine.'],
  ]
  return (
    <>
      <TopBar back="/compte" title="Devenir vendeur" />
      <div className="page stack">
        <div className="hero">
          <img src="./logo-mark.png" alt="" className="hero-deco" />
          <h2>Vendez près de chez vous</h2>
          <p>Commerçants, agriculteurs, prestataires : LinkApp vous rend visible auprès des clients de votre ville.</p>
        </div>
        <div className="card menu">
          {perks.map(([icon, t, d]) => (
            <div key={t} className="row" style={{ padding: '14px 16px', alignItems: 'flex-start' }}>
              <span className="ic"><Icon name={icon!} size={18} /></span>
              <span className="grow"><b>{t}</b><br /><span className="small muted">{d}</span></span>
            </div>
          ))}
        </div>
        <p className="small muted center">Gratuit pour commencer. Passez Premium quand vous voulez plus de visibilité.</p>
        <a className="btn block" href={start}>{profile ? 'Ouvrir ma vitrine' : 'Créer mon compte vendeur'}</a>
        {!profile && <p className="center small muted">Déjà un compte ? <a className="link" href={'#/connexion?next=' + encodeURIComponent('/pro/vitrine')}>Se connecter</a></p>}
      </div>
    </>
  )
}

export function Favorites() {
  const favs = useFavs()
  const all = useLoad(() => api.listVitrines(), [])
  const list = (all.data ?? []).filter((v) => favs.favs.includes(v.id))
  return (
    <>
      <TopBar title="Favoris" />
      <div className="page stack">
        {!all.loading && list.length === 0 && (
          <Empty icon="heart" title="Aucun favori" text="Touchez le cœur d'une vitrine pour la retrouver ici."
            action={<a className="btn" href="#/explorer">Explorer</a>} />
        )}
        {list.map((v) => (
          <VitrineRow key={v.id} v={v} right={
            <button className="icon-btn" style={{ color: '#E11D48' }} aria-label="Retirer"
              onClick={(e) => { e.preventDefault(); favs.toggle(v.id) }}><Icon name="heart" filled size={18} /></button>
          } />
        ))}
      </div>
    </>
  )
}
