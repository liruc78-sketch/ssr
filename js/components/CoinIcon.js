// ============================================================================
// Crypto.ssr — CoinIcon: real artwork for every instrument, with a graceful
// fallback to a coloured-initial disc.
//   crypto → spothq SVG, then CoinCap PNG         <CoinIcon sym="BTC" :color="c.color" />
//   stock  → company logo by domain (Clearbit)    <CoinIcon ... :domain="c.domain" />
//   FX     → the two currencies' flags (flagcdn)  <CoinIcon ... :fxbase="eu" :fxquote="us" />
// `cls` is the caller's existing size class (market__ico / qcard__ico / …) so
// the icon inherits the dimensions already defined in the stylesheet.
// ============================================================================
import { h, ref, watch } from 'vue';

// Crypto artwork, tried in order per ticker: spothq (crisp SVG for the majors)
// then CoinCap (covers newer coins spothq lacks).
const CRYPTO_SOURCES = [
    s => `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${s}.svg`,
    s => `https://assets.coincap.io/assets/icons/${s}@2x.png`,
];
// Stock logos by ticker (FMP first, then Parqet). Clearbit's free logo API was
// sunset, so both of these are keyed on the symbol, not a company domain.
const STOCK_SOURCES = [
    s => `https://financialmodelingprep.com/image-stock/${s}.png`,
    s => `https://assets.parqet.com/logos/symbol/${s}`,
];
const flagUrl = (cc) => `https://flagcdn.com/${cc}.svg`;

export const CoinIcon = {
    name: 'CoinIcon',
    props: {
        sym:     { type: String, required: true },
        color:   { type: String, default: '#8891a0' },
        cls:     { type: String, default: '' },
        crypto:  { type: Boolean, default: true },   // crypto tickers use the artwork chain
        domain:  { type: String, default: '' },      // stocks: company domain for the logo
        fxbase:  { type: String, default: '' },      // FX: base-currency country code (e.g. 'eu')
        fxquote: { type: String, default: '' },      // FX: quote-currency country code (e.g. 'us')
    },
    setup(props) {
        const failed = ref(false);
        const idx = ref(0);   // which CRYPTO_SOURCES entry we're on
        // A new instrument gets a fresh chance to load its artwork.
        watch(() => props.sym, () => { failed.value = false; idx.value = 0; });

        const disc = (classes) => h('span',
            { class: [...classes, 'coin-ic--fallback'], style: { background: props.color } },
            (props.sym || '?').slice(0, 1).toUpperCase());

        return () => {
            const classes = ['coin-ic', props.cls];

            // FX pair → the base + quote flags as a split badge.
            if (props.fxbase) {
                if (failed.value) return disc(classes);
                return h('span', { class: [...classes, 'coin-ic--fx'] }, [
                    h('img', { src: flagUrl(props.fxbase), alt: '', draggable: 'false', loading: 'lazy', onError: () => { failed.value = true; } }),
                    props.fxquote ? h('img', { src: flagUrl(props.fxquote), alt: '', draggable: 'false', loading: 'lazy', onError: () => { failed.value = true; } }) : null,
                ]);
            }

            // Stock → company logo (FMP, then Parqet), disc if neither loads.
            // `domain` just marks the instrument as a listed company; the logo
            // is fetched by ticker.
            if (props.domain) {
                if (failed.value) return disc(classes);
                return h('img', {
                    class: [...classes, 'coin-ic--logo'],
                    src: STOCK_SOURCES[idx.value]((props.sym || '').toUpperCase()),
                    alt: props.sym, loading: 'lazy', draggable: 'false',
                    onError: () => { if (idx.value < STOCK_SOURCES.length - 1) idx.value++; else failed.value = true; },
                });
            }

            // Crypto artwork chain.
            if (!props.crypto || failed.value || !props.sym) return disc(classes);
            return h('img', {
                class: classes,
                src: CRYPTO_SOURCES[idx.value](props.sym.toLowerCase()),
                alt: props.sym, loading: 'lazy', draggable: 'false',
                style: { background: props.color },
                onError: () => { if (idx.value < CRYPTO_SOURCES.length - 1) idx.value++; else failed.value = true; },
            });
        };
    },
};
