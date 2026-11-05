import { useEffect, useState } from 'react'
import { PhotoPicker, Skeleton, TopBar, toast, useLoad } from '../../components/ui'
import { PLANS, TYPES } from '../../config'
import { api } from '../../lib/api'
import { navigate } from '../../lib/router'
import { useSession } from '../../lib/session'
import type { Item } from '../../lib/types'
import { errorMessage, isPremiumActive } from '../../lib/utils'

const UNITS = {
  commerce: ["l'unité", 'le lot', 'le carton', 'le paquet'],
  agriculture: ['le kg', 'le sac', 'le tas', 'le régime', 'la cuvette', 'la tonne'],
  service: ['la prestation', "l'heure", 'la journée', 'le forfait'],
}

export default function ItemForm({ id }: { id: string }) {
  const { vitrine: v } = useSession()
  const isNew = id === 'new'
  const all = useLoad(() => (v ? api.listItems(v.id) : Promise.resolve([] as Item[])), [v?.id])
  const [f, setF] = useState<Partial<Item> | null>(null)
  const [priceText, setPriceText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!v || !all.data || f) return
    if (isNew) { setF({ vitrine_id: v.id, title: '', description: '', unit: TYPES[v.type].defaultUnit, available: true, image_url: null }); return }
    const found = all.data.find((i) => i.id === id)
    if (found) { setF(found); setPriceText(found.price == null ? '' : String(found.price)) }
    else navigate('/pro', true)
  }, [v, all.data, id, isNew, f])

  if (!v) return null
  const t = TYPES[v.type]
  const limitReached = isNew && !isPremiumActive(v) && (all.data?.length ?? 0) >= PLANS[0]!.maxItems

  if (!f) return <><TopBar back="/pro" title={isNew ? t.addLabel : 'Modifier'} /><div className="page stack"><Skeleton h={260} /><Skeleton h={60} /></div></>

  if (limitReached) {
    return (
      <>
        <TopBar back="/pro" title={t.addLabel} />
        <div className="page stack">
          <p className="alert warn">Vous avez atteint la limite de {PLANS[0]!.maxItems} {t.itemSingular}s du plan gratuit.</p>
          <a className="btn block" href="#/pro/abonnement">Passer Premium</a>
        </div>
      </>
    )
  }

  const set = <K extends keyof Item>(k: K, val: Item[K]) => setF((p) => ({ ...p!, [k]: val }))

  return (
    <>
      <TopBar back="/pro" title={isNew ? t.addLabel : `Modifier le ${t.itemSingular}`} />
      <form className="page stack" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setBusy(true)
        try {
          const price = priceText.trim() === '' ? null : Number(priceText.replace(/\s/g, ''))
          if (price != null && (Number.isNaN(price) || price < 0)) throw new Error('Prix invalide')
          await api.saveItem({ ...f, vitrine_id: v.id, title: (f.title ?? '').trim(), price })
          toast(isNew ? 'Ajouté à votre vitrine' : 'Modifications enregistrées')
          navigate('/pro', true)
        } catch (x) { setErr(errorMessage(x)) } finally { setBusy(false) }
      }}>
        <PhotoPicker value={f.image_url ?? null} ratio="4/3" onChange={(u) => set('image_url', u)} label={`Photo du ${t.itemSingular}`} />
        <label className="field"><span>Nom *</span>
          <input className="input" required maxLength={80} value={f.title ?? ''} onChange={(e) => set('title', e.target.value)}
            placeholder={v.type === 'agriculture' ? 'Ex : Maïs sec' : v.type === 'service' ? 'Ex : Vidange complète' : 'Ex : Écouteurs Bluetooth'} />
        </label>
        <div className="grid-2">
          <label className="field"><span>Prix (FCFA)</span>
            <input className="input" inputMode="numeric" value={priceText} onChange={(e) => setPriceText(e.target.value.replace(/[^\d\s]/g, ''))} placeholder="Laisser vide = sur demande" />
          </label>
          <label className="field"><span>Unité</span>
            <select className="select" value={f.unit ?? ''} onChange={(e) => set('unit', e.target.value)}>
              {[...new Set([...(UNITS[v.type]), f.unit ?? ''])].filter(Boolean).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span>Description</span>
          <textarea className="textarea" maxLength={500} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)}
            placeholder={v.type === 'agriculture' ? 'Variété, quantité disponible, période de récolte…' : 'Détails utiles pour le client…'} />
        </label>
        <button type="button" className="card switch" onClick={() => set('available', !f.available)}>
          <span><b>Disponible</b><br /><span className="tiny muted">Désactivez si en rupture ou hors saison</span></span>
          <span className={'toggle ' + (f.available ? 'on' : '')} />
        </button>
        {err && <p className="alert err">{err}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Enregistrement…' : isNew ? 'Publier' : 'Enregistrer'}</button>
        {!isNew && (
          <button type="button" className="btn danger block" onClick={async () => {
            if (!confirm(`Supprimer « ${f.title} » ?`)) return
            try { await api.deleteItem(f.id!); toast('Supprimé'); navigate('/pro', true) } catch (x) { setErr(errorMessage(x)) }
          }}>Supprimer</button>
        )}
      </form>
    </>
  )
}
