// ============================================================================
// Crypto.ssr — Auth + portfolio
// Every user (email, phone OR wallet) gets a real Supabase Auth session (JWT),
// so auth.uid() identifies them for RLS. Wallet login uses SIWE (sign-in with
// Ethereum) verified server-side by the `wallet-auth` edge function.
// Tables: users (linked by auth_id), portfolios, positions.
// ============================================================================
import { sb, edge, STORAGE_KEY } from './supabase.js';
import { setSessionMem, clearSession, setPortfolio, store, toast } from './store.js';
import { go } from './router.js';
import { t } from './i18n.js';

// Build the in-memory session object from a users row. `authId` is the Supabase
// Auth user the row is linked to — what the stored JWT must belong to. `via` is
// how the account signs in (Security.js shows the matching method as bound).
function sessionFromUser(user) {
    const via = user.phone ? 'phone' : user.wallet_address ? 'wallet' : 'email';
    return { userId: user.id, authId: user.auth_id, walletAddress: user.wallet_address || null, email: user.email || null, phone: user.phone || null, via, username: user.username, displayName: user.display_name };
}

// Mirror of legacy getUserPortfolio(userId). Any error throws, so callers keep the
// last-known-good state and the views show the balance as unknown. That includes
// PGRST116 (no row): wallet-auth and provision_me always create the portfolio, so
// a missing row means RLS hid it (the JWT is another account's), not a new user at 0.
export async function fetchPortfolio(userId) {
    const { data: pd, error: pErr } = await sb.from('portfolios').select('*').eq('user_id', userId).single();
    if (pErr) throw pErr;
    const { data: active, error: aErr } = await sb.from('positions').select('*').eq('user_id', userId).eq('status', 'Active').order('created_at', { ascending: false });
    if (aErr) throw aErr;
    const { data: history, error: hErr } = await sb.from('positions').select('*').eq('user_id', userId).in('status', ['Won', 'Lost']).order('settled_at', { ascending: false }).limit(50);
    if (hErr) throw hErr;
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

// Fetch `userId`'s portfolio into the store. A failure only flags connectionLost.
// The result is dropped if a newer fetch started or the account on screen changed
// meanwhile, so a slow request can't overwrite fresher state.
let portfolioSeq = 0;
async function loadPortfolio(userId) {
    const seq = ++portfolioSeq;
    const current = () => seq === portfolioSeq && store.session?.userId === userId;
    try { const p = await fetchPortfolio(userId); if (current()) setPortfolio(p); }
    catch { if (current()) store.connectionLost = true; }
}

// Load the users row linked to the current Supabase Auth session into the store.
async function loadLinkedUser() {
    const { data: { user: authUser } } = await sb.auth.getUser();
    if (!authUser) throw new Error('No active session');
    const user = await linkedUser(authUser);        // find-or-create by auth_id
    setSessionMem(sessionFromUser(user));
    await loadPortfolio(user.id);
    return user;
}

// This tab's own sign-in is running (its SIGNED_IN isn't another tab's switch).
let signingIn = 0;
async function ownSignIn(run) {
    signingIn++;
    try { return await run(); } finally { signingIn--; }
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
        inflight = ownSignIn(() => runWalletLogin((s) => { lastStep = s; stepCb(s); }))
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
async function linkedUser(authUser) {
    let { data: user, error } = await sb.from('users').select('*').eq('auth_id', authUser.id).single();
    if (error && error.code === 'PGRST116') {
        // Provision server-side (users row + zero-balance portfolio); client can't set a
        // balance. The server takes the email, phone and display name from the auth user.
        const { error: pe } = await sb.rpc('provision_me', { p_email: null, p_display: null });
        if (pe) throw pe;
        ({ data: user, error } = await sb.from('users').select('*').eq('auth_id', authUser.id).single());
        if (error) throw error;
    } else if (error) throw error;
    return user;
}

// Sign up and log straight in. Null when Auth "Confirm email" is on: the account
// then exists but gets no session until it is confirmed.
async function signUpAndLoad(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) return null;
    // The account exists from here on. If setting it up fails, say so: signing in
    // retries the setup, while registering again would only hit "already registered".
    try {
        const user = await linkedUser(data.user);
        setSessionMem(sessionFromUser(user));
        await loadPortfolio(user.id);
        return { user };
    } catch (e) {
        throw Object.assign(new Error('Account created, but setting it up failed'), { code: 'provision_failed', cause: e });
    }
}

export const signUpEmail = (email, password) => ownSignIn(async () => {
    const res = await signUpAndLoad(email, password);
    // Email-confirmation ON -> no session yet; don't log in, prompt to confirm.
    if (!res) throw Object.assign(new Error('Account created — confirm your email, then sign in'), { code: 'email_unconfirmed' });
    return res;
});

export const signInEmail = (email, password) => ownSignIn(async () => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = await linkedUser(data.user);
    setSessionMem(sessionFromUser(user));
    await loadPortfolio(user.id);
    return { user };
});

// ---- Phone / password ------------------------------------------------------
// Supabase's Phone provider needs an SMS gateway, so a phone account is an email
// account underneath: its login email is the E.164 number at a reserved domain
// (+12067458075 -> 12067458075@phone.cryptossr.local), like wallet logins. The
// database fills users.phone from that email and refuses anything there that isn't
// E.164-shaped (supabase/migrations/20261027175932_phone_auth.sql); the canonical
// form itself comes from normalizePhone. Numbers aren't verified by SMS — the same
// trust as email sign-up, which isn't confirmed either.
const PHONE_DOMAIN = 'phone.cryptossr.local';

// libphonenumber-js (min metadata, ~43 KB gzipped) loads only when the phone form
// is used. Its version is pinned in index.html because its metadata decides which
// account a typed number lands in: before changing it, check that each group still
// gives one number — +82 010-1234-5678 / +82 10-1234-5678, +44 (0)7911 123456 /
// +44 07911 123456 / +44 7911 123456, +7 8 912 345-67-89 / +7 912 345-67-89 —
// and that +39 06 1234 5678 and +7 800 555-35-35 keep their 0 and 8.
let phoneLibLoad = null, phoneLib = null;
export function loadPhoneLib() {
    phoneLibLoad ??= import('libphonenumber-js/min')
        .then((m) => (phoneLib = m))
        .catch((e) => { phoneLibLoad = null; throw e; });
    return phoneLibLoad;
}

// Marks that copy-paste and IMEs put into numbers: format characters (bidi, zero
// width, soft hyphen) are dropped, and spaces, dashes, dots, slashes, brackets and
// the Japanese long-vowel mark / middle dot (typed as hyphens) only separate groups.
const FORMAT_CHARS = /\p{Cf}/gu;
const SEPARATORS = /[\s\p{Pd}\u2212\u30fc\u30fb.()/]/gu;
// Arabic-Indic and Persian digits; a digit's value is the low nibble of its code.
const EASTERN_DIGIT = /[\u0660-\u0669\u06f0-\u06f9]/g;

// Any digit as 0-9: full-width ones from CJK keyboards (via NFKC, which also turns a
// full-width plus into +) and Arabic-Indic / Persian ones.
export const foldDigits = (s) => String(s ?? '').normalize('NFKC').replace(EASTERN_DIGIT, (d) => String(d.charCodeAt(0) & 0xf));

// What the user typed, reduced to '+' and digits ('00' in front reads as +).
function phoneChars(input) {
    const s = foldDigits(input).replace(FORMAT_CHARS, '').replace(SEPARATORS, '');
    return s.startsWith('00') ? '+' + s.slice(2) : s;     // international dialling prefix
}
// Reads as a phone number, however it was typed (Login.js moves it to the phone form).
export const looksLikePhone = (input) => /^\+?\d+$/.test(phoneChars(input));

// What the user typed -> { digits: '+<7–15 digits>' } or an error the library isn't
// needed for: 'empty', 'country_code' (no + or 00 in front — never guessed, since
// the same phone would then land in two accounts) or 'invalid'.
function phoneShape(input) {
    const s = phoneChars(input);
    if (!s) return { error: 'empty' };
    if (!s.startsWith('+')) return { error: 'country_code' };
    return /^\+[1-9]\d{6,14}$/.test(s) ? { digits: s } : { error: 'invalid' };
}

// The library drops a trunk prefix typed after the country code (+44 0…, +81 0…,
// +7 8…) and keeps a significant one (Italy's 0). Sign-up requires a valid number;
// sign-in only a possible one, so a metadata update can't lock an account out.
function canonicalPhone(lib, digits, strict) {
    const pn = lib.parsePhoneNumberFromString(digits);
    if (!pn || !(strict ? pn.isValid() : pn.isPossible())) return { error: 'invalid' };
    return { number: pn.number, country: pn.country, formatted: pn.formatInternational() };
}

// '+82 010-1234-5678' -> { number: '+821012345678', country: 'KR', formatted: '+82 10 1234 5678' },
// or { error }. Rejects only if the library can't be loaded.
export async function normalizePhone(input, { strict = false } = {}) {
    const shape = phoneShape(input);
    return shape.error ? shape : canonicalPhone(await loadPhoneLib(), shape.digits, strict);
}
// The same check for feedback while typing, without waiting: null until the
// library is loaded or while the number is incomplete.
export function previewPhone(input) {
    const shape = phoneShape(input);
    const res = shape.error || !phoneLib ? null : canonicalPhone(phoneLib, shape.digits, true);
    return res?.error ? null : res;
}
const phoneEmail = (e164) => `${e164.slice(1)}@${PHONE_DOMAIN}`;

// Both take the canonical number from normalizePhone.
export const signUpPhone = (e164, password) => ownSignIn(async () => {
    const res = await signUpAndLoad(phoneEmail(e164), password);
    // Only if someone turns Auth "Confirm email" on: a phone login has no mailbox to
    // confirm, so phone sign-up needs it off.
    if (!res) throw Object.assign(new Error('Phone sign-up needs Auth email confirmation off'), { code: 'phone_unconfirmed' });
    return res;
});
export const signInPhone = (e164, password) => signInEmail(phoneEmail(e164), password);

// Remove the legacy site's saved login and return it ({ userId, walletAddress }),
// or null if there was none.
function takeLegacySession() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY); } catch {}
    if (raw == null) return null;
    try { return JSON.parse(raw) || {}; } catch { return {}; }
}

// Restore an active Supabase Auth session on startup (email or wallet). Only a
// Supabase session counts: the legacy site's `tw_user_session` holds a user id
// but no JWT, and treating it as a login showed a signed-in page whose every
// read RLS rejects as anon (balance 0). Drop it and send the user to sign in
// with that same wallet — wallet-auth then links the existing account by address.
export async function restoreSession() {
    const legacy = takeLegacySession();
    try {
        const { data } = await sb.auth.getSession();
        if (data?.session?.user) await loadLinkedUser();
        else if (legacy) {
            const w = /^0x[0-9a-f]{40}$/i.test(legacy.walletAddress || '') ? legacy.walletAddress : '';
            store.relogin = { wallet: w && w.slice(0, 6) + '…' + w.slice(-4) };
            go('/login');
        }
    } catch (e) { console.warn('Session restore failed:', e); }
}

// Supabase keeps one stored session per browser, so signing in as another account
// in another tab swaps the JWT under this tab too: it would keep showing account A
// while every request runs as B (A's rows then read as missing, trades land on B).
// Follow the switch — reload the linked user, or sign out if that fails.
let following = null;
function followAuthUser() {
    following ??= loadLinkedUser()
        .then(() => toast(t('login.accountSwitched'), 'info', 4200))
        .catch((e) => { console.warn('Account switch failed:', e); clearSession(); })
        .finally(() => { following = null; });
    return following;
}

// A session that ends outside this page (sign-out in another tab, revoked
// refresh token) logs the UI out too, instead of leaving it showing an account
// it can no longer read; one that changes hands switches this tab with it. The
// reload is deferred: supabase-js holds its auth lock while this callback runs,
// and loadLinkedUser's own auth calls would wait on it forever.
sb.auth.onAuthStateChange((event, session) => {
    if (!store.session) return;
    if (event === 'SIGNED_OUT') clearSession();
    else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !signingIn
        && session?.user?.id && session.user.id !== store.session.authId) setTimeout(followAuthUser, 0);
});

// Call right before a request that moves money: the stored session must still be
// the account on screen. Throws (and switches or signs out) if it isn't.
export async function assertSessionUser() {
    const { data } = await sb.auth.getSession();
    const id = data?.session?.user?.id;
    if (id && id === store.session?.authId) return;
    if (id) followAuthUser(); else clearSession();
    throw new Error(t(id ? 'login.accountSwitched' : 'login.signInAgain'));
}

// Reload balances + positions (polled from main.js only while the tab is visible).
export async function refreshPortfolio() {
    if (store.session?.userId) await loadPortfolio(store.session.userId);
}

export async function disconnect() {
    try { await sb.auth.signOut(); } catch {}
    clearSession();
}
