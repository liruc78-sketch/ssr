// Markets — category tabs, search, watchlist, live crypto prices
import { ref, computed, onMounted } from 'vue';
import { Icon } from '../icons.js';
import { CoinIcon } from '../components/CoinIcon.js';
import { go, router } from '../router.js';
import { COINS, US_STOCKS, FX, CATEGORIES, fetchTickers, fmtPrice, fmtChg } from '../data.js';

const CRYPTO_SYMS = new Set(COINS.map(c => c.sym));
const WATCH_KEY = 'ssr_watch';
function loadWatch() {
    try { const v = JSON.parse(localStorage.getItem(WATCH_KEY) || 'null'); return new Set(v || COINS.map(c => c.sym)); }
    catch { return new Set(COINS.map(c => c.sym)); }
}

export default {
    name: 'Market',
    components: { Icon, CoinIcon },
    setup() {
        const cat = ref(['us', 'fx', 'crypto', 'watch'].includes(router.query.cat) ? router.query.cat : 'crypto');
        const query = ref(router.query.q || '');
        // Reached from the sim wallet ("Start simulated trading") — picking an
        // instrument here opens the trade screen for it in simulated mode.
        const sim = router.query.sim === '1';
        const coins = ref(COINS.map(c => ({ ...c })));   // live-updatable
        const watch = ref(loadWatch());

        onMounted(async () => {
            try { coins.value = await fetchTickers(coins.value); } catch { /* keep seed */ }
        });

        const base = computed(() => {
            if (cat.value === 'crypto') return coins.value;
            if (cat.value === 'us') return US_STOCKS;
            if (cat.value === 'fx') return FX;
            // watchlist: any instrument whose sym is starred
            return [...coins.value, ...US_STOCKS, ...FX].filter(c => watch.value.has(c.sym));
        });
        const list = computed(() => {
            const q = query.value.trim().toUpperCase();
            return q ? base.value.filter(c => c.sym.includes(q) || c.name.toUpperCase().includes(q)) : base.value;
        });

        const isWatched = (sym) => watch.value.has(sym);
        const toggleWatch = (sym) => {
            const s = new Set(watch.value);
            s.has(sym) ? s.delete(sym) : s.add(sym);
            watch.value = s;
            try { localStorage.setItem(WATCH_KEY, JSON.stringify([...s])); } catch {}
        };
        const open = (c) => go(sim ? ('/trade?pair=' + c.sym + '&mode=options&sim=1') : ('/coin?sym=' + c.sym));

        return { cat, query, sim, CATEGORIES, list, isWatched, toggleWatch, open, go, fmtPrice, fmtChg, CRYPTO_SYMS };
    },
    template: /*html*/`
    <section class="market">
        <div v-if="sim" class="simbanner">
            <Icon name="shield" :size="16" />
            <span><b>{{ $t('sim.bannerTitle') }}</b> — {{ $t('sim.bannerBody') }}</span>
        </div>
        <div class="market__head">
            <div class="tabs">
                <button v-for="c in CATEGORIES" :key="c.key" class="tab" :class="{ 'is-on': cat === c.key }" @click="cat = c.key">{{ $t(c.tkey) }}</button>
            </div>
            <label class="search">
                <Icon name="search" :size="18" />
                <input v-model="query" class="search__input" :placeholder="$t('market.searchPlaceholder')" />
            </label>
        </div>

        <div class="market__list card">
            <div class="market__row market__row--head">
                <span>{{ $t('market.pair') }}</span><span>{{ $t('market.lastPrice') }}</span><span>24h</span><span></span>
            </div>
            <div v-if="!list.length" class="placeholder" style="border:0; padding:var(--sp-10)">
                <Icon name="star" class="placeholder__icon" :size="48" />
                <p class="muted">{{ $t('market.watchlistEmpty') }}</p>
            </div>
            <button v-for="c in list" :key="c.sym" class="market__row" @click="open(c)">
                <span class="market__pair">
                    <CoinIcon :sym="c.sym" :color="c.color" :crypto="CRYPTO_SYMS.has(c.sym)" :domain="c.domain" :fxbase="c.base" :fxquote="c.quote" cls="market__ico" />
                    <span class="market__id"><b>{{ c.sym }}</b><span class="muted" style="font-size:var(--fs-caption)">{{ c.name }}</span></span>
                </span>
                <span class="market__px num">{{ fmtPrice(c.price) }}</span>
                <span class="market__chg num" :class="c.chg >= 0 ? 'chip chip--up' : 'chip chip--down'">{{ fmtChg(c.chg) }}</span>
                <button class="market__star" :class="{ 'is-on': isWatched(c.sym) }" @click.stop="toggleWatch(c.sym)" :aria-label="isWatched(c.sym) ? $t('market.unwatch') : $t('market.watch')">
                    <Icon name="star" :size="18" />
                </button>
            </button>
        </div>
    </section>`,
};
