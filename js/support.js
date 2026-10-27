// ============================================================================
// Crypto.ssr — Live support chat (mirrors the legacy support flow + realtime)
// Tables: support_messages {user_id, sender 'user'|'admin', content, created_at},
//         support_conversations {user_id, unread_user}.
// Members read and write their own rows (RLS) with realtime updates. Visitors who
// aren't signed in chat as guests: the browser keeps a random key and the
// guest_support_* RPCs find the conversation by its hash. Anon gets no realtime,
// so a guest's open chat polls. After signing in on this tab, the member can add a
// recent guest chat to the account (offerGuestChat). See
// supabase/migrations/*_guest_support_chat.sql and *_guest_support_hardening.sql.
// Auto-subscribes/tears down as the session changes (watch on store.session).
// ============================================================================
import { reactive, watch, nextTick } from 'vue';
import { sb } from './supabase.js';
import { store, toast } from './store.js';
import { t, locale } from './i18n.js';

export const support = reactive({ open: false, messages: [], unread: 0, loading: false, sending: false, input: '', bodyEl: null });
export const MAX_MESSAGE = 2000;      // the guest RPC's limit; the input applies it to everyone
let channel = null;

const uid = () => store.session?.userId;

function merge(existing, incoming) {
    const byId = new Map();
    for (const m of incoming) byId.set(m.id, m);
    for (const m of existing) if (!byId.has(m.id)) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}
function scrollDown() { nextTick(() => { const el = support.bodyEl; if (el) el.scrollTop = el.scrollHeight; }); }

async function resetUnread() {
    support.unread = 0;
    if (!uid()) return;
    try { await sb.from('support_conversations').update({ unread_user: 0 }).eq('user_id', uid()); } catch {}
}

export async function loadMessages() {
    if (!uid()) return;
    support.loading = true;
    try {
        const { data } = await sb.from('support_messages').select('*').eq('user_id', uid()).order('created_at', { ascending: true }).limit(200);
        support.messages = merge(support.messages, data || []);
        await resetUnread();
        scrollDown();
    } finally { support.loading = false; }
}

// ---- guests (not signed in) --------------------------------------------------
const GUEST_KEY = 'support_guest_key';
const GUEST_POLL_MS = 7000;            // only while a guest's chat is open and the tab visible
const CLAIM_WINDOW_MS = 24 * 3600e3;   // offer to keep a guest chat only if active this recently
let storageBlocked = false;            // private mode: the key then lives in memory, this page view
let memoryKey = null;
let pollTimer = null;

function guestKey() {
    if (!storageBlocked) { try { return localStorage.getItem(GUEST_KEY); } catch { storageBlocked = true; } }
    return memoryKey;
}
function newGuestKey() {
    const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(GUEST_KEY, key); } catch { storageBlocked = true; memoryKey = key; }
    return key;
}
function dropGuestKey() { memoryKey = null; try { localStorage.removeItem(GUEST_KEY); } catch {} }

// Another tab added the guest chat to an account (or dropped it): this signed-out
// tab's copy is stale, and its next message starts a new guest chat.
window.addEventListener('storage', (e) => {
    if ((e.key === GUEST_KEY || e.key === null) && !e.newValue && !uid()) { support.messages = []; support.unread = 0; }
});

// markRead: the chat is open, so the admin's replies count as seen.
async function loadGuestMessages(markRead) {
    const key = guestKey();
    if (!key) return;
    const { data, error } = await sb.rpc('guest_support_messages', { p_key: key, p_mark_read: markRead });
    if (error || !data?.ok || uid()) return;        // signed in meanwhile: no longer this chat
    const before = support.messages.length;
    support.messages = merge(support.messages, data.messages || []);
    support.unread = data.unread || 0;
    if (support.messages.length !== before) scrollDown();
}
function startGuestPoll() {
    stopGuestPoll();
    pollTimer = setInterval(() => {
        if (support.open && !document.hidden && !uid()) loadGuestMessages(true).catch(() => {});
    }, GUEST_POLL_MS);
}
function stopGuestPoll() { clearInterval(pollTimer); pollTimer = null; }

// Move this browser's guest conversation into the signed-in account. The key is kept
// if that fails, so the next sign-in can offer it again.
async function claimGuestChat() {
    const key = guestKey();
    if (!key) return;
    try {
        const { data, error } = await sb.rpc('claim_guest_support', { p_key: key });
        if (!error && data?.ok) dropGuestKey();
    } catch {}
}

// After this tab's own sign-in (Login.js), never for a restored session or another
// tab's: offer to add a recent guest chat from this browser to the account. It asks
// first — on a shared browser the chat may be someone else's — and only for a chat
// active in the last day. Otherwise the key is dropped, and the chat stays with
// support as a guest's.
export async function offerGuestChat() {
    const key = guestKey();
    const id = uid();
    if (!key || !id) return;
    let msgs;
    try {
        const { data, error } = await sb.rpc('guest_support_messages', { p_key: key, p_mark_read: false });
        if (error) return;                     // couldn't check: offer again next sign-in
        if (!data?.ok) { dropGuestKey(); return; }
        msgs = data.messages || [];
    } catch { return; }
    const last = msgs.length ? new Date(msgs[msgs.length - 1].created_at).getTime() : 0;
    if (!last || Date.now() - last > CLAIM_WINDOW_MS || !window.confirm(t('support.claimPrompt'))) { dropGuestKey(); return; }
    await claimGuestChat();
    if (uid() !== id) return;
    if (support.open) { loadMessages(); return; }
    try { const { data } = await sb.from('support_conversations').select('unread_user').eq('user_id', id).single(); if (uid() === id) support.unread = data?.unread_user || 0; }
    catch {}
}

export async function sendMessage() {
    const text = support.input.trim();
    if (!text || support.sending) return;
    support.sending = true;
    try {
        let msg;
        if (uid()) {
            const { data, error } = await sb.from('support_messages').insert({ user_id: uid(), sender: 'user', content: text }).select().single();
            if (error) throw error;
            msg = data;
        } else {
            const { data, error } = await sb.rpc('guest_support_send', { p_key: guestKey() || newGuestKey(), p_content: text, p_locale: locale.value });
            if (error) throw error;
            if (!data?.ok) throw Object.assign(new Error(data?.error || 'failed'), { code: data?.error });
            msg = data.message;
        }
        support.input = '';
        if (msg && !support.messages.some(m => m.id === msg.id)) support.messages.push(msg);
        scrollDown();
    } catch (e) {
        toast(e?.code === 'busy' ? t('support.busy')
            : e?.code === 'rate_limited' ? t('support.slowDown')
            : e?.code === 'too_long' ? t('support.tooLong', { n: MAX_MESSAGE })
            : t('support.failed'), 'error', e?.code === 'busy' ? 5200 : 2600);
    }
    finally { support.sending = false; }
}

function subscribe() {
    if (!uid() || channel) return;
    const id = uid();
    channel = sb.channel('support:' + id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: 'user_id=eq.' + id }, (p) => {
            const msg = p.new;
            if (!msg || support.messages.some(m => m.id === msg.id)) return;
            support.messages.push(msg);
            if (support.open) { if (msg.sender === 'admin') resetUnread(); scrollDown(); }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_conversations', filter: 'user_id=eq.' + id }, (p) => {
            if (!support.open && p.new) support.unread = p.new.unread_user || 0;
        })
        .subscribe();
}

function teardown() {
    if (channel) { try { sb.removeChannel(channel); } catch {} channel = null; }
    stopGuestPoll();
    support.messages = []; support.input = ''; support.unread = 0; support.open = false;
}

async function initForUser(id) {
    subscribe();
    let unread = 0;
    try { const { data } = await sb.from('support_conversations').select('unread_user').eq('user_id', id).single(); unread = data?.unread_user || 0; }
    catch {}
    if (uid() === id) support.unread = unread;     // not a late answer for a previous account
}

// A returning guest: the badge shows replies that came in while away.
function initGuest() {
    if (guestKey()) loadGuestMessages(false).catch(() => {});
}

// Works signed in or not; a guest's first message starts their conversation.
export function openSupport() {
    support.open = true;
    if (uid()) { loadMessages(); return; }
    support.loading = !!guestKey() && !support.messages.length;
    loadGuestMessages(true).catch(() => {}).finally(() => { support.loading = false; scrollDown(); });
    startGuestPoll();
}
export function closeSupport() { support.open = false; stopGuestPoll(); }

// React to login/logout.
watch(() => store.session?.userId, (id) => { teardown(); if (id) initForUser(id); else initGuest(); }, { immediate: true });
