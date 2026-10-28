// ============================================================================
// Crypto.ssr — Cloudflare Turnstile, the check that buys a KYC upload pass.
// When kyc_upload_status() says uploads need a pass, the KYC page runs one check
// per upload attempt and the kyc-pass edge function redeems the token with
// Siteverify (supabase/functions/kyc-pass). The script loads on first use; each
// check renders a fresh widget, which shows itself only when Cloudflare wants a
// click, and removes it once it has produced its single-use token.
// ============================================================================
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// Local previews get Cloudflare's always-pass test key; its dummy token never
// passes the real Siteverify, so stub kyc-pass there.
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const TEST_SITEKEY = '1x00000000000000000000AA';
const LANG = { 'zh-Hant': 'zh-tw' };       // Turnstile's code where it differs from ours
const GIVE_UP = 120_000;                   // ms: an interactive challenge nobody answered

const checkError = (code, cause) => Object.assign(new Error(code), { code, cause });

let loading = null;
function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    loading ||= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SCRIPT;
        s.async = true;
        s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(checkError('check_load')));
        s.onerror = () => { s.remove(); reject(checkError('check_load')); };
        document.head.appendChild(s);
    }).catch((e) => { loading = null; throw e; });
    return loading;
}

// Run one check inside `el` and resolve with its token, or throw with code
// check_load (the script didn't load) | check_failed.
export async function turnstileToken(el, { sitekey, action, lang }) {
    const ts = await loadTurnstile();
    return new Promise((resolve, reject) => {
        let id, done = false;
        const settle = (fn, v) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            el.classList.remove('is-asking');
            setTimeout(() => { try { ts.remove(id); } catch {} });
            fn(v);
        };
        const fail = (cause) => settle(reject, checkError('check_failed', cause));
        const timer = setTimeout(() => fail('timeout'), GIVE_UP);
        try {
            id = ts.render(el, {
                sitekey: LOCAL ? TEST_SITEKEY : sitekey,
                action,
                language: LANG[lang] || lang || 'auto',
                theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
                size: el.clientWidth >= 300 ? 'flexible' : 'compact',
                appearance: 'interaction-only',
                retry: 'never',
                callback: (token) => settle(resolve, token),
                'error-callback': (code) => { fail(code); return true; },
                'timeout-callback': () => fail('timeout'),
                'unsupported-callback': () => fail('unsupported'),
                'before-interactive-callback': () => el.classList.add('is-asking'),
                'after-interactive-callback': () => el.classList.remove('is-asking'),
            });
        } catch (e) { fail(e); }
    });
}
