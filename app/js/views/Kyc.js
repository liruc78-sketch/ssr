// KYC — identity verification (country, document type, uploads)
import { ref } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';

export default {
    name: 'Kyc',
    components: { Icon },
    setup() {
        const country = ref('United States');
        const docType = ref('passport');
        const docs = [
            { k: 'passport', l: 'Passport' },
            { k: 'drivers', l: "Driver's License" },
            { k: 'id', l: 'National ID' },
        ];
        const uploaded = ref({ front: false, back: false });
        const pick = (side) => { uploaded.value = { ...uploaded.value, [side]: true }; toast('Image attached (demo)', 'success'); };
        const submit = () => {
            if (!store.isAuthed) { go('/login'); return; }
            if (!uploaded.value.front) { toast('Upload the front of your document', 'error'); return; }
            toast('Submitted for review', 'success'); go('/security');
        };
        const countries = ['United States', 'United Kingdom', 'Germany', 'Japan', 'Singapore', 'Australia', 'Canada', 'France'];
        return { country, countries, docType, docs, uploaded, pick, submit, go, store };
    },
    template: /*html*/`
    <section class="pay">
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/security')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">KYC Verification</h1></div>

        <div class="card pay__card">
            <label class="paystep"><span class="eyebrow">Country / Region of residence</span>
                <select class="field" v-model="country"><option v-for="c in countries" :key="c">{{ c }}</option></select>
            </label>

            <div class="paystep"><span class="eyebrow">Document type</span>
                <div class="kyc__docs">
                    <button v-for="d in docs" :key="d.k" class="kyc__doc" :class="{ 'is-on': docType === d.k }" @click="docType = d.k">
                        <Icon name="doc" :size="18" /> {{ d.l }}
                        <span class="kyc__radio" :class="{ 'is-on': docType === d.k }"></span>
                    </button>
                </div>
            </div>

            <div class="paystep"><span class="eyebrow">Upload document</span>
                <div class="kyc__uploads">
                    <button class="kyc__drop" :class="{ 'is-done': uploaded.front }" @click="pick('front')">
                        <Icon :name="uploaded.front ? 'shield' : 'plus'" :size="24" />
                        <span>{{ uploaded.front ? 'Front added' : 'Front side' }}</span>
                    </button>
                    <button v-if="docType !== 'passport'" class="kyc__drop" :class="{ 'is-done': uploaded.back }" @click="pick('back')">
                        <Icon :name="uploaded.back ? 'shield' : 'plus'" :size="24" />
                        <span>{{ uploaded.back ? 'Back added' : 'Back side' }}</span>
                    </button>
                </div>
            </div>

            <p class="note"><Icon name="info" :size="15" /> Your documents are used only for verification and stored securely. Review usually completes within 24 hours.</p>
            <button class="btn btn--brand btn--block btn--lg" @click="submit">{{ store.isAuthed ? 'Submit' : 'Log in to verify' }}</button>
        </div>
    </section>`,
};
