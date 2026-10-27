-- KYC hardening after review. Applied to project wovplubneljhoaliqkmk (follows kyc_verification).
-- * The upload rules now hold on the write itself. Storage (1.80.2 here) checks RLS for a
--   signed upload URL only when the URL is minted and then writes the file as superuser,
--   so a member could mint many URLs while under the limit and upload them all, or use an
--   upsert URL to swap a photo after review. A trigger on storage.objects re-checks every
--   kyc insert (path, uploader, nothing pending or approved, 12 per member and 200
--   site-wide per 24 h, serialized per member so parallel uploads can't all pass) and
--   refuses every update. Its 42501 reaches the client as Storage's 403 AccessDenied.
-- * Photos are capped at 2 MB (the SPA aims for 1.5 MB).
-- * admin_review_kyc: 'reject' decides a pending submission only and the new 'revoke'
--   takes back an approval, so a reject sent from a stale screen can't silently revoke
--   an approval made meanwhile.

update storage.buckets set file_size_limit = 2097152 where id = 'kyc';

create or replace function public.kyc_objects_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
    v_uid  uuid;
    v_user public.users;
begin
    if tg_op = 'UPDATE' then
        raise exception 'kyc photos cannot be changed' using errcode = '42501';
    end if;
    if new.name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(front|back)\.jpg$' then
        raise exception 'kyc upload refused: path' using errcode = '42501';
    end if;
    v_uid := split_part(new.name, '/', 1)::uuid;
    -- Counts see only committed rows, so a member's uploads take turns.
    perform pg_advisory_xact_lock(hashtextextended('kyc_upload:' || v_uid::text, 0));
    select * into v_user from public.users where id = v_uid;
    -- The folder's owner uploads it (a signed upload URL carries its minter as owner).
    if v_user.id is null or v_user.is_guest or v_user.auth_id is null
       or coalesce(new.owner_id, new.owner::text) is distinct from v_user.auth_id::text then
        raise exception 'kyc upload refused: owner' using errcode = '42501';
    end if;
    if exists (select 1 from public.kyc_submissions where user_id = v_uid and status in ('pending', 'approved')) then
        raise exception 'kyc upload refused: already submitted' using errcode = '42501';
    end if;
    if (select count(*) from storage.objects
         where bucket_id = 'kyc' and name like v_uid::text || '/%' and created_at > now() - interval '24 hours') >= 12
       or (select count(*) from storage.objects
            where bucket_id = 'kyc' and created_at > now() - interval '24 hours') >= 200 then
        raise exception 'kyc upload refused: limit' using errcode = '42501';
    end if;
    return new;
end $$;
revoke all on function public.kyc_objects_guard() from public, anon, authenticated;

drop trigger if exists kyc_objects_guard_insert on storage.objects;
create trigger kyc_objects_guard_insert before insert on storage.objects
    for each row when (new.bucket_id = 'kyc') execute function public.kyc_objects_guard();
drop trigger if exists kyc_objects_guard_update on storage.objects;
create trigger kyc_objects_guard_update before update on storage.objects
    for each row when (old.bucket_id = 'kyc' or new.bucket_id = 'kyc') execute function public.kyc_objects_guard();

-- p_decision 'approve' or 'reject' (a pending submission) or 'revoke' (an approved one),
-- the last two with p_reason, plus p_note, which the reason 'other' requires. { ok, status }
-- or { ok: false, error: forbidden | bad_decision | not_found | already_decided |
-- bad_reason | note_required | note_too_long }.
create or replace function public.admin_review_kyc(p_id uuid, p_decision text, p_reason text default null, p_note text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
    v_sub  public.kyc_submissions;
    v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
    if not public.is_admin() then return json_build_object('ok', false, 'error', 'forbidden'); end if;
    if p_decision is null or p_decision not in ('approve', 'reject', 'revoke') then
        return json_build_object('ok', false, 'error', 'bad_decision');
    end if;
    select * into v_sub from public.kyc_submissions where id = p_id for update;
    if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
    if not ((p_decision = 'revoke' and v_sub.status = 'approved')
            or (p_decision <> 'revoke' and v_sub.status = 'pending')) then
        return json_build_object('ok', false, 'error', 'already_decided', 'status', v_sub.status);
    end if;

    if p_decision = 'approve' then
        update public.kyc_submissions
           set status = 'approved', reviewed_by = public.current_app_user_id(), reviewed_at = now()
         where id = p_id;
    else
        if p_reason is null or p_reason not in ('unreadable', 'incomplete', 'expired', 'mismatch', 'not_original', 'other') then
            return json_build_object('ok', false, 'error', 'bad_reason');
        end if;
        if p_reason = 'other' and v_note is null then
            return json_build_object('ok', false, 'error', 'note_required');
        end if;
        if char_length(v_note) > 500 then
            return json_build_object('ok', false, 'error', 'note_too_long');
        end if;
        update public.kyc_submissions
           set status = 'rejected', reject_reason = p_reason, review_note = v_note,
               reviewed_by = public.current_app_user_id(), reviewed_at = now()
         where id = p_id;
    end if;

    -- The decided submission is always the member's latest (a new one can only
    -- follow a rejection), so their verification state follows it.
    update public.users set kyc_status = case p_decision when 'approve' then 'approved' else 'rejected' end
     where id = v_sub.user_id;
    return json_build_object('ok', true, 'status', case p_decision when 'approve' then 'approved' else 'rejected' end);
end $$;
