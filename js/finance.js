// ============================================================================
// Crypto.ssr — Finance / Earn subscriptions (USD-funded)
// Subscribes against portfolios.usd_balance and records finance_subscriptions.
// Daily accrual + redemption are handled by a scheduled job (see db/2026-finance.sql).
// ============================================================================
import { sb } from './supabase.js';
import { store } from './store.js';
import { refreshPortfolio } from './auth.js';

export const FINANCE_MIN_USD = 100;

// Subscribe `amountUsd` (USD) — server-side (finance_subscribe RPC): debit +
// record atomically for the signed-in caller. No client-side balance write.
export async function subscribeFinance({ product, amountUsd }) {
    if (!store.session?.userId) { const e = new Error('Please sign in first'); e.code = 'AUTH'; throw e; }
    const { data, error } = await sb.rpc('finance_subscribe', {
        p_product_id: product.id, p_product_name: product.name, p_asset: product.asset,
        p_amount: parseFloat(amountUsd), p_daily_rate: product.dmax, p_term_days: product.term || 0,
    });
    if (error) throw new Error(error.message || 'Subscription failed');
    if (data && data.ok === false) throw new Error(data.error || 'Subscription failed');
    await refreshPortfolio();
    return { ok: true };
}

export async function loadHoldings() {
    if (!store.session?.userId) return [];
    const { data } = await sb.from('finance_subscriptions').select('*').eq('user_id', store.session.userId).order('created_at', { ascending: false }).limit(50);
    return data || [];
}

// Redeem a subscription (flexible, or matured fixed): credits principal + accrued.
export async function redeemSubscription(subId) {
    const { data, error } = await sb.rpc('finance_redeem', { p_sub_id: subId });
    if (error) {
        if (/function|does not exist|schema cache|404/i.test(error.message || '')) throw new Error('Redemption isn’t enabled on the backend yet — run the finance accrual migration.');
        throw error;
    }
    if (data && data.ok === false) throw new Error(data.error || 'Could not redeem');
    await refreshPortfolio();
    return data;
}
