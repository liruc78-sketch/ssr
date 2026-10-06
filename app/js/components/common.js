// Small shared shell components: ChatButton, Toast, Placeholder
import { Icon } from '../icons.js';
import { store, toast } from '../store.js';

export const ChatButton = {
    name: 'ChatButton',
    components: { Icon },
    setup() { return { open: () => toast('Live support — coming in a later phase', 'info') }; },
    template: /*html*/`<button class="chatfab" @click="open" aria-label="Customer support"><Icon name="chat" :size="28" /></button>`,
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
