// ============================================================================
// Crypto.ssr — Market data: seed quotes, categories, live Binance fetchers,
// candlestick klines (with a generated fallback), formatters, activity feed.
// ============================================================================

// --- Crypto (live-capable via Binance) -----------------------------------
export const COINS = [
    { sym: 'BTC', name: 'Bitcoin', binance: 'BTCUSDT', cg: 'bitcoin', price: 82868.99, chg: -1.51, vol: '1.7B', color: '#f7931a' },
    { sym: 'ETH', name: 'Ethereum', binance: 'ETHUSDT', cg: 'ethereum', price: 2573.07, chg: -1.34, vol: '928M', color: '#627eea' },
    { sym: 'BNB', name: 'BNB', binance: 'BNBUSDT', cg: 'binancecoin', price: 768.48, chg: 0.23, vol: '72M', color: '#f0b90b' },
    { sym: 'USDT', name: 'Tether', binance: '', cg: 'tether', price: 1.0, chg: 0, vol: '—', color: '#26a17b' },
    { sym: 'USDC', name: 'USD Coin', binance: 'USDCUSDT', cg: 'usd-coin', price: 1.0004, chg: 0.03, vol: '4.5B', color: '#2775ca' },
    { sym: 'SOL', name: 'Solana', binance: 'SOLUSDT', cg: 'solana', price: 115.53, chg: -2.33, vol: '207M', color: '#14f195' },
    { sym: 'XRP', name: 'XRP', binance: 'XRPUSDT', cg: 'ripple', price: 1.409, chg: -3.75, vol: '194M', color: '#1b1f24' },
    { sym: 'ADA', name: 'Cardano', binance: 'ADAUSDT', cg: 'cardano', price: 0.2546, chg: 0.04, vol: '41M', color: '#0033ad' },
    { sym: 'LTC', name: 'Litecoin', binance: 'LTCUSDT', cg: 'litecoin', price: 65.16, chg: -3.58, vol: '22M', color: '#345d9d' },
    { sym: 'DOGE', name: 'Dogecoin', binance: 'DOGEUSDT', cg: 'dogecoin', price: 0.0878, chg: -2.39, vol: '94M', color: '#c3a634' },
    { sym: 'TRX', name: 'TRON', binance: 'TRXUSDT', cg: 'tron', price: 0.3351, chg: 0.87, vol: '29M', color: '#eb0029' },
    { sym: 'NEO', name: 'NEO', binance: 'NEOUSDT', cg: 'neo', price: 2.394, chg: -0.17, vol: '786K', color: '#00e599' },
    { sym: 'AVAX', name: 'Avalanche', binance: 'AVAXUSDT', cg: 'avalanche-2', price: 10.863, chg: -1.34, vol: '63M', color: '#e84142' },
    { sym: 'DOT', name: 'Polkadot', binance: 'DOTUSDT', cg: 'polkadot', price: 1.103, chg: -1.78, vol: '10M', color: '#e6007a' },
    { sym: 'LINK', name: 'Chainlink', binance: 'LINKUSDT', cg: 'chainlink', price: 13.163, chg: -3.04, vol: '24M', color: '#2a5ada' },
    { sym: 'POL', name: 'Polygon', binance: 'POLUSDT', cg: 'polygon-ecosystem-token', price: 0.10139, chg: -1.74, vol: '7M', color: '#8247e5' },
    { sym: 'UNI', name: 'Uniswap', binance: 'UNIUSDT', cg: 'uniswap', price: 7.852, chg: -3.04, vol: '67M', color: '#ff007a' },
    { sym: 'ATOM', name: 'Cosmos', binance: 'ATOMUSDT', cg: 'cosmos', price: 1.721, chg: 0.58, vol: '2M', color: '#2e3148' },
    { sym: 'XLM', name: 'Stellar', binance: 'XLMUSDT', cg: 'stellar', price: 0.1992, chg: -3.21, vol: '14M', color: '#14b6e7' },
    { sym: 'BCH', name: 'Bitcoin Cash', binance: 'BCHUSDT', cg: 'bitcoin-cash', price: 297.7, chg: -2.78, vol: '12M', color: '#0ac18e' },
    { sym: 'ETC', name: 'Ethereum Classic', binance: 'ETCUSDT', cg: 'ethereum-classic', price: 8.4, chg: -0.94, vol: '4M', color: '#328332' },
    { sym: 'FIL', name: 'Filecoin', binance: 'FILUSDT', cg: 'filecoin', price: 1.052, chg: -3.34, vol: '14M', color: '#0090ff' },
    { sym: 'APT', name: 'Aptos', binance: 'APTUSDT', cg: 'aptos', price: 0.7695, chg: 0.63, vol: '10M', color: '#1c6fff' },
    { sym: 'ARB', name: 'Arbitrum', binance: 'ARBUSDT', cg: 'arbitrum', price: 0.1838, chg: -0.97, vol: '12M', color: '#28a0f0' },
    { sym: 'OP', name: 'Optimism', binance: 'OPUSDT', cg: 'optimism', price: 0.1211, chg: -0.41, vol: '8M', color: '#ff0420' },
    { sym: 'NEAR', name: 'NEAR Protocol', binance: 'NEARUSDT', cg: 'near', price: 5.404, chg: 8.93, vol: '181M', color: '#00c08b' },
    { sym: 'ICP', name: 'Internet Computer', binance: 'ICPUSDT', cg: 'internet-computer', price: 3.195, chg: -0.56, vol: '7M', color: '#29abe2' },
    { sym: 'VET', name: 'VeChain', binance: 'VETUSDT', cg: 'vechain', price: 0.007883, chg: -4.05, vol: '1M', color: '#15bdff' },
    { sym: 'HBAR', name: 'Hedera', binance: 'HBARUSDT', cg: 'hedera-hashgraph', price: 0.09252, chg: -3.19, vol: '14M', color: '#222222' },
    { sym: 'ALGO', name: 'Algorand', binance: 'ALGOUSDT', cg: 'algorand', price: 0.1179, chg: -1.01, vol: '3M', color: '#1a1a1a' },
    { sym: 'AAVE', name: 'Aave', binance: 'AAVEUSDT', cg: 'aave', price: 173.68, chg: -0.17, vol: '24M', color: '#b6509e' },
    { sym: 'MKR', name: 'Maker', binance: 'MKRUSDT', cg: 'maker', price: 1813.7, chg: 0.76, vol: '441K', color: '#1aab9b' },
    { sym: 'SAND', name: 'The Sandbox', binance: 'SANDUSDT', cg: 'the-sandbox', price: 0.07629, chg: 9.8, vol: '44M', color: '#00adef' },
    { sym: 'MANA', name: 'Decentraland', binance: 'MANAUSDT', cg: 'decentraland', price: 0.101, chg: 3.48, vol: '4M', color: '#ff2d55' },
    { sym: 'AXS', name: 'Axie Infinity', binance: 'AXSUSDT', cg: 'axie-infinity', price: 1.2, chg: 0.84, vol: '4M', color: '#0055d5' },
    { sym: 'THETA', name: 'Theta', binance: 'THETAUSDT', cg: 'theta-token', price: 0.215, chg: -2.49, vol: '841K', color: '#2ab8e6' },
    { sym: 'EOS', name: 'EOS', binance: 'EOSUSDT', cg: 'eos', price: 0.7799, chg: -0.66, vol: '924K', color: '#1a1a1a' },
    { sym: 'XTZ', name: 'Tezos', binance: 'XTZUSDT', cg: 'tezos', price: 0.305, chg: -2.87, vol: '844K', color: '#2c7df7' },
    { sym: 'GRT', name: 'The Graph', binance: 'GRTUSDT', cg: 'the-graph', price: 0.02732, chg: -1.26, vol: '1M', color: '#6f4cff' },
    { sym: 'RUNE', name: 'THORChain', binance: 'RUNEUSDT', cg: 'thorchain', price: 0.712, chg: -2.6, vol: '3M', color: '#33ff99' },
    { sym: 'INJ', name: 'Injective', binance: 'INJUSDT', cg: 'injective-protocol', price: 7.373, chg: -1.57, vol: '14M', color: '#00d2ff' },
    { sym: 'SUI', name: 'Sui', binance: 'SUIUSDT', cg: 'sui', price: 1.135, chg: -0.26, vol: '67M', color: '#4da2ff' },
    { sym: 'SEI', name: 'Sei', binance: 'SEIUSDT', cg: 'sei-network', price: 0.069, chg: -0.76, vol: '5M', color: '#9e1f19' },
    { sym: 'TIA', name: 'Celestia', binance: 'TIAUSDT', cg: 'celestia', price: 0.4748, chg: 6.5, vol: '7M', color: '#7b2bf9' },
    { sym: 'PEPE', name: 'Pepe', binance: 'PEPEUSDT', cg: 'pepe', price: 0.00000405, chg: -1.22, vol: '22M', color: '#4caf50' },
    { sym: 'SHIB', name: 'Shiba Inu', binance: 'SHIBUSDT', cg: 'shiba-inu', price: 0.0000054, chg: -2.53, vol: '5M', color: '#ffa409' },
    { sym: 'WIF', name: 'dogwifhat', binance: 'WIFUSDT', cg: 'dogwifcoin', price: 0.2252, chg: -3.02, vol: '3M', color: '#c9a37a' },
    { sym: 'BONK', name: 'Bonk', binance: 'BONKUSDT', cg: 'bonk', price: 0.00000346, chg: -0.57, vol: '4M', color: '#f5a623' },
    { sym: 'LDO', name: 'Lido DAO', binance: 'LDOUSDT', cg: 'lido-dao', price: 0.4603, chg: 5.91, vol: '5M', color: '#00a3ff' },
    { sym: 'CRV', name: 'Curve', binance: 'CRVUSDT', cg: 'curve-dao-token', price: 0.3897, chg: 10.43, vol: '8M', color: '#ff0000' },
    { sym: 'SNX', name: 'Synthetix', binance: 'SNXUSDT', cg: 'havven', price: 0.2399, chg: -1.19, vol: '439K', color: '#00d1ff' },
    { sym: 'COMP', name: 'Compound', binance: 'COMPUSDT', cg: 'compound-governance-token', price: 23.44, chg: 1.17, vol: '2M', color: '#00d395' },
    { sym: 'GALA', name: 'Gala', binance: 'GALAUSDT', cg: 'gala', price: 0.0023, chg: -0.26, vol: '3M', color: '#121212' },
    { sym: 'CHZ', name: 'Chiliz', binance: 'CHZUSDT', cg: 'chiliz', price: 0.01559, chg: -1.33, vol: '1M', color: '#cd0124' },
    { sym: 'ENJ', name: 'Enjin', binance: 'ENJUSDT', cg: 'enjincoin', price: 0.03018, chg: -0.79, vol: '2M', color: '#624dbf' },
    { sym: 'FLOW', name: 'Flow', binance: 'FLOWUSDT', cg: 'flow', price: 0.03155, chg: -0.32, vol: '1M', color: '#00ef8b' },
    { sym: 'EGLD', name: 'MultiversX', binance: 'EGLDUSDT', cg: 'elrond-erd-2', price: 4.12, chg: -0.43, vol: '585K', color: '#1b46c2' },
    { sym: 'KAVA', name: 'Kava', binance: 'KAVAUSDT', cg: 'kava', price: 0.06694, chg: 0.6, vol: '284K', color: '#ff564f' },
    { sym: 'ZEC', name: 'Zcash', binance: 'ZECUSDT', cg: 'zcash', price: 1256.57, chg: -4.7, vol: '157M', color: '#f4b728' },
    { sym: 'DASH', name: 'Dash', binance: 'DASHUSDT', cg: 'dash', price: 53.6, chg: -0.04, vol: '7M', color: '#008ce7' },
    { sym: 'MINA', name: 'Mina', binance: 'MINAUSDT', cg: 'mina-protocol', price: 0.0925, chg: -11.31, vol: '14M', color: '#2d2d2d' },
    { sym: 'FET', name: 'Fetch.ai', binance: 'FETUSDT', cg: 'fetch-ai', price: 0.2287, chg: 0.22, vol: '19M', color: '#1d2951' },
    { sym: 'RENDER', name: 'Render', binance: 'RENDERUSDT', cg: 'render-token', price: 2.009, chg: -2.19, vol: '8M', color: '#ff5a5f' },
    { sym: 'IMX', name: 'Immutable', binance: 'IMXUSDT', cg: 'immutable-x', price: 0.1751, chg: 0.11, vol: '749K', color: '#17b5cb' },
    { sym: 'STX', name: 'Stacks', binance: 'STXUSDT', cg: 'blockstack', price: 0.3647, chg: -7.32, vol: '5M', color: '#5546ff' },
    { sym: 'AR', name: 'Arweave', binance: 'ARUSDT', cg: 'arweave', price: 4.16, chg: -2.85, vol: '3M', color: '#222222' },
    { sym: 'APE', name: 'ApeCoin', binance: 'APEUSDT', cg: 'apecoin', price: 0.148, chg: -0.8, vol: '2M', color: '#0b4ee6' },
    { sym: 'GMT', name: 'STEPN', binance: 'GMTUSDT', cg: 'stepn', price: 0.00807, chg: -2.65, vol: '499K', color: '#cbae7f' },
    { sym: 'DYDX', name: 'dYdX', binance: 'DYDXUSDT', cg: 'dydx-chain', price: 0.13249, chg: -0.81, vol: '1M', color: '#6966ff' },
    { sym: 'ENS', name: 'ENS', binance: 'ENSUSDT', cg: 'ethereum-name-service', price: 6.57, chg: 1.55, vol: '1M', color: '#5298ff' },
    { sym: 'JUP', name: 'Jupiter', binance: 'JUPUSDT', cg: 'jupiter-exchange-solana', price: 0.374, chg: 14.48, vol: '11M', color: '#22c55e' },
    { sym: 'PYTH', name: 'Pyth', binance: 'PYTHUSDT', cg: 'pyth-network', price: 0.07309, chg: 1.64, vol: '3M', color: '#8646e5' },
    { sym: 'WLD', name: 'Worldcoin', binance: 'WLDUSDT', cg: 'worldcoin-wld', price: 0.517, chg: 0.23, vol: '31M', color: '#1a1a1a' },
    { sym: 'ORDI', name: 'ORDI', binance: 'ORDIUSDT', cg: 'ordinals', price: 4.435, chg: 4.16, vol: '3M', color: '#1a1a1a' },
    { sym: '1INCH', name: '1inch', binance: '1INCHUSDT', cg: '1inch', price: 0.0982, chg: -1.11, vol: '560K', color: '#1a2f52' },
    { sym: 'LRC', name: 'Loopring', binance: 'LRCUSDT', cg: 'loopring', price: 0.01879, chg: -4.23, vol: '191K', color: '#1c60ff' },
    { sym: 'FTM', name: 'Fantom', binance: 'FTMUSDT', cg: 'fantom', price: 0.6994, chg: -0.77, vol: '1M', color: '#1969ff' },
];

// --- US stocks (generated charts; logo by company domain via Clearbit) ----
export const US_STOCKS = [
    { sym: 'AAPL',  name: 'Apple',           domain: 'apple.com',         price: 232.14, chg:  0.84, vol: '48M',  color: '#101114' },
    { sym: 'MSFT',  name: 'Microsoft',       domain: 'microsoft.com',     price: 429.18, chg: -0.21, vol: '22M',  color: '#2f7cff' },
    { sym: 'NVDA',  name: 'NVIDIA',          domain: 'nvidia.com',        price: 138.45, chg:  2.31, vol: '210M', color: '#76b900' },
    { sym: 'AMZN',  name: 'Amazon',          domain: 'amazon.com',        price: 221.30, chg:  0.42, vol: '35M',  color: '#ff9900' },
    { sym: 'GOOGL', name: 'Alphabet',        domain: 'google.com',        price: 178.35, chg:  0.67, vol: '28M',  color: '#4285f4' },
    { sym: 'META',  name: 'Meta Platforms',  domain: 'meta.com',          price: 602.55, chg:  1.14, vol: '14M',  color: '#1877f2' },
    { sym: 'TSLA',  name: 'Tesla',           domain: 'tesla.com',         price: 418.70, chg: -1.92, vol: '92M',  color: '#e82127' },
    { sym: 'AVGO',  name: 'Broadcom',        domain: 'broadcom.com',      price: 234.60, chg:  1.48, vol: '18M',  color: '#cc092f' },
    { sym: 'NFLX',  name: 'Netflix',         domain: 'netflix.com',       price: 835.40, chg:  0.53, vol: '4M',   color: '#e50914' },
    { sym: 'AMD',   name: 'AMD',             domain: 'amd.com',           price: 138.75, chg: -0.94, vol: '46M',  color: '#ed1c24' },
    { sym: 'INTC',  name: 'Intel',           domain: 'intel.com',         price: 24.15,  chg: -1.37, vol: '55M',  color: '#0071c5' },
    { sym: 'JPM',   name: 'JPMorgan Chase',  domain: 'jpmorganchase.com', price: 242.60, chg:  0.38, vol: '9M',   color: '#1a3c6e' },
    { sym: 'V',     name: 'Visa',            domain: 'visa.com',          price: 312.80, chg:  0.22, vol: '6M',   color: '#1a1f71' },
    { sym: 'MA',    name: 'Mastercard',      domain: 'mastercard.com',    price: 523.10, chg:  0.44, vol: '3M',   color: '#eb001b' },
    { sym: 'BAC',   name: 'Bank of America', domain: 'bankofamerica.com', price: 45.20,  chg: -0.31, vol: '38M',  color: '#012169' },
    { sym: 'DIS',   name: 'Walt Disney',     domain: 'disney.com',        price: 112.45, chg:  0.76, vol: '10M',  color: '#113ccf' },
    { sym: 'BA',    name: 'Boeing',          domain: 'boeing.com',        price: 178.90, chg: -1.05, vol: '7M',   color: '#0039a6' },
    { sym: 'KO',    name: 'Coca-Cola',       domain: 'coca-cola.com',     price: 62.80,  chg:  0.18, vol: '12M',  color: '#f40009' },
    { sym: 'PEP',   name: 'PepsiCo',         domain: 'pepsico.com',       price: 152.30, chg: -0.24, vol: '5M',   color: '#004883' },
    { sym: 'MCD',   name: "McDonald's",      domain: 'mcdonalds.com',     price: 295.60, chg:  0.31, vol: '3M',   color: '#da291c' },
    { sym: 'NKE',   name: 'Nike',            domain: 'nike.com',          price: 76.40,  chg: -0.58, vol: '9M',   color: '#111111' },
    { sym: 'WMT',   name: 'Walmart',         domain: 'walmart.com',       price: 92.15,  chg:  0.49, vol: '16M',  color: '#0071ce' },
    { sym: 'COST',  name: 'Costco',          domain: 'costco.com',        price: 915.20, chg:  0.37, vol: '2M',   color: '#005daa' },
    { sym: 'PYPL',  name: 'PayPal',          domain: 'paypal.com',        price: 88.70,  chg:  1.22, vol: '11M',  color: '#003087' },
    { sym: 'UBER',  name: 'Uber',            domain: 'uber.com',          price: 72.30,  chg: -0.66, vol: '14M',  color: '#0a0a0a' },
    { sym: 'COIN',  name: 'Coinbase',        domain: 'coinbase.com',      price: 298.50, chg:  3.41, vol: '8M',   color: '#0052ff' },
    { sym: 'ORCL',  name: 'Oracle',          domain: 'oracle.com',        price: 188.20, chg:  0.52, vol: '7M',   color: '#f80000' },
    { sym: 'CRM',   name: 'Salesforce',      domain: 'salesforce.com',    price: 345.80, chg: -0.41, vol: '4M',   color: '#00a1e0' },
    { sym: 'ADBE',  name: 'Adobe',           domain: 'adobe.com',         price: 512.40, chg:  0.29, vol: '3M',   color: '#fa0f00' },
    { sym: 'QCOM',  name: 'Qualcomm',        domain: 'qualcomm.com',      price: 168.90, chg: -0.73, vol: '8M',   color: '#3253dc' },
    { sym: 'IBM',   name: 'IBM',             domain: 'ibm.com',           price: 235.10, chg:  0.44, vol: '4M',   color: '#0530ad' },
    { sym: 'GS',    name: 'Goldman Sachs',   domain: 'goldmansachs.com',  price: 585.30, chg:  0.61, vol: '2M',   color: '#6b7a8f' },
    { sym: 'XOM',   name: 'ExxonMobil',      domain: 'exxonmobil.com',    price: 118.60, chg: -0.47, vol: '15M',  color: '#e2231a' },
    { sym: 'PFE',   name: 'Pfizer',          domain: 'pfizer.com',        price: 25.40,  chg:  0.12, vol: '30M',  color: '#0093d0' },
    { sym: 'SBUX',  name: 'Starbucks',       domain: 'starbucks.com',     price: 98.20,  chg:  0.85, vol: '6M',   color: '#00704a' },
];

// --- FX pairs (generated charts; icon = base + quote currency flags) ------
export const FX = [
    { sym: 'EURUSD', name: 'Euro / US Dollar',      base: 'eu', quote: 'us', price: 1.0842, chg:  0.12, vol: '—', color: '#2f49d6' },
    { sym: 'GBPUSD', name: 'Pound / US Dollar',     base: 'gb', quote: 'us', price: 1.2718, chg: -0.08, vol: '—', color: '#8b1e3f' },
    { sym: 'USDJPY', name: 'US Dollar / Yen',       base: 'us', quote: 'jp', price: 151.34, chg:  0.26, vol: '—', color: '#bc002d' },
    { sym: 'USDCHF', name: 'US Dollar / Franc',     base: 'us', quote: 'ch', price: 0.8824, chg:  0.05, vol: '—', color: '#d52b1e' },
    { sym: 'AUDUSD', name: 'Aussie / US Dollar',    base: 'au', quote: 'us', price: 0.6612, chg: -0.15, vol: '—', color: '#00843d' },
    { sym: 'USDCAD', name: 'US Dollar / Loonie',    base: 'us', quote: 'ca', price: 1.3745, chg:  0.09, vol: '—', color: '#d52b1e' },
    { sym: 'NZDUSD', name: 'Kiwi / US Dollar',      base: 'nz', quote: 'us', price: 0.5921, chg: -0.11, vol: '—', color: '#00247d' },
    { sym: 'EURGBP', name: 'Euro / Pound',          base: 'eu', quote: 'gb', price: 0.8524, chg:  0.07, vol: '—', color: '#2f49d6' },
    { sym: 'EURJPY', name: 'Euro / Yen',            base: 'eu', quote: 'jp', price: 164.08, chg:  0.33, vol: '—', color: '#2f49d6' },
    { sym: 'GBPJPY', name: 'Pound / Yen',           base: 'gb', quote: 'jp', price: 192.51, chg:  0.41, vol: '—', color: '#8b1e3f' },
    { sym: 'EURCHF', name: 'Euro / Franc',          base: 'eu', quote: 'ch', price: 0.9568, chg: -0.04, vol: '—', color: '#2f49d6' },
    { sym: 'AUDJPY', name: 'Aussie / Yen',          base: 'au', quote: 'jp', price: 100.06, chg:  0.19, vol: '—', color: '#00843d' },
    { sym: 'CADJPY', name: 'Loonie / Yen',          base: 'ca', quote: 'jp', price: 110.10, chg:  0.22, vol: '—', color: '#d52b1e' },
    { sym: 'CHFJPY', name: 'Franc / Yen',           base: 'ch', quote: 'jp', price: 171.52, chg:  0.28, vol: '—', color: '#d52b1e' },
    { sym: 'EURAUD', name: 'Euro / Aussie',         base: 'eu', quote: 'au', price: 1.6398, chg: -0.12, vol: '—', color: '#2f49d6' },
    { sym: 'GBPAUD', name: 'Pound / Aussie',        base: 'gb', quote: 'au', price: 1.9235, chg: -0.09, vol: '—', color: '#8b1e3f' },
    { sym: 'USDCNH', name: 'US Dollar / Yuan',      base: 'us', quote: 'cn', price: 7.2456, chg:  0.14, vol: '—', color: '#de2910' },
    { sym: 'USDHKD', name: 'US Dollar / HK Dollar', base: 'us', quote: 'hk', price: 7.7821, chg:  0.01, vol: '—', color: '#de2910' },
    { sym: 'USDSGD', name: 'US Dollar / SG Dollar', base: 'us', quote: 'sg', price: 1.3412, chg:  0.06, vol: '—', color: '#ef3340' },
    { sym: 'USDMXN', name: 'US Dollar / Peso',      base: 'us', quote: 'mx', price: 20.148, chg:  0.52, vol: '—', color: '#006847' },
    { sym: 'USDTRY', name: 'US Dollar / Lira',      base: 'us', quote: 'tr', price: 34.287, chg:  0.38, vol: '—', color: '#e30a17' },
    { sym: 'USDZAR', name: 'US Dollar / Rand',      base: 'us', quote: 'za', price: 18.092, chg: -0.27, vol: '—', color: '#007a4d' },
];

export const CATEGORIES = [
    { key: 'watch',  tkey: 'cat.watch' },
    { key: 'crypto', tkey: 'cat.crypto' },
    { key: 'us',     tkey: 'cat.us' },
    { key: 'fx',     tkey: 'cat.fx' },
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

// CoinGecko spot price in USD (used for deposit crediting + options entry).
import { CG_KEY } from './supabase.js';
export async function cgPrice(cgId) {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&x_cg_demo_api_key=${CG_KEY}`);
    const data = await res.json();
    const p = data?.[cgId]?.usd;
    if (!p) throw new Error('Unable to fetch price');
    return p;
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
    { id: 'usdt-flex', cat: 'current', asset: 'USDT', name: 'USDT Flexible', yieldKey: 'yield.low', dmin: 0.0685, dmax: 0.481, buyers: 55973, min: 100, max: 1000000, term: 0, color: '#26a17b' },
    { id: 'btc-flex',  cat: 'current', asset: 'BTC',  name: 'BTC Flexible',  yieldKey: 'yield.low', dmin: 0.0210, dmax: 0.118, buyers: 12430, min: 0.001, max: 50, term: 0, color: '#f7931a' },
    { id: 'eth-flex',  cat: 'current', asset: 'ETH',  name: 'ETH Flexible',  yieldKey: 'yield.low', dmin: 0.0320, dmax: 0.140, buyers: 9871,  min: 0.01, max: 500, term: 0, color: '#627eea' },
    // AI Quant (fixed term)
    { id: 'quant-7',   cat: 'quant', asset: 'USDT', name: 'Quant Alpha', yieldKey: 'yield.high', dmin: 0.201, dmax: 0.482, buyers: 8221, min: 500,  max: 500000, term: 7,  color: '#5b73ff' },
    { id: 'quant-15',  cat: 'quant', asset: 'USDT', name: 'Neural Grid', yieldKey: 'yield.high', dmin: 0.284, dmax: 0.556, buyers: 5002, min: 1000, max: 800000, term: 15, color: '#e24fe2' },
    { id: 'quant-30',  cat: 'quant', asset: 'USDT', name: 'Quant Pro',   yieldKey: 'yield.high', dmin: 0.351, dmax: 0.628, buyers: 3140, min: 2000, max: 1000000, term: 30, color: '#f0a020' },
];

// Mini sparkline points (0..100 range) for finance cards.
export function genSpark(n = 24, up = true) {
    const pts = []; let v = 50;
    for (let i = 0; i < n; i++) { v += (Math.random() - (up ? 0.42 : 0.58)) * 14; v = Math.max(8, Math.min(92, v)); pts.push(v); }
    return pts;
}

// --- Activity feed & FAQ -------------------------------------------------
// Feed rows carry translation keys (productKey/agoKey) + a numeric agoN so the
// consuming view renders them reactively with $t(agoKey, { n: agoN }).
const PRODUCT_KEYS = ['product.spot', 'product.contract', 'product.followOrders', 'product.aiQuant'];
export function genFeed(n = 8) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const letter = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        const amt = (Math.random() * 9000 + 120);
        const mins = Math.floor(Math.random() * 230) + 2;
        const isMin = mins < 60;
        out.push({
            user: 'z∗∗∗∗∗∗' + letter,
            productKey: PRODUCT_KEYS[Math.floor(Math.random() * PRODUCT_KEYS.length)],
            agoKey: isMin ? 'feed.minAgo' : 'feed.hAgo',
            agoN: isMin ? mins : Math.floor(mins / 60),
            amount: fmtAmt(amt),
            up: Math.random() > 0.4,
        });
    }
    return out;
}

// FAQ content lives in the i18n dictionaries (faq.q1..q4 / faq.a1..a4); this
// just lists the key pairs so the view can map over them.
export const FAQ = [
    { qKey: 'faq.q1', aKey: 'faq.a1' },
    { qKey: 'faq.q2', aKey: 'faq.a2' },
    { qKey: 'faq.q3', aKey: 'faq.a3' },
    { qKey: 'faq.q4', aKey: 'faq.a4' },
];
