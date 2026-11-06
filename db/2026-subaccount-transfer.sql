-- ============================================================================
-- Crypto.ssr — sub-account balances (Spot / Trading / Finance) + funds transfer
-- APPLIED to project `wovplubneljhoaliqkmk` as migration `subaccount_transfer`.
--
-- usd_balance stays THE single real/total USD balance that every money path
-- (deposit, withdraw, options trade, finance subscribe) reads and writes — those
-- RPCs / edge functions are UNCHANGED. trading_balance / finance_balance are
-- sub-account ALLOCATIONS carved out of it, for display + organisation only:
--     spot (displayed) = usd_balance - trading_balance - finance_balance
-- Invariant: trading_balance >= 0, finance_balance >= 0,
--            trading_balance + finance_balance <= usd_balance.
--
-- Because everything still spends/credits usd_balance (the whole pot), "money in
-- any account can trade" holds for free. transfer_funds() only re-labels money
-- between the three buckets (never touches usd_balance). A BEFORE UPDATE trigger
-- shrinks the allocations if usd_balance drops below their sum (a losing trade or
-- a withdrawal), keeping spot >= 0 without changing any other RPC.
--
-- This migration is additive and behaviour-neutral: existing rows get
-- trading_balance = finance_balance = 0, so spot = usd_balance = total exactly as
-- before, and the trigger never fires until someone actually transfers.
-- ============================================================================

alter table public.portfolios
  add column if not exists trading_balance numeric not null default 0,
  add column if not exists finance_balance numeric not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'portfolios_trading_balance_nonneg') then
    alter table public.portfolios add constraint portfolios_trading_balance_nonneg check (trading_balance >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'portfolios_finance_balance_nonneg') then
    alter table public.portfolios add constraint portfolios_finance_balance_nonneg check (finance_balance >= 0);
  end if;
end $$;

-- Clamp: whenever usd_balance would fall below the allocated sub-accounts (e.g. a
-- losing trade or a withdrawal debits usd_balance), shrink finance first then
-- trading so spot (= usd - trading - finance) never goes negative. No-op for
-- transfers (usd unchanged, invariant already held), sim trades, and stat updates.
create or replace function public.portfolios_clamp_subaccounts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare excess numeric; take numeric;
begin
  if new.usd_balance < new.trading_balance + new.finance_balance then
    excess := (new.trading_balance + new.finance_balance) - new.usd_balance;
    take := least(new.finance_balance, excess);
    new.finance_balance := new.finance_balance - take;
    excess := excess - take;
    if excess > 0 then
      new.trading_balance := greatest(0, new.trading_balance - excess);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists portfolios_clamp_subaccounts on public.portfolios;
create trigger portfolios_clamp_subaccounts
  before update on public.portfolios
  for each row execute function public.portfolios_clamp_subaccounts();

-- Move p_amount between the caller's own sub-accounts ('spot' | 'trading' | 'finance').
-- Only re-labels money: usd_balance is never changed. Spot is derived, so moving
-- INTO spot = reducing the source bucket; moving OUT OF spot = growing the dest
-- bucket (which lowers the derived spot). Atomic, row-locked, caller-scoped.
create or replace function public.transfer_funds(p_from text, p_to text, p_amount numeric)
returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid; usd numeric; tr numeric; fi numeric; spot numeric;
begin
  uid := public.current_app_user_id();
  if uid is null then return json_build_object('ok', false, 'error', 'Please sign in'); end if;
  if p_from not in ('spot','trading','finance') or p_to not in ('spot','trading','finance') then
    return json_build_object('ok', false, 'error', 'Invalid account');
  end if;
  if p_from = p_to then return json_build_object('ok', false, 'error', 'Choose two different accounts'); end if;
  if p_amount is null or p_amount <= 0 then return json_build_object('ok', false, 'error', 'Enter an amount'); end if;

  select usd_balance, trading_balance, finance_balance into usd, tr, fi
    from public.portfolios where user_id = uid for update;
  if usd is null then return json_build_object('ok', false, 'error', 'No account balance'); end if;
  spot := usd - tr - fi;

  -- Deduct from the source bucket.
  if p_from = 'spot' then
    if spot < p_amount then return json_build_object('ok', false, 'error', 'Insufficient balance'); end if;
  elsif p_from = 'trading' then
    if tr < p_amount then return json_build_object('ok', false, 'error', 'Insufficient balance'); end if;
    tr := tr - p_amount;
  else
    if fi < p_amount then return json_build_object('ok', false, 'error', 'Insufficient balance'); end if;
    fi := fi - p_amount;
  end if;

  -- Add to the destination bucket (moving into spot is implicit: the source
  -- deduction above already lowered trading/finance, which raises derived spot).
  if p_to = 'trading' then
    tr := tr + p_amount;
  elsif p_to = 'finance' then
    fi := fi + p_amount;
  end if;

  update public.portfolios set trading_balance = tr, finance_balance = fi, updated_at = now()
    where user_id = uid;
  return json_build_object('ok', true, 'spot', usd - tr - fi, 'trading', tr, 'finance', fi);
end $$;

revoke execute on function public.transfer_funds(text, text, numeric) from public, anon;
grant execute on function public.transfer_funds(text, text, numeric) to authenticated;
