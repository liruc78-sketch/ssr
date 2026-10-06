// ============================================================================
// Crypto.ssr — Technical indicators (pure functions over kline arrays)
// Each kline: { time, open, high, low, close, volume }.
// Outputs are lightweight-charts-ready: [{ time, value }] (gaps dropped).
// ============================================================================

export function MA(data, period) {
    const out = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i].close;
        if (i >= period) sum -= data[i - period].close;
        if (i >= period - 1) out.push({ time: data[i].time, value: sum / period });
    }
    return out;
}

function emaSeq(values, period) {
    const k = 2 / (period + 1);
    const out = new Array(values.length);
    let prev;
    for (let i = 0; i < values.length; i++) {
        prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
        out[i] = prev;
    }
    return out;
}

export function BOLL(data, period = 20, mult = 2) {
    const upper = [], mid = [], lower = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
        const m = sum / period;
        let v = 0;
        for (let j = i - period + 1; j <= i; j++) v += (data[j].close - m) ** 2;
        const sd = Math.sqrt(v / period);
        mid.push({ time: data[i].time, value: m });
        upper.push({ time: data[i].time, value: m + mult * sd });
        lower.push({ time: data[i].time, value: m - mult * sd });
    }
    return { upper, mid, lower };
}

export function MACD(data, fast = 12, slow = 26, signal = 9) {
    const closes = data.map(d => d.close);
    const ef = emaSeq(closes, fast), es = emaSeq(closes, slow);
    const difArr = closes.map((_, i) => ef[i] - es[i]);
    const dea = emaSeq(difArr, signal);
    const dif = [], sig = [], hist = [];
    for (let i = slow - 1; i < data.length; i++) {
        const h = (difArr[i] - dea[i]) * 2;
        dif.push({ time: data[i].time, value: difArr[i] });
        sig.push({ time: data[i].time, value: dea[i] });
        hist.push({ time: data[i].time, value: h, color: h >= 0 ? 'up' : 'down' });
    }
    return { dif, signal: sig, hist };
}

export function RSI(data, period = 14) {
    const out = [];
    let gain = 0, loss = 0;
    for (let i = 1; i < data.length; i++) {
        const d = data[i].close - data[i - 1].close;
        const g = Math.max(d, 0), l = Math.max(-d, 0);
        if (i <= period) { gain += g; loss += l; if (i === period) { gain /= period; loss /= period; out.push({ time: data[i].time, value: 100 - 100 / (1 + gain / (loss || 1e-9)) }); } }
        else { gain = (gain * (period - 1) + g) / period; loss = (loss * (period - 1) + l) / period; out.push({ time: data[i].time, value: 100 - 100 / (1 + gain / (loss || 1e-9)) }); }
    }
    return out;
}

export function KDJ(data, period = 9, k1 = 3, d1 = 3) {
    const k = [], d = [], j = [];
    let pk = 50, pd = 50;
    for (let i = 0; i < data.length; i++) {
        const s = Math.max(0, i - period + 1);
        let hh = -Infinity, ll = Infinity;
        for (let x = s; x <= i; x++) { hh = Math.max(hh, data[x].high); ll = Math.min(ll, data[x].low); }
        const rsv = hh === ll ? 50 : ((data[i].close - ll) / (hh - ll)) * 100;
        pk = (rsv + (k1 - 1) * pk) / k1;
        pd = (pk + (d1 - 1) * pd) / d1;
        if (i >= period - 1) {
            k.push({ time: data[i].time, value: pk });
            d.push({ time: data[i].time, value: pd });
            j.push({ time: data[i].time, value: 3 * pk - 2 * pd });
        }
    }
    return { k, d, j };
}

export function WR(data, period = 14) {
    const out = [];
    for (let i = period - 1; i < data.length; i++) {
        let hh = -Infinity, ll = Infinity;
        for (let x = i - period + 1; x <= i; x++) { hh = Math.max(hh, data[x].high); ll = Math.min(ll, data[x].low); }
        const v = hh === ll ? -50 : ((hh - data[i].close) / (hh - ll)) * -100;
        out.push({ time: data[i].time, value: v });
    }
    return out;
}

export function VOL(data) {
    return data.map(d => ({ time: d.time, value: d.volume, up: d.close >= d.open }));
}
