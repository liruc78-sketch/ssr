// Bulletin — platform announcements
import { ref } from 'vue';
import { Icon } from '../icons.js';

export default {
    name: 'Bulletin',
    components: { Icon },
    setup() {
        const open = ref(0);
        const items = [
            { tagKey: 'bulletin.tagListing', date: '2026-10-04', titleKey: 'bulletin.item1Title', bodyKey: 'bulletin.item1Body' },
            { tagKey: 'bulletin.tagSystem', date: '2026-10-02', titleKey: 'bulletin.item2Title', bodyKey: 'bulletin.item2Body' },
            { tagKey: 'bulletin.tagFinance', date: '2026-09-29', titleKey: 'bulletin.item3Title', bodyKey: 'bulletin.item3Body' },
            { tagKey: 'bulletin.tagSecurity', date: '2026-09-25', titleKey: 'bulletin.item4Title', bodyKey: 'bulletin.item4Body' },
        ];
        return { open, items };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><h1 class="page-title">{{ $t('bulletin.title') }}</h1></div>
        <div class="card faq">
            <div v-for="(it, i) in items" :key="i" class="faq__item" :class="{ 'is-open': open === i }">
                <button class="faq__q" @click="open = open === i ? -1 : i" style="align-items:flex-start">
                    <span style="text-align:left">
                        <span class="chip chip--brand" style="margin-bottom:6px">{{ $t(it.tagKey) }}</span>
                        <span style="display:block">{{ $t(it.titleKey) }}</span>
                        <span class="muted" style="font-size:var(--fs-caption); font-weight:400">{{ it.date }}</span>
                    </span>
                    <Icon name="chevronD" :size="18" class="faq__chev" />
                </button>
                <div class="faq__a" v-show="open === i"><p class="muted">{{ $t(it.bodyKey) }}</p></div>
            </div>
        </div>
    </section>`,
};
