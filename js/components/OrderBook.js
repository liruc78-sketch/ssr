// Live order book — asks (top) / mid price / bids (bottom) with depth bars.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { fmtNum } from '../data.js';

export default {
    name: 'OrderBook',
    props: {
        price: { type: Number, default: 0 },
        rows: { type: Number, default: 8 },
        onPick: { type: Function, default: null },
    },
    setup(props) {
        const asks = ref([]), bids = ref([]), mid = ref(props.price), dir = ref('up');

        function build() {
            const base = props.price || mid.value || 100;
            const tick = Math.max(base * 0.00008, 0.000001);
            const a = [], b = [];
            let maxAmt = 0;
            for (let i = 1; i <= props.rows; i++) {
                const aAmt = Math.random() * 0.6 + 0.01;
                const bAmt = Math.random() * 0.6 + 0.01;
                maxAmt = Math.max(maxAmt, aAmt, bAmt);
                a.push({ price: base + tick * i, amount: aAmt });
                b.push({ price: base - tick * i, amount: bAmt });
            }
            asks.value = a.reverse().map(x => ({ ...x, pct: (x.amount / maxAmt) * 100 }));
            bids.value = b.map(x => ({ ...x, pct: (x.amount / maxAmt) * 100 }));
            const jitter = base * (Math.random() - 0.5) * 0.0004;
            const next = base + jitter;
            dir.value = next >= mid.value ? 'up' : 'down';
            mid.value = next;
        }

        let timer = null;
        onMounted(() => { build(); timer = setInterval(build, 1800); });
        onBeforeUnmount(() => clearInterval(timer));
        watch(() => props.price, (p) => { if (p) { mid.value = p; build(); } });

        return { asks, bids, mid, dir, fmtNum, pick: (row) => props.onPick && props.onPick(row.price) };
    },
    template: /*html*/`
    <div class="ob">
        <div class="ob__h"><span>{{ $t('orderbook.price') }}</span><span>{{ $t('orderbook.amount') }}</span></div>
        <button v-for="(a, i) in asks" :key="'a'+i" class="ob__row" @click="pick(a)">
            <span class="ob__bar down" :style="{ width: a.pct + '%' }"></span>
            <span class="num down">{{ fmtNum(a.price) }}</span><span class="num ob__amt">{{ a.amount.toFixed(4) }}</span>
        </button>
        <div class="ob__mid" :class="dir">
            <span class="num">{{ fmtNum(mid) }}</span>
        </div>
        <button v-for="(b, i) in bids" :key="'b'+i" class="ob__row" @click="pick(b)">
            <span class="ob__bar up" :style="{ width: b.pct + '%' }"></span>
            <span class="num up">{{ fmtNum(b.price) }}</span><span class="num ob__amt">{{ b.amount.toFixed(4) }}</span>
        </button>
    </div>`,
};
