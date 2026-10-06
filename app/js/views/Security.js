// Security Center — account security settings hub
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';

export default {
    name: 'Security',
    components: { Icon },
    setup() {
        const soon = (what) => toast(what + ' — coming with backend auth', 'info');
        const items = [
            { icon: 'user', label: 'Identity (KYC)', status: store.session?.verified ? 'Verified' : 'Not verified', ok: !!store.session?.verified, action: () => go('/kyc') },
            { icon: 'shield', label: 'Login password', status: 'Set', ok: true, action: () => soon('Change password') },
            { icon: 'shield', label: 'Fund password', status: 'Not set', ok: false, action: () => soon('Fund password') },
            { icon: 'shield', label: 'Two-factor (2FA)', status: 'Off', ok: false, action: () => soon('2FA') },
            { icon: 'bell', label: 'Phone', status: store.session?.via === 'phone' ? 'Bound' : 'Not bound', ok: store.session?.via === 'phone', action: () => soon('Bind phone') },
            { icon: 'doc', label: 'Email', status: store.session?.via === 'email' ? 'Bound' : 'Not bound', ok: store.session?.via === 'email', action: () => soon('Bind email') },
            { icon: 'shield', label: 'Anti-phishing code', status: 'Not set', ok: false, action: () => soon('Anti-phishing code') },
            { icon: 'assets', label: 'Device management', status: '1 device', ok: true, action: () => soon('Device management') },
        ];
        return { items, store, go };
    },
    template: /*html*/`
    <section class="sec">
        <div class="page-head"><h1 class="page-title">Security Center</h1></div>

        <div v-if="store.isAuthed" class="card sec__acct">
            <div class="drawer__avatar">{{ (store.session?.handle || 'U').slice(0,1).toUpperCase() }}</div>
            <div style="flex:1; min-width:0">
                <div style="display:flex; align-items:center; gap:8px"><b>{{ store.session?.handle }}</b><span class="chip" :class="store.session?.verified ? 'chip--up' : ''">{{ store.session?.verified ? 'Verified' : 'Not Verified' }}</span></div>
                <div class="muted" style="font-size:var(--fs-small)">UID {{ store.session?.uid }} · Credit <b class="up">{{ store.session?.creditScore ?? 100 }}</b></div>
            </div>
        </div>
        <div v-else class="card">
            <div class="placeholder" style="border:0; padding:var(--sp-8)"><Icon name="shield" class="placeholder__icon" :size="40" /><p class="muted">Log in to manage your account security.</p><button class="btn btn--brand btn--sm btn--pill" @click="go('/login')">Log in</button></div>
        </div>

        <div class="card sec__list">
            <button v-for="it in items" :key="it.label" class="sec__row" @click="it.action">
                <span class="sec__ico"><Icon :name="it.icon" :size="20" /></span>
                <span class="sec__label">{{ it.label }}</span>
                <span class="sec__status" :class="it.ok ? 'up' : 'muted'">{{ it.status }}</span>
                <Icon name="chevronR" :size="18" class="muted" />
            </button>
        </div>
    </section>`,
};
