// Mobile bottom navigation — Home · Market · Trade(center) · Finance · Assets
import { Icon } from '../icons.js';
import { router, go } from '../router.js';

export default {
    name: 'BottomNav',
    components: { Icon },
    setup() {
        const items = [
            { key: 'home',    tkey: 'nav.home',    icon: 'home',    path: '/' },
            { key: 'market',  tkey: 'nav.market',  icon: 'market',  path: '/market' },
            { key: 'trade',   tkey: 'nav.trade',   icon: 'trade',   path: '/trade', center: true },
            { key: 'finance', tkey: 'nav.finance', icon: 'finance', path: '/finance' },
            { key: 'assets',  tkey: 'nav.assets',  icon: 'assets',  path: '/assets' },
        ];
        return { items, router, go };
    },
    template: /*html*/`
    <nav class="bottomnav" aria-label="Primary">
        <template v-for="it in items" :key="it.key">
            <button v-if="it.center" class="bottomnav__item bottomnav__center" @click="go(it.path)" :aria-label="$t(it.tkey)">
                <span class="bottomnav__fab"><Icon :name="it.icon" /></span>
                <span>{{ $t(it.tkey) }}</span>
            </button>
            <button v-else class="bottomnav__item" :class="{ 'is-active': router.nav === it.key }" @click="go(it.path)">
                <Icon :name="it.icon" />
                <span>{{ $t(it.tkey) }}</span>
            </button>
        </template>
    </nav>`,
};
