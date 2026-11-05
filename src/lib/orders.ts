/**
 * ACHAT PROTÉGÉ LINKAPP — inspiré de la « Trade Assurance » d'Alibaba.
 *
 *  1. Le client commande ............................. pending_payment
 *  2. Il paie par Mobile Money et donne la référence . payment_submitted
 *  3. L'admin vérifie : l'argent est bloqué ........... paid          (séquestre)
 *  4. Le vendeur prépare .............................. preparing
 *  5. Le vendeur expédie .............................. shipped
 *  6. Le vendeur indique la livraison ................. delivered
 *  7. Le client confirme (ou délai écoulé) ............ completed     → fonds libérés au vendeur
 *     ou ouvre un litige .............................. dispute       → l'admin rembourse ou libère
 *  Annulation possible avant l'expédition ............. cancelled / refunded
 *
 * Ces règles sont appliquées dans l'app ET dans la base (fonction order_transition).
 */
export type OrderStatus =
  | 'pending_payment' | 'payment_submitted' | 'paid' | 'preparing' | 'shipped'
  | 'delivered' | 'completed' | 'dispute' | 'refunded' | 'cancelled'

export type Actor = 'buyer' | 'seller' | 'admin'

export const STATUS: Record<OrderStatus, { label: string; short: string; tone: 'warn' | 'info' | 'ok' | 'off' | 'secure' }> = {
  pending_payment: { label: 'En attente de paiement', short: 'À payer', tone: 'warn' },
  payment_submitted: { label: 'Paiement en vérification', short: 'Vérification', tone: 'warn' },
  paid: { label: 'Paiement sécurisé', short: 'Sécurisé', tone: 'secure' },
  preparing: { label: 'En préparation', short: 'Préparation', tone: 'info' },
  shipped: { label: 'En livraison', short: 'En livraison', tone: 'info' },
  delivered: { label: 'Livrée, à confirmer', short: 'Livrée', tone: 'info' },
  completed: { label: 'Terminée', short: 'Terminée', tone: 'ok' },
  dispute: { label: 'Litige en cours', short: 'Litige', tone: 'off' },
  refunded: { label: 'Remboursée', short: 'Remboursée', tone: 'off' },
  cancelled: { label: 'Annulée', short: 'Annulée', tone: 'off' },
}

/** Qui peut faire passer une commande d'un statut à un autre. */
export const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Actor[]>>> = {
  pending_payment: { payment_submitted: ['buyer'], cancelled: ['buyer', 'seller', 'admin'], paid: ['admin'] },
  payment_submitted: { paid: ['admin'], pending_payment: ['admin'], cancelled: ['admin'] },
  paid: { preparing: ['seller'], refunded: ['admin'], dispute: ['buyer'] },
  preparing: { shipped: ['seller'], refunded: ['admin'], dispute: ['buyer'] },
  shipped: { delivered: ['seller'], completed: ['buyer'], dispute: ['buyer'] },
  delivered: { completed: ['buyer', 'admin'], dispute: ['buyer'] },
  dispute: { completed: ['admin'], refunded: ['admin'] },
  completed: {},
  refunded: {},
  cancelled: {},
}

export function canMove(from: OrderStatus, to: OrderStatus, actor: Actor) {
  return !!TRANSITIONS[from]?.[to]?.includes(actor)
}

/** Étapes affichées dans la frise de suivi. */
export const STEPS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: 'pending_payment', label: 'Commandée', icon: 'box' },
  { key: 'paid', label: 'Sécurisée', icon: 'shield' },
  { key: 'preparing', label: 'Préparée', icon: 'store' },
  { key: 'shipped', label: 'Expédiée', icon: 'truck' },
  { key: 'delivered', label: 'Livrée', icon: 'pin' },
  { key: 'completed', label: 'Terminée', icon: 'check' },
]
const ORDER: OrderStatus[] = ['pending_payment', 'payment_submitted', 'paid', 'preparing', 'shipped', 'delivered', 'completed']
export function stepIndex(s: OrderStatus): number {
  if (s === 'payment_submitted') return 0
  const i = ORDER.indexOf(s)
  return i < 0 ? -1 : STEPS.findIndex((x) => x.key === s)
}

/** Argent bloqué = payé par le client mais pas encore versé ni remboursé. */
export const HELD: OrderStatus[] = ['paid', 'preparing', 'shipped', 'delivered', 'dispute']

/** Après la livraison, le client a ce délai pour confirmer ou contester. Ensuite l'admin peut clôturer. */
export const CONFIRM_DAYS = 3
