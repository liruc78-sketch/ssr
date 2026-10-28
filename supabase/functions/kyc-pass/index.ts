// ============================================================================
// Crypto.ssr — kyc-pass edge function (KYC upload pass), verify_jwt = true.
// Before the KYC page uploads ID photos it runs a Cloudflare Turnstile check and
// posts the token here. Once Siteverify accepts it for this site and action, the
// signed-in member gets an upload pass for that attempt (1 or 2 photos, 10 min);
// the storage trigger kyc_objects_guard spends one use per photo
// (supabase/migrations/20261028020904_kyc_upload_gate.sql). Tokens are single use,
// so every upload attempt costs a solved check.
//   POST { token, photos } (Authorization: user JWT)
//   -> { ok: true, photos, expires_at } or { ok: false, error } where error is
//      not_configured | not_signed_in | check_failed | unavailable, or what
//      kyc_upload_block says (already_pending | already_verified | member_limit | busy)
// Secret: TURNSTILE_SECRET_KEY (the widget's secret key, Edge Function secrets).
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
const ACTION = 'kyc_upload';
// Where the widget runs. Local previews use Cloudflare's test keys, whose dummy
// tokens the real secret never accepts, so no local hostname belongs here.
const HOSTNAMES = new Set(['www.cryptossr.com', 'cryptossr.com']);
const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ ok: false, error: 'bad_request' }, 405);
  // Checked first, so a plain anon-key request shows whether the secret is set (503 vs 401).
  if (!SECRET) return json({ ok: false, error: 'not_configured' }, 503);

  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return json({ ok: false, error: 'not_signed_in' }, 401);

    const body = await req.json().catch(() => null);
    const token = body?.token;
    const photos = body?.photos === 1 ? 1 : 2;
    if (typeof token !== 'string' || !token || token.length > 2048) return json({ ok: false, error: 'check_failed' }, 403);

    // Siteverify, failing closed: no pass unless Cloudflare says yes for this site and action.
    const ip = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const form = new URLSearchParams({ secret: SECRET, response: token });
    if (ip) form.set('remoteip', ip);
    let result: any;
    try {
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', body: form, signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) throw new Error(`siteverify ${r.status}`);
      result = await r.json();
    } catch (e) {
      console.error('kyc-pass siteverify', String((e as any)?.message || e));
      return json({ ok: false, error: 'unavailable' }, 503);
    }
    if (result?.success !== true || result.action !== ACTION || !HOSTNAMES.has(result.hostname)) {
      // invalid-input-secret here means TURNSTILE_SECRET_KEY doesn't belong to the widget.
      console.warn('kyc-pass refused', JSON.stringify({ codes: result?.['error-codes'], action: result?.action, hostname: result?.hostname }));
      return json({ ok: false, error: 'check_failed' }, 403);
    }

    const { data, error } = await admin.rpc('kyc_issue_upload_pass', { p_auth_id: user.id, p_photos: photos });
    if (error) throw error;
    return json(data);
  } catch (e) {
    console.error('kyc-pass error', String((e as any)?.message || e));
    return json({ ok: false, error: 'unavailable' }, 500);
  }
});
