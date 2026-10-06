// News — crypto news feed with sentiment (sample content; wires to a feed later)
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';

const ARTICLES = [
    { src: 'Market Desk', time: '12m', coins: ['BTC'], sent: 'bull', title: 'Bitcoin holds above key support as volatility cools', summary: 'Spot volumes ticked higher into the session while implied volatility eased, suggesting traders are positioning for a calmer range near-term.' },
    { src: 'Chain Weekly', time: '48m', coins: ['ETH'], sent: 'neutral', title: 'Ethereum staking inflows steady after protocol update', summary: 'Validator queues normalized this week; net staking flows were broadly flat as the latest upgrade bedded in.' },
    { src: 'Desk Notes', time: '2h', coins: ['SOL', 'ADA'], sent: 'bull', title: 'Layer-1 majors outperform as risk appetite returns', summary: 'Higher-beta layer-1 tokens led gains, with turnover concentrated in the top pairs during Asian hours.' },
    { src: 'Macro Brief', time: '4h', coins: ['BTC'], sent: 'bear', title: 'Stronger dollar weighs on risk assets into month-end', summary: 'A firmer dollar and higher yields pressured risk assets broadly; crypto majors drifted lower in thin liquidity.' },
    { src: 'Regulatory', time: '6h', coins: [], sent: 'neutral', title: 'Exchanges expand proof-of-reserves disclosures', summary: 'Several venues published updated reserve attestations, continuing a trend toward greater on-chain transparency.' },
];
const TAGS = ['BTC', 'ETH', 'DeFi', 'Regulation', 'Layer-1', 'Stablecoins'];

export default {
    name: 'News',
    components: { Icon },
    setup() {
        const q = ref('');
        const list = computed(() => {
            const s = q.value.trim().toLowerCase();
            return s ? ARTICLES.filter(a => (a.title + a.summary + a.coins.join()).toLowerCase().includes(s)) : ARTICLES;
        });
        const sentLabel = { bull: 'Bullish', bear: 'Bearish', neutral: 'Neutral' };
        return { q, list, TAGS, sentLabel };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><h1 class="page-title">News</h1></div>
        <label class="search" style="margin-top:0"><Icon name="search" :size="18" /><input class="search__input" v-model="q" placeholder="Search topics, e.g. BTC, DeFi" /></label>
        <div class="news__tags">
            <span class="muted" style="font-size:var(--fs-caption)">Trending:</span>
            <button v-for="t in TAGS" :key="t" class="chip" style="background:var(--surface-2)" @click="q = t">{{ t }}</button>
        </div>

        <div class="news__list">
            <article v-for="(a, i) in list" :key="i" class="card news__card">
                <div class="news__meta">
                    <span class="num">{{ a.src }}</span><span class="news__dot">·</span><span>{{ a.time }} ago</span>
                    <span class="chip" :class="a.sent === 'bull' ? 'chip--up' : a.sent === 'bear' ? 'chip--down' : ''" style="margin-left:auto">{{ sentLabel[a.sent] }}</span>
                </div>
                <h3 class="news__title">{{ a.title }}</h3>
                <p class="muted news__sum">{{ a.summary }}</p>
                <div class="news__coins"><span v-for="c in a.coins" :key="c" class="chip chip--brand">{{ c }}</span></div>
            </article>
        </div>
    </section>`,
};
