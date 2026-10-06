// Desktop top navigation bar (>=1024px)
import { Icon } from '../icons.js';
import { router, go } from '../router.js';
import { store, toggleTheme, openDrawer } from '../store.js';

export default {
    name: 'TopNav',
    components: { Icon },
    setup() {
        const links = [
            { label: 'Home',     path: '/' },
            { label: 'Markets',  path: '/market' },
            { label: 'Spot',     path: '/trade' },
            { label: 'Futures',  path: '/trade?mode=perp' },
            { label: 'Finance',  path: '/finance' },
            { label: 'C2C',      path: '/c2c' },
            { label: 'Live',     path: '/live' },
            { label: 'Assets',   path: '/assets' },
        ];
        const isActive = (path) => {
            const base = path.split('?')[0];
            return router.path === base;
        };
        return { links, router, go, store, toggleTheme, openDrawer, isActive };
    },
    template: /*html*/`
    <header class="topnav">
        <a class="brand" href="#/" @click.prevent="go('/')">
            <span class="brand__mark">C</span>
            <span class="brand__name">Crypto<b>.ssr</b></span>
        </a>
        <nav class="topnav__links" aria-label="Primary">
            <a v-for="l in links" :key="l.label" class="topnav__link"
               :class="{ 'is-active': isActive(l.path) }"
               :href="'#' + l.path" @click.prevent="go(l.path)">{{ l.label }}</a>
        </nav>
        <div class="topnav__spacer"></div>
        <div class="topnav__actions">
            <button class="iconbtn" @click="go('/market')" aria-label="Search markets"><Icon name="search" /></button>
            <button class="iconbtn" @click="toggleTheme()" :aria-label="store.theme === 'dark' ? 'Light mode' : 'Dark mode'">
                <Icon :name="store.theme === 'dark' ? 'sun' : 'moon'" />
            </button>
            <button class="iconbtn" aria-label="Notifications"><Icon name="bell" /><span class="iconbtn__dot"></span></button>
            <button class="iconbtn" aria-label="Language"><Icon name="globe" /></button>
            <button v-if="store.isAuthed" class="iconbtn" @click="openDrawer()" aria-label="Account"><Icon name="user" /></button>
            <button v-else class="btn btn--brand btn--sm btn--pill" @click="go('/login')">Log in</button>
        </div>
    </header>`,
};
