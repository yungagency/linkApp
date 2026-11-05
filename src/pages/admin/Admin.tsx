import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Logo, Media, Skeleton, TypeBadge, toast, useLoad } from '../../components/ui'
import { TYPES } from '../../config'
import { api } from '../../lib/api'
import type { Vitrine, VitrineType } from '../../lib/types'
import { errorMessage, formatPrice, isPremiumActive } from '../../lib/utils'
import { HELD, isLate, type OrderStatus } from '../../lib/orders'
import { LateBadge, StatusBadge } from '../orders/Orders'

type Tab = 'stats' | 'orders' | 'vitrines' | 'premium' | 'categories'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stats', label: 'Tableau de bord', icon: 'chart' },
  { id: 'orders', label: 'Commandes & séquestre', icon: 'shield' },
  { id: 'vitrines', label: 'Vitrines', icon: 'store' },
  { id: 'premium', label: 'Demandes Premium', icon: 'crown' },
  { id: 'categories', label: 'Catégories', icon: 'grid' },
]

const plusMonths = (n: number) => {
  const d = new Date(); d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>('stats')
  return (
    <div className="admin-layout">
      <aside className="admin-side">
        <div className="brand"><Logo /></div>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={18} />{t.label}
          </button>
        ))}
        <button onClick={() => (location.hash = '/')}><Icon name="back" size={18} />Retour à l'app</button>
      </aside>
      <main className="admin-main stack">
        {tab === 'stats' && <Stats />}
        {tab === 'orders' && <Escrow />}
        {tab === 'vitrines' && <Vitrines />}
        {tab === 'premium' && <Requests />}
        {tab === 'categories' && <Categories />}
      </main>
    </div>
  )
}

function Stats() {
  const s = useLoad(() => api.adminStats(), [])
  if (s.loading) return <Skeleton h={120} />
  if (s.error || !s.data) return <p className="alert err">{s.error}</p>
  const d = s.data
  const k = [
    ['Comptes', d.users, 'users'], ['Commerçants', d.vitrines.commerce, 'store'], ['Agriculteurs', d.vitrines.agriculture, 'leaf'],
    ['Prestataires', d.vitrines.service, 'tool'], ['Articles publiés', d.items, 'box'], ['Vitrines Premium', d.premium, 'crown'],
  ] as const
  return (
    <>
      <h1>Tableau de bord</h1>
      {d.pendingRequests > 0 && <p className="alert warn">{d.pendingRequests} demande(s) Premium en attente.</p>}
      <div className="kpis">
        {k.map(([label, n, icon]) => (
          <div key={label} className="card kpi">
            <span className="row small muted" style={{ gap: 6 }}><Icon name={icon} size={16} />{label}</span>
            <b>{n}</b>
          </div>
        ))}
      </div>
    </>
  )
}

function Vitrines() {
  const list = useLoad(() => api.adminListVitrines(), [])
  const [filter, setFilter] = useState<VitrineType | ''>('')
  const [q, setQ] = useState('')
  const update = async (v: Vitrine, patch: Parameters<typeof api.adminUpdateVitrine>[1], msg: string) => {
    try { await api.adminUpdateVitrine(v.id, patch); toast(msg); list.reload() } catch (x) { toast(errorMessage(x)) }
  }
  const rows = (list.data ?? []).filter((v) => (!filter || v.type === filter) && (!q || v.name.toLowerCase().includes(q.toLowerCase())))

  return (
    <>
      <h1>Vitrines</h1>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="search" style={{ flex: '1 1 240px', height: 42 }}>
          <Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une vitrine" />
        </div>
        <div className="chips">
          {(['', 'commerce', 'agriculture', 'service'] as const).map((t) => (
            <button key={t} className={'chip ' + (filter === t ? 'on' : '')} onClick={() => setFilter(t)}>{t ? TYPES[t].label : 'Tous'}</button>
          ))}
        </div>
      </div>
      <div className="card table-wrap">
        {list.loading ? <div className="page"><Skeleton h={160} /></div> : (
          <table>
            <thead><tr><th>Vitrine</th><th>Type</th><th>Visites</th><th>Statut</th><th>Premium</th><th /></tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>
                    <a href={`#/v/${v.slug}`} className="row" style={{ gap: 10 }}>
                      <span style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}><Media src={v.logo_url || v.cover_url} type={v.type} label={v.name} /></span>
                      <span><b>{v.name}</b><br /><span className="tiny muted">{v.district || v.city} · {v.phone || 'pas de numéro'}</span></span>
                    </a>
                  </td>
                  <td><TypeBadge type={v.type} /></td>
                  <td>{v.views}</td>
                  <td><span className={'badge ' + (v.status === 'active' ? 'ok' : v.status === 'pending' ? 'warn' : 'off')}>
                    {v.status === 'active' ? 'Active' : v.status === 'pending' ? 'En attente' : 'Suspendue'}</span></td>
                  <td>{isPremiumActive(v)
                    ? <span className="badge premium">{v.premium_until ? `Jusqu'au ${new Date(v.premium_until).toLocaleDateString('fr-FR')}` : 'Sans limite'}</span>
                    : <span className="muted small">—</span>}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      {isPremiumActive(v)
                        ? <button className="btn ghost sm" onClick={() => update(v, { is_premium: false, premium_until: null }, 'Premium retiré')}>Retirer Premium</button>
                        : <button className="btn soft sm" onClick={() => update(v, { is_premium: true, premium_until: plusMonths(1) }, 'Premium activé pour 1 mois')}>Premium 1 mois</button>}
                      {v.status === 'active'
                        ? <button className="btn danger sm" onClick={() => confirm(`Suspendre « ${v.name} » ?`) && update(v, { status: 'suspended' }, 'Vitrine suspendue')}>Suspendre</button>
                        : <button className="btn green sm" onClick={() => update(v, { status: 'active' }, 'Vitrine activée')}>Activer</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="center muted">Aucune vitrine</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function Requests() {
  const list = useLoad(() => api.adminListRequests(), [])
  const resolve = async (id: string, vitrineId: string, ok: boolean, months = 1) => {
    try {
      if (ok) await api.adminUpdateVitrine(vitrineId, { is_premium: true, premium_until: plusMonths(months) })
      await api.adminResolveRequest(id, ok ? 'approved' : 'rejected')
      toast(ok ? `Premium activé (${months} mois)` : 'Demande refusée'); list.reload()
    } catch (x) { toast(errorMessage(x)) }
  }
  return (
    <>
      <h1>Demandes Premium</h1>
      <p className="muted small">Validez une demande une fois le paiement Mobile Money reçu.</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Vitrine</th><th>Message</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {(list.data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="small">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                <td><b>{r.vitrine?.name ?? '—'}</b><br /><span className="tiny muted">{r.vitrine?.phone || ''}</span></td>
                <td className="small">{r.note || <span className="muted">—</span>}</td>
                <td><span className={'badge ' + (r.status === 'approved' ? 'ok' : r.status === 'pending' ? 'warn' : 'off')}>
                  {r.status === 'approved' ? 'Validée' : r.status === 'pending' ? 'En attente' : 'Refusée'}</span></td>
                <td>
                  {r.status === 'pending' && (
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <button className="btn green sm" onClick={() => resolve(r.id, r.vitrine_id, true, 1)}>Activer 1 mois</button>
                      <button className="btn soft sm" onClick={() => resolve(r.id, r.vitrine_id, true, 12)}>12 mois</button>
                      <button className="btn danger sm" onClick={() => resolve(r.id, r.vitrine_id, false)}>Refuser</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!list.loading && (list.data?.length ?? 0) === 0 && <tr><td colSpan={5} className="center muted">Aucune demande</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Categories() {
  const [type, setType] = useState<VitrineType>('commerce')
  const list = useLoad(() => api.listCategories(type), [type])
  const [name, setName] = useState('')
  return (
    <>
      <h1>Catégories</h1>
      <div className="chips">
        {(Object.keys(TYPES) as VitrineType[]).map((t) => (
          <button key={t} className={'chip ' + (type === t ? 'on' : '')} onClick={() => setType(t)}>{TYPES[t].label}</button>
        ))}
      </div>
      <form className="row" onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        try { await api.saveCategory({ type, name: name.trim(), icon: TYPES[type].icon, position: (list.data?.length ?? 0) + 1 }); setName(''); list.reload() }
        catch (x) { toast(errorMessage(x)) }
      }}>
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie" />
        <button className="btn"><Icon name="plus" size={18} />Ajouter</button>
      </form>
      <div className="card menu">
        {(list.data ?? []).map((c) => (
          <div key={c.id} className="row" style={{ padding: '12px 16px' }}>
            <span className="ic"><Icon name={c.icon} size={18} /></span>
            <span className="grow" style={{ fontWeight: 600 }}>{c.name}</span>
            <button className="icon-btn" aria-label="Supprimer" onClick={async () => {
              if (!confirm(`Supprimer « ${c.name} » ?`)) return
              try { await api.deleteCategory(c.id); list.reload() } catch (x) { toast(errorMessage(x)) }
            }}><Icon name="trash" size={18} /></button>
          </div>
        ))}
      </div>
    </>
  )
}

function Escrow() {
  const list = useLoad(() => api.adminListOrders(), [])
  const [f, setF] = useState<'check' | 'held' | 'late' | 'dispute' | 'payout' | 'all'>('check')
  const all = list.data ?? []
  const sum = (xs: typeof all, k: 'subtotal' | 'seller_amount' | 'commission') => xs.reduce((a, o) => a + o[k], 0)
  const held = all.filter((o) => o.protected && HELD.includes(o.status))
  const toCheck = all.filter((o) => o.status === 'payment_submitted')
  const disputes = all.filter((o) => o.status === 'dispute')
  const lates = all.filter((o) => isLate(o))
  const toPay = all.filter((o) => o.protected && o.status === 'completed' && o.payout_status === 'pending')
  const earned = all.filter((o) => o.protected && o.status === 'completed')
  const rows = f === 'check' ? toCheck : f === 'held' ? held : f === 'late' ? lates : f === 'dispute' ? disputes : f === 'payout' ? toPay : all
  const fcfa = (n: number) => formatPrice(n)
  return (
    <>
      <h1>Commandes & séquestre</h1>
      <p className="alert warn small">V1 : les paiements arrivent sur les numéros Mobile Money LinkApp et sont vérifiés à la main.
        Faites valider le montage juridique avant d'encaisser de l'argent réel pour le compte des vendeurs.</p>
      <div className="kpis">
        <div className="card kpi"><span className="row small muted" style={{ gap: 6 }}><Icon name="shield" size={16} />Argent bloqué</span><b>{fcfa(sum(held, 'subtotal'))}</b><span className="tiny muted">{held.length} commande(s)</span></div>
        <div className="card kpi"><span className="row small muted" style={{ gap: 6 }}><Icon name="search" size={16} />Paiements à vérifier</span><b>{toCheck.length}</b></div>
        <div className="card kpi"><span className="row small muted" style={{ gap: 6 }}><Icon name="users" size={16} />À reverser aux vendeurs</span><b>{fcfa(sum(toPay, 'seller_amount'))}</b><span className="tiny muted">{toPay.length} versement(s)</span></div>
        <div className="card kpi"><span className="row small muted" style={{ gap: 6 }}><Icon name="chart" size={16} />Commissions gagnées</span><b>{fcfa(sum(earned, 'commission'))}</b></div>
        <div className="card kpi"><span className="row small muted" style={{ gap: 6 }}><Icon name="bell" size={16} />Litiges</span><b>{disputes.length}</b></div>
        <div className="card kpi"><span className="row small muted" style={{ gap: 6 }}><Icon name="truck" size={16} />Livraisons en retard</span><b>{lates.length}</b></div>
      </div>
      <div className="chips">
        {([['check', `À vérifier (${toCheck.length})`], ['held', `Bloqués (${held.length})`], ['late', `En retard (${lates.length})`], ['dispute', `Litiges (${disputes.length})`], ['payout', `À reverser (${toPay.length})`], ['all', 'Toutes']] as const).map(([k, l]) => (
          <button key={k} className={'chip ' + (f === k ? 'on' : '')} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      <div className="card table-wrap">
        {list.loading ? <div className="page"><Skeleton h={120} /></div> : (
          <table>
            <thead><tr><th>Commande</th><th>Client</th><th>Vendeur</th><th>Montant</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.code}</b><br /><span className="tiny muted">{new Date(o.created_at).toLocaleDateString('fr-FR')} · {o.item_title}</span></td>
                  <td className="small">{o.buyer_name}<br /><span className="tiny muted">{o.buyer_phone}</span></td>
                  <td className="small">{o.vitrine?.name ?? '—'}</td>
                  <td className="small"><b>{fcfa(o.subtotal)}</b><br /><span className="tiny muted">vendeur {fcfa(o.seller_amount)}</span></td>
                  <td>{isLate(o) && <><LateBadge /><br /></>}<StatusBadge s={o.status as OrderStatus} />{!o.protected && <><br /><span className="tiny muted">sans assurance</span></>}{o.status === 'completed' && <><br /><span className="tiny muted">{o.payout_status === 'paid' ? 'versé' : 'à reverser'}</span></>}</td>
                  <td><a className="btn soft sm" href={`#/commande/${o.id}`}>Ouvrir</a></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="center muted">Rien à traiter</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
