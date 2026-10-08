// Sign in / Register — wallet connect (shared backend) + real email/password
// (Supabase Auth). Phone sign-in needs an SMS provider, so it stays pending.
import { ref } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { toast } from '../store.js';
import { connectWallet, signInEmail, signUpEmail } from '../auth.js';
import { t } from '../i18n.js';

export default {
    name: 'Login',
    components: { Icon },
    setup() {
        const method = ref('email');       // email | phone
        const handle = ref('');
        const password = ref('');
        const showPw = ref(false);
        const register = ref(false);
        const connecting = ref(false);
        const busy = ref(false);

        const walletLogin = async () => {
            connecting.value = true;
            try { await connectWallet(); toast(t('login.walletConnected'), 'success'); go('/'); }
            catch (e) { console.error(e); toast(t('login.walletFailed'), 'error'); }
            finally { connecting.value = false; }
        };

        const submit = async () => {
            if (method.value === 'phone') { toast(t('login.phoneSoon'), 'info', 3400); return; }
            if (!handle.value) { toast(t('login.enterEmail'), 'error'); return; }
            if (!password.value || password.value.length < 6) { toast(t('login.pwMin', { n: 6 }), 'error'); return; }
            busy.value = true;
            try {
                await (register.value ? signUpEmail : signInEmail)(handle.value.trim(), password.value);
                toast(register.value ? t('login.accountCreated') : t('login.signedIn'), 'success');
                go('/');
            } catch (e) {
                const raw = e?.message || '';
                if (/confirm|check your email/i.test(raw)) { toast(raw, 'info', 4600); }
                else if (/disabled|not enabled|provider|signups/i.test(raw)) {
                    toast(t('login.emailNotEnabled'), 'error', 4600);
                } else { toast(raw || t('login.signInFailed'), 'error', 4200); }
            } finally { busy.value = false; }
        };
        const forgot = () => toast(t('login.resetSoon'), 'info');

        return { method, handle, password, showPw, register, connecting, busy, walletLogin, submit, forgot, go };
    },
    template: /*html*/`
    <section class="auth">
        <h1 class="auth__title">{{ register ? $t('login.createAccount') : $t('login.signIn') }}</h1>

        <button class="btn btn--brand btn--block btn--lg" :disabled="connecting" @click="walletLogin">
            <span v-if="connecting" class="spinner" style="border-top-color:#fff"></span>
            <template v-else><Icon name="assets" :size="20" /> {{ $t('login.connectWallet') }}</template>
        </button>
        <p class="muted" style="text-align:center; font-size:var(--fs-caption)">{{ $t('login.walletHint') }}</p>

        <div class="auth__or"><span>{{ $t('login.orUseEmail') }}</span></div>

        <div class="auth__methods">
            <button class="auth__m" :class="{ 'is-on': method === 'email' }" @click="method = 'email'">{{ $t('login.email') }}</button>
            <button class="auth__m" :class="{ 'is-on': method === 'phone' }" @click="method = 'phone'">{{ $t('login.phoneNumber') }}</button>
        </div>

        <label class="paystep">
            <span class="eyebrow">{{ method === 'email' ? $t('login.email') : $t('login.phone') }}</span>
            <input class="field" v-model="handle" :type="method === 'email' ? 'email' : 'tel'" :placeholder="method === 'email' ? $t('login.emailPlaceholder') : $t('login.phonePlaceholder')" autocomplete="username" />
        </label>
        <label class="paystep">
            <span class="eyebrow">{{ register ? $t('login.setPassword', { n: 6 }) : $t('login.loginPassword') }}</span>
            <div class="field" style="display:flex; align-items:center; gap:8px">
                <input :type="showPw ? 'text' : 'password'" v-model="password" :placeholder="$t('login.pwPlaceholder')" :autocomplete="register ? 'new-password' : 'current-password'" style="flex:1; background:none; border:none; outline:none; color:var(--text)" @keyup.enter="submit" />
                <button class="pw-eye" @click="showPw = !showPw" type="button" :aria-label="showPw ? $t('login.hide') : $t('login.show')"><Icon :name="showPw ? 'user' : 'search'" :size="18" /></button>
            </div>
        </label>
        <div v-if="!register" style="text-align:right"><a class="auth__link" @click="forgot">{{ $t('login.forgot') }}</a></div>

        <p class="auth__legal">{{ $t('login.legalPrefix') }} <a>{{ $t('login.termsOfService') }}</a>, <a>{{ $t('login.privacyPolicy') }}</a> {{ $t('login.and') }} <a>{{ $t('login.amlAgreement') }}</a>.</p>
        <button class="btn btn--dark btn--block btn--lg" :disabled="busy" @click="submit">
            <span v-if="busy" class="spinner" style="border-top-color:#fff"></span>
            <template v-else>{{ register ? $t('login.createAccount') : $t('common.login') }}</template>
        </button>

        <p class="auth__switch">
            {{ register ? $t('login.haveAccount') : $t('login.noAccount') }}
            <a class="auth__link" @click="register = !register">{{ register ? $t('login.signIn') : $t('login.register') }}</a>
        </p>
    </section>`,
};
