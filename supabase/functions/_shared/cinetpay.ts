// Outils CinetPay partagés par les fonctions serveur (Deno / Supabase Edge Functions).
// Doc : https://docs.cinetpay.com/api/1.0-fr/checkout/initialisation et /notification
import { createClient } from 'npm:@supabase/supabase-js@2'

export const CINETPAY = 'https://api-checkout.cinetpay.com/v2'

export function env(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Variable manquante côté serveur : ${name}`)
  return v
}

/** Client Supabase avec la clé service : réservé au serveur, jamais envoyé au téléphone. */
export function admin() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
}

export type CheckResult = { status: string; amount: number; method: string; raw: unknown }

/** Interroge CinetPay sur l'état réel d'une transaction. C'est la SEULE source de vérité. */
export async function checkTransaction(transactionId: string): Promise<CheckResult> {
  const r = await fetch(`${CINETPAY}/payment/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: env('CINETPAY_APIKEY'), site_id: env('CINETPAY_SITE_ID'), transaction_id: transactionId }),
  })
  const j = await r.json().catch(() => ({}))
  const d = (j?.data ?? {}) as Record<string, unknown>
  return {
    status: String(d.status ?? j?.message ?? 'UNKNOWN'),
    amount: Number(d.amount ?? 0),
    method: String(d.payment_method ?? ''),
    raw: j,
  }
}

/** Si CinetPay confirme le paiement, la commande passe à « Paiement sécurisé ». */
export async function settle(orderId: string, tx: string) {
  const res = await checkTransaction(tx)
  if (res.status === 'ACCEPTED') {
    const { error } = await admin().rpc('order_gateway_paid', { p_order_id: orderId, p_tx: tx, p_amount: res.amount, p_method: res.method })
    if (error) throw error
  }
  return res.status
}

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
