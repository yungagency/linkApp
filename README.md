# LinkApp

**Vos opportunités, en un seul lieu.** Vitrines digitales pour commerçants, agriculteurs et prestataires de services.

- Client : Atipik Group (porteur du projet)
- Développement : Yung's Agency

## Ce que fait la V1

| Espace | Fonctions |
|---|---|
| Visiteur | Accueil, recherche (vitrines + articles), filtres par type et catégorie, page vitrine, favoris sur l'appareil, contact par appel ou WhatsApp |
| Pro (commerçant / agriculteur / prestataire) | Inscription, création de la vitrine, ajout de produits / cultures / services avec photo, disponibilité, statistiques de visites, demande Premium |
| Admin (`#/admin`) | Tableau de bord, suspension des vitrines, activation Premium (1 ou 12 mois), traitement des demandes, catégories |

Une seule structure de données « vitrine » sert les 3 profils : seuls les libellés changent (`src/config.ts`).

**Reporté en V2 :** paiement CinetPay intégré, notifications push, carte / géolocalisation, statistiques détaillées, publication sur les stores.

## Stack

React + Vite (PWA installable) · Supabase (comptes, base PostgreSQL, photos) · Capacitor (Android / iOS à partir du même code) · Vercel.

## Démarrer

```bash
npm install
npm run dev
```

Sans fichier `.env.local`, l'app tourne en **mode démo** : données d'exemple stockées dans le navigateur.
Compte admin démo : `admin@demo.linkapp` / `admin123`.

## Brancher Supabase

1. Créer un projet sur supabase.com.
2. *SQL Editor* → coller `supabase/migrations/0001_init.sql` → *Run* (tables, sécurité, stockage des photos, catégories).
3. Copier `.env.example` en `.env.local` et remplir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (*Project Settings → API*). Mettre les mêmes variables dans Vercel.
4. Créer son compte dans l'app, puis le passer admin (requête en bas du fichier SQL).
5. Pour tester sans confirmation d'email : *Authentication → Providers → Email* → désactiver « Confirm email ».

## Déploiement

- **Web / PWA** : importer le dépôt dans Vercel (framework Vite, sortie `dist`).
- **Android** : `npm run cap:android` (Android Studio requis).
- **iOS** : `npm run cap:ios` (Mac + Xcode requis). Apple refuse les simples sites emballés : prévoir en V2 les notifications et l'appareil photo natifs avant soumission.

## Points à valider avec le client

- Prix et durée des formules Premium (`PLANS` dans `src/config.ts`, actuellement « tarif communiqué par l'équipe »).
- Numéro WhatsApp de l'équipe pour les demandes Premium (`APP.supportWhatsapp`).
- Limite du plan gratuit (10 articles, contrôlée côté app seulement pour l'instant).
- Modération : les vitrines sont publiées directement, l'admin peut les suspendre.
- Identifiant d'application stores : `com.atipikgroup.linkapp` (dans `capacitor.config.ts`).
