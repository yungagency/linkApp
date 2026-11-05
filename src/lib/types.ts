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
  // Admin
  adminStats(): Promise<AdminStats>
  adminListVitrines(): Promise<Vitrine[]>
  adminUpdateVitrine(id: string, patch: Partial<Pick<Vitrine, 'status' | 'is_premium' | 'premium_until'>>): Promise<void>
  adminListRequests(): Promise<PremiumRequest[]>
  adminResolveRequest(id: string, status: 'approved' | 'rejected'): Promise<void>
  saveCategory(c: Partial<Category> & { type: VitrineType; name: string }): Promise<void>
  deleteCategory(id: string): Promise<void>
}
