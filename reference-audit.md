# Crypto.ssr — Reference Audit & Replica Plan

**Reference:** `https://decenyi.com/main.html#/` ("Decentralized crypto")
**Target:** `www.cryptossr.com` (current code: `index.html`, single-file Vue 3 app)
**Audit date:** 2026-10-05 · **Scope chosen:** UI/UX-first clean rebuild · **Platform:** responsive (mobile + desktop)

> **Replication principle.** Reproduce **layout, components, screen structure, navigation and feature set** 1:1,
> rebuilt cleanly under the **Crypto.ssr** brand with our own logo, copy, icons and avatars. We do **not** copy
> decenyi's name, logo, cartoon avatar or marketing text verbatim. Clean rebuild — no patch-on-patch.

---

## 1. Architecture of the reference
| Aspect | Finding |
|---|---|
| Type | SPA, **hash router** (`#/route`) |
| Responsive | Yes — desktop top-nav **and** mobile bottom-nav |
| Mobile bottom nav | Home · Market · **Trade** (center) · Finance · Assets |
| Desktop top nav | Home · Markets · Spot · Futures · Finance · C2C · Live stream · Assets · (profile · bell · language) |
| Global UI | Floating AI/chat bot (bottom-right) · market search · light theme |
| Account modes | **Live Trading ⇄ Simulated Trading** toggle (separate UID/balance; some live-only features like C2C are disabled in Simulated) |
| Account system | avatar · phone/email · **Not Verified / Verified** badge · **UID** · **Credit score (100)** |
| Auth gate | Finance / Assets / Options / Deposit / Withdraw … → `#/otherLogins` until password login |

### Confirmed routes
| Route | Screen |
|---|---|
| `#/` | Home |
| `#/market` | Markets / watchlist |
| `#/Transaction/currency?...` | Trade (chart detail → Spot / Perpetual / Options order panel) |
| `#/EarnGold` | Finance / Earn |
| `#/walletAccount` | Assets (sub-accounts) |
| `#/recharge` | Deposit |
| `#/withdraw` | Withdraw |
| `#/Transfer` | Transfer between sub-accounts |
| `#/Bill` | History (deposit/withdraw records) |
| `#/Conversion` | Convert / swap |
| `#/identity` | KYC verification |
| `#/otherLogins` | Sign in |

---

## 2. Full feature map (side drawer)
- **Live/Simulated Trading** toggle (top)
- **Commonly used:** Language · Funding records · Convert · C2C
- **Markets:** Crypto · US stocks · FX · Options Trading
- **Finance:** Finance (earn)
- **Other:** Bulletin · News · Live streaming · Security Center · KYC · Beginner Academy · About · Log out

Product types seen across the app: **Spot · Contract (perpetual) · Options (binary) · Follow orders (copy-trading) · AI Quantification**.

---

## 3. Screen inventory (captured live)

### Home (`#/`)
Top bar (logo · bell · hamburger) · market search · quick actions **Deposit / Withdraw / Trade / Convert** ·
promo **carousel** (3 slides) · **Currency Quotes** (icon · symbol · 24h vol · %chg · price) ·
**Real-time transactions** feed (masked user · product type · time-ago · amount) ·
**Why choose us** trio · **Partners** · **FAQ** accordion · footer tagline.

### Market (`#/market`)
Sub-tabs **Watchlists / Crypto / US stocks / FX** + search · trading-pair cards with ✓ watchlist toggle · "Add your own".

### Coin chart detail (`#/Transaction/currency`)
Price header (24h High / Low / Vol / Turnover) · timeframes **Time/1m/5m/15m/30m/1H/1D** ·
candlesticks with **MA(5,10,30,60)** overlays · volume pane · indicator tabs **MA / BOLL / VOL / MACD / KDJ / RSI / WR** ·
**Entrusted order** book · big **Trade** CTA.

### Trade order panel — 3 modes (tabs: Spot / Perpetual contract / Options)
- **Spot:** order book (asks/bids + mid price) · depth-layout toggle · Buy/Sell · Market/Limit · Price · Amount · 25/50/75/100% · Volume · Balance · sub-tabs Current Order / Trade History / Assets · "Hide other order".
- **Perpetual contract:** **Leverage** field + slider **1/25/50/75/100x** · Market/Limit · Price · Amount (USDT) · **Min/Max** · 25-100% · **TP/SL** toggle · Balance / Available · sub-tabs My Holding / Current Position / Transaction Records.
- **Options (binary):** sub-tabs **Trade now / Scheduled trade** · **duration** selector (30s…) · **Long / Short** · Amount · Minimum. → *maps to the price-prediction feature the current site already has.*

### Finance / Earn (`#/EarnGold`)
Hero + "Start Earning Profits" · tabs **Current / AI Quant Server** · **My Holding** · product-card carousel ·
product detail (Max/Min return · buyer count · price range · **Buy**) · risk disclaimer.

### Assets (`#/walletAccount`)
Sub-accounts **Overview / Spot / Trading / Finance** · total-balance **donut** · quick actions **Deposit / Withdraw / History / Transfer** · Crypto Assets list.

### Deposit (`#/recharge`)
Tabs **Automatic / Manual recharge** · address **QR** · **Currency** + **Network** selectors · copyable address.

### Withdraw (`#/withdraw`)
**Currency** + **Network** selectors · quantity + All · balance · address (paste) · **Service Charge 1%** + Actual Arrival · warning note · Withdraw.

### Transfer (`#/Transfer`)
From/To sub-account selectors + swap · Currency · Amount + All · Available · Confirm · "Insufficient balance? Deposit".

### History (`#/Bill`)
Tabs **Deposit / Withdrawals record** · list.

### Convert (`#/Conversion`)
From/To coin selectors + amounts + All + swap · Exchange · Available.

### KYC (`#/identity`)
Country/Region · Document Type (Driver's License / Passport) · upload · Next.

### Sign in (`#/otherLogins`)
Tabs **Email / Phone** · identifier · password (show/hide) · Forgot password · legal line · Login · Register · **Wallet login**.

### Still to capture at build time (secondary/list/content)
C2C/P2P marketplace · Security Center · Simulated-mode confirm flow · US-stocks & FX market lists · Funding records · Follow-orders (copy-trading) detail · AI-Quant product detail · Bulletin · News · Live streaming · Beginner Academy · Language sheet · notifications.

---

## 4. Current site vs reference — gap

**Current (`index.html`):** Vue 3 (global) · Supabase · lightweight-charts · light/dark theme · mobile-only bottom-nav **Market / Trade / News** · wallet-connect (MetaMask) · price-prediction "positions" · deposit/withdraw · basic convert · news feed w/ sentiment.

| Area | Current | Reference | Action |
|---|---|---|---|
| Navigation | 3-tab mobile | 5-tab mobile + desktop top-nav + drawer | **Build** responsive shell |
| Home | basic | carousel · quotes · live feed · why-us · partners · FAQ | **Build** |
| Markets | simple list | Watchlists/Crypto/US-stocks/FX + chart detail + indicators | **Build** |
| Spot | partial | full order book + order form | **Build** |
| Perpetual/Futures | ✗ | leverage + TP/SL | **Build** |
| Options (binary) | ✓ (as prediction) | Trade now/Scheduled, Long/Short | **Reuse + restyle** |
| Assets/wallet | deposit/withdraw only | sub-accounts + donut + transfer + history | **Build** |
| Finance/Earn | ✗ | Current / AI Quant products | **Build** |
| Convert | basic | From/To swap | **Restyle** |
| C2C | ✗ | P2P marketplace | **Build** |
| KYC | ✗ | verification flow | **Build** |
| Security Center | ✗ | account security hub | **Build** |
| Live/Simulated | ✗ | account-mode toggle | **Build** |
| Credit score | ✗ | score + Not-Verified badge | **Build** |
| Live stream / Bulletin / Academy | News only | content hubs | **Build** |
| Theme | light/dark | light | **Keep light/dark (ours is better)** |

---

## 5. Proposed architecture (clean, no patch-on-patch)

Keep the exact deploy (static files → GitHub Pages + Supabase), but split the one 3,200-line file into a
modular **no-build Vue 3 SPA** (ES modules + import map + hash router). *(Vite build is an option if preferred.)*

```
/                       # GitHub Pages root (CNAME cryptossr.com)
├─ index.html           # app shell only (head, #app, import map, loads js/main.js)
├─ css/  tokens.css · base.css · components.css   # design system (light/dark)
├─ js/
│  ├─ main.js router.js supabase.js store.js      # bootstrap, routing, client, shared state
│  ├─ views/   Home.js Market.js CoinDetail.js TradeSpot.js TradePerp.js TradeOptions.js
│  │           Assets.js Deposit.js Withdraw.js Transfer.js Bill.js Finance.js Convert.js
│  │           C2C.js Kyc.js Security.js News.js Bulletin.js Live.js Academy.js Login.js
│  └─ components/ TopNav.js BottomNav.js Drawer.js CoinRow.js OrderBook.js Carousel.js …
└─ assets/ (Crypto.ssr logo, coin icons, illustrations)
```

**Non-destructive cutover:** build the new app alongside the live site (e.g. under `app/` or a staging entry),
verify, then switch the root over — so `cryptossr.com` never breaks mid-build.

---

## 6. Phased build plan (each phase = complete, reviewable screens)
- **Phase 0 — Foundation:** design tokens + light/dark · Crypto.ssr brand · responsive shell (desktop top-nav + mobile bottom-nav + drawer) · hash router · Supabase client · shared store (auth, Live/Simulated mode) · floating chat button.
- **Phase 1 — Home:** carousel · quick actions · live Currency Quotes · real-time feed · why-us · partners · FAQ · footer.
- **Phase 2 — Markets + Chart:** category tabs · pair list · search · watchlist · coin chart detail with indicators.
- **Phase 3 — Trade:** Spot (order book + form) · Perpetual (leverage/TP-SL) · Options (reuse existing prediction logic).
- **Phase 4 — Assets:** Overview + sub-accounts · Deposit · Withdraw · Transfer · History.
- **Phase 5 — Finance/Earn:** products · My Holding · Buy.
- **Phase 6 — Account & misc:** Convert · C2C · KYC · Security Center · Live/Simulated · Credit score · Funding records · Bulletin · News · Live streaming · Beginner Academy · Language · notifications.

Backend: wire to existing Supabase where it exists; realistic placeholder/mock elsewhere, replaced per-feature later.
