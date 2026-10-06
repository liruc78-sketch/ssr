// Assets — wallet overview with sub-accounts, balance donut, quick actions
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store } from '../store.js';
import { fmtAmt } from '../data.js';

export default {
    name: 'Assets',
    components: { Icon },
    setup() {
        const tab = ref('overview');
        const tabs = [
            { k: 'overview', l: 'Overview' },
            { k: 'spot', l: 'Spot Account' },
            { k: 'trading', l: 'Trading Account' },
            { k: 'finance', l: 'Finance' },
        ];
        // Backend tracks a single usd_balance -> shown as the Spot account.
        // Trading/Finance sub-accounts aren't tracked server-side yet (show 0).
        const accounts = computed(() => ({
            spot: store.isAuthed ? store.portfolio.usdBalance : 0,
            trading: 0,
            finance: 0,
        }));
        const total = computed(() => accounts.value.spot + accounts.value.trading + accounts.value.finance);
        const segs = computed(() => {
            const t = total.value || 1;
            const parts = [
                { k: 'Spot', v: accounts.value.spot, c: 'var(--up)' },
                { k: 'Trading', v: accounts.value.trading, c: 'var(--brand)' },
                { k: 'Finance', v: accounts.value.finance, c: 'var(--gold)' },
            ];
            let acc = 0; const C = 2 * Math.PI * 42;
            return parts.map(p => {
                const frac = total.value ? p.v / t : 0;
                const seg = { ...p, pct: Math.round(frac * 100), dash: `${frac * C} ${C}`, offset: -acc * C };
                acc += frac; return seg;
            });
        });

        const actions = [
            { icon: 'deposit', label: 'Deposit', path: '/deposit' },
            { icon: 'withdraw', label: 'Withdraw', path: '/withdraw' },
            { icon: 'history', label: 'History', path: '/history' },
            { icon: 'transfer', label: 'Transfer', path: '/transfer' },
        ];
        return { tab, tabs, accounts, total, segs, actions, go, fmtAmt, store };
    },
    template: /*html*/`
    <section class="assets">
        <div class="tabs" style="margin-bottom:var(--sp-4)">
            <button v-for="t in tabs" :key="t.k" class="tab" :class="{ 'is-on': tab === t.k }" @click="tab = t.k">{{ t.l }}</button>
        </div>

        <div v-if="tab === 'overview'" class="stack">
            <div class="card wallet">
                <div class="wallet__top">
                    <div>
                        <div class="muted" style="font-size:var(--fs-small)">Account Balance</div>
                        <div class="wallet__total num">{{ fmtAmt(total) }} <span class="muted" style="font-size:var(--fs-h4)">USDT</span></div>
                    </div>
                    <div class="donut">
                        <svg viewBox="0 0 100 100" width="92" height="92">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-2)" stroke-width="12" />
                            <circle v-for="s in segs" :key="s.k" cx="50" cy="50" r="42" fill="none" :stroke="s.c" stroke-width="12"
                                    :stroke-dasharray="s.dash" :stroke-dashoffset="s.offset" transform="rotate(-90 50 50)" stroke-linecap="butt" />
                        </svg>
                    </div>
                </div>
                <div class="wallet__legend">
                    <div v-for="s in segs" :key="s.k"><span class="dotc" :style="{ background: s.c }"></span>{{ s.k }} <b class="num">{{ s.pct }}%</b></div>
                </div>
            </div>

            <div class="quickrow">
                <button v-for="a in actions" :key="a.label" class="quickrow__item" @click="go(a.path)">
                    <span class="quickrow__ico"><Icon :name="a.icon" :size="22" /></span>
                    <span>{{ a.label }}</span>
                </button>
            </div>

            <div class="sec-head" style="margin-top:var(--sp-5)"><h2>Crypto Assets</h2></div>
            <div class="card">
                <div class="placeholder" style="border:0; padding:var(--sp-10)">
                    <Icon name="assets" class="placeholder__icon" :size="44" />
                    <p class="muted">{{ store.isAuthed ? 'No assets yet — make your first deposit.' : 'Log in to view your assets.' }}</p>
                    <button class="btn btn--brand btn--sm btn--pill" @click="go(store.isAuthed ? '/deposit' : '/login')">{{ store.isAuthed ? 'Deposit' : 'Log in' }}</button>
                </div>
            </div>
        </div>

        <div v-else class="card">
            <div class="subacct">
                <div class="muted" style="font-size:var(--fs-small)">{{ tabs.find(t=>t.k===tab).l }} balance</div>
                <div class="wallet__total num">{{ fmtAmt(accounts[tab] || 0) }} <span class="muted" style="font-size:var(--fs-h4)">USDT</span></div>
            </div>
            <div class="placeholder" style="border:0; padding:var(--sp-10)">
                <Icon name="assets" class="placeholder__icon" :size="44" />
                <p class="muted">No assets in this account yet.</p>
            </div>
        </div>
    </section>`,
};
