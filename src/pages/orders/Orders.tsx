import { useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Empty, Media, Skeleton, TopBar, toast, useLoad } from '../../components/ui'
import { APP } from '../../config'
import { api } from '../../lib/api'
import { CONFIRM_DAYS, HELD, STATUS, STEPS, canMove, stepIndex, type OrderStatus } from '../../lib/orders'
import { navigate } from '../../lib/router'
import { useSession } from '../../lib/session'
import type { Item, Order, OrderMove } from '../../lib/types'
import { errorMessage, formatPrice, intlPhone, waLink } from '../../lib/utils'

const fcfa = (n: number) => formatPrice(n)
const date = (s: string) => new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function StatusBadge({ s }: { s: OrderStatus }) {
  const t = STATUS[s].tone
  return <span className={'badge ' + (t === 'ok' ? 'ok' : t === 'warn' ? 'warn' : t === 'off' ? 'off' : t === 'secure' ? 'secure' : '')}>
    {t === 'secure' && <Icon name="shield" size={12} stroke={2.2} />}{STATUS[s].short}
  </span>
}

/** Bandeau « Achat protégé » réutilisé sur la fiche article et au paiement. */
export function ProtectionNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className="protect">
      <span className="protect-ic"><Icon name="shield" size={compact ? 18 : 22} /></span>
      <span>
        <b>Achat protégé LinkApp</b>
        {!compact && <><br /><span className="small">Votre argent est bloqué par LinkApp et versé au vendeur seulement quand vous confirmez la réception.</span></>}
      </span>
    </div>
  )
}

/* =====================================================================
   Passer commande : /commander/:slug/:itemId
   ===================================================================== */
export function Checkout({ slug, itemId }: { slug: string; itemId: string }) {
  const { profile } = useSession()
  const data = useLoad(async () => {
    const v = await api.getVitrineBySlug(slug)
    const items = v ? await api.listItems(v.id) : []
    return { v, item: items.find((i) => i.id === itemId) as Item | undefined }
  }, [slug, itemId])
  const [qty, setQty] = useState(1)
  const [f, setF] = useState({ buyer_name: profile?.full_name ?? '', buyer_phone: profile?.phone ?? '', address: '', note: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (data.loading) return <><TopBar back title="Commander" /><div className="page stack"><Skeleton h={100} /><Skeleton h={200} /></div></>
  const { v, item } = data.data ?? {}
  if (!v || !item) return <><TopBar back title="Commander" /><Empty title="Article introuvable" /></>
  if (item.price == null) return <><TopBar back title="Commander" /><Empty title="Prix sur demande" text="Contactez le vendeur sur WhatsApp pour cet article." /></>

  const total = item.price * qty
  return (
    <>
      <TopBar back={`/v/${slug}`} title="Commander" />
      <form className="page stack" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setBusy(true)
        try {
          const o = await api.createOrder({ item_id: item.id, quantity: qty, ...f })
          toast('Commande créée')
          navigate('/commande/' + o.id, true)
        } catch (x) { setErr(errorMessage(x)) } finally { setBusy(false) }
      }}>
        <div className="card pad row">
          <div style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}><Media src={item.image_url} type={v.type} label={item.title} /></div>
          <div className="grow">
            <h3 className="ellipsis">{item.title}</h3>
            <p className="tiny muted row" style={{ gap: 4 }}><Icon name="store" size={12} />{v.name}</p>
            <p className="price">{formatPrice(item.price, item.unit)}</p>
          </div>
          <div className="qty" aria-label="Quantité">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Moins">−</button>
            <b>{qty}</b>
            <button type="button" onClick={() => setQty(Math.min(999, qty + 1))} aria-label="Plus">+</button>
          </div>
        </div>

        <h3 style={{ marginTop: 8 }}>{v.type === 'service' ? 'Lieu de la prestation' : 'Livraison'}</h3>
        <label className="field"><span>Nom</span><input className="input" required value={f.buyer_name} onChange={(e) => setF({ ...f, buyer_name: e.target.value })} /></label>
        <label className="field"><span>Téléphone</span><input className="input" type="tel" inputMode="tel" required value={f.buyer_phone} onChange={(e) => setF({ ...f, buyer_phone: e.target.value })} /></label>
        <label className="field"><span>Adresse précise</span>
          <textarea className="textarea" required style={{ minHeight: 70 }} placeholder="Quartier, repère (ex : Tamdja, derrière la pharmacie…)" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </label>
        <label className="field"><span>Message au vendeur (facultatif)</span>
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Heure de livraison souhaitée…" />
        </label>

        <div className="card pad stack">
          <div className="row between small"><span className="muted">{qty} × {formatPrice(item.price)}</span><span>{fcfa(total)}</span></div>
          <div className="row between small"><span className="muted">Protection LinkApp</span><span className="ok-text">Incluse</span></div>
          <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}><b>Total à payer</b><b className="price" style={{ fontSize: 18 }}>{fcfa(total)}</b></div>
        </div>
        <ProtectionNote />
        {err && <p className="alert err">{err}</p>}
        <button className="btn block" disabled={busy}><Icon name="shield" size={18} />{busy ? 'Création…' : 'Valider la commande'}</button>
        <p className="tiny muted center">Le paiement Mobile Money se fait à l'étape suivante.</p>
      </form>
    </>
  )
}

/* =====================================================================
   Listes : /commandes (client) et /pro/commandes (vendeur)
   ===================================================================== */
export function OrderList({ mode }: { mode: 'buyer' | 'seller' }) {
  const list = useLoad(() => (mode === 'buyer' ? api.myOrders() : api.sellerOrders()), [mode])
  const [filter, setFilter] = useState<'active' | 'done'>('active')
  const done: OrderStatus[] = ['completed', 'refunded', 'cancelled']
  const rows = (list.data ?? []).filter((o) => (filter === 'done') === done.includes(o.status))
  return (
    <>
      <TopBar back={mode === 'seller' ? '/pro' : '/compte'} title={mode === 'seller' ? 'Commandes reçues' : 'Mes commandes'} />
      <div className="page stack" style={{ paddingTop: 0 }}>
        <div className="chips">
          <button className={'chip ' + (filter === 'active' ? 'on' : '')} onClick={() => setFilter('active')}>En cours</button>
          <button className={'chip ' + (filter === 'done' ? 'on' : '')} onClick={() => setFilter('done')}>Terminées</button>
        </div>
        {list.loading && [0, 1].map((i) => <Skeleton key={i} h={90} />)}
        {!list.loading && rows.length === 0 && (
          <Empty icon="box" title={filter === 'active' ? 'Aucune commande en cours' : 'Aucune commande terminée'}
            text={mode === 'buyer' ? 'Vos achats protégés apparaîtront ici.' : 'Les commandes de vos clients apparaîtront ici.'} />
        )}
        <div className="stack vlist">
          {rows.map((o) => (
            <a key={o.id} href={`#/commande/${o.id}`} className="card vrow">
              <div className="thumb"><Media src={o.item_image} type={o.vitrine?.type ?? 'commerce'} label={o.item_title} /></div>
              <div className="grow">
                <div className="row between" style={{ gap: 6 }}><h3 className="ellipsis">{o.item_title}</h3><StatusBadge s={o.status} /></div>
                <p className="small muted ellipsis">{mode === 'buyer' ? o.vitrine?.name : o.buyer_name} · {o.code}</p>
                <p className="price small">{fcfa(mode === 'seller' ? o.seller_amount : o.subtotal)}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

/* =====================================================================
   Détail + suivi : /commande/:id  (même écran pour client, vendeur et admin)
   ===================================================================== */
export function OrderDetail({ id }: { id: string }) {
  const d = useLoad(() => api.getOrder(id), [id])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<{ kind: 'pay' | 'dispute' | 'ship' | null; method: 'orange' | 'mtn'; ref: string; text: string }>({ kind: null, method: 'orange', ref: '', text: '' })

  if (d.loading && !d.data) return <><TopBar back title="Commande" /><div className="page stack"><Skeleton h={120} /><Skeleton h={220} /></div></>
  if (!d.data) return <><TopBar back="/" title="Commande" /><Empty title="Commande introuvable" /></>
  const { order: o, events, role } = d.data
  const can = (to: OrderStatus) => canMove(o.status, to, role)
  const held = HELD.includes(o.status)
  const step = stepIndex(o.status)
  const type = o.vitrine?.type ?? 'commerce'
  const deadline = o.delivered_at ? new Date(new Date(o.delivered_at).getTime() + CONFIRM_DAYS * 864e5) : null
  const late = !!deadline && deadline < new Date()

  const move = async (to: OrderStatus, extra: OrderMove = {}, msg = 'Commande mise à jour', ask?: string) => {
    if (ask && !confirm(ask)) return
    setBusy(true)
    try { await api.moveOrder(o.id, to, extra); toast(msg); setForm({ ...form, kind: null, text: '', ref: '' }); d.reload() }
    catch (x) { toast(errorMessage(x)) } finally { setBusy(false) }
  }

  return (
    <>
      <TopBar back={role === 'seller' ? '/pro/commandes' : role === 'admin' ? '/admin' : '/commandes'} title={`Commande ${o.code}`} />
      <div className="page stack" style={{ paddingTop: 0 }}>

        {/* Statut + frise de suivi */}
        <section className="card pad order-head">
          <div className="row between">
            <div><p className="tiny muted">Statut</p><h2>{STATUS[o.status].label}</h2></div>
            <StatusBadge s={o.status} />
          </div>
          {step >= 0 && (
            <ol className="stepper" aria-label="Suivi de la commande">
              {STEPS.map((s, i) => (
                <li key={s.key} className={i < step ? 'done' : i === step ? 'now' : ''}>
                  <span className="dot"><Icon name={i < step ? 'check' : s.icon} size={14} stroke={2.2} /></span>
                  <span className="lbl">{s.key === 'delivered' && type === 'service' ? 'Réalisée' : s.key === 'shipped' && type === 'service' ? 'En cours' : s.label}</span>
                </li>
              ))}
            </ol>
          )}
          {(o.status === 'dispute' || o.status === 'refunded' || o.status === 'cancelled') && (
            <p className={'alert ' + (o.status === 'dispute' ? 'warn' : 'info')} style={{ marginTop: 12 }}>
              {o.status === 'dispute' && <>Litige ouvert : « {o.dispute_reason} ». L'équipe LinkApp examine le dossier. L'argent reste bloqué.</>}
              {o.status === 'refunded' && <>Le client a été remboursé.</>}
              {o.status === 'cancelled' && <>Commande annulée.</>}
            </p>
          )}
        </section>

        {/* Argent : séquestre */}
        <section className={'escrow ' + (held ? 'held' : o.status === 'completed' ? 'released' : '')}>
          <span className="escrow-ic"><Icon name={o.status === 'completed' ? 'check' : 'shield'} size={22} /></span>
          <div className="grow">
            <p className="tiny" style={{ opacity: .75, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600 }}>
              {held ? 'Argent bloqué par LinkApp' : o.status === 'completed' ? (o.payout_status === 'paid' ? 'Versé au vendeur' : 'Libéré, versement en cours') : 'Montant'}
            </p>
            <b style={{ fontSize: 22 }}>{fcfa(role === 'seller' ? o.seller_amount : o.subtotal)}</b>
            {role !== 'buyer' && <p className="tiny" style={{ opacity: .75 }}>Total client {fcfa(o.subtotal)} · commission {Math.round(o.commission_rate * 100)} % ({fcfa(o.commission)}) · vendeur {fcfa(o.seller_amount)}</p>}
            {role === 'buyer' && held && <p className="tiny" style={{ opacity: .75 }}>Versé au vendeur seulement après votre confirmation de réception.</p>}
          </div>
        </section>

        {/* Actions selon le rôle */}
        {ActionPanel()}

        {/* Article */}
        <section className="card pad row">
          <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}><Media src={o.item_image} type={type} label={o.item_title} /></div>
          <div className="grow">
            <h3 className="ellipsis">{o.item_title}</h3>
            <p className="small muted">{o.quantity} × {formatPrice(o.unit_price, o.unit)}</p>
            {o.vitrine && <a className="tiny link" href={`#/v/${o.vitrine.slug}`}>{o.vitrine.name}</a>}
          </div>
        </section>

        <section className="card pad stack small">
          <h3>{type === 'service' ? 'Lieu de la prestation' : 'Livraison'}</h3>
          <p><b>{o.buyer_name}</b> · {o.buyer_phone}</p>
          <p className="muted">{o.address}</p>
          {o.note && <p className="muted">« {o.note} »</p>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {role !== 'buyer' && o.buyer_phone && <a className="btn ghost sm" href={`tel:+${intlPhone(o.buyer_phone)}`}><Icon name="phone" size={16} />Appeler le client</a>}
            {role !== 'seller' && o.vitrine && (o.vitrine.whatsapp || o.vitrine.phone) && (
              <a className="btn ghost sm" target="_blank" rel="noreferrer" href={waLink(o.vitrine.whatsapp || o.vitrine.phone, `Bonjour, à propos de ma commande ${o.code} sur LinkApp.`)}><Icon name="chat" size={16} />Écrire au vendeur</a>
            )}
          </div>
        </section>

        {/* Journal : la trace de chaque étape */}
        <section className="card pad">
          <h3 style={{ marginBottom: 10 }}>Historique</h3>
          <ol className="timeline">
            {[...events].reverse().map((e) => (
              <li key={e.id}>
                <span className="t-dot" />
                <div>
                  <b className="small">{STATUS[e.status as OrderStatus]?.label ?? e.status}</b>
                  <p className="tiny muted">{date(e.created_at)} · {e.actor === 'buyer' ? 'Client' : e.actor === 'seller' ? 'Vendeur' : 'LinkApp'}{e.note ? ` · ${e.note}` : ''}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )

  function ActionPanel() {
    const box = (children: ReactNode) => <section className="card pad stack action-box">{children}</section>

    // ---------- CLIENT ----------
    if (role === 'buyer') {
      if (o.status === 'pending_payment') {
        const nums = APP.paymentNumbers
        return box(<>
          <h3>Payer {fcfa(o.subtotal)} par Mobile Money</h3>
          <div className="grid-2">
            {(['orange', 'mtn'] as const).map((m) => (
              <button key={m} type="button" className={'pay-opt ' + (form.method === m ? 'on' : '')} onClick={() => setForm({ ...form, method: m })}>
                <b>{m === 'orange' ? 'Orange Money' : 'MTN MoMo'}</b>
                <span className="tiny muted">{(m === 'orange' ? nums.orange : nums.mtn) || 'Numéro communiqué par l’équipe'}</span>
              </button>
            ))}
          </div>
          <p className="small muted">Envoyez exactement <b>{fcfa(o.subtotal)}</b> avec le motif <b>{o.code}</b>, puis collez la référence reçue par SMS.</p>
          <input className="input" placeholder="Référence de la transaction (ex : MP2611…)" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
          <button className="btn block" disabled={busy || !form.ref.trim()} onClick={() => move('payment_submitted', { payment_method: form.method, payment_ref: form.ref.trim() }, 'Paiement envoyé pour vérification')}>J'ai payé</button>
          <button className="link" onClick={() => move('cancelled', { note: 'Annulée par le client' }, 'Commande annulée', 'Annuler cette commande ?')}>Annuler la commande</button>
        </>)
      }
      if (o.status === 'payment_submitted') return box(<p className="alert info">Paiement en vérification ({o.payment_method === 'mtn' ? 'MTN MoMo' : 'Orange Money'} · {o.payment_ref}). Vous serez informé dès qu'il est confirmé.</p>)
      if (o.status === 'dispute' || ['completed', 'refunded', 'cancelled'].includes(o.status)) return null
      return box(<>
        {(o.status === 'shipped' || o.status === 'delivered') && <>
          <p className="small">Vous avez reçu {type === 'service' ? 'la prestation' : 'votre commande'} en bon état ?</p>
          <button className="btn green block" disabled={busy} onClick={() => move('completed', { note: 'Réception confirmée par le client' }, 'Merci ! Le vendeur va être payé.', 'Confirmer la réception ? L’argent sera versé au vendeur.')}>
            <Icon name="check" size={18} />Confirmer la réception
          </button>
          {o.status === 'delivered' && deadline && <p className="tiny muted center">Sans réponse avant le {deadline.toLocaleDateString('fr-FR')}, la commande pourra être clôturée.</p>}
        </>}
        {form.kind === 'dispute' ? <>
          <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Décrivez le problème : article non reçu, abîmé, différent…" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          <div className="grid-2">
            <button className="btn ghost" onClick={() => setForm({ ...form, kind: null })}>Retour</button>
            <button className="btn danger" disabled={busy || !form.text.trim()} onClick={() => move('dispute', { dispute_reason: form.text.trim() }, 'Litige ouvert, l’argent reste bloqué')}>Ouvrir un litige</button>
          </div>
        </> : can('dispute') && <button className="btn ghost block" onClick={() => setForm({ ...form, kind: 'dispute' })}>Signaler un problème</button>}
      </>)
    }

    // ---------- VENDEUR ----------
    if (role === 'seller') {
      if (o.status === 'pending_payment' || o.status === 'payment_submitted') return box(<>
        <p className="alert warn">Attendez la confirmation du paiement par LinkApp avant de préparer.</p>
        {can('cancelled') && <button className="link" onClick={() => move('cancelled', { note: 'Refusée par le vendeur' }, 'Commande refusée', 'Refuser cette commande ?')}>Refuser la commande</button>}
      </>)
      if (o.status === 'paid') return box(<>
        <p className="alert ok">Paiement sécurisé par LinkApp. Vous pouvez préparer la commande.</p>
        <button className="btn block" disabled={busy} onClick={() => move('preparing', {}, 'Commande en préparation')}>Commencer la préparation</button>
      </>)
      if (o.status === 'preparing') return box(form.kind === 'ship' ? <>
        <input className="input" placeholder="Infos de livraison (livreur, heure, n° de suivi…)" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        <button className="btn block" disabled={busy} onClick={() => move('shipped', { note: form.text.trim() }, 'Commande expédiée')}><Icon name="truck" size={18} />Confirmer l'expédition</button>
      </> : <button className="btn block" onClick={() => setForm({ ...form, kind: 'ship', text: '' })}><Icon name="truck" size={18} />{type === 'service' ? 'Je me déplace / je commence' : 'Marquer comme expédiée'}</button>)
      if (o.status === 'shipped') return box(
        <button className="btn block" disabled={busy} onClick={() => move('delivered', {}, 'Livraison indiquée, en attente du client')}><Icon name="pin" size={18} />{type === 'service' ? 'Prestation réalisée' : 'Marquer comme livrée'}</button>)
      if (o.status === 'delivered') return box(<p className="alert info">En attente de la confirmation du client. Ensuite, l'argent vous est versé.</p>)
      if (o.status === 'completed') return box(<p className={'alert ' + (o.payout_status === 'paid' ? 'ok' : 'info')}>{o.payout_status === 'paid' ? `${fcfa(o.seller_amount)} vous ont été versés.` : `${fcfa(o.seller_amount)} en cours de versement par LinkApp.`}</p>)
      return null
    }

    // ---------- ADMIN ----------
    const acts: ReactNode[] = []
    if (o.status === 'payment_submitted') {
      acts.push(<p key="r" className="small">Référence : <b>{o.payment_ref}</b> ({o.payment_method === 'mtn' ? 'MTN MoMo' : 'Orange Money'}) · montant attendu <b>{fcfa(o.subtotal)}</b></p>)
      acts.push(<div key="b" className="grid-2">
        <button className="btn danger" disabled={busy} onClick={() => move('pending_payment', { note: 'Paiement non trouvé' }, 'Paiement rejeté')}>Paiement non reçu</button>
        <button className="btn green" disabled={busy} onClick={() => move('paid', { note: 'Paiement vérifié' }, 'Fonds sécurisés')}>Paiement reçu</button>
      </div>)
    }
    if (o.status === 'dispute') acts.push(<div key="d" className="grid-2">
      <button className="btn danger" disabled={busy} onClick={() => move('refunded', { note: 'Litige : client remboursé' }, 'Client remboursé', `Rembourser ${fcfa(o.subtotal)} au client ?`)}>Rembourser le client</button>
      <button className="btn green" disabled={busy} onClick={() => move('completed', { note: 'Litige : fonds libérés au vendeur' }, 'Fonds libérés', 'Libérer les fonds au vendeur ?')}>Libérer au vendeur</button>
    </div>)
    if (o.status === 'delivered') acts.push(<button key="c" className="btn block" disabled={busy || !late} onClick={() => move('completed', { note: `Clôturée : pas de réponse du client sous ${CONFIRM_DAYS} jours` }, 'Commande clôturée')}>
      {late ? 'Clôturer (délai dépassé)' : `Clôture possible après le ${deadline?.toLocaleDateString('fr-FR')}`}</button>)
    if (can('refunded') && o.status !== 'dispute') acts.push(<button key="rf" className="link" onClick={() => move('refunded', { note: 'Remboursée par LinkApp' }, 'Client remboursé', 'Rembourser le client ?')}>Rembourser le client</button>)
    if (o.status === 'completed' && o.payout_status === 'pending') acts.push(<button key="p" className="btn green block" disabled={busy} onClick={async () => {
      if (!confirm(`Confirmer le versement de ${fcfa(o.seller_amount)} au vendeur ?`)) return
      try { await api.adminMarkPayout(o.id); toast('Versement enregistré'); d.reload() } catch (x) { toast(errorMessage(x)) }
    }}>Marquer {fcfa(o.seller_amount)} versés au vendeur</button>)
    if (o.status === 'pending_payment') acts.push(<p key="w" className="small muted">En attente du paiement du client.</p>)
    return acts.length ? box(<><h3 className="row" style={{ gap: 6 }}><Icon name="shield" size={16} />Administration</h3>{acts}</>) : null
  }
}

/** Nombre de commandes à traiter par le vendeur (pour les pastilles). */
export function sellerTodo(list: Order[]) {
  return list.filter((o) => o.status === 'paid' || o.status === 'preparing' || o.status === 'shipped').length
}

