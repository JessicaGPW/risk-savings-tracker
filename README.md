1| # Risk Savings Tracker
2| 
3| **A Chrome extension that shows how much money a risk & fraud team saves by closing abusive accounts — in euros, per brand, per week, month and year.**
4| 
5| > Portfolio version of an internal tool I built for a multi-brand iGaming risk team.
6| > **All brands, back offices, people and numbers in this repository are fictional.**
7| 
8| ![Demo](media/demo.gif)
9| 
10| ▶ **[Watch the full demo (MP4)](media/demo.mp4)** · 🌐 **[Live demo](https://jessicagpw.github.io/risk-savings-tracker/)** (runs in the browser, no install)
11| 
12| ---
13| 
14| ## The problem
15| 
16| The risk team closes accounts for abuse and fraud across several brands, each with its own back office (run by different vendors) and its own currencies — EUR, BRL and over 10 cryptocurrencies.
17| 
18| ## The solution
19| 
20| A side drawer that appears on top of every brand's back office:
21| 
22| | | |
23| |---|---|
24| | **Dashboard** | Total saved in EUR, one card per brand (the brand you are on is highlighted), amounts in local currency, closure reasons ranked by number of accounts or by value. Week / month / [...]
25| | **Log** | Brand pre-selected from the back office you are on. Amount + currency + main reason + optional secondary reasons. Converts to EUR with the rate of the day (ECB via Frankfurter, CoinGec[...]
26| | **History** | Filter by brand. Admins can edit or soft-delete; nothing is ever hard-deleted (audit trail). |
27| | **Reports** | One-click CSV per period, plus an hourly mirror to Google Sheets for finance. |
28| 
29| | Dashboard | Log | History |
30| |---|---|---|
31| | ![Dashboard](media/01_dashboard.png) | ![Log](media/03_log.png) | ![History](media/02_history.png) |
32| 
33| ## Design decisions
34| 
35| - **No integration with vendor back offices.** The extension never reads or changes the host page: it only injects an isolated iframe inside a closed Shadow DOM. Zero risk for third-party systems.
36| - **Privacy by design.** No player data is stored — only brand, reasons, amount, currency, rate, EUR value, date and operator.
37| - **Zero dependencies.** Plain JavaScript modules, Manifest V3, Firebase used over its **REST APIs** (no SDK, no bundler). The whole extension is ~70 KB, icons included.
38| - **Security in the backend, not the client.** Firestore rules enforce: company-domain verified e-mails only, schema validation of every field, author and server timestamps that cannot be forged, [...]
39| - **Cheap to run.** Incremental sync (`updatedAt > lastSync`) and a local cache keep reads far below the Firebase free tier.
40| - **Demo mode in the same codebase.** `CONFIG.MODE = 'demo'` swaps the Firestore adapter for a local adapter with deterministic fictional data — used for tests, this portfolio and the live demo.
41| 
42| ## Architecture
43| 
44| ```text
45|  Brand back office (any vendor)            Chrome extension (MV3)
46|  ┌───────────────────────────┐   inject   ┌──────────────────────────────┐
47|  │  page (never read)        │ ─────────► │ content.js → closed Shadow   │
48|  │                           │            │ DOM → iframe(panel.html)     │
49|  └───────────────────────────┘            │  panel.js  (UI)              │
50|                                            │  data.js   (cache + sync)    │
51|                                            │   ├─ firestore.js (REST)     │
52|                                            │   └─ demo.js (fictional)     │
53|                                            │  fx.js  (ECB / CoinGecko)    │
54|                                            │  auth.js + background.js     │
55|                                            └──────────────┬───────────────┘
56|                                                           │ Google sign-in → Firebase Auth
57|                                                           ▼
58|                                     Firestore (security rules)  ──► Apps Script ──► Google Sheets
59| ```
60| 
61| ## Run it locally (demo mode, ~1 minute)
62| 
63| Requirements: Node 18+ and Google Chrome.
64| 
65| ```bash
66| git clone https://github.com/JessicaGPW/risk-savings-tracker.git
67| cd risk-savings-tracker
68| npm run demo          # zero-dependency static server on :8080
69| ```
70| 
71| 1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the `extension/` folder.
72| 2. Open a simulated back office: <http://kestrel.localhost:8080/demo-site/> (also `lynx`, `orca`, `vega`, `nimbus`).
73| 3. Click the **€ SAVINGS** tab on the right, or press **Alt+R**.
74| 
75| ## Live demo
76| 
77| The `demo-site/` page falls back to drawing the same drawer when the extension is not installed, so the whole demo also runs as a static site. It is served by GitHub Pages straight from the `main` branch.
78| 
79| ## Tests
80| 
81| ```bash
82| npm install            # installs Playwright (dev only)
83| npx playwright install chromium
84| npm test               # E2E: loads the extension, checks dashboard, logging, history, crypto
85| npm run record         # re-records media/demo.webm with cursor and captions
86| ```
87| 
88| ## Production setup
89| 
90| See [docs/SETUP.md](docs/SETUP.md): Firebase project (Spark plan), Firestore rules, Google sign-in, OAuth client and the Google Sheets mirror. Fill `extension/src/config.js` locally and **never commit** your secrets or production credentials.
91| 
92| ## Tech
93| 
94| Chrome Extensions MV3 · JavaScript (ES modules) · Firebase Auth & Firestore (REST) · Firestore Security Rules · Google Apps Script · Frankfurter (ECB) & CoinGecko APIs · Playwright
95| 
96| ---
97| 
98| ## 🇧🇷 Em português
99| 
100| **Extensão do Chrome que mostra quanto o time de risco economiza ao encerrar contas por fraude e abuso — em euro, por marca, por semana, mês e ano.**
101| 
102| Versão de portfólio de uma ferramenta interna que desenvolvi para o time de risco de um grupo de iGaming com várias marcas. **Marcas, backoffices, pessoas e valores deste repositório são fictícios.**
103| 
104| - **Problema:** cada marca tem seu backoffice (de fornecedores diferentes) e suas moedas (EUR, BRL e 10 criptomoedas). O valor retido em cada encerramento era controlado à mão numa planilha, e o time precisava de uma visão consolidada por marca e por período.
105| - **Solução:** uma gaveta lateral que aparece por cima de qualquer backoffice, com painel por marca, lançamento com conversão automática para euro (cotação do dia, congelada no lançamento), histórico e relatórios CSV.
106| - **Decisões:** nenhuma integração com os sistemas dos fornecedores (a extensão não lê a página), nenhum dado de jogador, zero dependências, Firebase via REST, segurança garantida pelas regras do Firestore e sincronização eficiente.
107| 
108| **Para rodar:** `npm run demo`, carregue a pasta `extension/` em `chrome://extensions` (modo desenvolvedor) e abra <http://kestrel.localhost:8080/demo-site/>.
109| 
110| ## Aviso de direitos autorais
111| 
112| © 2026 Jessica Baptista. Todos os direitos reservados.
113| 
114| É proibida a cópia, reprodução, distribuição, modificação ou uso deste repositório sem autorização prévia por escrito da autora.
115| 
116| ## License
117| 
118| [MIT](LICENSE)
119| 
