// Mobile bottom navigation — Home · Market · Trade(center) · Finance · Assets
import { Icon } from '../icons.js';
import { router, go } from '../router.js';

export default {
    name: 'BottomNav',
    components: { Icon },
    setup() {
        const items = [
            { key: 'home',    label: 'Home',    icon: 'home',    path: '/' },
            { key: 'market',  label: 'Market',  icon: 'market',  path: '/market' },
            { key: 'trade',   label: 'Trade',   icon: 'trade',   path: '/trade', center: true },
            { key: 'finance', label: 'Finance', icon: 'finance', path: '/finance' },
            { key: 'assets',  label: 'Assets',  icon: 'assets',  path: '/assets' },
        ];
        return { items, router, go };
    },
    template: /*html*/`
    <nav class="bottomnav" aria-label="Primary">
        <template v-for="it in items" :key="it.key">
            <button v-if="it.center" class="bottomnav__item bottomnav__center" @click="go(it.path)" :aria-label="it.label">
                <span class="bottomnav__fab"><Icon :name="it.icon" /></span>
                <span>{{ it.label }}</span>
            </button>
            <button v-else class="bottomnav__item" :class="{ 'is-active': router.nav === it.key }" @click="go(it.path)">
                <Icon :name="it.icon" />
                <span>{{ it.label }}</span>
            </button>
        </template>
    </nav>`,
};
