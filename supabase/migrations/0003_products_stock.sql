-- =====================================================================
-- 0003: Products and stock (stage 2)
-- Run in the Supabase SQL Editor AFTER 0002_auth_foundations.sql.
--
-- - shop_settings: shop currency (default XAF / FCFA, no decimals)
-- - product_costs: purchase prices moved out of products so that sellers,
--   who can read products, can never read costs (RLS is row-level only)
-- - product_overview: products + category + computed stock, without costs
-- - stock_movement_history: movements with product and author names
-- - stock_entry() / stock_adjustment(): the ONLY way to write stock; they
--   keep stock_movements and serial_units consistent in one transaction and
--   refuse negative stock
-- - save_product(): atomic create/update of a product and its cost
-- =====================================================================

-- ---------- Shop settings (single row) ----------
create table shop_settings (
  id boolean primary key default true check (id),
  shop_name text not null default 'Boutique',
  currency_code text not null default 'XAF' check (currency_code ~ '^[A-Z]{3}$'),
  -- Number of decimals of the smallest currency unit (XAF: 0, EUR: 2).
  -- Changing it once amounts exist would change their meaning.
  currency_decimals smallint not null default 0 check (currency_decimals between 0 and 3),
  updated_at timestamptz not null default now()
);  

insert into shop_settings default values;

alter table shop_settings enable row level security;

create policy "staff read shop_settings" on shop_settings
  for select to authenticated using (is_staff());
create policy "owner updates shop_settings" on shop_settings
  for update to authenticated
  using (current_user_role() = 'owner') with check (current_user_role() = 'owner');

-- ---------- Product costs (managers and owners only) ----------
create table product_costs (
  product_id bigint primary key references products(id) on delete cascade,
  cost_price bigint not null default 0 check (cost_price >= 0),
  updated_at timestamptz not null default now()
);

insert into product_costs (product_id, cost_price)
select id, cost_price from products;

alter table products drop column cost_price;

alter table product_costs enable row level security;

create policy "managers read product_costs" on product_costs
  for select to authenticated using (is_manager_or_owner());
create policy "managers write product_costs" on product_costs
  for all to authenticated
  using (is_manager_or_owner()) with check (is_manager_or_owner());

-- ---------- Serial units: write-off status ----------
-- Used when a tracked unit leaves stock through an adjustment
-- (loss, theft, breakage). Only referenced inside function bodies below,
-- so it is safe to add in the same script.
alter type serial_status add value if not exists 'written_off';

-- ---------- Stock writes go through functions only ----------
-- Direct inserts would let stock and serial numbers drift apart.
drop policy if exists "managers insert movements" on stock_movements;

-- Serial units: managers may only fix a mistyped serial number directly;
-- creation and status changes go through the stock functions.
drop policy if exists "managers write serial_units" on serial_units;
create policy "managers update serial_units" on serial_units
  for update to authenticated
  using (is_manager_or_owner()) with check (is_manager_or_owner());
revoke insert, update, delete on serial_units from anon, authenticated;
grant update (serial_number) on serial_units to authenticated;

-- ---------- Read views (security_invoker: RLS of the caller applies) ----------
create view product_overview
with (security_invoker = true) as
select p.id,
       p.sku,
       p.barcode,
       p.name,
       p.brand,
       p.category_id,
       c.name as category_name,
       p.description,
       p.condition,
       p.sale_price,
       p.tracks_serial,
       p.warranty_months,
       p.min_stock,
       p.is_active,
       p.created_at,
       coalesce(s.stock, 0)::integer as stock,
       coalesce(s.stock, 0) <= p.min_stock as is_low_stock
from products p
left join categories c on c.id = p.category_id
left join (
  select product_id, sum(quantity) as stock
  from stock_movements
  group by product_id
) s on s.product_id = p.id;

create view stock_movement_history
with (security_invoker = true) as
select m.id,
       m.product_id,
       p.name as product_name,
       p.sku as product_sku,
       m.quantity,
       m.type,
       m.reason,
       m.sale_item_id,
       m.purchase_item_id,
       m.created_by,
       pr.full_name as created_by_name,
       m.created_at
from stock_movements m
join products p on p.id = m.product_id
left join profiles pr on pr.id = m.created_by;

create index if not exists stock_movements_created_at_idx on stock_movements (created_at);

-- ---------- Helpers ----------
-- Errors are raised with a machine-readable code as the message
-- (mapped to French text in lib/db-errors.ts).

create or replace function product_stock_of(p_product_id bigint)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(quantity), 0)::integer
  from stock_movements where product_id = p_product_id and is_staff()
$$;

-- Trimmed, non-empty serial numbers; raises on duplicates or already known ones.
create or replace function normalize_new_serials(p_serials text[])
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  v_clean text[];
  v_known text;
begin
  select coalesce(array_agg(s), '{}')
    into v_clean
  from (
    select btrim(x) as s from unnest(coalesce(p_serials, '{}')) as x
  ) t
  where s <> '';

  if cardinality(v_clean) <> (select count(distinct s) from unnest(v_clean) as s) then
    raise exception 'serial_duplicate';
  end if;

  select string_agg(serial_number, ', ')
    into v_known
  from serial_units
  where serial_number = any(v_clean);

  if v_known is not null then
    raise exception 'serial_exists' using detail = v_known;
  end if;

  return v_clean;
end;
$$;

-- ---------- Stock entry (goods received without a purchase order) ----------
create or replace function stock_entry(
  p_product_id bigint,
  p_quantity integer,
  p_serials text[] default '{}',
  p_reason text default null
)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_product products%rowtype;
  v_serials text[];
  v_movement_id bigint;
begin
  if not is_manager_or_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  -- Lock the product so concurrent stock writes are serialized
  select * into v_product from products where id = p_product_id for update;
  if not found then
    raise exception 'product_not_found';
  end if;
  if not v_product.is_active then
    raise exception 'product_inactive';
  end if;

  v_serials := normalize_new_serials(p_serials);
  if v_product.tracks_serial then
    if cardinality(v_serials) <> p_quantity then
      raise exception 'serial_count_mismatch';
    end if;
  elsif cardinality(v_serials) > 0 then
    raise exception 'serials_not_tracked';
  end if;

  insert into stock_movements (product_id, quantity, type, reason, created_by)
  values (p_product_id, p_quantity, 'purchase', nullif(btrim(p_reason), ''), auth.uid())
  returning id into v_movement_id;

  insert into serial_units (product_id, serial_number, status)
  select p_product_id, s, 'in_stock' from unnest(v_serials) as s;

  return v_movement_id;
end;
$$;

-- ---------- Stock adjustment (inventory correction, loss, breakage...) ----------
-- p_delta > 0: units found; tracked products need p_serials (new serials).
-- p_delta < 0: units removed; tracked products need p_serial_ids (units in
--              stock), which are marked 'written_off'.
create or replace function stock_adjustment(
  p_product_id bigint,
  p_delta integer,
  p_reason text,
  p_serial_ids bigint[] default '{}',
  p_serials text[] default '{}'
)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_product products%rowtype;
  v_serials text[];
  v_ids bigint[];
  v_movement_id bigint;
begin
  if not is_manager_or_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_quantity';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'reason_required';
  end if;

  select * into v_product from products where id = p_product_id for update;
  if not found then
    raise exception 'product_not_found';
  end if;

  if product_stock_of(p_product_id) + p_delta < 0 then
    raise exception 'negative_stock';
  end if;

  if v_product.tracks_serial then
    if p_delta > 0 then
      v_serials := normalize_new_serials(p_serials);
      if cardinality(v_serials) <> p_delta then
        raise exception 'serial_count_mismatch';
      end if;
    else
      select coalesce(array_agg(distinct x), '{}') into v_ids
      from unnest(coalesce(p_serial_ids, '{}')) as x;
      if cardinality(v_ids) <> -p_delta
         or cardinality(v_ids) <> cardinality(coalesce(p_serial_ids, '{}')) then
        raise exception 'serial_count_mismatch';
      end if;
      if (select count(*) from serial_units
          where id = any(v_ids) and product_id = p_product_id and status = 'in_stock')
         <> cardinality(v_ids) then
        raise exception 'serial_not_in_stock';
      end if;
    end if;
  elsif cardinality(coalesce(p_serials, '{}')) > 0
     or cardinality(coalesce(p_serial_ids, '{}')) > 0 then
    raise exception 'serials_not_tracked';
  end if;

  insert into stock_movements (product_id, quantity, type, reason, created_by)
  values (p_product_id, p_delta, 'adjustment', btrim(p_reason), auth.uid())
  returning id into v_movement_id;

  if v_product.tracks_serial then
    if p_delta > 0 then
      insert into serial_units (product_id, serial_number, status)
      select p_product_id, s, 'in_stock' from unnest(v_serials) as s;
    else
      update serial_units set status = 'written_off' where id = any(v_ids);
    end if;
  end if;

  return v_movement_id;
end;
$$;

-- ---------- Save product (create or update, with its cost) ----------
-- security invoker: RLS on products and product_costs applies (managers only).
create or replace function save_product(
  p_id bigint,
  p_sku text,
  p_barcode text,
  p_name text,
  p_brand text,
  p_category_id bigint,
  p_description text,
  p_condition product_condition,
  p_sale_price bigint,
  p_cost_price bigint,
  p_tracks_serial boolean,
  p_warranty_months integer,
  p_min_stock integer
)
returns bigint language plpgsql security invoker set search_path = public as $$
declare
  v_id bigint;
  v_old_tracks boolean;
begin
  if not is_manager_or_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_id is null then
    insert into products (
      sku, barcode, name, brand, category_id, description, condition,
      sale_price, tracks_serial, warranty_months, min_stock
    ) values (
      btrim(p_sku), nullif(btrim(p_barcode), ''), btrim(p_name), nullif(btrim(p_brand), ''),
      p_category_id, nullif(btrim(p_description), ''), p_condition,
      p_sale_price, p_tracks_serial, p_warranty_months, p_min_stock
    )
    returning id into v_id;
  else
    select tracks_serial into v_old_tracks from products where id = p_id for update;
    if not found then
      raise exception 'product_not_found';
    end if;
    -- Switching serial tracking with units in stock would desync serials
    if v_old_tracks <> p_tracks_serial and product_stock_of(p_id) <> 0 then
      raise exception 'tracking_change_with_stock';
    end if;

    update products set
      sku = btrim(p_sku),
      barcode = nullif(btrim(p_barcode), ''),
      name = btrim(p_name),
      brand = nullif(btrim(p_brand), ''),
      category_id = p_category_id,
      description = nullif(btrim(p_description), ''),
      condition = p_condition,
      sale_price = p_sale_price,
      tracks_serial = p_tracks_serial,
      warranty_months = p_warranty_months,
      min_stock = p_min_stock
    where id = p_id
    returning id into v_id;
  end if;

  insert into product_costs (product_id, cost_price, updated_at)
  values (v_id, p_cost_price, now())
  on conflict (product_id)
  do update set cost_price = excluded.cost_price, updated_at = now();

  return v_id;
end;
$$;

-- Functions are callable by signed-in users only (each checks the role)
revoke execute on function stock_entry(bigint, integer, text[], text) from public, anon;
revoke execute on function stock_adjustment(bigint, integer, text, bigint[], text[]) from public, anon;
revoke execute on function save_product(bigint, text, text, text, text, bigint, text, product_condition, bigint, bigint, boolean, integer, integer) from public, anon;
revoke execute on function product_stock_of(bigint) from public, anon;
revoke execute on function normalize_new_serials(text[]) from public, anon, authenticated;
grant execute on function stock_entry(bigint, integer, text[], text) to authenticated;
grant execute on function stock_adjustment(bigint, integer, text, bigint[], text[]) to authenticated;
grant execute on function save_product(bigint, text, text, text, text, bigint, text, product_condition, bigint, bigint, boolean, integer, integer) to authenticated;
grant execute on function product_stock_of(bigint) to authenticated;
