// PositionDetail — bottom-sheet showing one option position's full details.
// Shared by the Trade ledger and the Simulated Wallet history. Reuses the
// result-popup (.optwait) styling so a tapped record reads like its live result.
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { Icon } from '../icons.js';
import { CoinIcon } from './CoinIcon.js';
import { COINS, OPTION_TIERS, fmtNum } from '../data.js';

const RING_C = 2 * Math.PI * 54;

export const PositionDetail = {
    name: 'PositionDetail',
    components: { Icon, CoinIcon },
    props: { pos: { type: Object, default: null } },
    emits: ['close'],
    setup(props, { emit }) {
        const coin = computed(() => COINS.find(c => c.cg === props.pos?.coinId) || null);
        const sym = computed(() => coin.value?.sym || (props.pos?.coinId || '').toUpperCase());
        const settled = computed(() => !!props.pos && props.pos.status !== 'Active');
        const won = computed(() => props.pos?.status === 'Won');
        const lost = computed(() => props.pos?.status === 'Lost');
        const payoutPct = computed(() => {
            const t = OPTION_TIERS.find(x => x.sec === props.pos?.durationSec);
            return t ? Math.round((t.payout - 1) * 100) : null;
        });
        const pnl = computed(() => (props.pos && props.pos.payout != null) ? props.pos.payout - props.pos.amount : null);
        const durationLabel = computed(() => props.pos?.durationSec ? props.pos.durationSec + 's' : '—');
        const fmtTime = (iso) => {
            if (!iso) return '—';
            try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
            catch { return '—'; }
        };
        const signed = (n) => n == null ? '—' : (n >= 0 ? '+' : '-') + fmtNum(Math.abs(n));

        const sheetEl = ref(null);
        let lastFocused = null;
        const close = () => emit('close');
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); close(); return; }
            if (e.key !== 'Tab' || !sheetEl.value) return;
            const f = sheetEl.value.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        // Act only on open/close transitions; identity changes (live settlement) just re-render.
        watch(() => props.pos, (p, prev) => {
            if (p && !prev) {
                lastFocused = document.activeElement;
                document.body.style.overflow = 'hidden';
                document.addEventListener('keydown', onKey);
                // Focus the dialog itself (not the bottom Close) so a tall, scrollable
                // sheet still opens showing the result at the top.
                nextTick(() => { try { if (sheetEl.value) { sheetEl.value.scrollTop = 0; sheetEl.value.focus(); } } catch {} });
            } else if (!p && prev) {
                document.body.style.overflow = '';
                document.removeEventListener('keydown', onKey);
                try { lastFocused?.focus?.(); } catch {}
                lastFocused = null;
            }
        });
        onBeforeUnmount(() => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); });

        return { coin, sym, settled, won, lost, payoutPct, pnl, durationLabel, fmtTime, signed, fmtNum, close, RING_C, sheetEl };
    },
    template: /*html*/`
    <div>
        <transition name="scrim"><div v-if="pos" class="drawer-scrim" @click="close()"></div></transition>
        <transition name="sheet">
            <div v-if="pos" ref="sheetEl" class="sheet optwait" role="dialog" aria-modal="true" aria-label="Trade details" tabindex="-1" style="outline:none">
                <div class="optwait__head">
                    <span class="optwait__sym">
                        <CoinIcon :sym="sym" :color="coin?.color" cls="optwait__ico" />
                        {{ sym }}<span class="muted">/USDT</span>
                        <span v-if="pos.isSim" class="chip chip--gold" style="height:20px">SIM</span>
                    </span>
                    <button class="iconbtn" @click="close()" aria-label="Close"><Icon name="close" /></button>
                </div>

                <div class="optwait__ringwrap" aria-hidden="true">
                    <svg class="optwait__ring" :class="{ 'is-settled': settled, 'is-won': won, 'is-lost': lost, 'is-active': !settled }" viewBox="0 0 120 120">
                        <circle class="optwait__track" cx="60" cy="60" r="54" />
                        <circle class="optwait__arc" cx="60" cy="60" r="54" :stroke-dasharray="RING_C" stroke-dashoffset="0" />
                    </svg>
                    <div class="optwait__center">
                        <b class="optwait__result" :class="won ? 'up' : lost ? 'down' : 'muted'">{{ settled ? pos.status : 'ACTIVE' }}</b>
                    </div>
                </div>

                <div class="optwait__rows">
                    <div class="optwait__row"><span class="muted">Direction</span><b :class="pos.type === 'up' ? 'up' : 'down'">{{ pos.type === 'up' ? 'Up ▲' : 'Down ▼' }}</b></div>
                    <div class="optwait__row"><span class="muted">Entry price</span><b class="num">{{ fmtNum(pos.entryPrice) }}</b></div>
                    <div class="optwait__row"><span class="muted">Settlement price</span><b class="num">{{ pos.settlementPrice != null ? fmtNum(pos.settlementPrice) : '—' }}</b></div>
                    <div class="optwait__row"><span class="muted">Duration · payout</span><b class="num">{{ durationLabel }}<template v-if="payoutPct != null"> · +{{ payoutPct }}%</template></b></div>
                    <div class="optwait__row"><span class="muted">Amount</span><b class="num">{{ fmtNum(pos.amount) }} USDT</b></div>
                    <div class="optwait__row"><span class="muted">Fee rate</span><b class="num">0%</b></div>
                    <div v-if="pos.payout != null" class="optwait__row"><span class="muted">Payout</span><b class="num" :class="won ? 'up' : 'down'">{{ fmtNum(pos.payout) }} USDT</b></div>
                    <div v-if="pnl != null" class="optwait__row"><span class="muted">Net P&L</span><b class="num" :class="pnl >= 0 ? 'up' : 'down'">{{ signed(pnl) }} USDT</b></div>
                    <div class="optwait__row"><span class="muted">Opened</span><b class="num">{{ fmtTime(pos.createdAt) }}</b></div>
                    <div v-if="pos.settledAt" class="optwait__row"><span class="muted">Settled</span><b class="num">{{ fmtTime(pos.settledAt) }}</b></div>
                </div>

                <button class="btn btn--dark btn--block btn--lg optwait__close" @click="close()">Close</button>
            </div>
        </transition>
    </div>`,
};
