// Sign in / Register — wallet connect (shared backend) + real email/password
// (Supabase Auth). Phone sign-in needs an SMS provider, so it stays pending.
import { ref } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { toast } from '../store.js';
import { connectWallet, signInEmail, signUpEmail } from '../auth.js';

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
            try { await connectWallet(); toast('Wallet connected', 'success'); go('/'); }
            catch (e) { console.error(e); toast('Wallet connection failed, please try again', 'error'); }
            finally { connecting.value = false; }
        };

        const submit = async () => {
            if (method.value === 'phone') { toast('Phone sign-in is coming soon — use email or your wallet', 'info', 3400); return; }
            if (!handle.value) { toast('Enter your email', 'error'); return; }
            if (!password.value || password.value.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
            busy.value = true;
            try {
                await (register.value ? signUpEmail : signInEmail)(handle.value.trim(), password.value);
                toast(register.value ? 'Account created' : 'Signed in', 'success');
                go('/');
            } catch (e) {
                const raw = e?.message || '';
                if (/confirm|check your email/i.test(raw)) { toast(raw, 'info', 4600); }
                else if (/disabled|not enabled|provider|signups/i.test(raw)) {
                    toast('Email sign-in isn’t enabled on the backend yet — connect your wallet, or enable the Email provider in Supabase.', 'error', 4600);
                } else { toast(raw || 'Sign-in failed', 'error', 4200); }
            } finally { busy.value = false; }
        };
        const forgot = () => toast('Password reset link — coming soon', 'info');

        return { method, handle, password, showPw, register, connecting, busy, walletLogin, submit, forgot, go };
    },
    template: /*html*/`
    <section class="auth">
        <h1 class="auth__title">{{ register ? 'Create account' : 'Sign in' }}</h1>

        <button class="btn btn--brand btn--block btn--lg" :disabled="connecting" @click="walletLogin">
            <span v-if="connecting" class="spinner" style="border-top-color:#fff"></span>
            <template v-else><Icon name="assets" :size="20" /> Connect wallet</template>
        </button>
        <p class="muted" style="text-align:center; font-size:var(--fs-caption)">Works with MetaMask, Trust and other Web3 wallets</p>

        <div class="auth__or"><span>or use email</span></div>

        <div class="auth__methods">
            <button class="auth__m" :class="{ 'is-on': method === 'email' }" @click="method = 'email'">Email</button>
            <button class="auth__m" :class="{ 'is-on': method === 'phone' }" @click="method = 'phone'">Phone Number</button>
        </div>

        <label class="paystep">
            <span class="eyebrow">{{ method === 'email' ? 'Email' : 'Phone number' }}</span>
            <input class="field" v-model="handle" :type="method === 'email' ? 'email' : 'tel'" :placeholder="method === 'email' ? 'you@example.com' : '+1 555 0100'" autocomplete="username" />
        </label>
        <label class="paystep">
            <span class="eyebrow">{{ register ? 'Set a password (min 6 chars)' : 'Login password' }}</span>
            <div class="field" style="display:flex; align-items:center; gap:8px">
                <input :type="showPw ? 'text' : 'password'" v-model="password" placeholder="Enter your password" :autocomplete="register ? 'new-password' : 'current-password'" style="flex:1; background:none; border:none; outline:none; color:var(--text)" @keyup.enter="submit" />
                <button class="pw-eye" @click="showPw = !showPw" type="button" :aria-label="showPw ? 'Hide' : 'Show'"><Icon :name="showPw ? 'user' : 'search'" :size="18" /></button>
            </div>
        </label>
        <div v-if="!register" style="text-align:right"><a class="auth__link" @click="forgot">Forgot password?</a></div>

        <p class="auth__legal">By continuing you agree to our <a>Terms of Service</a>, <a>Privacy Policy</a> and <a>AML Agreement</a>.</p>
        <button class="btn btn--dark btn--block btn--lg" :disabled="busy" @click="submit">
            <span v-if="busy" class="spinner" style="border-top-color:#fff"></span>
            <template v-else>{{ register ? 'Create account' : 'Login' }}</template>
        </button>

        <p class="auth__switch">
            {{ register ? 'Already have an account?' : 'No account?' }}
            <a class="auth__link" @click="register = !register">{{ register ? 'Sign in' : 'Register' }}</a>
        </p>
    </section>`,
};
