// ============================================================================
// Crypto.ssr — Shared reactive store (single source of truth for the shell)
// The session comes only from Supabase Auth (auth.restoreSession / the login
// flows). auth.js owns the Supabase flows; this module owns state + plain
// setters (no import cycle).
// ============================================================================
import { reactive, watch } from 'vue';
import { STORAGE_KEY } from './supabase.js';

const THEME_KEY = 'theme';

function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
export function emptyPortfolio() {
    return { usdBalance: 0, simBalance: 0, totalTrades: 0, totalWon: 0, totalLost: 0, totalPnl: 0, activePositions: [], positionHistory: [] };
}

export const store = reactive({
    // ---- theme -----------------------------------------------------------
    theme: read(THEME_KEY, 'light'),

    // ---- session ---------------------------------------------------------
    // Shape: { userId, authId, walletAddress, email, phone, via, username, displayName }, set once a
    // Supabase Auth session is confirmed. Never seeded from the legacy site's
    // `tw_user_session`: that has no JWT, so every read would run as anon.
    session: null,
    get isAuthed() { return !!this.session; },
    relogin: null,            // { wallet } — a legacy-site login to redo (Login.js says so)

    // ---- portfolio (real balances from Supabase) ------------------------
    portfolio: emptyPortfolio(),
    balanceLoaded: false,     // distinguishes a real 0 from "not loaded yet"
    connectionLost: false,    // last portfolio fetch failed (keep last-known-good)
    // Signed in but the balance isn't known: views show "—" (BalanceStatus says
    // why) and block money actions, instead of a confident 0.00.
    get balanceUnknown() { return !!this.session && (!this.balanceLoaded || this.connectionLost); },

    // ---- shell UI --------------------------------------------------------
    drawerOpen: false,
    langOpen: false,          // language picker modal

    // ---- toast -----------------------------------------------------------
    toast: { show: false, msg: '', type: 'info' },
    _toastTimer: null,
});

// ---- plain setters (auth.js calls these) --------------------------------
export function clearSession() {
    store.session = null;
    store.relogin = null;
    store.portfolio = emptyPortfolio();
    store.balanceLoaded = false;
    store.connectionLost = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
export function setPortfolio(p) { store.portfolio = p; store.balanceLoaded = true; store.connectionLost = false; }
// Supabase Auth persists the session itself, so this only sets state. A different
// account (signed in from another tab) starts from "not loaded", not the old balance.
export function setSessionMem(session) {
    if (store.session && store.session.userId !== session.userId) {
        store.portfolio = emptyPortfolio();
        store.balanceLoaded = false;
        store.connectionLost = false;
    }
    store.session = session;
    store.relogin = null;
}

// ---- UI actions ---------------------------------------------------------
export function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0b0e14' : '#f5f7fb');
}
export function toggleTheme() { store.theme = store.theme === 'dark' ? 'light' : 'dark'; }
export function openDrawer()  { store.drawerOpen = true;  document.body.style.overflow = 'hidden'; }
export function closeDrawer() { store.drawerOpen = false; document.body.style.overflow = ''; }
// Language picker. Opening from the drawer closes the drawer first so the modal
// sits over a clean scrim (matches the reference design).
export function openLang()  { store.drawerOpen = false; store.langOpen = true;  document.body.style.overflow = 'hidden'; }
export function closeLang() { store.langOpen = false; document.body.style.overflow = ''; }

export function toast(msg, type = 'info', ms = 2600) {
    store.toast = { show: true, msg, type };
    clearTimeout(store._toastTimer);
    store._toastTimer = setTimeout(() => { store.toast.show = false; }, ms);
}

// ---- persistence (reactive -> localStorage) -----------------------------
watch(() => store.theme, (t) => { applyTheme(t); try { localStorage.setItem(THEME_KEY, t); } catch {} }, { immediate: true });
