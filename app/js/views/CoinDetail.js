// Coin detail — price header, candlestick chart (live), indicators, order book, Trade CTA
import { ref, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { createChart } from 'lightweight-charts';
import { Icon } from '../icons.js';
import { go, router } from '../router.js';
import { store } from '../store.js';
import { findSym, fetchKlines, fetchTickers, genBook, TIMEFRAMES, fmtNum, fmtPrice, fmtChg, fmtVol } from '../data.js';
import { MA, BOLL, MACD, RSI, KDJ, WR, VOL } from '../indicators.js';

function palette() {
    const d = store.theme === 'dark';
    return {
        text: d ? '#9fb0c3' : '#42526b',
        grid: d ? 'rgba(255,255,255,0.05)' : 'rgba(16,24,40,0.05)',
        border: d ? 'rgba(255,255,255,0.09)' : 'rgba(16,24,40,0.08)',
        up: d ? '#2ebd85' : '#0ecb81',
        down: '#f6465d',
        brand: d ? '#5b73ff' : '#3b5bfd',
        gold: d ? '#f5b544' : '#f0a020',
        ma: ['#f0a020', '#5b73ff', '#e24fe2', '#2ebd85'],
    };
}

export default {
    name: 'CoinDetail',
    components: { Icon },
    setup() {
        const coin = findSym(router.query.sym) || findSym('BTC');
        const tf = ref('15m');
        const study = ref('VOL');          // lower pane
        const showMA = ref(true);
        const showBOLL = ref(false);
        const stats = reactive({ last: coin?.price || 0, chg: coin?.chg || 0, high: 0, low: 0, vol: '—', turnover: '—' });
        const book = reactive({ asks: [], bids: [] });

        const mainEl = ref(null), lowerEl = ref(null);
        let mainChart, lowerChart, candle, area, volSeries;
        let maSeries = [], bollSeries = [], lowerSeries = [];
        let raw = [];
        let syncing = false;

        const INDICATORS = ['MA', 'BOLL', 'VOL', 'MACD', 'KDJ', 'RSI', 'WR'];

        function baseChartOpts(h) {
            const p = palette();
            return {
                height: h, autoSize: false,
                layout: { background: { type: 'solid', color: 'transparent' }, textColor: p.text, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, attributionLogo: false },
                localization: { locale: 'en-US' },
                grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
                rightPriceScale: { borderColor: p.border },
                timeScale: { borderColor: p.border, timeVisible: true, secondsVisible: false },
                crosshair: { mode: 0 },
                handleScale: true, handleScroll: true,
            };
        }

        function clearSeries(list) { list.forEach(s => { try { (s.chart || mainChart).removeSeries(s); } catch {} }); }

        function renderOverlays() {
            // MA overlays
            maSeries.forEach(s => { try { mainChart.removeSeries(s); } catch {} }); maSeries = [];
            if (showMA.value && candle) {
                const p = palette();
                [5, 10, 30, 60].forEach((period, i) => {
                    const s = mainChart.addLineSeries({ color: p.ma[i], lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
                    s.setData(MA(raw, period));
                    maSeries.push(s);
                });
            }
            // BOLL bands
            bollSeries.forEach(s => { try { mainChart.removeSeries(s); } catch {} }); bollSeries = [];
            if (showBOLL.value && candle) {
                const p = palette();
                const b = BOLL(raw, 20, 2);
                [['upper', p.gold], ['mid', p.brand], ['lower', p.gold]].forEach(([k, color]) => {
                    const s = mainChart.addLineSeries({ color, lineWidth: 1, lineStyle: k === 'mid' ? 0 : 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
                    s.setData(b[k]); bollSeries.push(s);
                });
            }
        }

        function renderLower() {
            lowerSeries.forEach(s => { try { lowerChart.removeSeries(s); } catch {} }); lowerSeries = [];
            if (!lowerChart) return;
            const p = palette();
            const s = study.value;
            if (s === 'VOL') {
                const h = lowerChart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
                h.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
                h.setData(VOL(raw).map(v => ({ time: v.time, value: v.value, color: (v.up ? p.up : p.down) + '88' })));
                lowerSeries.push(h);
            } else if (s === 'MACD') {
                const m = MACD(raw);
                const hist = lowerChart.addHistogramSeries({ priceScaleId: '' });
                hist.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
                hist.setData(m.hist.map(x => ({ time: x.time, value: x.value, color: (x.color === 'up' ? p.up : p.down) + '88' })));
                const dif = lowerChart.addLineSeries({ color: p.brand, lineWidth: 1, priceScaleId: '', priceLineVisible: false, lastValueVisible: false });
                dif.setData(m.dif);
                const dea = lowerChart.addLineSeries({ color: p.gold, lineWidth: 1, priceScaleId: '', priceLineVisible: false, lastValueVisible: false });
                dea.setData(m.signal);
                lowerSeries.push(hist, dif, dea);
            } else if (s === 'RSI' || s === 'WR') {
                const data = s === 'RSI' ? RSI(raw) : WR(raw);
                const line = lowerChart.addLineSeries({ color: p.brand, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
                line.setData(data); lowerSeries.push(line);
            } else if (s === 'KDJ') {
                const k = KDJ(raw);
                [['k', p.brand], ['d', p.gold], ['j', p.down]].forEach(([key, color]) => {
                    const l = lowerChart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
                    l.setData(k[key]); lowerSeries.push(l);
                });
            }
            lowerChart.timeScale().fitContent();
        }

        function applyMainSeries() {
            const p = palette();
            // swap candle/area for the "Time" line mode
            const isLine = TIMEFRAMES.find(t => t.key === tf.value)?.line;
            if (candle) { try { mainChart.removeSeries(candle); } catch {} candle = null; }
            if (area)   { try { mainChart.removeSeries(area); } catch {} area = null; }
            if (isLine) {
                area = mainChart.addAreaSeries({ lineColor: p.brand, topColor: p.brand + '55', bottomColor: p.brand + '05', lineWidth: 2, priceLineVisible: false });
                area.setData(raw.map(r => ({ time: r.time, value: r.close })));
            } else {
                candle = mainChart.addCandlestickSeries({ upColor: p.up, downColor: p.down, borderUpColor: p.up, borderDownColor: p.down, wickUpColor: p.up, wickDownColor: p.down });
                candle.setData(raw);
            }
        }

        async function load() {
            const tfDef = TIMEFRAMES.find(t => t.key === tf.value) || TIMEFRAMES[1];
            raw = await fetchKlines(coin, tfDef.interval, 200);
            applyMainSeries();
            renderOverlays();
            renderLower();
            mainChart.timeScale().fitContent();
            // header stats from data
            if (raw.length) {
                const last = raw[raw.length - 1].close;
                stats.last = last;
                Object.assign(book, genBook(last));
            }
        }

        function makeCharts() {
            mainChart = createChart(mainEl.value, { ...baseChartOpts(300), width: mainEl.value.clientWidth });
            lowerChart = createChart(lowerEl.value, { ...baseChartOpts(120), width: lowerEl.value.clientWidth });
            lowerChart.timeScale().applyOptions({ visible: true });
            // sync time scales both ways
            const syncFrom = (a, b) => a.timeScale().subscribeVisibleLogicalRangeChange(r => {
                if (syncing || !r) return; syncing = true; try { b.timeScale().setVisibleLogicalRange(r); } catch {} syncing = false;
            });
            syncFrom(mainChart, lowerChart); syncFrom(lowerChart, mainChart);
        }

        function applyTheme() {
            if (!mainChart) return;
            mainChart.applyOptions(baseChartOpts(300));
            lowerChart.applyOptions(baseChartOpts(120));
            applyMainSeries(); renderOverlays(); renderLower();
        }

        let ro;
        onMounted(async () => {
            await nextTick();
            makeCharts();
            await load();
            // live 24h stats
            try { const [u] = await fetchTickers([coin]); if (u) { stats.chg = u.chg; stats.high = u.high; stats.low = u.low; stats.vol = u.vol; } } catch {}
            ro = new ResizeObserver(() => {
                if (mainEl.value) mainChart.resize(mainEl.value.clientWidth, 300);
                if (lowerEl.value) lowerChart.resize(lowerEl.value.clientWidth, 120);
            });
            if (mainEl.value) ro.observe(mainEl.value);
        });
        onBeforeUnmount(() => { ro?.disconnect(); try { mainChart?.remove(); lowerChart?.remove(); } catch {} });

        watch(tf, load);
        watch(study, renderLower);
        watch([showMA, showBOLL], renderOverlays);
        watch(() => store.theme, () => { nextTick(applyTheme); });

        const onIndicator = (name) => {
            if (name === 'MA') showMA.value = !showMA.value;
            else if (name === 'BOLL') showBOLL.value = !showBOLL.value;
            else study.value = name;
        };
        const indicatorOn = (name) => name === 'MA' ? showMA.value : name === 'BOLL' ? showBOLL.value : study.value === name;

        return { coin, tf, study, TIMEFRAMES, INDICATORS, stats, book, mainEl, lowerEl, onIndicator, indicatorOn, go, fmtNum, fmtPrice, fmtChg, router };
    },
    template: /*html*/`
    <section class="coin">
        <div class="coin__bar">
            <button class="iconbtn" @click="go('/market')" aria-label="Back"><Icon name="chevronR" style="transform:rotate(180deg)" /></button>
            <h1 class="coin__pair">{{ coin?.sym }}<span class="muted">/USDT</span></h1>
            <button class="iconbtn" aria-label="Favorite"><Icon name="star" /></button>
        </div>

        <div class="coin__stats card">
            <div class="coin__price">
                <div class="coin__last num" :class="stats.chg >= 0 ? 'up' : 'down'">{{ fmtNum(stats.last) }}</div>
                <div class="chip" :class="stats.chg >= 0 ? 'chip--up' : 'chip--down'">{{ fmtChg(stats.chg) }}</div>
            </div>
            <div class="coin__meta">
                <div><span class="muted">24h High</span><b class="num">{{ stats.high ? fmtNum(stats.high) : '—' }}</b></div>
                <div><span class="muted">24h Low</span><b class="num">{{ stats.low ? fmtNum(stats.low) : '—' }}</b></div>
                <div><span class="muted">24h Vol</span><b class="num">{{ stats.vol }}</b></div>
            </div>
        </div>

        <!-- Timeframes -->
        <div class="coin__tfs">
            <button v-for="t in TIMEFRAMES" :key="t.key" class="tf" :class="{ 'is-on': tf === t.key }" @click="tf = t.key">{{ t.key }}</button>
        </div>

        <!-- Charts -->
        <div class="card coin__chartwrap">
            <div ref="mainEl" class="coin__chart"></div>
            <div class="coin__studybar">
                <button v-for="ind in INDICATORS" :key="ind" class="study" :class="{ 'is-on': indicatorOn(ind) }" @click="onIndicator(ind)">{{ ind }}</button>
            </div>
            <div ref="lowerEl" class="coin__lower"></div>
        </div>

        <!-- Entrusted order (book preview) -->
        <div class="sec-head"><h2>Entrusted order</h2></div>
        <div class="card book">
            <div class="book__col">
                <div class="book__h"><span>Price(USDT)</span><span>Amount</span></div>
                <div v-for="(a, i) in book.asks" :key="'a'+i" class="book__row">
                    <span class="book__bar down" :style="{ width: (a.amount * 120) + '%' }"></span>
                    <span class="num down">{{ fmtNum(a.price) }}</span><span class="num">{{ a.amount.toFixed(4) }}</span>
                </div>
            </div>
            <div class="book__mid num">{{ fmtNum(stats.last) }}</div>
            <div class="book__col">
                <div v-for="(b, i) in book.bids" :key="'b'+i" class="book__row">
                    <span class="book__bar up" :style="{ width: (b.amount * 120) + '%' }"></span>
                    <span class="num up">{{ fmtNum(b.price) }}</span><span class="num">{{ b.amount.toFixed(4) }}</span>
                </div>
            </div>
        </div>

        <button class="btn btn--brand btn--block btn--lg coin__cta" @click="go('/trade?pair=' + coin?.sym)">Trade {{ coin?.sym }}</button>
    </section>`,
};
