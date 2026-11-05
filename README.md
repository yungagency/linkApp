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

## Brancher Supabase (pas à pas)

1. **Créer le projet** : supabase.com → *New project* → nom `linkapp`, région la plus proche (Europe, ex. Frankfurt), mot de passe de base de données à conserver.
2. **Créer les tables** : menu *SQL Editor* → *New query* → coller tout le fichier `supabase/migrations/0001_init.sql` → *Run*. Résultat attendu : « Success. No rows returned ».
3. **Récupérer les 2 clés** : *Project Settings → API* (ou *API Keys*)
   - **Project URL** → `VITE_SUPABASE_URL` (forme `https://xxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_…`) ou, sur les anciens projets, **anon public** → `VITE_SUPABASE_ANON_KEY`
   - ⚠️ Ne jamais utiliser la clé **secret / service_role** dans l'app : elle donne tous les droits.
4. **En local** : copier `.env.example` en `.env.local`, coller les 2 valeurs, relancer `npm run dev`. Le bandeau « Mode démo » disparaît.
5. **Sur Vercel** : *Project → Settings → Environment Variables* → ajouter les 2 variables (Production + Preview) → *Deployments → Redeploy*.
6. **Adresses autorisées** : *Authentication → URL Configuration* → *Site URL* = l'adresse Vercel (ex. `https://linkapp.vercel.app`), et l'ajouter dans *Redirect URLs*. Sans ça, le lien de confirmation par email renvoie vers localhost.
7. **Confirmation par email** : *Authentication → Sign In / Providers → Email* → « Confirm email ». À désactiver pendant les tests, à réactiver avant le lancement.
8. **Devenir admin** : s'inscrire dans l'app, puis dans *SQL Editor* :
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'VOTRE_EMAIL');`
   Se déconnecter / reconnecter : le menu *Administration* apparaît dans *Compte*.

## Déploiement

- **Web / PWA** : importer le dépôt dans Vercel (framework Vite, sortie `dist`).
- **Première fois** : `npm run cap:add` (crée les projets Android et iOS).
- **Android** : `npm run cap:android` (Android Studio requis).
- **iOS** : `npm run cap:ios` (Mac + Xcode requis). Apple refuse les simples sites emballés : prévoir en V2 les notifications et l'appareil photo natifs avant soumission.

## Points à valider avec le client

- Prix et durée des formules Premium (`PLANS` dans `src/config.ts`, actuellement « tarif communiqué par l'équipe »).
- Numéro WhatsApp de l'équipe pour les demandes Premium (`APP.supportWhatsapp`).
- Limite du plan gratuit (10 articles, contrôlée dans l'app et dans la base).
- Modération : les vitrines sont publiées directement, l'admin peut les suspendre.
- Identifiant d'application stores : `com.atipikgroup.linkapp` (dans `capacitor.config.ts`).
