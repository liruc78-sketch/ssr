// Deposit — real flow: pick coin/network/amount, create a recharge order against
// an admin-configured address, then show address + QR + countdown and poll status.
import { ref, reactive, computed, onBeforeUnmount, watch } from 'vue';
import QRCode from 'qrcode';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { DEPOSIT_COINS, depositRate, createRechargeOrder, checkRechargeStatus } from '../wallet.js';

export default {
    name: 'Deposit',
    components: { Icon },
    setup() {
        const step = ref(1);
        const coinId = ref('usdt');
        const networkId = ref('trc20');
        const amount = ref('');
        const rate = ref(1);
        const creating = ref(false);
        const order = reactive({ address: '', uniqueAmt: 0, usdAmt: 0, decimals: 3, orderIdShort: '', orderId: '' });
        const qr = ref('');
        const countdown = ref('60:00');
        const paid = ref(false);
        let cdTimer = null, pollTimer = null;

        const coin = computed(() => DEPOSIT_COINS.find(c => c.id === coinId.value) || DEPOSIT_COINS[0]);
        const networks = computed(() => coin.value.networks);
        const network = computed(() => networks.value.find(n => n.id === networkId.value) || networks.value[0]);
        const usdValue = computed(() => (parseFloat(amount.value) || 0) * rate.value);

        watch(coinId, async () => { networkId.value = coin.value.networks[0].id; rate.value = await depositRate(coin.value); });
        // initial rate
        depositRate(coin.value).then(r => rate.value = r);

        const create = async () => {
            if (!store.isAuthed) { go('/login'); return; }
            creating.value = true;
            try {
                const o = await createRechargeOrder({ coin: coin.value, network: network.value, cryptoAmount: amount.value, rate: rate.value });
                Object.assign(order, o);
                qr.value = await QRCode.toDataURL(o.address, { margin: 1, width: 320, color: { dark: '#0b1220', light: '#ffffff' } });
                step.value = 2;
                startCountdown(o.expireAt);
                startPoll();
            } catch (e) { toast(e?.message || 'Could not create order', 'error', 4200); }
            finally { creating.value = false; }
        };

        const startCountdown = (expireAt) => {
            clearInterval(cdTimer);
            const tick = () => {
                const diff = expireAt - Date.now();
                if (diff <= 0) { clearInterval(cdTimer); countdown.value = '00:00'; toast('Order expired', 'info'); back(); return; }
                const m = String(Math.floor(diff / 60000)).padStart(2, '0');
                const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
                countdown.value = `${m}:${s}`;
            };
            tick(); cdTimer = setInterval(tick, 1000);
        };
        const startPoll = () => {
            clearInterval(pollTimer);
            const poll = async () => {
                try { if (await checkRechargeStatus(order.orderId) === 'paid') { paid.value = true; stop(); toast('Deposit credited', 'success'); setTimeout(() => go('/assets'), 2000); } } catch {}
            };
            pollTimer = setInterval(poll, 15000);
        };
        const stop = () => { clearInterval(cdTimer); clearInterval(pollTimer); };
        const back = () => { stop(); step.value = 1; paid.value = false; };
        onBeforeUnmount(stop);

        const copy = async () => { try { await navigator.clipboard.writeText(order.address); toast('Address copied', 'success'); } catch { toast('Copy failed', 'error'); } };

        return { step, coinId, networkId, amount, rate, creating, order, qr, countdown, paid,
                 coin, networks, network, usdValue, DEPOSIT_COINS, create, back, copy, go, store };
    },
    template: /*html*/`
    <section class="pay">
        <div class="page-head">
            <button class="iconbtn page-head__back" @click="step === 2 ? back() : go('/assets')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button>
            <h1 class="page-title">Deposit</h1>
        </div>

        <!-- Step 1: choose coin / network / amount -->
        <div v-if="step === 1" class="card pay__card">
            <div class="paystep"><span class="eyebrow">Coin</span>
                <div class="dep-coins">
                    <button v-for="c in DEPOSIT_COINS" :key="c.id" class="dep-coin" :class="{ 'is-on': coinId === c.id }" @click="coinId = c.id">
                        <b>{{ c.symbol }}</b><span class="muted">{{ c.name }}</span>
                    </button>
                </div>
            </div>
            <div class="paystep"><span class="eyebrow">Network</span>
                <div class="dep-nets">
                    <button v-for="n in networks" :key="n.id" class="dep-net" :class="{ 'is-on': networkId === n.id }" @click="networkId = n.id">
                        <span><b>{{ n.label }}</b><span class="muted" style="display:block; font-size:var(--fs-caption)">{{ n.desc }}</span></span>
                        <Icon v-if="networkId === n.id" name="shield" :size="16" />
                    </button>
                </div>
            </div>
            <div class="paystep"><span class="eyebrow">Amount ({{ coin.symbol }}) · min {{ coin.minAmt }}</span>
                <div class="field" style="display:flex; align-items:center; gap:8px">
                    <input v-model="amount" class="num" :placeholder="'e.g. ' + coin.minAmt" style="flex:1; background:none; border:none; outline:none; color:var(--text)" />
                    <span class="fieldrow__suf">{{ coin.symbol }}</span>
                </div>
                <span class="muted" style="font-size:var(--fs-caption)">≈ \${{ usdValue.toFixed(2) }} · rate 1 {{ coin.symbol }} ≈ \${{ rate }}</span>
            </div>
            <button class="btn btn--block btn--lg" :class="store.isAuthed ? 'btn--brand' : 'btn--dark'" :disabled="creating" @click="create">
                <span v-if="creating" class="spinner" style="border-top-color:#fff"></span>
                <template v-else>{{ store.isAuthed ? 'Get deposit address' : 'Log in to deposit' }}</template>
            </button>
        </div>

        <!-- Step 2: address + QR + countdown -->
        <div v-else class="card pay__card">
            <div v-if="paid" class="placeholder" style="border:0; padding:var(--sp-8)"><Icon name="shield" class="placeholder__icon up" :size="48" style="color:var(--up)" /><h3 class="up">Deposit credited</h3><p class="muted">Redirecting to Assets…</p></div>
            <template v-else>
                <div class="dep-timer">Send within <b class="num">{{ countdown }}</b></div>
                <div class="pay__qr"><img v-if="qr" :src="qr" width="200" height="200" alt="Deposit address" /></div>
                <div class="payline"><span class="muted">Send exactly</span><b class="num">{{ order.uniqueAmt }} {{ coin.symbol }}</b></div>
                <div class="payline"><span class="muted">You'll be credited</span><b class="num up">\${{ order.usdAmt.toFixed(2) }}</b></div>
                <div class="payline"><span class="muted">Network</span><b>{{ network.label }}</b></div>
                <div class="paystep"><span class="eyebrow">Receiving address</span>
                    <div class="addr"><span class="addr__val num">{{ order.address }}</span><button class="btn btn--dark btn--sm" @click="copy"><Icon name="copy" :size="16" /> Copy</button></div>
                </div>
                <p class="note"><Icon name="info" :size="15" /> Send only {{ coin.symbol }} over {{ network.label }}, and the <b>exact</b> amount above, so we can match your transfer. It credits automatically after on-chain confirmation (order {{ order.orderIdShort }}).</p>
            </template>
        </div>
    </section>`,
};
