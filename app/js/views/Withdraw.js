// Withdraw — currency+network, quantity, address, fee, confirm
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { fmtNum } from '../data.js';

const NETWORKS = { USDT: ['TRC20', 'ERC20', 'BEP20'], USDC: ['ERC20', 'BEP20'], BTC: ['Bitcoin'], ETH: ['ERC20'] };
const FEE = 0.01;

export default {
    name: 'Withdraw',
    components: { Icon },
    setup() {
        const currency = ref('USDT');
        const network = ref('TRC20');
        const amount = ref('');
        const address = ref('');
        // Backend tracks a single USD balance -> available for USDT withdrawals.
        const balance = computed(() => (store.isAuthed && currency.value === 'USDT') ? store.portfolio.usdBalance : 0);
        const nets = computed(() => NETWORKS[currency.value] || ['ERC20']);
        const arrival = computed(() => { const a = parseFloat(amount.value) || 0; return Math.max(0, a - a * FEE); });

        const setAll = () => { amount.value = String(balance.value); };
        const submit = () => {
            if (!store.isAuthed) { go('/login'); return; }
            if (!address.value) { toast('Enter a withdrawal address', 'error'); return; }
            if (!(parseFloat(amount.value) > 0)) { toast('Enter an amount', 'error'); return; }
            toast('Withdrawal submitted (demo)', 'success'); go('/assets');
        };
        return { currency, network, nets, amount, address, balance, arrival, FEE, setAll, submit, go, fmtNum, store };
    },
    template: /*html*/`
    <section class="pay">
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/assets')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">Withdraw</h1></div>

        <div class="card pay__card">
            <label class="paystep"><span class="eyebrow">Currency</span>
                <select class="field" v-model="currency"><option v-for="c in ['USDT','USDC','BTC','ETH']" :key="c" :value="c">{{ c }}</option></select>
            </label>
            <label class="paystep"><span class="eyebrow">Network</span>
                <select class="field" v-model="network"><option v-for="n in nets" :key="n" :value="n">{{ n }}</option></select>
            </label>
            <label class="paystep"><span class="eyebrow">Withdrawal quantity</span>
                <div class="field" style="display:flex; align-items:center; gap:8px">
                    <input v-model="amount" placeholder="0" class="num" style="flex:1; background:none; border:none; outline:none; color:var(--text)" />
                    <button class="chip chip--brand" @click="setAll">All</button>
                </div>
                <span class="muted" style="font-size:var(--fs-caption); margin-top:4px">Balance: {{ fmtNum(balance) }} {{ currency }}</span>
            </label>
            <label class="paystep"><span class="eyebrow">Address</span>
                <input class="field num" v-model="address" placeholder="Recipient address" />
            </label>

            <div class="payline"><span class="muted">Service charge {{ (FEE*100) }}%</span><span class="muted">Actual arrival <b class="num">{{ fmtNum(arrival) }} {{ currency }}</b></span></div>

            <p class="note"><Icon name="info" :size="15" /> Ensure the address is correct and supports {{ currency }} on {{ network }}. Transfers to a wrong address or network cannot be recovered.</p>

            <button class="btn btn--block btn--lg" :class="store.isAuthed ? 'btn--brand' : 'btn--dark'" @click="submit">{{ store.isAuthed ? 'Withdraw' : 'Log in to withdraw' }}</button>
        </div>
    </section>`,
};
