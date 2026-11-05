// Adresse de notification appelée par CinetPay (pas par l'application).
// CinetPay peut l'appeler plusieurs fois : on revérifie TOUJOURS auprès de CinetPay,
// et on ne modifie rien si la commande est déjà payée.
import { admin, env, settle } from '../_shared/cinetpay.ts'

Deno.serve(async (req) => {
  // CinetPay teste la disponibilité de l'adresse en GET
  if (req.method !== 'POST') return new Response('OK', { status: 200 })
  try {
    const form = await req.formData().catch(() => null)
    const txId = String(form?.get('cpm_trans_id') ?? '')
    const siteId = String(form?.get('cpm_site_id') ?? '')
    if (!txId || siteId !== env('CINETPAY_SITE_ID')) return new Response('OK', { status: 200 })

    const { data: o } = await admin().from('orders').select('id,status,gateway_tx').eq('gateway_tx', txId).maybeSingle()
    if (o && (o.status === 'pending_payment' || o.status === 'payment_submitted')) {
      await settle(o.id, txId)
    }
  } catch (e) {
    console.error('cinetpay-notify', e)
  }
  return new Response('OK', { status: 200 })
})
