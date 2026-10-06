// ============================================================================
// Crypto.ssr — Live support chat (mirrors the legacy support flow + realtime)
// Tables: support_messages {user_id, sender 'user'|'admin', content, created_at},
//         support_conversations {user_id, unread_user}.
// Auto-subscribes/tears down as the session changes (watch on store.session).
// ============================================================================
import { reactive, watch, nextTick } from 'vue';
import { sb } from './supabase.js';
import { store, toast } from './store.js';

export const support = reactive({ open: false, messages: [], unread: 0, loading: false, sending: false, input: '', bodyEl: null });
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

export async function sendMessage() {
    const text = support.input.trim();
    if (!text || support.sending || !uid()) return;
    support.sending = true;
    try {
        const { data, error } = await sb.from('support_messages').insert({ user_id: uid(), sender: 'user', content: text }).select().single();
        if (error) throw error;
        support.input = '';
        if (data && !support.messages.some(m => m.id === data.id)) support.messages.push(data);
        scrollDown();
    } catch (e) { toast('Message failed to send', 'error'); }
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
    support.messages = []; support.input = ''; support.unread = 0; support.open = false;
}

async function initForUser() {
    subscribe();
    try { const { data } = await sb.from('support_conversations').select('unread_user').eq('user_id', uid()).single(); support.unread = data?.unread_user || 0; }
    catch { support.unread = 0; }
}

export function openSupport() {
    if (!store.isAuthed) { return 'auth'; }
    support.open = true;
    loadMessages();
    return 'open';
}
export function closeSupport() { support.open = false; }

// React to login/logout.
watch(() => store.session?.userId, (id) => { teardown(); if (id) initForUser(); }, { immediate: true });
