-- ============================================================================
-- Crypto.ssr — Finance / Earn backend (applied to project wovplubneljhoaliqkmk)
-- Subscriptions are funded from the single USD balance (portfolios.usd_balance),
-- so `amount` is in USD. Daily accrual + redemption run server-side (pg_cron).
-- All of this is already applied on the live project; kept here for the record.
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
  status        text default 'active',    -- active | redeemed
  accrued       numeric default 0,        -- earnings accrued so far
  last_accrued_at date,                   -- last day earnings were credited
  created_at    timestamptz default now(),
  redeemed_at   timestamptz
);
create index if not exists finance_subscriptions_user_idx on public.finance_subscriptions (user_id, status);

-- Daily accrual + auto-redeem matured fixed-term subs. Idempotent per day.
create or replace function public.finance_accrue() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.finance_subscriptions s
     set accrued = coalesce(accrued,0) + s.amount * s.daily_rate / 100.0 * (current_date - coalesce(s.last_accrued_at, s.created_at::date)),
         last_accrued_at = current_date
   where s.status = 'active' and s.daily_rate is not null
     and current_date > coalesce(s.last_accrued_at, s.created_at::date);

  update public.portfolios p
     set usd_balance = usd_balance + m.amount + coalesce(m.accrued,0)
    from (select user_id, amount, accrued from public.finance_subscriptions
          where status = 'active' and term_days > 0 and now() >= created_at + make_interval(days => term_days)) m
   where p.user_id = m.user_id;

  update public.finance_subscriptions
     set status = 'redeemed', redeemed_at = now()
   where status = 'active' and term_days > 0 and now() >= created_at + make_interval(days => term_days);
end; $$;

-- On-demand redemption (flexible, or matured fixed): credit principal + accrued.
create or replace function public.finance_redeem(p_sub_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare s record; credited numeric;
begin
  select * into s from public.finance_subscriptions where id = p_sub_id and status = 'active' for update;
  if not found then return json_build_object('ok', false, 'error', 'Not found or already redeemed'); end if;
  if s.term_days > 0 and now() < s.created_at + make_interval(days => s.term_days) then
    return json_build_object('ok', false, 'error', 'This fixed-term subscription has not matured yet');
  end if;
  credited := s.amount + coalesce(s.accrued,0);
  update public.portfolios set usd_balance = usd_balance + credited where user_id = s.user_id;
  update public.finance_subscriptions set status = 'redeemed', redeemed_at = now() where id = s.id;
  return json_build_object('ok', true, 'credited', credited);
end; $$;
grant execute on function public.finance_redeem(uuid) to anon, authenticated;

-- Schedule daily accrual at 00:05 UTC.
create extension if not exists pg_cron;
select cron.schedule('finance-accrue-daily', '5 0 * * *', $$ select public.finance_accrue(); $$);
