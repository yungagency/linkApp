import { useState } from 'react'
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
  if (!profile) return null

  return (
    <>
      <TopBar title="Mon compte" />
      <div className="page stack">
        <div className="card pad row">
          <div className="ph commerce" style={{ width: 52, height: 52, borderRadius: 16, fontSize: 18 }}>
            {(profile.full_name || profile.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="grow">
            <h2 className="ellipsis">{profile.full_name || 'Sans nom'}</h2>
            <p className="small muted ellipsis">{profile.email}</p>
          </div>
          {profile.role === 'admin' && <span className="badge">Admin</span>}
        </div>

        {edit ? (
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

        <div className="card menu">
          <a href={vitrine ? '#/pro' : '#/pro/vitrine'}>
            <span className="ic"><Icon name="store" size={18} /></span>
            <span className="grow">{vitrine ? 'Mon espace pro' : 'Créer ma vitrine (commerçant, agriculteur, prestataire)'}</span>
            <Icon name="chevron" className="muted" />
          </a>
          {profile.role === 'admin' && (
            <a href="#/admin"><span className="ic"><Icon name="shield" size={18} /></span><span className="grow">Administration</span><Icon name="chevron" className="muted" /></a>
          )}
          <button onClick={() => setEdit(true)}><span className="ic"><Icon name="edit" size={18} /></span><span className="grow">Modifier mes informations</span></button>
          <button onClick={async () => { await api.signOut(); await refresh(); navigate('/', true) }}>
            <span className="ic" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}><Icon name="logout" size={18} /></span>
            <span className="grow">Se déconnecter</span>
          </button>
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
