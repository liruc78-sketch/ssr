-- KYC identity verification. Applied to project wovplubneljhoaliqkmk.
-- A member photographs an identity document on #/kyc. The SPA re-encodes each photo
-- as a JPEG (which also drops EXIF/GPS data) and uploads it to the private Storage
-- bucket 'kyc' at <users.id>/<random uuid>/front.jpg (plus back.jpg for a driver's
-- licence or national ID); submit_kyc() then files a pending submission pointing at
-- those files. The admin panel shows the photos through short-lived signed URLs and
-- decides with admin_review_kyc(): a rejection carries a reason code, which each
-- language renders itself, and an optional free-text note. users.kyc_status mirrors
-- the member's latest submission, so the session (built from the users row) knows
-- whether the account is verified, and the bell reports each decision.

-- ---- users.kyc_status ----------------------------------------------------------
alter table public.users
    add column if not exists kyc_status text not null default 'none';
alter table public.users drop constraint if exists users_kyc_status_check;
alter table public.users add constraint users_kyc_status_check
    check (kyc_status in ('none', 'pending', 'approved', 'rejected'));

-- ---- submissions ---------------------------------------------------------------
create table if not exists public.kyc_submissions (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null constraint kyc_submissions_user_id_fkey references public.users(id) on delete cascade,
    country       text not null check (country ~ '^[A-Z]{2}$'),          -- ISO 3166-1 alpha-2
    doc_type      text not null check (doc_type in ('passport', 'drivers', 'id')),
    front_path    text not null unique,                                  -- object names in bucket 'kyc'
    back_path     text unique,
    status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    reject_reason text check (reject_reason in ('unreadable', 'incomplete', 'expired', 'mismatch', 'not_original', 'other')),
    review_note   text check (char_length(review_note) <= 500),         -- shown to the member as written
    reviewed_by   uuid constraint kyc_submissions_reviewed_by_fkey references public.users(id) on delete set null,
    reviewed_at   timestamptz,
    created_at    timestamptz not null default now(),
    -- A passport is one photo (the photo page); the other documents need the back too.
    constraint kyc_submissions_sides check ((doc_type = 'passport') = (back_path is null)),
    -- Pending carries no decision; a rejection always has a reason, and 'other'
    -- explains itself in the note.
    constraint kyc_submissions_decision check (case status
        when 'pending'  then reviewed_at is null and reject_reason is null and review_note is null
        when 'approved' then reviewed_at is not null and reject_reason is null and review_note is null
        else reviewed_at is not null and reject_reason is not null
             and (reject_reason <> 'other' or btrim(coalesce(review_note, '')) <> '') end)
);

create index if not exists kyc_submissions_user_created_idx on public.kyc_submissions (user_id, created_at desc);
create index if not exists kyc_submissions_status_created_idx on public.kyc_submissions (status, created_at);
-- At most one submission per member waiting or accepted: a new one can only follow
-- a rejection (submit_kyc checks first; this is the backstop).
create unique index if not exists kyc_submissions_one_open on public.kyc_submissions (user_id)
    where status in ('pending', 'approved');

alter table public.kyc_submissions enable row level security;

-- Members read their own rows, the admin reads all. No write policies or grants:
-- rows change only through submit_kyc() and admin_review_kyc() (SECURITY DEFINER).
drop policy if exists kyc_submissions_select_own on public.kyc_submissions;
create policy kyc_submissions_select_own on public.kyc_submissions
    for select to authenticated
    using (user_id = public.current_app_user_id());

drop policy if exists kyc_submissions_admin on public.kyc_submissions;
create policy kyc_submissions_admin on public.kyc_submissions
    for select to authenticated
    using (public.is_admin());

revoke all on public.kyc_submissions from anon, authenticated;
grant select on public.kyc_submissions to authenticated;

-- ---- private bucket for the photos ----------------------------------------------
-- JPEG only and at most 3 MB a photo (the SPA re-encodes to JPEG and aims for 2.5 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 3145728, array['image/jpeg'])
on conflict (id) do update
    set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Whether the caller may upload object p_name to the kyc bucket: a signed-in member
-- (not a guest) with no submission pending or approved, writing
-- <own users.id>/<uuid>/front.jpg or back.jpg, and fewer than 12 uploads in the last
-- 24 hours (abandoned attempts count too, so nobody can fill the bucket).
-- SECURITY DEFINER so it can count storage.objects from inside that table's policy.
create or replace function public.kyc_can_upload(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := public.current_app_user_id();
begin
    return v_me is not null
        and p_name ~ ('^' || v_me::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(front|back)\.jpg$')
        and not exists (select 1 from public.users where id = v_me and is_guest)
        and not exists (select 1 from public.kyc_submissions where user_id = v_me and status in ('pending', 'approved'))
        and (select count(*) from storage.objects
              where bucket_id = 'kyc' and name like v_me::text || '/%'
                and created_at > now() - interval '24 hours') < 12;
end $$;
revoke all on function public.kyc_can_upload(text) from public, anon;
grant execute on function public.kyc_can_upload(text) to authenticated;

-- Members upload into their own folder (rules above) and read their own photos; the
-- admin reads every photo (signed URLs). No UPDATE or DELETE policies: a photo can't
-- be replaced or removed through the API once uploaded, so a submission keeps
-- showing exactly what was reviewed.
drop policy if exists kyc_insert_own on storage.objects;
create policy kyc_insert_own on storage.objects
    for insert to authenticated
    with check (bucket_id = 'kyc' and public.kyc_can_upload(name));

drop policy if exists kyc_select_own on storage.objects;
create policy kyc_select_own on storage.objects
    for select to authenticated
    using (bucket_id = 'kyc' and (storage.foldername(name))[1] = public.current_app_user_id()::text);

drop policy if exists kyc_select_admin on storage.objects;
create policy kyc_select_admin on storage.objects
    for select to authenticated
    using (bucket_id = 'kyc' and public.is_admin());

-- ---- member: submit ----------------------------------------------------------------
-- File the caller's submission from the photos they just uploaded: { ok, submission }
-- or { ok: false, error: not_signed_in | already_pending | already_verified |
-- bad_country | bad_doc_type | bad_file }.
create or replace function public.submit_kyc(p_country text, p_doc_type text, p_front_path text, p_back_path text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
    v_me  uuid := public.current_app_user_id();
    v_dir text;
    v_row public.kyc_submissions;
begin
    if v_me is null or exists (select 1 from public.users where id = v_me and is_guest) then
        return json_build_object('ok', false, 'error', 'not_signed_in');
    end if;
    -- One submission at a time per member: a double tap must not file two.
    perform pg_advisory_xact_lock(hashtextextended('kyc:' || v_me::text, 0));
    if exists (select 1 from public.kyc_submissions where user_id = v_me and status = 'approved') then
        return json_build_object('ok', false, 'error', 'already_verified');
    end if;
    if exists (select 1 from public.kyc_submissions where user_id = v_me and status = 'pending') then
        return json_build_object('ok', false, 'error', 'already_pending');
    end if;
    if p_country is null or p_country !~ '^[A-Z]{2}$' then
        return json_build_object('ok', false, 'error', 'bad_country');
    end if;
    if p_doc_type is null or p_doc_type not in ('passport', 'drivers', 'id') then
        return json_build_object('ok', false, 'error', 'bad_doc_type');
    end if;
    -- The photos sit together in one upload folder of the caller's, were uploaded by
    -- this login, and were never part of an earlier submission.
    v_dir := substring(p_front_path from
        '^(' || v_me::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/front\.jpg$');
    if v_dir is null
       or (p_doc_type = 'passport') <> (p_back_path is null)
       or (p_back_path is not null and p_back_path <> v_dir || '/back.jpg')
       or (select count(*) from storage.objects
            where bucket_id = 'kyc' and name in (p_front_path, p_back_path)
              and coalesce(owner_id, owner::text) = auth.uid()::text)
          <> 1 + (p_back_path is not null)::int
       or exists (select 1 from public.kyc_submissions where front_path = p_front_path or back_path = p_back_path) then
        return json_build_object('ok', false, 'error', 'bad_file');
    end if;

    insert into public.kyc_submissions (user_id, country, doc_type, front_path, back_path)
    values (v_me, p_country, p_doc_type, p_front_path, p_back_path)
    returning * into v_row;
    update public.users set kyc_status = 'pending' where id = v_me;
    return json_build_object('ok', true, 'submission', json_build_object(
        'id', v_row.id, 'country', v_row.country, 'doc_type', v_row.doc_type, 'status', v_row.status,
        'reject_reason', v_row.reject_reason, 'review_note', v_row.review_note,
        'reviewed_at', v_row.reviewed_at, 'created_at', v_row.created_at));
end $$;
revoke all on function public.submit_kyc(text, text, text, text) from public, anon;
grant execute on function public.submit_kyc(text, text, text, text) to authenticated;

-- ---- admin: review -------------------------------------------------------------------
-- p_decision 'approve' (a pending submission) or 'reject' (a pending one, or an
-- approved one to revoke it) with p_reason, plus p_note, which the reason 'other'
-- requires. { ok, status } or { ok: false, error: forbidden | not_found |
-- bad_decision | bad_reason | note_required | note_too_long | already_decided }.
create or replace function public.admin_review_kyc(p_id uuid, p_decision text, p_reason text default null, p_note text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
    v_sub  public.kyc_submissions;
    v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
    if not public.is_admin() then return json_build_object('ok', false, 'error', 'forbidden'); end if;
    select * into v_sub from public.kyc_submissions where id = p_id for update;
    if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;

    if p_decision = 'approve' then
        if v_sub.status <> 'pending' then
            return json_build_object('ok', false, 'error', 'already_decided', 'status', v_sub.status);
        end if;
        update public.kyc_submissions
           set status = 'approved', reviewed_by = public.current_app_user_id(), reviewed_at = now()
         where id = p_id;
    elsif p_decision = 'reject' then
        if p_reason is null or p_reason not in ('unreadable', 'incomplete', 'expired', 'mismatch', 'not_original', 'other') then
            return json_build_object('ok', false, 'error', 'bad_reason');
        end if;
        if p_reason = 'other' and v_note is null then
            return json_build_object('ok', false, 'error', 'note_required');
        end if;
        if char_length(v_note) > 500 then
            return json_build_object('ok', false, 'error', 'note_too_long');
        end if;
        if v_sub.status = 'rejected' then
            return json_build_object('ok', false, 'error', 'already_decided', 'status', v_sub.status);
        end if;
        update public.kyc_submissions
           set status = 'rejected', reject_reason = p_reason, review_note = v_note,
               reviewed_by = public.current_app_user_id(), reviewed_at = now()
         where id = p_id;
    else
        return json_build_object('ok', false, 'error', 'bad_decision');
    end if;

    -- The decided submission is always the member's latest (a new one can only
    -- follow a rejection), so their verification state follows it.
    update public.users set kyc_status = case p_decision when 'approve' then 'approved' else 'rejected' end
     where id = v_sub.user_id;
    return json_build_object('ok', true, 'status', case p_decision when 'approve' then 'approved' else 'rejected' end);
end $$;
revoke all on function public.admin_review_kyc(uuid, text, text, text) from public, anon;
grant execute on function public.admin_review_kyc(uuid, text, text, text) to authenticated;

-- ---- bell -----------------------------------------------------------------------------
-- Like the other notify_* triggers: SECURITY DEFINER and swallowing its own errors,
-- so a notification problem can never undo a decision. meta.reason is the reason
-- code; js/notifications.js renders it in the member's language.
create or replace function public.notify_kyc_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if new.status in ('approved', 'rejected') and old.status is distinct from new.status then
        begin
            insert into public.notifications (user_id, kind, event, source, source_id, meta)
            values (new.user_id, 'kyc', new.status, 'kyc', new.id,
                    jsonb_build_object('docType', new.doc_type, 'country', new.country, 'reason', new.reject_reason))
            on conflict (source, source_id, event) do nothing;
        exception when others then null;
        end;
    end if;
    return new;
end $$;
revoke all on function public.notify_kyc_review() from public, anon, authenticated;
drop trigger if exists trg_notify_kyc_review on public.kyc_submissions;
create trigger trg_notify_kyc_review after update of status on public.kyc_submissions
    for each row execute function public.notify_kyc_review();
