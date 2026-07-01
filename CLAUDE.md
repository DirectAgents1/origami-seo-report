# Origami SEO Report — Claude session handoff

## What this project is
Organic-search (SEO) + AI-visibility reporting dashboard for **Origami Risk**
(origamirisk.com), a B2B SaaS vendor of risk / insurance / EHS management software.
Client-facing title in the UI is **"Origami Command Center"** (package name
`origami-seo-source`).

It reports Google Search Console keyword/rank performance, GA4 *organic* outcomes
(landing pages, conversions/engagement — NOT revenue; Origami has no ecommerce), and
two AI-era surfaces: Scrunch AI brand visibility and AI agent/crawler + AI-referral
traffic. Standalone Netlify site, invite-only.

## Stack & where code lives
- **Front end**: Vite + React 18 (`recharts`). Entry `src/main.jsx` → `src/App.jsx`
  → `src/SEODashboard.jsx` (tab shell). Tab components:
  `SEOExecutivePerformance.jsx`, `SEOKeywordsPerformance.jsx`,
  `SEOLandingPagePerformance.jsx`, `SEOAIVisibility.jsx`, `SEOAgentTraffic.jsx`.
  `csvExport.js` = shared CSV helper. Styling in `src/App.css` + inline styles
  (brand navy `#0B1F3A`, blue `#1A7FE0`).
- **Back end**: Express app in `server/app.js` (local entry `server/index.js`,
  serverless wrapper `netlify/functions/api.mjs` via `serverless-http`). Data
  queries in `server/queries/seo.js` and `server/queries/aiReferrals.js`.
  Azure SQL pool in `server/db.js`.
- **Auth gate**: `netlify/edge-functions/auth.js` (runs on `/*` at the edge).
- **Cron**: `netlify/functions/cron-refresh-background.mjs` (scheduled bg function).

## Data sources
All SQL hits **Azure SQL `DA_Improvado`** (`daazure1.database.windows.net:1433`,
same DB user/pw as other DA dashboards). Accounts are hardcoded in the query files:
- GSC account: `sc-domain:origamirisk.com`
- GA4 `account_id = 328179682`; organic = `session_default_channel_group = 'Organic Search'`
  (NOTE: filtered by channel group, not `session_medium`).
- Tables used:
  - `dbo.gsc_highlevel_keyword_performance` (daily GSC totals)
  - `dbo.google_search_console_query_by_month` (monthly keyword grain; `date` = month-1st)
  - `dbo.ga4_landing_page` (daily landing-page outcomes; **no device dimension** on
    this table — the DEPLOY.md's `..._with_country_device` table name is stale/wrong)
- **Scrunch AI** (AI Visibility tab): REST `https://api.scrunchai.com/v1`, brand id
  `3475`, needs `SCRUNCH_API_KEY`. Wired in `server/app.js` (`/api/scrunch`).
- **AI referrals**: `dbo.ga4_landing_page` where channel group = `'AI Assistant'`
  (`server/queries/aiReferrals.js`). Humans arriving from ChatGPT/Perplexity/etc.
- **AI agent traffic**: served from a committed snapshot
  `server/agentTrafficSnapshot.json` (Scrunch agent-traffic data is NOT on the public
  REST API), shipped into the function bundle via `netlify.toml` `included_files`.
- `getDaDataPool()` (DA_Data) exists in `server/db.js` but is **not currently used**
  by any query — TODO/verify before relying on it.

## Metrics & tabs
Five tabs (`TABS` in `SEODashboard.jsx`):
1. **Executive Performance** — GSC clicks/impr/CTR/position + GA4 organic sessions/conversions.
2. **Keywords Performance** — monthly keyword rank buckets, brand vs non-brand,
   top-10 counts, top-800 keyword pool/month; keywords classified by intent
   (Navigational/Transactional/Commercial/Informational) and brand/competitor regex
   in `seo.js` (competitor list = RMIS/GRC/EHS vendors: Riskonnect, Archer, LogicGate…).
3. **Landing Page Performance** — GA4 page × month rollup (top 200/mo by sessions +
   any converting page). Served from a **separate** endpoint (see gotcha).
4. **AI Visibility** — Scrunch brand presence/sentiment/competitor/platform +
   AI Referral Traffic (GA4 AI Assistant channel).
5. **AI Agent Traffic** — bot/crawler hits from the JSON snapshot.

## Deploy & auth
- **Repo**: `github.com/DirectAgents1/origami-seo-report`, branch `main`.
- **CD**: `.github/workflows/deploy.yml` auto-deploys on every push to `main`
  (`netlify-cli deploy --build --prod`, uses repo secrets `NETLIFY_AUTH_TOKEN` +
  `NETLIFY_SITE_ID`). No Netlify GitHub-App link needed. `deploy.sh` / DEPLOY.md
  describe a manual `netlify deploy … --site wacoal-seo` path but that is **stale
  boilerplate from the wacoal-seo clone** — prefer git-push CD.
- **Netlify site name**: TODO/verify (resolved via `NETLIFY_SITE_ID` secret; not in repo).
- **Auth**: standalone **Netlify Identity (GoTrue)**, invite-only. Edge function
  `auth.js` gates `/*`, validates the `nf_jwt` cookie; if `IDENTITY_JWT_SECRET` is set
  it verifies HS256 locally, else it calls `/.netlify/identity/user`. `login.html`
  uses `gotrue-js@0.9.29` from jsdelivr `/+esm`, authenticates against this site's own
  `/.netlify/identity`, and writes `nf_jwt` manually. Unauth doc requests are
  *rewritten* (not 302'd) to `/login.html` so invite/recovery `#` tokens survive.
  `/__logout` clears the cookie. NO cross-domain SSO (no IDENTITY_HOST).
- **Env vars** (real ones): `AZURE_SQL_{SERVER,PORT,DATABASE,USER,PASSWORD}`,
  `SCRUNCH_API_KEY`, `CRON_SECRET` (gates `/api/cron-refresh`), optional
  `IDENTITY_JWT_SECRET`, optional `DA_REFRESH_KEY` (edge cron bypass via `x-refresh-key`).
- Email templates in `public/email-templates/`; login slideshow in `public/slides/`.

## Local dev
```bash
npm install
cp .env.example .env    # fill AZURE_SQL_* + SCRUNCH_API_KEY
npm run dev             # Express :3001 + Vite :5180 (concurrently)
```
Vite (`vite.config.js`) proxies `/api/*` → `localhost:3001`, `strictPort` on 5180.
Node 18. `npm run build` → `dist/`.

## Don't break this
- **`.env.example` lies about auth.** It documents `DA_AUTH_PASSWORD` /
  `DA_AUTH_SECRET` (a shared-password gate), but the shipped `auth.js` is Netlify
  Identity and reads `IDENTITY_JWT_SECRET` / `DA_REFRESH_KEY`. Trust the code, not
  `.env.example`. (TODO: fix `.env.example`.)
- **`main.jsx` comment lies about the cookie.** It says a `da_session_origami`
  cookie; the actual cookie everywhere (auth.js + login.html) is `nf_jwt`.
- **DEPLOY.md is stale wacoal-seo boilerplate** — wrong client, wrong site name,
  wrong GA4 id, wrong table names, references a `PasswordGate.jsx` / `VITE_DASH_PASSWORD`
  that no longer exist. Don't follow it; the SEO query files are the source of truth.
- **6 MB Netlify payload cap**: the GA4 per-page rollup is deliberately split into
  `/api/seo/pages` (separate from `/api/seo`). Keep them split; don't merge back.
- **Caching is 3-layer** (in-memory → `os.tmpdir()` file → DB) with
  stale-while-revalidate. File cache key is `origami-seo-cache-seo-v1.json`; bump the
  suffix if you change the payload schema or stale `/tmp` files will be served.
- **SQL uses string interpolation** for account/date filters (values are hardcoded
  constants, not user input) — keep it that way; do not thread request params in.
- Background function filename **must** end in `-background` for the 15-min timeout.
- To repoint to another client: change the 2 account constants + brand/competitor
  regexes in `seo.js`, GA4 id in `aiReferrals.js`, Scrunch `SCRUNCH_BRAND` in
  `server/app.js`, and the logo/slides/title assets.
