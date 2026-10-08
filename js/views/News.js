// News — live crypto headlines. Fetches current articles from the `news` edge
// function (server-side feed aggregation) and links each card straight out to
// the publisher's page. No in-app reader: clicking opens the real article.
import { ref, computed, onMounted } from 'vue';
import { Icon } from '../icons.js';
import { edge } from '../supabase.js';
import { t } from '../i18n.js';

const TAGS = ['BTC', 'ETH', 'Bitcoin', 'Ethereum', 'ETF', 'Regulation', 'DeFi', 'Solana'];

// "12m ago" / "3h ago" / "2d ago" from an epoch-ms timestamp.
function timeAgo(ms) {
    const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (s < 60) return t('news.justNow');
    const m = Math.floor(s / 60); if (m < 60) return t('news.minAgo', { n: m });
    const h = Math.floor(m / 60); if (h < 24) return t('news.hourAgo', { n: h });
    const d = Math.floor(h / 24); return t('news.dayAgo', { n: d });
}

export default {
    name: 'News',
    components: { Icon },
    setup() {
        const q = ref('');
        const articles = ref([]);
        const loading = ref(true);
        const error = ref(false);

        const load = async () => {
            loading.value = true; error.value = false;
            try {
                const data = await edge('news', { method: 'GET' });
                articles.value = Array.isArray(data?.articles) ? data.articles : [];
                if (!articles.value.length) error.value = true;
            } catch (e) {
                error.value = true; articles.value = [];
            } finally { loading.value = false; }
        };
        onMounted(load);

        const list = computed(() => {
            const s = q.value.trim().toLowerCase();
            if (!s) return articles.value;
            return articles.value.filter(a =>
                (a.title + ' ' + (a.body || '') + ' ' + (a.source || '') + ' ' + (a.categories || []).join(' '))
                    .toLowerCase().includes(s));
        });

        return { q, list, loading, error, TAGS, timeAgo, load };
    },
    template: /*html*/`
    <section>
        <div class="page-head"><h1 class="page-title">{{ $t('news.title') }}</h1></div>
        <label class="search" style="margin-top:0"><Icon name="search" :size="18" /><input class="search__input" v-model="q" :placeholder="$t('news.searchPlaceholder')" /></label>
        <div class="news__tags">
            <span class="muted" style="font-size:var(--fs-caption)">{{ $t('news.trending') }}</span>
            <button v-for="t in TAGS" :key="t" class="chip" style="background:var(--surface-2)" @click="q = t">{{ t }}</button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="news__list">
            <div v-for="n in 5" :key="n" class="card news__card">
                <div class="skeleton" style="height:12px; width:40%; margin-bottom:12px"></div>
                <div class="skeleton" style="height:18px; width:90%; margin-bottom:8px"></div>
                <div class="skeleton" style="height:14px; width:100%"></div>
            </div>
        </div>

        <!-- Error / empty feed -->
        <div v-else-if="error" class="placeholder" style="padding:var(--sp-10)">
            <Icon name="info" class="placeholder__icon" :size="48" />
            <h3>{{ $t('news.errorTitle') }}</h3>
            <p class="muted" style="max-width:34ch">{{ $t('news.errorBody') }}</p>
            <button class="btn btn--brand" style="margin-top:var(--sp-4)" @click="load()">{{ $t('common.retry') }}</button>
        </div>

        <!-- No search matches -->
        <div v-else-if="!list.length" class="placeholder" style="padding:var(--sp-10)">
            <Icon name="search" class="placeholder__icon" :size="48" />
            <p class="muted">{{ $t('news.noMatch', { q }) }}</p>
        </div>

        <!-- Live headlines — each card links out to the publisher -->
        <div v-else class="news__list">
            <a v-for="a in list" :key="a.id" class="card news__card news__card--link" :href="a.url" target="_blank" rel="noopener noreferrer">
                <div class="news__meta">
                    <span class="num news__src">{{ a.source }}</span>
                    <span class="news__dot">·</span><span>{{ timeAgo(a.published) }}</span>
                    <span class="news__ext">{{ $t('news.read') }} <Icon name="chevronR" :size="14" /></span>
                </div>
                <h3 class="news__title">{{ a.title }}</h3>
                <p v-if="a.body" class="muted news__sum">{{ a.body }}</p>
                <div v-if="a.categories && a.categories.length" class="news__coins">
                    <span v-for="c in a.categories" :key="c" class="chip chip--brand">{{ c }}</span>
                </div>
            </a>
        </div>
    </section>`,
};
