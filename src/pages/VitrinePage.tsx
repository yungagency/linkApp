import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Empty, ItemCard, Media, PremiumBadge, Skeleton, TypeBadge, toast, useFavs, useLoad } from '../components/ui'
import { TYPES } from '../config'
import { api } from '../lib/api'
import { ProtectionNote } from './orders/Orders'
import { APP } from '../config'
import { deliveryLabel } from '../lib/orders'
import type { Item, VitrineType } from '../lib/types'
import { formatPrice, intlPhone, isPremiumActive, waLink } from '../lib/utils'

export default function VitrinePage({ slug }: { slug: string }) {
  const favs = useFavs()
  const v = useLoad(() => api.getVitrineBySlug(slug), [slug])
  const items = useLoad(() => (v.data ? api.listItems(v.data.id) : Promise.resolve([] as Item[])), [v.data?.id])
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
          <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
            {isPremiumActive(s) && <PremiumBadge />}
            <TypeBadge type={s.type} />
          </div>
        </div>
        <h1 style={{ marginTop: 10 }}>{s.name}</h1>
        <p className="row small muted" style={{ gap: 4, marginTop: 2 }}>
          <Icon name="pin" size={14} />{[s.district, s.city].filter(Boolean).join(', ') || 'Localisation non précisée'}
        </p>
        {s.description && <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>{s.description}</p>}
      </section>

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
      </div>

      {phone ? (
        <div className="contact-bar">
          <a className="btn ghost" href={`tel:+${intlPhone(s.phone || s.whatsapp)}`}><Icon name="phone" size={18} />Appeler</a>
          <a className="btn green" target="_blank" rel="noreferrer"
            href={waLink(phone, `Bonjour ${s.name}, je vous ai trouvé sur LinkApp.`)}><Icon name="chat" size={18} />WhatsApp</a>
        </div>
      ) : (
        <div className="contact-bar" style={{ gridTemplateColumns: '1fr' }}>
          <p className="small muted center">Ce professionnel n'a pas encore ajouté de numéro de contact.</p>
        </div>
      )}

      {open && <ItemSheet item={open} slug={s.slug} vitrineName={s.name} type={s.type} phone={phone} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ItemSheet({ item, slug, vitrineName, type, phone, onClose }:
  { item: Item; slug: string; vitrineName: string; type: VitrineType; phone: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,18,32,.5)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="card" onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, borderRadius: '22px 22px 0 0', overflow: 'hidden', maxHeight: '90dvh', overflowY: 'auto' }}>
        <div style={{ aspectRatio: '4/3', position: 'relative' }}>
          <Media src={item.image_url} type={type} label={item.title} />
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
              <a className="btn block" href={`#/commander/${slug}/${item.id}`}><Icon name="shield" size={18} />Acheter avec {APP.protectionName}</a>
              <ProtectionNote compact />
              <a className="btn ghost block" href={`#/commander/${slug}/${item.id}?mode=direct`}>Commander sans assurance</a>
              <p className="tiny muted center">{item.delivery_days === 0 ? 'Livraison le jour même' : `Livraison promise : ${deliveryLabel(item.delivery_days ?? 2)}`}</p>
            </>
          )}
          {phone && (
            <a className="link center" style={{ display: 'block' }} target="_blank" rel="noreferrer"
              href={waLink(phone, `Bonjour ${vitrineName}, je suis intéressé(e) par « ${item.title} » vu sur LinkApp. Est-ce disponible ?`)}>
              <Icon name="chat" size={18} />Poser une question sur WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
