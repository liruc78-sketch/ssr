// Trade — Spot (order book + form) · Perpetual (leverage + TP/SL) · Options (binary)
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Icon } from '../icons.js';
import { go, router } from '../router.js';
import { store } from '../store.js';
import { toast } from '../store.js';
import { findSym, fetchTickers, COINS, OPTION_TIERS, LEVERAGES, fmtNum, fmtPrice } from '../data.js';
import { openOptionPosition } from '../trade.js';
import OrderBook from '../components/OrderBook.js';
import { CoinIcon } from '../components/CoinIcon.js';
import { PositionDetail } from '../components/PositionDetail.js';

export default {
    name: 'Trade',
    components: { Icon, OrderBook, CoinIcon, PositionDetail },
    setup() {
        const coin = findSym(router.query.pair) || findSym('BTC');
        const MODES = [{ k: 'spot', label: 'Spot' }, { k: 'perp', label: 'Perpetual contract' }, { k: 'options', label: 'Options' }];
        const mode = ref(['spot', 'perp', 'options'].includes(router.query.mode) ? router.query.mode : 'spot');
        // Simulated account for this session — set only when reached from the sim wallet (/trade?...&sim=1).
        const sim = router.query.sim === '1';

        const price = ref(coin?.price || 0);
        // Simulated mode draws on the separate sim balance (default 100k virtual USDT).
        const balance = computed(() => store.isAuthed ? (sim ? store.portfolio.simBalance : store.portfolio.usdBalance) : 0);

        // shared order form
        const f = reactive({ side: 'buy', type: 'market', price: '', amount: '', lev: 10, tpsl: false, tp: '', sl: '' });
        // options
        const o = reactive({ tab: 'now', tier: 30, amount: '' });
        const ledgerTab = ref('open');

        let timer = null, alive = true;
        onMounted(async () => {
            try { const [u] = await fetchTickers([coin]); if (u) price.value = u.price; } catch {}
            if (!alive) return;   // unmounted during the fetch — don't start an orphan interval
            timer = setInterval(() => { price.value = price.value * (1 + (Math.random() - 0.5) * 0.0006); }, 2000);
        });
        onBeforeUnmount(() => {
            alive = false; clearInterval(timer);
            if (waitRaf) cancelAnimationFrame(waitRaf);
            document.body.style.overflow = '';                       // never leave the page scroll-locked
            document.removeEventListener('keydown', onSheetKeydown);
        });
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
        // Spot/Perp execution is wired in a later step — demo for now.
        const act = (label) => {
            if (needAuth.value) { go('/login'); return; }
            toast(`${label} order placed (demo)`, 'success');
        };

        // ---- Options wait screen ------------------------------------------
        // A bottom-sheet that opens the instant a binary position is filled and
        // counts the tier duration down to settlement: a depleting ring, the
        // live mark price next to the server-stamped entry, and — once the
        // position settles — the Won/Lost result and payout.
        const RING_C = 2 * Math.PI * 54;            // circumference of the r=54 ring
        const wait = reactive({
            open: false, posId: null, type: 'up', entry: 0, amount: 0,
            tierLabel: '', payoutPct: 0, total: 30, left: 30, frac: 1,
            settled: false, status: '', payout: null, settlePrice: null,
        });
        let waitRaf = null, waitStart = 0;
        const sheetEl = ref(null);      // dialog root — for the focus trap
        const closeBtnEl = ref(null);   // initial focus target when the sheet opens
        let lastFocused = null;         // element to restore focus to on close

        // Modal keyboard behaviour: Escape closes; Tab is trapped inside the sheet.
        const onSheetKeydown = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); closeWait(); return; }
            if (e.key !== 'Tab' || !sheetEl.value) return;
            const f = sheetEl.value.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };

        const pad2 = (n) => String(n).padStart(2, '0');
        const waitClock = computed(() => {
            const s = Math.max(0, Math.ceil(wait.left));
            return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
        });
        const ringOffset = computed(() => RING_C * (1 - wait.frac));

        const tickWait = () => {
            const left = Math.max(0, wait.total - (Date.now() - waitStart) / 1000);
            wait.left = left;
            wait.frac = wait.total ? left / wait.total : 0;
            waitRaf = left > 0 ? requestAnimationFrame(tickWait) : null;
        };
        const startWait = ({ posId, type, entry, amount, tier }) => {
            if (waitRaf) cancelAnimationFrame(waitRaf);
            Object.assign(wait, {
                open: true, posId, type, entry, amount,
                tierLabel: tier.label, payoutPct: Math.round((tier.payout - 1) * 100),
                total: tier.sec, left: tier.sec, frac: 1,
                settled: false, status: '', payout: null, settlePrice: null,
            });
            waitStart = Date.now();
            waitRaf = requestAnimationFrame(tickWait);
            // Modal affordances: lock scroll, trap focus, remember where to return it.
            lastFocused = document.activeElement;
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', onSheetKeydown);
            nextTick(() => { try { closeBtnEl.value?.focus(); } catch {} });
        };
        const closeWait = () => {
            if (!wait.open) return;
            wait.open = false;
            if (waitRaf) { cancelAnimationFrame(waitRaf); waitRaf = null; }
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onSheetKeydown);
            try { lastFocused?.focus?.(); } catch {}
            lastFocused = null;
        };
        // When trade-settle lands the result in the store, surface it in the sheet
        // (full ring in the result colour) instead of leaving an empty countdown.
        watch(() => store.portfolio.positionHistory, (hist) => {
            if (!wait.open || wait.posId == null || wait.settled) return;
            const p = (hist || []).find(x => x.id === wait.posId);
            if (p) { wait.settled = true; wait.status = p.status; wait.payout = p.payout; wait.frac = 1; wait.settlePrice = p.settlementPrice; }
        }, { deep: true });

        // Options (binary) — real execution against positions + trade-settle.
        const placing = ref(false);
        const placeOption = async (type) => {
            if (needAuth.value) { go('/login'); return; }
            const amt = parseFloat(o.amount) || 0;   // capture before the field clears
            placing.value = true;
            try {
                const res = await openOptionPosition({ coin, type, amount: o.amount, tier: activeTier.value, sim });
                startWait({ posId: res.positionId, type, entry: res.entryPrice ?? price.value, amount: amt, tier: activeTier.value });
                o.amount = '';
                ledgerTab.value = 'open';
            } catch (e) {
                toast(e?.message || 'Could not place trade', 'error', 3400);
            } finally { placing.value = false; }
        };

        const symOf = (cgId) => COINS.find(c => c.cg === cgId)?.sym || (cgId || '').toUpperCase();
        const positions = computed(() => {
            if (mode.value !== 'options') return [];
            const base = ledgerTab.value === 'hist' ? store.portfolio.positionHistory : store.portfolio.activePositions;
            // Keep the simulated and real ledgers separate per the active mode.
            return (base || []).filter(p => (p.isSim === true) === sim);
        });

        const ledgerTabs = computed(() => mode.value === 'spot'
            ? [{ k: 'open', l: 'Current Order' }, { k: 'hist', l: 'Trade History' }, { k: 'assets', l: 'Assets' }]
            : mode.value === 'perp'
                ? [{ k: 'open', l: 'My Holding' }, { k: 'pos', l: 'Current Position' }, { k: 'hist', l: 'Transaction Records' }]
                : [{ k: 'open', l: 'Positions' }, { k: 'hist', l: 'History' }]);

        // Tap a ledger record to see its full breakdown. Resolve by id from the
        // store so an open active position updates live when it settles.
        const detailId = ref(null);
        const detail = computed(() => detailId.value == null ? null
            : [...(store.portfolio.activePositions || []), ...(store.portfolio.positionHistory || [])].find(p => p.id === detailId.value) || null);
        const openDetail = (p) => { detailId.value = p.id; };
        const closeDetail = () => { detailId.value = null; };

        return { coin, MODES, mode, price, balance, f, o, ledgerTab, ledgerTabs, OPTION_TIERS, LEVERAGES, positions, symOf,
                 setPct, pickPrice, activeTier, tierLocked, optProfit, needAuth, act, placing, placeOption, go, fmtNum, fmtPrice, store,
                 wait, waitClock, ringOffset, RING_C, closeWait, sheetEl, closeBtnEl, sim, detail, openDetail, closeDetail };
    },
    template: /*html*/`
    <section class="trade">
        <div v-if="sim" class="simbanner">
            <Icon name="shield" :size="16" />
            <span><b>Simulated Trading</b> — virtual funds only, no real money. Balance resets are managed by support.</span>
        </div>
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
                <button class="btn btn--up btn--lg" :disabled="placing" @click="placeOption('up')">
                    <span v-if="placing" class="spinner" style="border-top-color:#fff"></span>
                    <template v-else><Icon name="withdraw" :size="20" /> Up</template>
                </button>
                <button class="btn btn--down btn--lg" :disabled="placing" @click="placeOption('down')">
                    <span v-if="placing" class="spinner" style="border-top-color:#fff"></span>
                    <template v-else><Icon name="deposit" :size="20" /> Down</template>
                </button>
            </div>
        </div>

        <!-- Ledger -->
        <div class="trade__ledger">
            <div class="tabs">
                <button v-for="t in ledgerTabs" :key="t.k" class="tab" :class="{ 'is-on': ledgerTab === t.k }" @click="ledgerTab = t.k">{{ t.l }}</button>
            </div>
            <div v-if="mode === 'options' && !needAuth && positions.length" class="pos-list">
                <div v-for="p in positions" :key="p.id" class="pos-row pos-row--link" role="button" tabindex="0"
                     @click="openDetail(p)" @keydown.enter="openDetail(p)" @keydown.space.prevent="openDetail(p)"
                     :aria-label="(p.type === 'up' ? 'Up' : 'Down') + ' ' + symOf(p.coinId) + ', ' + fmtNum(p.amount) + ' at ' + fmtNum(p.entryPrice) + ', ' + (p.status === 'Active' ? 'settling' : p.status) + (p.payout != null ? (', payout ' + fmtNum(p.payout)) : '') + '. View details'">
                    <span class="chip" :class="p.type === 'up' ? 'chip--up' : 'chip--down'">{{ p.type === 'up' ? 'Up ▲' : 'Down ▼' }}</span>
                    <span class="pos-sym num">{{ symOf(p.coinId) }}</span>
                    <span class="num muted">{{ fmtNum(p.amount) }} @ {{ fmtNum(p.entryPrice) }}</span>
                    <span class="pos-status num" :class="{ up: p.status === 'Won', down: p.status === 'Lost', muted: p.status === 'Active' }">
                        {{ p.status === 'Active' ? 'Settling…' : p.status }}
                        <template v-if="p.payout != null"> · {{ p.status === 'Won' ? '+' : '' }}{{ fmtNum(p.payout) }}</template>
                    </span>
                </div>
            </div>
            <div v-else class="placeholder" style="border:0; padding:var(--sp-8)">
                <Icon name="doc" class="placeholder__icon" :size="40" />
                <p class="muted">{{ needAuth ? 'Log in to view your orders.' : 'No records yet.' }}</p>
            </div>
        </div>

        <!-- Options wait screen: live countdown + order summary, opens on fill -->
        <transition name="scrim">
            <div v-if="wait.open" class="drawer-scrim" @click="closeWait()"></div>
        </transition>
        <transition name="sheet">
            <div v-if="wait.open" ref="sheetEl" class="sheet optwait" role="dialog" aria-modal="true" aria-label="Order countdown">
                <div class="optwait__head">
                    <span class="optwait__sym">
                        <CoinIcon :sym="coin?.sym" :color="coin?.color" cls="optwait__ico" />
                        {{ coin?.sym }}<span class="muted">/USDT</span>
                        <span v-if="sim" class="chip chip--gold" style="height:20px">SIM</span>
                    </span>
                    <button class="iconbtn" @click="closeWait()" aria-label="Close"><Icon name="close" /></button>
                </div>

                <!-- Visual countdown is hidden from AT (it ticks every second); the
                     scoped status region below announces only the meaningful changes. -->
                <div class="optwait__ringwrap" aria-hidden="true">
                    <svg class="optwait__ring" :class="{ 'is-settled': wait.settled, 'is-won': wait.status === 'Won', 'is-lost': wait.status === 'Lost' }" viewBox="0 0 120 120">
                        <circle class="optwait__track" cx="60" cy="60" r="54" />
                        <circle class="optwait__arc" cx="60" cy="60" r="54" :stroke-dasharray="RING_C" :stroke-dashoffset="ringOffset" />
                    </svg>
                    <div class="optwait__center">
                        <b v-if="wait.settled" class="optwait__result" :class="wait.status === 'Won' ? 'up' : 'down'">{{ wait.status }}</b>
                        <template v-else>
                            <b class="optwait__clock num">{{ waitClock }}</b>
                            <span class="optwait__state muted">Time left</span>
                        </template>
                    </div>
                </div>
                <div class="sr-only" role="status">
                    <template v-if="wait.settled">{{ wait.status }}<template v-if="wait.payout != null">, {{ wait.status === 'Won' ? '+' : '' }}{{ fmtNum(wait.payout) }} USDT</template></template>
                    <template v-else>Order placed — {{ wait.type === 'up' ? 'Up' : 'Down' }}, settling in {{ wait.tierLabel }}</template>
                </div>

                <div class="optwait__rows">
                    <div class="optwait__row"><span class="muted">Entry price</span><b class="num">{{ fmtNum(wait.entry) }}</b></div>
                    <div class="optwait__row"><span class="muted">Mark price</span><b class="num">{{ fmtNum(wait.settled && wait.settlePrice != null ? wait.settlePrice : price) }}</b></div>
                    <div class="optwait__row"><span class="muted">Duration · payout</span><b class="num">{{ wait.tierLabel }} · +{{ wait.payoutPct }}%</b></div>
                    <div class="optwait__row"><span class="muted">Direction</span><b :class="wait.type === 'up' ? 'up' : 'down'">{{ wait.type === 'up' ? 'Up ▲' : 'Down ▼' }}</b></div>
                    <div class="optwait__row"><span class="muted">Amount</span><b class="num">{{ fmtNum(wait.amount) }} USDT</b></div>
                    <div class="optwait__row"><span class="muted">Fee rate</span><b class="num">0%</b></div>
                    <div v-if="wait.settled && wait.payout != null" class="optwait__row">
                        <span class="muted">Payout</span>
                        <b class="num" :class="wait.status === 'Won' ? 'up' : 'down'">{{ wait.status === 'Won' ? '+' : '' }}{{ fmtNum(wait.payout) }} USDT</b>
                    </div>
                </div>

                <button ref="closeBtnEl" class="btn btn--dark btn--block btn--lg optwait__close" @click="closeWait()">Close</button>
            </div>
        </transition>

        <!-- Tapped-record detail -->
        <PositionDetail :pos="detail" @close="closeDetail" />
    </section>`,
};
