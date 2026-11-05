/**
 * MODE DÉMO — utilisé tant que Supabase n'est pas configuré.
 * Toutes les données vivent dans le navigateur (localStorage) : idéal pour présenter
 * l'application au client sans serveur. Rien n'est partagé entre appareils.
 */
import { APP } from '../config'
import { canMove, type Actor } from './orders'
import type { Api, Category, Item, Order, OrderEvent, Profile, PremiumRequest, Vitrine, VitrineType } from './types'
import { compressImage, slugify, uid } from './utils'

interface DemoUser extends Profile { email: string; password: string }
interface DB {
  users: DemoUser[]
  session: string | null
  categories: Category[]
  vitrines: Vitrine[]
  items: Item[]
  requests: PremiumRequest[]
  orders: Order[]
  events: OrderEvent[]
}

const KEY = 'linkapp-demo-v2'
const now = () => new Date().toISOString()

function seed(): DB {
  const cats: [VitrineType, string, string][] = [
    ['commerce', 'Épicerie', 'basket'], ['commerce', 'Mode', 'shirt'], ['commerce', 'Électronique', 'phone'],
    ['commerce', 'Maison', 'home'], ['commerce', 'Beauté', 'sparkle'], ['commerce', 'Restauration', 'food'],
    ['agriculture', 'Vivres', 'leaf'], ['agriculture', 'Fruits', 'fruit'], ['agriculture', 'Légumes', 'leaf'],
    ['agriculture', 'Élevage', 'egg'], ['agriculture', 'Semences & intrants', 'seed'],
    ['service', 'Réparation', 'tool'], ['service', 'Transport', 'truck'], ['service', 'Beauté & coiffure', 'sparkle'],
    ['service', 'Événementiel', 'star'], ['service', 'Bâtiment', 'home'], ['service', 'Formation', 'book'],
  ]
  const categories: Category[] = cats.map(([type, name, icon], i) => ({ id: `cat-${i}`, type, name, icon, position: i }))
  const cat = (n: string) => categories.find((c) => c.name === n)!.id

  const owner = (n: number) => `demo-owner-${n}`
  const users: DemoUser[] = [
    { id: 'demo-admin', email: 'admin@demo.linkapp', password: 'admin123', full_name: 'Admin LinkApp', phone: '', role: 'admin' },
    ...[1, 2, 3, 4, 5, 6].map((n) => ({
      id: owner(n), email: `pro${n}@demo.linkapp`, password: 'demo123', full_name: `Pro démo ${n}`, phone: '', role: 'pro' as const,
    })),
  ]
  const v = (n: number, type: VitrineType, name: string, category: string, district: string, description: string, premium = false, views = 0): Vitrine => ({
    id: `v-${n}`, owner_id: owner(n), type, name, slug: slugify(name), description, category_id: cat(category),
    city: 'Bafoussam', district, phone: '', whatsapp: '', cover_url: null, logo_url: null, status: 'active',
    is_premium: premium, premium_until: null, views, created_at: now(),
  })
  const vitrines = [
    v(1, 'agriculture', 'La Ferme Bio', 'Légumes', 'Tamdja', 'Produits frais de saison, cultivés sans pesticides.', true, 1240),
    v(2, 'commerce', 'Tech Mart', 'Électronique', 'Marché A', 'Téléphones, accessoires et petit électroménager.', true, 860),
    v(3, 'service', 'Garage Auto Plus', 'Réparation', 'Djeleng', 'Mécanique, diagnostic et entretien toutes marques.', false, 310),
    v(4, 'commerce', 'Mode Chic', 'Mode', 'Kamkop', 'Prêt-à-porter femme et pagnes.', false, 205),
    v(5, 'service', 'Beauté & Soins', 'Beauté & coiffure', 'Banengo', 'Coiffure, onglerie et soins à domicile.', false, 150),
    v(6, 'agriculture', 'GIC Les Planteurs', 'Vivres', 'Kouogouo', 'Manioc, macabo, igname en gros et demi-gros.', false, 98),
  ]
  const it = (vid: string, title: string, price: number | null, unit: string, description = '', available = true): Item => ({
    id: uid(), vitrine_id: vid, title, price, unit, description, image_url: null, available, created_at: now(),
  })
  const items = [
    it('v-1', 'Tomates fraîches', 1500, 'le kg', 'Récolte du matin.'), it('v-1', 'Mangues', 1000, 'le kg'),
    it('v-1', 'Piment frais', 800, 'le kg'), it('v-1', 'Gombo', 600, 'le tas'),
    it('v-2', 'Écouteurs Bluetooth', 12000, "l'unité"), it('v-2', 'Chargeur rapide 25W', 6500, "l'unité"),
    it('v-2', 'Smartphone reconditionné', 65000, "l'unité", 'Garantie 3 mois.'),
    it('v-3', 'Vidange complète', 15000, 'la prestation'), it('v-3', 'Diagnostic électronique', 10000, 'la prestation'),
    it('v-4', 'Robe en pagne', 18000, "l'unité"), it('v-4', 'Ensemble wax', 25000, "l'unité"),
    it('v-5', 'Tresses', 8000, 'la prestation'), it('v-5', 'Manucure', 5000, 'la prestation'),
    it('v-6', 'Maïs sec', 350, 'le kg', 'Sac de 50 kg disponible.'), it('v-6', 'Manioc', 15000, 'le sac'),
    it('v-6', 'Igname', 20000, 'le sac', '', false),
  ]
  return { users, session: null, categories, vitrines, items, requests: [], orders: [], events: [] }
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as DB
      d.orders ??= []; d.events ??= []
      return d
    }
  } catch { /* stockage indisponible : on repart du jeu de démo */ }
  return seed()
}

export function createDemoApi(): Api {
  let db = load()
  const listeners = new Set<() => void>()
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota plein */ }
  }
  const emit = () => listeners.forEach((l) => l())
  const me = () => db.users.find((u) => u.id === db.session) ?? null
  const needMe = () => {
    const u = me()
    if (!u) throw new Error('Non connecté')
    return u
  }
  const needAdmin = () => {
    if (needMe().role !== 'admin') throw new Error('Accès réservé à l’administration')
  }
  const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120))
  const visible = (v: Vitrine) => v.status === 'active'
  const withVitrine = (o: Order): Order => {
    const v = db.vitrines.find((x) => x.id === o.vitrine_id)
    return { ...o, vitrine: v && { id: v.id, name: v.name, slug: v.slug, type: v.type, phone: v.phone, whatsapp: v.whatsapp } }
  }
  const roleFor = (o: Order, u: DemoUser): Actor | null => {
    if (u.role === 'admin') return 'admin'
    if (db.vitrines.find((x) => x.id === o.vitrine_id)?.owner_id === u.id) return 'seller'
    if (o.buyer_id === u.id) return 'buyer'
    return null
  }
  const match = (t: string, ...fields: (string | null | undefined)[]) =>
    fields.some((f) => (f ?? '').toLowerCase().includes(t.toLowerCase()))

  return {
    mode: 'demo',

    async getProfile() {
      const u = me()
      if (!u) return delay(null)
      const { password: _p, ...p } = u
      return delay(p)
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signUp({ email, password, full_name, phone }) {
      if (password.length < 6) throw new Error('Password should be at least 6 characters')
      if (db.users.some((u) => u.email === email.toLowerCase())) throw new Error('User already registered')
      const u: DemoUser = { id: uid(), email: email.toLowerCase(), password, full_name, phone, role: 'visitor' }
      db.users.push(u); db.session = u.id; save(); emit()
    },
    async signIn(email, password) {
      const u = db.users.find((x) => x.email === email.toLowerCase() && x.password === password)
      if (!u) throw new Error('Invalid login credentials')
      db.session = u.id; save(); emit()
    },
    async signOut() {
      db.session = null; save(); emit()
    },
    async updateProfile(patch) {
      Object.assign(needMe(), patch); save(); emit()
    },

    async listCategories(type) {
      return delay(db.categories.filter((c) => !type || c.type === type).sort((a, b) => a.position - b.position))
    },
    async listVitrines(o = {}) {
      let r = db.vitrines.filter(visible)
      if (o.type) r = r.filter((v) => v.type === o.type)
      if (o.categoryId) r = r.filter((v) => v.category_id === o.categoryId)
      if (o.q) r = r.filter((v) => match(o.q!, v.name, v.description, v.city, v.district))
      r.sort((a, b) => Number(b.is_premium) - Number(a.is_premium) || b.created_at.localeCompare(a.created_at))
      return delay(o.limit ? r.slice(0, o.limit) : r)
    },
    async getVitrineBySlug(slug) {
      const v = db.vitrines.find((x) => x.slug === slug)
      const u = me()
      if (!v || (!visible(v) && v.owner_id !== u?.id && u?.role !== 'admin')) return delay(null)
      return delay(v)
    },
    async listItems(vitrineId) {
      return delay(db.items.filter((i) => i.vitrine_id === vitrineId).sort((a, b) => b.created_at.localeCompare(a.created_at)))
    },
    async searchItems(q, type) {
      if (!q.trim()) return delay([])
      const hits = db.items.flatMap((i) => {
        const v = db.vitrines.find((x) => x.id === i.vitrine_id)
        if (!v || !visible(v) || (type && v.type !== type) || !match(q, i.title, i.description)) return []
        return [{ ...i, vitrine: { id: v.id, name: v.name, slug: v.slug, type: v.type, city: v.city } }]
      })
      return delay(hits.slice(0, 30))
    },
    async listItemsByCategory(categoryId) {
      const hits = db.items.flatMap((i) => {
        const v = db.vitrines.find((x) => x.id === i.vitrine_id)
        if (!v || !visible(v) || v.category_id !== categoryId) return []
        return [{ ...i, vitrine: { id: v.id, name: v.name, slug: v.slug, type: v.type, city: v.city } }]
      })
      return delay(hits)
    },
    async getCategory(id) {
      return delay(db.categories.find((c) => c.id === id) ?? null)
    },
    async incrementViews(vitrineId) {
      const v = db.vitrines.find((x) => x.id === vitrineId)
      if (v) { v.views++; save() }
    },

    async myVitrine() {
      const u = me()
      return delay(u ? db.vitrines.find((v) => v.owner_id === u.id) ?? null : null)
    },
    async saveVitrine(input) {
      const u = needMe()
      const existing = input.id ? db.vitrines.find((v) => v.id === input.id) : undefined
      const { status: _s, is_premium: _p, premium_until: _u, views: _v, ...rest } = input
      if (existing) {
        if (existing.owner_id !== u.id && u.role !== 'admin') throw new Error('Action non autorisée')
        Object.assign(existing, rest); save(); return delay(existing)
      }
      if (db.vitrines.some((v) => v.owner_id === u.id)) throw new Error('Vous avez déjà une vitrine')
      const v: Vitrine = {
        id: uid(), owner_id: u.id, slug: `${slugify(input.name)}-${uid().slice(0, 4)}`, description: '', category_id: null,
        city: '', district: '', phone: '', whatsapp: '', cover_url: null, logo_url: null, created_at: now(),
        ...rest, status: 'active', is_premium: false, premium_until: null, views: 0,
      } as Vitrine
      db.vitrines.push(v)
      if (u.role === 'visitor') u.role = 'pro'
      save(); emit(); return delay(v)
    },
    async saveItem(input) {
      const u = needMe()
      const v = db.vitrines.find((x) => x.id === input.vitrine_id)
      if (!v || (v.owner_id !== u.id && u.role !== 'admin')) throw new Error('Action non autorisée')
      const existing = input.id ? db.items.find((i) => i.id === input.id) : undefined
      if (existing) { Object.assign(existing, input); save(); return delay(existing) }
      const i: Item = { id: uid(), description: '', price: null, unit: '', image_url: null, available: true, created_at: now(), ...input } as Item
      db.items.push(i); save(); return delay(i)
    },
    async deleteItem(id) {
      db.items = db.items.filter((i) => i.id !== id); save()
    },
    async uploadImage(file) {
      needMe()
      const blob = await compressImage(file, 720, 0.72)
      return new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result))
        r.onerror = () => rej(new Error('Lecture de la photo impossible'))
        r.readAsDataURL(blob)
      })
    },
    async requestPremium(vitrineId, plan, note) {
      needMe()
      db.requests.unshift({ id: uid(), vitrine_id: vitrineId, plan, note, status: 'pending', created_at: now() }); save()
    },
    async myPremiumRequests(vitrineId) {
      return delay(db.requests.filter((r) => r.vitrine_id === vitrineId))
    },

    // ---------- Achat protégé ----------
    async createOrder(o) {
      const u = needMe()
      const it = db.items.find((i) => i.id === o.item_id)
      if (!it || !it.available) throw new Error('Article indisponible')
      if (it.price == null) throw new Error("Cet article n'a pas de prix fixe : contactez le vendeur")
      const v = db.vitrines.find((x) => x.id === it.vitrine_id && x.status === 'active')
      if (!v) throw new Error('Vitrine indisponible')
      if (v.owner_id === u.id) throw new Error('Vous ne pouvez pas commander dans votre propre vitrine')
      if (!o.address.trim() || !o.buyer_phone.trim()) throw new Error('Adresse et téléphone de livraison obligatoires')
      const q = Math.max(1, Math.min(999, Math.round(o.quantity)))
      const subtotal = it.price * q
      const commission = Math.round(subtotal * APP.commissionRate)
      const order: Order = {
        id: uid(), code: 'LK-' + uid().replace(/-/g, '').slice(0, 6).toUpperCase(), buyer_id: u.id, vitrine_id: v.id,
        item_id: it.id, item_title: it.title, item_image: it.image_url, unit: it.unit, unit_price: it.price, quantity: q,
        subtotal, commission_rate: APP.commissionRate, commission, seller_amount: subtotal - commission,
        buyer_name: o.buyer_name, buyer_phone: o.buyer_phone, address: o.address, note: o.note,
        status: 'pending_payment', payment_method: null, payment_ref: null, dispute_reason: null, delivered_at: null,
        payout_status: 'none', created_at: now(), updated_at: now(),
      }
      db.orders.unshift(order)
      db.events.push({ id: uid(), order_id: order.id, status: 'pending_payment', actor: 'buyer', note: 'Commande passée', created_at: now() })
      save(); return delay(withVitrine(order))
    },
    async myOrders() {
      const u = me()
      return delay(u ? db.orders.filter((o) => o.buyer_id === u.id).map(withVitrine) : [])
    },
    async sellerOrders() {
      const u = me()
      const v = u && db.vitrines.find((x) => x.owner_id === u.id)
      return delay(v ? db.orders.filter((o) => o.vitrine_id === v.id).map(withVitrine) : [])
    },
    async getOrder(id) {
      const u = me()
      const o = db.orders.find((x) => x.id === id)
      if (!u || !o) return delay(null)
      const role = roleFor(o, u)
      if (!role) return delay(null)
      return delay({ order: withVitrine(o), events: db.events.filter((e) => e.order_id === id), role })
    },
    async moveOrder(id, to, extra = {}) {
      const u = needMe()
      const o = db.orders.find((x) => x.id === id)
      if (!o) throw new Error('Commande introuvable')
      const role = roleFor(o, u)
      if (!role || !canMove(o.status, to, role)) throw new Error('Étape non autorisée')
      if (to === 'payment_submitted' && !extra.payment_ref?.trim()) throw new Error('Indiquez la référence de la transaction Mobile Money')
      if (to === 'dispute' && !extra.dispute_reason?.trim()) throw new Error('Décrivez le problème')
      o.status = to
      if (extra.payment_method) o.payment_method = extra.payment_method
      if (extra.payment_ref) o.payment_ref = extra.payment_ref
      if (to === 'dispute') o.dispute_reason = extra.dispute_reason ?? ''
      if (to === 'delivered') o.delivered_at = now()
      if (to === 'completed') o.payout_status = 'pending'
      o.updated_at = now()
      db.events.push({ id: uid(), order_id: id, status: to, actor: role, note: extra.note || extra.dispute_reason || '', created_at: now() })
      save()
    },
    async adminListOrders() {
      needAdmin()
      return delay(db.orders.map(withVitrine))
    },
    async adminMarkPayout(id) {
      needAdmin()
      const o = db.orders.find((x) => x.id === id)
      if (!o || o.status !== 'completed' || o.payout_status !== 'pending') throw new Error('Versement impossible pour cette commande')
      o.payout_status = 'paid'; o.updated_at = now()
      db.events.push({ id: uid(), order_id: id, status: 'completed', actor: 'admin', note: 'Montant versé au vendeur', created_at: now() })
      save()
    },

    async adminStats() {
      needAdmin()
      const count = (t: VitrineType) => db.vitrines.filter((v) => v.type === t).length
      return delay({
        users: db.users.length,
        vitrines: { commerce: count('commerce'), agriculture: count('agriculture'), service: count('service') },
        items: db.items.length,
        premium: db.vitrines.filter((v) => v.is_premium).length,
        pendingRequests: db.requests.filter((r) => r.status === 'pending').length,
      })
    },
    async adminListVitrines() {
      needAdmin()
      return delay([...db.vitrines].sort((a, b) => b.created_at.localeCompare(a.created_at)))
    },
    async adminUpdateVitrine(id, patch) {
      needAdmin()
      const v = db.vitrines.find((x) => x.id === id)
      if (v) { Object.assign(v, patch); save() }
    },
    async adminListRequests() {
      needAdmin()
      return delay(db.requests.map((r) => {
        const v = db.vitrines.find((x) => x.id === r.vitrine_id)
        return { ...r, vitrine: v && { id: v.id, name: v.name, type: v.type, phone: v.phone } }
      }))
    },
    async adminResolveRequest(id, status) {
      needAdmin()
      const r = db.requests.find((x) => x.id === id)
      if (r) { r.status = status; save() }
    },
    async saveCategory(c) {
      needAdmin()
      const existing = c.id ? db.categories.find((x) => x.id === c.id) : undefined
      if (existing) Object.assign(existing, c)
      else db.categories.push({ id: uid(), icon: 'tag', position: db.categories.length, ...c } as Category)
      save()
    },
    async deleteCategory(id) {
      needAdmin()
      db.categories = db.categories.filter((c) => c.id !== id)
      db.vitrines.forEach((v) => { if (v.category_id === id) v.category_id = null })
      save()
    },
  }
}

export function resetDemo() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  location.reload()
}
