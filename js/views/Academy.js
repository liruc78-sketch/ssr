// Beginner Academy — lessons & guides
import { ref, computed } from 'vue';
import { Icon } from '../icons.js';
import { toast } from '../store.js';
import { t } from '../i18n.js';

const LESSONS = [
    { cat: 'Basics', level: 'Beginner', min: 4, titleKey: 'academy.lesson1Title' },
    { cat: 'Basics', level: 'Beginner', min: 5, titleKey: 'academy.lesson2Title' },
    { cat: 'Trading', level: 'Intermediate', min: 7, titleKey: 'academy.lesson3Title' },
    { cat: 'Trading', level: 'Intermediate', min: 6, titleKey: 'academy.lesson4Title' },
    { cat: 'Earn', level: 'Beginner', min: 4, titleKey: 'academy.lesson5Title' },
    { cat: 'Security', level: 'Beginner', min: 3, titleKey: 'academy.lesson6Title' },
];

export default {
    name: 'Academy',
    components: { Icon },
    setup() {
        const cats = ['All', 'Basics', 'Trading', 'Earn', 'Security'];
        const cat = ref('All');
        const list = computed(() => cat.value === 'All' ? LESSONS : LESSONS.filter(l => l.cat === cat.value));
        const catLabel = (c) => t('academy.cat' + c);
        const levelLabel = (lv) => t('academy.level' + lv);
        return { cats, cat, list, catLabel, levelLabel, read: () => toast(t('academy.readToast'), 'info') };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><h1 class="page-title">{{ $t('academy.title') }}</h1></div>
        <div class="tabs" style="margin-bottom:var(--sp-4)">
            <button v-for="c in cats" :key="c" class="tab" :class="{ 'is-on': cat === c }" @click="cat = c">{{ catLabel(c) }}</button>
        </div>
        <div class="acad__list">
            <button v-for="(l, i) in list" :key="i" class="card acad__card" @click="read">
                <span class="acad__ico"><Icon name="academy" :size="22" /></span>
                <div class="acad__body">
                    <b>{{ $t(l.titleKey) }}</b>
                    <div class="acad__meta"><span class="chip" style="background:var(--surface-2)">{{ catLabel(l.cat) }}</span><span class="muted">{{ levelLabel(l.level) }} · {{ $t('academy.minRead', { n: l.min }) }}</span></div>
                </div>
                <Icon name="chevronR" :size="18" class="muted" />
            </button>
        </div>
    </section>`,
};
