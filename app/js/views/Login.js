// Sign in / Register — wallet login is the real, working method (shared backend).
// Email/phone+password is shown for parity but has no backend yet (flagged).
import { ref } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { toast } from '../store.js';
import { connectWallet } from '../auth.js';

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

        // Email/phone+password isn't backed yet — the live backend is wallet-based.
        const submit = () => toast('Email & password sign-in is coming soon — connect your wallet below', 'info', 3600);
        const forgot = () => toast('Password reset arrives with email sign-in', 'info');

        const walletLogin = async () => {
            connecting.value = true;
            try { await connectWallet(); toast('Wallet connected', 'success'); go('/'); }
            catch (e) { console.error(e); toast('Wallet connection failed, please try again', 'error'); }
            finally { connecting.value = false; }
        };

        return { method, handle, password, showPw, register, connecting, submit, forgot, walletLogin, go };
    },
    template: /*html*/`
    <section class="auth">
        <h1 class="auth__title">{{ register ? 'Create account' : 'Sign in' }}</h1>

        <!-- Wallet: the working method -->
        <button class="btn btn--brand btn--block btn--lg" :disabled="connecting" @click="walletLogin">
            <span v-if="connecting" class="spinner" style="border-top-color:#fff"></span>
            <template v-else><Icon name="assets" :size="20" /> Connect wallet</template>
        </button>
        <p class="muted" style="text-align:center; font-size:var(--fs-caption)">Recommended · works with MetaMask, Trust and other Web3 wallets</p>

        <div class="auth__or"><span>or sign in with</span></div>

        <!-- Email/phone (parity; backend pending) -->
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
    </section>`,
};
