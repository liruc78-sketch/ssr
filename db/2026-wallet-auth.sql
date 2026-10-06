-- ============================================================================
-- Crypto.ssr — Wallet SIWE auth (Phase A of the security hardening)
-- Applied to project wovplubneljhoaliqkmk. Kept here for the record.
--
-- One-time login challenges used by the wallet-auth edge function. RLS is ON
-- with NO policies, so ONLY the edge function (service_role, which bypasses RLS)
-- can read/write it — the public anon/authenticated roles cannot touch it.
-- ============================================================================

create table if not exists public.wallet_auth_nonces (
  address    text primary key,
  nonce      text not null,
  created_at timestamptz not null default now()
);
alter table public.wallet_auth_nonces enable row level security;

-- Edge function: supabase/functions/wallet-auth/index.ts (verify_jwt = false).
-- Flow: client gets a nonce, signs it with the wallet (personal_sign), the edge
-- function verifies the signature, provisions/links a Supabase Auth user, and
-- returns a session token_hash the client exchanges via auth.verifyOtp().
