// Home — landing dashboard
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Icon } from '../icons.js';
import { CoinIcon } from '../components/CoinIcon.js';
import { WALLETS } from '../components/wallets.js';
import { go } from '../router.js';
import { COINS, fmtPrice, fmtChg, genFeed, FAQ } from '../data.js';

export default {
    name: 'Home',
    components: { Icon, CoinIcon },
    setup() {
        const actions = [
            { icon: 'deposit',  tkey: 'home.action.deposit',  path: '/deposit' },
            { icon: 'withdraw', tkey: 'home.action.withdraw', path: '/withdraw' },
            { icon: 'trade',    tkey: 'home.action.trade',    path: '/trade' },
            { icon: 'convert',  tkey: 'home.action.convert',  path: '/convert' },
        ];
        const slides = [
            { kKey: 'home.slide1.kicker', tKey: 'home.slide1.title', sKey: 'home.slide1.sub', tone: 'brand' },
            { kKey: 'home.slide2.kicker', tKey: 'home.slide2.title', sKey: 'home.slide2.sub', tone: 'up' },
            { kKey: 'home.slide3.kicker', tKey: 'home.slide3.title', sKey: 'home.slide3.sub', tone: 'gold' },
        ];
        const slide = ref(0);
        let timer = null;
        const goSlide = (i) => { slide.value = (i + slides.length) % slides.length; };
        onMounted(() => { timer = setInterval(() => goSlide(slide.value + 1), 5000); });
        onBeforeUnmount(() => clearInterval(timer));

        const coins = COINS;
        const topCoins = COINS.slice(0, 12);   // compact home preview; full list on /market
        const feed = genFeed(8);
        const faq = FAQ;
        const openFaq = ref(0);

        // Home search → hands the query to the Market view.
        const q = ref('');
        const search = () => go('/market' + (q.value.trim() ? '?q=' + encodeURIComponent(q.value.trim()) : ''));

        // Markets carousel: paged horizontal slider (drag + animated slide + dots).
        const PER_PAGE = 3;
        const marketPages = computed(() => {
            const out = [];
            for (let i = 0; i < topCoins.length; i += PER_PAGE) out.push(topCoins.slice(i, i + PER_PAGE));
            return out;
        });
        const mcarEl = ref(null);
        const mpage = ref(0);
        const mTx = ref(0);          // track translateX in px
        const mAnim = ref(true);     // slide transition on (off while finger-dragging)
        const mDrag = { down: false, startX: 0, dx: 0, moved: false };
        const relayout = () => { mTx.value = -mpage.value * (mcarEl.value ? mcarEl.value.clientWidth : 0); };
        const setPage = (i) => {
            mpage.value = Math.max(0, Math.min(marketPages.value.length - 1, i));
            mAnim.value = true; relayout();
        };
        const onMDown = (e) => {
            const el = mcarEl.value; if (!el) return;
            mDrag.down = true; mDrag.moved = false; mDrag.startX = e.clientX; mDrag.dx = 0;
            mAnim.value = false;                 // follow the finger 1:1
            try { el.setPointerCapture(e.pointerId); } catch {}
        };
        const onMMove = (e) => {
            if (!mDrag.down) return;
            mDrag.dx = e.clientX - mDrag.startX;
            if (Math.abs(mDrag.dx) > 4) mDrag.moved = true;
            mTx.value = -mpage.value * mcarEl.value.clientWidth + mDrag.dx;
        };
        const onMUp = (e) => {
            if (!mDrag.down) return;
            mDrag.down = false;
            try { mcarEl.value && mcarEl.value.releasePointerCapture(e.pointerId); } catch {}
            const w = mcarEl.value.clientWidth || 1;
            const threshold = w * 0.18;
            let target = mpage.value;
            if (mDrag.dx <= -threshold) target++; else if (mDrag.dx >= threshold) target--;
            setPage(target);                     // animated snap to the resolved page
        };
        // A drag shouldn't also open the coin it ends on.
        const openCoin = (c) => { if (mDrag.moved) { mDrag.moved = false; return; } go('/coin?sym=' + c.sym); };
        onMounted(() => { relayout(); window.addEventListener('resize', relayout); });
        onBeforeUnmount(() => window.removeEventListener('resize', relayout));

        const trust = [
            { titleKey: 'home.trust1.title', bodyKey: 'home.trust1.body', img: 'assets/why/security.svg' },
            { titleKey: 'home.trust2.title', bodyKey: 'home.trust2.body', img: 'assets/why/tracking.svg' },
            { titleKey: 'home.trust3.title', bodyKey: 'home.trust3.body', img: 'assets/why/alerts.svg' },
        ];

        return { actions, slides, slide, goSlide, coins, topCoins, feed, faq, openFaq, trust, wallets: WALLETS, q, search, go, fmtPrice, fmtChg,
                 marketPages, mcarEl, mpage, mTx, mAnim, setPage, onMDown, onMMove, onMUp, openCoin };
    },
    template: /*html*/`
    <section class="home">
        <!-- Market search -->
        <div class="home-search" @click="$refs.sx.focus()">
            <Icon name="search" :size="18" />
            <input ref="sx" v-model="q" type="search" inputmode="search" :placeholder="$t('home.searchPlaceholder')"
                   @keyup.enter="search" :aria-label="$t('home.searchPlaceholder')" />
            <button v-if="q" class="home-search__go btn btn--brand btn--sm btn--pill" @click.stop="search">{{ $t('common.search') }}</button>
        </div>

        <!-- Quick actions -->
        <div class="quickrow">
            <button v-for="a in actions" :key="a.tkey" class="quickrow__item" @click="go(a.path)">
                <span class="quickrow__ico"><Icon :name="a.icon" :size="22" /></span>
                <span>{{ $t(a.tkey) }}</span>
            </button>
        </div>

        <!-- Carousel -->
        <div class="carousel">
            <div class="carousel__track" :style="{ transform: 'translateX(-' + (slide * 100) + '%)' }">
                <div v-for="(s, i) in slides" :key="i" class="slide" :class="'slide--' + s.tone">
                    <div class="slide__kicker">{{ $t(s.kKey) }}</div>
                    <div class="slide__title">{{ $t(s.tKey) }}</div>
                    <div class="slide__sub">{{ $t(s.sKey) }}</div>
                    <span class="slide__glow"></span>
                </div>
            </div>
            <div class="carousel__dots">
                <button v-for="(s, i) in slides" :key="i" class="dot" :class="{ 'is-on': i === slide }" @click="goSlide(i)" :aria-label="'Slide ' + (i+1)"></button>
            </div>
        </div>

        <!-- Currency quotes -->
        <div class="sec-head">
            <h2>{{ $t('home.markets') }}</h2>
            <button class="btn btn--ghost btn--sm" @click="go('/market')">{{ $t('common.viewAll') }} <Icon name="chevronR" :size="16" /></button>
        </div>
        <div class="mcar" ref="mcarEl" @pointerdown="onMDown" @pointermove="onMMove" @pointerup="onMUp" @pointercancel="onMUp">
            <div class="mcar__track" :class="{ 'is-anim': mAnim }" :style="{ transform: 'translateX(' + mTx + 'px)' }">
                <div v-for="(pg, pi) in marketPages" :key="pi" class="mcar__page">
                    <button v-for="c in pg" :key="c.sym" class="qcard" @click="openCoin(c)">
                        <span class="qcard__top">
                            <CoinIcon :sym="c.sym" :color="c.color" cls="qcard__ico" />
                            <b>{{ c.sym }}</b>
                        </span>
                        <span class="qcard__px num">{{ fmtPrice(c.price) }}</span>
                        <span class="qcard__chg num" :class="c.chg >= 0 ? 'chip chip--up' : 'chip chip--down'">{{ fmtChg(c.chg) }}</span>
                    </button>
                </div>
            </div>
        </div>
        <div class="mcar__dots">
            <button v-for="(pg, pi) in marketPages" :key="pi" class="dot" :class="{ 'is-on': pi === mpage }" @click="setPage(pi)" :aria-label="'Markets page ' + (pi + 1)"></button>
        </div>

        <!-- Real-time transactions -->
        <div class="sec-head"><h2>{{ $t('home.activity') }}</h2><span class="muted" style="font-size:var(--fs-small)">{{ $t('home.activitySub') }}</span></div>
        <div class="feed card">
            <div v-for="(f, i) in feed" :key="i" class="feed__row">
                <span class="feed__dot" :class="f.up ? 'up' : 'down'"></span>
                <span class="feed__user num">{{ f.user }}</span>
                <span class="chip" style="background:var(--surface-2)">{{ $t(f.productKey) }}</span>
                <span class="feed__ago muted">{{ $t(f.agoKey, { n: f.agoN }) }}</span>
                <span class="feed__amt num" :class="f.up ? 'up' : 'down'">{{ f.up ? '+' : '' }}{{ f.amount }}</span>
            </div>
        </div>

        <!-- Why trade with us -->
        <div class="sec-head"><h2>{{ $t('home.why') }}</h2></div>
        <div class="trust">
            <div v-for="t in trust" :key="t.titleKey" class="trust__card card">
                <span class="trust__ico"><img :src="t.img" :alt="$t(t.titleKey)" draggable="false" /></span>
                <h4>{{ $t(t.titleKey) }}</h4>
                <p class="muted" style="font-size:var(--fs-small)">{{ $t(t.bodyKey) }}</p>
            </div>
        </div>

        <!-- Partners / supported wallets -->
        <div class="sec-head"><h2>{{ $t('home.partners') }}</h2><span class="muted" style="font-size:var(--fs-small)">{{ $t('home.partnersSub') }}</span></div>
        <div class="partners">
            <div v-for="w in wallets" :key="w.name" class="partner">
                <img class="partner__logo" :src="w.img" :alt="w.name" loading="lazy" draggable="false" />
            </div>
        </div>

        <!-- FAQ -->
        <div class="sec-head"><h2>{{ $t('home.questions') }}</h2></div>
        <div class="faq card">
            <div v-for="(f, i) in faq" :key="i" class="faq__item" :class="{ 'is-open': openFaq === i }">
                <button class="faq__q" @click="openFaq = openFaq === i ? -1 : i">
                    <span>{{ $t(f.qKey) }}</span>
                    <Icon name="chevronD" :size="18" class="faq__chev" />
                </button>
                <div class="faq__a" v-show="openFaq === i"><p class="muted">{{ $t(f.aKey) }}</p></div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="home-footer">
            <div class="brand"><img class="brand__logo" src="crypto-ssr-icon.svg" alt="" width="30" height="30" draggable="false" /><span class="brand__name">Crypto<b>.ssr</b></span></div>
            <p class="muted" style="font-size:var(--fs-small); margin-top:8px">{{ $t('home.footerTagline') }}</p>
            <p class="faint" style="font-size:var(--fs-caption); margin-top:12px">{{ $t('home.footerLegal') }}</p>
        </footer>
    </section>`,
};
