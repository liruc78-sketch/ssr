// ============================================================================
// Crypto.ssr — wallet-auth edge function (SIWE: sign-in with Ethereum)
// Deployed to project wovplubneljhoaliqkmk with verify_jwt = false (login endpoint).
// Verifies a wallet signature server-side and issues a real Supabase session,
// so wallet users get a JWT (auth.uid()) for RLS. No key/secret on the client.
//   POST { action: 'nonce',  address }            -> { message }
//   POST { action: 'verify', address, signature } -> { ok, token_hash }
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyMessage } from 'https://esm.sh/viem@2.21.54';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({} as any));
    const action = body?.action;
    const address = String(body?.address || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) return json({ error: 'Invalid wallet address' }, 400);

    if (action === 'nonce') {
      const nonce = crypto.randomUUID();
      const { error } = await admin.from('wallet_auth_nonces')
        .upsert({ address, nonce, created_at: new Date().toISOString() });
      if (error) throw error;
      return json({ message: msgFor(address, nonce) });
    }

    if (action === 'verify') {
      const signature = body?.signature;
      if (!signature) return json({ error: 'Missing signature' }, 400);

      const { data: row } = await admin.from('wallet_auth_nonces')
        .select('nonce, created_at').eq('address', address).single();
      if (!row) return json({ error: 'No login challenge found — request one first' }, 400);
      if (Date.now() - new Date(row.created_at).getTime() > 5 * 60 * 1000)
        return json({ error: 'Login challenge expired, please retry' }, 400);

      const ok = await verifyMessage({ address: address as `0x${string}`, message: msgFor(address, row.nonce), signature: signature as `0x${string}` });
      if (!ok) return json({ error: 'Signature verification failed' }, 401);
      await admin.from('wallet_auth_nonces').delete().eq('address', address); // consume (one-time)

      const email = emailFor(address);
      let authUserId: string | undefined;

      const { data: existing } = await admin.from('users').select('id, auth_id').eq('wallet_address', address).maybeSingle();
      if (existing?.auth_id) {
        authUserId = existing.auth_id;
      } else {
        const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { wallet: address } });
        if (created.data?.user) {
          authUserId = created.data.user.id;
        } else {
          const list = await admin.auth.admin.listUsers();
          authUserId = list.data.users.find((u: any) => u.email === email)?.id;
        }
        if (!authUserId) throw new Error('Could not provision auth user');
        if (existing?.id) {
          await admin.from('users').update({ auth_id: authUserId }).eq('id', existing.id);
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
      const token_hash = (link.data as any)?.properties?.hashed_token;
      if (!token_hash) throw new Error('Could not issue session');
      return json({ ok: true, token_hash });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('wallet-auth error', e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
