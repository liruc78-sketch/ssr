// ============================================================================
// Crypto.ssr — Deposits & withdrawals (mirrors the legacy admin-confirmed flow)
// Tables: payment_addresses (admin receiving addrs), recharge_orders, withdrawals.
// ============================================================================
import { sb } from './supabase.js';
import { store } from './store.js';
import { refreshPortfolio } from './auth.js';
import { cgPrice } from './data.js';

// `id`/network `id` must match the admin panel's COIN_NETWORKS and the
// payment_addresses rows (create_recharge_order looks the address up by them).
// Network `desc` is an i18n key.
export const DEPOSIT_COINS = [
    { id: 'usdt', name: 'Tether',   symbol: 'USDT', cgId: 'tether',      rate: 1,      minAmt: 10,
      networks: [ { id: 'trc20', label: 'TRC20 (Tron)', desc: 'deposit.netLowFeesFast' }, { id: 'erc20', label: 'ERC20 (Ethereum)', desc: 'deposit.netSecureStable' }, { id: 'bep20', label: 'BEP20 (BSC)', desc: 'deposit.netVeryLowFees' } ] },
    { id: 'usdc', name: 'USD Coin', symbol: 'USDC', cgId: 'usd-coin',    rate: 1,      minAmt: 10,
      networks: [ { id: 'erc20', label: 'ERC20 (Ethereum)', desc: 'deposit.netMainstream' }, { id: 'sol', label: 'Solana', desc: 'deposit.netVeryFast' }, { id: 'bep20', label: 'BEP20 (BSC)', desc: 'deposit.netLowFees' } ] },
    { id: 'btc', name: 'Bitcoin',  symbol: 'BTC', cgId: 'bitcoin',      rate: 103000, minAmt: 0.0001,
      networks: [ { id: 'btc', label: 'Bitcoin Mainnet', desc: 'deposit.netNative' }, { id: 'lbtc', label: 'Lightning', desc: 'deposit.netInstant' } ] },
    { id: 'eth', name: 'Ethereum', symbol: 'ETH', cgId: 'ethereum',     rate: 2500,   minAmt: 0.005,
      networks: [ { id: 'erc20', label: 'ERC20 (Ethereum)', desc: 'deposit.netNative' }, { id: 'arb', label: 'Arbitrum', desc: 'deposit.netL2LowFees' }, { id: 'op', label: 'Optimism', desc: 'deposit.netL2' } ] },
    { id: 'xrp', name: 'XRP',      symbol: 'XRP', cgId: 'ripple',       rate: 1.4,    minAmt: 10,
      networks: [ { id: 'xrp', label: 'XRP Ledger', desc: 'deposit.netNative' } ] },
    { id: 'trx', name: 'TRON',     symbol: 'TRX', cgId: 'tron',         rate: 0.25,   minAmt: 100,
      networks: [ { id: 'trc20', label: 'TRC20 (Tron)', desc: 'deposit.netNative' } ] },
];

export const WITHDRAW_MIN = 10;
export const withdrawFee = (amount) => amount * 0.01 + 2;   // 1% + $2 (legacy)
export const withdrawTotal = (amount) => amount + withdrawFee(amount);

// Live rate for a deposit coin (USD per 1 unit); falls back to the configured rate.
export async function depositRate(coin) {
    if (coin.id === 'usdt' || coin.id === 'usdc') return 1;
    try { return await cgPrice(coin.cgId); } catch { return Number(coin.rate) || 1; }
}

// Create a pending recharge order server-side (create_recharge_order RPC):
// the receiving address lookup + order insert happen server-side for the caller.
// Returns { orderId, orderIdShort, address, uniqueAmt, usdAmt, expireAt }.
export async function createRechargeOrder({ coin, network, cryptoAmount, rate }) {
    if (!store.session?.userId) { const e = new Error('Please sign in first'); e.code = 'AUTH'; throw e; }
    const base = parseFloat(cryptoAmount);
    if (!(base > 0)) throw new Error('Enter an amount');
    if (base < coin.minAmt) throw new Error(`Minimum deposit is ${coin.minAmt} ${coin.symbol}`);
    const usdAmt = base * (rate || 1);

    const { data, error } = await sb.rpc('create_recharge_order', {
        p_coin_id: coin.id, p_coin_symbol: coin.symbol, p_network: network.id, p_network_label: network.label,
        p_crypto_amount: base, p_usd_amount: usdAmt,
    });
    if (error) throw new Error(error.message || 'Could not create order');
    if (data && data.ok === false) { const e = new Error(data.error || 'Could not create order'); e.code = 'NOADDR'; throw e; }

    return {
        orderId: data.orderId,
        orderIdShort: String(data.orderId).replace(/-/g, '').toUpperCase().slice(0, 16),
        address: data.address, uniqueAmt: Number(data.uniqueAmt), usdAmt,
        decimals: coin.minAmt < 0.01 ? 6 : coin.minAmt < 1 ? 4 : 3,
        expireAt: Date.now() + 60 * 60 * 1000,
    };
}

// Poll an order's status; credits are applied server-side (admin). Returns 'pending' | 'paid' | other.
export async function checkRechargeStatus(orderId) {
    const { data } = await sb.from('recharge_orders').select('status').eq('id', orderId).single();
    if (data?.status === 'paid') await refreshPortfolio();
    return data?.status || 'pending';
}

// Submit a withdrawal — server-side (request_withdrawal RPC): deduct + record
// atomically, enforced for the signed-in caller. No client-side balance write.
export async function submitWithdrawal({ amount, address }) {
    if (!store.session?.userId) { const e = new Error('Please sign in first'); e.code = 'AUTH'; throw e; }
    const { data, error } = await sb.rpc('request_withdrawal', { p_amount: parseFloat(amount), p_address: address });
    if (error) throw new Error(error.message || 'Withdrawal failed');
    if (data && data.ok === false) throw new Error(data.error || 'Withdrawal failed');
    await refreshPortfolio();
    return { ok: true };
}

// Records for the History screen.
export async function loadRecords(kind) {
    if (!store.session?.userId) return [];
    const table = kind === 'withdraw' ? 'withdrawals' : 'recharge_orders';
    const { data } = await sb.from(table).select('*').eq('user_id', store.session.userId).order('created_at', { ascending: false }).limit(50);
    return data || [];
}
