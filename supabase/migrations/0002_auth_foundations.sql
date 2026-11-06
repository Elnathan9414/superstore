-- =====================================================================
-- 0002: Auth foundations (stage 1)
-- Run in the Supabase SQL Editor AFTER supabase/schema.sql.
--
-- - profiles.email (for the user management screen; auth.users is not
--   readable from the client)
-- - profiles.is_active (deactivated users lose all data access)
-- - new accounts are inactive unless created by the owner through the app
--   (role passed in app_metadata, which only the service role can set)
-- - the last active owner cannot be demoted, deactivated or deleted
-- - authenticated users may only update full_name, role and is_active
-- =====================================================================

-- ---------- New columns ----------
alter table profiles add column if not exists email text;
-- Existing rows stay active; new rows are inactive unless set explicitly.
alter table profiles add column if not exists is_active boolean not null default true;
alter table profiles alter column is_active set default false;

update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ---------- Profile creation on sign-up ----------
-- Role comes from raw_app_meta_data (server-controlled), never from
-- raw_user_meta_data (user-controlled). Users without an app-assigned role
-- (e.g. a public sign-up) are created inactive and get no data access.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  assigned_role user_role;
begin
  begin
    assigned_role := (new.raw_app_meta_data->>'role')::user_role;
  exception when invalid_text_representation then
    assigned_role := null;
  end;

  insert into profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email),
    new.email,
    coalesce(assigned_role, 'seller'),
    assigned_role is not null
  );
  return new;
end;
$$;

-- Keep profiles.email in sync when the auth email changes
create or replace function sync_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function sync_profile_email();

-- ---------- Role helpers: inactive users have no role ----------
create or replace function current_user_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active)
$$;

-- ---------- Never lose the last active owner ----------
create or replace function protect_last_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active)
     and not exists (
       select 1 from profiles
       where role = 'owner' and is_active and id <> old.id
     )
  then
    raise exception 'Impossible : il doit rester au moins un propriétaire actif.'
      using errcode = 'P0001', hint = 'last_owner';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_last_owner on profiles;
create trigger profiles_protect_last_owner
  before update or delete on profiles
  for each row execute function protect_last_owner();

-- ---------- Column-level write restrictions ----------
-- RLS ("owner updates profiles") decides WHO can update; these grants decide
-- WHICH columns: id, email and created_at are never writable from the API.
revoke insert, update, delete on profiles from anon, authenticated;
grant update (full_name, role, is_active) on profiles to authenticated;

-- ---------- Read policies ----------
-- Every signed-in user can read their own profile, even when inactive, so the
-- app can explain why access is denied. Active staff can already read all
-- profiles through "staff read profiles".
drop policy if exists "users read own profile" on profiles;
create policy "users read own profile" on profiles
  for select to authenticated using (id = auth.uid());

-- =====================================================================
-- Bootstrap (run once, after creating your first account in the
-- Supabase dashboard: Authentication > Users > Add user):
--   update profiles set role = 'owner', is_active = true
--   where email = 'you@example.com';
--
-- Then disable public sign-ups:
--   Authentication > Sign In / Providers > "Allow new users to sign up" = off
-- =====================================================================
