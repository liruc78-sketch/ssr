// Deposit — automatic/manual recharge, currency+network, address QR
import { ref, computed, watch, onMounted } from 'vue';
import QRCode from 'qrcode';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { toast } from '../store.js';

const NETWORKS = {
    USDT: ['ERC20', 'TRC20', 'BEP20'],
    USDC: ['ERC20', 'BEP20'],
    BTC: ['Bitcoin'],
    ETH: ['ERC20'],
};
// Deterministic demo address per currency/network (backend-assigned in production).
function demoAddress(cur, net) {
    let s = (cur + net).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    // LCG, but read HIGH bits (low bits of an LCG cycle with a short period).
    const rnd = (mod) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return Math.floor((s / 0x100000000) * mod); };
    if (cur === 'BTC') return 'bc1q' + Array.from({ length: 38 }, () => 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'[rnd(32)]).join('');
    return '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[rnd(16)]).join('');
}

export default {
    name: 'Deposit',
    components: { Icon },
    setup() {
        const mode = ref('auto');
        const currency = ref('USDT');
        const network = ref('ERC20');
        const qr = ref('');
        const nets = computed(() => NETWORKS[currency.value] || ['ERC20']);
        const address = computed(() => demoAddress(currency.value, network.value));

        watch(currency, () => { if (!nets.value.includes(network.value)) network.value = nets.value[0]; });
        async function makeQR() {
            try { qr.value = await QRCode.toDataURL(address.value, { margin: 1, width: 320, color: { dark: '#0b1220', light: '#ffffff' } }); }
            catch { qr.value = ''; }
        }
        watch([currency, network], makeQR);
        onMounted(makeQR);

        const copy = async () => { try { await navigator.clipboard.writeText(address.value); toast('Address copied', 'success'); } catch { toast('Copy failed', 'error'); } };
        const submitManual = () => { toast('Submitted for review — credited after confirmation', 'success'); go('/assets'); };
        return { mode, currency, network, nets, address, qr, copy, submitManual, go };
    },
    template: /*html*/`
    <section class="pay">
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/assets')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">Deposit</h1></div>

        <div class="seg seg--type" style="margin-bottom:var(--sp-5)">
            <button class="seg__btn" :class="{ 'is-on': mode === 'auto' }" @click="mode = 'auto'">Automatic recharge</button>
            <button class="seg__btn" :class="{ 'is-on': mode === 'manual' }" @click="mode = 'manual'">Manual recharge</button>
        </div>

        <div v-if="mode === 'auto'" class="card pay__card">
            <div class="pay__qr">
                <img v-if="qr" :src="qr" alt="Deposit address QR" width="200" height="200" />
                <div v-else class="skeleton" style="width:200px;height:200px"></div>
            </div>
            <p class="muted" style="text-align:center; font-size:var(--fs-small)">Copy your unique address or scan the QR to deposit</p>

            <label class="paystep">
                <span class="eyebrow">1 · Currency</span>
                <select class="field" v-model="currency">
                    <option v-for="c in ['USDT','USDC','BTC','ETH']" :key="c" :value="c">{{ c }}</option>
                </select>
            </label>
            <label class="paystep">
                <span class="eyebrow">2 · Network</span>
                <select class="field" v-model="network">
                    <option v-for="n in nets" :key="n" :value="n">{{ n }}</option>
                </select>
            </label>
            <div class="paystep">
                <span class="eyebrow">3 · Address</span>
                <div class="addr">
                    <span class="addr__val num">{{ address }}</span>
                    <button class="btn btn--dark btn--sm" @click="copy"><Icon name="copy" :size="16" /> Copy</button>
                </div>
            </div>
            <p class="note"><Icon name="info" :size="15" /> Send only {{ currency }} over {{ network }} to this address. Depositing other assets may cause permanent loss.</p>
        </div>

        <div v-else class="card pay__card">
            <p class="muted">Already sent a transfer? Submit the transaction hash and our team will credit it after confirmation.</p>
            <label class="paystep"><span class="eyebrow">Transaction hash (TxID)</span><input class="field" placeholder="0x…" /></label>
            <label class="paystep"><span class="eyebrow">Amount</span><input class="field" placeholder="0.00" /></label>
            <button class="btn btn--brand btn--block btn--lg" @click="submitManual">Submit for review</button>
        </div>
    </section>`,
};
