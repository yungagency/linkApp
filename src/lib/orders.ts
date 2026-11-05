/**
 * COMMANDES LINKAPP — deux façons d'acheter, au choix du client :
 *
 * A. AVEC « LinkApp Assurance » (séquestre, inspiré de la Trade Assurance d'Alibaba)
 *    pending_payment → payment_submitted → paid (argent bloqué) → preparing → shipped
 *    → delivered (preuve : code de réception ou photo) → completed (fonds libérés)
 *    Litige possible tant que le client n'a pas confirmé : chacun dépose ses preuves,
 *    LinkApp tranche (remboursement ou libération). Délai de livraison dépassé = litige possible.
 *
 * B. SANS assurance (paiement à la livraison ou directement au vendeur)
 *    placed → preparing → shipped → delivered → completed
 *    LinkApp assure seulement le suivi ; aucun argent ne transite par LinkApp.
 *
 * Ces règles sont appliquées dans l'app ET dans la base (fonction order_transition).
 */
export type OrderStatus =
  | 'placed' | 'pending_payment' | 'payment_submitted' | 'paid' | 'preparing' | 'shipped'
  | 'delivered' | 'completed' | 'dispute' | 'refunded' | 'cancelled'

export type Actor = 'buyer' | 'seller' | 'admin'

export const STATUS: Record<OrderStatus, { label: string; short: string; tone: 'warn' | 'info' | 'ok' | 'off' | 'secure' }> = {
  placed: { label: 'Commande envoyée au vendeur', short: 'Envoyée', tone: 'warn' },
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

type Rules = Partial<Record<OrderStatus, Partial<Record<OrderStatus, Actor[]>>>>

/** Avec LinkApp Assurance */
const PROTECTED: Rules = {
  pending_payment: { payment_submitted: ['buyer'], cancelled: ['buyer', 'seller', 'admin'], paid: ['admin'] },
  payment_submitted: { paid: ['admin'], pending_payment: ['admin'], cancelled: ['admin'] },
  paid: { preparing: ['seller'], refunded: ['admin'], dispute: ['buyer'] },
  preparing: { shipped: ['seller'], refunded: ['admin'], dispute: ['buyer'] },
  shipped: { delivered: ['seller'], completed: ['buyer'], dispute: ['buyer'] },
  delivered: { completed: ['buyer', 'admin'], dispute: ['buyer'] },
  dispute: { completed: ['admin'], refunded: ['admin'] },
}

/** Sans assurance : simple suivi */
const DIRECT: Rules = {
  placed: { preparing: ['seller'], cancelled: ['buyer', 'seller', 'admin'] },
  preparing: { shipped: ['seller'], cancelled: ['buyer', 'seller', 'admin'] },
  shipped: { delivered: ['seller'], completed: ['buyer'], cancelled: ['admin'] },
  delivered: { completed: ['buyer', 'admin'] },
}

export function canMove(o: { status: OrderStatus; protected: boolean }, to: OrderStatus, actor: Actor) {
  const r = o.protected ? PROTECTED : DIRECT
  return !!r[o.status]?.[to]?.includes(actor)
}

/** Étapes affichées dans la frise de suivi. */
export function stepsFor(isProtected: boolean): { key: OrderStatus; label: string; icon: string }[] {
  return isProtected
    ? [
      { key: 'pending_payment', label: 'Commandée', icon: 'box' },
      { key: 'paid', label: 'Sécurisée', icon: 'shield' },
      { key: 'preparing', label: 'Préparée', icon: 'store' },
      { key: 'shipped', label: 'Expédiée', icon: 'truck' },
      { key: 'delivered', label: 'Livrée', icon: 'pin' },
      { key: 'completed', label: 'Terminée', icon: 'check' },
    ]
    : [
      { key: 'placed', label: 'Envoyée', icon: 'box' },
      { key: 'preparing', label: 'Acceptée', icon: 'store' },
      { key: 'shipped', label: 'Expédiée', icon: 'truck' },
      { key: 'delivered', label: 'Livrée', icon: 'pin' },
      { key: 'completed', label: 'Terminée', icon: 'check' },
    ]
}
export function stepIndex(s: OrderStatus, isProtected: boolean): number {
  const key = s === 'payment_submitted' ? 'pending_payment' : s
  return stepsFor(isProtected).findIndex((x) => x.key === key)
}

/** Argent bloqué = payé par le client mais pas encore versé ni remboursé. */
export const HELD: OrderStatus[] = ['paid', 'preparing', 'shipped', 'delivered', 'dispute']
/** Statuts où le délai de livraison court. */
export const RUNNING: OrderStatus[] = ['placed', 'paid', 'preparing', 'shipped']

/** Après la livraison, le client a ce délai pour confirmer ou contester. Ensuite LinkApp peut clôturer. */
export const CONFIRM_DAYS = 3

/** Délais proposés au vendeur pour chaque article (en jours, 0 = le jour même). */
export const DELIVERY_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: 'Le jour même' }, { days: 1, label: '24 h' }, { days: 2, label: '48 h' },
  { days: 3, label: '3 jours' }, { days: 5, label: '5 jours' }, { days: 7, label: '7 jours' }, { days: 14, label: '14 jours' },
]
export const deliveryLabel = (d: number) => DELIVERY_OPTIONS.find((o) => o.days === d)?.label ?? `${d} jours`

export function isLate(o: { status: OrderStatus; deliver_by: string | null }) {
  return !!o.deliver_by && RUNNING.includes(o.status) && new Date(o.deliver_by) < new Date()
}
