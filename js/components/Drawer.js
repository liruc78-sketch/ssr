// Side drawer — full menu, account card, Live/Simulated toggle
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, closeDrawer, toast, toggleTheme } from '../store.js';
import { disconnect } from '../auth.js';

export default {
    name: 'Drawer',
    components: { Icon },
    setup() {
        const nav = (path) => { closeDrawer(); go(path); };
        const groups = [
            { title: 'Commonly used', cells: [
                { icon: 'globe',    label: 'Language',       action: () => toast('Language switcher coming soon') },
                { icon: 'history',  label: 'Funding records', path: '/funding' },
                { icon: 'convert',  label: 'Convert',         path: '/convert' },
                { icon: 'trade',    label: 'C2C',             path: '/c2c' },
            ]},
            { title: 'Markets', cells: [
                { icon: 'market',   label: 'Crypto',          path: '/market' },
                { icon: 'us',       label: 'US stocks',       path: '/market?cat=us' },
                { icon: 'fx',       label: 'FX',              path: '/market?cat=fx' },
                { icon: 'options',  label: 'Options',         path: '/trade?mode=options' },
            ]},
            { title: 'Finance', cells: [
                { icon: 'finance',  label: 'Finance',         path: '/finance' },
            ]},
            { title: 'Other', cells: [
                { icon: 'bulletin', label: 'Bulletin',        path: '/bulletin' },
                { icon: 'doc',      label: 'News',            path: '/news' },
                { icon: 'live',     label: 'Live streaming',  path: '/live' },
                { icon: 'shield',   label: 'Security Center', path: '/security' },
                { icon: 'user',     label: 'KYC',             path: '/kyc' },
                { icon: 'academy',  label: 'Academy',         path: '/academy' },
            ]},
        ];
        const identity = () => store.session?.displayName || store.session?.username || store.session?.walletAddress || 'Account';
        const initials = () => identity().replace(/^0x/, '').trim().charAt(0).toUpperCase() || 'U';
        const subId = () => {
            const w = store.session?.walletAddress || '';
            if (w) return w.length > 10 ? w.slice(0, 6) + '…' + w.slice(-4) : w;
            return store.session?.email || store.session?.username || '';
        };
        const doLogout = () => { disconnect(); closeDrawer(); toast('Disconnected', 'info'); go('/'); };
        // Simulated-trading entry: open the dedicated sim wallet page.
        const enterSim = () => nav('/sim');
        return { store, nav, closeDrawer, groups, identity, initials, subId, toggleTheme, doLogout, enterSim };
    },
    template: /*html*/`
    <div class="drawer" role="dialog" aria-label="Menu">
        <div class="drawer__head">
            <span class="brand"><span class="brand__mark">C</span><span class="brand__name">Crypto<b>.ssr</b></span></span>
            <div style="display:flex; gap:4px">
                <button class="iconbtn" @click="toggleTheme()" :aria-label="store.theme === 'dark' ? 'Light mode' : 'Dark mode'">
                    <Icon :name="store.theme === 'dark' ? 'sun' : 'moon'" />
                </button>
                <button class="iconbtn" @click="closeDrawer()" aria-label="Close menu"><Icon name="close" /></button>
            </div>
        </div>

        <!-- Account card -->
        <div v-if="store.isAuthed" class="drawer__account">
            <div class="drawer__avatar">{{ initials() }}</div>
            <div style="flex:1; min-width:0">
                <div style="display:flex; align-items:center; gap:8px">
                    <strong style="font-size:var(--fs-h4); overflow:hidden; text-overflow:ellipsis; white-space:nowrap">{{ identity() }}</strong>
                    <span class="chip" :class="store.session?.verified ? 'chip--up' : ''">{{ store.session?.verified ? 'Verified' : 'Not Verified' }}</span>
                </div>
                <div class="drawer__uid">
                    <span class="num muted" style="font-size:var(--fs-small)">{{ subId() }}</span>
                    <span class="muted" style="font-size:var(--fs-small)">Credit <b class="up">{{ store.session?.creditScore ?? 100 }}</b></span>
                </div>
            </div>
            <button class="iconbtn" @click="nav('/security')" aria-label="Edit profile"><Icon name="chevronR" /></button>
        </div>
        <div v-else class="drawer__account" style="cursor:pointer" @click="nav('/login')">
            <div class="drawer__avatar"><Icon name="user" /></div>
            <div style="flex:1">
                <strong style="font-size:var(--fs-h4)">Sign in / Register</strong>
                <div class="muted" style="font-size:var(--fs-small)">Access trading, assets & finance</div>
            </div>
            <Icon name="chevronR" />
        </div>

        <!-- Simulated trading entry -->
        <button class="drawer__simbtn" @click="enterSim()">
            <span style="display:flex; align-items:center; gap:10px">
                <Icon name="trade" :size="18" />
                <span><b>Simulated Trading</b><span style="display:block; font-size:var(--fs-caption); opacity:.85">Practice with 1,000,000 USDT virtual funds</span></span>
            </span>
            <Icon name="chevronR" :size="18" />
        </button>

        <!-- Menu groups -->
        <div v-for="g in groups" :key="g.title" class="drawer__section">
            <div class="eyebrow" style="margin-bottom:10px">{{ g.title }}</div>
            <div class="drawer__grid">
                <button v-for="c in g.cells" :key="c.label" class="drawer__cell"
                        @click="c.path ? nav(c.path) : c.action && c.action()">
                    <Icon :name="c.icon" />
                    <span>{{ c.label }}</span>
                </button>
            </div>
        </div>

        <div class="drawer__section" v-if="store.isAuthed">
            <button class="btn btn--ghost btn--block" style="justify-content:flex-start; gap:12px; color:var(--down)"
                    @click="doLogout">
                <Icon name="logout" /> Log out
            </button>
        </div>
    </div>`,
};
