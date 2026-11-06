// Transfer — move funds between sub-accounts
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { t } from '../i18n.js';
import { fmtNum } from '../data.js';
import { sb } from '../supabase.js';
import { refreshPortfolio } from '../auth.js';
import { BalanceStatus } from '../components/common.js';

const ACCOUNTS = [
    { id: 'spot', tkey: 'transfer.acctSpot' },
    { id: 'trading', tkey: 'transfer.acctTrading' },
    { id: 'finance', tkey: 'transfer.acctFinance' },
];

export default {
    name: 'Transfer',
    components: { Icon, BalanceStatus },
    setup() {
        const from = ref('spot');
        const to = ref('trading');
        const currency = ref('USDT');
        const amount = ref('');
        const submitting = ref(false);
        // Per-account balances. Spot (displayed) = total - trading - finance.
        // null = balance not loaded / fetch failed: shown as "—", and nothing moves.
        const balances = computed(() => {
            const p = store.portfolio;
            return { spot: p.usdBalance - p.tradingBalance - p.financeBalance, trading: p.tradingBalance, finance: p.financeBalance };
        });
        const available = computed(() => store.balanceUnknown ? null : (store.isAuthed && currency.value === 'USDT') ? balances.value[from.value] : 0);

        const swap = () => { const tmp = from.value; from.value = to.value; to.value = tmp; };
        const setAll = () => { if (available.value != null) amount.value = String(available.value); };
        const confirm = async () => {
            if (!store.isAuthed) { go('/login'); return; }
            if (store.balanceUnknown || submitting.value) return;
            if (from.value === to.value) { toast(t('transfer.chooseDifferent'), 'error'); return; }
            const amt = parseFloat(amount.value);
            if (!(amt > 0)) { toast(t('transfer.enterAmount'), 'error'); return; }
            if (available.value != null && amt > available.value) { toast(t('transfer.insufficientBalance'), 'error'); return; }
            submitting.value = true;
            try {
                const { data, error } = await sb.rpc('transfer_funds', { p_from: from.value, p_to: to.value, p_amount: amt });
                if (error) throw new Error(error.message || t('transfer.failed'));
                if (data && data.ok === false) throw new Error(data.error || t('transfer.failed'));
                await refreshPortfolio();
                toast(t('transfer.complete'), 'success');
                go('/assets');
            } catch (e) { toast(e?.message || t('transfer.failed'), 'error', 3600); }
            finally { submitting.value = false; }
        };
        return { from, to, currency, amount, submitting, available, ACCOUNTS, swap, setAll, confirm, go, fmtNum, store };
    },
    template: /*html*/`
    <section class="pay">
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/assets')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">{{ $t('transfer.title') }}</h1></div>

        <div class="card pay__card">
            <label class="paystep"><span class="eyebrow">{{ $t('transfer.from') }}</span>
                <select class="field" v-model="from"><option v-for="a in ACCOUNTS" :key="a.id" :value="a.id">{{ $t(a.tkey) }}</option></select>
            </label>
            <div class="xfer__swap"><button class="iconbtn" @click="swap" :aria-label="$t('transfer.swapDirection')"><Icon name="transfer" /></button></div>
            <label class="paystep"><span class="eyebrow">{{ $t('transfer.to') }}</span>
                <select class="field" v-model="to"><option v-for="a in ACCOUNTS" :key="a.id" :value="a.id">{{ $t(a.tkey) }}</option></select>
            </label>
            <label class="paystep"><span class="eyebrow">{{ $t('transfer.currency') }}</span>
                <select class="field" v-model="currency"><option v-for="c in ['USDT','USDC','BTC','ETH']" :key="c" :value="c">{{ c }}</option></select>
            </label>
            <label class="paystep"><span class="eyebrow">{{ $t('transfer.amount') }}</span>
                <div class="field" style="display:flex; align-items:center; gap:8px">
                    <input v-model="amount" placeholder="0" class="num" style="flex:1; background:none; border:none; outline:none; color:var(--text)" />
                    <button class="chip chip--brand" @click="setAll">{{ $t('transfer.all') }}</button>
                </div>
                <span class="muted" style="font-size:var(--fs-caption); margin-top:4px">{{ $t('transfer.available', { amt: fmtNum(available), cur: currency }) }}</span>
            </label>
            <BalanceStatus />

            <button class="btn btn--block btn--lg" :class="store.isAuthed ? 'btn--brand' : 'btn--dark'" :disabled="store.balanceUnknown || submitting" @click="confirm">{{ !store.isAuthed ? $t('transfer.loginToTransfer') : submitting ? $t('transfer.processing') : $t('transfer.confirm') }}</button>
            <p class="muted" style="text-align:center; font-size:var(--fs-small); margin-top:var(--sp-3)">{{ $t('transfer.insufficient') }} <a style="color:var(--brand); font-weight:600" @click="go('/deposit')">{{ $t('transfer.depositLink') }}</a></p>
        </div>
    </section>`,
};
