// History / Funding records — real deposit & withdrawal records
import { ref, watch, onMounted } from 'vue';
import { Icon } from '../icons.js';
import { go, router } from '../router.js';
import { store } from '../store.js';
import { loadRecords } from '../wallet.js';
import { fmtNum } from '../data.js';

function fmtDate(iso) {
    if (!iso) return '';
    try { const d = new Date(iso); return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
}
const statusClass = (s) => /paid|done|success|approved|complete/i.test(s) ? 'chip--up' : /reject|fail|cancel/i.test(s) ? 'chip--down' : '';

export default {
    name: 'History',
    components: { Icon },
    setup() {
        const tab = ref('deposit');
        const title = router.path === '/funding' ? 'Funding Records' : 'History';
        const rows = ref([]);
        const loading = ref(false);

        const load = async () => {
            if (!store.isAuthed) { rows.value = []; return; }
            loading.value = true;
            try { rows.value = await loadRecords(tab.value); } catch { rows.value = []; }
            finally { loading.value = false; }
        };
        onMounted(load);
        watch(tab, load);

        return { tab, title, rows, loading, go, store, fmtNum, fmtDate, statusClass };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/assets')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">{{ title }}</h1></div>

        <div class="seg seg--type" style="margin-bottom:var(--sp-4)">
            <button class="seg__btn" :class="{ 'is-on': tab === 'deposit' }" @click="tab = 'deposit'">Deposit records</button>
            <button class="seg__btn" :class="{ 'is-on': tab === 'withdraw' }" @click="tab = 'withdraw'">Withdrawal records</button>
        </div>

        <div v-if="loading" class="card" style="display:grid; place-items:center; padding:var(--sp-10)"><span class="spinner"></span></div>

        <div v-else-if="rows.length" class="card" style="padding:var(--sp-1) var(--sp-3)">
            <div v-for="r in rows" :key="r.id" class="rec-row">
                <div class="rec-main">
                    <b class="num">{{ tab === 'deposit' ? ('+' + fmtNum(r.usd_amount) + ' USD') : ('-' + fmtNum(r.amount) + ' USD') }}</b>
                    <span class="muted" style="font-size:var(--fs-caption)">
                        {{ tab === 'deposit' ? (r.coin_symbol + ' · ' + (r.network_label || r.network)) : ('Fee $' + fmtNum(r.fee)) }} · {{ fmtDate(r.created_at) }}
                    </span>
                </div>
                <span class="chip" :class="statusClass(r.status)">{{ r.status }}</span>
            </div>
        </div>

        <div v-else class="card">
            <div class="placeholder" style="border:0; padding:var(--sp-12)">
                <Icon name="history" class="placeholder__icon" :size="44" />
                <p class="muted">{{ store.isAuthed ? ('No ' + tab + ' records yet.') : 'Log in to view your records.' }}</p>
                <button v-if="!store.isAuthed" class="btn btn--brand btn--sm btn--pill" @click="go('/login')">Log in</button>
            </div>
        </div>
    </section>`,
};
