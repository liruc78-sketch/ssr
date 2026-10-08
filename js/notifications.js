// ============================================================================
// Crypto.ssr — Notification center (the bell).
// Notifications are stored structurally in Supabase (kind + event + meta) by DB
// triggers on the money tables, so one row works in every language: describe()
// renders the title/body in the ACTIVE UI language at read time. Realtime keeps
// the bell live; opening the panel marks everything read.
// ============================================================================
import { reactive, watch } from 'vue';
import { sb } from './supabase.js';
import { store } from './store.js';
import { t } from './i18n.js';
import { COINS, fmtNum } from './data.js';

export const notif = reactive({ open: false, items: [], unread: 0, loading: false, loaded: false });

let channel = null;
const uid = () => store.session?.userId;

export async function loadNotifications() {
    if (!uid()) return;
    notif.loading = true;
    try {
        const { data } = await sb.from('notifications')
            .select('*').eq('user_id', uid())
            .order('created_at', { ascending: false }).limit(50);
        notif.items = data || [];
        notif.unread = notif.items.filter((n) => !n.is_read).length;
        notif.loaded = true;
    } catch (_) { /* keep last-known-good */ }
    finally { notif.loading = false; }
}

export async function markAllRead() {
    if (!uid()) return;
    const hadUnread = notif.items.some((n) => !n.is_read);
    notif.items.forEach((n) => { n.is_read = true; });
    notif.unread = 0;
    if (hadUnread) {
        try { await sb.from('notifications').update({ is_read: true }).eq('user_id', uid()).eq('is_read', false); } catch (_) {}
    }
}

export function openNotifications() {
    notif.open = true;
    document.body.style.overflow = 'hidden';
    loadNotifications();
}
export function closeNotifications() {
    notif.open = false;
    document.body.style.overflow = '';
    markAllRead();   // seen on open; clear the badge when the user dismisses the panel
}

function subscribe() {
    if (!uid() || channel) return;
    const id = uid();
    channel = sb.channel('notif:' + id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + id }, (p) => {
            const n = p.new;
            if (!n || notif.items.some((x) => x.id === n.id)) return;
            notif.items.unshift(n);
            if (!n.is_read) notif.unread++;
        })
        .subscribe();
}

function teardown() {
    if (channel) { try { sb.removeChannel(channel); } catch (_) {} channel = null; }
    notif.items = []; notif.unread = 0; notif.open = false; notif.loaded = false;
}

watch(() => store.session?.userId, (id) => { teardown(); if (id) { subscribe(); loadNotifications(); } }, { immediate: true });

// ---- localized rendering ---------------------------------------------------
// Called inside the panel's computed, so it reads the reactive locale and
// re-renders the moment the language changes.
const symOf = (coinId) => { const c = COINS.find((x) => x.cg === coinId); return c ? c.sym : String(coinId || '').toUpperCase(); };
const signed = (n) => { const v = Number(n) || 0; return (v >= 0 ? '+' : '-') + fmtNum(Math.abs(v)); };

export function describe(n) {
    const m = n.meta || {};
    if (n.kind === 'trade') {
        const won = n.event === 'won';
        const sym = symOf(m.coinId);
        const dir = m.type === 'up' ? t('trade.up') : t('trade.down');
        const amount = fmtNum(m.amount);
        const result = signed((Number(m.payout) || 0) - (Number(m.amount) || 0));
        const pfx = m.isSim ? t('notif.simTag') + ' · ' : '';
        return {
            icon: 'trade', tone: won ? 'up' : 'down',
            title: pfx + (won ? t('notif.trade.wonTitle') : t('notif.trade.lostTitle')),
            body: t('notif.trade.body', { dir, sym, amount, result }),
        };
    }
    if (n.kind === 'deposit') {
        const sym = m.coinSymbol || '';
        const usd = fmtNum(m.usdAmount);
        if (n.event === 'credited') return { icon: 'deposit', tone: 'up', title: t('notif.deposit.creditedTitle'), body: t('notif.deposit.creditedBody', { usd, sym }) };
        return { icon: 'deposit', tone: 'down', title: t('notif.deposit.failedTitle'), body: t('notif.deposit.failedBody', { sym }) };
    }
    if (n.kind === 'withdraw') {
        const amt = fmtNum(m.amount);
        if (n.event === 'completed') return { icon: 'withdraw', tone: 'up', title: t('notif.withdraw.completedTitle'), body: t('notif.withdraw.completedBody', { amt }) };
        if (n.event === 'failed') return { icon: 'withdraw', tone: 'down', title: t('notif.withdraw.failedTitle'), body: t('notif.withdraw.failedBody', { amt }) };
        return { icon: 'withdraw', tone: 'gold', title: t('notif.withdraw.submittedTitle'), body: t('notif.withdraw.submittedBody', { amt }) };
    }
    return { icon: 'bell', tone: 'brand', title: m.title || t('notif.system.default'), body: m.body || '' };
}

export function relTime(iso) {
    const then = new Date(iso).getTime();
    if (!then) return '';
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 1) return t('notif.justNow');
    if (mins < 60) return t('feed.minAgo', { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('feed.hAgo', { n: hrs });
    return t('notif.dAgo', { n: Math.floor(hrs / 24) });
}
