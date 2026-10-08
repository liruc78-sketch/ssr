// Transfer — move funds between sub-accounts
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { t } from '../i18n.js';
import { fmtNum } from '../data.js';

const ACCOUNTS = [
    { id: 'spot', tkey: 'transfer.acctSpot' },
    { id: 'trading', tkey: 'transfer.acctTrading' },
    { id: 'finance', tkey: 'transfer.acctFinance' },
];

export default {
    name: 'Transfer',
    components: { Icon },
    setup() {
        const from = ref('spot');
        const to = ref('trading');
        const currency = ref('USDT');
        const amount = ref('');
        const available = computed(() => (store.isAuthed && currency.value === 'USDT') ? store.portfolio.usdBalance : 0);

        const swap = () => { const t = from.value; from.value = to.value; to.value = t; };
        const setAll = () => { amount.value = String(available.value); };
        const confirm = () => {
            if (!store.isAuthed) { go('/login'); return; }
            if (from.value === to.value) { toast(t('transfer.chooseDifferent'), 'error'); return; }
            if (!(parseFloat(amount.value) > 0)) { toast(t('transfer.enterAmount'), 'error'); return; }
            toast(t('transfer.complete'), 'success'); go('/assets');
        };
        return { from, to, currency, amount, available, ACCOUNTS, swap, setAll, confirm, go, fmtNum, store };
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

            <button class="btn btn--block btn--lg" :class="store.isAuthed ? 'btn--brand' : 'btn--dark'" @click="confirm">{{ store.isAuthed ? $t('transfer.confirm') : $t('transfer.loginToTransfer') }}</button>
            <p class="muted" style="text-align:center; font-size:var(--fs-small); margin-top:var(--sp-3)">{{ $t('transfer.insufficient') }} <a style="color:var(--brand); font-weight:600" @click="go('/deposit')">{{ $t('transfer.depositLink') }}</a></p>
        </div>
    </section>`,
};
