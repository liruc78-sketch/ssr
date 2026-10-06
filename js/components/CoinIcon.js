// ============================================================================
// Crypto.ssr — CoinIcon: real coin artwork with a graceful fallback.
// Loads the spothq/cryptocurrency-icons set (color SVG) by ticker; if the coin
// has no icon (stocks, FX, or an unlisted token) it falls back to the original
// colored-initial disc, so every market row still renders something on-brand.
//   <CoinIcon sym="BTC" :color="c.color" cls="quote__ico" />
// `cls` is the caller's existing size class (quote__ico / market__ico / fin__coin)
// so the icon inherits the exact dimensions already defined in the stylesheet.
// ============================================================================
import { h, ref, watch } from 'vue';

const BASE = 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/';

export const CoinIcon = {
    name: 'CoinIcon',
    props: {
        sym:    { type: String, required: true },
        color:  { type: String, default: '#8891a0' },
        cls:    { type: String, default: '' },
        // Only crypto tickers exist in the icon set; stocks/FX skip the lookup
        // and render the colored-initial disc directly (no wasted 404s / flash).
        crypto: { type: Boolean, default: true },
    },
    setup(props) {
        const failed = ref(false);
        // A new symbol gets a fresh chance to load its artwork.
        watch(() => props.sym, () => { failed.value = false; });

        return () => {
            const classes = ['coin-ic', props.cls];
            if (!props.crypto || failed.value || !props.sym) {
                return h('span',
                    { class: [...classes, 'coin-ic--fallback'], style: { background: props.color } },
                    (props.sym || '?').slice(0, 1).toUpperCase());
            }
            return h('img', {
                class: classes,
                src: BASE + props.sym.toLowerCase() + '.svg',
                alt: props.sym,
                loading: 'lazy',
                draggable: 'false',
                // Coloured disc shows while the artwork loads, so there is no white flash.
                style: { background: props.color },
                onError: () => { failed.value = true; },
            });
        };
    },
};
