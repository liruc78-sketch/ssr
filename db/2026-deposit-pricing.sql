-- ============================================================================
-- Crypto.ssr — server-side deposit pricing + listed-coin whitelist
-- (supersedes create_recharge_order in 2026-recharge-order-fix.sql)
-- APPLIED 2026-10-09 to project `wovplubneljhoaliqkmk` as migrations
-- `server_side_deposit_pricing` and `purge_old_cron_history_daily`.
--
-- Before: create_recharge_order stored the browser-computed USD credit
-- (p_usd_amount) and accepted any coin_id/network that had an address row.
-- Now:
--   * public.deposit_assets is the whitelist (enabled rows only) and holds the
--     per-asset rules: symbol, network label, minimum, suffix step, decimals,
--     price source. BNB is present but disabled.
--   * The USD credit = amount × server price (stablecoins fixed at 1; others from
--     CoinGecko via the http extension, fetched only when an order is placed,
--     cached 2 min, a cache up to 30 min old is used if CoinGecko is down).
--   * p_coin_symbol / p_network_label / p_usd_amount are ignored (kept in the
--     signature so older clients keep working). The rate is stored in
--     recharge_orders.usd_rate for the admin.
--   * Failures return { ok:false, code, error } — code ∈ auth | not_listed |
--     bad_amount | below_min (+min, symbol) | no_address | price_unavailable.
-- To list / delist a coin: insert into or update deposit_assets (enabled), add
-- its receiving address in the admin panel, and add it to js/wallet.js DEPOSIT_COINS.
-- ============================================================================

create extension if not exists http with schema extensions;

create table if not exists public.deposit_assets (
  coin_id       text    not null,
  network       text    not null,
  coin_symbol   text    not null,
  network_label text    not null,
  cg_id         text,                      -- CoinGecko id for the live USD price
  fixed_usd     numeric,                   -- stablecoins: credited 1:1
  min_amount    numeric not null check (min_amount > 0),
  suffix_step   numeric not null check (suffix_step > 0),   -- unique suffix = 1..998 steps
  decimals      int     not null default 6,
  enabled       boolean not null default true,
  primary key (coin_id, network),
  check (cg_id is not null or fixed_usd is not null)
);
alter table public.deposit_assets enable row level security;
revoke all on public.deposit_assets from anon, authenticated;
grant select, insert, update, delete on public.deposit_assets to authenticated;
drop policy if exists deposit_assets_admin on public.deposit_assets;
create policy deposit_assets_admin on public.deposit_assets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.deposit_assets (coin_id, network, coin_symbol, network_label, cg_id, fixed_usd, min_amount, suffix_step, decimals, enabled) values
  ('usdt', 'trc20', 'USDT', 'TRC20 (Tron)',      null,       1,    10,     0.001,      6, true),
  ('usdt', 'erc20', 'USDT', 'ERC20 (Ethereum)',  null,       1,    10,     0.001,      6, true),
  ('usdt', 'bep20', 'USDT', 'BEP20 (BSC)',       null,       1,    10,     0.001,      6, true),
  ('usdc', 'erc20', 'USDC', 'ERC20 (Ethereum)',  null,       1,    10,     0.001,      6, true),
  ('usdc', 'sol',   'USDC', 'Solana',            null,       1,    10,     0.001,      6, true),
  ('usdc', 'bep20', 'USDC', 'BEP20 (BSC)',       null,       1,    10,     0.001,      6, true),
  ('btc',  'btc',   'BTC',  'Bitcoin Mainnet',   'bitcoin',  null, 0.0001, 0.00000001, 8, true),
  ('btc',  'lbtc',  'BTC',  'Lightning',         'bitcoin',  null, 0.0001, 0.00000001, 8, true),
  ('eth',  'erc20', 'ETH',  'ERC20 (Ethereum)',  'ethereum', null, 0.005,  0.000001,   6, true),
  ('eth',  'arb',   'ETH',  'Arbitrum',          'ethereum', null, 0.005,  0.000001,   6, true),
  ('eth',  'op',    'ETH',  'Optimism',          'ethereum', null, 0.005,  0.000001,   6, true),
  ('xrp',  'xrp',   'XRP',  'XRP Ledger',        'ripple',   null, 10,     0.001,      6, true),
  ('trx',  'trc20', 'TRX',  'TRC20 (Tron)',      'tron',     null, 100,    0.001,      6, true),
  ('bnb',  'bep20', 'BNB',  'BEP20 (BSC)',       'binancecoin', null, 0.01, 0.000001,  6, false)   -- delisted
on conflict (coin_id, network) do nothing;

create table if not exists public.coin_prices (
  cg_id      text primary key,
  usd        numeric not null check (usd > 0),
  updated_at timestamptz not null default now()
);
alter table public.coin_prices enable row level security;
revoke all on public.coin_prices from anon, authenticated;

alter table public.recharge_orders add column if not exists usd_rate numeric;

create or replace function public.deposit_usd_price(p_cg_id text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare cached_usd numeric; cached_at timestamptz; st int; body text; px numeric;
begin
  select usd, updated_at into cached_usd, cached_at from public.coin_prices where cg_id = p_cg_id;
  if cached_at > now() - interval '2 minutes' then return cached_usd; end if;
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '4000');
    select r.status, r.content into st, body
      from extensions.http_get('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd'
                               || '&x_cg_demo_api_key=CG-rqTDnjCErgK6hEq9x6s8RKzD&ids=' || p_cg_id) r;
    if st = 200 then px := (body::jsonb -> p_cg_id ->> 'usd')::numeric; end if;
  exception when others then px := null;
  end;
  if px > 0 then
    insert into public.coin_prices (cg_id, usd, updated_at) values (p_cg_id, px, now())
      on conflict (cg_id) do update set usd = excluded.usd, updated_at = excluded.updated_at;
    return px;
  end if;
  if cached_at > now() - interval '30 minutes' then return cached_usd; end if;
  return null;
end $$;
revoke execute on function public.deposit_usd_price(text) from public, anon, authenticated;

create or replace function public.create_recharge_order(p_coin_id text, p_coin_symbol text, p_network text, p_network_label text, p_crypto_amount numeric, p_usd_amount numeric)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare uid uuid; a public.deposit_assets%rowtype; addr text; px numeric; usd numeric; uniq numeric; oid uuid;
begin
  uid := public.current_app_user_id();
  if uid is null then return json_build_object('ok', false, 'code', 'auth', 'error', 'Please sign in'); end if;
  select * into a from public.deposit_assets where coin_id = p_coin_id and network = p_network and enabled;
  if not found then return json_build_object('ok', false, 'code', 'not_listed', 'error', 'This coin/network is not available for deposits'); end if;
  if p_crypto_amount is null or p_crypto_amount <= 0 then return json_build_object('ok', false, 'code', 'bad_amount', 'error', 'Enter an amount'); end if;
  if p_crypto_amount < a.min_amount then
    return json_build_object('ok', false, 'code', 'below_min', 'error', 'Below the minimum deposit', 'min', a.min_amount, 'symbol', a.coin_symbol);
  end if;
  select address into addr from public.payment_addresses where coin_id = a.coin_id and network = a.network limit 1;
  if addr is null then return json_build_object('ok', false, 'code', 'no_address', 'error', 'No receiving address is configured for this coin/network yet. Please contact support.'); end if;
  px := coalesce(a.fixed_usd, public.deposit_usd_price(a.cg_id));
  if px is null then return json_build_object('ok', false, 'code', 'price_unavailable', 'error', 'Price unavailable, please try again in a minute'); end if;
  usd  := round(p_crypto_amount * px, 2);
  uniq := round(p_crypto_amount + (floor(random() * 998) + 1)::numeric * a.suffix_step, a.decimals);
  insert into public.recharge_orders(user_id, usdt_amount, usd_amount, points_amount, usd_rate, status, coin_id, coin_symbol, network, network_label, wallet_address)
    values (uid, uniq, usd, usd, px, 'pending', a.coin_id, a.coin_symbol, a.network, a.network_label, addr)
    returning id into oid;
  return json_build_object('ok', true, 'orderId', oid, 'address', addr, 'uniqueAmt', uniq, 'usdAmount', usd, 'rate', px);
end; $function$;

-- Daily housekeeping: pg_cron keeps a row per run (~1,440/day from the settle sweep).
select cron.schedule(
  'purge-cron-history',
  '20 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '3 days' $$
);
