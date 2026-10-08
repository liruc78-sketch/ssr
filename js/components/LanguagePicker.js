// Language picker — centered modal listing every supported language by its own
// native name + flag. Selecting one applies site-wide instantly (reactive
// locale) and persists the choice. Opened from the drawer "Language" cell and
// the top-nav globe. Focus-managed, Escape / scrim to dismiss.
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Icon } from '../icons.js';
import { LOCALES, locale, setLocale } from '../i18n.js';
import { store, closeLang } from '../store.js';

export default {
    name: 'LanguagePicker',
    components: { Icon },
    setup() {
        const sheetEl = ref(null);
        let lastFocused = null;

        // Real flag artwork (emoji flags don't render on Windows). If the CDN is
        // unreachable, fall back to a tidy country-code chip so the row still reads.
        const flagUrl = (cc) => `https://flagcdn.com/${cc}.svg`;
        const flagFailed = reactive({});

        const pick = (code) => { setLocale(code); closeLang(); };

        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); closeLang(); return; }
            if (e.key === 'Tab') {
                const f = sheetEl.value?.querySelectorAll('button:not([disabled])');
                if (!f || !f.length) return;
                const first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };

        onMounted(() => {
            lastFocused = document.activeElement;
            document.addEventListener('keydown', onKey, true);
            nextTick(() => {
                // Land focus on the active language so keyboard users start there.
                const active = sheetEl.value?.querySelector('.langopt.is-on') || sheetEl.value;
                active?.focus?.();
            });
        });
        onBeforeUnmount(() => {
            document.removeEventListener('keydown', onKey, true);
            try { lastFocused?.focus?.(); } catch {}
        });

        return { LOCALES, locale, pick, closeLang, store, flagUrl, flagFailed };
    },
    template: /*html*/`
    <div class="langsheet" role="dialog" aria-modal="true" :aria-label="$t('lang.title')" ref="sheetEl" tabindex="-1">
        <div class="langsheet__head">
            <h3>{{ $t('lang.title') }}</h3>
            <button class="iconbtn" @click="closeLang()" :aria-label="$t('common.close')"><Icon name="close" /></button>
        </div>
        <div class="langsheet__list">
            <button v-for="l in LOCALES" :key="l.code" class="langopt" :class="{ 'is-on': l.code === locale }"
                    @click="pick(l.code)" :aria-pressed="l.code === locale">
                <img v-if="!flagFailed[l.cc]" class="langopt__flag" :src="flagUrl(l.cc)" :alt="''"
                     loading="lazy" draggable="false" @error="flagFailed[l.cc] = true" />
                <span v-else class="langopt__flag langopt__flag--fb" aria-hidden="true">{{ l.cc.toUpperCase() }}</span>
                <span class="langopt__name">{{ l.label }}</span>
                <Icon v-if="l.code === locale" name="check" :size="18" class="langopt__check" />
            </button>
        </div>
    </div>`,
};
