import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import {
  Empty, ItemCard, Media, PremiumBadge, Rating, Skeleton, Stars, TypeBadge, VerifiedBadge, toast, useFavs, useLoad,
} from '../components/ui'
import { APP, TYPES } from '../config'
import { api } from '../lib/api'
import { deliveryLabel } from '../lib/orders'
import type { Item, Vitrine } from '../lib/types'
import { formatPrice, intlPhone, isPremiumActive, waLink } from '../lib/utils'
import { ProtectionNote } from './orders/Orders'

/** Message pré-rempli : rappelle la protection, pour inciter à commander dans l'app. */
export function contactText(name: string, item?: string) {
  return item
    ? `Bonjour ${name}, je suis intéressé(e) par « ${item} » vu sur LinkApp. Est-ce disponible ?\n\n(Commandé via LinkApp, je suis protégé par ${APP.protectionName}.)`
    : `Bonjour ${name}, je vous ai trouvé sur LinkApp.`
}

/** Ouvre WhatsApp / l'appel en comptant le contact pour le vendeur. */
export function trackContact(v: Pick<Vitrine, 'id'>, channel: 'whatsapp' | 'call', itemId?: string) {
  api.logContact(v.id, channel, itemId).catch(() => { /* le contact passe même si le comptage échoue */ })
}

export default function VitrinePage({ slug }: { slug: string }) {
  const favs = useFavs()
  const v = useLoad(() => api.getVitrineBySlug(slug), [slug])
  const items = useLoad(() => (v.data ? api.listItems(v.data.id) : Promise.resolve([] as Item[])), [v.data?.id])
  const reviews = useLoad(() => (v.data ? api.listReviews(v.data.id) : Promise.resolve([])), [v.data?.id])
  const [open, setOpen] = useState<Item | null>(null)
  const [onlyAvail, setOnlyAvail] = useState(false)

  useEffect(() => { if (v.data) api.incrementViews(v.data.id) }, [v.data?.id])

  if (v.loading) return <div className="page stack"><Skeleton h={190} /><Skeleton h={120} /></div>
  if (!v.data) return <Empty icon="store" title="Vitrine introuvable" text="Elle a peut-être été retirée." action={<a className="btn" href="#/">Retour à l'accueil</a>} />

  const s = v.data
  const t = TYPES[s.type]
  const fav = favs.favs.includes(s.id)
  const phone = s.whatsapp || s.phone
  const list = (items.data ?? []).filter((i) => !onlyAvail || i.available)
  const share = async () => {
    const url = location.href
    try {
      if (navigator.share) await navigator.share({ title: s.name, text: `${s.name} sur LinkApp`, url })
      else { await navigator.clipboard.writeText(url); toast('Lien copié') }
    } catch { /* partage annulé */ }
  }

  return (
    <div className="v-page" style={{ paddingBottom: 80 }}>
      <div className="v-cover">
        <Media src={s.cover_url} type={s.type} label={s.name} />
        <button className="icon-btn" style={{ left: 16 }} aria-label="Retour" onClick={() => history.length > 1 ? history.back() : (location.hash = '/')}>
          <Icon name="back" />
        </button>
        <div className="row" style={{ position: 'absolute', right: 16, top: 'calc(12px + env(safe-area-inset-top))' }}>
          <button className="icon-btn" aria-label="Partager" onClick={share}><Icon name="share" /></button>
          <button className="icon-btn" aria-label="Favori" style={{ color: fav ? '#E11D48' : undefined }} onClick={() => favs.toggle(s.id)}>
            <Icon name="heart" filled={fav} />
          </button>
        </div>
      </div>

      <section className="card v-head">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="v-logo"><Media src={s.logo_url} type={s.type} label={s.name} /></div>
          <div className="row" style={{ gap: 6, marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {s.verified && <VerifiedBadge />}
            {isPremiumActive(s) && <PremiumBadge />}
            <TypeBadge type={s.type} />
          </div>
        </div>
        <h1 style={{ marginTop: 10 }}>{s.name}</h1>
        <p className="row small muted" style={{ gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
          <Rating v={s} />
          <span className="row" style={{ gap: 4 }}><Icon name="pin" size={14} />{[s.district, s.city].filter(Boolean).join(', ') || 'Localisation non précisée'}</span>
        </p>
        {s.description && <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>{s.description}</p>}
      </section>

      {phone ? (
        <div className="contact-bar">
          <a className="btn ghost" href={`tel:+${intlPhone(s.phone || s.whatsapp)}`} onClick={() => trackContact(s, 'call')}><Icon name="phone" size={18} />Appeler</a>
          <a className="btn green" target="_blank" rel="noreferrer" onClick={() => trackContact(s, 'whatsapp')}
            href={waLink(phone, contactText(s.name))}><Icon name="chat" size={18} />WhatsApp</a>
        </div>
      ) : (
        <div className="contact-bar" style={{ gridTemplateColumns: '1fr' }}>
          <p className="small muted center">Ce professionnel n'a pas encore ajouté de numéro de contact.</p>
        </div>
      )}

      <div className="page">
        <div className="section-head" style={{ marginTop: 8 }}>
          <h2>{t.itemPlural.replace('Mes ', 'Nos ')}</h2>
          <button className={'chip ' + (onlyAvail ? 'on' : '')} onClick={() => setOnlyAvail(!onlyAvail)}>Disponibles</button>
        </div>
        {items.loading && <div className="items"><Skeleton h={190} /><Skeleton h={190} /></div>}
        {!items.loading && list.length === 0 && <Empty title="Rien à afficher pour l'instant" />}
        <div className="items">
          {list.map((i) => <ItemCard key={i.id} item={i} type={s.type} onClick={() => setOpen(i)} />)}
        </div>

        {/* Avis vérifiés : uniquement des clients ayant acheté via LinkApp */}
        <div className="section-head">
          <h2>Avis vérifiés</h2>
          {s.rating_count > 0 && <span className="row small" style={{ gap: 6 }}><Stars value={s.rating_avg} /> <b>{String(s.rating_avg).replace('.', ',')}</b></span>}
        </div>
        <div className="card pad">
          {(reviews.data ?? []).length === 0 ? (
            <p className="small muted">Pas encore d'avis. Seuls les clients ayant commandé via LinkApp peuvent noter ce vendeur.</p>
          ) : (reviews.data ?? []).map((r) => (
            <div key={r.id} className="review">
              <div className="row between"><b className="small">{r.buyer_name}</b><Stars value={r.rating} size={13} /></div>
              {r.comment && <p className="small" style={{ marginTop: 4, color: 'var(--ink-2)' }}>{r.comment}</p>}
              <p className="tiny muted row" style={{ gap: 4, marginTop: 4 }}><Icon name="check" size={12} stroke={2.6} />Achat vérifié · {r.item_title} · {new Date(r.created_at).toLocaleDateString('fr-FR')}</p>
            </div>
          ))}
        </div>
      </div>

      {open && <ItemSheet item={open} v={s} phone={phone} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ItemSheet({ item, v, phone, onClose }: { item: Item; v: Vitrine; phone: string; onClose: () => void }) {
  const canSecure = v.verified && item.price != null && item.price <= APP.assuranceMax
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,18,32,.5)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="card" onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, borderRadius: '22px 22px 0 0', overflow: 'hidden', maxHeight: '90dvh', overflowY: 'auto' }}>
        <div style={{ aspectRatio: '4/3', position: 'relative' }}>
          <Media src={item.image_url} type={v.type} label={item.title} />
          <button className="icon-btn" style={{ position: 'absolute', top: 12, right: 12 }} aria-label="Fermer" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="page stack" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
          <div className="row between">
            <h2>{item.title}</h2>
            <span className={'badge ' + (item.available ? 'ok' : 'off')}>{item.available ? 'Disponible' : 'Indisponible'}</span>
          </div>
          <p className="price" style={{ fontSize: 18 }}>{formatPrice(item.price, item.unit)}</p>
          {item.description && <p style={{ color: 'var(--ink-2)' }}>{item.description}</p>}
          {item.available && item.price != null && (
            <>
              {canSecure ? <>
                <a className="btn block" href={`#/commander/${v.slug}/${item.id}`}><Icon name="shield" size={18} />Acheter avec {APP.protectionName}</a>
                <ProtectionNote compact />
                <a className="btn ghost block" href={`#/commander/${v.slug}/${item.id}?mode=direct`}>Commander sans assurance</a>
              </> : <>
                <a className="btn block" href={`#/commander/${v.slug}/${item.id}?mode=direct`}>Commander</a>
                <p className="alert info small">
                  {!v.verified ? `${APP.protectionName} n’est pas encore disponible : ce vendeur n’est pas encore vérifié par LinkApp.`
                    : `${APP.protectionName} couvre les commandes jusqu’à ${formatPrice(APP.assuranceMax)}.`}
                </p>
              </>}
              <p className="tiny muted center">{item.delivery_days === 0 ? 'Livraison le jour même' : `Livraison promise : ${deliveryLabel(item.delivery_days ?? 2)}`}</p>
            </>
          )}
          {phone && (
            <a className="link center" style={{ display: 'block' }} target="_blank" rel="noreferrer" onClick={() => trackContact(v, 'whatsapp', item.id)}
              href={waLink(phone, contactText(v.name, item.title))}>
              <Icon name="chat" size={18} />Poser une question sur WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
