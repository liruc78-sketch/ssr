// Live streaming — trading rooms / sessions
import { Icon } from '../icons.js';
import { toast } from '../store.js';

export default {
    name: 'Live',
    components: { Icon },
    setup() {
        const rooms = [
            { host: 'Market Open Desk', title: 'Spot & perp session — reading the morning tape', viewers: 2143, tag: 'Live', c: '#2f49d6' },
            { host: 'Quant Lab', title: 'How AI-Quant strategies allocate in a chop', viewers: 1180, tag: 'Live', c: '#0ea5a5' },
            { host: 'Options Room', title: 'Short-dated options: reading implied vol', viewers: 864, tag: 'Live', c: '#e24fe2' },
            { host: 'Macro Hour', title: 'Dollar, yields and crypto beta', viewers: 517, tag: 'Soon', c: '#f0a020' },
        ];
        return { rooms, join: () => toast('Joining stream — coming soon', 'info') };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><h1 class="page-title">Live streaming</h1></div>
        <div class="live__grid">
            <button v-for="(r, i) in rooms" :key="i" class="card live__room" @click="join">
                <div class="live__thumb" :style="{ background: 'linear-gradient(135deg,' + r.c + ',#11162b)' }">
                    <span class="live__badge" :class="{ 'is-live': r.tag === 'Live' }">{{ r.tag === 'Live' ? '● LIVE' : 'SOON' }}</span>
                    <span class="live__viewers"><Icon name="user" :size="13" /> {{ r.viewers.toLocaleString() }}</span>
                    <Icon name="live" :size="34" class="live__play" />
                </div>
                <div class="live__info"><b>{{ r.host }}</b><span class="muted" style="font-size:var(--fs-small)">{{ r.title }}</span></div>
            </button>
        </div>
    </section>`,
};
