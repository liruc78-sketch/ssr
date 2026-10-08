// Live streaming — trading rooms / sessions
import { Icon } from '../icons.js';
import { toast } from '../store.js';
import { t } from '../i18n.js';

export default {
    name: 'Live',
    components: { Icon },
    setup() {
        const rooms = [
            { hostKey: 'live.room1Host', titleKey: 'live.room1Title', viewers: 2143, tag: 'Live', c: '#2f49d6' },
            { hostKey: 'live.room2Host', titleKey: 'live.room2Title', viewers: 1180, tag: 'Live', c: '#0ea5a5' },
            { hostKey: 'live.room3Host', titleKey: 'live.room3Title', viewers: 864, tag: 'Live', c: '#e24fe2' },
            { hostKey: 'live.room4Host', titleKey: 'live.room4Title', viewers: 517, tag: 'Soon', c: '#f0a020' },
        ];
        return { rooms, join: () => toast(t('live.joinToast'), 'info') };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><h1 class="page-title">{{ $t('live.title') }}</h1></div>
        <div class="live__grid">
            <button v-for="(r, i) in rooms" :key="i" class="card live__room" @click="join">
                <div class="live__thumb" :style="{ background: 'linear-gradient(135deg,' + r.c + ',#11162b)' }">
                    <span class="live__badge" :class="{ 'is-live': r.tag === 'Live' }">{{ r.tag === 'Live' ? $t('live.badgeLive') : $t('live.badgeSoon') }}</span>
                    <span class="live__viewers"><Icon name="user" :size="13" /> {{ r.viewers.toLocaleString() }}</span>
                    <Icon name="live" :size="34" class="live__play" />
                </div>
                <div class="live__info"><b>{{ $t(r.hostKey) }}</b><span class="muted" style="font-size:var(--fs-small)">{{ $t(r.titleKey) }}</span></div>
            </button>
        </div>
    </section>`,
};
