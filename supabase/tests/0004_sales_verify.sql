-- =====================================================================
-- Verification of 0004_sales.sql
-- Run in the Supabase SQL Editor. Everything runs in a transaction that is
-- ROLLED BACK at the end: no data is left behind.
-- Needs one active owner and one active seller. Prints "OK: ..." lines or
-- stops with "FAILED: ...".
-- =====================================================================
begin;

create temporary table _ctx (
  owner_id uuid, seller_id uuid,
  cable bigint, phone bigint, customer bigint, imei1 bigint, imei2 bigint
) on commit drop;
insert into _ctx (owner_id, seller_id)
select (select id from profiles where role = 'owner' and is_active limit 1),
       (select id from profiles where role = 'seller' and is_active limit 1);
grant select, update on _ctx to authenticated;

do $$
begin
  if (select owner_id from _ctx) is null or (select seller_id from _ctx) is null then
    raise exception 'FAILED: need an active owner and an active seller';
  end if;
end $$;

-- Force a 10 % seller discount cap for the checks (rolled back at the end)
update shop_settings set seller_max_discount_percent = 10;

-- ---------- Owner: set up products, stock and a customer ----------
select set_config('request.jwt.claims',
  json_build_object('sub', (select owner_id from _ctx), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare v_cable bigint; v_phone bigint;
begin
  v_cable := save_product(null, 'TEST-CABLE-V', null, 'Câble test', null, null, null, 'new',
                          2500, 1000, false, 0, 0);
  v_phone := save_product(null, 'TEST-PHONE-V', null, 'Téléphone test', null, null, null, 'new',
                          150000, 120000, true, 12, 0);
  perform stock_entry(v_cable, 5, '{}', 'test');
  perform stock_entry(v_phone, 2, array['IMEI-V-1', 'IMEI-V-2'], 'test');
  update _ctx set cable = v_cable, phone = v_phone,
    imei1 = (select id from serial_units where serial_number = 'IMEI-V-1'),
    imei2 = (select id from serial_units where serial_number = 'IMEI-V-2');
  insert into customers (full_name, phone) values ('Client test', '600000000');
  update _ctx set customer = (select max(id) from customers where full_name = 'Client test');
end $$;

-- ---------- Seller: sales ----------
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', (select seller_id from _ctx), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  c _ctx%rowtype;
  v_sale bigint;
  v_again bigint;
  v_ref uuid := gen_random_uuid();
begin
  select * into c from _ctx;

  -- 2 cables + 1 phone, 5 % discount, paid in two parts
  v_sale := create_sale(
    v_ref, null,
    jsonb_build_array(
      jsonb_build_object('product_id', c.cable, 'quantity', 2, 'serial_ids', '[]'::jsonb),
      jsonb_build_object('product_id', c.phone, 'quantity', 1, 'serial_ids', jsonb_build_array(c.imei1))
    ),
    'percent', 5,
    jsonb_build_array(
      jsonb_build_object('method', 'cash', 'amount', 100000),
      jsonb_build_object('method', 'mobile_money', 'amount', 47250, 'reference', 'MM123')
    ),
    147250, null);

  -- subtotal 155 000, 5 % = 7 750, total 147 250
  if (select subtotal from sales where id = v_sale) <> 155000
     or (select discount from sales where id = v_sale) <> 7750
     or (select total from sales where id = v_sale) <> 147250 then
    raise exception 'FAILED: wrong totals';
  end if;
  if (select balance from sale_overview where id = v_sale) <> 0 then
    raise exception 'FAILED: sale should be fully paid';
  end if;
  raise notice 'OK: totals, discount and split payment';

  if (select stock from product_overview where id = c.cable) <> 3
     or (select stock from product_overview where id = c.phone) <> 1 then
    raise exception 'FAILED: stock not decremented';
  end if;
  raise notice 'OK: stock decremented';

  if (select status::text from serial_units where id = c.imei1) <> 'sold'
     or (select warranty_ends_at from serial_units where id = c.imei1) is null then
    raise exception 'FAILED: IMEI not marked sold with warranty';
  end if;
  raise notice 'OK: IMEI sold with warranty end date';

  -- Same client_ref: no duplicate
  v_again := create_sale(v_ref, null, '[]'::jsonb, null, 0, '[]'::jsonb, null, null);
  if v_again <> v_sale or (select count(*) from sales where client_ref = v_ref) <> 1 then
    raise exception 'FAILED: duplicate submit created a second sale';
  end if;
  raise notice 'OK: double submit returns the same sale';

  -- Sold IMEI cannot be sold again
  begin
    perform create_sale(gen_random_uuid(), null,
      jsonb_build_array(jsonb_build_object('product_id', c.phone, 'quantity', 1, 'serial_ids', jsonb_build_array(c.imei1))),
      null, 0, jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 150000)), null, null);
    raise exception 'FAILED: sold IMEI sold again';
  exception when others then
    if sqlerrm <> 'serial_not_in_stock' then raise; end if;
    raise notice 'OK: sold IMEI cannot be sold again';
  end;

  -- Not enough stock
  begin
    perform create_sale(gen_random_uuid(), null,
      jsonb_build_array(jsonb_build_object('product_id', c.cable, 'quantity', 4, 'serial_ids', '[]'::jsonb)),
      null, 0, jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 10000)), null, null);
    raise exception 'FAILED: sale above stock accepted';
  exception when others then
    if sqlerrm <> 'insufficient_stock' then raise; end if;
    raise notice 'OK: insufficient stock refused';
  end;

  -- Seller discount above cap (11 % > 10 %)
  begin
    perform create_sale(gen_random_uuid(), null,
      jsonb_build_array(jsonb_build_object('product_id', c.cable, 'quantity', 1, 'serial_ids', '[]'::jsonb)),
      'percent', 11, '[]'::jsonb, null, null);
    raise exception 'FAILED: discount above cap accepted';
  exception when others then
    if sqlerrm <> 'discount_too_high' then raise; end if;
    raise notice 'OK: seller discount cap enforced';
  end;

  -- Overpayment
  begin
    perform create_sale(gen_random_uuid(), null,
      jsonb_build_array(jsonb_build_object('product_id', c.cable, 'quantity', 1, 'serial_ids', '[]'::jsonb)),
      null, 0, jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 3000)), null, null);
    raise exception 'FAILED: overpayment accepted';
  exception when others then
    if sqlerrm <> 'overpayment' then raise; end if;
    raise notice 'OK: overpayment refused';
  end;

  -- Credit without customer
  begin
    perform create_sale(gen_random_uuid(), null,
      jsonb_build_array(jsonb_build_object('product_id', c.cable, 'quantity', 1, 'serial_ids', '[]'::jsonb)),
      null, 0, jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 1000)), null, null);
    raise exception 'FAILED: credit without customer accepted';
  exception when others then
    if sqlerrm <> 'customer_required' then raise; end if;
    raise notice 'OK: credit requires a customer';
  end;

  -- Credit with customer
  v_sale := create_sale(gen_random_uuid(), c.customer,
    jsonb_build_array(jsonb_build_object('product_id', c.cable, 'quantity', 1, 'serial_ids', '[]'::jsonb)),
    null, 0, jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 1000)), null, null);
  if (select balance from sale_overview where id = v_sale) <> 1500 then
    raise exception 'FAILED: credit balance should be 1500';
  end if;
  raise notice 'OK: partial payment recorded as customer credit';

  -- Price changed since the till loaded
  begin
    perform create_sale(gen_random_uuid(), null,
      jsonb_build_array(jsonb_build_object('product_id', c.cable, 'quantity', 1, 'serial_ids', '[]'::jsonb)),
      null, 0, jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 2000)), 2000, null);
    raise exception 'FAILED: total mismatch accepted';
  exception when others then
    if sqlerrm <> 'total_mismatch' then raise; end if;
    raise notice 'OK: total mismatch refused';
  end;

  -- Sellers cannot write sales directly, read costs, or cancel
  begin
    insert into sales (seller_id, subtotal, total) values (auth.uid(), 0, 0);
    raise exception 'FAILED: direct insert into sales accepted';
  exception when insufficient_privilege then
    raise notice 'OK: direct sales insert refused';
  end;
  if exists (select 1 from sale_item_costs) then
    raise exception 'FAILED: seller can read sale_item_costs';
  end if;
  raise notice 'OK: seller cannot read sale costs';
  begin
    perform cancel_sale(v_sale, 'test');
    raise exception 'FAILED: seller cancelled a sale';
  exception when insufficient_privilege then
    raise notice 'OK: seller cannot cancel';
  end;
end $$;

-- ---------- Owner: cancel the first sale ----------
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', (select owner_id from _ctx), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare c _ctx%rowtype; v_sale bigint;
begin
  select * into c from _ctx;
  select s.id into v_sale from sales s
  join sale_items si on si.sale_id = s.id
  where si.product_id = c.phone order by s.id limit 1;

  if (select unit_cost from sale_item_costs sic join sale_items si on si.id = sic.sale_item_id
      where si.sale_id = v_sale and si.product_id = c.phone) <> 120000 then
    raise exception 'FAILED: unit cost at time of sale not recorded';
  end if;
  raise notice 'OK: owner reads cost at time of sale';

  perform cancel_sale(v_sale, 'Erreur de caisse');
  if (select status::text from sales where id = v_sale) <> 'cancelled'
     or (select stock from product_overview where id = c.phone) <> 2
     or (select status::text from serial_units where id = c.imei1) <> 'in_stock' then
    raise exception 'FAILED: cancellation did not restore stock and IMEI';
  end if;
  raise notice 'OK: cancellation restores stock and IMEI';

  begin
    perform cancel_sale(v_sale, 'encore');
    raise exception 'FAILED: double cancellation accepted';
  exception when others then
    if sqlerrm <> 'already_cancelled' then raise; end if;
    raise notice 'OK: double cancellation refused';
  end;
end $$;

rollback;
