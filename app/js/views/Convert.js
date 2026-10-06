// Convert — instant swap between assets
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { COINS, findSym, fmtNum } from '../data.js';

export default {
    name: 'Convert',
    components: { Icon },
    setup() {
        const assets = ['USDT', ...COINS.map(c => c.sym)];
        const from = ref('BTC');
        const to = ref('USDT');
        const amount = ref('');
        const priceOf = (s) => s === 'USDT' ? 1 : (findSym(s)?.price || 0);
        const rate = computed(() => { const p = priceOf(to.value); return p ? priceOf(from.value) / p : 0; });
        const outAmount = computed(() => { const a = parseFloat(amount.value) || 0; return a * rate.value; });
        const available = computed(() => (store.isAuthed && from.value === 'USDT') ? store.portfolio.usdBalance : 0);

        const swap = () => { const t = from.value; from.value = to.value; to.value = t; };
        const exchange = () => {
            if (!store.isAuthed) { go('/login'); return; }
            if (from.value === to.value) { toast('Pick two different assets', 'error'); return; }
            if (!(parseFloat(amount.value) > 0)) { toast('Enter an amount', 'error'); return; }
            toast('Converted (demo)', 'success');
        };
        return { assets, from, to, amount, rate, outAmount, available, swap, exchange, go, fmtNum, store };
    },
    template: /*html*/`
    <section class="pay">
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">Convert</h1></div>

        <div class="card pay__card">
            <label class="paystep"><span class="eyebrow">From</span>
                <div class="convert__row">
                    <select class="field convert__sel" v-model="from"><option v-for="a in assets" :key="a" :value="a">{{ a }}</option></select>
                    <input class="field num convert__amt" v-model="amount" placeholder="0" />
                </div>
            </label>
            <div class="xfer__swap"><button class="iconbtn" @click="swap" aria-label="Swap"><Icon name="transfer" /></button></div>
            <label class="paystep"><span class="eyebrow">To</span>
                <div class="convert__row">
                    <select class="field convert__sel" v-model="to"><option v-for="a in assets" :key="a" :value="a">{{ a }}</option></select>
                    <div class="field num convert__amt" style="display:flex; align-items:center; justify-content:flex-end; color:var(--text-2)">{{ fmtNum(outAmount) }}</div>
                </div>
            </label>

            <div class="payline"><span class="muted">Rate</span><span class="num">1 {{ from }} ≈ {{ fmtNum(rate) }} {{ to }}</span></div>
            <div class="payline"><span class="muted">Available</span><span class="num">{{ fmtNum(available) }} {{ from }}</span></div>

            <button class="btn btn--block btn--lg" :class="store.isAuthed ? 'btn--brand' : 'btn--dark'" @click="exchange">{{ store.isAuthed ? 'Exchange' : 'Log in to convert' }}</button>
        </div>
    </section>`,
};
