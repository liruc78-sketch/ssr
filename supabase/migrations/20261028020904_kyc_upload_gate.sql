-- KYC upload gate. Applied to project wovplubneljhoaliqkmk (follows kyc_hardening).
-- Accounts cost nothing (email sign-up needs no confirmation, phone accounts get no SMS,
-- a wallet is a fresh key), and every KYC photo counted against one site-wide cap of 200
-- a day whether or not a submission followed, so about 17 throwaway accounts could block
-- every member's uploads for a day. Now:
-- * Each photo spends an upload pass. The KYC page runs a Cloudflare Turnstile check; the
--   kyc-pass edge function redeems the token with Siteverify (single use, valid 300 s) and
--   calls kyc_issue_upload_pass(); kyc_objects_guard spends one use per photo on the write
--   itself. A pass covers one attempt (1 or 2 photos) for 10 minutes and a new check
--   replaces it, so passes can't be stockpiled. kyc_settings.require_upload_pass turns
--   this on (and off again if Turnstile is down).
-- * Two daily budgets. Trusted members (an admin-confirmed deposit, or an account that
--   existed before KYC went live on 2026-10-28 00:25 UTC) get 12 photos each and 160
--   between them; everyone else gets 6 each and 40 between them. Throwaway accounts can
--   only use up the second budget, never the trusted members' share.
-- * kyc_upload_status() tells the KYC page, before it uploads, whether the caller may
--   upload and whether a check is needed; admin_kyc_upload_usage() feeds the admin
--   panel's near-cap warning.
-- * The bell: members can no longer insert notifications or change anything but is_read.
--   Inserting (or re-keying an old row to) source 'kyc' + their submission id + an event
--   made notify_kyc_review's ON CONFLICT DO NOTHING drop the real row. The SPA only reads
--   rows and marks them read; the admin panel doesn't use the table.
-- Turning the check on, once the SPA that runs it is live and the kyc-pass function has
-- its TURNSTILE_SECRET_KEY secret:
--   update public.kyc_settings set turnstile_sitekey = '<site key>', require_upload_pass = true;

-- ---- settings (one row) ------------------------------------------------------------------
create table if not exists public.kyc_settings (
    id                   boolean primary key default true check (id),
    require_upload_pass  boolean not null default false,
    turnstile_sitekey    text check (turnstile_sitekey ~ '^[0-9A-Za-z_-]{8,100}$'),   -- public
    trusted_member_daily integer not null default 12  check (trusted_member_daily >= 0),
    trusted_daily        integer not null default 160 check (trusted_daily >= 0),
    new_member_daily     integer not null default 6   check (new_member_daily >= 0),
    new_daily            integer not null default 40  check (new_daily >= 0),
    constraint kyc_settings_pass_needs_key check (not require_upload_pass or turnstile_sitekey is not null)
);
insert into public.kyc_settings (id) values (true) on conflict (id) do nothing;
alter table public.kyc_settings enable row level security;
revoke all on public.kyc_settings from anon, authenticated;

-- ---- upload passes (one per member; a new check replaces it) -----------------------------
create table if not exists public.kyc_upload_passes (
    user_id    uuid primary key constraint kyc_upload_passes_user_id_fkey references public.users(id) on delete cascade,
    uses_left  smallint not null check (uses_left >= 0),
    expires_at timestamptz not null
);
alter table public.kyc_upload_passes enable row level security;
revoke all on public.kyc_upload_passes from anon, authenticated;

-- ---- budgets -------------------------------------------------------------------------------
-- Trusted for KYC uploads: an admin-confirmed deposit, or an account from before KYC went
-- live (one made since then may have been made to drain the budgets).
create or replace function public.kyc_trusted(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.users
                    where id = p_user and not is_guest and created_at < timestamptz '2026-10-28 00:25:24+00')
        or exists (select 1 from public.recharge_orders where user_id = p_user and status = 'paid');
$$;
revoke all on function public.kyc_trusted(uuid) from public, anon, authenticated;

-- KYC photos uploaded in the last 24 hours, per budget (by each uploader's standing now).
create or replace function public.kyc_uploads_24h(out trusted_used bigint, out new_used bigint)
language sql stable security definer set search_path = '' as $$
    select count(*) filter (where trusted), count(*) filter (where not trusted)
      from (select public.kyc_trusted(case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
                                           then split_part(name, '/', 1)::uuid end) as trusted
              from storage.objects
             where bucket_id = 'kyc' and created_at > now() - interval '24 hours') o;
$$;
revoke all on function public.kyc_uploads_24h() from public, anon, authenticated;

-- Why member p_user may not upload p_photos more KYC photos now, or null if they may (the
-- pass aside): not_signed_in | already_verified | already_pending | member_limit | busy.
create or replace function public.kyc_upload_block(p_user uuid, p_photos integer default 1)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
    v_trusted boolean := public.kyc_trusted(p_user);
    v_photos  integer := greatest(coalesce(p_photos, 1), 1);
    v_set     public.kyc_settings;
    v_used    record;
    v_mine    bigint;
    v_pool    bigint;
begin
    if not exists (select 1 from public.users where id = p_user and not is_guest and auth_id is not null) then
        return 'not_signed_in';
    end if;
    if exists (select 1 from public.kyc_submissions where user_id = p_user and status = 'approved') then
        return 'already_verified';
    end if;
    if exists (select 1 from public.kyc_submissions where user_id = p_user and status = 'pending') then
        return 'already_pending';
    end if;
    select * into strict v_set from public.kyc_settings;
    select count(*) into v_mine from storage.objects
     where bucket_id = 'kyc' and name like p_user::text || '/%' and created_at > now() - interval '24 hours';
    if v_mine + v_photos > (case when v_trusted then v_set.trusted_member_daily else v_set.new_member_daily end) then
        return 'member_limit';
    end if;
    select * into v_used from public.kyc_uploads_24h();
    v_pool := case when v_trusted then v_used.trusted_used else v_used.new_used end;
    if v_pool + v_photos > (case when v_trusted then v_set.trusted_daily else v_set.new_daily end) then
        return 'busy';
    end if;
    return null;
end $$;
revoke all on function public.kyc_upload_block(uuid, integer) from public, anon, authenticated;

-- ---- the upload rules ------------------------------------------------------------------------
-- Storage INSERT policy helper (from kyc_verification): the caller's own folder and nothing in
-- kyc_upload_block in the way. kyc_objects_guard enforces the same on the write; this
-- refuses early, when an upload starts or a signed upload URL is minted.
create or replace function public.kyc_can_upload(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := public.current_app_user_id();
begin
    return v_me is not null
        and p_name ~ ('^' || v_me::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(front|back)\.jpg$')
        and public.kyc_upload_block(v_me) is null;
end $$;

-- The real gate (see kyc_hardening): path, uploader, kyc_upload_block, and one use of the
-- member's pass per photo while passes are required. Updates are refused.
create or replace function public.kyc_objects_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
    v_uid   uuid;
    v_user  public.users;
    v_block text;
begin
    if tg_op = 'UPDATE' then
        raise exception 'kyc photos cannot be changed' using errcode = '42501';
    end if;
    if new.name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(front|back)\.jpg$' then
        raise exception 'kyc upload refused: path' using errcode = '42501';
    end if;
    v_uid := split_part(new.name, '/', 1)::uuid;
    -- Counts see only committed rows, so a member's uploads take turns, and so do all the
    -- uploads drawing on one daily budget.
    perform pg_advisory_xact_lock(hashtextextended('kyc_upload:' || v_uid::text, 0));
    select * into v_user from public.users where id = v_uid;
    -- The folder's owner uploads it (a signed upload URL carries its minter as owner).
    if v_user.id is null or v_user.is_guest or v_user.auth_id is null
       or coalesce(new.owner_id, new.owner::text) is distinct from v_user.auth_id::text then
        raise exception 'kyc upload refused: owner' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('kyc_upload_budget:' || public.kyc_trusted(v_uid)::text, 0));
    v_block := public.kyc_upload_block(v_uid);
    if v_block is not null then
        raise exception 'kyc upload refused: %', v_block using errcode = '42501';
    end if;
    if (select require_upload_pass from public.kyc_settings) then
        update public.kyc_upload_passes set uses_left = uses_left - 1
         where user_id = v_uid and uses_left > 0 and expires_at > now();
        if not found then
            raise exception 'kyc upload refused: pass' using errcode = '42501';
        end if;
    end if;
    return new;
end $$;
revoke all on function public.kyc_objects_guard() from public, anon, authenticated;

-- ---- member: may I upload? -------------------------------------------------------------------
-- Asked by the KYC page before uploading p_photos photos: { ok, pass_required, sitekey } or
-- { ok: false, error: not_signed_in | already_verified | already_pending | member_limit | busy }.
create or replace function public.kyc_upload_status(p_photos integer default 1)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
    v_me    uuid := public.current_app_user_id();
    v_block text;
    v_set   public.kyc_settings;
begin
    if v_me is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
    v_block := public.kyc_upload_block(v_me, least(greatest(coalesce(p_photos, 1), 1), 2));
    if v_block is not null then return json_build_object('ok', false, 'error', v_block); end if;
    select * into strict v_set from public.kyc_settings;
    return json_build_object('ok', true, 'pass_required', v_set.require_upload_pass,
                             'sitekey', case when v_set.require_upload_pass then v_set.turnstile_sitekey end);
end $$;
revoke all on function public.kyc_upload_status(integer) from public, anon;
grant execute on function public.kyc_upload_status(integer) to authenticated;

-- ---- kyc-pass edge function (service_role) -------------------------------------------------
-- Called once Siteverify has accepted the member's Turnstile token: a pass for p_photos
-- photos (1 or 2: one attempt) for 10 minutes, replacing any earlier one.
-- { ok, photos, expires_at } or { ok: false, error: not_signed_in | a kyc_upload_block code }.
create or replace function public.kyc_issue_upload_pass(p_auth_id uuid, p_photos integer default 2)
returns json language plpgsql security definer set search_path = '' as $$
declare
    v_me     uuid;
    v_photos integer := least(greatest(coalesce(p_photos, 2), 1), 2);
    v_exp    timestamptz := now() + interval '10 minutes';
    v_block  text;
begin
    select id into v_me from public.users where auth_id = p_auth_id and not is_guest limit 1;
    if v_me is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
    perform pg_advisory_xact_lock(hashtextextended('kyc_upload:' || v_me::text, 0));
    v_block := public.kyc_upload_block(v_me, v_photos);
    if v_block is not null then return json_build_object('ok', false, 'error', v_block); end if;
    insert into public.kyc_upload_passes (user_id, uses_left, expires_at) values (v_me, v_photos, v_exp)
    on conflict (user_id) do update set uses_left = excluded.uses_left, expires_at = excluded.expires_at;
    return json_build_object('ok', true, 'photos', v_photos, 'expires_at', v_exp);
end $$;
revoke all on function public.kyc_issue_upload_pass(uuid, integer) from public, anon, authenticated;
grant execute on function public.kyc_issue_upload_pass(uuid, integer) to service_role;

-- ---- admin panel ---------------------------------------------------------------------------
-- Pending reviews, photos uploaded in the last 24 hours against each daily budget, and the
-- bucket's size and uploads no submission points at (abandoned attempts can't be deleted
-- through the API). { ok: false, error: forbidden } for anyone but the admin.
create or replace function public.admin_kyc_upload_usage()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
    v_set  public.kyc_settings;
    v_used record;
begin
    if not public.is_admin() then return json_build_object('ok', false, 'error', 'forbidden'); end if;
    select * into strict v_set from public.kyc_settings;
    select * into v_used from public.kyc_uploads_24h();
    return json_build_object('ok', true,
        'pending', (select count(*) from public.kyc_submissions where status = 'pending'),
        'require_upload_pass', v_set.require_upload_pass,
        'trusted', json_build_object('used', v_used.trusted_used, 'cap', v_set.trusted_daily, 'per_member', v_set.trusted_member_daily),
        'new', json_build_object('used', v_used.new_used, 'cap', v_set.new_daily, 'per_member', v_set.new_member_daily),
        'bucket_bytes', (select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint end), 0)
                           from storage.objects where bucket_id = 'kyc'),
        'unsubmitted', (select count(*) from storage.objects o
                         where o.bucket_id = 'kyc'
                           and not exists (select 1 from public.kyc_submissions s
                                            where s.front_path = o.name or s.back_path = o.name)));
end $$;
revoke all on function public.admin_kyc_upload_usage() from public, anon;
grant execute on function public.admin_kyc_upload_usage() to authenticated;

-- ---- the bell ------------------------------------------------------------------------------
-- Rows come only from the SECURITY DEFINER notify_* triggers; members read their own and
-- mark them read.
drop policy if exists notif_insert_own on public.notifications;
revoke insert, update, delete, truncate, references, trigger on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;
