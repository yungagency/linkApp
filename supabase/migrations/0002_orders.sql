-- =====================================================================
-- LinkApp — ACHAT PROTÉGÉ (commandes, séquestre, suivi de livraison)
-- À exécuter APRÈS 0001_init.sql (SQL Editor > New query > coller > Run)
--
-- Le client ne peut pas fixer le prix : il est recalculé ici à partir de l'article.
-- Chaque changement de statut passe par order_transition(), qui vérifie QUI a le droit
-- de faire QUOI, et l'inscrit dans le journal (order_events) : c'est la trace.
-- =====================================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  vitrine_id uuid not null references public.vitrines(id) on delete restrict,
  item_id uuid references public.items(id) on delete set null,
  item_title text not null,
  item_image text,
  unit text default '',
  unit_price numeric not null check (unit_price >= 0),
  quantity int not null check (quantity between 1 and 999),
  subtotal numeric not null,
  commission_rate numeric not null default 0.05,
  commission numeric not null,
  seller_amount numeric not null,
  buyer_name text not null,
  buyer_phone text not null,
  address text not null,
  note text default '',
  status text not null default 'pending_payment' check (status in
    ('pending_payment','payment_submitted','paid','preparing','shipped','delivered','completed','dispute','refunded','cancelled')),
  payment_method text check (payment_method in ('orange','mtn')),
  payment_ref text,
  dispute_reason text,
  delivered_at timestamptz,
  payout_status text not null default 'none' check (payout_status in ('none','pending','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_buyer_idx on public.orders(buyer_id);
create index if not exists orders_vitrine_idx on public.orders(vitrine_id);
create index if not exists orders_status_idx on public.orders(status);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  actor text not null check (actor in ('buyer','seller','admin')),
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events(order_id);

-- Taux de commission (modifiable par l'admin dans la table settings)
create table if not exists public.settings (
  key text primary key,
  value text not null
);
insert into public.settings (key, value) values ('commission_rate', '0.05') on conflict (key) do nothing;

-- ---------- Création d'une commande (prix calculé côté serveur) ----------
create or replace function public.create_order(
  p_item_id uuid, p_quantity int, p_buyer_name text, p_buyer_phone text, p_address text, p_note text default ''
) returns public.orders language plpgsql security definer set search_path = public as $$
declare it public.items; v public.vitrines; rate numeric; sub numeric; o public.orders;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into it from public.items where id = p_item_id;
  if not found or not it.available then raise exception 'Article indisponible'; end if;
  if it.price is null then raise exception 'Cet article n''a pas de prix fixe : contactez le vendeur'; end if;
  select * into v from public.vitrines where id = it.vitrine_id and status = 'active';
  if not found then raise exception 'Vitrine indisponible'; end if;
  if v.owner_id = auth.uid() then raise exception 'Vous ne pouvez pas commander dans votre propre vitrine'; end if;
  if coalesce(trim(p_address), '') = '' or coalesce(trim(p_buyer_phone), '') = '' then
    raise exception 'Adresse et téléphone de livraison obligatoires';
  end if;
  select coalesce(value::numeric, 0.05) into rate from public.settings where key = 'commission_rate';
  sub := it.price * p_quantity;
  insert into public.orders (code, buyer_id, vitrine_id, item_id, item_title, item_image, unit, unit_price, quantity,
    subtotal, commission_rate, commission, seller_amount, buyer_name, buyer_phone, address, note)
  values ('LK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), auth.uid(), v.id, it.id, it.title,
    it.image_url, it.unit, it.price, p_quantity, sub, rate, round(sub * rate), sub - round(sub * rate),
    p_buyer_name, p_buyer_phone, p_address, coalesce(p_note, ''))
  returning * into o;
  insert into public.order_events (order_id, status, actor, note) values (o.id, 'pending_payment', 'buyer', 'Commande passée');
  return o;
end $$;

-- ---------- Changement de statut contrôlé ----------
create or replace function public.order_transition(
  p_order_id uuid, p_to text, p_note text default '', p_payment_method text default null,
  p_payment_ref text default null, p_dispute_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; actor text; ok boolean := false; seller uuid;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable'; end if;
  select owner_id into seller from public.vitrines where id = o.vitrine_id;
  if public.is_admin() then actor := 'admin';
  elsif auth.uid() = seller then actor := 'seller';
  elsif auth.uid() = o.buyer_id then actor := 'buyer';
  else raise exception 'Action non autorisée'; end if;

  -- Mêmes règles que src/lib/orders.ts (TRANSITIONS)
  ok := case o.status
    when 'pending_payment'   then (p_to = 'payment_submitted' and actor = 'buyer') or (p_to = 'cancelled') or (p_to = 'paid' and actor = 'admin')
    when 'payment_submitted' then actor = 'admin' and p_to in ('paid','pending_payment','cancelled')
    when 'paid'              then (p_to = 'preparing' and actor = 'seller') or (p_to = 'refunded' and actor = 'admin') or (p_to = 'dispute' and actor = 'buyer')
    when 'preparing'         then (p_to = 'shipped' and actor = 'seller') or (p_to = 'refunded' and actor = 'admin') or (p_to = 'dispute' and actor = 'buyer')
    when 'shipped'           then (p_to = 'delivered' and actor = 'seller') or (p_to in ('completed','dispute') and actor = 'buyer')
    when 'delivered'         then (p_to = 'completed' and actor in ('buyer','admin')) or (p_to = 'dispute' and actor = 'buyer')
    when 'dispute'           then actor = 'admin' and p_to in ('completed','refunded')
    else false end;
  if not ok then raise exception 'Étape non autorisée (% → %)', o.status, p_to; end if;

  if p_to = 'payment_submitted' and coalesce(trim(p_payment_ref), '') = '' then
    raise exception 'Indiquez la référence de la transaction Mobile Money';
  end if;
  if p_to = 'dispute' and coalesce(trim(p_dispute_reason), '') = '' then
    raise exception 'Décrivez le problème';
  end if;

  update public.orders set
    status = p_to,
    payment_method = coalesce(p_payment_method, payment_method),
    payment_ref = coalesce(p_payment_ref, payment_ref),
    dispute_reason = case when p_to = 'dispute' then p_dispute_reason else dispute_reason end,
    delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
    payout_status = case when p_to = 'completed' then 'pending' else payout_status end,
    updated_at = now()
  where id = o.id;
  insert into public.order_events (order_id, status, actor, note)
  values (o.id, p_to, actor, coalesce(nullif(p_note, ''), coalesce(p_dispute_reason, '')));
end $$;

-- ---------- Versement au vendeur effectué (admin) ----------
create or replace function public.order_mark_payout(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''administration'; end if;
  update public.orders set payout_status = 'paid', updated_at = now()
    where id = p_order_id and status = 'completed' and payout_status = 'pending';
  if not found then raise exception 'Versement impossible pour cette commande'; end if;
  insert into public.order_events (order_id, status, actor, note) values (p_order_id, 'completed', 'admin', 'Montant versé au vendeur');
end $$;

-- ---------- Sécurité : lecture seulement, toute écriture passe par les fonctions ----------
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.settings enable row level security;

drop policy if exists "commande: lecture" on public.orders;
create policy "commande: lecture" on public.orders for select using (
  buyer_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = auth.uid()));

drop policy if exists "suivi: lecture" on public.order_events;
create policy "suivi: lecture" on public.order_events for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.vitrines v where v.id = o.vitrine_id and v.owner_id = auth.uid()))));

drop policy if exists "reglages: lecture" on public.settings;
create policy "reglages: lecture" on public.settings for select using (true);
drop policy if exists "reglages: admin" on public.settings;
create policy "reglages: admin" on public.settings for all using (public.is_admin()) with check (public.is_admin());

grant execute on function public.create_order(uuid, int, text, text, text, text) to authenticated;
grant execute on function public.order_transition(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.order_mark_payout(uuid) to authenticated;
