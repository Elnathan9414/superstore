-- =====================================================================
-- Electronics shop management: initial schema (Supabase / PostgreSQL)
-- Run in the Supabase SQL Editor on a NEW project.
-- Money values are integers in the smallest currency unit.
-- =====================================================================

-- ---------- Enums ----------
create type user_role as enum ('owner', 'manager', 'seller');
create type product_condition as enum ('new', 'refurbished', 'used');
create type movement_type as enum ('purchase', 'sale', 'return', 'adjustment');
create type serial_status as enum ('in_stock', 'sold', 'returned', 'defective');
create type payment_method as enum ('cash', 'mobile_money', 'card', 'transfer');
create type sale_status as enum ('completed', 'cancelled');
create type purchase_status as enum ('ordered', 'received', 'cancelled');

-- ---------- Profiles (one per auth user) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'seller',
  created_at timestamptz not null default now()
);

-- Create a profile automatically when a user signs up (default role: seller)
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Role helpers used by RLS policies ----------
create or replace function current_user_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid())
$$;

create or replace function is_manager_or_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_user_role() in ('owner', 'manager'), false)
$$;

-- ---------- Catalog ----------
create table categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table products (
  id bigint generated always as identity primary key,
  sku text not null unique,
  barcode text unique,
  name text not null,
  brand text,
  category_id bigint references categories(id),
  description text,
  condition product_condition not null default 'new',
  attributes jsonb not null default '{}'::jsonb,   -- e.g. color, storage, RAM
  cost_price bigint not null default 0 check (cost_price >= 0),
  sale_price bigint not null default 0 check (sale_price >= 0),
  tracks_serial boolean not null default false,    -- true for phones, laptops, etc.
  warranty_months integer not null default 0 check (warranty_months >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_name_idx on products (name);
create index products_category_idx on products (category_id);

-- ---------- People ----------
create table customers (
  id bigint generated always as identity primary key,
  full_name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table suppliers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Purchases ----------
create table purchases (
  id bigint generated always as identity primary key,
  supplier_id bigint not null references suppliers(id),
  status purchase_status not null default 'ordered',
  total bigint not null default 0 check (total >= 0),
  paid_amount bigint not null default 0 check (paid_amount >= 0),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table purchase_items (
  id bigint generated always as identity primary key,
  purchase_id bigint not null references purchases(id) on delete cascade,
  product_id bigint not null references products(id),
  quantity integer not null check (quantity > 0),
  unit_cost bigint not null check (unit_cost >= 0)
);

-- ---------- Sales ----------
create table sales (
  id bigint generated always as identity primary key,
  customer_id bigint references customers(id),
  seller_id uuid not null references profiles(id) default auth.uid(),
  status sale_status not null default 'completed',
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0),
  total bigint not null check (total >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index sales_created_at_idx on sales (created_at);

create table sale_items (
  id bigint generated always as identity primary key,
  sale_id bigint not null references sales(id) on delete cascade,
  product_id bigint not null references products(id),
  quantity integer not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),  -- price at time of sale
  unit_cost bigint not null check (unit_cost >= 0)     -- cost at time of sale (for margin)
);

create table payments (
  id bigint generated always as identity primary key,
  sale_id bigint not null references sales(id) on delete cascade,
  method payment_method not null,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);

-- ---------- Serial numbers / IMEI ----------
create table serial_units (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id),
  serial_number text not null unique,
  status serial_status not null default 'in_stock',
  purchase_item_id bigint references purchase_items(id),
  sale_item_id bigint references sale_items(id),
  warranty_ends_at date,
  created_at timestamptz not null default now()
);

create index serial_units_product_idx on serial_units (product_id, status);

-- ---------- Stock movements (source of truth for stock) ----------
create table stock_movements (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id),
  quantity integer not null check (quantity <> 0),   -- positive = in, negative = out
  type movement_type not null,
  sale_item_id bigint references sale_items(id),
  purchase_item_id bigint references purchase_items(id),
  reason text,
  created_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index stock_movements_product_idx on stock_movements (product_id);

-- Current stock per product, computed from movements
create view product_stock
with (security_invoker = true) as
select p.id as product_id,
       coalesce(sum(m.quantity), 0)::integer as stock
from products p
left join stock_movements m on m.product_id = p.id
group by p.id;

-- ---------- Triggers: keep stock movements in sync ----------
create or replace function movement_on_sale_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into stock_movements (product_id, quantity, type, sale_item_id, created_by)
  values (new.product_id, -new.quantity, 'sale', new.id, auth.uid());
  return new;
end;
$$;

create trigger sale_item_stock_movement
  after insert on sale_items
  for each row execute function movement_on_sale_item();

create or replace function movement_on_purchase_receive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- When a purchase is marked as received, add its items to stock
  if new.status = 'received' and old.status <> 'received' then
    insert into stock_movements (product_id, quantity, type, purchase_item_id, created_by)
    select pi.product_id, pi.quantity, 'purchase', pi.id, auth.uid()
    from purchase_items pi
    where pi.purchase_id = new.id;
    new.received_at := now();
  end if;
  return new;
end;
$$;

create trigger purchase_receive_stock_movement
  before update on purchases
  for each row execute function movement_on_purchase_receive();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table payments enable row level security;
alter table serial_units enable row level security;
alter table stock_movements enable row level security;

-- Staff can read most tables
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','products','customers','suppliers',
    'sales','sale_items','payments','serial_units','stock_movements'
  ] loop
    execute format('create policy "staff read %1$s" on %1$I for select to authenticated using (is_staff())', t);
  end loop;
end $$;

-- Purchases (contain cost data): managers and owners only
create policy "managers read purchases" on purchases
  for select to authenticated using (is_manager_or_owner());
create policy "managers read purchase_items" on purchase_items
  for select to authenticated using (is_manager_or_owner());

-- Catalog, suppliers, purchases, serial units: managers and owners write
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','suppliers','purchases','purchase_items','serial_units'
  ] loop
    execute format('create policy "managers write %1$s" on %1$I for all to authenticated using (is_manager_or_owner()) with check (is_manager_or_owner())', t);
  end loop;
end $$;

-- Customers: any staff can create/update, managers can delete
create policy "staff insert customers" on customers
  for insert to authenticated with check (is_staff());
create policy "staff update customers" on customers
  for update to authenticated using (is_staff()) with check (is_staff());
create policy "managers delete customers" on customers
  for delete to authenticated using (is_manager_or_owner());

-- Sales: any staff can create; only managers can change or delete
create policy "staff insert sales" on sales
  for insert to authenticated with check (is_staff() and seller_id = auth.uid());
create policy "managers update sales" on sales
  for update to authenticated using (is_manager_or_owner()) with check (is_manager_or_owner());

create policy "staff insert sale_items" on sale_items
  for insert to authenticated with check (is_staff());
create policy "staff insert payments" on payments
  for insert to authenticated with check (is_staff());

-- Stock movements: written by triggers; managers can add manual adjustments
create policy "managers insert movements" on stock_movements
  for insert to authenticated with check (is_manager_or_owner());

-- Profiles: only the owner can change roles
create policy "owner updates profiles" on profiles
  for update to authenticated
  using (current_user_role() = 'owner') with check (current_user_role() = 'owner');

-- =====================================================================
-- After creating your first account, promote it to owner (run once):
--   update profiles set role = 'owner' where id = '<your-auth-user-uuid>';
-- =====================================================================
