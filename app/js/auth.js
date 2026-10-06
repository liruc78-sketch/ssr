// ============================================================================
// Crypto.ssr — Wallet auth + portfolio (shares the legacy backend & session)
// Mirrors the current site's loginWithWallet / getUserPortfolio / restore so a
// session created here works on the legacy site and admin panel, and vice versa.
// Tables: users, portfolios, positions. Session key: tw_user_session.
// ============================================================================
import { sb } from './supabase.js';
import { setSession, setSessionMem, clearSession, setPortfolio, store } from './store.js';

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
    });
    return {
        usdBalance: parseFloat(pd?.usd_balance || 0),
        totalTrades: pd?.total_trades || 0, totalWon: pd?.total_won || 0,
        totalLost: pd?.total_lost || 0, totalPnl: parseFloat(pd?.total_pnl || 0),
        activePositions: (active || []).map(mapPos), positionHistory: (history || []).map(mapPos),
    };
}

// Mirror of legacy loginWithWallet(address).
export async function loginWithWallet(address) {
    const normalized = String(address).toLowerCase();
    let { data: user, error } = await sb.from('users').select('*').eq('wallet_address', normalized).single();
    let isNew = false;
    if (error && error.code === 'PGRST116') {
        isNew = true;
        const shortAddr = normalized.slice(0, 6) + '...' + normalized.slice(-4);
        const { data: newUser, error: ce } = await sb.from('users').insert({
            wallet_address: normalized, display_name: `User ${shortAddr}`, username: `wallet_${normalized.slice(2, 10)}`,
        }).select().single();
        if (ce) throw ce;
        user = newUser;
        await sb.from('portfolios').insert({ user_id: user.id, usd_balance: 0 });
    } else if (error) throw error;
    else {
        await sb.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    }

    setSession({ userId: user.id, walletAddress: user.wallet_address, username: user.username, displayName: user.display_name });
    try { setPortfolio(await fetchPortfolio(user.id)); }
    catch (e) { store.connectionLost = true; console.warn('Portfolio load failed; will retry:', e); }
    return { user, isNew };
}

// Connect an injected wallet (MetaMask, Trust, …); demo-address fallback when
// none is present — same behavior as the legacy site.
export async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts?.[0]) return loginWithWallet(accounts[0]);
    }
    const demo = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return loginWithWallet(demo);
}

// ---- Email / password (Supabase Auth; credentials never touch our tables) ----
// Requires the one-time backend setup in db/2026-email-auth.sql + enabling the
// Email provider in the Supabase dashboard.
async function linkedUser(authUser, { email } = {}) {
    let { data: user, error } = await sb.from('users').select('*').eq('auth_id', authUser.id).single();
    if (error && error.code === 'PGRST116') {
        const handle = (email || authUser.email || 'user').split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 12) || 'user';
        const uname = `${handle}_${Math.floor(Math.random() * 9000 + 1000)}`;
        const { data: nu, error: ce } = await sb.from('users').insert({
            auth_id: authUser.id, email: email || authUser.email, display_name: handle, username: uname,
        }).select().single();
        if (ce) throw ce;
        user = nu;
        await sb.from('portfolios').insert({ user_id: user.id, usd_balance: 0 });
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

// Restore a saved session on startup. Prefer an active Supabase Auth (email)
// session; otherwise fall back to the legacy wallet session shape.
export async function restoreSession() {
    try {
        const { data } = await sb.auth.getSession();
        if (data?.session?.user) {
            const user = await linkedUser(data.session.user);
            setSessionMem(sessionFromUser(user));
            try { setPortfolio(await fetchPortfolio(user.id)); } catch { store.connectionLost = true; }
            return;
        }
    } catch (e) { /* email auth not set up yet — fall through to wallet */ }

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('tw_user_session') || 'null'); } catch {}
    if (!saved?.walletAddress) { if (saved && !saved.walletAddress) clearSession(); return; }
    try { await loginWithWallet(saved.walletAddress); }
    catch (e) { console.warn('Session restore failed:', e); }
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
