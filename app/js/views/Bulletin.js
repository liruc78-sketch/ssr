// Bulletin — platform announcements
import { ref } from 'vue';
import { Icon } from '../icons.js';

export default {
    name: 'Bulletin',
    components: { Icon },
    setup() {
        const open = ref(0);
        const items = [
            { tag: 'Listing', date: '2026-10-04', title: 'SOL/USDT perpetual now live with up to 75× leverage', body: 'Solana perpetuals are now available on Crypto.ssr with isolated and cross margin, funding every 8 hours, and a 75× maximum leverage for verified accounts.' },
            { tag: 'System', date: '2026-10-02', title: 'Scheduled maintenance — matching engine upgrade', body: 'We will perform a brief upgrade to the matching engine on Oct 8, 02:00–02:30 UTC. Spot and contract trading may pause for up to 10 minutes. Funds are unaffected.' },
            { tag: 'Finance', date: '2026-09-29', title: 'New AI-Quant 30-day strategy opens for subscription', body: 'Quant Pro, our 30-day neural strategy, is open with a projected daily range of 0.35%–0.63%. Subscription limits apply; see the Finance tab.' },
            { tag: 'Security', date: '2026-09-25', title: 'Enable 2FA to unlock higher withdrawal limits', body: 'Accounts with two-factor authentication and completed KYC now qualify for raised daily withdrawal limits. Manage this in Security Center.' },
        ];
        return { open, items };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><h1 class="page-title">Bulletin</h1></div>
        <div class="card faq">
            <div v-for="(it, i) in items" :key="i" class="faq__item" :class="{ 'is-open': open === i }">
                <button class="faq__q" @click="open = open === i ? -1 : i" style="align-items:flex-start">
                    <span style="text-align:left">
                        <span class="chip chip--brand" style="margin-bottom:6px">{{ it.tag }}</span>
                        <span style="display:block">{{ it.title }}</span>
                        <span class="muted" style="font-size:var(--fs-caption); font-weight:400">{{ it.date }}</span>
                    </span>
                    <Icon name="chevronD" :size="18" class="faq__chev" />
                </button>
                <div class="faq__a" v-show="open === i"><p class="muted">{{ it.body }}</p></div>
            </div>
        </div>
    </section>`,
};
