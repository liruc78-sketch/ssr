// ============================================================================
// Crypto.ssr — Minimal hash router (#/path?query)
// Views are registered lazily so each screen is one module we grow per phase.
// A route whose module doesn't exist yet renders a titled placeholder (stub),
// so navigation works end-to-end from Phase 0; later phases drop in the module.
// ============================================================================
import { reactive } from 'vue';

// path -> { load, nav, label }
const routes = {
    '/':         { load: () => import('./views/Home.js'),     nav: 'home',    label: 'Home' },
    '/market':   { load: () => import('./views/Market.js'),   nav: 'market',  label: 'Markets' },
    '/coin':     { load: () => import('./views/CoinDetail.js'), nav: 'market', label: 'Chart' },
    '/trade':    { load: () => import('./views/Trade.js'),    nav: 'trade',   label: 'Trade' },
    '/finance':  { load: () => import('./views/Finance.js'),  nav: 'finance', label: 'Finance' },
    '/assets':   { load: () => import('./views/Assets.js'),   nav: 'assets',  label: 'Assets' },
    '/deposit':  { load: () => import('./views/Deposit.js'),  label: 'Deposit' },
    '/withdraw': { load: () => import('./views/Withdraw.js'), label: 'Withdraw' },
    '/transfer': { load: () => import('./views/Transfer.js'), label: 'Transfer' },
    '/history':  { load: () => import('./views/History.js'),  label: 'History' },
    '/convert':  { load: () => import('./views/Convert.js'),  label: 'Convert' },
    '/c2c':      { load: () => import('./views/C2C.js'),      label: 'C2C' },
    '/kyc':      { load: () => import('./views/Kyc.js'),      label: 'KYC Verification' },
    '/security': { load: () => import('./views/Security.js'), label: 'Security Center' },
    '/news':     { load: () => import('./views/News.js'),     nav: 'market', label: 'News' },
    '/bulletin': { load: () => import('./views/Bulletin.js'), label: 'Bulletin' },
    '/live':     { load: () => import('./views/Live.js'),     label: 'Live Streaming' },
    '/academy':  { load: () => import('./views/Academy.js'),  label: 'Beginner Academy' },
    '/funding':  { load: () => import('./views/History.js'),  label: 'Funding Records' },
    '/login':    { load: () => import('./views/Login.js'),    label: 'Sign in' },
};

function parseHash() {
    const raw = (location.hash || '#/').replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    return { path: path || '/', query };
}

export const router = reactive({
    path: '/', query: {}, nav: 'home',
    key: '/',          // path+query — views are keyed on this so ?param changes refresh
    component: null,   // resolved component, or null when loading / stub / 404
    label: 'Home',
    loading: false,
    stub: false,       // route known but module not built yet
    notFound: false,   // unknown route
});

const cache = new Map();

export async function resolve() {
    const { path, query } = parseHash();
    router.path = path; router.query = query;
    router.key = path + '|' + new URLSearchParams(query).toString();

    const def = routes[path];
    if (!def) { router.notFound = true; router.stub = false; router.component = null; router.nav = ''; router.label = 'Not found'; return; }

    router.notFound = false;
    router.nav = def.nav || '';
    router.label = def.label || '';

    if (cache.has(path)) { router.component = cache.get(path); router.stub = cache.get(path) == null; return; }

    router.loading = true; router.component = null; router.stub = false;
    try {
        const mod = await def.load();
        cache.set(path, mod.default);
        router.component = mod.default;
    } catch (e) {
        // Module not built yet (or failed) -> render a titled placeholder.
        console.info('[router] stub for', path, '(view not built yet)');
        cache.set(path, null);
        router.component = null;
        router.stub = true;
    } finally {
        router.loading = false;
    }
    window.scrollTo(0, 0);
}

export function go(path) {
    const target = path.startsWith('#') ? path : '#' + path;
    if (location.hash === target) resolve();
    else location.hash = target;
}

export function startRouter() {
    window.addEventListener('hashchange', resolve);
    if (!location.hash) location.hash = '#/';
    resolve();
}
