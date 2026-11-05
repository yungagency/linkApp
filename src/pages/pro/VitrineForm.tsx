import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { PhotoPicker, TopBar, toast, useLoad } from '../../components/ui'
import { TYPES } from '../../config'
import { api } from '../../lib/api'
import { navigate } from '../../lib/router'
import { useSession } from '../../lib/session'
import type { Vitrine, VitrineType } from '../../lib/types'
import { errorMessage } from '../../lib/utils'

const DESC: Record<VitrineType, string> = {
  commerce: 'Je vends des produits : boutique, magasin, vente en ligne.',
  agriculture: 'Je produis et vends : cultures, vivres, élevage.',
  service: 'Je propose un savoir-faire : réparation, beauté, transport…',
}

/** Création (étape 1 : type, étape 2 : infos) et modification de la vitrine. */
export default function VitrineForm() {
  const { profile, vitrine, refresh } = useSession()
  const editing = !!vitrine
  const [step, setStep] = useState<1 | 2>(editing ? 2 : 1)
  const [f, setF] = useState<Partial<Vitrine> & { type: VitrineType; name: string }>(
    vitrine ?? { type: 'commerce', name: '', city: 'Yaoundé', district: '', description: '', phone: profile?.phone ?? '', whatsapp: profile?.phone ?? '', category_id: null, cover_url: null, logo_url: null },
  )
  const cats = useLoad(() => api.listCategories(f.type), [f.type])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Vitrine>(k: K, v: Vitrine[K]) => setF((p) => ({ ...p, [k]: v }))

  if (step === 1) {
    return (
      <>
        <TopBar title="Créer ma vitrine" back="/compte" />
        <div className="page stack">
          <p className="muted">Quel est votre profil ?</p>
          {(Object.keys(TYPES) as VitrineType[]).map((t) => (
            <button key={t} className={'card type-choice ' + (f.type === t ? 'on' : '')} onClick={() => setF({ ...f, type: t, category_id: null })}>
              <span className={`ic t-${t}`}><Icon name={TYPES[t].icon} size={24} /></span>
              <span className="grow"><h3>{TYPES[t].label}</h3><span className="small muted">{DESC[t]}</span></span>
              {f.type === t && <Icon name="check" className="link" />}
            </button>
          ))}
          <button className="btn block" onClick={() => setStep(2)}>Continuer</button>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={editing ? 'Modifier ma vitrine' : TYPES[f.type].space} back={editing ? '/pro' : true} />
      <form className="page stack" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setBusy(true)
        try {
          await api.saveVitrine(f)
          await refresh()
          toast(editing ? 'Vitrine mise à jour' : 'Votre vitrine est en ligne 🎉')
          navigate('/pro', true)
        } catch (x) { setErr(errorMessage(x)) } finally { setBusy(false) }
      }}>
        {!editing && (
          <button type="button" className="chip" onClick={() => setStep(1)} style={{ alignSelf: 'flex-start' }}>
            <Icon name={TYPES[f.type].icon} size={15} />{TYPES[f.type].label} · changer
          </button>
        )}
        <div>
          <span className="small" style={{ fontWeight: 650, color: 'var(--ink-2)' }}>Photo de couverture</span>
          <div style={{ marginTop: 6 }}><PhotoPicker value={f.cover_url ?? null} ratio="16/9" onChange={(u) => set('cover_url', u)} /></div>
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ width: 96 }}><PhotoPicker value={f.logo_url ?? null} label="Logo" onChange={(u) => set('logo_url', u)} /></div>
          <label className="field grow"><span>Nom de la vitrine *</span>
            <input className="input" required maxLength={60} value={f.name} onChange={(e) => set('name', e.target.value)}
              placeholder={f.type === 'agriculture' ? 'Ex : La Ferme Bio' : f.type === 'service' ? 'Ex : Garage Auto Plus' : 'Ex : Tech Mart'} />
          </label>
        </div>
        <label className="field"><span>Catégorie</span>
          <select className="select" value={f.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}>
            <option value="">Choisir…</option>
            {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Présentation</span>
          <textarea className="textarea" maxLength={400} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)}
            placeholder="Ce que vous proposez, vos horaires, vos zones de livraison…" />
        </label>
        <div className="grid-2">
          <label className="field"><span>Ville</span><input className="input" value={f.city ?? ''} onChange={(e) => set('city', e.target.value)} /></label>
          <label className="field"><span>Quartier</span><input className="input" value={f.district ?? ''} onChange={(e) => set('district', e.target.value)} /></label>
        </div>
        <div className="grid-2">
          <label className="field"><span>Téléphone</span><input className="input" type="tel" inputMode="tel" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></label>
          <label className="field"><span>WhatsApp</span><input className="input" type="tel" inputMode="tel" value={f.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} /></label>
        </div>
        <p className="hint">Les clients vous contactent directement par appel ou WhatsApp.</p>
        {err && <p className="alert err">{err}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Publier ma vitrine'}</button>
      </form>
    </>
  )
}
