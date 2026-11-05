import { createDemoApi } from './demoApi'
import { createSupabaseApi } from './supabaseApi'
import type { Api } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const demo = url && key ? null : createDemoApi()

/** Supabase si les clés sont fournies, sinon mode démo local. */
export const api: Api = demo ?? createSupabaseApi(url!, key!)

/** Mode démo seulement : simulation de la page de paiement CinetPay. */
export const demoGateway = demo
