// ============================================================================
// Crypto.ssr — Auth + portfolio
// Every user (email OR wallet) gets a real Supabase Auth session (JWT), so
// auth.uid() identifies them for RLS. Wallet login uses SIWE (sign-in with
// Ethereum) verified server-side by the `wallet-auth` edge function.
// Tables: users (linked by auth_id), portfolios, positions.
// ============================================================================
import { sb, edge } from './supabase.js';
import { setSessionMem, clearSession, setPortfolio, store } from './store.js';

// Build the in-memory session object from a users row.
function sessionFromUser(user) {
    return { userId: user.id, walletAddress: user.wallet_address || null, email: user.email || null, username: user.username, displayName: user.display_name };
}

// Mirror of legacy getUserPortfolio(userId).
export async function fetchPortfolio(userId) {
    const { data: pd, error: pErr } = await sb.from('portfolios').select('*').eq('user_id', userId).single();
    // PGRST116 ("no row") is the only legit empty case (new user). Anything else
    // is a transport failure — throw so callers keep the last-known-good balance.
    if (pErr && pErr.code !== 'PGRST116') throw pErr;
    const { data: active } = await sb.from('positions').select('*').eq('user_id', userId).eq('status', 'Active').order('created_at', { ascending: false });
    const { data: history } = await sb.from('positions').select('*').eq('user_id', userId).in('status', ['Won', 'Lost']).order('settled_at', { ascending: false }).limit(50);
    const mapPos = p => ({
        id: p.id, coinId: p.coin_id, type: p.type, amount: parseFloat(p.amount),
        entryPrice: parseFloat(p.entry_price), settlementPrice: p.settlement_price ? parseFloat(p.settlement_price) : null,
        status: p.status, payout: p.payout != null ? parseFloat(p.payout) : null, createdAt: p.created_at, settledAt: p.settled_at,
        isSim: p.is_sim === true, durationSec: p.duration_seconds,
    });
    return {
        usdBalance: parseFloat(pd?.usd_balance || 0),
        simBalance: parseFloat(pd?.sim_balance ?? 1000000),   // simulated-trading funds (default 1M)
        totalTrades: pd?.total_trades || 0, totalWon: pd?.total_won || 0,
        totalLost: pd?.total_lost || 0, totalPnl: parseFloat(pd?.total_pnl || 0),
        activePositions: (active || []).map(mapPos), positionHistory: (history || []).map(mapPos),
    };
}

// Load the users row linked to the current Supabase Auth session into the store.
async function loadLinkedUser() {
    const { data: { user: authUser } } = await sb.auth.getUser();
    if (!authUser) throw new Error('No active session');
    const user = await linkedUser(authUser);        // find-or-create by auth_id
    setSessionMem(sessionFromUser(user));
    try { setPortfolio(await fetchPortfolio(user.id)); } catch { store.connectionLost = true; }
    return user;
}

// Wallet login via SIWE: the `wallet-auth` edge function verifies the signature
// server-side and issues a real Supabase session. No wallet key or direct table
// write happens on the client.
export async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        throw new Error('No Web3 wallet detected. Install MetaMask or a compatible wallet to connect.');
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const address = String(accounts?.[0] || '').toLowerCase();
    if (!address) throw new Error('No wallet account available');

    const { message } = await edge('wallet-auth', { body: { action: 'nonce', address } });
    const signature = await window.ethereum.request({ method: 'personal_sign', params: [message, address] });
    const res = await edge('wallet-auth', { body: { action: 'verify', address, signature } });
    if (!res?.token_hash) throw new Error(res?.error || 'Wallet verification failed');

    const { error } = await sb.auth.verifyOtp({ token_hash: res.token_hash, type: 'magiclink' });
    if (error) throw error;
    return loadLinkedUser();
}

// ---- Email / password (Supabase Auth; credentials never touch our tables) ----
// Requires the one-time backend setup in db/2026-email-auth.sql + enabling the
// Email provider in the Supabase dashboard.
async function linkedUser(authUser, { email } = {}) {
    let { data: user, error } = await sb.from('users').select('*').eq('auth_id', authUser.id).single();
    if (error && error.code === 'PGRST116') {
        // Provision server-side (users row + zero-balance portfolio); client can't set a balance.
        const handle = (email || authUser.email || 'user').split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 12) || 'user';
        const { error: pe } = await sb.rpc('provision_me', { p_email: email || authUser.email || null, p_display: handle });
        if (pe) throw pe;
        ({ data: user, error } = await sb.from('users').select('*').eq('auth_id', authUser.id).single());
        if (error) throw error;
    } else if (error) throw error;
    return user;
}

export async function signUpEmail(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    // Email-confirmation ON -> no session yet; don't log in, prompt to confirm.
    if (!data.session) throw new Error('Account created — check your email to confirm, then sign in.');
    const user = await linkedUser(data.user, { email });
    setSessionMem(sessionFromUser(user));
    try { setPortfolio(await fetchPortfolio(user.id)); } catch { store.connectionLost = true; }
    return { user };
}

export async function signInEmail(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = await linkedUser(data.user, { email });
    setSessionMem(sessionFromUser(user));
    try { setPortfolio(await fetchPortfolio(user.id)); } catch { store.connectionLost = true; }
    return { user };
}

// Restore an active Supabase Auth session on startup (email or wallet).
export async function restoreSession() {
    try {
        const { data } = await sb.auth.getSession();
        if (data?.session?.user) await loadLinkedUser();
    } catch (e) { console.warn('Session restore failed:', e); }
}

// 8s refresh loop (mirrors legacy setInterval(fetchPortfolio, 8000)).
export async function refreshPortfolio() {
    if (!store.session?.userId) return;
    try { setPortfolio(await fetchPortfolio(store.session.userId)); }
    catch { store.connectionLost = true; }
}

export async function disconnect() {
    try { await sb.auth.signOut(); } catch {}
    clearSession();
}
