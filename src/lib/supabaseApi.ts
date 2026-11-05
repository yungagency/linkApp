import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Api, Category, Item, ItemHit, Order, OrderEvent, PremiumRequest, Profile, Review, Vitrine } from './types'
import { compressImage, slugify, uid } from './utils'

/** Message d'erreur lisible renvoyé par une fonction serveur. */
async function fnError(e: unknown): Promise<string> {
  const ctx = (e as { context?: Response })?.context
  try { const j = await ctx?.json(); if (j?.error) return j.error } catch { /* corps vide */ }
  return 'Le service de paiement ne répond pas. Réessayez dans un instant.'
}

const ORDER_SELECT = '*, vitrine:vitrines(id,name,slug,type,phone,whatsapp)'

export function createSupabaseApi(url: string, key: string): Api {
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })

  const must = <T,>(r: { data: T; error: unknown }): T => {
    if (r.error) throw r.error
    return r.data
  }
  const userId = async () => (await sb.auth.getUser()).data.user?.id ?? null

  return {
    mode: 'supabase',

    async getProfile() {
      const { data } = await sb.auth.getUser()
      if (!data.user) return null
      const p = await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
      const prof = (p.data ?? { id: data.user.id, full_name: null, phone: null, role: 'visitor' }) as Profile
      return { ...prof, email: data.user.email }
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb())
      return () => data.subscription.unsubscribe()
    },
    async signUp({ email, password, full_name, phone }) {
      must(await sb.auth.signUp({ email, password, options: { data: { full_name, phone } } }))
    },
    async signIn(email, password) {
      must(await sb.auth.signInWithPassword({ email, password }))
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async updateProfile(patch) {
      const id = await userId()
      if (!id) throw new Error('Non connecté')
      must(await sb.from('profiles').update(patch).eq('id', id))
    },

    async listCategories(type) {
      let q = sb.from('categories').select('*').order('position')
      if (type) q = q.eq('type', type)
      return must(await q) as Category[]
    },
    async listVitrines(o = {}) {
      let q = sb.from('vitrines').select('*').eq('status', 'active')
        .order('is_premium', { ascending: false }).order('rating_count', { ascending: false }).order('created_at', { ascending: false })
      if (o.type) q = q.eq('type', o.type)
      if (o.categoryId) q = q.eq('category_id', o.categoryId)
      if (o.q) {
        const t = o.q.replace(/[%,()]/g, ' ').trim()
        q = q.or(`name.ilike.%${t}%,description.ilike.%${t}%,city.ilike.%${t}%,district.ilike.%${t}%`)
      }
      if (o.limit) q = q.limit(o.limit)
      return must(await q) as Vitrine[]
    },
    async getVitrineBySlug(slug) {
      return must(await sb.from('vitrines').select('*').eq('slug', slug).maybeSingle()) as Vitrine | null
    },
    async listItems(vitrineId) {
      return must(await sb.from('items').select('*').eq('vitrine_id', vitrineId).order('created_at', { ascending: false })) as Item[]
    },
    async searchItems(text, type) {
      const t = text.replace(/[%,()]/g, ' ').trim()
      if (!t) return []
      let q = sb.from('items').select('*, vitrine:vitrines!inner(id,name,slug,type,city,status)')
        .or(`title.ilike.%${t}%,description.ilike.%${t}%`).eq('vitrine.status', 'active').limit(30)
      if (type) q = q.eq('vitrine.type', type)
      return must(await q) as ItemHit[]
    },
    async listItemsByCategory(categoryId) {
      return must(await sb.from('items').select('*, vitrine:vitrines!inner(id,name,slug,type,city,status,category_id)')
        .eq('vitrine.category_id', categoryId).eq('vitrine.status', 'active')
        .order('created_at', { ascending: false }).limit(60)) as ItemHit[]
    },
    async getCategory(id) {
      return must(await sb.from('categories').select('*').eq('id', id).maybeSingle()) as Category | null
    },
    async incrementViews(vitrineId) {
      await sb.rpc('increment_views', { vid: vitrineId })
    },

    async myVitrine() {
      const id = await userId()
      if (!id) return null
      return must(await sb.from('vitrines').select('*').eq('owner_id', id).maybeSingle()) as Vitrine | null
    },
    async saveVitrine(v) {
      const id = await userId()
      if (!id) throw new Error('Non connecté')
      const { id: vid, status: _s, is_premium: _p, premium_until: _u, views: _v, created_at: _c, ...rest } = v
      if (vid) {
        return must(await sb.from('vitrines').update(rest).eq('id', vid).select().single()) as Vitrine
      }
      const base = slugify(v.name)
      const slug = `${base}-${uid().slice(0, 4)}`
      return must(await sb.from('vitrines').insert({ ...rest, owner_id: id, slug }).select().single()) as Vitrine
    },
    async saveItem(i) {
      const { id, created_at: _c, ...rest } = i
      if (id) return must(await sb.from('items').update(rest).eq('id', id).select().single()) as Item
      return must(await sb.from('items').insert(rest).select().single()) as Item
    },
    async deleteItem(id) {
      must(await sb.from('items').delete().eq('id', id))
    },
    async uploadImage(file) {
      const id = await userId()
      if (!id) throw new Error('Non connecté')
      const blob = await compressImage(file)
      const path = `${id}/${uid()}.jpg`
      must(await sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl
    },
    async requestPremium(vitrineId, plan, note) {
      must(await sb.from('premium_requests').insert({ vitrine_id: vitrineId, plan, note }))
    },
    async myPremiumRequests(vitrineId) {
      return must(await sb.from('premium_requests').select('*').eq('vitrine_id', vitrineId)
        .order('created_at', { ascending: false })) as PremiumRequest[]
    },

    // ---------- Achat protégé ----------
    async createOrder(o) {
      const r = await sb.rpc('create_order', {
        p_item_id: o.item_id, p_quantity: o.quantity, p_buyer_name: o.buyer_name,
        p_buyer_phone: o.buyer_phone, p_address: o.address, p_note: o.note, p_protected: o.protected, p_zone: o.zone,
      })
      return must(r) as Order
    },
    async myOrders() {
      const id = await userId()
      if (!id) return []
      return must(await sb.from('orders').select(ORDER_SELECT).eq('buyer_id', id).order('created_at', { ascending: false })) as Order[]
    },
    async sellerOrders() {
      const id = await userId()
      if (!id) return []
      const v = await sb.from('vitrines').select('id').eq('owner_id', id).maybeSingle()
      if (!v.data) return []
      return must(await sb.from('orders').select(ORDER_SELECT).eq('vitrine_id', v.data.id).order('created_at', { ascending: false })) as Order[]
    },
    async getOrder(oid) {
      const id = await userId()
      const o = must(await sb.from('orders').select(ORDER_SELECT).eq('id', oid).maybeSingle()) as Order | null
      if (!o || !id) return null
      const events = must(await sb.from('order_events').select('*').eq('order_id', oid).order('created_at')) as OrderEvent[]
      const prof = await sb.from('profiles').select('role').eq('id', id).maybeSingle()
      const owner = await sb.from('vitrines').select('owner_id').eq('id', o.vitrine_id).maybeSingle()
      const role = prof.data?.role === 'admin' ? 'admin' : owner.data?.owner_id === id ? 'seller' : 'buyer'
      return { order: o, events, role }
    },
    async moveOrder(oid, to, extra = {}) {
      must(await sb.rpc('order_transition', {
        p_order_id: oid, p_to: to, p_note: extra.note ?? '', p_payment_method: extra.payment_method ?? null,
        p_payment_ref: extra.payment_ref ?? null, p_dispute_reason: extra.dispute_reason ?? null,
        p_attachments: extra.attachments ?? [], p_code: extra.code ?? null,
      }))
    },
    async addEvidence(oid, note, attachments) {
      must(await sb.rpc('order_add_evidence', { p_order_id: oid, p_note: note, p_attachments: attachments }))
    },
    async getDeliveryCode(oid) {
      const r = await sb.from('order_secrets').select('delivery_code').eq('order_id', oid).maybeSingle()
      return (r.data?.delivery_code as string | undefined) ?? null
    },
    async startPayment(orderId) {
      const { data, error } = await sb.functions.invoke('cinetpay', { body: { action: 'init', order_id: orderId } })
      if (error) throw new Error(await fnError(error))
      if (data?.error) throw new Error(data.error)
      return data as { payment_url: string }
    },
    async checkPayment(orderId) {
      const { data, error } = await sb.functions.invoke('cinetpay', { body: { action: 'check', order_id: orderId } })
      if (error) throw new Error(await fnError(error))
      return String(data?.status ?? 'UNKNOWN')
    },
    async logContact(vitrineId, channel, itemId) {
      await sb.rpc('log_contact', { p_vitrine_id: vitrineId, p_channel: channel, p_item_id: itemId ?? null })
    },
    async contactStats(vitrineId) {
      const since = new Date(Date.now() - 30 * 864e5).toISOString()
      const [m, t] = await Promise.all([
        sb.from('contact_clicks').select('*', { count: 'exact', head: true }).eq('vitrine_id', vitrineId).gte('created_at', since),
        sb.from('contact_clicks').select('*', { count: 'exact', head: true }).eq('vitrine_id', vitrineId),
      ])
      return { month: m.count ?? 0, total: t.count ?? 0 }
    },
    async listReviews(vitrineId) {
      return must(await sb.from('reviews').select('*').eq('vitrine_id', vitrineId).order('created_at', { ascending: false }).limit(50)) as Review[]
    },
    async orderReview(orderId) {
      return must(await sb.from('reviews').select('*').eq('order_id', orderId).maybeSingle()) as Review | null
    },
    async createReview(orderId, rating, comment) {
      must(await sb.rpc('create_review', { p_order_id: orderId, p_rating: rating, p_comment: comment }))
    },
    async adminListOrders() {
      return must(await sb.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(500)) as Order[]
    },
    async adminMarkPayout(oid) {
      must(await sb.rpc('order_mark_payout', { p_order_id: oid }))
    },

    async adminStats() {
      const count = async (t: string, f?: (q: any) => any) => {
        let q: any = sb.from(t).select('*', { count: 'exact', head: true })
        if (f) q = f(q)
        const r = await q
        if (r.error) throw r.error
        return r.count ?? 0
      }
      const [users, commerce, agriculture, service, items, premium, pendingRequests] = await Promise.all([
        count('profiles'),
        count('vitrines', (q) => q.eq('type', 'commerce')),
        count('vitrines', (q) => q.eq('type', 'agriculture')),
        count('vitrines', (q) => q.eq('type', 'service')),
        count('items'),
        count('vitrines', (q) => q.eq('is_premium', true)),
        count('premium_requests', (q) => q.eq('status', 'pending')),
      ])
      return { users, vitrines: { commerce, agriculture, service }, items, premium, pendingRequests }
    },
    async adminListVitrines() {
      return must(await sb.from('vitrines').select('*').order('created_at', { ascending: false })) as Vitrine[]
    },
    async adminUpdateVitrine(id, patch) {
      must(await sb.from('vitrines').update(patch).eq('id', id))
    },
    async adminListRequests() {
      return must(await sb.from('premium_requests').select('*, vitrine:vitrines(id,name,type,phone)')
        .order('created_at', { ascending: false })) as PremiumRequest[]
    },
    async adminResolveRequest(id, status) {
      must(await sb.from('premium_requests').update({ status }).eq('id', id))
    },
    async saveCategory(c) {
      const { id, ...rest } = c
      if (id) must(await sb.from('categories').update(rest).eq('id', id))
      else must(await sb.from('categories').insert(rest))
    },
    async deleteCategory(id) {
      must(await sb.from('categories').delete().eq('id', id))
    },
  }
}
