-- Phone number + password accounts. Applied to project wovplubneljhoaliqkmk.
-- Supabase's Phone provider needs an SMS gateway, so a phone account is an
-- email/password account whose login email is its E.164 number at a reserved
-- domain: +12067458075 -> 12067458075@phone.cryptossr.local (js/auth.js, which
-- canonicalizes what the user types with libphonenumber-js). Sign-up confirms
-- instantly, as email sign-up does (Auth "Confirm email" is off); the number is
-- not verified by SMS, so it is not proof of who owns the account.

-- The number an account signs in with; NULL for email and wallet accounts.
alter table public.users add column if not exists phone text;
create unique index if not exists users_phone_key on public.users (phone);
alter table public.users drop constraint if exists users_phone_format;
alter table public.users add constraint users_phone_format check (phone ~ '^\+[1-9][0-9]{6,14}$');

-- '<E.164 digits>@phone.cryptossr.local' -> '+<digits>'; NULL for any other email.
-- Exact and lowercase: GoTrue stores emails lowercased, and auth.users' unique
-- index on email is case-sensitive.
create or replace function public.phone_from_auth_email(p_email text)
returns text language sql immutable set search_path = '' as $$
    select '+' || substring(p_email from '^([1-9][0-9]{6,14})@phone\.cryptossr\.local$')
$$;
revoke execute on function public.phone_from_auth_email(text) from public, anon, authenticated;

-- Any login email at the phone domain must be a canonical number, and no account
-- may move into or out of the domain, so users.phone stays the number the account
-- signs in with. A member can't change their email without confirming through a
-- mailbox (there is none behind .local), but admin and dashboard edits apply at
-- once. To correct a number on purpose, as postgres in one transaction:
-- `set local session_replication_role = replica;` then update auth.users.email,
-- the email in auth.identities.identity_data and public.users.phone together.
-- This also blocks GoTrue *soft* deletes of phone users (they rewrite the email);
-- the dashboard's delete is a hard delete.
create or replace function public.guard_phone_auth_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'UPDATE' then
        if new.email is not distinct from old.email then return new; end if;
        if old.email ilike '%@phone.cryptossr.local' or new.email ilike '%@phone.cryptossr.local' then
            raise exception 'A phone account''s number cannot be changed' using errcode = '42501';
        end if;
    elsif new.email ilike '%@phone.cryptossr.local' and public.phone_from_auth_email(new.email) is null then
        raise exception 'Invalid phone number' using errcode = '22023';
    end if;
    return new;
end;
$$;
revoke execute on function public.guard_phone_auth_email() from public, anon, authenticated;

drop trigger if exists guard_phone_auth_email on auth.users;
create trigger guard_phone_auth_email
    before insert or update of email on auth.users
    for each row execute function public.guard_phone_auth_email();

-- First sign-in provisioning. The email, phone and display name now come from the
-- auth user itself, never from the caller (both parameters are ignored, kept so
-- the signature and older clients still work): a client could otherwise claim
-- any email, or a name that looks like someone else's number or wallet.
create or replace function public.provision_me(p_email text, p_display text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid; v_email text; v_phone text; v_name text;
begin
    if auth.uid() is null then return null; end if;
    -- One provisioning per user at a time (two tabs signing in at once).
    perform pg_advisory_xact_lock(hashtextextended('provision_me:' || auth.uid()::text, 0));
    select id into uid from public.users where auth_id = auth.uid();
    if uid is not null then return uid; end if;

    select email into v_email from auth.users where id = auth.uid();
    v_phone := public.phone_from_auth_email(v_email);
    if v_phone is not null then
        v_email := null;      -- a phone account's login email is no mailbox
        v_name := v_phone;
        -- A row whose auth user was deleted may still hold the number: free it,
        -- with a note for the admin. Never take it from a live account.
        update public.users u
           set phone = null,
               note = concat_ws(' | ', nullif(u.note, ''), 'phone ' || v_phone || ' released ' || current_date)
         where u.phone = v_phone
           and not exists (select 1 from auth.users a where a.id = u.auth_id);
        if exists (select 1 from public.users where phone = v_phone) then
            raise exception 'This number belongs to another account' using errcode = '23505';
        end if;
    else
        v_name := left(regexp_replace(split_part(coalesce(v_email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'), 12);
    end if;

    insert into public.users (auth_id, email, phone, display_name, username)
    values (auth.uid(), v_email, v_phone, coalesce(nullif(v_name, ''), 'user'),
            'u_' || substr(replace(auth.uid()::text, '-', ''), 1, 10))
    on conflict (auth_id) do nothing
    returning id into uid;
    if uid is null then   -- already there (the lock makes this a backstop)
        return (select id from public.users where auth_id = auth.uid());
    end if;
    insert into public.portfolios (user_id, usd_balance) values (uid, 0);
    return uid;
end;
$$;
revoke execute on function public.provision_me(text, text) from public, anon;
grant execute on function public.provision_me(text, text) to authenticated;

-- Phone accounts provisioned before this migration (none when it was written):
-- keep the number, drop the synthetic email.
update public.users u
   set phone = public.phone_from_auth_email(a.email), email = null, display_name = public.phone_from_auth_email(a.email)
  from auth.users a
 where a.id = u.auth_id
   and public.phone_from_auth_email(a.email) is not null
   and u.phone is null;

-- ----------------------------------------------------------------------------
-- AUDIT (read-only). Both should return no rows.
-- Phone-domain logins that aren't a canonical number (made before the guard):
--   select id, email from auth.users
--    where email ilike '%@phone.cryptossr.local' and public.phone_from_auth_email(email) is null;
-- Phone-domain logins without a users row: never signed in through the app (e.g.
-- created through /otp) yet they hold the number. Check, then delete the auth user:
--   select a.id, a.email, a.created_at, a.last_sign_in_at from auth.users a
--    where a.email ilike '%@phone.cryptossr.local'
--      and not exists (select 1 from public.users u where u.auth_id = a.id);
--
-- PASSWORD RESET. A phone account has no mailbox and there is no SMS, so only an
-- operator can reset it — after checking the owner by something other than the
-- (unverified) number, e.g. a deposit transaction or withdrawal address:
--   update auth.users set encrypted_password = extensions.crypt('<new password>', extensions.gen_salt('bf'))
--    where email = '<digits>@phone.cryptossr.local';
--   delete from auth.sessions
--    where user_id = (select id from auth.users where email = '<digits>@phone.cryptossr.local');
