-- ============================================================================
-- Crypto.ssr — Reserve the wallet login email domain for the wallet-auth function
-- Run ONCE for project `wovplubneljhoaliqkmk`, BEFORE deploying the wallet-auth
-- version that checks app_metadata.wallet. Safe to re-run (idempotent).
-- APPLIED 2026-10-08 as migration `wallet_auth_email_guard` (wallet-auth v3 deployed after it).
--
-- wallet-auth gives every wallet a Supabase Auth user `<address>@wallet.cryptossr.local`.
-- That email is guessable, and public email sign-up is on — so anyone could
-- register it with a password first and, when the real owner later signs in
-- with the wallet, get that wallet's users row linked to THEIR auth user.
--
-- wallet-auth now marks the auth users it creates with app_metadata.wallet
-- (only the service role can write app_metadata) and refuses to link to an
-- unmarked one. This file (1) marks the wallet users it created before that,
-- and (2) stops anyone else from creating or switching to that domain.
-- ============================================================================

-- 1) Backfill the marker on wallet users the function created: those a public.users
--    row with the SAME wallet_address points at. Only the service role (wallet-auth)
--    or an admin can set users.wallet_address, so a squatter can't produce that link.
--    (Don't use "has no password" as the test: GoTrue's admin createUser gives every
--    user it creates a random 64-char password.)
update auth.users a
set raw_app_meta_data = coalesce(a.raw_app_meta_data, '{}'::jsonb)
                      || jsonb_build_object('wallet', lower(split_part(a.email, '@', 1)))
where a.email ilike '%@wallet.cryptossr.local'
  and coalesce(a.raw_app_meta_data->>'wallet', '') = ''
  and exists (select 1 from public.users u
              where u.auth_id = a.id and lower(u.wallet_address) = lower(split_part(a.email, '@', 1)));

-- 2) Only an auth user carrying the matching marker may hold a wallet-domain email.
--    Checked at COMMIT (deferred constraint trigger), reading the row's final state:
--    GoTrue's admin createUser INSERTs the user first and writes app_metadata in a
--    second statement of the same transaction, so a BEFORE INSERT check would block
--    wallet-auth itself. A public sign-up can never set app_metadata, so it fails.
create or replace function public.guard_wallet_auth_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur record;
begin
  select email, raw_app_meta_data into cur from auth.users where id = new.id;
  if found and cur.email ilike '%@wallet.cryptossr.local'
     and coalesce(cur.raw_app_meta_data->>'wallet', '') <> lower(split_part(cur.email, '@', 1)) then
    raise exception 'This email domain is reserved' using errcode = '42501';
  end if;
  return null;
end;
$$;
revoke execute on function public.guard_wallet_auth_email() from public, anon, authenticated;

drop trigger if exists guard_wallet_auth_email on auth.users;
create constraint trigger guard_wallet_auth_email
  after insert or update of email on auth.users
  deferrable initially deferred
  for each row execute function public.guard_wallet_auth_email();

-- ----------------------------------------------------------------------------
-- AUDIT (read-only) — run after applying. Any row here is a wallet-domain auth
-- user without the marker, i.e. not tied to its wallet's users row: it was not
-- made by wallet-auth (or its login was interrupted). wallet-auth answers 409
-- account_conflict for that wallet until an admin reviews it.
-- When first applied (2026-10-08) there was 1 wallet-domain auth user, linked
-- and marked, and this returned no rows.
-- ----------------------------------------------------------------------------
-- select a.id, a.email, a.created_at, u.id as linked_user_id, u.wallet_address
-- from auth.users a
-- left join public.users u on u.auth_id = a.id
-- where a.email ilike '%@wallet.cryptossr.local'
--   and coalesce(a.raw_app_meta_data->>'wallet', '') <> lower(split_part(a.email, '@', 1));
