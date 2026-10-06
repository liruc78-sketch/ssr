// ============================================================================
// Crypto.ssr — App bootstrap. Assembles the responsive shell + routed view.
// ============================================================================
import { createApp } from 'vue';
import { router, startRouter } from './router.js';
import { store, closeDrawer } from './store.js';
import { restoreSession, refreshPortfolio } from './auth.js';
import { sweepPositions } from './trade.js';

import TopNav from './components/TopNav.js';
import TopBar from './components/TopBar.js';
import BottomNav from './components/BottomNav.js';
import Drawer from './components/Drawer.js';
import { ChatButton, Toast, Placeholder } from './components/common.js';

const App = {
    name: 'App',
    components: { TopNav, TopBar, BottomNav, Drawer, ChatButton, Toast, Placeholder },
    setup() {
        return { router, store, closeDrawer };
    },
    template: /*html*/`
    <TopNav />
    <TopBar />

    <main class="app-main">
        <div v-if="router.loading" style="display:grid; place-items:center; min-height:40vh"><span class="spinner"></span></div>
        <Placeholder v-else-if="router.stub" :title="router.label" />
        <Placeholder v-else-if="router.notFound" title="Page not found" />
        <transition v-else name="route-fade" mode="out-in">
            <component :is="router.component" :key="router.key" />
        </transition>
    </main>

    <BottomNav />
    <ChatButton />
    <Toast />

    <transition name="scrim">
        <div v-if="store.drawerOpen" class="drawer-scrim" @click="closeDrawer()"></div>
    </transition>
    <transition name="drawer">
        <Drawer v-if="store.drawerOpen" />
    </transition>`,
};

createApp(App).mount('#app');
startRouter();

// Restore a shared session (if any) and keep balances fresh.
restoreSession();
setInterval(refreshPortfolio, 8000);

// Settle expired positions (missed timers): periodic + on load + on tab focus.
setInterval(sweepPositions, 15000);
sweepPositions();
document.addEventListener('visibilitychange', () => { if (!document.hidden) sweepPositions(); });
