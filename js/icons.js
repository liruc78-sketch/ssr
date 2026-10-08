// ============================================================================
// Crypto.ssr — Original line-icon set (24x24, currentColor stroke)
// <Icon name="home" /> — kept inline so there is no icon-font dependency.
// ============================================================================
import { h } from 'vue';

export const ICONS = {
    home:     '<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/>',
    market:   '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    trade:    '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
    finance:  '<path d="M12 4 3 8l9 4 9-4-9-4Z"/><path d="M3 12l9 4 9-4"/><path d="M3 16l9 4 9-4"/>',
    assets:   '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="17" cy="14.5" r="1.3" fill="currentColor" stroke="none"/>',
    bell:     '<path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7Z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
    menu:     '<path d="M4 7h16M4 12h16M4 17h16"/>',
    search:   '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/>',
    close:    '<path d="M6 6l12 12M18 6 6 18"/>',
    chevronR: '<path d="m9 6 6 6-6 6"/>',
    chevronD: '<path d="m6 9 6 6 6-6"/>',
    deposit:  '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8m0 0 3-3m-3 3-3-3"/>',
    withdraw: '<circle cx="12" cy="12" r="8.5"/><path d="M12 16V8m0 0 3 3m-3-3-3 3"/>',
    convert:  '<path d="M5 9h12l-3-3"/><path d="M19 15H7l3 3"/>',
    transfer: '<path d="M7 7h10l-3-3"/><path d="M17 17H7l3 3"/><path d="M4 12h16" opacity=".0"/>',
    history:  '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    globe:    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.5 2.5 14 0 17c-2.5-3-2.5-14.5 0-17Z"/>',
    user:     '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-4 4.5-5 7-5s6 1 7 5"/>',
    shield:   '<path d="M12 3 5 6v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V6l-7-3Z"/><path d="m9.5 12 1.8 1.8 3.2-3.6"/>',
    doc:      '<path d="M7 3h7l4 4v14H7Z" opacity=".0"/><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7Z"/><path d="M14 3v4h4"/>',
    copy:     '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
    chat:     '<path d="M20 12a8 8 0 1 1-3.5-6.6"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="13" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M19 4v4h-4" opacity=".0"/>',
    sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
    moon:     '<path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z"/>',
    star:     '<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8Z"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    bulletin: '<path d="M4 9v6h4l6 4V5l-6 4Z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
    live:     '<circle cx="12" cy="12" r="2.4"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.7 4.7a10 10 0 0 0 0 14.6M19.3 4.7a10 10 0 0 1 0 14.6"/>',
    academy:  '<path d="m12 5 9 4-9 4-9-4 9-4Z"/><path d="M6 11v4c0 1.3 2.7 2.5 6 2.5s6-1.2 6-2.5v-4"/>',
    us:       '<circle cx="12" cy="12" r="8.5"/><path d="M8 15c0 1.1 1.3 1.6 2.6 1.6S13 16 13 15s-1-1.3-2.4-1.6S8.3 12.6 8.3 11.6 9.4 10 10.6 10s2.2.6 2.2 1.5"/><path d="M10.6 8.6v1.4m0 6.6V18"/>',
    fx:       '<path d="M4 8h9l-2.5-2.5"/><path d="M20 16h-9l2.5 2.5"/><circle cx="12" cy="12" r="9" opacity=".0"/>',
    options:  '<path d="M4 14c3 0 3-6 6-6s3 8 6 8 4-4 4-4"/><path d="M4 18h16" opacity=".0"/>',
    logout:   '<path d="M14 7V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2"/><path d="M10 12h10m0 0-3-3m3 3-3 3"/>',
    info:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5m0-8.2v.2"/>',
    check:    '<path d="m5 12.5 4.5 4.5L19 7"/>',
};

export const Icon = {
    name: 'Icon',
    props: { name: { type: String, required: true }, size: { type: [Number, String], default: 24 } },
    setup(props) {
        return () => h('svg', {
            viewBox: '0 0 24 24', width: props.size, height: props.size,
            fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8,
            'stroke-linecap': 'round', 'stroke-linejoin': 'round',
            'aria-hidden': 'true',
            innerHTML: ICONS[props.name] || '',
        });
    },
};
