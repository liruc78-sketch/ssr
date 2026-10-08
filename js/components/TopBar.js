// Mobile top bar (<1024px) — brand · notifications · hamburger
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { openDrawer } from '../store.js';
import { notif, openNotifications } from '../notifications.js';

export default {
    name: 'TopBar',
    components: { Icon },
    setup() { return { go, openDrawer, notif, openNotifications }; },
    template: /*html*/`
    <header class="topbar">
        <a class="brand" href="#/" @click.prevent="go('/')">
            <img class="brand__logo" src="crypto-ssr-icon.svg" alt="" width="30" height="30" draggable="false" />
            <span class="brand__name">Crypto<b>.ssr</b></span>
        </a>
        <div class="topbar__actions">
            <button class="iconbtn" @click="openNotifications()" :aria-label="$t('common.notifications')">
                <Icon name="bell" /><span v-if="notif.unread > 0" class="iconbtn__badge">{{ notif.unread > 99 ? '99+' : notif.unread }}</span>
            </button>
            <button class="iconbtn" @click="openDrawer()" :aria-label="$t('common.menu')"><Icon name="menu" /></button>
        </div>
    </header>`,
};
