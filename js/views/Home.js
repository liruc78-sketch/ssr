// Home — landing dashboard
import { ref, onMounted, onBeforeUnmount } from 'vue';
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
            { icon: 'deposit',  label: 'Deposit',  path: '/deposit' },
            { icon: 'withdraw', label: 'Withdraw', path: '/withdraw' },
            { icon: 'trade',    label: 'Trade',    path: '/trade' },
            { icon: 'convert',  label: 'Convert',  path: '/convert' },
        ];
        const slides = [
            { kicker: 'Milestone', title: 'Over $90M', sub: 'in deposits secured this quarter', tone: 'brand' },
            { kicker: 'New', title: 'Perpetuals', sub: 'Trade with up to 100× leverage', tone: 'up' },
            { kicker: 'Earn', title: 'Finance', sub: 'Put idle USDT to work, daily yield', tone: 'gold' },
        ];
        const slide = ref(0);
        let timer = null;
        const goSlide = (i) => { slide.value = (i + slides.length) % slides.length; };
        onMounted(() => { timer = setInterval(() => goSlide(slide.value + 1), 5000); });
        onBeforeUnmount(() => clearInterval(timer));

        const coins = COINS;
        const topCoins = COINS.slice(0, 20);   // compact home preview; full list on /market
        const feed = genFeed(8);
        const faq = FAQ;
        const openFaq = ref(0);

        // Home search → hands the query to the Market view.
        const q = ref('');
        const search = () => go('/market' + (q.value.trim() ? '?q=' + encodeURIComponent(q.value.trim()) : ''));

        const trust = [
            {
                title: 'Enhanced security via encryption',
                body: 'Balances and keys are protected with encrypted storage and cloud backup, so your assets stay safe.',
                img: 'assets/why/security.svg',
            },
            {
                title: 'Zero personal tracking',
                body: 'We never track any personal information, including your IP address or balance, across the web.',
                img: 'assets/why/tracking.svg',
            },
            {
                title: 'Proactive risk alerts',
                body: 'Withdrawal-address and DApp-connection alerts flag risky activity before it becomes a problem.',
                img: 'assets/why/alerts.svg',
            },
        ];

        return { actions, slides, slide, goSlide, coins, topCoins, feed, faq, openFaq, trust, wallets: WALLETS, q, search, go, fmtPrice, fmtChg };
    },
    template: /*html*/`
    <section class="home">
        <!-- Market search -->
        <div class="home-search" @click="$refs.sx.focus()">
            <Icon name="search" :size="18" />
            <input ref="sx" v-model="q" type="search" inputmode="search" placeholder="Search the market here"
                   @keyup.enter="search" aria-label="Search the market" />
            <button v-if="q" class="home-search__go btn btn--brand btn--sm btn--pill" @click.stop="search">Search</button>
        </div>

        <!-- Quick actions -->
        <div class="quickrow">
            <button v-for="a in actions" :key="a.label" class="quickrow__item" @click="go(a.path)">
                <span class="quickrow__ico"><Icon :name="a.icon" :size="22" /></span>
                <span>{{ a.label }}</span>
            </button>
        </div>

        <!-- Carousel -->
        <div class="carousel">
            <div class="carousel__track" :style="{ transform: 'translateX(-' + (slide * 100) + '%)' }">
                <div v-for="(s, i) in slides" :key="i" class="slide" :class="'slide--' + s.tone">
                    <div class="slide__kicker">{{ s.kicker }}</div>
                    <div class="slide__title">{{ s.title }}</div>
                    <div class="slide__sub">{{ s.sub }}</div>
                    <span class="slide__glow"></span>
                </div>
            </div>
            <div class="carousel__dots">
                <button v-for="(s, i) in slides" :key="i" class="dot" :class="{ 'is-on': i === slide }" @click="goSlide(i)" :aria-label="'Slide ' + (i+1)"></button>
            </div>
        </div>

        <!-- Currency quotes -->
        <div class="sec-head">
            <h2>Markets</h2>
            <button class="btn btn--ghost btn--sm" @click="go('/market')">View all <Icon name="chevronR" :size="16" /></button>
        </div>
        <div class="quotes-scroll">
            <button v-for="c in topCoins" :key="c.sym" class="qcard" @click="go('/coin?sym=' + c.sym)">
                <span class="qcard__top">
                    <CoinIcon :sym="c.sym" :color="c.color" cls="qcard__ico" />
                    <b>{{ c.sym }}</b>
                </span>
                <span class="qcard__px num">{{ fmtPrice(c.price) }}</span>
                <span class="qcard__chg num" :class="c.chg >= 0 ? 'chip chip--up' : 'chip chip--down'">{{ fmtChg(c.chg) }}</span>
            </button>
        </div>

        <!-- Real-time transactions -->
        <div class="sec-head"><h2>Real-time activity</h2><span class="muted" style="font-size:var(--fs-small)">What traders are doing now</span></div>
        <div class="feed card">
            <div v-for="(f, i) in feed" :key="i" class="feed__row">
                <span class="feed__dot" :class="f.up ? 'up' : 'down'"></span>
                <span class="feed__user num">{{ f.user }}</span>
                <span class="chip" style="background:var(--surface-2)">{{ f.product }}</span>
                <span class="feed__ago muted">{{ f.ago }}</span>
                <span class="feed__amt num" :class="f.up ? 'up' : 'down'">{{ f.up ? '+' : '' }}{{ f.amount }}</span>
            </div>
        </div>

        <!-- Why trade with us -->
        <div class="sec-head"><h2>Why trade with us</h2></div>
        <div class="trust">
            <div v-for="t in trust" :key="t.title" class="trust__card card">
                <span class="trust__ico"><img :src="t.img" :alt="t.title" draggable="false" /></span>
                <h4>{{ t.title }}</h4>
                <p class="muted" style="font-size:var(--fs-small)">{{ t.body }}</p>
            </div>
        </div>

        <!-- Partners / supported wallets -->
        <div class="sec-head"><h2>Partners</h2><span class="muted" style="font-size:var(--fs-small)">Connect the wallet you already use</span></div>
        <div class="partners">
            <div v-for="w in wallets" :key="w.name" class="partner">
                <img class="partner__logo" :src="w.img" :alt="w.name" loading="lazy" draggable="false" />
            </div>
        </div>

        <!-- FAQ -->
        <div class="sec-head"><h2>Common questions</h2></div>
        <div class="faq card">
            <div v-for="(f, i) in faq" :key="i" class="faq__item" :class="{ 'is-open': openFaq === i }">
                <button class="faq__q" @click="openFaq = openFaq === i ? -1 : i">
                    <span>{{ f.q }}</span>
                    <Icon name="chevronD" :size="18" class="faq__chev" />
                </button>
                <div class="faq__a" v-show="openFaq === i"><p class="muted">{{ f.a }}</p></div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="home-footer">
            <div class="brand"><img class="brand__logo" src="crypto-ssr-icon.svg" alt="" width="30" height="30" draggable="false" /><span class="brand__name">Crypto<b>.ssr</b></span></div>
            <p class="muted" style="font-size:var(--fs-small); margin-top:8px">Your next-generation trading platform.</p>
            <p class="faint" style="font-size:var(--fs-caption); margin-top:12px">© 2026 Crypto.ssr · Trade responsibly. Markets carry risk.</p>
        </footer>
    </section>`,
};
