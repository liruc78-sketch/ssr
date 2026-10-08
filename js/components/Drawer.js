// Side drawer — full menu, account card, simulated-trading entry, language
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, closeDrawer, toast, toggleTheme, openLang } from '../store.js';
import { disconnect } from '../auth.js';
import { t } from '../i18n.js';

export default {
    name: 'Drawer',
    components: { Icon },
    setup() {
        const nav = (path) => { closeDrawer(); go(path); };
        const groups = [
            { title: 'drawer.commonlyUsed', cells: [
                { icon: 'globe',    tkey: 'common.language',     action: openLang },
                { icon: 'history',  tkey: 'drawer.fundingRecords', path: '/funding' },
                { icon: 'convert',  tkey: 'drawer.convert',       path: '/convert' },
                { icon: 'trade',    tkey: 'drawer.c2c',           path: '/c2c' },
            ]},
            { title: 'drawer.markets', cells: [
                { icon: 'market',   tkey: 'drawer.crypto',        path: '/market' },
                { icon: 'us',       tkey: 'drawer.usStocks',      path: '/market?cat=us' },
                { icon: 'fx',       tkey: 'drawer.fx',            path: '/market?cat=fx' },
                { icon: 'options',  tkey: 'drawer.options',       path: '/trade?mode=options' },
            ]},
            { title: 'drawer.finance', cells: [
                { icon: 'finance',  tkey: 'drawer.finance',       path: '/finance' },
            ]},
            { title: 'drawer.other', cells: [
                { icon: 'bulletin', tkey: 'drawer.bulletin',      path: '/bulletin' },
                { icon: 'doc',      tkey: 'drawer.news',          path: '/news' },
                { icon: 'live',     tkey: 'drawer.liveStreaming', path: '/live' },
                { icon: 'shield',   tkey: 'drawer.securityCenter', path: '/security' },
                { icon: 'user',     tkey: 'drawer.kyc',           path: '/kyc' },
                { icon: 'academy',  tkey: 'drawer.academy',       path: '/academy' },
            ]},
        ];
        const identity = () => store.session?.displayName || store.session?.username || store.session?.walletAddress || t('common.account');
        const initials = () => identity().replace(/^0x/, '').trim().charAt(0).toUpperCase() || 'U';
        const subId = () => {
            const w = store.session?.walletAddress || '';
            if (w) return w.length > 10 ? w.slice(0, 6) + '…' + w.slice(-4) : w;
            return store.session?.email || store.session?.username || '';
        };
        const doLogout = () => { disconnect(); closeDrawer(); toast(t('common.disconnected'), 'info'); go('/'); };
        // Simulated-trading entry: open the dedicated sim wallet page.
        const enterSim = () => nav('/sim');
        return { store, nav, closeDrawer, groups, identity, initials, subId, toggleTheme, doLogout, enterSim };
    },
    template: /*html*/`
    <div class="drawer" role="dialog" :aria-label="$t('common.menu')">
        <div class="drawer__head">
            <span class="brand"><span class="brand__mark">C</span><span class="brand__name">Crypto<b>.ssr</b></span></span>
            <div style="display:flex; gap:4px">
                <button class="iconbtn" @click="toggleTheme()" :aria-label="store.theme === 'dark' ? $t('common.lightMode') : $t('common.darkMode')">
                    <Icon :name="store.theme === 'dark' ? 'sun' : 'moon'" />
                </button>
                <button class="iconbtn" @click="closeDrawer()" :aria-label="$t('common.closeMenu')"><Icon name="close" /></button>
            </div>
        </div>

        <!-- Account card -->
        <div v-if="store.isAuthed" class="drawer__account">
            <div class="drawer__avatar">{{ initials() }}</div>
            <div style="flex:1; min-width:0">
                <div style="display:flex; align-items:center; gap:8px">
                    <strong style="font-size:var(--fs-h4); overflow:hidden; text-overflow:ellipsis; white-space:nowrap">{{ identity() }}</strong>
                    <span class="chip" :class="store.session?.verified ? 'chip--up' : ''">{{ store.session?.verified ? $t('drawer.verified') : $t('drawer.notVerified') }}</span>
                </div>
                <div class="drawer__uid">
                    <span class="num muted" style="font-size:var(--fs-small)">{{ subId() }}</span>
                    <span class="muted" style="font-size:var(--fs-small)">{{ $t('drawer.credit') }} <b class="up">{{ store.session?.creditScore ?? 100 }}</b></span>
                </div>
            </div>
            <button class="iconbtn" @click="nav('/security')" :aria-label="$t('common.editProfile')"><Icon name="chevronR" /></button>
        </div>
        <div v-else class="drawer__account" style="cursor:pointer" @click="nav('/login')">
            <div class="drawer__avatar"><Icon name="user" /></div>
            <div style="flex:1">
                <strong style="font-size:var(--fs-h4)">{{ $t('drawer.signInRegister') }}</strong>
                <div class="muted" style="font-size:var(--fs-small)">{{ $t('drawer.signInSub') }}</div>
            </div>
            <Icon name="chevronR" />
        </div>

        <!-- Simulated trading entry -->
        <button class="drawer__simbtn" @click="enterSim()">
            <span style="display:flex; align-items:center; gap:10px">
                <Icon name="trade" :size="18" />
                <span><b>{{ $t('drawer.simTitle') }}</b><span style="display:block; font-size:var(--fs-caption); opacity:.85">{{ $t('drawer.simSub') }}</span></span>
            </span>
            <Icon name="chevronR" :size="18" />
        </button>

        <!-- Menu groups -->
        <div v-for="g in groups" :key="g.title" class="drawer__section">
            <div class="eyebrow" style="margin-bottom:10px">{{ $t(g.title) }}</div>
            <div class="drawer__grid">
                <button v-for="c in g.cells" :key="c.tkey" class="drawer__cell"
                        @click="c.path ? nav(c.path) : c.action && c.action()">
                    <Icon :name="c.icon" />
                    <span>{{ $t(c.tkey) }}</span>
                </button>
            </div>
        </div>

        <div class="drawer__section" v-if="store.isAuthed">
            <button class="btn btn--ghost btn--block" style="justify-content:flex-start; gap:12px; color:var(--down)"
                    @click="doLogout">
                <Icon name="logout" /> {{ $t('common.logout') }}
            </button>
        </div>
    </div>`,
};
