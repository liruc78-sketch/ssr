// ============================================================================
// Crypto.ssr — Shared reactive store (single source of truth for the shell)
// Session is wallet-based and shares the legacy site's `tw_user_session` key,
// so both front-ends (/, /app/) share one login + balance. auth.js owns the
// Supabase flows; this module owns state + plain setters (no import cycle).
// ============================================================================
import { reactive, watch } from 'vue';
import { STORAGE_KEY } from './supabase.js';

const THEME_KEY = 'theme';
const MODE_KEY  = 'ssr_account_mode';   // 'live' | 'sim'

function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
export function emptyPortfolio() {
    return { usdBalance: 0, totalTrades: 0, totalWon: 0, totalLost: 0, totalPnl: 0, activePositions: [], positionHistory: [] };
}

export const store = reactive({
    // ---- theme -----------------------------------------------------------
    theme: read(THEME_KEY, 'light'),

    // ---- session (shared with legacy site via STORAGE_KEY) --------------
    // Shape: { userId, walletAddress, username?, displayName? }. The raw saved
    // value may be just { userId, walletAddress } (legacy) — auth.restoreSession
    // enriches it and loads the portfolio on startup.
    session: readJSON(STORAGE_KEY),
    get isAuthed() { return !!this.session; },

    // ---- portfolio (real balances from Supabase) ------------------------
    portfolio: emptyPortfolio(),
    balanceLoaded: false,     // distinguishes a real 0 from "not loaded yet"
    connectionLost: false,    // last portfolio fetch failed (keep last-known-good)

    // ---- account mode ----------------------------------------------------
    mode: read(MODE_KEY, 'live'),             // live | sim
    get isSim() { return this.mode === 'sim'; },

    // ---- shell UI --------------------------------------------------------
    drawerOpen: false,

    // ---- toast -----------------------------------------------------------
    toast: { show: false, msg: '', type: 'info' },
    _toastTimer: null,
});

// ---- plain setters (auth.js calls these) --------------------------------
export function setSession(session) {
    store.session = session;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: session.userId, walletAddress: session.walletAddress })); } catch {}
}
export function clearSession() {
    store.session = null;
    store.portfolio = emptyPortfolio();
    store.balanceLoaded = false;
    store.connectionLost = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
export function setPortfolio(p) { store.portfolio = p; store.balanceLoaded = true; store.connectionLost = false; }

// ---- UI actions ---------------------------------------------------------
export function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0b0e14' : '#f5f7fb');
}
export function toggleTheme() { store.theme = store.theme === 'dark' ? 'light' : 'dark'; }
export function setMode(mode) { store.mode = mode; }
export function openDrawer()  { store.drawerOpen = true;  document.body.style.overflow = 'hidden'; }
export function closeDrawer() { store.drawerOpen = false; document.body.style.overflow = ''; }

export function toast(msg, type = 'info', ms = 2600) {
    store.toast = { show: true, msg, type };
    clearTimeout(store._toastTimer);
    store._toastTimer = setTimeout(() => { store.toast.show = false; }, ms);
}

// ---- persistence (reactive -> localStorage) -----------------------------
watch(() => store.theme, (t) => { applyTheme(t); try { localStorage.setItem(THEME_KEY, t); } catch {} }, { immediate: true });
watch(() => store.mode,  (m) => { try { localStorage.setItem(MODE_KEY, m); } catch {} });
