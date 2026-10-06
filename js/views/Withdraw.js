// Withdraw — USD-balance withdrawal to an address (real: deduct + pending record).
// Backend tracks a single usd_balance, so amounts are USD; coin/network guide the
// payout. Fee 1% + $2, min $10 (matches legacy).
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { fmtNum } from '../data.js';
import { submitWithdrawal, withdrawFee, withdrawTotal, WITHDRAW_MIN } from '../wallet.js';

const NETWORKS = { USDT: ['TRC20', 'ERC20', 'BEP20'], USDC: ['ERC20', 'BEP20'] };

export default {
    name: 'Withdraw',
    components: { Icon },
    setup() {
        const currency = ref('USDT');
        const network = ref('TRC20');
        const amount = ref('');
        const address = ref('');
        const submitting = ref(false);
        const balance = computed(() => store.isAuthed ? store.portfolio.usdBalance : 0);
        const nets = computed(() => NETWORKS[currency.value] || ['TRC20']);
        const amt = computed(() => parseFloat(amount.value) || 0);
        const fee = computed(() => amt.value > 0 ? withdrawFee(amt.value) : 0);
        const total = computed(() => amt.value > 0 ? withdrawTotal(amt.value) : 0);
        const arrival = computed(() => amt.value);

        const setAll = () => { amount.value = String(Math.max(0, balance.value)); };
        const submit = async () => {
            if (!store.isAuthed) { go('/login'); return; }
            submitting.value = true;
            try {
                await submitWithdrawal({ amount: amount.value, address: address.value });
                toast('Withdrawal request submitted — awaiting review', 'success');
                go('/assets');
            } catch (e) { toast(e?.message || 'Withdrawal failed', 'error', 3600); }
            finally { submitting.value = false; }
        };
        return { currency, network, nets, amount, address, submitting, balance, fee, total, arrival, WITHDRAW_MIN, setAll, submit, go, fmtNum, store };
    },
    template: /*html*/`
    <section class="pay">
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/assets')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">Withdraw</h1></div>

        <div class="card pay__card">
            <label class="paystep"><span class="eyebrow">Receive as</span>
                <select class="field" v-model="currency"><option v-for="c in ['USDT','USDC']" :key="c" :value="c">{{ c }}</option></select>
            </label>
            <label class="paystep"><span class="eyebrow">Network</span>
                <select class="field" v-model="network"><option v-for="n in nets" :key="n" :value="n">{{ n }}</option></select>
            </label>
            <label class="paystep"><span class="eyebrow">Amount (USD) · min \${{ WITHDRAW_MIN }}</span>
                <div class="field" style="display:flex; align-items:center; gap:8px">
                    <input v-model="amount" placeholder="0" class="num" style="flex:1; background:none; border:none; outline:none; color:var(--text)" />
                    <button class="chip chip--brand" @click="setAll">All</button>
                </div>
                <span class="muted" style="font-size:var(--fs-caption); margin-top:4px">Balance: {{ fmtNum(balance) }} USD</span>
            </label>
            <label class="paystep"><span class="eyebrow">Address</span>
                <input class="field num" v-model="address" placeholder="Recipient address" />
            </label>

            <div class="payline"><span class="muted">Fee (1% + $2)</span><span class="num">\${{ fmtNum(fee) }}</span></div>
            <div class="payline"><span class="muted">Total deducted</span><span class="num">\${{ fmtNum(total) }}</span></div>
            <div class="payline"><span class="muted">You receive</span><span class="num">\${{ fmtNum(arrival) }} worth of {{ currency }}</span></div>

            <p class="note"><Icon name="info" :size="15" /> Ensure the address is correct and supports {{ currency }} on {{ network }}. Requests are reviewed before payout; transfers to a wrong address or network can't be recovered.</p>

            <button class="btn btn--block btn--lg" :class="store.isAuthed ? 'btn--brand' : 'btn--dark'" :disabled="submitting" @click="submit">
                <span v-if="submitting" class="spinner" style="border-top-color:#fff"></span>
                <template v-else>{{ store.isAuthed ? 'Withdraw' : 'Log in to withdraw' }}</template>
            </button>
        </div>
    </section>`,
};
