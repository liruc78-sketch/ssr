// Finance / Earn — Current & AI-Quant products, My Holding, Subscribe sheet
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '../icons.js';
import { CoinIcon } from '../components/CoinIcon.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { FINANCE_PRODUCTS, genSpark, fmtAmt } from '../data.js';
import { subscribeFinance, loadHoldings, redeemSubscription, FINANCE_MIN_USD } from '../finance.js';
import { t } from '../i18n.js';

export default {
    name: 'Finance',
    components: { Icon, CoinIcon },
    setup() {
        const tab = ref('current');        // current | quant | holding
        const products = computed(() => FINANCE_PRODUCTS.filter(p => p.cat === tab.value));
        const sparks = Object.fromEntries(FINANCE_PRODUCTS.map(p => [p.id, genSpark(24, true)]));
        const sparkPath = (pts) => pts.map((v, i) => `${(i / (pts.length - 1)) * 100},${100 - v}`).join(' ');

        // Holdings
        const holdings = ref([]);
        const loadingHoldings = ref(false);
        const refreshHoldings = async () => {
            if (!store.isAuthed) { holdings.value = []; return; }
            loadingHoldings.value = true;
            try { holdings.value = await loadHoldings(); } catch { holdings.value = []; }
            finally { loadingHoldings.value = false; }
        };
        onMounted(() => { if (tab.value === 'holding') refreshHoldings(); });
        watch(tab, (t) => { if (t === 'holding') refreshHoldings(); });

        // Subscribe sheet — USD-funded (min $100).
        const buying = ref(null);          // product or null
        const amount = ref('');            // USD
        const submitting = ref(false);
        const openBuy = (p) => { buying.value = p; amount.value = ''; };
        const closeBuy = () => { buying.value = null; };
        const estDaily = computed(() => (parseFloat(amount.value) || 0) * (buying.value?.dmax || 0) / 100);
        const estTotal = computed(() => estDaily.value * (buying.value?.term || 1));
        const confirmBuy = async () => {
            if (!store.isAuthed) { closeBuy(); go('/login'); return; }
            submitting.value = true;
            try {
                await subscribeFinance({ product: buying.value, amountUsd: amount.value });
                toast(t('finance.subscribed'), 'success');
                closeBuy();
                tab.value = 'holding';
                refreshHoldings();
            } catch (e) { toast(e?.message || t('finance.subscriptionFailed'), 'error', 4000); }
            finally { submitting.value = false; }
        };

        // Redeem a holding
        const redeemingId = ref(null);
        const redeem = async (h) => {
            redeemingId.value = h.id;
            try { await redeemSubscription(h.id); toast(t('finance.redeemed'), 'success'); await refreshHoldings(); }
            catch (e) { toast(e?.message || t('finance.redeemFailed'), 'error', 3600); }
            finally { redeemingId.value = null; }
        };

        return { tab, products, sparks, sparkPath, holdings, loadingHoldings, buying, amount, submitting,
                 openBuy, closeBuy, estDaily, estTotal, confirmBuy, redeem, redeemingId, FINANCE_MIN_USD, go, fmtAmt, store };
    },
    template: /*html*/`
    <section class="fin">
        <div class="fin__hero">
            <div class="fin__hero-txt">
                <h2>{{ $t('finance.heroTitle') }}</h2>
                <p>{{ $t('finance.heroSub') }}</p>
                <button class="btn btn--block" style="background:#fff; color:#111; max-width:200px" @click="tab = 'quant'">{{ $t('finance.startEarning') }}</button>
            </div>
            <span class="fin__hero-glow"></span>
        </div>

        <div class="fin__tabs">
            <button class="fin__tab" :class="{ 'is-on': tab === 'current' }" @click="tab = 'current'">{{ $t('finance.tabCurrent') }}</button>
            <button class="fin__tab" :class="{ 'is-on': tab === 'quant' }" @click="tab = 'quant'">{{ $t('finance.tabQuant') }}</button>
            <button class="btn btn--brand btn--sm btn--pill" style="margin-left:auto" @click="tab = 'holding'"><Icon name="finance" :size="16" /> {{ $t('finance.myHolding') }}</button>
        </div>

        <!-- Product list -->
        <div v-if="tab !== 'holding'" class="fin__list">
            <div v-for="p in products" :key="p.id" class="card fin__card">
                <div class="fin__card-top">
                    <CoinIcon :sym="p.asset" :color="p.color" cls="fin__coin" />
                    <div class="fin__id">
                        <b>{{ p.asset }} · {{ p.name }}</b>
                        <div class="fin__badges">
                            <span class="chip" style="background:var(--surface-2)">{{ p.term ? p.term + 'D' : $t('finance.flexible') }}</span>
                            <span class="chip" :class="p.yieldKey === 'yield.high' ? 'chip--gold' : ''">{{ $t(p.yieldKey) }}</span>
                        </div>
                    </div>
                    <svg class="fin__spark" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline :points="sparkPath(sparks[p.id])" fill="none" stroke="var(--up)" stroke-width="2.5" vector-effect="non-scaling-stroke" />
                    </svg>
                </div>
                <div class="fin__stats">
                    <div><span class="muted">{{ $t('finance.maxDaily') }}</span><b class="num up">+{{ p.dmax }}%</b></div>
                    <div><span class="muted">{{ $t('finance.minDaily') }}</span><b class="num">+{{ p.dmin }}%</b></div>
                    <div><span class="muted">{{ $t('finance.subscribers') }}</span><b class="num">{{ p.buyers.toLocaleString() }}</b></div>
                </div>
                <div class="fin__foot">
                    <span class="muted" style="font-size:var(--fs-caption)">{{ $t('finance.minFunded', { amt: FINANCE_MIN_USD }) }}</span>
                    <button class="btn btn--brand btn--sm" @click="openBuy(p)">{{ $t('finance.subscribe') }}</button>
                </div>
            </div>
            <p class="faint" style="text-align:center; font-size:var(--fs-caption); margin-top:var(--sp-3)">{{ $t('finance.disclaimer') }}</p>
        </div>

        <!-- My Holding -->
        <div v-else>
            <div v-if="loadingHoldings" class="card" style="display:grid; place-items:center; padding:var(--sp-10)"><span class="spinner"></span></div>
            <div v-else-if="holdings.length" class="fin__list">
                <div v-for="h in holdings" :key="h.id" class="card fin__hold">
                    <div class="fin__hold-top">
                        <b>{{ h.asset }} · {{ h.product_name }}</b>
                        <span class="chip" :class="h.status === 'active' ? 'chip--up' : ''">{{ $t('finance.status.' + h.status) }}</span>
                    </div>
                    <div class="fin__stats">
                        <div><span class="muted">{{ $t('finance.principal') }}</span><b class="num">\${{ fmtAmt(h.amount) }}</b></div>
                        <div><span class="muted">{{ $t('finance.dailyRate') }}</span><b class="num up">+{{ h.daily_rate }}%</b></div>
                        <div><span class="muted">{{ $t('finance.earned') }}</span><b class="num up">+\${{ fmtAmt(h.accrued || 0) }}</b></div>
                    </div>
                    <div class="fin__hold-foot">
                        <span class="muted" style="font-size:var(--fs-caption)">{{ h.term_days ? $t('finance.dayTerm', { n: h.term_days }) : $t('finance.flexible') }}</span>
                        <button v-if="h.status === 'active'" class="btn btn--sm" :class="h.term_days ? 'btn--ghost' : 'btn--brand'" :disabled="redeemingId === h.id" @click="redeem(h)">
                            <span v-if="redeemingId === h.id" class="spinner" style="border-top-color:#fff"></span>
                            <template v-else>{{ $t('finance.redeem') }}</template>
                        </button>
                    </div>
                </div>
            </div>
            <div v-else class="card">
                <div class="placeholder" style="border:0; padding:var(--sp-12)">
                    <Icon name="finance" class="placeholder__icon" :size="44" />
                    <p class="muted">{{ store.isAuthed ? $t('finance.noHoldings') : $t('finance.loginToView') }}</p>
                    <button class="btn btn--brand btn--sm btn--pill" @click="store.isAuthed ? (tab = 'current') : go('/login')">{{ store.isAuthed ? $t('finance.browseProducts') : $t('common.login') }}</button>
                </div>
            </div>
        </div>

        <!-- Subscribe sheet -->
        <transition name="scrim"><div v-if="buying" class="drawer-scrim" @click="closeBuy"></div></transition>
        <transition name="sheet">
            <div v-if="buying" class="sheet">
                <div class="sheet__head"><h3>{{ $t('finance.subscribe') }} · {{ buying.asset }} {{ buying.name }}</h3><button class="iconbtn" @click="closeBuy"><Icon name="close" /></button></div>
                <div class="sheet__row"><span class="muted">{{ $t('finance.term') }}</span><b>{{ buying.term ? $t('finance.daysCount', { n: buying.term }) : $t('finance.flexible') }}</b></div>
                <div class="sheet__row"><span class="muted">{{ $t('finance.estDailyRate') }}</span><b class="up">{{ $t('finance.upTo') }} +{{ buying.dmax }}%</b></div>
                <label class="fieldrow" style="margin:var(--sp-3) 0">
                    <span class="fieldrow__lbl">{{ $t('finance.amount') }}</span>
                    <input class="fieldrow__in num" :placeholder="$t('finance.minPlaceholder', { amt: FINANCE_MIN_USD })" v-model="amount" />
                    <span class="fieldrow__suf">USD</span>
                </label>
                <div class="sheet__row"><span class="muted">{{ $t('finance.estDailyEarnings') }}</span><b class="num up">+\${{ fmtAmt(estDaily) }}</b></div>
                <div v-if="buying.term" class="sheet__row"><span class="muted">{{ $t('finance.estTotal') }} ({{ buying.term }}d)</span><b class="num up">+\${{ fmtAmt(estTotal) }}</b></div>
                <button class="btn btn--brand btn--block btn--lg" style="margin-top:var(--sp-4)" :disabled="submitting" @click="confirmBuy">
                    <span v-if="submitting" class="spinner" style="border-top-color:#fff"></span>
                    <template v-else>{{ store.isAuthed ? $t('finance.confirmSubscription') : $t('finance.loginToSubscribe') }}</template>
                </button>
            </div>
        </transition>
    </section>`,
};
