-- ============================================================================
-- Crypto.ssr — RLS policies + deposit RPC (Phase C prep of the security hardening)
-- Applied to project wovplubneljhoaliqkmk. Policies are INERT until RLS is enabled
-- on each table (the coordinated flip). Only finance_subscriptions has RLS enabled
-- so far, to validate the pattern (anon sees 0 rows; a signed-in user sees only
-- their own). Writes stay server-side (functions run as service_role, bypass RLS).
-- ============================================================================

-- Deposit order creation server-side (hides payment_addresses from clients).
create or replace function public.create_recharge_order(
  p_coin_id text, p_coin_symbol text, p_network text, p_network_label text,
  p_crypto_amount numeric, p_usd_amount numeric
) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid; addr text; uniq numeric; oid uuid;
begin
  uid := public.current_app_user_id();
  if uid is null then return json_build_object('ok', false, 'error', 'Please sign in'); end if;
  if p_crypto_amount is null or p_crypto_amount <= 0 then return json_build_object('ok', false, 'error', 'Enter an amount'); end if;
  select address into addr from public.payment_addresses where coin_id = p_coin_id and network = p_network limit 1;
  if addr is null then return json_build_object('ok', false, 'error', 'No receiving address is configured for this coin/network yet. Please contact support.'); end if;
  uniq := round(p_crypto_amount + ((floor(random()*998)+1)/1000.0) * (case when p_crypto_amount < 1 then 0.01 else 1 end), 6);
  insert into public.recharge_orders(user_id, usdt_amount, usd_amount, points_amount, status, coin_id, coin_symbol, network, network_label, wallet_address)
    values (uid, uniq, p_usd_amount, p_usd_amount, 'pending', p_coin_id, p_coin_symbol, p_network, p_network_label, addr)
    returning id into oid;
  return json_build_object('ok', true, 'orderId', oid, 'address', addr, 'uniqueAmt', uniq);
end; $$;
grant execute on function public.create_recharge_order(text, text, text, text, numeric, numeric) to authenticated;

-- Own-row SELECT policies (+ support insert/update). Inert until RLS is enabled.
create policy users_select_own on public.users for select to authenticated using (auth_id = auth.uid());
create policy portfolios_select_own on public.portfolios for select to authenticated using (user_id = public.current_app_user_id());
create policy positions_select_own on public.positions for select to authenticated using (user_id = public.current_app_user_id());
create policy withdrawals_select_own on public.withdrawals for select to authenticated using (user_id = public.current_app_user_id());
create policy recharge_orders_select_own on public.recharge_orders for select to authenticated using (user_id = public.current_app_user_id());
create policy finance_subscriptions_select_own on public.finance_subscriptions for select to authenticated using (user_id = public.current_app_user_id());
create policy support_messages_select_own on public.support_messages for select to authenticated using (user_id = public.current_app_user_id());
create policy support_messages_insert_own on public.support_messages for insert to authenticated with check (user_id = public.current_app_user_id() and sender = 'user');
create policy support_conversations_select_own on public.support_conversations for select to authenticated using (user_id = public.current_app_user_id());
create policy support_conversations_update_own on public.support_conversations for update to authenticated using (user_id = public.current_app_user_id());

-- Validated so far:
alter table public.finance_subscriptions enable row level security;

-- THE FLIP (run at coordinated cutover, after the admin panel uses service_role):
--   alter table public.users             enable row level security;
--   alter table public.portfolios        enable row level security;
--   alter table public.positions         enable row level security;
--   alter table public.withdrawals       enable row level security;
--   alter table public.recharge_orders   enable row level security;
--   alter table public.support_messages  enable row level security;
--   alter table public.support_conversations enable row level security;
--   alter table public.payment_addresses enable row level security;  -- no policy => locked (RPC only)
--   alter table public.app_settings      enable row level security;  -- admin/service_role only
--   alter table public.site_settings     enable row level security;
--   alter table public.crypto_addresses  enable row level security;
--   alter table public.leads             enable row level security;
