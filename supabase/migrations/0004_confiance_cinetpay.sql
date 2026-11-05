-- =====================================================================
-- LinkApp — Confiance : contacts suivis, avis vérifiés, vendeurs vérifiés,
-- plafond de l'assurance, zones de livraison, paiement CinetPay
-- À exécuter APRÈS 0001, 0002 et 0003
-- =====================================================================

-- ---------- Vendeurs vérifiés (pièce d'identité contrôlée par l'admin) ----------
alter table public.vitrines add column if not exists verified boolean not null default false;
alter table public.vitrines add column if not exists rating_avg numeric not null default 0;
alter table public.vitrines add column if not exists rating_count int not null default 0;

-- Le vendeur ne peut pas se déclarer vérifié ni modifier sa note
create or replace function public.protect_vitrine_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and coalesce(current_setting('linkapp.system', true), '') <> '1' then
    if tg_op = 'INSERT' then
      new.status := 'active'; new.is_premium := false; new.premium_until := null; new.views := 0;
      new.verified := false; new.rating_avg := 0; new.rating_count := 0;
    else
      new.status := old.status; new.is_premium := old.is_premium; new.premium_until := old.premium_until;
      new.views := old.views; new.owner_id := old.owner_id; new.verified := old.verified;
      new.rating_avg := old.rating_avg; new.rating_count := old.rating_count;
    end if;
  end if;
  return new;
end $$;

-- ---------- Réglages : plafond de l'assurance, jours en plus hors ville ----------
insert into public.settings (key, value) values
  ('assurance_max', '100000'),          -- FCFA par commande assurée (À DÉCIDER)
  ('intercity_extra_days', '3')         -- délai ajouté pour une livraison dans une autre ville
on conflict (key) do nothing;

-- ---------- Commandes : zone de livraison, transaction CinetPay ----------
alter table public.orders add column if not exists delivery_zone text not null default 'city' check (delivery_zone in ('city','intercity','pickup'));
alter table public.orders add column if not exists gateway_tx text unique;
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('orange','mtn','cinetpay'));

-- ---------- Création de commande (remplace 0003) ----------
drop function if exists public.create_order(uuid, int, text, text, text, text, boolean);
create or replace function public.create_order(
  p_item_id uuid, p_quantity int, p_buyer_name text, p_buyer_phone text, p_address text,
  p_note text default '', p_protected boolean default true, p_zone text default 'city'
) returns public.orders language plpgsql security definer set search_path = public as $$
declare it public.items; v public.vitrines; rate numeric; sub numeric; o public.orders; maxa numeric; extra int; days int;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into it from public.items where id = p_item_id;
  if not found or not it.available then raise exception 'Article indisponible'; end if;
  if it.price is null then raise exception 'Cet article n''a pas de prix fixe : contactez le vendeur'; end if;
  select * into v from public.vitrines where id = it.vitrine_id and status = 'active';
  if not found then raise exception 'Vitrine indisponible'; end if;
  if v.owner_id = auth.uid() then raise exception 'Vous ne pouvez pas commander dans votre propre vitrine'; end if;
  if coalesce(trim(p_buyer_phone), '') = '' or (p_zone <> 'pickup' and coalesce(trim(p_address), '') = '') then
    raise exception 'Adresse et téléphone de livraison obligatoires';
  end if;
  if p_zone not in ('city','intercity','pickup') then raise exception 'Zone de livraison inconnue'; end if;
  sub := it.price * p_quantity;
  if p_protected then
    if not v.verified then raise exception 'LinkApp Assurance est réservée aux vendeurs vérifiés'; end if;
    select coalesce(value::numeric, 100000) into maxa from public.settings where key = 'assurance_max';
    if sub > coalesce(maxa, 100000) then
      raise exception 'Montant au-delà du plafond de LinkApp Assurance (% FCFA)', coalesce(maxa, 100000);
    end if;
    select coalesce(value::numeric, 0.05) into rate from public.settings where key = 'commission_rate';
    rate := coalesce(rate, 0.05);
  else rate := 0; end if;
  select coalesce(value::int, 3) into extra from public.settings where key = 'intercity_extra_days';
  days := it.delivery_days + case when p_zone = 'intercity' then coalesce(extra, 3) else 0 end;
  insert into public.orders (code, buyer_id, vitrine_id, item_id, item_title, item_image, unit, unit_price, quantity,
    subtotal, commission_rate, commission, seller_amount, buyer_name, buyer_phone, address, note,
    protected, status, delivery_days, delivery_zone, deliver_by)
  values ('LK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), auth.uid(), v.id, it.id, it.title,
    it.image_url, it.unit, it.price, p_quantity, sub, rate, round(sub * rate), sub - round(sub * rate),
    p_buyer_name, p_buyer_phone, coalesce(nullif(trim(p_address), ''), 'Retrait chez le vendeur'), coalesce(p_note, ''),
    p_protected, case when p_protected then 'pending_payment' else 'placed' end, days, p_zone,
    case when p_protected then null else now() + make_interval(days => greatest(days, 1)) end)
  returning * into o;
  insert into public.order_secrets (order_id, buyer_id, delivery_code)
  values (o.id, auth.uid(), lpad((floor(random() * 10000))::int::text, 4, '0'));
  insert into public.order_events (order_id, status, actor, note)
  values (o.id, o.status, 'buyer', case when p_protected then 'Commande passée avec LinkApp Assurance' else 'Commande passée sans assurance' end);
  return o;
end $$;
grant execute on function public.create_order(uuid, int, text, text, text, text, boolean, text) to authenticated;

-- ---------- Paiement confirmé par CinetPay (appelé UNIQUEMENT par la fonction serveur, clé service) ----------
create or replace function public.order_gateway_paid(p_order_id uuid, p_tx text, p_amount numeric, p_method text default '')
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable'; end if;
  if o.status not in ('pending_payment', 'payment_submitted') then return; end if;  -- déjà traité : on ne refait rien
  if o.gateway_tx is distinct from p_tx then raise exception 'Transaction inconnue pour cette commande'; end if;
  if p_amount < o.subtotal then raise exception 'Montant payé insuffisant'; end if;
  update public.orders set status = 'paid', payment_method = 'cinetpay', payment_ref = p_tx,
    deliver_by = now() + make_interval(days => greatest(o.delivery_days, 1)), updated_at = now()
  where id = o.id;
  insert into public.order_events (order_id, status, actor, note)
  values (o.id, 'paid', 'admin', trim(both ' ·' from 'Paiement confirmé par CinetPay · ' || coalesce(p_method, '')));
end $$;
revoke all on function public.order_gateway_paid(uuid, text, numeric, text) from public, anon, authenticated;

-- ---------- Contacts suivis (WhatsApp / appel) ----------
create table if not exists public.contact_clicks (
  id bigint generated always as identity primary key,
  vitrine_id uuid not null references public.vitrines(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  channel text not null check (channel in ('whatsapp','call')),
  created_at timestamptz not null default now()
);
create index if not exists contact_clicks_vitrine_idx on public.contact_clicks(vitrine_id, created_at);
alter table public.contact_clicks enable row level security;
drop policy if exists "contacts: vendeur" on public.contact_clicks;
create policy "contacts: vendeur" on public.contact_clicks for select using (
  public.is_admin() or exists (select 1 from public.vitrines v where v.id = vitrine_id and v.owner_id = auth.uid()));

create or replace function public.log_contact(p_vitrine_id uuid, p_channel text, p_item_id uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into public.contact_clicks (vitrine_id, item_id, channel)
  select p_vitrine_id, p_item_id, p_channel where p_channel in ('whatsapp','call')
    and exists (select 1 from public.vitrines where id = p_vitrine_id and status = 'active');
$$;
grant execute on function public.log_contact(uuid, text, uuid) to anon, authenticated;

-- ---------- Avis vérifiés : seulement après une commande terminée ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  vitrine_id uuid not null references public.vitrines(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  buyer_name text not null,
  item_title text not null,
  rating int not null check (rating between 1 and 5),
  comment text default '',
  created_at timestamptz not null default now()
);
create index if not exists reviews_vitrine_idx on public.reviews(vitrine_id, created_at desc);
alter table public.reviews enable row level security;
drop policy if exists "avis: lecture" on public.reviews;
create policy "avis: lecture" on public.reviews for select using (true);
drop policy if exists "avis: admin" on public.reviews;
create policy "avis: admin" on public.reviews for delete using (public.is_admin());

create or replace function public.create_review(p_order_id uuid, p_rating int, p_comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  if not found or o.buyer_id <> auth.uid() then raise exception 'Commande introuvable'; end if;
  if o.status <> 'completed' then raise exception 'Vous pourrez noter le vendeur une fois la commande terminée'; end if;
  insert into public.reviews (order_id, vitrine_id, buyer_id, buyer_name, item_title, rating, comment)
  values (o.id, o.vitrine_id, o.buyer_id, split_part(o.buyer_name, ' ', 1), o.item_title, p_rating, coalesce(p_comment, ''));
  perform set_config('linkapp.system', '1', true);
  update public.vitrines set
    rating_count = (select count(*) from public.reviews where vitrine_id = o.vitrine_id),
    rating_avg = (select round(avg(rating)::numeric, 1) from public.reviews where vitrine_id = o.vitrine_id)
  where id = o.vitrine_id;
  perform set_config('linkapp.system', '', true);
exception when unique_violation then raise exception 'Vous avez déjà noté cette commande';
end $$;
grant execute on function public.create_review(uuid, int, text) to authenticated;

-- ---------- Correction : le compteur de visites était bloqué par la protection des champs ----------
create or replace function public.increment_views(vid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('linkapp.system', '1', true);
  update public.vitrines set views = views + 1 where id = vid and status = 'active';
  perform set_config('linkapp.system', '', true);
end $$;
