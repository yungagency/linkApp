-- =====================================================================
-- LinkApp — LinkApp Assurance optionnelle, délais de livraison, preuves
-- À exécuter APRÈS 0001_init.sql et 0002_orders.sql
-- =====================================================================

-- Délai de livraison promis par le vendeur, par article (en jours)
alter table public.items add column if not exists delivery_days int not null default 2 check (delivery_days between 0 and 60);

-- Commande avec ou sans assurance, date limite, livraison vérifiée par code
alter table public.orders add column if not exists protected boolean not null default true;
alter table public.orders add column if not exists delivery_days int not null default 2;
alter table public.orders add column if not exists deliver_by timestamptz;
alter table public.orders add column if not exists delivery_verified boolean not null default false;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in
  ('placed','pending_payment','payment_submitted','paid','preparing','shipped','delivered','completed','dispute','refunded','cancelled'));

-- Photos jointes à chaque étape (preuve de livraison, preuves de litige)
alter table public.order_events add column if not exists attachments text[] not null default '{}';

-- Code de réception : lisible par le CLIENT seulement (le vendeur ne peut pas le voir)
create table if not exists public.order_secrets (
  order_id uuid primary key references public.orders(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  delivery_code text not null
);
alter table public.order_secrets enable row level security;
drop policy if exists "code: client" on public.order_secrets;
create policy "code: client" on public.order_secrets for select using (buyer_id = auth.uid());

-- ---------- Création (remplace la version de 0002) ----------
drop function if exists public.create_order(uuid, int, text, text, text, text);
create or replace function public.create_order(
  p_item_id uuid, p_quantity int, p_buyer_name text, p_buyer_phone text, p_address text,
  p_note text default '', p_protected boolean default true
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
  -- Commission seulement avec l'assurance (sans assurance, l'argent ne passe pas par LinkApp)
  if p_protected then
    select coalesce(value::numeric, 0.05) into rate from public.settings where key = 'commission_rate';
  else rate := 0; end if;
  sub := it.price * p_quantity;
  insert into public.orders (code, buyer_id, vitrine_id, item_id, item_title, item_image, unit, unit_price, quantity,
    subtotal, commission_rate, commission, seller_amount, buyer_name, buyer_phone, address, note,
    protected, status, delivery_days, deliver_by)
  values ('LK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), auth.uid(), v.id, it.id, it.title,
    it.image_url, it.unit, it.price, p_quantity, sub, coalesce(rate, 0.05), round(sub * coalesce(rate, 0.05)),
    sub - round(sub * coalesce(rate, 0.05)), p_buyer_name, p_buyer_phone, p_address, coalesce(p_note, ''),
    p_protected, case when p_protected then 'pending_payment' else 'placed' end, it.delivery_days,
    case when p_protected then null else now() + make_interval(days => greatest(it.delivery_days, 1)) end)
  returning * into o;
  insert into public.order_secrets (order_id, buyer_id, delivery_code)
  values (o.id, auth.uid(), lpad((floor(random() * 10000))::int::text, 4, '0'));
  insert into public.order_events (order_id, status, actor, note)
  values (o.id, o.status, 'buyer', case when p_protected then 'Commande passée avec LinkApp Assurance' else 'Commande passée sans assurance' end);
  return o;
end $$;

-- ---------- Changement de statut (remplace la version de 0002) ----------
drop function if exists public.order_transition(uuid, text, text, text, text, text);
create or replace function public.order_transition(
  p_order_id uuid, p_to text, p_note text default '', p_payment_method text default null,
  p_payment_ref text default null, p_dispute_reason text default null,
  p_attachments text[] default '{}', p_code text default null
) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; actor text; ok boolean := false; seller uuid; secret text; verified boolean := false;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable'; end if;
  select owner_id into seller from public.vitrines where id = o.vitrine_id;
  if public.is_admin() then actor := 'admin';
  elsif auth.uid() = seller then actor := 'seller';
  elsif auth.uid() = o.buyer_id then actor := 'buyer';
  else raise exception 'Action non autorisée'; end if;

  -- Mêmes règles que src/lib/orders.ts
  if o.protected then
    ok := case o.status
      when 'pending_payment'   then (p_to = 'payment_submitted' and actor = 'buyer') or (p_to = 'cancelled') or (p_to = 'paid' and actor = 'admin')
      when 'payment_submitted' then actor = 'admin' and p_to in ('paid','pending_payment','cancelled')
      when 'paid'              then (p_to = 'preparing' and actor = 'seller') or (p_to = 'refunded' and actor = 'admin') or (p_to = 'dispute' and actor = 'buyer')
      when 'preparing'         then (p_to = 'shipped' and actor = 'seller') or (p_to = 'refunded' and actor = 'admin') or (p_to = 'dispute' and actor = 'buyer')
      when 'shipped'           then (p_to = 'delivered' and actor = 'seller') or (p_to in ('completed','dispute') and actor = 'buyer')
      when 'delivered'         then (p_to = 'completed' and actor in ('buyer','admin')) or (p_to = 'dispute' and actor = 'buyer')
      when 'dispute'           then actor = 'admin' and p_to in ('completed','refunded')
      else false end;
  else
    ok := case o.status
      when 'placed'    then (p_to = 'preparing' and actor = 'seller') or p_to = 'cancelled'
      when 'preparing' then (p_to = 'shipped' and actor = 'seller') or p_to = 'cancelled'
      when 'shipped'   then (p_to = 'delivered' and actor = 'seller') or (p_to = 'completed' and actor = 'buyer') or (p_to = 'cancelled' and actor = 'admin')
      when 'delivered' then p_to = 'completed' and actor in ('buyer','admin')
      else false end;
  end if;
  if not ok then raise exception 'Étape non autorisée (% → %)', o.status, p_to; end if;

  if p_to = 'payment_submitted' and coalesce(trim(p_payment_ref), '') = '' then
    raise exception 'Indiquez la référence de la transaction Mobile Money';
  end if;
  if p_to = 'dispute' and coalesce(trim(p_dispute_reason), '') = '' then
    raise exception 'Décrivez le problème';
  end if;
  -- Preuve de livraison : code de réception OU au moins une photo (obligatoire avec l'assurance)
  if p_to = 'delivered' then
    select delivery_code into secret from public.order_secrets where order_id = o.id;
    if coalesce(p_code, '') <> '' then
      if p_code <> secret then raise exception 'Code de réception incorrect'; end if;
      verified := true;
    elsif o.protected and coalesce(array_length(p_attachments, 1), 0) = 0 then
      raise exception 'Ajoutez le code de réception du client ou une photo de la remise';
    end if;
  end if;

  update public.orders set
    status = p_to,
    payment_method = coalesce(p_payment_method, payment_method),
    payment_ref = coalesce(p_payment_ref, payment_ref),
    dispute_reason = case when p_to = 'dispute' then p_dispute_reason else dispute_reason end,
    delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
    delivery_verified = case when p_to = 'delivered' then verified else delivery_verified end,
    deliver_by = case when p_to = 'paid' then now() + make_interval(days => greatest(o.delivery_days, 1)) else deliver_by end,
    payout_status = case when p_to = 'completed' and o.protected then 'pending' else payout_status end,
    updated_at = now()
  where id = o.id;
  insert into public.order_events (order_id, status, actor, note, attachments)
  values (o.id, p_to, actor,
    case when p_to = 'delivered' and verified then trim(both ' ·' from 'Code de réception vérifié · ' || coalesce(p_note, ''))
         else coalesce(nullif(p_note, ''), coalesce(p_dispute_reason, '')) end,
    coalesce(p_attachments, '{}'));
end $$;

-- ---------- Preuves pendant un litige ----------
create or replace function public.order_add_evidence(p_order_id uuid, p_note text, p_attachments text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; actor text; seller uuid;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then raise exception 'Commande introuvable'; end if;
  if o.status <> 'dispute' then raise exception 'Les preuves se déposent pendant un litige'; end if;
  select owner_id into seller from public.vitrines where id = o.vitrine_id;
  if public.is_admin() then actor := 'admin';
  elsif auth.uid() = seller then actor := 'seller';
  elsif auth.uid() = o.buyer_id then actor := 'buyer';
  else raise exception 'Action non autorisée'; end if;
  if coalesce(trim(p_note), '') = '' and coalesce(array_length(p_attachments, 1), 0) = 0 then
    raise exception 'Ajoutez un message ou une photo';
  end if;
  insert into public.order_events (order_id, status, actor, note, attachments)
  values (o.id, 'dispute', actor, coalesce(p_note, ''), coalesce(p_attachments, '{}'));
end $$;

grant execute on function public.create_order(uuid, int, text, text, text, text, boolean) to authenticated;
grant execute on function public.order_transition(uuid, text, text, text, text, text, text[], text) to authenticated;
grant execute on function public.order_add_evidence(uuid, text, text[]) to authenticated;
