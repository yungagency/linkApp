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

## LinkApp Assurance (type « Trade Assurance » d'Alibaba) — au choix du client

Commande → paiement Mobile Money → **argent bloqué** → préparation → expédition → livraison → **confirmation du client** → versement au vendeur (moins la commission). Litige possible à tout moment avant la confirmation : l'argent reste bloqué et l'admin rembourse ou libère.

- **Optionnelle** : le client peut aussi commander *sans assurance* (paiement direct au vendeur, simple suivi, pas de commission).
- **Délai de livraison** promis par le vendeur pour chaque article ; dépassé = le client peut demander le remboursement.
- **Preuves** : code de réception à 4 chiffres (connu du client seul) ou photo de la remise ; photo du bordereau d'agence à l'expédition ; en litige, chacun dépose photos et explications.
- Chaque étape est contrôlée dans la base (`order_transition`) et inscrite dans un **historique** (qui, quand, quoi).
- Le prix est recalculé côté serveur : le client ne peut pas le modifier.
- **V1 : vérification manuelle** des paiements par l'admin (onglet *Commandes & séquestre*). V2 : agrégateur de paiement.
- À fournir : numéros Mobile Money LinkApp (`APP.paymentNumbers`) ; taux de commission (5 % provisoire, `APP.commissionRate` et table `settings`).
- ⚠️ Faire valider le montage juridique (encaissement pour le compte de tiers, réglementation CEMAC) avant d'encaisser de l'argent réel.

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
2. **Créer les tables** : menu *SQL Editor* → *New query* → coller tout le fichier `supabase/migrations/0001_init.sql` → *Run*. Résultat attendu : « Success. No rows returned ». Recommencer avec `supabase/migrations/0002_orders.sql` puis `0003_assurance_preuves_delais.sql` et `0004_confiance_cinetpay.sql`, dans cet ordre.
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

## Paiement CinetPay (LinkApp Assurance)

Le client paie sur la page CinetPay (Orange Money / MTN MoMo). CinetPay prévient notre serveur, qui **revérifie toujours** la transaction auprès de CinetPay avant de passer la commande en « Paiement sécurisé ». Les clés CinetPay restent sur le serveur, jamais dans l'application.

1. **Compte marchand** : créer le compte sur cinetpay.com, faire valider les documents, récupérer **API Key** et **Site ID** (menu *Intégrations*).
2. **Installer la CLI Supabase** sur l'ordinateur, puis dans le dossier du projet :
   ```bash
   npx supabase login
   npx supabase link --project-ref VOTRE_REF_PROJET
   npx supabase secrets set CINETPAY_APIKEY=xxx CINETPAY_SITE_ID=xxx APP_URL=https://votre-app.vercel.app
   npx supabase functions deploy cinetpay
   npx supabase functions deploy cinetpay-notify --no-verify-jwt
   ```
   `--no-verify-jwt` est obligatoire pour `cinetpay-notify` : c'est CinetPay qui l'appelle, pas un utilisateur connecté.
3. **Tester** avec une petite commande réelle (CinetPay n'a pas de « faux paiement ») puis vérifier dans *Commandes & séquestre*.
4. Sans CinetPay (en attendant le compte marchand) : mettre `paymentProvider: 'manual'` dans `src/config.ts` → retour au paiement par référence vérifiée par l'admin.

En mode démo, une page de paiement **simulée** remplace CinetPay.

## Confiance

- **Contacts suivis** : chaque clic WhatsApp / appel est compté pour le vendeur (« X clients vous ont contacté ces 30 jours »), argument pour le Premium.
- **Avis vérifiés** : seul un client dont la commande est terminée peut noter (une fois par commande). Les vitrines notées remontent dans les résultats.
- **Vendeurs vérifiés** : l'admin contrôle la pièce d'identité puis clique « Vérifier ». LinkApp Assurance n'est proposée que chez les vendeurs vérifiés.
- **Plafond** : 100 000 FCFA par commande assurée (provisoire, table `settings` + `APP.assuranceMax`).
- **Zones** : en ville, autre ville par agence (+3 jours), retrait chez le vendeur.
- **Règles publiques** : page « LinkApp Assurance : les règles » (à faire relire par un juriste).
- **Versements groupés** : onglet admin *Versements vendeurs*, un versement par vendeur.

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
