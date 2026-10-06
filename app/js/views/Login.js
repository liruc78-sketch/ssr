// Sign in / Register — email/phone + password, wallet login (demo session)
import { ref } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { login, toast } from '../store.js';

export default {
    name: 'Login',
    components: { Icon },
    setup() {
        const method = ref('email');       // email | phone
        const handle = ref('');
        const password = ref('');
        const showPw = ref(false);
        const register = ref(false);

        // Demo session. Real auth (Supabase / edge function) is wired in the backend phase.
        const makeSession = (via) => ({
            uid: String(700000 + Math.floor(Math.random() * 99999)),
            handle: handle.value || (via === 'wallet' ? '0x' + Math.random().toString(16).slice(2, 10) : 'user'),
            via,
            creditScore: 100,
            verified: false,
            usdBalance: 0, spotBalance: 0, tradingBalance: 0, financeBalance: 0,
        });
        const submit = () => {
            if (!handle.value) { toast('Enter your ' + (method.value === 'email' ? 'email' : 'phone'), 'error'); return; }
            if (!register.value && !password.value) { toast('Enter your password', 'error'); return; }
            login(makeSession(method.value));
            toast(register.value ? 'Account created (demo)' : 'Signed in (demo)', 'success');
            go('/');
        };
        const walletLogin = () => { login(makeSession('wallet')); toast('Wallet connected (demo)', 'success'); go('/'); };
        const forgot = () => toast('Password reset — coming with backend auth', 'info');

        return { method, handle, password, showPw, register, submit, walletLogin, forgot, go };
    },
    template: /*html*/`
    <section class="auth">
        <h1 class="auth__title">{{ register ? 'Create account' : 'Sign in' }}</h1>

        <div class="auth__methods">
            <button class="auth__m" :class="{ 'is-on': method === 'email' }" @click="method = 'email'">Email</button>
            <button class="auth__m" :class="{ 'is-on': method === 'phone' }" @click="method = 'phone'">Phone Number</button>
        </div>

        <label class="paystep">
            <span class="eyebrow">{{ method === 'email' ? 'Email' : 'Phone number' }}</span>
            <input class="field" v-model="handle" :type="method === 'email' ? 'email' : 'tel'" :placeholder="method === 'email' ? 'you@example.com' : '+1 555 0100'" autocomplete="username" />
        </label>

        <label class="paystep">
            <span class="eyebrow">{{ register ? 'Set a password' : 'Login password' }}</span>
            <div class="field" style="display:flex; align-items:center; gap:8px">
                <input :type="showPw ? 'text' : 'password'" v-model="password" placeholder="Enter your password" autocomplete="current-password" style="flex:1; background:none; border:none; outline:none; color:var(--text)" />
                <button class="pw-eye" @click="showPw = !showPw" type="button" :aria-label="showPw ? 'Hide' : 'Show'"><Icon :name="showPw ? 'user' : 'search'" :size="18" /></button>
            </div>
        </label>

        <div v-if="!register" style="text-align:right"><a class="auth__link" @click="forgot">Forgot password?</a></div>

        <p class="auth__legal">By continuing you agree to our <a>Terms of Service</a>, <a>Privacy Policy</a> and <a>AML Agreement</a>.</p>

        <button class="btn btn--dark btn--block btn--lg" @click="submit">{{ register ? 'Create account' : 'Login' }}</button>

        <p class="auth__switch">
            {{ register ? 'Already have an account?' : 'No account?' }}
            <a class="auth__link" @click="register = !register">{{ register ? 'Sign in' : 'Register' }}</a>
        </p>

        <div class="auth__or"><span>or</span></div>
        <button class="btn btn--ghost btn--block btn--lg" style="border:1px solid var(--border)" @click="walletLogin"><Icon name="assets" :size="20" /> Wallet login</button>
    </section>`,
};
