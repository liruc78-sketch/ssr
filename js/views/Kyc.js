// KYC — identity verification (country, document type, uploads)
import { ref } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { t } from '../i18n.js';

export default {
    name: 'Kyc',
    components: { Icon },
    setup() {
        const country = ref('United States');
        const docType = ref('passport');
        const docs = [
            { k: 'passport', tkey: 'kyc.docPassport' },
            { k: 'drivers', tkey: 'kyc.docDrivers' },
            { k: 'id', tkey: 'kyc.docId' },
        ];
        const uploaded = ref({ front: false, back: false });
        const pick = (side) => { uploaded.value = { ...uploaded.value, [side]: true }; toast(t('kyc.imageAttached'), 'success'); };
        const submit = () => {
            if (!store.isAuthed) { go('/login'); return; }
            if (!uploaded.value.front) { toast(t('kyc.uploadFront'), 'error'); return; }
            toast(t('kyc.submitted'), 'success'); go('/security');
        };
        const countries = [
            { v: 'United States', tkey: 'kyc.countryUS' },
            { v: 'United Kingdom', tkey: 'kyc.countryUK' },
            { v: 'Germany', tkey: 'kyc.countryDE' },
            { v: 'Japan', tkey: 'kyc.countryJP' },
            { v: 'Singapore', tkey: 'kyc.countrySG' },
            { v: 'Australia', tkey: 'kyc.countryAU' },
            { v: 'Canada', tkey: 'kyc.countryCA' },
            { v: 'France', tkey: 'kyc.countryFR' },
        ];
        return { country, countries, docType, docs, uploaded, pick, submit, go, store };
    },
    template: /*html*/`
    <section class="pay">
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/security')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">{{ $t('kyc.title') }}</h1></div>

        <div class="card pay__card">
            <label class="paystep"><span class="eyebrow">{{ $t('kyc.countryLabel') }}</span>
                <select class="field" v-model="country"><option v-for="c in countries" :key="c.v" :value="c.v">{{ $t(c.tkey) }}</option></select>
            </label>

            <div class="paystep"><span class="eyebrow">{{ $t('kyc.docType') }}</span>
                <div class="kyc__docs">
                    <button v-for="d in docs" :key="d.k" class="kyc__doc" :class="{ 'is-on': docType === d.k }" @click="docType = d.k">
                        <Icon name="doc" :size="18" /> {{ $t(d.tkey) }}
                        <span class="kyc__radio" :class="{ 'is-on': docType === d.k }"></span>
                    </button>
                </div>
            </div>

            <div class="paystep"><span class="eyebrow">{{ $t('kyc.uploadDoc') }}</span>
                <div class="kyc__uploads">
                    <button class="kyc__drop" :class="{ 'is-done': uploaded.front }" @click="pick('front')">
                        <Icon :name="uploaded.front ? 'shield' : 'plus'" :size="24" />
                        <span>{{ uploaded.front ? $t('kyc.frontAdded') : $t('kyc.frontSide') }}</span>
                    </button>
                    <button v-if="docType !== 'passport'" class="kyc__drop" :class="{ 'is-done': uploaded.back }" @click="pick('back')">
                        <Icon :name="uploaded.back ? 'shield' : 'plus'" :size="24" />
                        <span>{{ uploaded.back ? $t('kyc.backAdded') : $t('kyc.backSide') }}</span>
                    </button>
                </div>
            </div>

            <p class="note"><Icon name="info" :size="15" /> {{ $t('kyc.note') }}</p>
            <button class="btn btn--brand btn--block btn--lg" @click="submit">{{ store.isAuthed ? $t('kyc.submit') : $t('kyc.loginToVerify') }}</button>
        </div>
    </section>`,
};
