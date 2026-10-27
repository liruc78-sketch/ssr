// Sign in / Register — wallet connect (shared backend) + real email/password and
// phone/password (Supabase Auth). A phone number is typed in international form
// (+ country code) and works like an email login; see auth.js normalizePhone.
import { ref, computed, watch, nextTick } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { connectWallet, signInEmail, signUpEmail, signInPhone, signUpPhone, normalizePhone, previewPhone, loadPhoneLib, looksLikePhone, foldDigits } from '../auth.js';
import { support, openSupport, offerGuestChat } from '../support.js';
import { t, locale } from '../i18n.js';

const METHOD_KEY = 'loginMethod';     // the tab this browser last signed in with
// Login emails of phone and wallet accounts; nobody signs up with these by hand.
const RESERVED_DOMAIN = /@(phone|wallet)\.cryptossr\.local$/i;

// Phone numbers are guessable logins, so a phone account's password must be harder
// to guess than email sign-up's 6-character minimum: 8+ characters with a letter
// and a digit, and no run of 6 digits from the number itself. Digits are compared
// folded to 0-9 (Persian, full-width); the password itself is sent as typed.
function phonePasswordOk(pw, e164) {
    const plain = foldDigits(pw);
    const digits = e164.slice(1);
    for (let i = 0; i + 6 <= digits.length; i++) if (plain.includes(digits.slice(i, i + 6))) return false;
    return pw.length >= 8 && /\p{L}/u.test(pw) && /\d/.test(plain);
}

export default {
    name: 'Login',
    components: { Icon },
    setup() {
        let lastMethod = null;
        try { lastMethod = localStorage.getItem(METHOD_KEY); } catch {}
        const method = ref(lastMethod === 'phone' ? 'phone' : 'email');   // email | phone
        const email = ref('');
        const phone = ref('');
        const password = ref('');
        const showPw = ref(false);
        const register = ref(false);
        const connecting = ref(false);
        const busy = ref(false);
        const walletStep = ref('');        // connect | sign | verify — what the wallet is waiting for
        const phoneLibReady = ref(false);

        // WalletLoginError.code -> message. Unmapped codes get a short tag instead
        // (code/step/detail), so a failure inside a wallet's in-app browser — which
        // has no console — can still be diagnosed from a screenshot.
        const WALLET_ERR = {
            no_provider: 'login.walletErrNoProvider', rejected: 'login.walletErrRejected',
            pending: 'login.walletErrPending', timeout: 'login.walletErrTimeout',
            chain: 'login.walletErrChain', expired: 'login.walletErrExpired',
            network: 'login.walletErrNetwork', verifier_down: 'login.walletErrVerifierDown',
        };
        const WALLET_STEP = { connect: 'login.walletStepConnect', sign: 'login.walletStepSign', verify: 'login.walletStepVerify' };

        const walletLogin = async () => {
            if (connecting.value) return;
            connecting.value = true;
            try {
                await connectWallet((step) => { walletStep.value = step; });
                toast(t('login.walletConnected'), 'success');
                go('/');
                offerGuestChat();      // a support chat from before signing in, if any
            } catch (e) {
                console.error('[wallet-login]', e?.code, e?.step, e?.detail, e?.cause || e);
                const key = WALLET_ERR[e?.code];
                const tag = [e?.code || 'error', e?.step, e?.detail].filter((v) => v != null && v !== '').join('/');
                toast(key ? t(key) : t('login.walletFailedCode', { code: tag }), e?.code === 'rejected' ? 'info' : 'error', key ? 4200 : 5200);
            } finally { connecting.value = false; walletStep.value = ''; }
        };

        // The phone-number library loads with the Phone tab, so it's ready by submit.
        watch(method, (m) => {
            if (m === 'phone') loadPhoneLib().then(() => { phoneLibReady.value = true; }, () => {});
        }, { immediate: true });

        // Shown under the phone field once the number is valid: the country and
        // number this signs in as, so a wrong country code is caught up front.
        const phonePreview = computed(() => {
            const p = phoneLibReady.value ? previewPhone(phone.value) : null;
            if (!p) return null;
            let region = '';
            try { region = p.country ? new Intl.DisplayNames([locale.value], { type: 'region' }).of(p.country) : ''; } catch {}
            return { region, formatted: p.formatted };
        });

        // normalizePhone error -> message. LRI/PDI keep the example number
        // left-to-right inside RTL text.
        const phoneError = (code) => code === 'country_code'
            ? t('login.phoneInvalid', { example: '\u2066' + t('login.phonePlaceholder') + '\u2069' })
            : t(code === 'empty' ? 'login.enterPhone' : 'login.phoneCheckNumber');

        // Supabase Auth / data error -> message key; null falls back to a coded
        // message. provision_failed and *_unconfirmed are auth.js's own codes.
        const authErrorKey = (e, byPhone) => {
            const code = String(e?.code || '');
            if (code === 'user_already_exists' || code === 'email_exists') return byPhone ? 'login.phoneTaken' : 'login.emailTaken';
            if (code === 'invalid_credentials') return byPhone ? 'login.badPhoneCredentials' : 'login.badEmailCredentials';
            if (code === 'weak_password') return 'login.pwWeak';
            // validation_failed covers both fields; only the message says which.
            if (code === 'validation_failed' && /password/i.test(String(e?.message || ''))) return 'login.pwTooLong';
            if (code === 'over_request_rate_limit') return 'login.tooManyAttempts';
            if (code === 'provision_failed') return 'login.finishSignIn';
            // Auth / data requests, and the phone library's CDN import (Chrome, Firefox, Safari wording).
            if (e?.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed|dynamically imported module|importing a module script failed/i.test(String(e?.message || ''))) return 'login.networkError';
            if (byPhone) {
                // Everything that needs a mailbox: a phone login has none.
                if (code === 'phone_unconfirmed' || code === 'email_not_confirmed' || code === 'over_email_send_rate_limit'
                    || code === 'signup_disabled' || code === 'email_provider_disabled' || code.startsWith('email_address_')) return 'login.phoneSignupUnavailable';
                return null;
            }
            if (code === 'email_unconfirmed' || code === 'email_not_confirmed') return 'login.checkEmail';
            if (code === 'signup_disabled' || code === 'email_provider_disabled') return 'login.emailNotEnabled';
            if (code === 'over_email_send_rate_limit') return 'login.tooManyAttempts';
            if (code === 'email_address_invalid' || (code === 'validation_failed' && /email/i.test(String(e?.message || '')))) return 'login.emailInvalid';
            return null;
        };

        const submit = async () => {
            if (busy.value) return;
            // A number typed on the Email tab, or an address on the Phone tab, goes to
            // the matching form — phone users often start on the Email tab. The field
            // they typed in is replaced, so keep focus in the form.
            const from = method.value;
            if (from === 'email' && looksLikePhone(email.value)) { phone.value = email.value; method.value = 'phone'; }
            else if (from === 'phone' && phone.value.includes('@')) { email.value = phone.value; method.value = 'email'; }
            const byPhone = method.value === 'phone';
            busy.value = true;
            try {
                if (method.value !== from) { await nextTick(); document.getElementById(byPhone ? 'auth-phone' : 'auth-email')?.focus(); }
                let id;
                if (byPhone) {
                    const p = await normalizePhone(phone.value, { strict: register.value });
                    if (p.error) { toast(phoneError(p.error), 'error', 4600); return; }
                    id = p.number;
                } else {
                    id = email.value.trim();
                    if (!id) { toast(t('login.enterEmail'), 'error'); return; }
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) || RESERVED_DOMAIN.test(id)) { toast(t('login.emailInvalid'), 'error'); return; }
                }
                const pw = password.value;
                // GoTrue caps passwords at 72 bytes (2–3 per letter outside A–Z). Sign-up
                // only: an existing password is whatever it is.
                if (register.value && new TextEncoder().encode(pw).length > 72) { toast(t('login.pwTooLong'), 'error', 4600); return; }
                if (byPhone && register.value) {
                    if (!phonePasswordOk(pw, id)) { toast(t('login.pwPhoneRule'), 'error', 5200); return; }
                } else if (!pw || pw.length < 6) { toast(t('login.pwMin', { n: 6 }), 'error'); return; }

                const run = byPhone ? (register.value ? signUpPhone : signInPhone) : (register.value ? signUpEmail : signInEmail);
                await run(id, pw);
                try { localStorage.setItem(METHOD_KEY, byPhone ? 'phone' : 'email'); } catch {}
                toast(register.value ? t('login.accountCreated') : t('login.signedIn'), 'success');
                go('/');
                offerGuestChat();      // a support chat from before signing in, if any
            } catch (e) {
                console.warn('[auth]', e?.code, e?.status, e?.cause || e);
                const key = authErrorKey(e, byPhone);
                if (e?.code === 'provision_failed') register.value = false;   // the account exists: signing in finishes it
                // The tag is for support screenshots; LRI/PDI keep '422/validation_failed' in order in RTL.
                const tag = [e?.status, e?.code || e?.name].filter((v) => v != null && v !== '').join('/') || 'error';
                const info = key === 'login.checkEmail' || key === 'login.finishSignIn';
                toast(key ? t(key) : t('login.authFailedCode', { code: '\u2066' + tag + '\u2069' }), info ? 'info' : 'error', key ? 4600 : 5200);
            } finally { busy.value = false; }
        };
        // Phone accounts have no mailbox and there's no SMS, so only support can reset
        // one: open the chat (it works signed out) with the request ready to send.
        const forgot = () => {
            if (method.value !== 'phone') { toast(t('login.resetSoon'), 'info'); return; }
            const p = previewPhone(phone.value);
            if (!support.input.trim()) support.input = p ? t('support.phoneResetDraftWith', { phone: p.formatted }) : t('support.phoneResetDraft');
            openSupport();
        };
        // Left over from the legacy site: name the wallet to reconnect, since another
        // wallet would sign in to a new, empty account. FSI/PDI keep it intact in RTL;
        // the word joiner stops a line break after the ellipsis.
        const reloginMsg = () => store.relogin?.wallet
            ? t('login.signInAgainWallet', { wallet: '\u2068' + store.relogin.wallet.replace('…', '…\u2060') + '\u2069' })
            : t('login.signInAgain');

        return { store, method, email, phone, password, showPw, register, connecting, busy, walletStep, WALLET_STEP, phonePreview, walletLogin, submit, forgot, reloginMsg, go };
    },
    template: /*html*/`
    <section class="auth">
        <h1 class="auth__title">{{ register ? $t('login.createAccount') : $t('login.signIn') }}</h1>
        <p v-if="store.relogin" class="auth__notice" role="status">{{ reloginMsg() }}</p>

        <button class="btn btn--brand btn--block btn--lg" :disabled="connecting" @click="walletLogin">
            <span v-if="connecting" class="spinner" style="border-top-color:#fff"></span>
            <template v-else><Icon name="assets" :size="20" /> {{ $t('login.connectWallet') }}</template>
        </button>
        <p class="muted" style="text-align:center; font-size:var(--fs-caption)" role="status" aria-live="polite">{{ connecting && WALLET_STEP[walletStep] ? $t(WALLET_STEP[walletStep]) : $t('login.walletHint') }}</p>

        <div class="auth__or"><span>{{ $t('login.orUseEmailPhone') }}</span></div>

        <form class="auth__form" novalidate @submit.prevent="submit">
            <div class="auth__methods">
                <button type="button" class="auth__m" :class="{ 'is-on': method === 'email' }" :aria-pressed="method === 'email'" @click="method = 'email'">{{ $t('login.email') }}</button>
                <button type="button" class="auth__m" :class="{ 'is-on': method === 'phone' }" :aria-pressed="method === 'phone'" @click="method = 'phone'">{{ $t('login.phoneNumber') }}</button>
            </div>

            <label v-if="method === 'email'" class="paystep">
                <span class="eyebrow">{{ $t('login.email') }}</span>
                <input id="auth-email" class="field" v-model="email" type="email" :placeholder="$t('login.emailPlaceholder')" autocomplete="username" />
            </label>
            <div v-else class="paystep">
                <label class="eyebrow" for="auth-phone">{{ $t('login.phone') }}</label>
                <input id="auth-phone" class="field" v-model="phone" type="tel" inputmode="tel" dir="ltr" :placeholder="$t('login.phonePlaceholder')" autocomplete="username" aria-describedby="auth-phone-hint" />
                <p id="auth-phone-hint" class="auth__hint">
                    <template v-if="phonePreview">{{ phonePreview.region }}<template v-if="phonePreview.region"> · </template><span dir="ltr">{{ phonePreview.formatted }}</span></template>
                    <template v-else>{{ $t('login.phoneHint') }}</template>
                </p>
            </div>
            <label class="paystep">
                <span class="eyebrow">{{ register ? $t('login.setPassword', { n: method === 'phone' ? 8 : 6 }) : $t('login.loginPassword') }}</span>
                <div class="field" style="display:flex; align-items:center; gap:8px">
                    <input :type="showPw ? 'text' : 'password'" v-model="password" :placeholder="$t('login.pwPlaceholder')" :autocomplete="register ? 'new-password' : 'current-password'" style="flex:1; background:none; border:none; outline:none; color:var(--text)" />
                    <button class="pw-eye" @click="showPw = !showPw" type="button" :aria-label="showPw ? $t('login.hide') : $t('login.show')"><Icon :name="showPw ? 'user' : 'search'" :size="18" /></button>
                </div>
            </label>
            <div v-if="!register" style="text-align:right"><button type="button" class="auth__link" @click="forgot">{{ $t('login.forgot') }}</button></div>

            <p class="auth__legal">{{ $t('login.legalPrefix') }} <a>{{ $t('login.termsOfService') }}</a>, <a>{{ $t('login.privacyPolicy') }}</a> {{ $t('login.and') }} <a>{{ $t('login.amlAgreement') }}</a>.</p>
            <button type="submit" class="btn btn--dark btn--block btn--lg" :disabled="busy">
                <span v-if="busy" class="spinner" style="border-top-color:#fff"></span>
                <template v-else>{{ register ? $t('login.createAccount') : $t('common.login') }}</template>
            </button>
        </form>

        <p class="auth__switch">
            {{ register ? $t('login.haveAccount') : $t('login.noAccount') }}
            <button type="button" class="auth__link" @click="register = !register">{{ register ? $t('login.signIn') : $t('login.register') }}</button>
        </p>
    </section>`,
};
