// Notification center panel (the bell). Lists recent events — trade results,
// deposits, withdrawals, and future system messages — rendered in the active
// language. Opens from the bell in both the top bar and the desktop nav.
import { computed } from 'vue';
import { Icon } from '../icons.js';
import { store } from '../store.js';
import { go } from '../router.js';
import { notif, describe, relTime, closeNotifications, markAllRead } from '../notifications.js';

export default {
    name: 'NotificationPanel',
    components: { Icon },
    setup() {
        const rows = computed(() => notif.items.map((n) => ({
            id: n.id, is_read: n.is_read, time: relTime(n.created_at), ...describe(n),
        })));
        const toLogin = () => { closeNotifications(); go('/login'); };
        return { notif, rows, store, closeNotifications, markAllRead, toLogin };
    },
    template: /*html*/`
    <div class="notifpanel" role="dialog" aria-modal="true" :aria-label="$t('notif.title')">
        <div class="notifpanel__head">
            <h3>{{ $t('notif.title') }}</h3>
            <div style="display:flex; align-items:center; gap:4px">
                <button v-if="notif.unread > 0" class="btn btn--ghost btn--sm" @click="markAllRead()">{{ $t('notif.markAllRead') }}</button>
                <button class="iconbtn" @click="closeNotifications()" :aria-label="$t('common.close')"><Icon name="close" /></button>
            </div>
        </div>

        <div class="notifpanel__body">
            <div v-if="!store.isAuthed" class="notif-empty">
                <Icon name="bell" :size="40" class="muted" />
                <p class="muted">{{ $t('notif.loginPrompt') }}</p>
                <button class="btn btn--brand btn--sm btn--pill" @click="toLogin">{{ $t('common.login') }}</button>
            </div>
            <div v-else-if="notif.loading && !rows.length" style="display:grid; place-items:center; padding:var(--sp-8)"><span class="spinner"></span></div>
            <div v-else-if="!rows.length" class="notif-empty">
                <Icon name="bell" :size="40" class="muted" />
                <p class="muted">{{ $t('notif.empty') }}</p>
            </div>
            <ul v-else class="notif-list">
                <li v-for="r in rows" :key="r.id" class="notif-row" :class="{ 'is-unread': !r.is_read }">
                    <span class="notif-ic" :class="'notif-ic--' + r.tone"><Icon :name="r.icon" :size="18" /></span>
                    <div class="notif-row__main">
                        <div class="notif-row__top">
                            <span class="notif-row__title">{{ r.title }}</span>
                            <span class="notif-row__time muted">{{ r.time }}</span>
                        </div>
                        <div class="notif-row__body muted">{{ r.body }}</div>
                    </div>
                    <span v-if="!r.is_read" class="notif-row__dot" aria-hidden="true"></span>
                </li>
            </ul>
        </div>
    </div>`,
};
