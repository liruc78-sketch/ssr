// Trade — Spot (order book + form) · Perpetual (leverage + TP/SL) · Options (binary)
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Icon } from '../icons.js';
import { go, router } from '../router.js';
import { store } from '../store.js';
import { toast } from '../store.js';
import { findSym, fetchTickers, OPTION_TIERS, LEVERAGES, fmtNum, fmtPrice } from '../data.js';
import OrderBook from '../components/OrderBook.js';

export default {
    name: 'Trade',
    components: { Icon, OrderBook },
    setup() {
        const coin = findSym(router.query.pair) || findSym('BTC');
        const MODES = [{ k: 'spot', label: 'Spot' }, { k: 'perp', label: 'Perpetual contract' }, { k: 'options', label: 'Options' }];
        const mode = ref(['spot', 'perp', 'options'].includes(router.query.mode) ? router.query.mode : 'spot');

        const price = ref(coin?.price || 0);
        const balance = computed(() => store.isAuthed ? (store.session?.usdBalance || 0) : 0);

        // shared order form
        const f = reactive({ side: 'buy', type: 'market', price: '', amount: '', lev: 10, tpsl: false, tp: '', sl: '' });
        // options
        const o = reactive({ tab: 'now', tier: 30, amount: '' });
        const ledgerTab = ref('open');

        let timer = null;
        onMounted(async () => {
            try { const [u] = await fetchTickers([coin]); if (u) price.value = u.price; } catch {}
            timer = setInterval(() => { price.value = price.value * (1 + (Math.random() - 0.5) * 0.0006); }, 2000);
        });
        onBeforeUnmount(() => clearInterval(timer));
        watch(mode, () => { ledgerTab.value = 'open'; });

        const setPct = (p) => { /* demo: scales a nominal size */ f.amount = ((balance.value || 1000) * p / 100 / (price.value || 1)).toFixed(6); };
        const pickPrice = (px) => { f.type = 'limit'; f.price = fmtNum(px); };
        const activeTier = computed(() => OPTION_TIERS.find(t => t.sec === o.tier) || OPTION_TIERS[0]);
        const tierLocked = (t) => t.min > balance.value;
        const optProfit = computed(() => {
            const amt = parseFloat(o.amount) || 0;
            return (amt * (activeTier.value.payout - 1)).toFixed(2);
        });

        const needAuth = computed(() => !store.isAuthed);
        const act = (label) => {
            if (needAuth.value) { go('/login'); return; }
            toast(`${label} order placed (demo)`, 'success');
        };

        const ledgerTabs = computed(() => mode.value === 'spot'
            ? [{ k: 'open', l: 'Current Order' }, { k: 'hist', l: 'Trade History' }, { k: 'assets', l: 'Assets' }]
            : mode.value === 'perp'
                ? [{ k: 'open', l: 'My Holding' }, { k: 'pos', l: 'Current Position' }, { k: 'hist', l: 'Transaction Records' }]
                : [{ k: 'open', l: 'Positions' }, { k: 'hist', l: 'History' }]);

        return { coin, MODES, mode, price, balance, f, o, ledgerTab, ledgerTabs, OPTION_TIERS, LEVERAGES,
                 setPct, pickPrice, activeTier, tierLocked, optProfit, needAuth, act, go, fmtNum, fmtPrice, store };
    },
    template: /*html*/`
    <section class="trade">
        <div class="trade__bar">
            <button class="iconbtn" @click="go('/coin?sym=' + coin?.sym)" aria-label="Chart"><Icon name="chevronR" style="transform:rotate(180deg)" /></button>
            <h1 class="trade__pair">{{ coin?.sym }}<span class="muted">/USDT</span>
                <span class="num" :class="coin?.chg >= 0 ? 'up' : 'down'" style="font-size:var(--fs-small); margin-left:8px">{{ fmtNum(price) }}</span>
            </h1>
            <button class="iconbtn" @click="go('/coin?sym=' + coin?.sym)" aria-label="Open chart"><Icon name="market" /></button>
        </div>

        <!-- Mode tabs -->
        <div class="trade__modes">
            <button v-for="m in MODES" :key="m.k" class="trade__mode" :class="{ 'is-on': mode === m.k }" @click="mode = m.k">{{ m.label }}</button>
        </div>

        <!-- SPOT / PERP: order book + form -->
        <div v-if="mode !== 'options'" class="trade__grid">
            <OrderBook :price="price" :rows="7" :onPick="pickPrice" />

            <div class="trade__form">
                <div v-if="mode === 'perp'" class="lev">
                    <div class="lev__head"><span class="muted">Leverage</span><b class="num">{{ f.lev }}×</b></div>
                    <input class="lev__range" type="range" min="1" max="100" step="1" v-model.number="f.lev" />
                    <div class="lev__chips">
                        <button v-for="l in LEVERAGES" :key="l" class="minichip" :class="{ 'is-on': f.lev === l }" @click="f.lev = l">{{ l }}×</button>
                    </div>
                </div>

                <div class="seg seg--side">
                    <button class="seg__btn" :class="{ 'is-on up-on': f.side === 'buy' }" @click="f.side = 'buy'">{{ mode === 'perp' ? 'Long' : 'Buy' }}</button>
                    <button class="seg__btn" :class="{ 'is-on down-on': f.side === 'sell' }" @click="f.side = 'sell'">{{ mode === 'perp' ? 'Short' : 'Sell' }}</button>
                </div>

                <div class="seg seg--type">
                    <button class="seg__btn" :class="{ 'is-on': f.type === 'market' }" @click="f.type = 'market'">Market</button>
                    <button class="seg__btn" :class="{ 'is-on': f.type === 'limit' }" @click="f.type = 'limit'">Limit</button>
                </div>

                <label class="fieldrow">
                    <span class="fieldrow__lbl">Price</span>
                    <input class="fieldrow__in num" :placeholder="f.type === 'market' ? 'Market' : fmtNum(price)" :disabled="f.type === 'market'" v-model="f.price" />
                    <span class="fieldrow__suf">USDT</span>
                </label>
                <label class="fieldrow">
                    <span class="fieldrow__lbl">Amount</span>
                    <input class="fieldrow__in num" placeholder="0" v-model="f.amount" />
                    <span class="fieldrow__suf">{{ mode === 'perp' ? 'USDT' : coin?.sym }}</span>
                </label>

                <div class="pcts">
                    <button v-for="p in [25,50,75,100]" :key="p" class="minichip" @click="setPct(p)">{{ p }}%</button>
                </div>

                <label v-if="mode === 'perp'" class="tpsl">
                    <span>TP / SL</span>
                    <input type="checkbox" v-model="f.tpsl" class="switch" />
                </label>
                <div v-if="mode === 'perp' && f.tpsl" class="tpsl__fields">
                    <label class="fieldrow"><span class="fieldrow__lbl">TP</span><input class="fieldrow__in num" placeholder="0" v-model="f.tp" /></label>
                    <label class="fieldrow"><span class="fieldrow__lbl">SL</span><input class="fieldrow__in num" placeholder="0" v-model="f.sl" /></label>
                </div>

                <div class="balrow"><span class="muted">Available</span><b class="num">{{ fmtNum(balance) }} USDT</b></div>

                <template v-if="needAuth">
                    <button class="btn btn--dark btn--block btn--lg" @click="go('/login')">Log in or Register</button>
                </template>
                <template v-else>
                    <button class="btn btn--block btn--lg" :class="f.side === 'buy' ? 'btn--up' : 'btn--down'" @click="act(f.side === 'buy' ? (mode==='perp'?'Long':'Buy') : (mode==='perp'?'Short':'Sell'))">
                        {{ f.side === 'buy' ? (mode === 'perp' ? 'Long' : 'Buy ' + coin?.sym) : (mode === 'perp' ? 'Short' : 'Sell ' + coin?.sym) }}
                    </button>
                </template>
            </div>
        </div>

        <!-- OPTIONS: binary up/down -->
        <div v-else class="trade__options">
            <div class="opt__price card">
                <div class="muted" style="font-size:var(--fs-caption)">{{ coin?.sym }}/USDT · Last price</div>
                <div class="num opt__last" :class="coin?.chg >= 0 ? 'up' : 'down'">{{ fmtNum(price) }}</div>
                <button class="btn btn--ghost btn--sm" @click="go('/coin?sym=' + coin?.sym)"><Icon name="market" :size="16" /> View chart</button>
            </div>

            <div class="seg seg--type">
                <button class="seg__btn" :class="{ 'is-on': o.tab === 'now' }" @click="o.tab = 'now'">Trade now</button>
                <button class="seg__btn" :class="{ 'is-on': o.tab === 'scheduled' }" @click="o.tab = 'scheduled'">Scheduled trade</button>
            </div>

            <div class="eyebrow" style="margin-top:var(--sp-4)">Duration · payout</div>
            <div class="tiers">
                <button v-for="t in OPTION_TIERS" :key="t.sec" class="tier" :class="{ 'is-on': o.tier === t.sec, 'is-locked': tierLocked(t) }" @click="!tierLocked(t) && (o.tier = t.sec)">
                    <b>{{ t.label }}</b>
                    <span class="num">{{ t.payout }}×</span>
                    <span v-if="tierLocked(t)" class="tier__lock"><Icon name="shield" :size="12" /> {{ (t.min/1000) }}k</span>
                </button>
            </div>

            <label class="fieldrow" style="margin-top:var(--sp-4)">
                <span class="fieldrow__lbl">Amount</span>
                <input class="fieldrow__in num" placeholder="0" v-model="o.amount" />
                <span class="fieldrow__suf">USDT</span>
            </label>
            <div class="opt__payout">
                <span class="muted">Payout {{ activeTier.payout }}× · Est. profit</span>
                <b class="num up">+{{ optProfit }} USDT</b>
            </div>
            <div class="balrow"><span class="muted">Available</span><b class="num">{{ fmtNum(balance) }} USDT</b></div>

            <template v-if="needAuth">
                <button class="btn btn--dark btn--block btn--lg" @click="go('/login')">Log in or Register</button>
            </template>
            <div v-else class="opt__cta">
                <button class="btn btn--up btn--lg" @click="act('Up (Long)')"><Icon name="withdraw" :size="20" /> Up</button>
                <button class="btn btn--down btn--lg" @click="act('Down (Short)')"><Icon name="deposit" :size="20" /> Down</button>
            </div>
        </div>

        <!-- Ledger -->
        <div class="trade__ledger">
            <div class="tabs">
                <button v-for="t in ledgerTabs" :key="t.k" class="tab" :class="{ 'is-on': ledgerTab === t.k }" @click="ledgerTab = t.k">{{ t.l }}</button>
            </div>
            <div class="placeholder" style="border:0; padding:var(--sp-8)">
                <Icon name="doc" class="placeholder__icon" :size="40" />
                <p class="muted">{{ needAuth ? 'Log in to view your orders.' : 'No records yet.' }}</p>
            </div>
        </div>
    </section>`,
};
