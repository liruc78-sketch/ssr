// ============================================================================
// Crypto.ssr — Shared reactive store (single source of truth for the shell)
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

export const store = reactive({
    // ---- theme -----------------------------------------------------------
    theme: read(THEME_KEY, 'light'),

    // ---- session (shared with legacy site via STORAGE_KEY) --------------
    session: readJSON(STORAGE_KEY),           // null when logged out
    get isAuthed() { return !!this.session; },

    // ---- account mode ----------------------------------------------------
    mode: read(MODE_KEY, 'live'),             // live | sim
    get isSim() { return this.mode === 'sim'; },

    // ---- shell UI --------------------------------------------------------
    drawerOpen: false,

    // ---- toast -----------------------------------------------------------
    toast: { show: false, msg: '', type: 'info' },
    _toastTimer: null,
});

// ---- actions (plain functions; keep components declarative) -------------
export function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0b0e14' : '#f5f7fb');
}
export function toggleTheme() {
    store.theme = store.theme === 'dark' ? 'light' : 'dark';
}
export function setMode(mode) {
    store.mode = mode;
}
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
