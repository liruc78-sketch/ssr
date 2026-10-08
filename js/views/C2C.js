// C2C — peer-to-peer marketplace (merchant offers)
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { t } from '../i18n.js';

const PAYS = ['Bank Transfer', 'Wise', 'PayPal', 'Revolut', 'SEPA'];
function genOffers(side) {
    const out = [];
    for (let i = 0; i < 8; i++) {
        const rate = 1 + (Math.random() - 0.5) * 0.03;
        out.push({
            id: i,
            name: 'Trader' + String.fromCharCode(65 + i) + Math.floor(Math.random() * 90 + 10),
            done: (95 + Math.random() * 4.9).toFixed(1),
            orders: Math.floor(Math.random() * 4000 + 200),
            price: (1.00 * rate).toFixed(3),
            available: (Math.random() * 90000 + 2000).toFixed(2),
            min: Math.floor(Math.random() * 400 + 100),
            max: Math.floor(Math.random() * 40000 + 5000),
            pays: [...PAYS].sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 2) + 1),
        });
    }
    return out;
}

export default {
    name: 'C2C',
    components: { Icon },
    setup() {
        const side = ref('buy');
        const coin = ref('USDT');
        const fiat = ref('USD');
        const offers = computed(() => genOffers(side.value));
        const payLabel = (p) => p === 'Bank Transfer' ? t('c2c.payBankTransfer') : p;
        const act = (o) => { if (!store.isAuthed) { go('/login'); return; } toast(t(side.value === 'buy' ? 'c2c.toastBuy' : 'c2c.toastSell', { name: o.name }), 'success'); };
        return { side, coin, fiat, offers, act, go, store, payLabel };
    },
    template: /*html*/`
    <section class="c2c">
        <div class="page-head"><h1 class="page-title">{{ $t('nav.c2c') }}</h1></div>

        <div class="seg seg--side" style="max-width:260px; margin-bottom:var(--sp-4)">
            <button class="seg__btn" :class="{ 'is-on up-on': side === 'buy' }" @click="side = 'buy'">{{ $t('c2c.buy') }}</button>
            <button class="seg__btn" :class="{ 'is-on down-on': side === 'sell' }" @click="side = 'sell'">{{ $t('c2c.sell') }}</button>
        </div>

        <div class="c2c__filters">
            <select class="field" v-model="coin" style="max-width:120px"><option v-for="c in ['USDT','USDC','BTC','ETH']" :key="c">{{ c }}</option></select>
            <select class="field" v-model="fiat" style="max-width:120px"><option v-for="f in ['USD','EUR','GBP','JPY']" :key="f">{{ f }}</option></select>
        </div>

        <div class="c2c__list">
            <div v-for="o in offers" :key="o.id" class="card c2c__offer">
                <div class="c2c__merchant">
                    <span class="c2c__ava">{{ o.name.slice(0,1) }}</span>
                    <div>
                        <b>{{ o.name }}</b>
                        <div class="muted" style="font-size:var(--fs-caption)">{{ $t('c2c.ordersCount', { n: o.orders }) }} · {{ o.done }}%</div>
                    </div>
                </div>
                <div class="c2c__body">
                    <div class="c2c__price"><b class="num">{{ o.price }}</b> <span class="muted">{{ fiat }}/{{ coin }}</span></div>
                    <div class="muted" style="font-size:var(--fs-caption)">{{ $t('c2c.available') }} <span class="num">{{ o.available }}</span> {{ coin }}</div>
                    <div class="muted" style="font-size:var(--fs-caption)">{{ $t('c2c.limit') }} {{ o.min }}–{{ o.max }} {{ fiat }}</div>
                    <div class="c2c__pays">
                        <span v-for="p in o.pays" :key="p" class="chip" style="background:var(--surface-2)">{{ payLabel(p) }}</span>
                    </div>
                </div>
                <button class="btn btn--sm" :class="side === 'buy' ? 'btn--up' : 'btn--down'" @click="act(o)">{{ side === 'buy' ? $t('c2c.buy') : $t('c2c.sell') }} {{ coin }}</button>
            </div>
        </div>
    </section>`,
};
