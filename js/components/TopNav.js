// Desktop top navigation bar (>=1024px)
import { Icon } from '../icons.js';
import { router, go } from '../router.js';
import { store, toggleTheme, openDrawer, openLang } from '../store.js';

export default {
    name: 'TopNav',
    components: { Icon },
    setup() {
        const links = [
            { tkey: 'nav.home',     path: '/' },
            { tkey: 'nav.markets',  path: '/market' },
            { tkey: 'nav.spot',     path: '/trade' },
            { tkey: 'nav.futures',  path: '/trade?mode=perp' },
            { tkey: 'nav.finance',  path: '/finance' },
            { tkey: 'nav.c2c',      path: '/c2c' },
            { tkey: 'nav.live',     path: '/live' },
            { tkey: 'nav.assets',   path: '/assets' },
        ];
        const isActive = (path) => {
            const base = path.split('?')[0];
            return router.path === base;
        };
        return { links, router, go, store, toggleTheme, openDrawer, openLang, isActive };
    },
    template: /*html*/`
    <header class="topnav">
        <a class="brand" href="#/" @click.prevent="go('/')">
            <img class="brand__logo" src="crypto-ssr-icon.svg" alt="" width="32" height="32" draggable="false" />
            <span class="brand__name">Crypto<b>.ssr</b></span>
        </a>
        <nav class="topnav__links" aria-label="Primary">
            <a v-for="l in links" :key="l.tkey" class="topnav__link"
               :class="{ 'is-active': isActive(l.path) }"
               :href="'#' + l.path" @click.prevent="go(l.path)">{{ $t(l.tkey) }}</a>
        </nav>
        <div class="topnav__spacer"></div>
        <div class="topnav__actions">
            <button class="iconbtn" @click="go('/market')" :aria-label="$t('common.searchMarkets')"><Icon name="search" /></button>
            <button class="iconbtn" @click="toggleTheme()" :aria-label="store.theme === 'dark' ? $t('common.lightMode') : $t('common.darkMode')">
                <Icon :name="store.theme === 'dark' ? 'sun' : 'moon'" />
            </button>
            <button class="iconbtn" :aria-label="$t('common.notifications')"><Icon name="bell" /><span class="iconbtn__dot"></span></button>
            <button class="iconbtn" @click="openLang()" :aria-label="$t('common.language')"><Icon name="globe" /></button>
            <button v-if="store.isAuthed" class="iconbtn" @click="openDrawer()" :aria-label="$t('common.account')"><Icon name="user" /></button>
            <button v-else class="btn btn--brand btn--sm btn--pill" @click="go('/login')">{{ $t('common.login') }}</button>
        </div>
    </header>`,
};
