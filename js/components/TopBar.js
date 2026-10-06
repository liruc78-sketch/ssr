// Mobile top bar (<1024px) — brand · notifications · hamburger
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { openDrawer } from '../store.js';

export default {
    name: 'TopBar',
    components: { Icon },
    setup() { return { go, openDrawer }; },
    template: /*html*/`
    <header class="topbar">
        <a class="brand" href="#/" @click.prevent="go('/')">
            <span class="brand__mark">C</span>
            <span class="brand__name">Crypto<b>.ssr</b></span>
        </a>
        <div class="topbar__actions">
            <button class="iconbtn" aria-label="Notifications"><Icon name="bell" /><span class="iconbtn__dot"></span></button>
            <button class="iconbtn" @click="openDrawer()" aria-label="Menu"><Icon name="menu" /></button>
        </div>
    </header>`,
};
