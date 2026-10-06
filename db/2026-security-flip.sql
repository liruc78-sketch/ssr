-- ============================================================================
-- Crypto.ssr — Security flip (applied to project wovplubneljhoaliqkmk)
-- Admin access, user provisioning, enabling RLS, and removing the legacy
-- wide-open policies. This is what actually closed the hole.
-- ============================================================================

-- 1) Admin flag + helper (admins are authenticated users with is_admin = true).
alter table public.users add column if not exists is_admin boolean not null default false;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.users where auth_id = auth.uid()), false);
$$;
grant execute on function public.is_admin() to authenticated;

-- Admin full-access policy on every managed table (added for each):
--   create policy <t>_admin on public.<t> for all to authenticated
--     using (public.is_admin()) with check (public.is_admin());

-- 2) Safe self-provisioning (server-side; client can't set a balance).
create or replace function public.provision_me(p_email text, p_display text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from public.users where auth_id = auth.uid();
  if uid is not null then return uid; end if;
  if auth.uid() is null then return null; end if;
  insert into public.users (auth_id, email, display_name, username)
    values (auth.uid(), p_email, coalesce(nullif(p_display,''),'user'), 'u_' || substr(replace(auth.uid()::text,'-',''),1,10))
    returning id into uid;
  insert into public.portfolios (user_id, usd_balance) values (uid, 0);
  return uid;
end; $$;
grant execute on function public.provision_me(text, text) to authenticated;

-- 3) Enable RLS on every table (own-row SELECT + admin + service_role; writes via
--    SECURITY DEFINER functions / edge functions only).
--   alter table public.users/portfolios/positions/withdrawals/recharge_orders/
--     support_messages/support_conversations/payment_addresses/app_settings/
--     site_settings/crypto_addresses/leads enable row level security;

-- 4) CRITICAL — drop the legacy wide-open (public/true) policies that were the
--    actual hole ("permissive RLS everywhere"). After this, the public anon key
--    can read/write NOTHING; members see only their own rows; admins see all.
--   drop policy "Allow all on portfolios" on public.portfolios;  (+ _insert/_select/_update)
--   drop policy "Allow all on positions"  on public.positions;   (+ _insert/_select/_update)
--   drop policy "Allow all on users"      on public.users;        (+ _insert/_select/_update)
--   drop policy withdrawals_insert/_select/_update on public.withdrawals;
--   drop policy admin_all, recharge_orders_own on public.recharge_orders;
--   drop policy admin_all on public.support_messages / support_conversations / payment_addresses;
-- site_settings keeps a public SELECT (non-sensitive config: rate + public receiving address).

-- Verified: anon = 0 rows on users/portfolios/payment_addresses/withdrawals;
-- member = own only; admin = all; member UI shows own balance; admin panel manages all.
