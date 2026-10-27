// Security Center — account security settings hub
import { computed } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { t } from '../i18n.js';

// Identity row by users.kyc_status (the KYC page shows the details).
const KYC_ROW = {
    none:     { statusKey: 'security.notVerified', ok: false },
    pending:  { statusKey: 'security.kycPending',  tone: 'gold' },
    approved: { statusKey: 'security.verified',    ok: true },
    rejected: { statusKey: 'security.kycRejected', tone: 'down' },
};

export default {
    name: 'Security',
    components: { Icon },
    setup() {
        const soon = (what) => toast(t('security.soonMsg', { what }), 'info');
        const verified = computed(() => store.session?.kycStatus === 'approved');
        // Computed: on a reload the session is restored after this view is set up.
        const items = computed(() => [
            { icon: 'user', tkey: 'security.identityKyc', action: () => go('/kyc'), ...(KYC_ROW[store.session?.kycStatus] || KYC_ROW.none) },
            { icon: 'shield', tkey: 'security.loginPassword', statusKey: 'security.set', ok: true, action: () => soon(t('security.changePassword')) },
            { icon: 'shield', tkey: 'security.fundPassword', statusKey: 'security.notSet', ok: false, action: () => soon(t('security.fundPassword')) },
            { icon: 'shield', tkey: 'security.twoFactor', statusKey: 'security.off', ok: false, action: () => soon(t('security.twoFactorShort')) },
            { icon: 'bell', tkey: 'security.phone', statusKey: store.session?.via === 'phone' ? 'security.bound' : 'security.notBound', ok: store.session?.via === 'phone', action: () => soon(t('security.bindPhone')) },
            { icon: 'doc', tkey: 'security.email', statusKey: store.session?.via === 'email' ? 'security.bound' : 'security.notBound', ok: store.session?.via === 'email', action: () => soon(t('security.bindEmail')) },
            { icon: 'shield', tkey: 'security.antiPhishing', statusKey: 'security.notSet', ok: false, action: () => soon(t('security.antiPhishing')) },
            { icon: 'assets', tkey: 'security.deviceManagement', statusKey: 'security.oneDevice', ok: true, action: () => soon(t('security.deviceManagement')) },
        ]);
        return { items, verified, store, go };
    },
    template: /*html*/`
    <section class="sec">
        <div class="page-head"><h1 class="page-title">{{ $t('security.title') }}</h1></div>

        <div v-if="store.isAuthed" class="card sec__acct">
            <div class="drawer__avatar">{{ (store.session?.handle || 'U').slice(0,1).toUpperCase() }}</div>
            <div style="flex:1; min-width:0">
                <div style="display:flex; align-items:center; gap:8px"><b>{{ store.session?.handle }}</b><span class="chip" :class="verified ? 'chip--up' : ''">{{ verified ? $t('security.verified') : $t('security.notVerified') }}</span></div>
                <div class="muted" style="font-size:var(--fs-small)">{{ $t('security.uid') }} {{ store.session?.uid }} · {{ $t('security.credit') }} <b class="up">{{ store.session?.creditScore ?? 100 }}</b></div>
            </div>
        </div>
        <div v-else class="card">
            <div class="placeholder" style="border:0; padding:var(--sp-8)"><Icon name="shield" class="placeholder__icon" :size="40" /><p class="muted">{{ $t('security.loginToManage') }}</p><button class="btn btn--brand btn--sm btn--pill" @click="go('/login')">{{ $t('common.login') }}</button></div>
        </div>

        <div class="card sec__list">
            <button v-for="it in items" :key="it.tkey" class="sec__row" @click="it.action">
                <span class="sec__ico"><Icon :name="it.icon" :size="20" /></span>
                <span class="sec__label">{{ $t(it.tkey) }}</span>
                <span class="sec__status" :class="it.tone || (it.ok ? 'up' : 'muted')">{{ $t(it.statusKey) }}</span>
                <Icon name="chevronR" :size="18" class="muted" />
            </button>
        </div>
    </section>`,
};
