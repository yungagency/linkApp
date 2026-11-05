export function slugify(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'vitrine'
}

export function uid(): string {
  return (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.()
    ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function formatPrice(price: number | null, unit?: string): string {
  if (price == null || Number.isNaN(price)) return 'Prix sur demande'
  const n = Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') + ' FCFA'
  return unit ? `${n} / ${unit.replace(/^(le |la |l')/, '')}` : n
}

/** Normalise un numéro camerounais pour wa.me / tel: (ajoute 237 si absent). */
export function intlPhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('237')) return d
  if (d.length === 9) return '237' + d
  return d
}

export function waLink(phone: string, text: string): string {
  const p = intlPhone(phone)
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : ''
}

export function initials(name: string): string {
  return name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}

export function isPremiumActive(v: { is_premium: boolean; premium_until: string | null }): boolean {
  if (!v.is_premium) return false
  if (!v.premium_until) return true
  return new Date(v.premium_until + 'T23:59:59') >= new Date()
}

export function errorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.'
  if (/already registered/i.test(m)) return 'Un compte existe déjà avec cet email.'
  if (/Password should be/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (/Email not confirmed/i.test(m)) return 'Confirmez votre email avant de vous connecter (lien reçu par email).'
  if (/duplicate key.*slug/i.test(m)) return 'Ce nom de vitrine est déjà pris, essayez une variante.'
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion impossible. Vérifiez votre réseau et réessayez.'
  return m || 'Une erreur est survenue.'
}

/** Réduit une photo avant envoi (les connexions mobiles coûtent cher). */
export async function compressImage(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return file
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', quality))
}
