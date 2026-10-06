// ============================================================================
// Crypto.ssr — Finance / Earn subscriptions (USD-funded)
// Subscribes against portfolios.usd_balance and records finance_subscriptions.
// Daily accrual + redemption are handled by a scheduled job (see db/2026-finance.sql).
// ============================================================================
import { sb } from './supabase.js';
import { store } from './store.js';
import { refreshPortfolio } from './auth.js';

export const FINANCE_MIN_USD = 100;

// Subscribe `amountUsd` (USD) to a finance product; debits the USD balance.
export async function subscribeFinance({ product, amountUsd }) {
    if (!store.session?.userId) { const e = new Error('Please sign in first'); e.code = 'AUTH'; throw e; }
    const amt = parseFloat(amountUsd);
    if (!(amt > 0)) throw new Error('Enter an amount');
    if (amt < FINANCE_MIN_USD) throw new Error(`Minimum subscription is $${FINANCE_MIN_USD}`);

    const { data: pd, error: balErr } = await sb.from('portfolios').select('usd_balance').eq('user_id', store.session.userId).single();
    if (balErr || !pd) { store.connectionLost = true; throw new Error('Connection error, please try again'); }
    const before = parseFloat(pd.usd_balance);
    if (before < amt) throw new Error('Insufficient balance');

    await sb.from('portfolios').update({ usd_balance: before - amt }).eq('user_id', store.session.userId);
    const { error: insErr } = await sb.from('finance_subscriptions').insert({
        user_id: store.session.userId, product_id: product.id, product_name: product.name, asset: product.asset,
        amount: amt, daily_rate: product.dmax, term_days: product.term, status: 'active',
    });
    if (insErr) {
        await sb.from('portfolios').update({ usd_balance: before }).eq('user_id', store.session.userId);  // rollback
        if (/relation|does not exist|schema cache|404/i.test(insErr.message || '')) throw new Error('Finance isn’t enabled on the backend yet — run db/2026-finance.sql.');
        throw new Error('Subscription failed — please try again');
    }
    await refreshPortfolio();
    return { ok: true };
}

export async function loadHoldings() {
    if (!store.session?.userId) return [];
    const { data } = await sb.from('finance_subscriptions').select('*').eq('user_id', store.session.userId).order('created_at', { ascending: false }).limit(50);
    return data || [];
}
