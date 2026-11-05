import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Empty, Media, Skeleton, TopBar, toast, useLoad } from '../../components/ui'
import { APP } from '../../config'
import { api } from '../../lib/api'
import {
  CONFIRM_DAYS, HELD, STATUS, canMove, deliveryLabel, isLate, stepIndex, stepsFor, type OrderStatus,
} from '../../lib/orders'
import { navigate } from '../../lib/router'
import { useSession } from '../../lib/session'
import type { Item, Order, OrderEvent, OrderMove } from '../../lib/types'
import { errorMessage, formatPrice, intlPhone, waLink } from '../../lib/utils'

const fcfa = (n: number) => formatPrice(n)
const date = (s: string) => new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const day = (s: string) => new Date(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const NAME = APP.protectionName

export function StatusBadge({ s }: { s: OrderStatus }) {
  const t = STATUS[s].tone
  return <span className={'badge ' + (t === 'ok' ? 'ok' : t === 'warn' ? 'warn' : t === 'off' ? 'off' : t === 'secure' ? 'secure' : '')}>
    {t === 'secure' && <Icon name="shield" size={12} stroke={2.2} />}{STATUS[s].short}
  </span>
}

export function LateBadge() {
  return <span className="badge off"><Icon name="bell" size={12} stroke={2.2} />En retard</span>
}

/** Bandeau LinkApp Assurance réutilisé sur la fiche article et au paiement. */
export function ProtectionNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className="protect">
      <span className="protect-ic"><Icon name="shield" size={compact ? 18 : 22} /></span>
      <span>
        <b>{NAME}</b>
        <br /><span className={compact ? 'tiny' : 'small'}>
          {compact ? 'Argent bloqué jusqu’à la réception · remboursé en cas de problème'
            : 'Votre argent est bloqué par LinkApp et versé au vendeur seulement quand vous confirmez la réception. Retard ou problème : vous êtes remboursé après examen.'}
        </span>
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------------
   Photos jointes (preuves) : jusqu'à 3
   --------------------------------------------------------------------- */
function ProofPhotos({ value, onChange, label = 'Ajouter une photo' }: { value: string[]; onChange: (v: string[]) => void; label?: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="proofs">
      {value.map((u, i) => (
        <div key={u.slice(-24) + i} className="proof">
          <img src={u} alt={`Preuve ${i + 1}`} />
          <button type="button" aria-label="Retirer" onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
        </div>
      ))}
      {value.length < 3 && (
        <label className="proof add">
          <Icon name="image" size={20} /><span className="tiny">{busy ? 'Envoi…' : label}</span>
          <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f) return
            setBusy(true)
            try { onChange([...value, await api.uploadImage(f)]) } catch (x) { toast(errorMessage(x)) } finally { setBusy(false) }
          }} />
        </label>
      )}
    </div>
  )
}

/* =====================================================================
   Passer commande : /commander/:slug/:itemId?mode=direct
   ===================================================================== */
export function Checkout({ slug, itemId, mode }: { slug: string; itemId: string; mode?: string }) {
  const { profile } = useSession()
  const data = useLoad(async () => {
    const v = await api.getVitrineBySlug(slug)
    const items = v ? await api.listItems(v.id) : []
    return { v, item: items.find((i) => i.id === itemId) as Item | undefined }
  }, [slug, itemId])
  const [qty, setQty] = useState(1)
  const [secure, setSecure] = useState(mode !== 'direct')
  const [f, setF] = useState({ buyer_name: profile?.full_name ?? '', buyer_phone: profile?.phone ?? '', address: '', note: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (data.loading) return <><TopBar back title="Commander" /><div className="page stack"><Skeleton h={100} /><Skeleton h={200} /></div></>
  const { v, item } = data.data ?? {}
  if (!v || !item) return <><TopBar back title="Commander" /><Empty title="Article introuvable" /></>
  if (item.price == null) return <><TopBar back title="Commander" /><Empty title="Prix sur demande" text="Contactez le vendeur sur WhatsApp pour cet article." /></>

  const total = item.price * qty
  const svc = v.type === 'service'
  return (
    <>
      <TopBar back={`/v/${slug}`} title="Commander" />
      <form className="page stack" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setBusy(true)
        try {
          const o = await api.createOrder({ item_id: item.id, quantity: qty, ...f, protected: secure })
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
        <p className="row small muted" style={{ gap: 6 }}><Icon name="truck" size={16} />{svc ? 'Réalisation' : 'Livraison'} promise par le vendeur : <b style={{ color: 'var(--ink)' }}>{deliveryLabel(item.delivery_days)}</b></p>

        {/* Le choix du client : avec ou sans assurance */}
        <h3 style={{ marginTop: 6 }}>Comment voulez-vous acheter ?</h3>
        <button type="button" className={'choice ' + (secure ? 'on' : '')} onClick={() => setSecure(true)}>
          <span className="choice-ic secure"><Icon name="shield" size={20} /></span>
          <span className="grow">
            <b>Avec {NAME}</b> <span className="badge secure" style={{ marginLeft: 4 }}>Recommandé</span><br />
            <span className="small muted">Vous payez maintenant par Mobile Money. L’argent est bloqué par LinkApp et versé au vendeur après votre confirmation. Retard ou problème : remboursement après examen.</span>
          </span>
          <span className={'radio ' + (secure ? 'on' : '')} />
        </button>
        <button type="button" className={'choice ' + (!secure ? 'on' : '')} onClick={() => setSecure(false)}>
          <span className="choice-ic"><Icon name="chat" size={20} /></span>
          <span className="grow">
            <b>Sans assurance</b><br />
            <span className="small muted">Vous payez le vendeur directement, à la livraison ou comme convenu avec lui. LinkApp suit la commande mais ne peut pas vous rembourser.</span>
          </span>
          <span className={'radio ' + (!secure ? 'on' : '')} />
        </button>

        <h3 style={{ marginTop: 8 }}>{svc ? 'Lieu de la prestation' : 'Livraison'}</h3>
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
          <div className="row between small"><span className="muted">{NAME}</span>{secure ? <span className="ok-text">Incluse</span> : <span className="muted">Non</span>}</div>
          <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <b>{secure ? 'Total à payer maintenant' : 'Total à payer au vendeur'}</b><b className="price" style={{ fontSize: 18 }}>{fcfa(total)}</b>
          </div>
        </div>
        {err && <p className="alert err">{err}</p>}
        <button className="btn block" disabled={busy}>
          <Icon name={secure ? 'shield' : 'check'} size={18} />{busy ? 'Création…' : secure ? `Acheter avec ${NAME}` : 'Envoyer la commande'}
        </button>
        <p className="tiny muted center">{secure ? 'Le paiement Mobile Money se fait à l’étape suivante.' : 'Le vendeur confirme la commande, puis vous livre.'}</p>
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
            text={mode === 'buyer' ? 'Vos commandes apparaîtront ici.' : 'Les commandes de vos clients apparaîtront ici.'} />
        )}
        <div className="stack vlist">
          {rows.map((o) => (
            <a key={o.id} href={`#/commande/${o.id}`} className="card vrow">
              <div className="thumb"><Media src={o.item_image} type={o.vitrine?.type ?? 'commerce'} label={o.item_title} /></div>
              <div className="grow">
                <div className="row between" style={{ gap: 6 }}><h3 className="ellipsis">{o.item_title}</h3>{isLate(o) ? <LateBadge /> : <StatusBadge s={o.status} />}</div>
                <p className="small muted ellipsis">{mode === 'buyer' ? o.vitrine?.name : o.buyer_name} · {o.code}</p>
                <p className="row small" style={{ gap: 6 }}>
                  <span className="price">{fcfa(mode === 'seller' ? o.seller_amount : o.subtotal)}</span>
                  {o.protected && <span className="tiny row" style={{ gap: 3, color: 'var(--blue-600)', fontWeight: 600 }}><Icon name="shield" size={12} />Assurée</span>}
                </p>
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
type Form = { kind: 'dispute' | 'ship' | 'deliver' | 'evidence' | null; method: 'orange' | 'mtn'; ref: string; text: string; code: string; photos: string[] }
const EMPTY: Form = { kind: null, method: 'orange', ref: '', text: '', code: '', photos: [] }

export function OrderDetail({ id }: { id: string }) {
  const d = useLoad(() => api.getOrder(id), [id])
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [code, setCode] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const role = d.data?.role
  useEffect(() => { if (role === 'buyer') api.getDeliveryCode(id).then(setCode) }, [id, role])

  if (d.loading && !d.data) return <><TopBar back title="Commande" /><div className="page stack"><Skeleton h={120} /><Skeleton h={220} /></div></>
  if (!d.data) return <><TopBar back="/" title="Commande" /><Empty title="Commande introuvable" /></>
  const { order: o, events } = d.data
  const r = d.data.role
  const can = (to: OrderStatus) => canMove(o, to, r)
  const held = o.protected && HELD.includes(o.status)
  const step = stepIndex(o.status, o.protected)
  const steps = stepsFor(o.protected)
  const type = o.vitrine?.type ?? 'commerce'
  const svc = type === 'service'
  const late = isLate(o)
  const confirmBy = o.delivered_at ? new Date(new Date(o.delivered_at).getTime() + CONFIRM_DAYS * 864e5) : null
  const confirmLate = !!confirmBy && confirmBy < new Date()
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }))

  const move = async (to: OrderStatus, extra: OrderMove = {}, msg = 'Commande mise à jour', ask?: string) => {
    if (ask && !confirm(ask)) return
    setBusy(true)
    try { await api.moveOrder(o.id, to, extra); toast(msg); setForm(EMPTY); d.reload() }
    catch (x) { toast(errorMessage(x)) } finally { setBusy(false) }
  }

  return (
    <>
      <TopBar back={r === 'seller' ? '/pro/commandes' : r === 'admin' ? '/admin' : '/commandes'} title={`Commande ${o.code}`} />
      <div className="page stack" style={{ paddingTop: 0 }}>

        {/* Statut + frise */}
        <section className="card pad order-head">
          <div className="row between">
            <div><p className="tiny muted">{o.protected ? NAME : 'Sans assurance'}</p><h2>{STATUS[o.status].label}</h2></div>
            <div className="row" style={{ gap: 6 }}>{late && <LateBadge />}<StatusBadge s={o.status} /></div>
          </div>
          {step >= 0 && (
            <ol className="stepper" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }} aria-label="Suivi de la commande">
              {steps.map((s, i) => (
                <li key={s.key} className={i < step ? 'done' : i === step ? 'now' : ''}>
                  <span className="dot"><Icon name={i < step ? 'check' : s.icon} size={14} stroke={2.2} /></span>
                  <span className="lbl">{s.key === 'delivered' && svc ? 'Réalisée' : s.key === 'shipped' && svc ? 'En cours' : s.label}</span>
                </li>
              ))}
            </ol>
          )}
          {/* Délai de livraison */}
          {o.deliver_by && ['placed', 'paid', 'preparing', 'shipped'].includes(o.status) && (
            <p className={'deadline ' + (late ? 'late' : '')}>
              <Icon name="truck" size={16} />
              <span>{late ? <>Délai dépassé : {svc ? 'réalisation' : 'livraison'} promise avant le <b>{day(o.deliver_by)}</b></>
                : <>{svc ? 'Réalisation' : 'Livraison'} promise avant le <b>{day(o.deliver_by)}</b> ({deliveryLabel(o.delivery_days)})</>}</span>
            </p>
          )}
          {o.status === 'pending_payment' && <p className="deadline"><Icon name="truck" size={16} /><span>Délai promis : {deliveryLabel(o.delivery_days)} après la confirmation du paiement</span></p>}
          {o.status === 'delivered' && o.delivery_verified && <p className="deadline ok"><Icon name="check" size={16} /><span>Remise confirmée par le code de réception du client</span></p>}
          {(o.status === 'refunded' || o.status === 'cancelled') && (
            <p className="alert info" style={{ marginTop: 12 }}>{o.status === 'refunded' ? 'Le client a été remboursé.' : 'Commande annulée.'}</p>
          )}
        </section>

        {/* Code de réception (client seulement) */}
        {r === 'buyer' && code && ['paid', 'preparing', 'shipped', 'placed'].includes(o.status) && (
          <section className="code-card">
            <div className="grow">
              <p className="tiny" style={{ opacity: .75, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 600 }}>Code de réception</p>
              <p className="small" style={{ opacity: .85 }}>Donnez-le au livreur <b>seulement</b> quand vous avez {svc ? 'constaté la prestation' : 'l’article en main'}.</p>
            </div>
            <b className="code-digits">{code.split('').map((c, i) => <span key={i}>{c}</span>)}</b>
          </section>
        )}

        {/* Argent : séquestre (seulement avec l'assurance) */}
        {o.protected ? (
          <section className={'escrow ' + (held ? 'held' : o.status === 'completed' ? 'released' : '')}>
            <span className="escrow-ic"><Icon name={o.status === 'completed' ? 'check' : 'shield'} size={22} /></span>
            <div className="grow">
              <p className="tiny" style={{ opacity: .75, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 600 }}>
                {held ? 'Argent bloqué par LinkApp' : o.status === 'completed' ? (o.payout_status === 'paid' ? 'Versé au vendeur' : 'Libéré, versement en cours') : o.status === 'refunded' ? 'Remboursé au client' : 'Montant'}
              </p>
              <b style={{ fontSize: 22 }}>{fcfa(r === 'seller' ? o.seller_amount : o.subtotal)}</b>
              {r !== 'buyer' && <p className="tiny" style={{ opacity: .75 }}>Total client {fcfa(o.subtotal)} · commission {Math.round(o.commission_rate * 100)} % ({fcfa(o.commission)}) · vendeur {fcfa(o.seller_amount)}</p>}
              {r === 'buyer' && held && <p className="tiny" style={{ opacity: .75 }}>Versé au vendeur seulement après votre confirmation de réception.</p>}
            </div>
          </section>
        ) : (
          <section className="card pad row">
            <span className="choice-ic"><Icon name="chat" size={20} /></span>
            <div className="grow"><b>{fcfa(o.subtotal)}</b> à régler directement au vendeur<br /><span className="tiny muted">Sans {NAME} : LinkApp suit la commande mais ne garde pas l’argent.</span></div>
          </section>
        )}

        {/* Litige : preuves des deux côtés */}
        {o.status === 'dispute' && (
          <section className="card pad stack dispute-box">
            <h3 className="row" style={{ gap: 6 }}><Icon name="bell" size={18} />Litige en cours</h3>
            <p className="small">Motif : « {o.dispute_reason} »</p>
            <p className="tiny muted">L’argent reste bloqué. Le client et le vendeur déposent leurs preuves ; LinkApp tranche sous 72 h.</p>
            {form.kind === 'evidence' ? <>
              <textarea className="textarea" style={{ minHeight: 70 }} placeholder={r === 'seller' ? 'Votre version : date de remise, livreur, état de l’article…' : 'Précisez : ce qui manque, ce qui est abîmé…'}
                value={form.text} onChange={(e) => set({ text: e.target.value })} />
              <ProofPhotos value={form.photos} onChange={(photos) => set({ photos })} />
              <div className="grid-2">
                <button className="btn ghost" onClick={() => setForm(EMPTY)}>Annuler</button>
                <button className="btn" disabled={busy || (!form.text.trim() && !form.photos.length)} onClick={async () => {
                  setBusy(true)
                  try { await api.addEvidence(o.id, form.text.trim(), form.photos); toast('Preuve ajoutée'); setForm(EMPTY); d.reload() }
                  catch (x) { toast(errorMessage(x)) } finally { setBusy(false) }
                }}>Envoyer</button>
              </div>
            </> : <button className="btn ghost block" onClick={() => set({ kind: 'evidence', text: '', photos: [] })}><Icon name="image" size={18} />Ajouter une preuve</button>}
          </section>
        )}

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
          <h3>{svc ? 'Lieu de la prestation' : 'Livraison'}</h3>
          <p><b>{o.buyer_name}</b> · {o.buyer_phone}</p>
          <p className="muted">{o.address}</p>
          {o.note && <p className="muted">« {o.note} »</p>}
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {r !== 'buyer' && o.buyer_phone && <a className="btn ghost sm" href={`tel:+${intlPhone(o.buyer_phone)}`}><Icon name="phone" size={16} />Appeler le client</a>}
            {r !== 'seller' && o.vitrine && (o.vitrine.whatsapp || o.vitrine.phone) && (
              <a className="btn ghost sm" target="_blank" rel="noreferrer" href={waLink(o.vitrine.whatsapp || o.vitrine.phone, `Bonjour, à propos de ma commande ${o.code} sur LinkApp.`)}><Icon name="chat" size={16} />Écrire au vendeur</a>
            )}
          </div>
        </section>

        {/* Historique avec preuves */}
        <section className="card pad">
          <h3 style={{ marginBottom: 10 }}>Historique</h3>
          <ol className="timeline">
            {[...events].reverse().map((e: OrderEvent) => (
              <li key={e.id}>
                <span className="t-dot" />
                <div className="grow">
                  <b className="small">{STATUS[e.status as OrderStatus]?.label ?? e.status}</b>
                  <p className="tiny muted">{date(e.created_at)} · {e.actor === 'buyer' ? 'Client' : e.actor === 'seller' ? 'Vendeur' : 'LinkApp'}{e.note ? ` · ${e.note}` : ''}</p>
                  {e.attachments?.length > 0 && (
                    <div className="proofs sm">{e.attachments.map((u, i) => (
                      <button key={i} className="proof" onClick={() => setZoom(u)} aria-label="Voir la photo"><img src={u} alt="" /></button>
                    ))}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {zoom && (
        <div role="dialog" aria-modal="true" className="zoom" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Preuve" />
        </div>
      )}
    </>
  )

  function ActionPanel() {
    const box = (children: ReactNode) => <section className="card pad stack action-box">{children}</section>
    const disputeForm = () => form.kind === 'dispute' ? <>
      <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Décrivez le problème : non reçu, abîmé, différent de l’annonce, retard…"
        value={form.text} onChange={(e) => set({ text: e.target.value })} />
      <ProofPhotos value={form.photos} onChange={(photos) => set({ photos })} label="Photo du problème" />
      <p className="tiny muted">Photos conseillées : l’article reçu, l’emballage, l’étiquette, une capture de conversation.</p>
      <div className="grid-2">
        <button className="btn ghost" onClick={() => setForm(EMPTY)}>Retour</button>
        <button className="btn danger" disabled={busy || !form.text.trim()} onClick={() => move('dispute', { dispute_reason: form.text.trim(), attachments: form.photos }, 'Litige ouvert, l’argent reste bloqué')}>Ouvrir un litige</button>
      </div>
    </> : null

    // ---------- CLIENT ----------
    if (r === 'buyer') {
      if (o.status === 'pending_payment') {
        const nums = APP.paymentNumbers
        return box(<>
          <h3>Payer {fcfa(o.subtotal)} par Mobile Money</h3>
          <div className="grid-2">
            {(['orange', 'mtn'] as const).map((m) => (
              <button key={m} type="button" className={'pay-opt ' + (form.method === m ? 'on' : '')} onClick={() => set({ method: m })}>
                <b>{m === 'orange' ? 'Orange Money' : 'MTN MoMo'}</b>
                <span className="tiny muted">{(m === 'orange' ? nums.orange : nums.mtn) || 'Numéro communiqué par l’équipe'}</span>
              </button>
            ))}
          </div>
          <p className="small muted">Envoyez exactement <b>{fcfa(o.subtotal)}</b> avec le motif <b>{o.code}</b>, puis collez la référence reçue par SMS.</p>
          <input className="input" placeholder="Référence de la transaction (ex : MP2611…)" value={form.ref} onChange={(e) => set({ ref: e.target.value })} />
          <button className="btn block" disabled={busy || !form.ref.trim()} onClick={() => move('payment_submitted', { payment_method: form.method, payment_ref: form.ref.trim() }, 'Paiement envoyé pour vérification')}>J'ai payé</button>
          <button className="link" onClick={() => move('cancelled', { note: 'Annulée par le client' }, 'Commande annulée', 'Annuler cette commande ?')}>Annuler la commande</button>
        </>)
      }
      if (o.status === 'payment_submitted') return box(<p className="alert info">Paiement en vérification ({o.payment_method === 'mtn' ? 'MTN MoMo' : 'Orange Money'} · {o.payment_ref}). Vous serez informé dès qu'il est confirmé.</p>)
      if (['dispute', 'completed', 'refunded', 'cancelled'].includes(o.status)) return null
      if (o.status === 'placed') return box(<>
        <p className="alert info">Commande envoyée. Le vendeur doit la confirmer.</p>
        <button className="link" onClick={() => move('cancelled', { note: 'Annulée par le client' }, 'Commande annulée', 'Annuler cette commande ?')}>Annuler la commande</button>
      </>)
      if (form.kind === 'dispute') return box(disputeForm())
      return box(<>
        {late && o.protected && <p className="alert warn small">Le vendeur a dépassé le délai promis. Vous pouvez attendre ou demander le remboursement.</p>}
        {(o.status === 'shipped' || o.status === 'delivered') && <>
          <p className="small">Vous avez reçu {svc ? 'la prestation' : 'votre commande'} en bon état ?</p>
          <button className="btn green block" disabled={busy} onClick={() => move('completed', { note: 'Réception confirmée par le client' }, o.protected ? 'Merci ! Le vendeur va être payé.' : 'Merci pour votre confirmation', o.protected ? 'Confirmer la réception ? L’argent sera versé au vendeur.' : 'Confirmer la réception ?')}>
            <Icon name="check" size={18} />Confirmer la réception
          </button>
          {o.status === 'delivered' && confirmBy && o.protected && <p className="tiny muted center">Sans réponse avant le {confirmBy.toLocaleDateString('fr-FR')}, la commande pourra être clôturée et le vendeur payé.</p>}
        </>}
        {can('cancelled') && !o.protected && <button className="link" onClick={() => move('cancelled', { note: 'Annulée par le client' }, 'Commande annulée', 'Annuler cette commande ?')}>Annuler la commande</button>}
        {can('dispute') && (late
          ? <button className="btn danger block" onClick={() => set({ kind: 'dispute', text: 'Retard de livraison : délai promis dépassé.' })}>Demander le remboursement (retard)</button>
          : <button className="btn ghost block" onClick={() => set({ kind: 'dispute', text: '' })}>Signaler un problème</button>)}
      </>)
    }

    // ---------- VENDEUR ----------
    if (r === 'seller') {
      if (o.status === 'pending_payment' || o.status === 'payment_submitted') return box(<>
        <p className="alert warn">Attendez la confirmation du paiement par LinkApp avant de préparer.</p>
        {can('cancelled') && <button className="link" onClick={() => move('cancelled', { note: 'Refusée par le vendeur' }, 'Commande refusée', 'Refuser cette commande ?')}>Refuser la commande</button>}
      </>)
      if (o.status === 'placed') return box(<>
        <p className="small">Nouvelle commande sans assurance : le client vous paiera directement. Délai promis : <b>{deliveryLabel(o.delivery_days)}</b>.</p>
        <div className="grid-2">
          <button className="btn ghost" disabled={busy} onClick={() => move('cancelled', { note: 'Refusée par le vendeur' }, 'Commande refusée', 'Refuser cette commande ?')}>Refuser</button>
          <button className="btn" disabled={busy} onClick={() => move('preparing', { note: 'Acceptée par le vendeur' }, 'Commande acceptée')}>Accepter</button>
        </div>
      </>)
      if (o.status === 'paid') return box(<>
        <p className="alert ok">Paiement sécurisé par LinkApp. Vous pouvez préparer la commande.</p>
        {o.deliver_by && <p className="small">À livrer avant le <b>{day(o.deliver_by)}</b>.</p>}
        <button className="btn block" disabled={busy} onClick={() => move('preparing', {}, 'Commande en préparation')}>Commencer la préparation</button>
      </>)
      if (o.status === 'preparing') return box(form.kind === 'ship' ? <>
        <input className="input" placeholder="Infos de livraison (livreur, heure, agence de voyage…)" value={form.text} onChange={(e) => set({ text: e.target.value })} />
        <ProofPhotos value={form.photos} onChange={(photos) => set({ photos })} label="Colis / bordereau" />
        <p className="tiny muted">Expédition par agence : photographiez le bordereau. C’est votre meilleure preuve.</p>
        <button className="btn block" disabled={busy} onClick={() => move('shipped', { note: form.text.trim(), attachments: form.photos }, 'Commande expédiée')}><Icon name="truck" size={18} />Confirmer l'expédition</button>
      </> : <>
        {late && <p className="alert warn small">Délai promis dépassé : le client peut demander le remboursement.</p>}
        <button className="btn block" onClick={() => set({ kind: 'ship', text: '', photos: [] })}><Icon name="truck" size={18} />{svc ? 'Je me déplace / je commence' : 'Marquer comme expédiée'}</button>
        {can('cancelled') && <button className="link" onClick={() => move('cancelled', { note: 'Annulée par le vendeur' }, 'Commande annulée', 'Annuler cette commande ?')}>Annuler la commande</button>}
      </>)
      if (o.status === 'shipped') return box(form.kind === 'deliver' ? <>
        <h3>Preuve de {svc ? 'réalisation' : 'livraison'}</h3>
        <label className="field"><span>Code de réception du client</span>
          <input className="input code-input" inputMode="numeric" maxLength={4} placeholder="• • • •" value={form.code} onChange={(e) => set({ code: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          <p className="hint">Le client vous le donne à la remise. C’est la preuve la plus solide.</p>
        </label>
        <p className="tiny muted center">— ou, si le client n’a pas son code —</p>
        <ProofPhotos value={form.photos} onChange={(photos) => set({ photos })} label="Photo de la remise" />
        <button className="btn block" disabled={busy || (o.protected && form.code.length !== 4 && !form.photos.length)}
          onClick={() => move('delivered', { code: form.code || undefined, attachments: form.photos }, 'Livraison enregistrée')}>
          <Icon name="pin" size={18} />{svc ? 'Prestation réalisée' : 'Confirmer la livraison'}
        </button>
        <button className="link" onClick={() => setForm(EMPTY)}>Retour</button>
      </> : <button className="btn block" onClick={() => set({ kind: 'deliver', code: '', photos: [] })}><Icon name="pin" size={18} />{svc ? 'Prestation réalisée' : 'Marquer comme livrée'}</button>)
      if (o.status === 'delivered') return box(<p className="alert info">En attente de la confirmation du client.{o.protected ? ' Ensuite, l’argent vous est versé.' : ''}</p>)
      if (o.status === 'completed' && o.protected) return box(<p className={'alert ' + (o.payout_status === 'paid' ? 'ok' : 'info')}>{o.payout_status === 'paid' ? `${fcfa(o.seller_amount)} vous ont été versés.` : `${fcfa(o.seller_amount)} en cours de versement par LinkApp.`}</p>)
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
    if (o.status === 'delivered' && can('completed')) acts.push(<button key="c" className="btn block" disabled={busy || !confirmLate} onClick={() => move('completed', { note: `Clôturée : pas de réponse du client sous ${CONFIRM_DAYS} jours` }, 'Commande clôturée')}>
      {confirmLate ? 'Clôturer (délai de confirmation dépassé)' : `Clôture possible après le ${confirmBy?.toLocaleDateString('fr-FR')}`}</button>)
    if (can('refunded') && o.status !== 'dispute') acts.push(<button key="rf" className="link" onClick={() => move('refunded', { note: late ? 'Remboursée : retard de livraison' : 'Remboursée par LinkApp' }, 'Client remboursé', 'Rembourser le client ?')}>Rembourser le client{late ? ' (retard)' : ''}</button>)
    if (can('cancelled') && !o.protected) acts.push(<button key="cx" className="link" onClick={() => move('cancelled', { note: 'Annulée par LinkApp' }, 'Commande annulée', 'Annuler cette commande ?')}>Annuler la commande</button>)
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
  return list.filter((o) => ['placed', 'paid', 'preparing', 'shipped'].includes(o.status)).length
}
