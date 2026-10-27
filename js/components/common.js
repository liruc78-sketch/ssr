// Small shared shell components: ChatButton, SupportSheet, Toast, Placeholder
import { ref } from 'vue';
import { Icon } from '../icons.js';
import { store } from '../store.js';
import { support, openSupport, closeSupport, sendMessage, MAX_MESSAGE } from '../support.js';
import { refreshPortfolio } from '../auth.js';

export const ChatButton = {
    name: 'ChatButton',
    components: { Icon },
    setup() {
        // Open to visitors who aren't signed in too (they chat as guests).
        const onClick = () => openSupport();
        return { onClick, support };
    },
    template: /*html*/`
    <button class="chatfab" @click="onClick" :aria-label="$t('support.cta')">
        <Icon name="chat" :size="28" />
        <span v-if="support.unread > 0" class="chatfab__badge">{{ support.unread > 9 ? '9+' : support.unread }}</span>
    </button>`,
};

export const SupportSheet = {
    name: 'SupportSheet',
    components: { Icon },
    setup() {
        const bodyRef = ref(null);
        const setBody = (el) => { support.bodyEl = el; };
        const time = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const onEnter = (e) => { if (!e.shiftKey) { e.preventDefault(); sendMessage(); } };
        return { store, support, closeSupport, sendMessage, time, setBody, MAX_MESSAGE };
    },
    template: /*html*/`
    <div>
        <transition name="scrim"><div v-if="support.open" class="drawer-scrim" @click="closeSupport()"></div></transition>
        <transition name="sheet">
            <div v-if="support.open" class="chat">
                <div class="chat__head">
                    <span style="display:flex; align-items:center; gap:10px">
                        <span class="chat__avatar"><Icon name="chat" :size="18" /></span>
                        <span><b>{{ $t('support.title') }}</b><span class="muted" style="display:block; font-size:var(--fs-caption)">{{ $t('support.subtitle') }}</span></span>
                    </span>
                    <button class="iconbtn" @click="closeSupport()" :aria-label="$t('common.close')"><Icon name="close" /></button>
                </div>
                <p v-if="!store.isAuthed" class="chat__guest">{{ $t('support.guestNote') }}</p>
                <div class="chat__body" :ref="setBody">
                    <div v-if="support.loading" style="display:grid; place-items:center; padding:var(--sp-6)"><span class="spinner"></span></div>
                    <div v-else-if="!support.messages.length" class="chat__empty">
                        <Icon name="chat" :size="40" class="muted" />
                        <p class="muted">{{ $t('support.empty') }}</p>
                    </div>
                    <div v-for="m in support.messages" :key="m.id" class="chat__msg" :class="m.sender === 'user' ? 'is-me' : 'is-them'">
                        <div class="chat__bubble">{{ m.content }}</div>
                        <div class="chat__time muted">{{ time(m.created_at) }}</div>
                    </div>
                </div>
                <div class="chat__input">
                    <input v-model="support.input" :maxlength="MAX_MESSAGE" :placeholder="$t('support.inputPlaceholder')" @keyup.enter="sendMessage()" />
                    <button class="btn btn--brand btn--sm" :disabled="support.sending || !support.input.trim()" @click="sendMessage()">
                        <span v-if="support.sending" class="spinner" style="border-top-color:#fff"></span>
                        <template v-else>{{ $t('common.send') }}</template>
                    </button>
                </div>
            </div>
        </transition>
    </div>`,
};

// Why a signed-in balance reads "—": still loading, or the last fetch failed (with
// a retry). Renders nothing once the balance is known.
export const BalanceStatus = {
    name: 'BalanceStatus',
    components: { Icon },
    setup() {
        const retrying = ref(false);
        const retry = async () => {
            retrying.value = true;
            try { await refreshPortfolio(); } finally { retrying.value = false; }
        };
        return { store, retrying, retry };
    },
    template: /*html*/`
    <p v-if="store.balanceUnknown" class="balstate" role="status">
        <template v-if="retrying || !store.connectionLost"><span class="spinner balstate__spin"></span>{{ $t('common.balanceLoading') }}</template>
        <template v-else>
            <Icon name="info" :size="15" class="balstate__ico" />
            <span>{{ $t('common.balanceFailed') }}</span>
            <button type="button" class="balstate__retry" @click="retry">{{ $t('common.retry') }}</button>
        </template>
    </p>`,
};

export const Toast = {
    name: 'Toast',
    setup() { return { store }; },
    template: /*html*/`
    <transition name="scrim">
        <div v-if="store.toast.show" class="toast" :class="'toast--' + store.toast.type" role="status">{{ store.toast.msg }}</div>
    </transition>`,
};

// Titled placeholder for routes not yet built (keeps navigation whole in early phases)
export const Placeholder = {
    name: 'Placeholder',
    components: { Icon },
    props: { title: { type: String, default: '' } },
    template: /*html*/`
    <section>
        <div class="page-head"><h1 class="page-title">{{ title }}</h1></div>
        <div class="placeholder">
            <Icon name="info" class="placeholder__icon" :size="56" />
            <h3>{{ $t('placeholder.roadmap', { title }) }}</h3>
            <p class="muted" style="max-width:34ch">{{ $t('placeholder.body') }}</p>
        </div>
    </section>`,
};
