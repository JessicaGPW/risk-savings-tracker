# Risk Savings Tracker

**A Chrome extension that helps risk and fraud teams measure the value saved by closing abusive accounts across multiple brands — in EUR, by brand, by week, month and year.**

> Portfolio version of an internal tool built for a multi-brand iGaming risk team.
> **All brands, back offices, people and numbers in this repository are fictional.**

![Demo](media/demo.gif)

▶ **[Watch the full demo (MP4)](media/demo.mp4)** · 🌐 **[Live demo](https://jessicagpw.github.io/risk-savings-tracker/)**

---

## Overview

Risk teams routinely close accounts for abuse and fraud across several brands, each with its own back office and local currency. The financial impact was often tracked manually in spreadsheets, which made comparison across brands, periods and reasons difficult.

This project brings that process into a single tool: a side drawer that sits on top of any brand back office and shows the impact of account closures in real time.

## Problem

- Each brand runs on different vendor systems and currencies.
- Closure reasons and values were managed manually.
- There was no consistent view of savings by brand, period or reason.
- Finance and risk teams needed a faster, auditable way to track impact.

## Solution

A Chrome extension with a lightweight dashboard and audit workflow:

| Module | Purpose |
|---|---|
| **Dashboard** | Total saved in EUR, grouped by brand, period and closure reason. |
| **Log** | Record closures with reason, amount, currency and date. Converts values to EUR automatically. |
| **History** | Filter by brand and period; admins can edit or soft-delete entries without hard deletion. |
| **Reports** | Export CSV files and mirror hourly summaries to Google Sheets. |

## Screenshots

| Dashboard | Log | History |
|---|---|---|
| ![Dashboard](media/01_dashboard.png) | ![Log](media/03_log.png) | ![History](media/02_history.png) |

## Design decisions

- **No integration with vendor back offices.** The extension never reads or changes the host page; it injects an isolated iframe inside a closed Shadow DOM.
- **Privacy by design.** No player data is stored; only brand, reason, amount, currency, rate, EUR value, date and operator are kept.
- **Zero dependencies.** Plain JavaScript modules, Manifest V3, and Firebase REST APIs only.
- **Security in the backend, not the client.** Firestore rules enforce domain-verified accounts, schema validation, authored timestamps and server-side controls.
- **Cheap to run.** Incremental sync and a local cache keep reads low.
- **Demo mode in the same codebase.** `CONFIG.MODE = 'demo'` swaps the Firestore adapter for deterministic fictional data for tests and demo usage.

## Architecture

```text
Brand back office (any vendor)           Chrome extension (MV3)
┌─────────────────────────────┐   inject   ┌──────────────────────────────┐
│ page (never read)          │ ─────────► │ content.js → closed Shadow   │
│                           │            │ DOM → iframe(panel.html)     │
└─────────────────────────────┘            │ panel.js (UI)                 │
                                           │ data.js (cache + sync)        │
                                           │ ├─ firestore.js (REST)        │
                                           │ └─ demo.js (fictional)        │
                                           │ fx.js (ECB / CoinGecko)       │
                                           │ auth.js + background.js       │
                                           └──────────────┬───────────────┘
                                                          │ Google sign-in → Firebase Auth
                                                          ▼
                                        Firestore (security rules) ──► Apps Script ──► Google Sheets
```

## Run locally

Requirements: Node 18+ and Google Chrome.

```bash
git clone https://github.com/JessicaGPW/risk-savings-tracker.git
cd risk-savings-tracker
npm run demo
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode** and click **Load unpacked**.
3. Select the `extension/` folder.
4. Open the demo back office at <http://kestrel.localhost:8080/demo-site/>.
5. Click the **€ SAVINGS** tab on the right, or press **Alt+R**.

## Live demo

The `demo-site/` page falls back to rendering the same drawer when the extension is not installed, so the whole experience also runs as a static site via GitHub Pages.

## Tests

```bash
npm install
npx playwright install chromium
npm test
npm run record
```

## Production setup

See [docs/SETUP.md](docs/SETUP.md) for:

- Firebase project setup
- Firestore rules
- Google sign-in and OAuth client configuration
- Google Sheets mirror integration
- local config values in `extension/src/config.js`

## Tech stack

Chrome Extensions MV3 · JavaScript (ES modules) · Firebase Auth & Firestore (REST) · Firestore Security Rules · Google Apps Script · Frankfurter (ECB) · CoinGecko APIs · Playwright

---

## Copyright notice

© 2026 Jessica Baptista. All rights reserved.

Unauthorized copying, reproduction, distribution, modification or use of this repository is prohibited without prior written authorization from the author.

## License

[MIT](LICENSE)
