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

// ---- Wallet login (SIWE) ---------------------------------------------------
// The `wallet-auth` edge function verifies the signature server-side and issues
// a real Supabase session. No wallet key or direct table write on the client.
// Works in any EIP-1193 wallet browser. Coinbase Wallet accounts are often smart
// wallets that sign with long ERC-1271/6492 signatures bound to the current
// chain; the server checks those on Base / Ethereum, so we send the chain id.
const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_HEX = '0x2105';

// A wallet-login failure: `code` picks the message (Login.js), `step` says where
// it happened, `detail` is the raw wallet/server code for on-device diagnosis.
export class WalletLoginError extends Error {
    constructor(code, step, cause) {
        super(cause?.message || code);
        this.name = 'WalletLoginError';
        this.code = code;
        this.step = step;
        this.cause = cause;
        this.detail = cause?.data?.code ?? cause?.status ?? (typeof cause?.code === 'number' ? cause.code : null);
    }
}

const utf8ToHex = (s) => '0x' + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

function withTimeout(promise, ms) {
    let timer;
    const expire = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), ms); });
    return Promise.race([promise, expire]).finally(() => clearTimeout(timer));
}

// EIP-6963: some wallets announce a provider instead of (or besides) setting window.ethereum.
let announced = null;
try {
    window.addEventListener('eip6963:announceProvider', (e) => { if (!announced && e?.detail?.provider?.request) announced = e.detail.provider; });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
} catch {}

function pickProvider() {
    const eth = window.ethereum;
    // Several injected wallets: prefer the in-app Coinbase browser's own provider.
    if (Array.isArray(eth?.providers) && eth.providers.length) return eth.providers.find((p) => p?.isCoinbaseBrowser) || eth;
    return eth?.request ? eth : announced;
}

// In-app browsers can inject the provider after our scripts run — give them a moment.
async function getProvider(waitMs = 2000) {
    if (pickProvider()) return pickProvider();
    try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch {}
    await new Promise((resolve) => {
        let poll, timer;
        const done = () => { clearInterval(poll); clearTimeout(timer); window.removeEventListener('ethereum#initialized', done); resolve(); };
        poll = setInterval(() => { if (pickProvider()) done(); }, 100);
        timer = setTimeout(done, waitMs);
        window.addEventListener('ethereum#initialized', done, { once: true });
    });
    return pickProvider();
}

const isCoinbase = (p) => !!(p?.isCoinbaseBrowser || p?.isCoinbaseWallet);

async function readChainId(p) {
    try {
        const c = await withTimeout(p.request({ method: 'eth_chainId' }), 5000);
        const n = typeof c === 'string' && /^0x/i.test(c) ? parseInt(c, 16) : Number(c);
        return Number.isSafeInteger(n) && n > 0 ? n : null;
    } catch { return null; }
}

// personal_sign takes hex-encoded data (what viem/wagmi send to every wallet; same
// EIP-191 digest as the plain string). Fall back to the plain string only for a
// wallet that rejects the params — never retry a user rejection.
async function personalSign(p, message, signer) {
    try { return await p.request({ method: 'personal_sign', params: [utf8ToHex(message), signer] }); }
    catch (e) {
        if (Number(e?.code) === -32602 || /invalid (params|argument)/i.test(e?.message || '')) {
            return p.request({ method: 'personal_sign', params: [message, signer] });
        }
        throw e;
    }
}

// Map a raw wallet / edge-function error to a WalletLoginError code.
function classify(e, step) {
    if (e instanceof WalletLoginError) return e;
    const server = step === 'nonce' || step === 'verify';
    if (e?.code === 'timeout') return new WalletLoginError(server ? 'network' : 'timeout', step, e);
    const msg = String(e?.message || '');
    if (server) {                                         // edge() errors carry { status, data: { error, code } }
        const code = String(e?.data?.code || '');
        if (!e?.status) return new WalletLoginError('network', step, e);
        if (code === 'unsupported_chain') return new WalletLoginError('chain', step, e);
        if (code === 'rpc_unavailable' || (step === 'verify' && e.status === 503)) return new WalletLoginError('verifier_down', step, e);
        if (code.startsWith('challenge_') || /expired|no login challenge/i.test(msg)) return new WalletLoginError('expired', step, e);
        if (e.status === 401 || /signature|yParity/i.test(msg)) return new WalletLoginError('verify', step, e);
        return new WalletLoginError('server', step, e);
    }
    const rpc = Number(e?.code ?? e?.data?.originalError?.code);
    if (rpc === 4001 || /user (rejected|denied|cancel)/i.test(msg)) return new WalletLoginError('rejected', step, e);
    if (rpc === -32002) return new WalletLoginError('pending', step, e);
    return new WalletLoginError('wallet', step, e);
}
const at = (step, promise) => promise.catch((e) => { throw classify(e, step); });

// `onStep('connect' | 'sign' | 'verify')` lets the UI say what the wallet is waiting for.
// A second call while one is running joins it; the latest caller gets the step updates.
let inflight = null, stepCb = () => {}, lastStep = '';
export function connectWallet(onStep = () => {}) {
    stepCb = onStep;
    if (lastStep) onStep(lastStep);
    if (!inflight) {
        inflight = runWalletLogin((s) => { lastStep = s; stepCb(s); })
            .finally(() => { inflight = null; lastStep = ''; stepCb = () => {}; });
    }
    return inflight;
}

async function runWalletLogin(onStep) {
    const p = await getProvider();
    if (!p) throw new WalletLoginError('no_provider', 'detect');

    onStep('connect');
    const accounts = await at('accounts', withTimeout(p.request({ method: 'eth_requestAccounts' }), 120_000));
    const signer = typeof accounts?.[0] === 'string' ? accounts[0] : '';   // exact case, as the wallet gave it
    if (!/^0x[0-9a-fA-F]{40}$/.test(signer)) throw new WalletLoginError('no_account', 'accounts');
    const address = signer.toLowerCase();                                  // our identity key

    // A Coinbase smart wallet's signature only verifies on the chain it was made on, and
    // the server only accepts the chain the wallet is deployed on — its home chain, Base.
    // So move Coinbase wallets to Base before signing (best effort; others untouched).
    if (isCoinbase(p) && (await readChainId(p)) !== BASE_CHAIN_ID) {
        try { await withTimeout(p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_HEX }] }), 20_000); } catch {}
    }

    const { message } = await at('nonce', withTimeout(edge('wallet-auth', { body: { action: 'nonce', address } }), 20_000));
    const chainId = await readChainId(p);                                  // the chain the signature is bound to
    onStep('sign');
    const raw = await at('sign', withTimeout(personalSign(p, message, signer), 180_000));
    if (typeof raw !== 'string' || !/^(0x)?([0-9a-fA-F]{2})+$/.test(raw)) throw new WalletLoginError('wallet', 'sign');
    const signature = raw.startsWith('0x') ? raw : '0x' + raw;

    onStep('verify');
    const res = await at('verify', withTimeout(edge('wallet-auth', { body: { action: 'verify', address, signature, chainId } }), 45_000));
    if (!res?.token_hash) throw new WalletLoginError('server', 'verify');

    const { error } = await sb.auth.verifyOtp({ token_hash: res.token_hash, type: 'magiclink' });
    if (error) throw new WalletLoginError('session', 'session', error);
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
