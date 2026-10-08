// ============================================================================
// Crypto.ssr — App bootstrap. Assembles the responsive shell + routed view.
// ============================================================================
import { createApp } from 'vue';
import { router, startRouter } from './router.js';
import { store, closeDrawer, closeLang } from './store.js';
import { restoreSession, refreshPortfolio } from './auth.js';
import { sweepPositions } from './trade.js';
import { t, initLocale } from './i18n.js';
import { notif, closeNotifications } from './notifications.js';

import TopNav from './components/TopNav.js';
import TopBar from './components/TopBar.js';
import BottomNav from './components/BottomNav.js';
import Drawer from './components/Drawer.js';
import LanguagePicker from './components/LanguagePicker.js';
import NotificationPanel from './components/NotificationPanel.js';
import { ChatButton, SupportSheet, Toast, Placeholder } from './components/common.js';

const App = {
    name: 'App',
    components: { TopNav, TopBar, BottomNav, Drawer, LanguagePicker, NotificationPanel, ChatButton, SupportSheet, Toast, Placeholder },
    setup() {
        return { router, store, closeDrawer, closeLang, notif, closeNotifications };
    },
    template: /*html*/`
    <TopNav />
    <TopBar />

    <main class="app-main">
        <div v-if="router.loading" style="display:grid; place-items:center; min-height:40vh"><span class="spinner"></span></div>
        <Placeholder v-else-if="router.stub" :title="router.label" />
        <Placeholder v-else-if="router.notFound" :title="$t('common.pageNotFound')" />
        <transition v-else name="route-fade" mode="out-in">
            <component :is="router.component" :key="router.key" />
        </transition>
    </main>

    <BottomNav />
    <ChatButton />
    <SupportSheet />
    <Toast />

    <transition name="scrim">
        <div v-if="store.drawerOpen" class="drawer-scrim" @click="closeDrawer()"></div>
    </transition>
    <transition name="drawer">
        <Drawer v-if="store.drawerOpen" />
    </transition>

    <transition name="scrim">
        <div v-if="store.langOpen" class="lang-scrim" @click="closeLang()"></div>
    </transition>
    <transition name="langpop">
        <LanguagePicker v-if="store.langOpen" />
    </transition>

    <transition name="scrim">
        <div v-if="notif.open" class="notif-scrim" @click="closeNotifications()"></div>
    </transition>
    <transition name="notifpop">
        <NotificationPanel v-if="notif.open" />
    </transition>`,
};

const app = createApp(App);
// $t is a reactive global: because t() reads the reactive locale ref, any
// template that renders {{ $t('key') }} re-renders the instant the language
// changes — no page reload, no per-component wiring.
app.config.globalProperties.$t = t;
initLocale();
app.mount('#app');
startRouter();

// Restore a shared session (if any) and keep balances fresh.
restoreSession();
setInterval(refreshPortfolio, 8000);

// Settle expired positions (missed timers): periodic + on load + on tab focus.
setInterval(sweepPositions, 15000);
sweepPositions();
document.addEventListener('visibilitychange', () => { if (!document.hidden) sweepPositions(); });
