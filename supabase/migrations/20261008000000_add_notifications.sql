-- Notification center (the bell). Applied to project wovplubneljhoaliqkmk.
-- Structured, language-agnostic rows (kind + event + meta) emitted by triggers
-- on the money tables; the frontend renders the text in the active UI language.

create table if not exists public.notifications (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null,
    kind       text not null,                 -- trade | deposit | withdraw | system
    event      text not null,                 -- won|lost | credited|failed | submitted|completed|failed
    meta       jsonb not null default '{}'::jsonb,
    is_read    boolean not null default false,
    source     text,                          -- position | recharge | withdrawal (null = client/system)
    source_id  uuid,
    created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
    on public.notifications (user_id, created_at desc);
create unique index if not exists notifications_source_uniq
    on public.notifications (source, source_id, event);

alter table public.notifications enable row level security;

drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications
    for select using (auth.uid() = user_id);
drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists notif_insert_own on public.notifications;
create policy notif_insert_own on public.notifications
    for insert with check (auth.uid() = user_id);

do $$ begin
    begin
        alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null; when others then null;
    end;
end $$;

-- Trigger functions are SECURITY DEFINER and swallow their own errors, so a
-- notification failure can never roll back a settlement / deposit / withdrawal.

create or replace function public.notify_position_settle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.status in ('Won','Lost') and old.status = 'Active'
       and old.status is distinct from new.status then
        begin
            insert into public.notifications (user_id, kind, event, source, source_id, meta)
            values (new.user_id, 'trade', lower(new.status), 'position', new.id,
                jsonb_build_object('coinId', new.coin_id, 'type', new.type,
                    'amount', new.amount, 'payout', new.payout,
                    'durationSeconds', new.duration_seconds, 'isSim', coalesce(new.is_sim, false),
                    'entryPrice', new.entry_price, 'settlementPrice', new.settlement_price))
            on conflict (source, source_id, event) do nothing;
        exception when others then null;
        end;
    end if;
    return new;
end $$;
drop trigger if exists trg_notify_position_settle on public.positions;
create trigger trg_notify_position_settle after update on public.positions
    for each row execute function public.notify_position_settle();

create or replace function public.notify_recharge_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare ev text;
begin
    if old.status is distinct from new.status then
        if new.status = 'paid' then ev := 'credited';
        elsif new.status in ('cancelled','expired','rejected','failed') then ev := 'failed';
        else ev := null; end if;
        if ev is not null then
            begin
                insert into public.notifications (user_id, kind, event, source, source_id, meta)
                values (new.user_id, 'deposit', ev, 'recharge', new.id,
                    jsonb_build_object('coinSymbol', new.coin_symbol, 'usdAmount', new.usd_amount,
                        'networkLabel', new.network_label, 'status', new.status))
                on conflict (source, source_id, event) do nothing;
            exception when others then null;
            end;
        end if;
    end if;
    return new;
end $$;
drop trigger if exists trg_notify_recharge_update on public.recharge_orders;
create trigger trg_notify_recharge_update after update on public.recharge_orders
    for each row execute function public.notify_recharge_update();

create or replace function public.notify_withdrawal_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    begin
        insert into public.notifications (user_id, kind, event, source, source_id, meta)
        values (new.user_id, 'withdraw', 'submitted', 'withdrawal', new.id,
            jsonb_build_object('amount', new.amount, 'fee', new.fee, 'status', new.status))
        on conflict (source, source_id, event) do nothing;
    exception when others then null;
    end;
    return new;
end $$;
drop trigger if exists trg_notify_withdrawal_insert on public.withdrawals;
create trigger trg_notify_withdrawal_insert after insert on public.withdrawals
    for each row execute function public.notify_withdrawal_insert();

create or replace function public.notify_withdrawal_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare ev text;
begin
    if old.status is distinct from new.status then
        if new.status in ('completed','approved','paid','success','done') then ev := 'completed';
        elsif new.status in ('rejected','failed','cancelled','declined') then ev := 'failed';
        else ev := null; end if;
        if ev is not null then
            begin
                insert into public.notifications (user_id, kind, event, source, source_id, meta)
                values (new.user_id, 'withdraw', ev, 'withdrawal', new.id,
                    jsonb_build_object('amount', new.amount, 'fee', new.fee, 'status', new.status))
                on conflict (source, source_id, event) do nothing;
            exception when others then null;
            end;
        end if;
    end if;
    return new;
end $$;
drop trigger if exists trg_notify_withdrawal_update on public.withdrawals;
create trigger trg_notify_withdrawal_update after update on public.withdrawals
    for each row execute function public.notify_withdrawal_update();
