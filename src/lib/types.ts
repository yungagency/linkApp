export type VitrineType = 'commerce' | 'agriculture' | 'service'
export type Role = 'visitor' | 'pro' | 'admin'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  role: Role
  email?: string
}

export interface Category {
  id: string
  type: VitrineType
  name: string
  icon: string
  position: number
}

export interface Vitrine {
  id: string
  owner_id: string
  type: VitrineType
  name: string
  slug: string
  description: string
  category_id: string | null
  city: string
  district: string
  phone: string
  whatsapp: string
  cover_url: string | null
  logo_url: string | null
  status: 'pending' | 'active' | 'suspended'
  is_premium: boolean
  premium_until: string | null
  views: number
  /** Pièce d'identité vérifiée par LinkApp : condition pour proposer LinkApp Assurance */
  verified: boolean
  rating_avg: number
  rating_count: number
  created_at: string
}

export interface Item {
  id: string
  vitrine_id: string
  title: string
  description: string
  price: number | null
  unit: string
  image_url: string | null
  available: boolean
  /** Délai de livraison promis, en jours (0 = le jour même) */
  delivery_days: number
  created_at: string
}

export interface PremiumRequest {
  id: string
  vitrine_id: string
  plan: string
  note: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  vitrine?: Pick<Vitrine, 'id' | 'name' | 'type' | 'phone'>
}

export type OrderStatus = import('./orders').OrderStatus

export interface Order {
  id: string
  code: string
  buyer_id: string
  vitrine_id: string
  item_id: string | null
  item_title: string
  item_image: string | null
  unit: string
  unit_price: number
  quantity: number
  subtotal: number
  commission_rate: number
  commission: number
  seller_amount: number
  buyer_name: string
  buyer_phone: string
  address: string
  note: string
  status: OrderStatus
  /** true = LinkApp Assurance (argent bloqué) ; false = paiement à la livraison / direct */
  protected: boolean
  delivery_days: number
  /** Date limite de livraison (calculée au paiement sécurisé, ou à la commande sans assurance) */
  deliver_by: string | null
  /** Livraison confirmée par le code de réception du client */
  delivery_verified: boolean
  delivery_zone: DeliveryZone
  gateway_tx: string | null
  payment_method: 'orange' | 'mtn' | 'cinetpay' | null
  payment_ref: string | null
  dispute_reason: string | null
  delivered_at: string | null
  payout_status: 'none' | 'pending' | 'paid'
  created_at: string
  updated_at: string
  vitrine?: Pick<Vitrine, 'id' | 'name' | 'slug' | 'type' | 'phone' | 'whatsapp'>
}

export interface OrderEvent {
  id: string
  order_id: string
  status: OrderStatus
  actor: 'buyer' | 'seller' | 'admin'
  note: string
  /** Photos jointes : preuve de livraison, preuves de litige… */
  attachments: string[]
  created_at: string
}

export interface NewOrder {
  item_id: string
  quantity: number
  buyer_name: string
  buyer_phone: string
  address: string
  note: string
  protected: boolean
  zone: DeliveryZone
}

export type DeliveryZone = 'city' | 'intercity' | 'pickup'

export interface Review {
  id: string
  order_id: string
  vitrine_id: string
  buyer_name: string
  item_title: string
  rating: number
  comment: string
  created_at: string
}

export interface OrderMove {
  note?: string
  payment_method?: 'orange' | 'mtn'
  payment_ref?: string
  dispute_reason?: string
  attachments?: string[]
  /** Code de réception donné par le client au livreur */
  code?: string
}

export interface VitrineQuery {
  type?: VitrineType
  categoryId?: string
  q?: string
  limit?: number
}

export interface ItemHit extends Item {
  vitrine: Pick<Vitrine, 'id' | 'name' | 'slug' | 'type' | 'city'>
}

export interface AdminStats {
  users: number
  vitrines: Record<VitrineType, number>
  items: number
  premium: number
  pendingRequests: number
}

/** Contrat unique : implémenté par Supabase (production) et par le mode démo (local). */
export interface Api {
  mode: 'supabase' | 'demo'
  // Compte
  getProfile(): Promise<Profile | null>
  onAuthChange(cb: () => void): () => void
  signUp(input: { email: string; password: string; full_name: string; phone: string }): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  updateProfile(patch: Partial<Pick<Profile, 'full_name' | 'phone'>>): Promise<void>
  // Lecture publique
  listCategories(type?: VitrineType): Promise<Category[]>
  listVitrines(q?: VitrineQuery): Promise<Vitrine[]>
  getVitrineBySlug(slug: string): Promise<Vitrine | null>
  listItems(vitrineId: string): Promise<Item[]>
  searchItems(q: string, type?: VitrineType): Promise<ItemHit[]>
  listItemsByCategory(categoryId: string): Promise<ItemHit[]>
  getCategory(id: string): Promise<Category | null>
  incrementViews(vitrineId: string): Promise<void>
  // Espace pro
  myVitrine(): Promise<Vitrine | null>
  saveVitrine(v: Partial<Vitrine> & { type: VitrineType; name: string }): Promise<Vitrine>
  saveItem(i: Partial<Item> & { vitrine_id: string; title: string }): Promise<Item>
  deleteItem(id: string): Promise<void>
  uploadImage(file: File): Promise<string>
  requestPremium(vitrineId: string, plan: string, note: string): Promise<void>
  myPremiumRequests(vitrineId: string): Promise<PremiumRequest[]>
  // Achat protégé
  createOrder(o: NewOrder): Promise<Order>
  myOrders(): Promise<Order[]>
  sellerOrders(): Promise<Order[]>
  getOrder(id: string): Promise<{ order: Order; events: OrderEvent[]; role: 'buyer' | 'seller' | 'admin' } | null>
  moveOrder(id: string, to: OrderStatus, extra?: OrderMove): Promise<void>
  /** Ajouter des preuves pendant un litige (client, vendeur ou admin) */
  addEvidence(id: string, note: string, attachments: string[]): Promise<void>
  /** Code de réception : visible par le client seulement */
  getDeliveryCode(id: string): Promise<string | null>
  /** Paiement en ligne CinetPay (LinkApp Assurance) */
  startPayment(orderId: string): Promise<{ payment_url: string }>
  checkPayment(orderId: string): Promise<string>
  // Confiance
  logContact(vitrineId: string, channel: 'whatsapp' | 'call', itemId?: string): Promise<void>
  contactStats(vitrineId: string): Promise<{ month: number; total: number }>
  listReviews(vitrineId: string): Promise<Review[]>
  orderReview(orderId: string): Promise<Review | null>
  createReview(orderId: string, rating: number, comment: string): Promise<void>
  adminListOrders(): Promise<Order[]>
  adminMarkPayout(id: string): Promise<void>
  // Admin
  adminStats(): Promise<AdminStats>
  adminListVitrines(): Promise<Vitrine[]>
  adminUpdateVitrine(id: string, patch: Partial<Pick<Vitrine, 'status' | 'is_premium' | 'premium_until' | 'verified'>>): Promise<void>
  adminListRequests(): Promise<PremiumRequest[]>
  adminResolveRequest(id: string, status: 'approved' | 'rejected'): Promise<void>
  saveCategory(c: Partial<Category> & { type: VitrineType; name: string }): Promise<void>
  deleteCategory(id: string): Promise<void>
}
