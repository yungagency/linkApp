import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { TopBar, toast, useLoad } from '../../components/ui'
import { APP, PLANS } from '../../config'
import { api } from '../../lib/api'
import { useSession } from '../../lib/session'
import { errorMessage, formatPrice, isPremiumActive, waLink } from '../../lib/utils'

/**
 * V1 : pas de paiement intégré. Le pro envoie une demande, paie par Orange Money / MTN MoMo
 * hors de l'app, et l'admin active le Premium. CinetPay viendra en V2.
 */
export default function Subscription() {
  const { vitrine: v } = useSession()
  const reqs = useLoad(() => (v ? api.myPremiumRequests(v.id) : Promise.resolve([])), [v?.id])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!v) return null

  const premium = isPremiumActive(v)
  const pending = (reqs.data ?? []).find((r) => r.status === 'pending')
  const plan = PLANS[1]!

  return (
    <>
      <TopBar back="/pro" title="Abonnement" />
      <div className="page stack">
        {PLANS.map((p) => {
          const current = (p.id === 'premium') === premium
          return (
            <div key={p.id} className={'card plan ' + (current ? 'on' : '')}>
              <div className="row between">
                <h2 className="row" style={{ gap: 6 }}>{p.id === 'premium' && <Icon name="crown" size={18} />}{p.name}</h2>
                {current && <span className="badge ok">Votre plan</span>}
              </div>
              <p className="price" style={{ fontSize: 18, marginTop: 4 }}>
                {p.id === 'gratuit' ? '0 FCFA' : p.price == null ? 'Tarif communiqué par l’équipe' : formatPrice(p.price, p.period)}
              </p>
              <ul>{p.perks.map((x) => <li key={x}><Icon name="check" size={16} stroke={2.4} />{x}</li>)}</ul>
            </div>
          )
        })}

        {premium ? (
          <p className="alert ok">Votre Premium est actif{v.premium_until ? ` jusqu'au ${new Date(v.premium_until).toLocaleDateString('fr-FR')}` : ''}.</p>
        ) : pending ? (
          <p className="alert info">Demande envoyée le {new Date(pending.created_at).toLocaleDateString('fr-FR')}. L'équipe LinkApp vous contacte pour le paiement Mobile Money, puis active votre Premium.</p>
        ) : (
          <div className="card pad stack">
            <h3>Demander le Premium</h3>
            <p className="small muted">Paiement par Orange Money ou MTN Mobile Money. L'équipe active votre abonnement dès réception.</p>
            <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Message (facultatif) : numéro Mobile Money, disponibilité…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn block" disabled={busy} onClick={async () => {
              setBusy(true)
              try { await api.requestPremium(v.id, plan.id, note); toast('Demande envoyée'); reqs.reload() }
              catch (x) { toast(errorMessage(x)) } finally { setBusy(false) }
            }}>{busy ? 'Envoi…' : 'Envoyer ma demande'}</button>
            {APP.supportWhatsapp && (
              <a className="btn ghost block" target="_blank" rel="noreferrer"
                href={waLink(APP.supportWhatsapp, `Bonjour, je souhaite passer ma vitrine « ${v.name} » en Premium sur LinkApp.`)}>
                <Icon name="chat" size={18} />Écrire à l'équipe sur WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </>
  )
}
