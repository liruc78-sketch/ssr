-- ============================================================================
-- Crypto.ssr — Email/password auth support
-- Run this ONCE in the Supabase SQL editor for project `wovplubneljhoaliqkmk`.
-- Safe to re-run (idempotent).
--
-- It lets a Supabase Auth (email/password) account link to the existing public
-- `users` table and allows wallet_address to be empty for email-only accounts.
-- Credentials themselves live in Supabase's protected `auth` schema — never in
-- `public.users` — so the public anon key can't read password hashes.
-- ============================================================================

alter table public.users
  add column if not exists email   text,
  add column if not exists auth_id uuid;

-- One users row per auth account / per email.
create unique index if not exists users_auth_id_key on public.users (auth_id);
create unique index if not exists users_email_key   on public.users (lower(email));

-- Email-only accounts have no wallet.
alter table public.users alter column wallet_address drop not null;

-- ----------------------------------------------------------------------------
-- RECOMMENDED (not required for the demo): tighten access so the public anon
-- key can't read everyone's email. This changes read rules for `users`, so only
-- apply it once the new app is the live site (it would affect the legacy site
-- which currently reads `users` freely). Left commented for now.
-- ----------------------------------------------------------------------------
-- alter table public.users enable row level security;
-- create policy "read own row" on public.users for select
--   using ( auth.uid() = auth_id );
