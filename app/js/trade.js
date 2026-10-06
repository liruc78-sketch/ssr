// ============================================================================
// Crypto.ssr — Trade execution (Options / binary first)
// Mirrors the legacy openPosition + trade-settle flow exactly, against the same
// positions + portfolios tables and the same trade-settle edge function.
// ============================================================================
import { sb, SUPABASE_ANON, EDGE_BASE } from './supabase.js';
import { store } from './store.js';
import { refreshPortfolio } from './auth.js';

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

// Open a binary (Options) position via the server (trade-open edge function):
// price fetch, tier gate, balance check, debit and insert all happen server-side
// with the caller's session. No client-side balance write.
export async function openOptionPosition({ coin, type, amount, tier }) {
    if (!store.session?.userId) { const e = new Error('Please sign in to trade'); e.code = 'AUTH'; throw e; }
    if (!coin?.cg) throw new Error('This asset is not available for options yet');
    const amt = parseFloat(amount);
    if (!(amt > 0)) throw new Error('Please enter a valid amount');

    const { data, error } = await sb.functions.invoke('trade-open', {
        body: { coinId: coin.cg, type, amount: amt, durationSeconds: tier.sec },
    });
    if (error) {
        let msg = 'Could not place trade';
        try { msg = (await error.context.json())?.error || msg; } catch {}
        throw new Error(msg);
    }
    if (data && data.ok === false) throw new Error(data.error || 'Could not place trade');

    await refreshPortfolio();
    setTimeout(() => settlePosition(data.positionId), tier.sec * 1000);
    return { ok: true, positionId: data.positionId };
}
