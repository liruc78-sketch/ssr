// ============================================================================
// Crypto.ssr — Deposits & withdrawals (mirrors the legacy admin-confirmed flow)
// Tables: payment_addresses (admin receiving addrs), recharge_orders, withdrawals.
// ============================================================================
import { sb } from './supabase.js';
import { store } from './store.js';
import { refreshPortfolio } from './auth.js';
import { cgPrice } from './data.js';

export const DEPOSIT_COINS = [
    { id: 'usdt', name: 'Tether',   symbol: 'USDT', cgId: 'tether',      rate: 1,      minAmt: 10,
      networks: [ { id: 'trc20', label: 'TRC20 (Tron)', desc: 'Low fees, fast' }, { id: 'erc20', label: 'ERC20 (Ethereum)', desc: 'Secure & stable' }, { id: 'bep20', label: 'BEP20 (BSC)', desc: 'Very low fees' } ] },
    { id: 'usdc', name: 'USD Coin', symbol: 'USDC', cgId: 'usd-coin',    rate: 1,      minAmt: 10,
      networks: [ { id: 'erc20', label: 'ERC20 (Ethereum)', desc: 'Mainstream' }, { id: 'sol', label: 'Solana', desc: 'Very fast' }, { id: 'bep20', label: 'BEP20 (BSC)', desc: 'Low fees' } ] },
    { id: 'btc', name: 'Bitcoin',  symbol: 'BTC', cgId: 'bitcoin',      rate: 103000, minAmt: 0.0001,
      networks: [ { id: 'btc', label: 'Bitcoin Mainnet', desc: 'Native network' }, { id: 'lbtc', label: 'Lightning', desc: 'Instant credit' } ] },
    { id: 'eth', name: 'Ethereum', symbol: 'ETH', cgId: 'ethereum',     rate: 2500,   minAmt: 0.005,
      networks: [ { id: 'erc20', label: 'ERC20 (Ethereum)', desc: 'Native network' }, { id: 'arb', label: 'Arbitrum', desc: 'Layer2, low fees' }, { id: 'op', label: 'Optimism', desc: 'Layer2' } ] },
    { id: 'bnb', name: 'BNB',      symbol: 'BNB', cgId: 'binancecoin',  rate: 600,    minAmt: 0.01,
      networks: [ { id: 'bep20', label: 'BEP20 (BSC)', desc: 'Native network' } ] },
    { id: 'trx', name: 'TRON',     symbol: 'TRX', cgId: 'tron',         rate: 0.25,   minAmt: 100,
      networks: [ { id: 'trc20', label: 'TRC20 (Tron)', desc: 'Native network' } ] },
];

export const WITHDRAW_MIN = 10;
export const withdrawFee = (amount) => amount * 0.01 + 2;   // 1% + $2 (legacy)
export const withdrawTotal = (amount) => amount + withdrawFee(amount);

// Live rate for a deposit coin (USD per 1 unit); falls back to the configured rate.
export async function depositRate(coin) {
    if (coin.id === 'usdt' || coin.id === 'usdc') return 1;
    try { return await cgPrice(coin.cgId); } catch { return Number(coin.rate) || 1; }
}

// Create a pending recharge order against an admin-configured receiving address.
// Returns { orderId, orderIdShort, address, uniqueAmt, usdAmt, expireAt }.
export async function createRechargeOrder({ coin, network, cryptoAmount, rate }) {
    if (!store.session?.userId) { const e = new Error('Please sign in first'); e.code = 'AUTH'; throw e; }
    const base = parseFloat(cryptoAmount);
    if (!(base > 0)) throw new Error('Enter an amount');
    if (base < coin.minAmt) throw new Error(`Minimum deposit is ${coin.minAmt} ${coin.symbol}`);

    const { data: addrs } = await sb.from('payment_addresses').select('address').eq('coin_id', coin.id).eq('network', network.id).limit(1);
    const address = addrs?.[0]?.address;
    if (!address) { const e = new Error(`No receiving address is configured for ${coin.symbol} on ${network.label} yet. Please contact support.`); e.code = 'NOADDR'; throw e; }

    const fraction = (Math.floor(Math.random() * 998) + 1) / 1000;      // collision-avoidance suffix
    const uniqueAmt = parseFloat((base + fraction * (coin.minAmt < 1 ? coin.minAmt * 0.1 : 1)).toFixed(6));
    const usdAmt = base * (rate || 1);

    const { data: order, error } = await sb.from('recharge_orders').insert({
        user_id: store.session.userId, usdt_amount: uniqueAmt, usd_amount: usdAmt, points_amount: usdAmt,
        status: 'pending', coin_id: coin.id, coin_symbol: coin.symbol, network: network.id, network_label: network.label, wallet_address: address,
    }).select().single();
    if (error) throw error;

    return {
        orderId: order.id,
        orderIdShort: order.id.replace(/-/g, '').toUpperCase().slice(0, 16),
        address, uniqueAmt, usdAmt,
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
