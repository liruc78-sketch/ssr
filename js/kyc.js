// ============================================================================
// Crypto.ssr — KYC (identity verification)
// The member's photos go to the private Storage bucket 'kyc' under their own
// users.id folder, submit_kyc() files the submission, and the admin panel
// approves or rejects it (supabase/migrations/20261027204420_kyc_verification.sql).
// Every photo is re-encoded here as a JPEG of at most 2000 px before it leaves
// the device, which also drops its EXIF data (GPS position, camera details).
// Uploads draw on daily limits, and while the server asks for it each attempt
// first passes a Turnstile check (20261028020904_kyc_upload_gate.sql).
// ============================================================================
import { sb } from './supabase.js';
import { store } from './store.js';

// Reason codes the reviewer picks from; each language has kyc.reason.<code>.
export const KYC_REASONS = ['unreadable', 'incomplete', 'expired', 'mismatch', 'not_original', 'other'];
export const KYC_DOC_KEYS = { passport: 'kyc.docPassport', drivers: 'kyc.docDrivers', id: 'kyc.docId' };

// ISO 3166-1 alpha-2 places people live in (no Antarctica or uninhabited
// territories), plus Kosovo. Names come from Intl.DisplayNames in the UI language.
export const KYC_COUNTRIES = (
    'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM ' +
    'FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM ' +
    'JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO ' +
    'MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT ' +
    'PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL ' +
    'TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ');

const BUCKET = 'kyc';
export const KYC_MAX_INPUT_MB = 20;                 // what the member may pick
const MAX_EDGE = 2000;                              // px, longest side once re-encoded
const MAX_UPLOAD = 1.5 * 1024 * 1024;               // the bucket takes up to 2 MB
const INPUT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const INPUT_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

const kycError = (code, cause) => Object.assign(new Error(code), { code, cause });

// crypto.randomUUID needs iOS 15.4+; older Safari gets the same v4 shape from getRandomValues.
const uuid = () => crypto.randomUUID?.() ?? '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,
    (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({ img, url });
        img.onerror = () => { URL.revokeObjectURL(url); reject(kycError('unreadable')); };
        img.src = url;
    });
}

const toJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

// A picked photo -> { blob, url } ready to upload (url previews it; revoke it when
// done), or throws with code type | size | unreadable | small. Browsers draw the
// photo upright (EXIF orientation); one they can't decode (HEIC outside Safari)
// is 'unreadable'.
export async function preparePhoto(file) {
    const type = String(file?.type || '').toLowerCase();
    if (!INPUT_TYPES.includes(type) && !(type === '' && INPUT_EXT.test(file?.name || ''))) throw kycError('type');
    if (file.size > KYC_MAX_INPUT_MB * 1024 * 1024) throw kycError('size');
    const { img, url } = await loadImage(file);
    try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) throw kycError('unreadable');
        // Too small to read a document's text.
        if (Math.max(w, h) < 600 || Math.min(w, h) < 400) throw kycError('small');
        let scale = Math.min(1, MAX_EDGE / Math.max(w, h));
        for (let tries = 0; tries < 3; tries++, scale *= 0.75) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';                      // transparent PNG areas -> white, not black
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            for (const q of [0.88, 0.8, 0.7]) {
                const blob = await toJpeg(canvas, q);
                if (!blob || blob.type !== 'image/jpeg') throw kycError('unreadable');
                if (blob.size <= MAX_UPLOAD) return { blob, url: URL.createObjectURL(blob) };
            }
        }
        throw kycError('size');
    } finally { URL.revokeObjectURL(url); }
}

// Re-read the account's KYC status into the session (the Verified chips and an open
// KYC page follow it). The bell's realtime feed misses a decision made while its
// socket was down (background tab, locked phone), so this runs when the bell loads
// KYC rows and, while a review is pending, whenever the tab comes back.
export async function syncKycStatus() {
    const uid = store.session?.userId;
    if (!uid) return;
    const { data, error } = await sb.from('users').select('kyc_status').eq('id', uid).maybeSingle();
    if (!error && data && store.session?.userId === uid) store.session.kycStatus = data.kyc_status || 'none';
}
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && store.session?.kycStatus === 'pending') syncKycStatus().catch(() => {});
});

// The signed-in member's latest submission, or null.
export async function loadLatestKyc() {
    const uid = store.session?.userId;
    if (!uid) return null;
    const { data, error } = await sb.from('kyc_submissions')
        .select('id, country, doc_type, status, reject_reason, review_note, reviewed_at, created_at')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    return data?.[0] || null;
}

// Storage error -> our code. The storage trigger refusing the upload (403) after
// kyc_upload_status() said yes means something changed since: a submission filed
// from another device, a limit reached, or the upload pass used up.
function uploadErrorCode(e) {
    const s = String(e?.statusCode ?? e?.status ?? '');
    const m = String(e?.message || '');
    if (s === '403' || /row-level security|unauthorized/i.test(m)) return 'upload_denied';
    if (s === '413' || /maximum allowed size|too large/i.test(m)) return 'size';
    return 'upload_failed';
}
const alreadyUploaded = (e) => String(e?.statusCode ?? '') === '409' || /already exists|duplicate/i.test(String(e?.message || ''));

// The server's say before `photos` more photos upload: refused (already submitted,
// or a daily limit used up), allowed, or allowed after a Turnstile check — `check`
// (sitekey) resolves with its token, and the kyc-pass edge function redeems it for
// an upload pass the storage trigger spends one use of per photo.
async function getUploadPass(photos, check, onPhase) {
    const { data: st, error } = await sb.rpc('kyc_upload_status', { p_photos: photos });
    if (error) throw kycError('network', error);
    if (!st?.ok) throw kycError(st?.error || 'failed');
    if (!st.pass_required) return;
    if (!check) throw kycError('check_load');
    onPhase('checking');
    const token = await check(st.sitekey);
    const { data, error: fnError } = await sb.functions.invoke('kyc-pass', { body: { token, photos } });
    let res = data;
    if (fnError) { try { res = await fnError.context.json(); } catch { res = null; } }
    if (!res?.ok) throw kycError(res?.error || 'network', fnError);
}

// Upload the photos and file the submission. `attempt` ({}) carries the upload
// folder and what is already uploaded between tries: uploads can't be replaced,
// so a retry reuses them, and the caller starts a fresh {} whenever a photo
// changes. `check` runs the Turnstile check when one is needed (getUploadPass).
// Throws with code member_limit | busy | check_load | check_failed | upload_denied |
// size | upload_failed | network or a submit_kyc error (already_pending,
// already_verified, bad_file, ...).
export async function submitKyc({ country, docType, photos, attempt, check, onPhase = () => {} }) {
    const uid = store.session?.userId;
    if (!uid) throw kycError('not_signed_in');
    attempt.dir ||= uuid();
    const sides = (docType === 'passport' ? ['front'] : ['front', 'back']).filter((side) => !attempt[side]);
    if (sides.length) {
        await getUploadPass(sides.length, check, onPhase);
        onPhase('uploading');
        const results = await Promise.allSettled(sides.map(async (side) => {
            const path = `${uid}/${attempt.dir}/${side}.jpg`;
            // cacheControl 0: no CDN or browser cache keeps serving an ID photo after its
            // short-lived signed URL (admin panel) has expired.
            const { error } = await sb.storage.from(BUCKET).upload(path, photos[side].blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '0' });
            if (error && !alreadyUploaded(error)) throw kycError(uploadErrorCode(error), error);
            attempt[side] = path;
        }));
        const failed = results.find((r) => r.status === 'rejected');
        if (failed) throw failed.reason?.code ? failed.reason : kycError('upload_failed', failed.reason);
    }

    onPhase('submitting');
    const { data, error } = await sb.rpc('submit_kyc', {
        p_country: country, p_doc_type: docType,
        p_front_path: attempt.front, p_back_path: docType === 'passport' ? null : attempt.back,
    });
    if (error) throw kycError('network', error);
    if (!data?.ok) throw kycError(data?.error || 'failed');
    return data.submission;
}
