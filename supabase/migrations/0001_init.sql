-- =====================================================================
-- LinkApp — schéma initial (V1)
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run
-- Une seule notion de "vitrine" pour les 3 types de pros :
--   commerce (commerçant) · agriculture (agriculteur) · service (prestataire)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Profils (1 par compte) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'visitor' check (role in ('visitor','pro','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Catégories ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('commerce','agriculture','service')),
  name text not null,
  icon text not null default 'tag',
  position int not null default 0,
  unique (type, name)
);

-- ---------- Vitrines ----------
create table if not exists public.vitrines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('commerce','agriculture','service')),
  name text not null,
  slug text not null unique,
  description text default '',
  category_id uuid references public.categories(id) on delete set null,
  city text default '',
  district text default '',
  phone text default '',
  whatsapp text default '',
  cover_url text,
  logo_url text,
  status text not null default 'active' check (status in ('pending','active','suspended')),
  is_premium boolean not null default false,
  premium_until date,
  views int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists vitrines_type_idx on public.vitrines(type);
create unique index if not exists vitrines_owner_unique on public.vitrines(owner_id); -- V1 : 1 vitrine par compte

-- Un pro ne peut pas s'attribuer lui-même le Premium ni changer son statut
create or replace function public.protect_vitrine_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'active'; new.is_premium := false; new.premium_until := null; new.views := 0;
    else
      new.status := old.status; new.is_premium := old.is_premium;
      new.premium_until := old.premium_until; new.views := old.views; new.owner_id := old.owner_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists vitrines_protect on public.vitrines;
create trigger vitrines_protect before insert or update on public.vitrines
  for each row execute function public.protect_vitrine_admin_fields();

-- Le compte devient "pro" dès qu'il crée sa vitrine
create or replace function public.promote_owner_to_pro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('linkapp.allow_role', '1', true);
  update public.profiles set role = 'pro' where id = new.owner_id and role = 'visitor';
  perform set_config('linkapp.allow_role', '', true);
  return new;
end $$;

drop trigger if exists vitrines_promote on public.vitrines;
create trigger vitrines_promote after insert on public.vitrines
  for each row execute function public.promote_owner_to_pro();

-- Compteur de visites (appelé par la page vitrine)
create or replace function public.increment_views(vid uuid)
returns void language sql security definer set search_path = public as $$
  update public.vitrines set views = views + 1 where id = vid and status = 'active';
$$;

-- ---------- Articles : produits / cultures / services ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  vitrine_id uuid not null references public.vitrines(id) on delete cascade,
  title text not null,
  description text default '',
  price numeric,
  unit text default '',          -- ex : "le kg", "le sac", "la prestation"
  image_url text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists items_vitrine_idx on public.items(vitrine_id);

-- Plan gratuit : 10 articles maximum (contrôlé aussi côté serveur, pas seulement dans l'app)
create or replace function public.enforce_item_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v public.vitrines; n int;
begin
  select * into v from public.vitrines where id = new.vitrine_id;
  if public.is_admin() or (v.is_premium and (v.premium_until is null or v.premium_until >= current_date)) then
    return new;
  end if;
  select count(*) into n from public.items where vitrine_id = new.vitrine_id;
  if n >= 10 then
    raise exception 'Limite du plan gratuit atteinte (10 articles). Passez Premium pour en ajouter plus.';
  end if;
  return new;
end $$;

drop trigger if exists items_limit on public.items;
create trigger items_limit before insert on public.items
  for each row execute function public.enforce_item_limit();

-- ---------- Demandes d'abonnement Premium (activation manuelle en V1) ----------
create table if not exists public.premium_requests (
  id uuid primary key default gen_random_uuid(),
  vitrine_id uuid not null references public.vitrines(id) on delete cascade,
  plan text not null,
  note text default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Sécurité (RLS)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.vitrines enable row level security;
alter table public.items enable row level security;
alter table public.premium_requests enable row level security;

-- profiles
drop policy if exists "profil: lecture" on public.profiles;
create policy "profil: lecture" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profil: modif" on public.profiles;
create policy "profil: modif" on public.profiles for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Un utilisateur ne peut pas changer son propre rôle (seuls l'admin et l'app le peuvent)
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role <> old.role and not public.is_admin()
     and coalesce(current_setting('linkapp.allow_role', true), '') <> '1' then
    new.role := old.role;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- categories
drop policy if exists "cat: lecture" on public.categories;
create policy "cat: lecture" on public.categories for select using (true);
drop policy if exists "cat: admin" on public.categories;
create policy "cat: admin" on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- vitrines
drop policy if exists "vitrine: lecture" on public.vitrines;
create policy "vitrine: lecture" on public.vitrines for select
  using (status = 'active' or owner_id = auth.uid() or public.is_admin());
drop policy if exists "vitrine: creation" on public.vitrines;
create policy "vitrine: creation" on public.vitrines for insert with check (owner_id = auth.uid());
drop policy if exists "vitrine: modif" on public.vitrines;
create policy "vitrine: modif" on public.vitrines for update using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "vitrine: suppression" on public.vitrines;
create policy "vitrine: suppression" on public.vitrines for delete using (owner_id = auth.uid() or public.is_admin());

-- items
drop policy if exists "item: lecture" on public.items;
create policy "item: lecture" on public.items for select using (
  exists (select 1 from public.vitrines v where v.id = vitrine_id
          and (v.status = 'active' or v.owner_id = auth.uid() or public.is_admin())));
drop policy if exists "item: gestion" on public.items;
create policy "item: gestion" on public.items for all using (
  exists (select 1 from public.vitrines v where v.id = vitrine_id and (v.owner_id = auth.uid() or public.is_admin())))
  with check (
  exists (select 1 from public.vitrines v where v.id = vitrine_id and (v.owner_id = auth.uid() or public.is_admin())));

-- premium_requests
drop policy if exists "premium: lecture" on public.premium_requests;
create policy "premium: lecture" on public.premium_requests for select using (
  public.is_admin() or exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = auth.uid()));
drop policy if exists "premium: demande" on public.premium_requests;
create policy "premium: demande" on public.premium_requests for insert with check (
  status = 'pending' and exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = auth.uid()));
drop policy if exists "premium: admin" on public.premium_requests;
create policy "premium: admin" on public.premium_requests for update using (public.is_admin());

-- =====================================================================
-- Stockage des photos (bucket public "media", dossier = id du compte)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;

drop policy if exists "media: lecture" on storage.objects;
create policy "media: lecture" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media: envoi" on storage.objects;
create policy "media: envoi" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media: suppression" on storage.objects;
create policy "media: suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Catégories de départ (modifiables depuis l'admin)
-- =====================================================================
insert into public.categories (type, name, icon, position) values
  ('commerce','Épicerie','basket',1), ('commerce','Mode','shirt',2), ('commerce','Électronique','phone',3),
  ('commerce','Maison','home',4), ('commerce','Beauté','sparkle',5), ('commerce','Restauration','food',6),
  ('agriculture','Vivres','leaf',1), ('agriculture','Fruits','fruit',2), ('agriculture','Légumes','leaf',3),
  ('agriculture','Élevage','egg',4), ('agriculture','Semences & intrants','seed',5),
  ('service','Réparation','tool',1), ('service','Transport','truck',2), ('service','Beauté & coiffure','sparkle',3),
  ('service','Événementiel','star',4), ('service','Bâtiment','home',5), ('service','Formation','book',6)
on conflict (type, name) do nothing;

-- =====================================================================
-- APRÈS la création de votre propre compte dans l'app, passez-le admin :
--   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'VOTRE_EMAIL');
-- =====================================================================
