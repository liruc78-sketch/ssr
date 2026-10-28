// KYC — identity verification. Shows the latest submission's status (under review,
// verified, or not approved with the reviewer's reason) and the form that uploads
// photos of an identity document: the first time, or again after a rejection.
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue';
import { Icon } from '../icons.js';
import { go } from '../router.js';
import { store, toast } from '../store.js';
import { t, locale } from '../i18n.js';
import { KYC_COUNTRIES, KYC_DOC_KEYS, KYC_REASONS, KYC_MAX_INPUT_MB, loadLatestKyc, preparePhoto, submitKyc } from '../kyc.js';

const PHOTO_ERRORS = { type: 'kyc.errType', size: 'kyc.errSize', unreadable: 'kyc.errUnreadable', small: 'kyc.errSmall' };
const SUBMIT_ERRORS = { already_pending: 'kyc.errPending', already_verified: 'kyc.errVerified', upload_denied: 'kyc.errUploadLimit', upload_failed: 'kyc.errUploadFailed' };
// Per status: icon, tone, title/body keys and the date the body quotes.
const STATUS = {
    pending:  { icon: 'history', title: 'kyc.pendingTitle',  body: 'kyc.pendingBody',  date: 'created_at' },
    approved: { icon: 'shield',  title: 'kyc.approvedTitle', body: 'kyc.approvedBody', date: 'reviewed_at' },
    rejected: { icon: 'info',    title: 'kyc.rejectedTitle', body: 'kyc.rejectedBody', date: 'reviewed_at' },
};

export default {
    name: 'Kyc',
    components: { Icon },
    setup() {
        const state = reactive({ loading: false, failed: false, latest: null });
        const country = ref('');                                  // ISO code; the member picks it
        const docType = ref('passport');
        const docs = Object.entries(KYC_DOC_KEYS).map(([k, tkey]) => ({ k, tkey }));
        const photos = reactive({ front: null, back: null });     // { blob, url } from preparePhoto
        const preparing = reactive({ front: false, back: false });
        const phase = ref('');                                    // '' | uploading | submitting
        const inputs = {};                                        // side -> its <input type=file>
        let attempt = {};                                         // upload folder + uploaded paths (kyc.js)
        let epoch = 0;                                            // bumped when photos are cleared
        let alive = true;

        const sides = computed(() => docType.value === 'passport' ? ['front'] : ['front', 'back']);
        // Uploading, or a picked photo still being prepared (submitting then would send the old one).
        const busy = computed(() => !!phase.value || preparing.front || preparing.back);
        const sideLabel = (s) => t(s === 'back' ? 'kyc.backSide' : docType.value === 'passport' ? 'kyc.photoPage' : 'kyc.frontSide');

        // Every country, named and sorted in the UI language.
        const countries = computed(() => {
            let names = null;
            try { names = new Intl.DisplayNames([locale.value, 'en'], { type: 'region' }); } catch {}
            const collator = new Intl.Collator(locale.value);
            return KYC_COUNTRIES.map((code) => ({ code, name: names?.of(code) || code }))
                .sort((a, b) => collator.compare(a.name, b.name));
        });
        const countryName = (code) => countries.value.find((c) => c.code === code)?.name || code;
        const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };

        const status = computed(() => {
            const l = state.latest, s = l && STATUS[l.status];
            if (!s) return null;
            const rejected = l.status === 'rejected';
            return {
                kind: l.status, icon: s.icon, title: s.title,
                body: t(s.body, { date: fmtDate(l[s.date]) }),
                doc: t(KYC_DOC_KEYS[l.doc_type] || 'kyc.docId'),
                country: countryName(l.country),
                // 'other' has no text of its own: the reviewer's note says it all.
                reason: rejected && l.reject_reason !== 'other' && KYC_REASONS.includes(l.reject_reason) ? t('kyc.reason.' + l.reject_reason) : '',
                note: rejected ? l.review_note || '' : '',
            };
        });
        // The form is for a first submission, or a new one after a rejection.
        const showForm = computed(() => !state.latest || state.latest.status === 'rejected');

        function setPhoto(side, p) {
            if (photos[side]) URL.revokeObjectURL(photos[side].url);
            photos[side] = p;
            attempt = {};                // uploads can't be replaced: a changed photo needs a new folder
        }
        const clearPhotos = () => { epoch++; setPhoto('front', null); setPhoto('back', null); };

        // The page shows the account's status: keep the Security / drawer chips in step.
        const syncStatus = () => { if (store.session) store.session.kycStatus = state.latest?.status || 'none'; };

        // Only the newest load applies: one started before a decision must not
        // overwrite the decision the bell has just delivered.
        let loadSeq = 0;
        async function refresh() {
            const uid = store.session?.userId;
            if (!uid) return;
            const seq = ++loadSeq;
            state.loading = true; state.failed = false;
            try {
                const latest = await loadLatestKyc();
                if (seq !== loadSeq || store.session?.userId !== uid) return;
                state.latest = latest;
                syncStatus();
                if (latest?.status === 'rejected') {          // resubmitting: start from what was sent
                    country.value ||= latest.country;
                    if (!photos.front && !photos.back) docType.value = latest.doc_type;
                }
            } catch { if (seq === loadSeq) state.failed = true; }
            finally { if (seq === loadSeq) state.loading = false; }
        }

        const pick = (side) => { if (!phase.value && !preparing[side]) inputs[side]?.click(); };
        async function onFile(side, ev) {
            const file = ev.target.files?.[0];
            ev.target.value = '';                             // picking the same file again still fires
            if (!file) return;
            preparing[side] = true;
            const at = epoch;
            try {
                const p = await preparePhoto(file);
                // Dropped if the page closed, the side went away or the account changed meanwhile.
                if (alive && at === epoch && sides.value.includes(side)) setPhoto(side, p); else URL.revokeObjectURL(p.url);
            } catch (e) {
                toast(t(PHOTO_ERRORS[e?.code] || 'kyc.errUnreadable', { mb: KYC_MAX_INPUT_MB }), 'error', 4200);
            } finally { preparing[side] = false; }
        }

        async function submit() {
            if (busy.value) return;
            if (!store.isAuthed) { go('/login'); return; }
            if (!country.value) { toast(t('kyc.errCountry'), 'error'); return; }
            const missing = sides.value.find((s) => !photos[s]);
            if (missing) { toast(t(missing === 'back' ? 'kyc.uploadBack' : 'kyc.uploadFront'), 'error'); return; }
            const uid = store.session.userId;
            try {
                const sub = await submitKyc({
                    country: country.value, docType: docType.value, photos, attempt,
                    onPhase: (p) => { phase.value = p; },
                });
                if (store.session?.userId !== uid) return;    // another account by now: not its submission
                state.latest = sub;
                syncStatus();
                clearPhotos();
                toast(t('kyc.submitted'), 'success');
            } catch (e) {
                const code = e?.code;
                if (store.session?.userId !== uid) return;
                if (code === 'not_signed_in') { go('/login'); return; }
                if (code === 'bad_file') attempt = {};
                // Filed or decided from another device meanwhile? Then show that.
                if (code === 'already_pending' || code === 'already_verified' || code === 'upload_denied') {
                    await refresh();
                    const s = state.latest?.status;
                    if (s === 'pending' || s === 'approved') {
                        clearPhotos();
                        toast(t(s === 'pending' ? 'kyc.errPending' : 'kyc.errVerified'), 'info', 4200);
                        return;
                    }
                }
                toast(t(SUBMIT_ERRORS[code] || 'kyc.errSubmit'), 'error', 4200);
            } finally { phase.value = ''; }
        }

        watch(docType, (d) => { if (d === 'passport' && photos.back) setPhoto('back', null); attempt = {}; });
        watch(() => [store.session?.userId, store.session?.kycStatus], ([id, s], prev) => {
            if (!prev || id !== prev[0]) {                    // signed in, out, or as someone else
                state.latest = null; state.failed = false; clearPhotos();
                country.value = ''; docType.value = 'passport';
                if (id) refresh();
            } else if (id && s !== (state.latest?.status || 'none')) {
                refresh();                                    // decided meanwhile (bell / another device)
            }
        }, { immediate: true });
        onBeforeUnmount(() => { alive = false; clearPhotos(); });

        return {
            store, state, status, showForm, refresh, go,
            country, countries, docType, docs, sides, sideLabel, photos, preparing, phase, busy, inputs,
            pick, onFile, setPhoto, submit, maxMb: KYC_MAX_INPUT_MB,
        };
    },
    template: /*html*/`
    <section class="pay">
        <div class="page-head"><button class="iconbtn page-head__back" @click="go('/security')"><Icon name="chevronR" style="transform:rotate(180deg)" /></button><h1 class="page-title">{{ $t('kyc.title') }}</h1></div>

        <div v-if="!store.isAuthed" class="card">
            <div class="placeholder" style="border:0; padding:var(--sp-8)">
                <Icon name="user" class="placeholder__icon" :size="40" />
                <p class="muted">{{ $t('kyc.note') }}</p>
                <button class="btn btn--brand btn--sm btn--pill" @click="go('/login')">{{ $t('kyc.loginToVerify') }}</button>
            </div>
        </div>

        <div v-else-if="state.loading && !state.latest" class="card kyc__wait"><span class="spinner"></span></div>

        <div v-else-if="state.failed" class="card kyc__wait">
            <p class="muted">{{ $t('kyc.loadFailed') }}</p>
            <button class="btn btn--sm btn--pill" @click="refresh">{{ $t('common.retry') }}</button>
        </div>

        <template v-else>
            <div v-if="status" class="card kyc__status" :class="'kyc__status--' + status.kind" role="status">
                <span class="kyc__statusic"><Icon :name="status.icon" :size="22" /></span>
                <div class="kyc__statusmain">
                    <h2 class="kyc__statustitle">{{ $t(status.title) }}</h2>
                    <p class="kyc__statusbody">{{ status.body }}</p>
                    <div class="kyc__chips"><span class="chip">{{ status.doc }}</span><span class="chip">{{ status.country }}</span></div>
                    <div v-if="status.reason" class="kyc__reason"><span class="eyebrow">{{ $t('kyc.reasonLabel') }}</span><p>{{ status.reason }}</p></div>
                    <div v-if="status.note" class="kyc__note"><span class="eyebrow">{{ $t('kyc.noteLabel') }}</span><p dir="auto">{{ status.note }}</p></div>
                </div>
            </div>

            <div v-if="showForm" class="card pay__card">
                <h2 v-if="status" class="kyc__formtitle">{{ $t('kyc.resubmitTitle') }}</h2>

                <label class="paystep"><span class="eyebrow">{{ $t('kyc.countryLabel') }}</span>
                    <select class="field" v-model="country" :disabled="!!phase">
                        <option value="" disabled>{{ $t('kyc.selectCountry') }}</option>
                        <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.name }}</option>
                    </select>
                </label>

                <div class="paystep"><span class="eyebrow">{{ $t('kyc.docType') }}</span>
                    <div class="kyc__docs" role="radiogroup" :aria-label="$t('kyc.docType')">
                        <button v-for="d in docs" :key="d.k" type="button" class="kyc__doc" :class="{ 'is-on': docType === d.k }"
                                role="radio" :aria-checked="docType === d.k" :disabled="!!phase" @click="docType = d.k">
                            <Icon name="doc" :size="18" /> {{ $t(d.tkey) }}
                            <span class="kyc__radio" :class="{ 'is-on': docType === d.k }"></span>
                        </button>
                    </div>
                </div>

                <div class="paystep"><span class="eyebrow">{{ $t('kyc.uploadDoc') }}</span>
                    <div class="kyc__uploads" :class="{ 'kyc__uploads--one': sides.length === 1 }">
                        <div v-for="s in sides" :key="s" class="kyc__slot">
                            <input :ref="(el) => { if (el) inputs[s] = el; }" type="file" accept="image/*" hidden @change="onFile(s, $event)">
                            <button type="button" class="kyc__drop" :class="{ 'is-done': photos[s] }" :disabled="preparing[s] || !!phase" @click="pick(s)">
                                <img v-if="photos[s]" :src="photos[s].url" alt="" class="kyc__preview">
                                <span v-if="preparing[s]" class="spinner"></span>
                                <template v-else-if="!photos[s]">
                                    <Icon name="plus" :size="24" />
                                    <span>{{ sideLabel(s) }}</span>
                                    <small class="kyc__hint">{{ $t('kyc.photoFormats', { mb: maxMb }) }}</small>
                                </template>
                                <span v-else class="kyc__slotbar"><Icon name="check" :size="14" /><span>{{ sideLabel(s) }} · {{ $t('kyc.replace') }}</span></span>
                            </button>
                            <button v-if="photos[s] && !phase" type="button" class="kyc__remove" :aria-label="$t('kyc.remove')" @click="setPhoto(s, null)"><Icon name="close" :size="16" /></button>
                        </div>
                    </div>
                    <p class="kyc__tips">{{ $t('kyc.photoTips') }}</p>
                </div>

                <p class="note"><Icon name="info" :size="15" /> {{ $t('kyc.note') }}</p>
                <button class="btn btn--brand btn--block btn--lg" :disabled="busy" @click="submit">
                    <span v-if="phase" class="spinner kyc__btnspin"></span>
                    {{ phase === 'uploading' ? $t('kyc.uploading') : phase === 'submitting' ? $t('kyc.submitting') : $t('kyc.submit') }}
                </button>
            </div>
        </template>
    </section>`,
};
