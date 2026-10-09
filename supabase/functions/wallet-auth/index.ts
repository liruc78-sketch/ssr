// ============================================================================
// Crypto.ssr — wallet-auth edge function (SIWE: sign-in with Ethereum)
// Deployed to project wovplubneljhoaliqkmk with verify_jwt = false (login endpoint).
// Verifies a wallet signature server-side and issues a real Supabase session,
// so wallet users get a JWT (auth.uid()) for RLS. No key/secret on the client.
// Accepts plain EOA signatures and smart-wallet (ERC-1271 / ERC-6492) ones —
// see verify.ts. Deploy BOTH files.
//   POST { action: 'nonce',  address }                       -> { message }
//   POST { action: 'verify', address, signature, chainId? } -> { ok, token_hash, via }
//   Errors: { error, code } — code ∈ bad_address | bad_signature | unsupported_chain |
//           challenge_missing | challenge_expired | rpc_unavailable (503) | account_conflict (409)
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { Address } from 'https://esm.sh/viem@2.56.7';
import { CONTRACT_CHAINS, isContractShaped, parseChainId, verifyWalletSignature } from './verify.ts';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function msgFor(address: string, nonce: string): string {
  return `Sign in to Crypto.ssr\n\nWallet: ${address}\nNonce: ${nonce}`;
}
function emailFor(address: string): string {
  return `${address.toLowerCase()}@wallet.cryptossr.local`;
}

// listUsers() is paged (50 by default), so walk every page instead of only the first.
async function authUserByEmail(email: string): Promise<any | undefined> {
  const perPage = 1000;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u: any) => u.email === email);
    if (hit) return hit;
    if (data.users.length < perPage) return undefined;
  }
  return undefined;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({} as any));
    const action = body?.action;
    const address = String(body?.address || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) return json({ error: 'Invalid wallet address', code: 'bad_address' }, 400);

    if (action === 'nonce') {
      const nonce = crypto.randomUUID();
      const { error } = await admin.from('wallet_auth_nonces')
        .upsert({ address, nonce, created_at: new Date().toISOString() });
      if (error) throw error;
      return json({ message: msgFor(address, nonce) });
    }

    if (action === 'verify') {
      const signature = body?.signature;
      if (!signature) return json({ error: 'Missing signature', code: 'bad_signature' }, 400);

      // Consume the challenge atomically: one verify attempt per nonce, so two
      // concurrent verifies can never both pass.
      const { data: rows, error: ce } = await admin.from('wallet_auth_nonces')
        .delete().eq('address', address).select('nonce, created_at');
      if (ce) throw ce;
      const row = rows?.[0];
      if (!row) return json({ error: 'No login challenge found — request one first', code: 'challenge_missing' }, 400);
      if (Date.now() - new Date(row.created_at).getTime() > 5 * 60 * 1000)
        return json({ error: 'Login challenge expired, please retry', code: 'challenge_expired' }, 400);

      const verdict = await verifyWalletSignature(address as Address, msgFor(address, row.nonce), signature);
      const sigBytes = typeof signature === 'string' ? Math.max(0, (signature.length - 2) / 2) : 0;
      const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
      if (!verdict.ok) {
        console.warn(`wallet-auth reject ${verdict.reason} chain=${parseChainId(body?.chainId) ?? '-'} sigBytes=${sigBytes} addr=${short}`);
        if (verdict.reason === 'rpc_unavailable')
          return json({ error: 'Signature verifier unavailable, please retry', code: 'rpc_unavailable' }, 503);
        // A smart-wallet signature made on a chain we don't verify on (or not the chain the
        // wallet is deployed on) can never pass — tell the client to switch networks.
        const hint = parseChainId(body?.chainId);
        const code = verdict.reason === 'wrong_chain' ||
          (typeof signature === 'string' && isContractShaped(signature) && hint && !CONTRACT_CHAINS.includes(hint))
          ? 'unsupported_chain' : 'bad_signature';
        return json({ error: 'Signature verification failed', code }, 401);
      }
      console.log(`wallet-auth ok via=${verdict.via}${verdict.via === 'contract' ? '@' + verdict.chainId : ''} chain=${parseChainId(body?.chainId) ?? '-'} sigBytes=${sigBytes} addr=${short}`);

      const email = emailFor(address);
      const conflict = (why: string) => {
        console.error(`wallet-auth account_conflict (${why}) addr=${short}`);
        return json({ error: 'Account conflict — please contact support', code: 'account_conflict' }, 409);
      };
      let authUserId: string | undefined;

      const { data: existing } = await admin.from('users').select('id, auth_id').eq('wallet_address', address).maybeSingle();
      if (existing?.auth_id) {
        authUserId = existing.auth_id;
      } else {
        // app_metadata can only be written with the service role, so `wallet` marks auth
        // users this function created (db/2026-wallet-auth-guard.sql backfills older ones).
        const created = await admin.auth.admin.createUser({
          email, email_confirm: true, app_metadata: { wallet: address }, user_metadata: { wallet: address },
        });
        if (created.data?.user) {
          authUserId = created.data.user.id;
        } else {
          // The email is taken (e.g. an earlier half-finished login). Reuse that auth user
          // only if we made it: anyone can sign up with this address's email, and linking
          // the wallet to their user would hand them the account.
          const found = await authUserByEmail(email);
          if (found && found.app_metadata?.wallet !== address) return conflict('unmarked auth user');
          authUserId = found?.id;
        }
        if (!authUserId) throw new Error('Could not provision auth user');
        if (existing?.id) {
          const { data: linked, error: le } = await admin.from('users')
            .update({ auth_id: authUserId }).eq('id', existing.id).is('auth_id', null).select('id');
          if (le) throw le;
          if (linked?.length !== 1) return conflict('link failed');
        } else {
          const shortAddr = address.slice(0, 6) + '...' + address.slice(-4);
          const { data: nu, error: ie } = await admin.from('users')
            .insert({ wallet_address: address, auth_id: authUserId, display_name: `User ${shortAddr}`, username: `wallet_${address.slice(2, 10)}` })
            .select('id').single();
          if (ie) throw ie;
          if (nu) await admin.from('portfolios').insert({ user_id: nu.id, usd_balance: 0 });
        }
      }

      const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      if (link.error) throw link.error;
      // The session must belong to the auth user this wallet row is linked to.
      if (link.data?.user?.id !== authUserId) return conflict('link user mismatch');
      const token_hash = (link.data as any)?.properties?.hashed_token;
      if (!token_hash) throw new Error('Could not issue session');
      return json({ ok: true, token_hash, via: verdict.via });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('wallet-auth error', e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
