// History / Funding records — deposit & withdrawal records
import { ref } from 'vue';
import { Icon } from '../icons.js';
import { go, router } from '../router.js';
import { store } from '../store.js';

export default {
    name: 'History',
    components: { Icon },
    setup() {
        const tab = ref('deposit');
        const title = router.path === '/funding' ? 'Funding Records' : 'History';
        return { tab, title, go, store };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/assets')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">{{ title }}</h1></div>

        <div class="seg seg--type" style="margin-bottom:var(--sp-4)">
            <button class="seg__btn" :class="{ 'is-on': tab === 'deposit' }" @click="tab = 'deposit'">Deposit records</button>
            <button class="seg__btn" :class="{ 'is-on': tab === 'withdraw' }" @click="tab = 'withdraw'">Withdrawal records</button>
        </div>

        <div class="card">
            <div class="placeholder" style="border:0; padding:var(--sp-12)">
                <Icon name="history" class="placeholder__icon" :size="44" />
                <p class="muted">{{ store.isAuthed ? 'No ' + tab + ' records yet.' : 'Log in to view your records.' }}</p>
                <button v-if="!store.isAuthed" class="btn btn--brand btn--sm btn--pill" @click="go('/login')">Log in</button>
            </div>
        </div>
    </section>`,
};
