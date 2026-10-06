// ============================================================================
// Crypto.ssr — trade-open edge function (Options / binary open), verify_jwt = true.
// Opens a position server-side for the signed-in caller: live price, tier gate,
// balance check, debit (principal + fee) and insert — so the client can never
// set its own entry price or balance. Settlement stays in trade-settle.
//   POST { coinId, type: 'up'|'down', amount, durationSeconds } (Authorization: user JWT)
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CG = 'CG-rqTDnjCErgK6hEq9x6s8RKzD';
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tier min-balance to unlock a duration (must match the frontend OPTION_TIERS).
const TIER_MIN: Record<number, number> = { 30: 0, 60: 10000, 120: 200000, 240: 500000, 480: 1000000 };
const tradingFee = (amt: number) => amt * 0.002 + 0.5;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user: authUser } } = await admin.auth.getUser(token);
    if (!authUser) return json({ error: 'Not signed in' }, 401);
    const { data: appUser } = await admin.from('users').select('id').eq('auth_id', authUser.id).single();
    if (!appUser) return json({ error: 'No linked account' }, 400);
    const uid = appUser.id;

    const body = await req.json().catch(() => ({} as any));
    const coinId = String(body?.coinId || '');
    const type = body?.type === 'down' ? 'down' : 'up';
    const amount = Number(body?.amount);
    const duration = Number(body?.durationSeconds) || 30;
    if (!coinId) return json({ error: 'Missing coin' }, 400);
    if (!(amount > 0)) return json({ error: 'Enter a valid amount' }, 400);
    const tierMin = TIER_MIN[duration] ?? 0;

    const { data: pf } = await admin.from('portfolios').select('usd_balance').eq('user_id', uid).single();
    if (!pf) return json({ error: 'No account balance' }, 400);
    const bal = parseFloat(pf.usd_balance);
    if (bal < tierMin) return json({ error: `This tier requires a balance of at least $${tierMin.toLocaleString()}` }, 400);

    let price = 0;
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { headers: { 'x-cg-demo-api-key': CG } });
      const d = await r.json();
      price = d?.[coinId]?.usd;
    } catch (_) {}
    if (!price) return json({ error: 'Unable to fetch price, try again' }, 400);

    const total = amount + tradingFee(amount);
    if (bal < total) return json({ error: 'Insufficient balance (incl. fees)' }, 400);

    await admin.from('portfolios').update({ usd_balance: bal - total }).eq('user_id', uid);
    const { data: pos, error } = await admin.from('positions').insert({
      user_id: uid, coin_id: coinId, type, amount, entry_price: price, status: 'Active', duration_seconds: duration,
    }).select('id').single();
    if (error) {
      await admin.from('portfolios').update({ usd_balance: bal }).eq('user_id', uid); // rollback
      throw error;
    }
    return json({ ok: true, positionId: pos.id, entryPrice: price });
  } catch (e) {
    console.error('trade-open error', e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
