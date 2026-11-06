-- =====================================================================
-- Verification of 0003_products_stock.sql
-- Run in the Supabase SQL Editor. Everything runs in a transaction that is
-- ROLLED BACK at the end: no data is left behind.
-- Needs at least one active owner and one active seller in profiles.
-- Each check prints "OK: ..." or stops with "FAILED: ...".
-- =====================================================================
begin;

create temporary table _ctx on commit drop as
select
  (select id from profiles where role = 'owner' and is_active limit 1) as owner_id,
  (select id from profiles where role = 'seller' and is_active limit 1) as seller_id;
grant select on _ctx to authenticated;

do $$
begin
  if (select owner_id from _ctx) is null or (select seller_id from _ctx) is null then
    raise exception 'FAILED: need an active owner and an active seller to run these checks';
  end if;
end $$;

-- ---------- Act as the owner ----------
select set_config('request.jwt.claims',
  json_build_object('sub', (select owner_id from _ctx), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  v_plain bigint;
  v_phone bigint;
  v_stock integer;
  v_ids bigint[];
begin
  -- Products with cost
  v_plain := save_product(null, 'TEST-CABLE', null, 'Câble test', null, null, null, 'new',
                          2000, 1200, false, 0, 5);
  v_phone := save_product(null, 'TEST-PHONE', null, 'Téléphone test', null, null, null, 'new',
                          150000, 120000, true, 12, 1);
  raise notice 'OK: products created with save_product';

  -- Entries and adjustments
  perform stock_entry(v_plain, 10, '{}', 'test');
  perform stock_adjustment(v_plain, -3, 'casse test');
  select stock into v_stock from product_overview where id = v_plain;
  if v_stock <> 7 then raise exception 'FAILED: expected stock 7, got %', v_stock; end if;
  if v_stock <> (select sum(quantity) from stock_movements where product_id = v_plain) then
    raise exception 'FAILED: stock differs from the sum of movements';
  end if;
  raise notice 'OK: stock = sum of movements (7)';

  -- Negative stock refused
  begin
    perform stock_adjustment(v_plain, -8, 'trop');
    raise exception 'FAILED: negative stock was accepted';
  exception when others then
    if sqlerrm <> 'negative_stock' then raise; end if;
    raise notice 'OK: negative stock refused';
  end;

  -- Serial-tracked product: count must match
  begin
    perform stock_entry(v_phone, 2, array['IMEI-TEST-1'], null);
    raise exception 'FAILED: serial count mismatch accepted';
  exception when others then
    if sqlerrm <> 'serial_count_mismatch' then raise; end if;
    raise notice 'OK: serial count mismatch refused';
  end;

  -- Duplicates refused
  begin
    perform stock_entry(v_phone, 2, array['IMEI-TEST-1', ' IMEI-TEST-1 '], null);
    raise exception 'FAILED: duplicate serials accepted';
  exception when others then
    if sqlerrm <> 'serial_duplicate' then raise; end if;
    raise notice 'OK: duplicate serials refused';
  end;

  perform stock_entry(v_phone, 2, array['IMEI-TEST-1', 'IMEI-TEST-2'], null);
  if (select count(*) from serial_units where product_id = v_phone and status = 'in_stock') <> 2 then
    raise exception 'FAILED: serial units not created';
  end if;
  raise notice 'OK: serial entry creates one unit per serial';

  -- Already known serial refused
  begin
    perform stock_entry(v_phone, 1, array['IMEI-TEST-2'], null);
    raise exception 'FAILED: existing serial accepted';
  exception when others then
    if sqlerrm <> 'serial_exists' then raise; end if;
    raise notice 'OK: existing serial refused';
  end;

  -- Write-off one unit
  select array_agg(id) into v_ids from serial_units where serial_number = 'IMEI-TEST-1';
  perform stock_adjustment(v_phone, -1, 'vol test', v_ids, '{}');
  if (select status::text from serial_units where serial_number = 'IMEI-TEST-1') <> 'written_off'
     or (select stock from product_overview where id = v_phone) <> 1 then
    raise exception 'FAILED: write-off did not update serial status and stock';
  end if;
  raise notice 'OK: write-off marks the unit and lowers stock';

  -- Tracking cannot change with stock
  begin
    perform save_product(v_phone, 'TEST-PHONE', null, 'Téléphone test', null, null, null, 'new',
                         150000, 120000, false, 12, 1);
    raise exception 'FAILED: tracking change with stock accepted';
  exception when others then
    if sqlerrm <> 'tracking_change_with_stock' then raise; end if;
    raise notice 'OK: tracking change refused while in stock';
  end;

  -- Direct movement insert is no longer allowed
  begin
    insert into stock_movements (product_id, quantity, type) values (v_plain, 100, 'adjustment');
    raise exception 'FAILED: direct insert into stock_movements accepted';
  exception when insufficient_privilege then
    raise notice 'OK: direct stock_movements insert refused';
  end;

  if (select count(*) from product_costs where product_id in (v_plain, v_phone)) <> 2 then
    raise exception 'FAILED: owner cannot read product_costs';
  end if;
  raise notice 'OK: owner reads purchase prices';
end $$;

-- ---------- Act as the seller ----------
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', (select seller_id from _ctx), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
begin
  if exists (select 1 from product_costs) then
    raise exception 'FAILED: seller can read product_costs';
  end if;
  raise notice 'OK: seller cannot read purchase prices';

  if not exists (select 1 from product_overview where sku = 'TEST-CABLE') then
    raise exception 'FAILED: seller cannot read product_overview';
  end if;
  raise notice 'OK: seller reads products and stock (without costs)';

  begin
    perform stock_entry((select id from products where sku = 'TEST-CABLE'), 1, '{}', null);
    raise exception 'FAILED: seller could record a stock entry';
  exception when insufficient_privilege then
    raise notice 'OK: seller cannot change stock';
  end;
end $$;

rollback;
