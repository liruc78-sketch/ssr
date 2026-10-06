// Beginner Academy — lessons & guides
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';
import { toast } from '../store.js';

const LESSONS = [
    { cat: 'Basics', level: 'Beginner', min: 4, title: 'What is a crypto exchange and how orders work' },
    { cat: 'Basics', level: 'Beginner', min: 5, title: 'Spot vs. contracts vs. options — which to use' },
    { cat: 'Trading', level: 'Intermediate', min: 7, title: 'Reading an order book and market depth' },
    { cat: 'Trading', level: 'Intermediate', min: 6, title: 'Using leverage safely: margin, liquidation, TP/SL' },
    { cat: 'Earn', level: 'Beginner', min: 4, title: 'Flexible savings vs. fixed-term strategies' },
    { cat: 'Security', level: 'Beginner', min: 3, title: 'Protecting your account: 2FA, anti-phishing, devices' },
];

export default {
    name: 'Academy',
    components: { Icon },
    setup() {
        const cats = ['All', 'Basics', 'Trading', 'Earn', 'Security'];
        const cat = ref('All');
        const list = computed(() => cat.value === 'All' ? LESSONS : LESSONS.filter(l => l.cat === cat.value));
        return { cats, cat, list, read: () => toast('Opening lesson — coming soon', 'info') };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><h1 class="page-title">Beginner Academy</h1></div>
        <div class="tabs" style="margin-bottom:var(--sp-4)">
            <button v-for="c in cats" :key="c" class="tab" :class="{ 'is-on': cat === c }" @click="cat = c">{{ c }}</button>
        </div>
        <div class="acad__list">
            <button v-for="(l, i) in list" :key="i" class="card acad__card" @click="read">
                <span class="acad__ico"><Icon name="academy" :size="22" /></span>
                <div class="acad__body">
                    <b>{{ l.title }}</b>
                    <div class="acad__meta"><span class="chip" style="background:var(--surface-2)">{{ l.cat }}</span><span class="muted">{{ l.level }} · {{ l.min }} min read</span></div>
                </div>
                <Icon name="chevronR" :size="18" class="muted" />
            </button>
        </div>
    </section>`,
};
