// ============================================================================
// Crypto.ssr — Market data: seed quotes, categories, live Binance fetchers,
// candlestick klines (with a generated fallback), formatters, activity feed.
// ============================================================================

// --- Crypto (live-capable via Binance) -----------------------------------
export const COINS = [
    { sym: 'BTC',  name: 'Bitcoin',  binance: 'BTCUSDT',  price: 85849.30, chg: -0.93, vol: '1.4B',  color: '#f7931a' },
    { sym: 'ETH',  name: 'Ethereum', binance: 'ETHUSDT',  price: 2714.58,  chg: -0.54, vol: '820M',  color: '#627eea' },
    { sym: 'BNB',  name: 'BNB',      binance: 'BNBUSDT',  price: 786.20,   chg: -1.32, vol: '240M',  color: '#f0b90b' },
    { sym: 'SOL',  name: 'Solana',   binance: 'SOLUSDT',  price: 142.07,   chg:  3.11, vol: '610M',  color: '#14f195' },
    { sym: 'XRP',  name: 'XRP',      binance: 'XRPUSDT',  price: 1.5092,   chg: -0.91, vol: '430M',  color: '#1b1f24' },
    { sym: 'ADA',  name: 'Cardano',  binance: 'ADAUSDT',  price: 0.2707,   chg:  2.69, vol: '180M',  color: '#0033ad' },
    { sym: 'LTC',  name: 'Litecoin', binance: 'LTCUSDT',  price: 69.85,    chg: -1.33, vol: '96M',   color: '#345d9d' },
    { sym: 'DOGE', name: 'Dogecoin', binance: 'DOGEUSDT', price: 0.1584,   chg:  1.22, vol: '210M',  color: '#c3a634' },
    { sym: 'TRX',  name: 'TRON',     binance: 'TRXUSDT',  price: 0.2412,   chg:  0.45, vol: '88M',   color: '#eb0029' },
    { sym: 'NEO',  name: 'NEO',      binance: 'NEOUSDT',  price: 2.558,    chg: -0.62, vol: '41M',   color: '#00e599' },
];

// --- US stocks (generated charts; no public no-key source) ---------------
export const US_STOCKS = [
    { sym: 'AAPL', name: 'Apple',     price: 232.14, chg:  0.84, vol: '48M',  color: '#101114' },
    { sym: 'TSLA', name: 'Tesla',     price: 418.70, chg: -1.92, vol: '92M',  color: '#e82127' },
    { sym: 'NVDA', name: 'NVIDIA',    price: 138.45, chg:  2.31, vol: '210M', color: '#76b900' },
    { sym: 'AMZN', name: 'Amazon',    price: 221.30, chg:  0.42, vol: '35M',  color: '#ff9900' },
    { sym: 'MSFT', name: 'Microsoft', price: 429.18, chg: -0.21, vol: '22M',  color: '#2f7cff' },
    { sym: 'META', name: 'Meta',      price: 602.55, chg:  1.14, vol: '14M',  color: '#1877f2' },
];

// --- FX pairs (generated charts) -----------------------------------------
export const FX = [
    { sym: 'EURUSD', name: 'Euro / USD',   price: 1.0842, chg:  0.12, vol: '—', color: '#2f49d6' },
    { sym: 'GBPUSD', name: 'Pound / USD',  price: 1.2718, chg: -0.08, vol: '—', color: '#8b1e3f' },
    { sym: 'USDJPY', name: 'USD / Yen',    price: 151.34, chg:  0.26, vol: '—', color: '#bc002d' },
    { sym: 'AUDUSD', name: 'Aussie / USD', price: 0.6612, chg: -0.15, vol: '—', color: '#00843d' },
    { sym: 'USDCAD', name: 'USD / Loonie', price: 1.3745, chg:  0.09, vol: '—', color: '#d52b1e' },
];

export const CATEGORIES = [
    { key: 'watch',  label: 'Watchlists' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'us',     label: 'US stocks' },
    { key: 'fx',     label: 'FX' },
];

export function listFor(cat) {
    if (cat === 'crypto') return COINS;
    if (cat === 'us') return US_STOCKS;
    if (cat === 'fx') return FX;
    return COINS; // watchlist handled by the view against its stored set
}
export function findSym(sym) {
    return [...COINS, ...US_STOCKS, ...FX].find(c => c.sym === sym) || null;
}

// --- Timeframes (label -> Binance interval) ------------------------------
export const TIMEFRAMES = [
    { key: 'Time', interval: '1m', line: true },
    { key: '1m',   interval: '1m' },
    { key: '5m',   interval: '5m' },
    { key: '15m',  interval: '15m' },
    { key: '30m',  interval: '30m' },
    { key: '1H',   interval: '1h' },
    { key: '1D',   interval: '1d' },
];

// --- Formatters ----------------------------------------------------------
export function fmtPrice(p) {
    if (p == null || isNaN(p)) return '—';
    const d = p >= 1000 ? 2 : p >= 1 ? 2 : p >= 0.01 ? 4 : 6;
    return '$' + Number(p).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtNum(p) {
    if (p == null || isNaN(p)) return '—';
    const d = p >= 1000 ? 2 : p >= 1 ? 2 : p >= 0.01 ? 4 : 6;
    return Number(p).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtChg(c) { return (c > 0 ? '+' : '') + Number(c).toFixed(2) + '%'; }
export function fmtAmt(n) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function fmtVol(v) {
    if (v == null || isNaN(v)) return '—';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return v.toFixed(2);
}

// --- Live data (Binance public REST; falls back silently) ----------------
const BINANCE = 'https://api.binance.com/api/v3';

// Returns a NEW array (so the caller controls reactivity) with live price/chg/vol
// merged onto the provided crypto list. Non-crypto lists return unchanged.
export async function fetchTickers(list) {
    const syms = list.filter(c => c.binance).map(c => `"${c.binance}"`);
    if (!syms.length) return list;
    const res = await fetch(`${BINANCE}/ticker/24hr?symbols=[${syms.join(',')}]`);
    if (!res.ok) throw new Error('ticker ' + res.status);
    const data = await res.json();
    const by = Object.fromEntries(data.map(d => [d.symbol, d]));
    return list.map(c => {
        const d = c.binance && by[c.binance];
        return d ? { ...c, price: +d.lastPrice, chg: +d.priceChangePercent, vol: fmtVol(+d.quoteVolume), high: +d.highPrice, low: +d.lowPrice } : c;
    });
}

// Candles -> [{ time, open, high, low, close, volume }] (time in seconds).
export async function fetchKlines(coin, interval = '1m', limit = 200) {
    if (!coin?.binance) return genKlines(coin, interval, limit);
    try {
        const res = await fetch(`${BINANCE}/klines?symbol=${coin.binance}&interval=${interval}&limit=${limit}`);
        if (!res.ok) throw new Error('klines ' + res.status);
        const rows = await res.json();
        return rows.map(r => ({ time: Math.floor(r[0] / 1000), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] }));
    } catch (e) {
        return genKlines(coin, interval, limit);
    }
}

// Deterministic-ish random-walk candles for symbols with no live source.
export function genKlines(coin, interval = '1m', limit = 200) {
    const stepSec = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '1d': 86400 }[interval] || 60;
    const now = Math.floor(Date.now() / 1000);
    const start = now - stepSec * limit;
    let px = coin?.price || 100;
    const vol = px * 0.004;
    const out = [];
    for (let i = 0; i < limit; i++) {
        const open = px;
        const drift = (Math.random() - 0.5) * vol * 2;
        const close = Math.max(0.0001, open + drift);
        const high = Math.max(open, close) + Math.random() * vol;
        const low = Math.min(open, close) - Math.random() * vol;
        out.push({ time: start + i * stepSec, open, high, low, close, volume: Math.random() * 1000 + 100 });
        px = close;
    }
    return out;
}

// Order-book snapshot around a price (for the chart's "Entrusted order" preview).
export function genBook(price, rows = 6) {
    const asks = [], bids = [];
    const tick = price * 0.0001;
    for (let i = 1; i <= rows; i++) {
        asks.push({ price: price + tick * i, amount: (Math.random() * 0.5 + 0.02) });
        bids.push({ price: price - tick * i, amount: (Math.random() * 0.5 + 0.02) });
    }
    return { asks: asks.reverse(), bids };
}

// --- Trade config --------------------------------------------------------
// Option (binary) tiers mirror the legacy site's price-prediction tiers.
export const OPTION_TIERS = [
    { sec: 30,  label: '30s',  payout: 1.15, min: 0 },
    { sec: 60,  label: '60s',  payout: 1.25, min: 10000 },
    { sec: 120, label: '120s', payout: 1.35, min: 200000 },
    { sec: 240, label: '240s', payout: 1.45, min: 500000 },
    { sec: 480, label: '480s', payout: 1.55, min: 1000000 },
];
export const LEVERAGES = [1, 25, 50, 75, 100];

// Finance / Earn products (daily-return model). Flexible term = 0.
export const FINANCE_PRODUCTS = [
    // Current (flexible)
    { id: 'usdt-flex', cat: 'current', asset: 'USDT', name: 'USDT Flexible', yield: 'Low Yield', dmin: 0.0685, dmax: 0.481, buyers: 55973, min: 100, max: 1000000, term: 0, color: '#26a17b' },
    { id: 'btc-flex',  cat: 'current', asset: 'BTC',  name: 'BTC Flexible',  yield: 'Low Yield', dmin: 0.0210, dmax: 0.118, buyers: 12430, min: 0.001, max: 50, term: 0, color: '#f7931a' },
    { id: 'eth-flex',  cat: 'current', asset: 'ETH',  name: 'ETH Flexible',  yield: 'Low Yield', dmin: 0.0320, dmax: 0.140, buyers: 9871,  min: 0.01, max: 500, term: 0, color: '#627eea' },
    // AI Quant (fixed term)
    { id: 'quant-7',   cat: 'quant', asset: 'USDT', name: 'Quant Alpha', yield: 'High Yield', dmin: 0.201, dmax: 0.482, buyers: 8221, min: 500,  max: 500000, term: 7,  color: '#5b73ff' },
    { id: 'quant-15',  cat: 'quant', asset: 'USDT', name: 'Neural Grid', yield: 'High Yield', dmin: 0.284, dmax: 0.556, buyers: 5002, min: 1000, max: 800000, term: 15, color: '#e24fe2' },
    { id: 'quant-30',  cat: 'quant', asset: 'USDT', name: 'Quant Pro',   yield: 'High Yield', dmin: 0.351, dmax: 0.628, buyers: 3140, min: 2000, max: 1000000, term: 30, color: '#f0a020' },
];

// Mini sparkline points (0..100 range) for finance cards.
export function genSpark(n = 24, up = true) {
    const pts = []; let v = 50;
    for (let i = 0; i < n; i++) { v += (Math.random() - (up ? 0.42 : 0.58)) * 14; v = Math.max(8, Math.min(92, v)); pts.push(v); }
    return pts;
}

// --- Activity feed & FAQ (unchanged shape) -------------------------------
const PRODUCTS = ['Spot', 'Contract', 'Follow orders', 'AI Quant'];
export function genFeed(n = 8) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const letter = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        const amt = (Math.random() * 9000 + 120);
        const mins = Math.floor(Math.random() * 230) + 2;
        out.push({
            user: 'z∗∗∗∗∗∗' + letter,
            product: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
            ago: mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} h ago`,
            amount: fmtAmt(amt),
            up: Math.random() > 0.4,
        });
    }
    return out;
}

export const FAQ = [
    { q: 'What products does the platform offer?', a: 'Crypto.ssr offers spot trading across hundreds of pairs, perpetual contracts with up to 100× leverage, short-term options, and finance products that let you earn on idle balances — all from one account.' },
    { q: 'Is my account secure?', a: 'Balances are protected with encrypted storage, device and withdrawal-address alerts, and optional two-factor authentication. You control which devices and DApps can connect.' },
    { q: 'Who can trade on Crypto.ssr?', a: 'Any verified user in a supported region can open an account. Simulated Trading lets you practice risk-free before going live.' },
    { q: 'How are trades settled?', a: 'We use off-chain matching with on-chain settlement, so you get exchange-grade speed while keeping the transparency of on-chain records.' },
];
