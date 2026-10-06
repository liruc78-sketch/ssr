// Small shared shell components: ChatButton, SupportSheet, Toast, Placeholder
import { ref } from 'vue';
import { Icon } from '../icons.js';
import { store } from '../store.js';
import { go } from '../router.js';
import { support, openSupport, closeSupport, sendMessage } from '../support.js';

export const ChatButton = {
    name: 'ChatButton',
    components: { Icon },
    setup() {
        const onClick = () => { if (openSupport() === 'auth') go('/login'); };
        return { onClick, support };
    },
    template: /*html*/`
    <button class="chatfab" @click="onClick" aria-label="Customer support">
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
        return { support, closeSupport, sendMessage, time, setBody };
    },
    template: /*html*/`
    <div>
        <transition name="scrim"><div v-if="support.open" class="drawer-scrim" @click="closeSupport()"></div></transition>
        <transition name="sheet">
            <div v-if="support.open" class="chat">
                <div class="chat__head">
                    <span style="display:flex; align-items:center; gap:10px">
                        <span class="chat__avatar"><Icon name="chat" :size="18" /></span>
                        <span><b>Support</b><span class="muted" style="display:block; font-size:var(--fs-caption)">Typically replies within minutes</span></span>
                    </span>
                    <button class="iconbtn" @click="closeSupport()" aria-label="Close"><Icon name="close" /></button>
                </div>
                <div class="chat__body" :ref="setBody">
                    <div v-if="support.loading" style="display:grid; place-items:center; padding:var(--sp-6)"><span class="spinner"></span></div>
                    <div v-else-if="!support.messages.length" class="chat__empty">
                        <Icon name="chat" :size="40" class="muted" />
                        <p class="muted">Send us a message — we're here to help.</p>
                    </div>
                    <div v-for="m in support.messages" :key="m.id" class="chat__msg" :class="m.sender === 'user' ? 'is-me' : 'is-them'">
                        <div class="chat__bubble">{{ m.content }}</div>
                        <div class="chat__time muted">{{ time(m.created_at) }}</div>
                    </div>
                </div>
                <div class="chat__input">
                    <input v-model="support.input" placeholder="Type a message…" @keyup.enter="sendMessage()" />
                    <button class="btn btn--brand btn--sm" :disabled="support.sending || !support.input.trim()" @click="sendMessage()">
                        <span v-if="support.sending" class="spinner" style="border-top-color:#fff"></span>
                        <template v-else>Send</template>
                    </button>
                </div>
            </div>
        </transition>
    </div>`,
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
            <h3>“{{ title }}” is on the build roadmap</h3>
            <p class="muted" style="max-width:34ch">This screen is mapped in the audit and will be built in its phase. Navigation, theme and the shell are already live.</p>
        </div>
    </section>`,
};
