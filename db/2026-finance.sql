-- ============================================================================
-- Crypto.ssr — Finance / Earn subscriptions (new feature)
-- Run ONCE in the Supabase SQL editor for project `wovplubneljhoaliqkmk`.
-- Safe to re-run (idempotent).
--
-- Subscriptions are funded from the user's single USD balance (portfolios.
-- usd_balance), so `amount` is in USD. Daily-earnings accrual + redemption are
-- handled by a scheduled job (see note at the bottom) — not by the client.
-- ============================================================================

create table if not exists public.finance_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  product_id    text not null,            -- app product id, e.g. 'usdt-flex', 'quant-7'
  product_name  text,
  asset         text,                     -- display denomination (USDT, …)
  amount        numeric not null,         -- principal, in USD
  daily_rate    numeric,                  -- % per day snapshot at subscription
  term_days     integer default 0,        -- 0 = flexible
  status        text default 'active',    -- active | redeemed | closed
  accrued       numeric default 0,        -- earnings credited so far (by the job)
  created_at    timestamptz default now(),
  redeemed_at   timestamptz
);

create index if not exists finance_subscriptions_user_idx on public.finance_subscriptions (user_id, status);

-- NOTE — daily accrual & redemption:
-- Real earnings require a scheduled task (a Supabase edge function on a cron, the
-- same pattern as trade-settle) that, each day, adds amount*daily_rate/100 to each
-- active subscription's `accrued`, and on redemption credits principal (+accrued for
-- flexible / at maturity for fixed) back to portfolios.usd_balance. Ask Claude to
-- generate that function next; deploy it from the Supabase dashboard.
