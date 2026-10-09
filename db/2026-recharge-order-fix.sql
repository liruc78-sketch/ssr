-- ============================================================================
-- Crypto.ssr — create_recharge_order fixes (supersedes the definition in 2026-rls.sql)
-- APPLIED 2026-10-08 to project `wovplubneljhoaliqkmk` as migrations
-- `fix_create_recharge_order_round` and `fix_recharge_unique_suffix_scale`.
--
-- 1) Every deposit failed with "function round(double precision, integer) does not
--    exist": random() is double precision, so the unique-amount expression was too.
--    Now numeric throughout.
-- 2) The unique suffix (which only changes what the user SENDS, never what is
--    credited) used `amount < 1 ? 0.01 : 1`, so a 0.0005 BTC deposit asked for up to
--    ~0.0105 BTC. Restored the legacy intent: 1..998 steps of a per-coin unit, about
--    $1 or less, rounded to the coin's precision.
-- ============================================================================
create or replace function public.create_recharge_order(p_coin_id text, p_coin_symbol text, p_network text, p_network_label text, p_crypto_amount numeric, p_usd_amount numeric)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare uid uuid; addr text; uniq numeric; oid uuid; step numeric; dp int;
begin
  uid := public.current_app_user_id();
  if uid is null then return json_build_object('ok', false, 'error', 'Please sign in'); end if;
  if p_crypto_amount is null or p_crypto_amount <= 0 then return json_build_object('ok', false, 'error', 'Enter an amount'); end if;
  select address into addr from public.payment_addresses where coin_id = p_coin_id and network = p_network limit 1;
  if addr is null then return json_build_object('ok', false, 'error', 'No receiving address is configured for this coin/network yet. Please contact support.'); end if;
  -- collision-avoidance suffix on the transfer amount, computed server-side (numeric throughout)
  step := case p_coin_id
            when 'btc' then 0.00000001      -- 1 sat   -> max 0.00000998 BTC
            when 'eth' then 0.000001        --         -> max 0.000998 ETH
            when 'bnb' then 0.000001        --         -> max 0.000998 BNB
            else case when p_crypto_amount < 1 then 0.00001 else 0.001 end   -- USDT/USDC/XRP/TRX -> max 0.998
          end;
  dp := case p_coin_id when 'btc' then 8 else 6 end;
  uniq := round(p_crypto_amount + (floor(random() * 998) + 1)::numeric * step, dp);
  insert into public.recharge_orders(user_id, usdt_amount, usd_amount, points_amount, status, coin_id, coin_symbol, network, network_label, wallet_address)
    values (uid, uniq, p_usd_amount, p_usd_amount, 'pending', p_coin_id, p_coin_symbol, p_network, p_network_label, addr)
    returning id into oid;
  return json_build_object('ok', true, 'orderId', oid, 'address', addr, 'uniqueAmt', uniq);
end; $function$;
