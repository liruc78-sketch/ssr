// ============================================================================
// Crypto.ssr — Trade execution (Options / binary first)
// Mirrors the legacy openPosition + trade-settle flow exactly, against the same
// positions + portfolios tables and the same trade-settle edge function.
// ============================================================================
import { sb, SUPABASE_ANON, EDGE_BASE, CG_KEY } from './supabase.js';
import { store } from './store.js';
import { refreshPortfolio } from './auth.js';

// Fees: 0.2% trading fee + $0.5 platform fee (same as legacy).
export const tradeFee = (amount) => amount * 0.002 + 0.5;
export const tradeTotal = (amount) => amount + tradeFee(amount);

async function cgPrice(cgId) {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&x_cg_demo_api_key=${CG_KEY}`);
    const data = await res.json();
    const p = data?.[cgId]?.usd;
    if (!p) throw new Error('Unable to fetch price');
    return p;
}

// Settle one position via the edge function, then refresh balances.
export async function settlePosition(positionId) {
    try {
        await fetch(`${EDGE_BASE}/trade-settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
            body: JSON.stringify({ positionId, userId: store.session?.userId }),
        });
        await refreshPortfolio();
    } catch (e) { console.error('Settlement failed:', e); }
}

// Sweep expired Active positions (for ones whose timer never fired).
let sweepInFlight = false;
export async function sweepPositions() {
    if (sweepInFlight || !store.session?.userId) return;
    sweepInFlight = true;
    try {
        const res = await fetch(`${EDGE_BASE}/trade-settle`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON }, body: JSON.stringify({}),
        });
        const out = await res.json().catch(() => ({}));
        if (out?.swept > 0) await refreshPortfolio();
    } catch (e) { console.warn('sweep failed:', e); }
    finally { sweepInFlight = false; }
}

// Open a binary (Options) position. tier: { sec, min, payout }.
// Returns { ok, position } or throws with a user-facing message.
export async function openOptionPosition({ coin, type, amount, tier }) {
    if (!store.session?.userId) { const e = new Error('Please sign in to trade'); e.code = 'AUTH'; throw e; }
    const amt = parseFloat(amount);
    if (!(amt > 0)) throw new Error('Please enter a valid amount');
    if (!coin?.cg) throw new Error('This asset is not available for options yet');
    if (store.portfolio.usdBalance < (tier.min || 0)) {
        const need = tier.min >= 1e6 ? '$' + tier.min / 1e6 + 'M' : '$' + tier.min / 1e3 + 'K';
        const e = new Error(`${tier.label} tier requires balance ≥ ${need} — deposit first`); e.code = 'TIER'; throw e;
    }

    const price = await cgPrice(coin.cg);
    const total = tradeTotal(amt);

    // Re-read balance server-side (fail safe — never assume broke on a blip).
    const { data: pd, error: balErr } = await sb.from('portfolios').select('usd_balance').eq('user_id', store.session.userId).single();
    if (balErr || !pd) { store.connectionLost = true; const e = new Error('Connection error, please try again'); e.code = 'CONN'; throw e; }
    if (parseFloat(pd.usd_balance) < total) { const e = new Error('Insufficient balance (incl. fees)'); e.code = 'FUNDS'; throw e; }

    // Deduct principal + fees, then record the position (principal only in `amount`).
    await sb.from('portfolios').update({ usd_balance: parseFloat(pd.usd_balance) - total }).eq('user_id', store.session.userId);
    const { data: pos, error } = await sb.from('positions').insert({
        user_id: store.session.userId, coin_id: coin.cg, type, amount: amt, entry_price: price, status: 'Active', duration_seconds: tier.sec,
    }).select().single();
    if (error) throw error;

    await refreshPortfolio();
    setTimeout(() => settlePosition(pos.id), tier.sec * 1000);
    return { ok: true, position: pos };
}
