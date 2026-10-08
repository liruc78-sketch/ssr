// SimWallet — dedicated landing for Simulated Trading: the virtual balance and
// the simulated trade history, fully separate from the real account. The drawer
// entry lands here first; "Start" opens the (sim-mode) trade screen.
import { ref, computed, onMounted } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store } from '../store.js';
import { refreshPortfolio } from '../auth.js';
import { COINS, fmtNum } from '../data.js';
import { PositionDetail } from '../components/PositionDetail.js';

export default {
    name: 'SimWallet',
    components: { Icon, PositionDetail },
    setup() {
        const loading = ref(false);
        const tab = ref('open');   // open | hist

        onMounted(async () => {
            if (store.isAuthed) { loading.value = true; try { await refreshPortfolio(); } catch {} finally { loading.value = false; } }
        });

        const simBalance = computed(() => store.isAuthed ? (store.portfolio.simBalance || 0) : 0);
        const simActive = computed(() => (store.portfolio.activePositions || []).filter(p => p.isSim));
        const simHistory = computed(() => (store.portfolio.positionHistory || []).filter(p => p.isSim));
        const won = computed(() => simHistory.value.filter(p => p.status === 'Won').length);
        const lost = computed(() => simHistory.value.filter(p => p.status === 'Lost').length);
        const winRate = computed(() => { const t = won.value + lost.value; return t ? Math.round(won.value / t * 100) : 0; });
        // Realised P&L across settled sim trades (payout returned minus stake).
        const pnl = computed(() => simHistory.value.reduce((s, p) => s + ((p.payout != null ? p.payout : 0) - p.amount), 0));

        const rows = computed(() => tab.value === 'hist' ? simHistory.value : simActive.value);
        const symOf = (cgId) => COINS.find(c => c.cg === cgId)?.sym || (cgId || '').toUpperCase();
        // fmtNum keys its precision on positive thresholds, so format the magnitude and add the sign.
        const signed = (n) => (n >= 0 ? '+' : '-') + fmtNum(Math.abs(n));

        const startTrading = () => go('/trade?mode=options&sim=1');

        // Resolve by id from the store so an open active position updates live when it settles.
        const detailId = ref(null);
        const detail = computed(() => detailId.value == null ? null
            : [...(store.portfolio.activePositions || []), ...(store.portfolio.positionHistory || [])].find(p => p.id === detailId.value) || null);
        const openDetail = (p) => { detailId.value = p.id; };
        const closeDetail = () => { detailId.value = null; };

        return { loading, tab, simBalance, simActive, simHistory, won, lost, winRate, pnl, rows, symOf, signed, startTrading, go, fmtNum, store, detail, openDetail, closeDetail };
    },
    template: /*html*/`
    <section class="sim">
        <div class="trade__bar">
            <button class="iconbtn" @click="go('/')" aria-label="Back"><Icon name="chevronR" style="transform:rotate(180deg)" /></button>
            <h1 class="page-title" style="margin:0; font-size:var(--fs-h3)">Simulated Wallet</h1>
        </div>

        <div class="simbanner">
            <Icon name="shield" :size="16" />
            <span><b>Simulated Trading</b> — virtual funds only, fully separate from your real account.</span>
        </div>

        <template v-if="store.isAuthed">
            <!-- Balance -->
            <div class="card sim__wallet">
                <div class="muted" style="font-size:var(--fs-small)">Simulated Balance</div>
                <div class="sim__total num">{{ fmtNum(simBalance) }} <span style="font-size:var(--fs-h4); opacity:.7">USDT</span></div>
                <div class="sim__stats">
                    <div><span class="muted">Net P&L</span><b class="num" :class="pnl >= 0 ? 'up' : 'down'">{{ signed(pnl) }}</b></div>
                    <div><span class="muted">Win rate</span><b class="num">{{ winRate }}%</b></div>
                    <div><span class="muted">Won</span><b class="num up">{{ won }}</b></div>
                    <div><span class="muted">Lost</span><b class="num down">{{ lost }}</b></div>
                </div>
            </div>

            <button class="btn btn--brand btn--block btn--lg sim__cta" @click="startTrading()">
                <Icon name="trade" :size="20" /> Start Simulated Trading
            </button>

            <!-- Simulated history (independent of real trades) -->
            <div class="sim__ledger">
                <div class="tabs">
                    <button class="tab" :class="{ 'is-on': tab === 'open' }" @click="tab = 'open'">Open positions <span class="muted">({{ simActive.length }})</span></button>
                    <button class="tab" :class="{ 'is-on': tab === 'hist' }" @click="tab = 'hist'">History <span class="muted">({{ simHistory.length }})</span></button>
                </div>

                <div v-if="loading && !rows.length" style="display:grid; place-items:center; padding:var(--sp-8)"><span class="spinner"></span></div>

                <div v-else-if="rows.length" class="pos-list">
                    <div v-for="p in rows" :key="p.id" class="pos-row pos-row--link" role="button" tabindex="0"
                         @click="openDetail(p)" @keydown.enter="openDetail(p)" @keydown.space.prevent="openDetail(p)"
                         :aria-label="(p.type === 'up' ? 'Up' : 'Down') + ' ' + symOf(p.coinId) + ', ' + fmtNum(p.amount) + ' at ' + fmtNum(p.entryPrice) + ', ' + (p.status === 'Active' ? 'settling' : p.status) + '. View details'">
                        <span class="chip" :class="p.type === 'up' ? 'chip--up' : 'chip--down'">{{ p.type === 'up' ? 'Up ▲' : 'Down ▼' }}</span>
                        <span class="pos-sym num">{{ symOf(p.coinId) }}</span>
                        <span class="num muted">{{ fmtNum(p.amount) }} @ {{ fmtNum(p.entryPrice) }}</span>
                        <span class="pos-status num" :class="{ up: p.status === 'Won', down: p.status === 'Lost', muted: p.status === 'Active' }">
                            {{ p.status === 'Active' ? 'Settling…' : p.status }}
                            <template v-if="p.payout != null"> · {{ signed(p.payout - p.amount) }}</template>
                        </span>
                    </div>
                </div>

                <div v-else class="placeholder" style="border:0; padding:var(--sp-8)">
                    <Icon name="doc" class="placeholder__icon" :size="40" />
                    <p class="muted">{{ tab === 'open' ? 'No open simulated positions.' : 'No simulated trades yet — place your first practice trade.' }}</p>
                </div>
            </div>
        </template>

        <div v-else class="placeholder" style="padding:var(--sp-10)">
            <Icon name="shield" class="placeholder__icon" :size="48" />
            <h3>Log in to practice</h3>
            <p class="muted" style="max-width:34ch">Simulated Trading gives every account 1,000,000 USDT in virtual funds to practice risk-free.</p>
            <button class="btn btn--brand" style="margin-top:var(--sp-4)" @click="go('/login')">Log in or Register</button>
        </div>

        <PositionDetail :pos="detail" @close="closeDetail" />
    </section>`,
};
