// ============================================================================
// Crypto.ssr — Internationalization core
// A tiny reactive i18n layer: one reactive `locale` ref drives a `t(key)`
// lookup. `t` reads `locale.value` on every call, so any template that renders
// `$t('x')` (registered as a global in main.js) or any computed that calls
// `t('x')` re-evaluates the instant the language changes — no reload needed.
//
// Messages live one-file-per-language under ./i18n/<code>.js. English is the
// master/source; every other language falls back to English for any missing
// key, so a partial translation degrades gracefully instead of showing a key.
// ============================================================================
import { ref } from 'vue';

import en      from './i18n/en.js';
import es      from './i18n/es.js';
import de      from './i18n/de.js';
import zhHant  from './i18n/zh-Hant.js';
import fr      from './i18n/fr.js';
import ru      from './i18n/ru.js';
import it      from './i18n/it.js';
import tr      from './i18n/tr.js';
import ja      from './i18n/ja.js';
import fa      from './i18n/fa.js';
import ko      from './i18n/ko.js';

// Display order mirrors the language picker in the reference design.
// `cc` is the ISO country code used to render a real flag image (emoji flags
// don't render on Windows, so we use flag artwork instead).
export const LOCALES = [
    { code: 'en',      label: 'English',   cc: 'us', dir: 'ltr' },
    { code: 'es',      label: 'Español',   cc: 'es', dir: 'ltr' },
    { code: 'de',      label: 'Deutsch',   cc: 'de', dir: 'ltr' },
    { code: 'zh-Hant', label: '繁體中文',   cc: 'hk', dir: 'ltr' },
    { code: 'fr',      label: 'Français',  cc: 'fr', dir: 'ltr' },
    { code: 'ru',      label: 'Русский',   cc: 'ru', dir: 'ltr' },
    { code: 'it',      label: 'Italiano',  cc: 'it', dir: 'ltr' },
    { code: 'tr',      label: 'Türkçe',    cc: 'tr', dir: 'ltr' },
    { code: 'ja',      label: '日本語',     cc: 'jp', dir: 'ltr' },
    { code: 'fa',      label: 'فارسی',     cc: 'ir', dir: 'rtl' },
    { code: 'ko',      label: '한국어',     cc: 'kr', dir: 'ltr' },
];

const MESSAGES = { en, es, de, 'zh-Hant': zhHant, fr, ru, it, tr, ja, fa, ko };
const KEY = 'locale';
const CODES = LOCALES.map(l => l.code);

// A language the visitor picked (stored) always wins; otherwise the site
// opens in English — the browser's language is deliberately not used.
function detect() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    return saved && CODES.includes(saved) ? saved : 'en';
}

export const locale = ref(detect());

export function currentLocale() {
    return LOCALES.find(l => l.code === locale.value) || LOCALES[0];
}

// t('ns.key') -> localized string. Optional params fill {placeholders}.
// Missing key falls back to English, then to the raw key (so gaps are visible
// in dev but never crash the UI).
export function t(key, params) {
    const dict = MESSAGES[locale.value] || en;
    let s = dict[key];
    if (s == null) s = en[key];
    if (s == null) return key;
    if (params) for (const p in params) s = s.split('{' + p + '}').join(String(params[p]));
    return s;
}

// Reflect the active language onto <html> so the browser hyphenates, picks
// fonts and lays out RTL (فارسی) correctly.
export function applyLocaleAttrs() {
    const l = currentLocale();
    const el = document.documentElement;
    el.setAttribute('lang', l.code);
    el.setAttribute('dir', l.dir);
}

export function setLocale(code) {
    if (!CODES.includes(code)) return;
    locale.value = code;
    try { localStorage.setItem(KEY, code); } catch {}
    applyLocaleAttrs();
}

// Called once at boot (main.js). The pre-paint script in index.html already
// sets lang/dir to avoid a flash; this keeps them in sync with the ref.
export function initLocale() { applyLocaleAttrs(); }
