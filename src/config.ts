import type { VitrineType } from './lib/types'

export const APP = {
  name: 'LinkApp',
  tagline: 'Vos opportunités, en un seul lieu',
  defaultCity: 'Yaoundé',
  // Numéro WhatsApp de l'équipe LinkApp pour l'activation Premium (À FOURNIR par Atipik Group)
  supportWhatsapp: '',
}

export const TYPES: Record<VitrineType, {
  label: string          // nom du profil
  space: string          // nom de l'espace
  itemSingular: string
  itemPlural: string
  addLabel: string
  defaultUnit: string
  icon: string
}> = {
  commerce: {
    label: 'Commerçant', space: 'Ma boutique', itemSingular: 'produit', itemPlural: 'Mes produits',
    addLabel: 'Ajouter un produit', defaultUnit: "l'unité", icon: 'store',
  },
  agriculture: {
    label: 'Agriculteur', space: 'Mon exploitation', itemSingular: 'culture', itemPlural: 'Mes cultures',
    addLabel: 'Ajouter une culture', defaultUnit: 'le kg', icon: 'leaf',
  },
  service: {
    label: 'Prestataire', space: 'Mon activité', itemSingular: 'service', itemPlural: 'Mes services',
    addLabel: 'Ajouter un service', defaultUnit: 'la prestation', icon: 'tool',
  },
}

/**
 * Formules d'abonnement.
 * À DÉCIDER avec Atipik Group : noms, prix et durées. `price: null` affiche « Tarif sur demande ».
 * En V1 l'activation est manuelle : le pro fait une demande, l'admin l'active après paiement Mobile Money.
 */
export const PLANS = [
  {
    id: 'gratuit', name: 'Gratuit', price: null as number | null, period: '',
    perks: ['Vitrine publique', "Jusqu'à 10 articles", 'Contact WhatsApp et appel'],
    maxItems: 10,
  },
  {
    id: 'premium', name: 'Premium', price: null as number | null, period: 'mois',
    perks: ['Articles illimités', 'Badge vérifié Premium', 'Mise en avant sur l’accueil', 'Statistiques de visites'],
    maxItems: Infinity,
  },
]
