-- ============================================================================
-- Crypto.ssr — recharge amount precision + sanity (follow-up to 2026-deposit-pricing.sql)
-- APPLIED 2026-10-11 to project `wovplubneljhoaliqkmk` as migration
-- `recharge_amount_precision_and_sanity`.
--
-- * recharge_orders.usdt_amount (the exact amount to send) was numeric(18,3): the
--   BTC/ETH unique suffixes (1e-8 / 1e-6 steps) were rounded away and orders looked
--   identical to the admin. Now numeric(38,8).
-- * NaN / Infinity passed the "<= 0" / "< min" checks (NaN sorts above every number).
--   create_recharge_order rejects them; a CHECK keeps NaN/Infinity/negatives out of
--   usdt_amount, usd_amount and points_amount.
-- * The base amount is rounded to the asset's decimals before pricing, so the credit
--   and the transfer amount use the same precision; the RPC returns the stored value.
-- * deposit_usd_price stale-cache fallback shortened from 30 to 5 minutes.
-- (Full function bodies: see the live definitions / 2026-deposit-pricing.sql with
--  these edits applied.)
-- ============================================================================
alter table public.recharge_orders alter column usdt_amount type numeric(38,8);

alter table public.recharge_orders drop constraint if exists recharge_orders_amounts_finite;
alter table public.recharge_orders add constraint recharge_orders_amounts_finite check (
  (usdt_amount   is null or (usdt_amount   >= 0 and usdt_amount   < 'Infinity'::numeric)) and
  (usd_amount    is null or (usd_amount    >= 0 and usd_amount    < 'Infinity'::numeric)) and
  (points_amount is null or (points_amount >= 0 and points_amount < 'Infinity'::numeric))
);  -- NaN sorts above Infinity, so "< 'Infinity'" also excludes NaN

-- In create_recharge_order:
--   if p_crypto_amount is null or not (p_crypto_amount > 0 and p_crypto_amount < 'Infinity'::numeric) then -> bad_amount
--   amt := round(p_crypto_amount, a.decimals);  -- min check, pricing and suffix use amt
--   insert ... returning id, usdt_amount into oid, uniq;
-- In deposit_usd_price: stale fallback "now() - interval '5 minutes'".
