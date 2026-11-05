// Fonction appelée par l'application (utilisateur connecté).
//   { action: 'init',  order_id }  → crée le paiement CinetPay et renvoie payment_url
//   { action: 'check', order_id }  → revérifie le paiement (au retour du client sur l'app)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { CINETPAY, admin, cors, env, json, settle } from '../_shared/cinetpay.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // Qui appelle ?
    const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Connexion requise' }, 401)

    const { action, order_id } = await req.json()
    const db = admin()
    const { data: o, error } = await db.from('orders').select('*').eq('id', order_id).maybeSingle()
    if (error || !o) return json({ error: 'Commande introuvable' }, 404)
    if (o.buyer_id !== user.id) return json({ error: 'Action non autorisée' }, 403)
    if (!o.protected) return json({ error: 'Cette commande est sans assurance : paiement direct au vendeur' }, 400)

    if (action === 'check') {
      if (!o.gateway_tx) return json({ status: 'NONE' })
      return json({ status: await settle(o.id, o.gateway_tx) })
    }

    if (o.status !== 'pending_payment') return json({ error: 'Cette commande n’est plus en attente de paiement' }, 400)
    const tx = `${o.code}-${Date.now().toString(36)}`.toUpperCase()
    // CinetPay exige un montant multiple de 5
    const amount = Math.ceil(Number(o.subtotal) / 5) * 5
    await db.from('orders').update({ gateway_tx: tx, updated_at: new Date().toISOString() }).eq('id', o.id)

    const [first, ...rest] = String(o.buyer_name ?? '').trim().split(/\s+/)
    const appUrl = env('APP_URL').replace(/\/$/, '')
    const r = await fetch(`${CINETPAY}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: env('CINETPAY_APIKEY'),
        site_id: env('CINETPAY_SITE_ID'),
        transaction_id: tx,
        amount,
        currency: 'XAF',
        // Pas de # / $ _ & dans la description (règle CinetPay)
        description: `Commande ${o.code} LinkApp`,
        notify_url: `${env('SUPABASE_URL')}/functions/v1/cinetpay-notify`,
        return_url: `${appUrl}/#/commande/${o.id}?retour=cinetpay`,
        channels: 'MOBILE_MONEY',
        lang: 'fr',
        metadata: o.id,
        customer_id: o.buyer_id,
        customer_name: first || 'Client',
        customer_surname: rest.join(' ') || 'LinkApp',
        customer_phone_number: String(o.buyer_phone ?? '').replace(/\D/g, ''),
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (j?.code !== '201' || !j?.data?.payment_url) {
      return json({ error: `CinetPay a refusé la demande : ${j?.description ?? j?.message ?? r.status}` }, 502)
    }
    return json({ payment_url: j.data.payment_url })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
