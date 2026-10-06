-- ============================================================================
-- Crypto.ssr — Server-side money functions (Phase B of the security hardening)
-- Applied to project wovplubneljhoaliqkmk. All balance changes go through these
-- (identified by auth.uid()), so once RLS blocks direct table writes (Phase C)
-- the client can never move money on its own.
-- ============================================================================

-- Resolve the app users.id for the current Supabase Auth session.
create or replace function public.current_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.users where auth_id = auth.uid() limit 1;
$$;
grant execute on function public.current_app_user_id() to authenticated;

-- Withdrawal: deduct principal + (1% + $2) fee, record a pending request.
create or replace function public.request_withdrawal(p_amount numeric, p_address text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid; bal numeric; fee numeric; total numeric;
begin
  uid := public.current_app_user_id();
  if uid is null then return json_build_object('ok', false, 'error', 'Please sign in'); end if;
  if p_address is null or length(trim(p_address)) = 0 then return json_build_object('ok', false, 'error', 'Enter a withdrawal address'); end if;
  if p_amount is null or p_amount < 10 then return json_build_object('ok', false, 'error', 'Minimum withdrawal is $10'); end if;
  fee := p_amount * 0.01 + 2; total := p_amount + fee;
  select usd_balance into bal from public.portfolios where user_id = uid for update;
  if bal is null then return json_build_object('ok', false, 'error', 'No account balance'); end if;
  if bal < total then return json_build_object('ok', false, 'error', 'Insufficient balance (incl. fees)'); end if;
  update public.portfolios set usd_balance = bal - total where user_id = uid;
  insert into public.withdrawals(user_id, amount, fee, wallet_address, status) values (uid, p_amount, fee, p_address, 'pending');
  return json_build_object('ok', true);
end; $$;
grant execute on function public.request_withdrawal(numeric, text) to authenticated;

-- Finance subscribe: USD-funded, debit balance + record subscription.
create or replace function public.finance_subscribe(p_product_id text, p_product_name text, p_asset text, p_amount numeric, p_daily_rate numeric, p_term_days integer) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid; bal numeric;
begin
  uid := public.current_app_user_id();
  if uid is null then return json_build_object('ok', false, 'error', 'Please sign in'); end if;
  if p_amount is null or p_amount < 100 then return json_build_object('ok', false, 'error', 'Minimum subscription is $100'); end if;
  select usd_balance into bal from public.portfolios where user_id = uid for update;
  if bal is null then return json_build_object('ok', false, 'error', 'No account balance'); end if;
  if bal < p_amount then return json_build_object('ok', false, 'error', 'Insufficient balance'); end if;
  update public.portfolios set usd_balance = bal - p_amount where user_id = uid;
  insert into public.finance_subscriptions(user_id, product_id, product_name, asset, amount, daily_rate, term_days, status)
    values (uid, p_product_id, p_product_name, p_asset, p_amount, p_daily_rate, coalesce(p_term_days,0), 'active');
  return json_build_object('ok', true);
end; $$;
grant execute on function public.finance_subscribe(text, text, text, numeric, numeric, integer) to authenticated;

-- finance_redeem is caller-scoped (see also db/2026-finance.sql). Options open is
-- the trade-open edge function (needs a live price). Deposit order creation moves
-- to a function in Phase C alongside RLS.

-- NOTE: Phase C enables RLS on every table: own-row SELECT via current_app_user_id(),
-- and NO direct INSERT/UPDATE/DELETE for anon/authenticated (writes only via the
-- functions above / edge functions running as service_role).
