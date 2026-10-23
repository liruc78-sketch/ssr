-- Admin balance adjustments. Applied to project wovplubneljhoaliqkmk.
-- The admin panel's 余额 ➕增加 / ➖扣除 used to PATCH portfolios.usd_balance from
-- the browser: nothing was recorded, so a member's History stayed empty after an
-- admin credit, and the new balance came from the panel's cached user list, so a
-- trade settled in between was overwritten. admin_adjust_balance() now applies
-- the change under a row lock and logs it here; the SPA's History lists the
-- credits (amount > 0) under Deposit records.

create table if not exists public.balance_adjustments (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references public.users(id) on delete cascade,
    amount         numeric(18,4) not null check (amount <> 0),   -- signed USD actually applied
    balance_before numeric(18,4) not null,
    balance_after  numeric(18,4) not null,
    admin_id       uuid references public.users(id) on delete set null,
    created_at     timestamptz not null default now()
);

create index if not exists balance_adjustments_user_created_idx
    on public.balance_adjustments (user_id, created_at desc);

alter table public.balance_adjustments enable row level security;

-- Members read their own rows, the admin reads all. No write policies or
-- grants: rows come only from admin_adjust_balance() (SECURITY DEFINER).
drop policy if exists balance_adjustments_select_own on public.balance_adjustments;
create policy balance_adjustments_select_own on public.balance_adjustments
    for select to authenticated
    using (user_id = public.current_app_user_id());

drop policy if exists balance_adjustments_admin on public.balance_adjustments;
create policy balance_adjustments_admin on public.balance_adjustments
    for select to authenticated
    using (public.is_admin());

revoke all on public.balance_adjustments from anon, authenticated;
grant select on public.balance_adjustments to authenticated;

-- p_amount > 0 credits, < 0 debits (rounded to cents). A debit stops at a zero
-- balance, as the panel always did; the row records what was actually applied.
create or replace function public.admin_adjust_balance(p_user_id uuid, p_amount numeric)
returns json language plpgsql security definer set search_path = public as $$
declare amt numeric; bal numeric; next_bal numeric;
begin
    if not public.is_admin() then return json_build_object('ok', false, 'error', 'forbidden'); end if;
    amt := round(p_amount, 2);
    -- NaN sorts above every number, so the bound also rejects NaN and Infinity.
    if amt is null or amt = 0 or abs(amt) >= 1e12 then
        return json_build_object('ok', false, 'error', 'bad_amount');
    end if;
    if not exists (select 1 from public.users where id = p_user_id) then
        return json_build_object('ok', false, 'error', 'no_user');
    end if;

    insert into public.portfolios (user_id, usd_balance) values (p_user_id, 0)
        on conflict (user_id) do nothing;
    select coalesce(usd_balance, 0) into bal from public.portfolios where user_id = p_user_id for update;
    next_bal := greatest(bal + amt, 0);
    if next_bal = bal then
        return json_build_object('ok', true, 'balance', bal, 'applied', 0);
    end if;

    update public.portfolios set usd_balance = next_bal where user_id = p_user_id;
    insert into public.balance_adjustments (user_id, amount, balance_before, balance_after, admin_id)
        values (p_user_id, next_bal - bal, bal, next_bal, public.current_app_user_id());
    return json_build_object('ok', true, 'balance', next_bal, 'applied', next_bal - bal);
end $$;

-- Functions default-grant EXECUTE to PUBLIC; is_admin() gates the body anyway.
revoke all on function public.admin_adjust_balance(uuid, numeric) from public, anon;
grant execute on function public.admin_adjust_balance(uuid, numeric) to authenticated;
