# Decisions log

Maintained by the `project-lead` agent. The full reasoning lives in `docs/build-guide.html`; section references (§) point there.

## Status

- **Current stage:** Stage 1 — Build the screens with pretend data (in progress, see `docs/stages/stage-01.md`)
- **Done:** Stage 0, signed off by the owner on 2026-10-25. Carried over: T0.3 (run locally), T0.4 (branch protection on `main`, recommended soon) and the Stage 0 "Check yourself" questions.
- **In progress:** Stage 1 re-planned after the owner's change of direction on 2026-10-25 (see "What the app is for" below). T1.1–T1.7 are done. The quick-sale pad (T1.8) is being removed.
- **Blocked:** —

## Decided

| Topic | Decision | Guide |
| --- | --- | --- |
| Countries | Any country except EU member states and the UK. Country sets editable defaults for time zone, currency, FY and tax wording. | §6 |
| Accounts | Records belong to a business account. Each person has their own login and sees only accounts they belong to. | §5 |
| Team-ready | Helpers not built yet, but the schema supports them from day one via `account_members` and permissions. | §5 |
| Login | Email one-time code (OTP). No email links. | §5 |
| Dates and time zones | Calendar `date` columns. Time zone auto-detected and confirmed at onboarding. | §6 |
| Currencies | One home currency per account. Foreign amounts converted at the transaction-date rate and locked. | §9 |
| Sales tax | Account-level setting for GST, VAT and sales tax. Wording and suggested rates follow the country. | §8 |
| Costs | Three expense groups: production, event & venue, operating. | §7 |
| Income streams | Seven defaults: sales at events, online sales, wholesale, commissions, vendor shelf rental, social media, subscription income. Rename, add, archive. | §10 |
| When income counts | Cash basis: when the money is received. | §10 |
| Privacy | One high standard modelled on Singapore's PDPA, plus local extras. | §16 |
| Receipt input | Camera, photo library and PDF. | §11 |
| Originals | Kept unaltered in private storage, with a separate backup copy. | §11 |
| Exports | Transactions CSV and FY summary. No receipt ZIP for now. | §12 |
| Import | CSV import with mapping, preview and duplicate protection. | §13 |
| Integrations | Not built yet; data model ready for Square and Stripe. | §14 |
| Data storage | Central Supabase database, collecting less. Local-only storage rejected. | §16 |
| Email forwarding | After the core app is finished. | Stage 12 |
| AI | One vision model reads receipts and suggests a category. | §11 |
| Stack | Next.js + TypeScript (App Router), Tailwind, Supabase, **Cloudflare** (see Hosting). Installed in T0.1: Next.js 16.4.3 (Turbopack, Tailwind via `@tailwindcss/turbopack`), React 19.3.0, TypeScript 5.9.3, Tailwind CSS 4.3.3, ESLint 9.39.5, npm 10.9.4. React Compiler and Cache Components are off. Node.js **24 LTS** (`.nvmrc`, `engines >=24`), checked against nodejs.org on 2026-10-24. Node 26 isn't LTS yet, so revisit when it is. | §4 |
| Hosting | **Cloudflare Workers via the OpenNext adapter (`@opennextjs/cloudflare`), replacing Vercel** (owner, 2026-10-24). Why: the free tier allows commercial use; trade-off: Next.js runs through an adapter, so some features need extra setup. The guide's Vercel references and §18 hosting costs no longer apply. Adapter 1.20.13 supports Next.js ≥ 16.4.1. Agents build and preview locally only; deploys, secrets and the account are owner-only. | §4, §18 |
| Stage 1 screens | No paper sketch. The team builds from the guide's descriptions and the owner reacts to the live result (owner, 2026-10-25). | §17 Stage 1 |
| Typed amounts (Stage 1) | A leading `$` is ignored, commas are thousands separators, at most 2 decimals (more is rejected, not rounded), zero allowed, negatives and other symbols rejected. Comma decimals and per-currency decimal places come in Stage 4 (owner, 2026-10-25). | §17 Stage 1, §6, §7 |
| Typed amounts: detailed rules (T1.4 tests) | The lead confirmed the test engineer's readings of the owner's rules (owner may overrule). Rejected inputs:
- a space after `$`, or `$` anywhere but first;
- `.5` and `5.` (as the guide's pattern does);
- signs, brackets, other currency codes;
- non-ASCII digits.

Rules for what's accepted:
- Commas must be real thousands groups in the whole-number part.
- Leading zeros are allowed.
- Whitespace is trimmed around the input only.
- Above `Number.MAX_SAFE_INTEGER` cents is rejected; no business maximum yet.

Formatting is exact to the cent, with no float division. | §6, §7 |
| What the app is for | **Tracking and organising, not live selling** (owner, 2026-10-25). Artists record how an event went after the fact (e.g. day 1 $1,000, day 2 $2,000, day 3 $1,500; table $500, hotel $299, food $200), plus their other income streams. **This replaces the guide's live cash-sale design (§10 "Designing cash-sale entry for a busy stall", §19 "a cash sale can be logged in a few seconds with one hand").** The new everyday-use test: a day's takings can be entered in under a minute. | §10, §19 |
| Quick-sale pad | **Removed** (owner, 2026-10-25). The T1.8 pad (commit 671a37a) is deleted from the branch before merge; Git history keeps it. | §10, §17 Stage 1 |
| Event takings | Entered **per day, always split into cash and card** (owner). Saved as **two income rows** (payment method cash and card, same date, same event, stream "Sales at events"), both always saved, even when one is $0. This is the guide's "one total at the end of the day" style (§10 "Two styles, one table"). The cash/card split applies only to event sales; other streams take one amount and a payment method (owner). | §10 |
| The "+" button | One **"+" button** on Home and on every income or expense summary page. Tapping it offers **Income** or **Expense** (owner). It pre-fills the form from the page it's on: on an event page, the new income or expense is linked to that event; on an income stream page (e.g. Online sales), it's tagged with that stream (owner). Home's "+" pre-fills nothing. | §10 |
| Navigation | Bottom tabs: **Home, Events, Expenses, Income, Settings** (owner). This replaces the guide's Home, Transactions, Events, Reports, Settings. The lead's reading, which the owner may overrule: the Transactions list is split into the Expenses and Income tabs, and report figures appear on Home and on each event and stream page. The full reports screen (Stage 6) will be reached from Home. | §17 Stage 1, §12 |
| Linking costs to events and streams | **Production costs stay unlinked** from events and streams (§7, confirmed by the owner). Event & venue and operating costs can be **tagged with an income stream** (owner); event & venue costs can also be linked to an event, as the guide says. On an event page, a production expense is saved without the event, and the form says why. | §7 |
| Event "Other costs" | Each event has an optional **"Other costs" figure** (e.g. the cost of the stock sold there, COGS), entered by the artist (owner, 2026-10-25). It's the guide's "what did my stock cost for this event" estimate. It's shown **only in that event's result**, below the event & venue costs, and **never added to overall totals**, because the stock was already counted once as a production cost. | §7 |
| Stage 10 (offline market-day queue) | **Dropped** (owner, 2026-10-25). Takings are entered after the event, so live offline entry isn't needed. | §15, Stage 10 |
| Build team | The project lead runs as the main session and directs 7 specialists: test engineer, database engineer, backend engineer, frontend engineer, code reviewer, security reviewer, privacy writer. See `docs/TEAM.md`. | — |
| Check-ins | The lead works through a whole stage, then waits for the owner's sign-off. It stops earlier only for owner decisions, owner-only actions or phone checks, or a guide/reality conflict. (Owner's choice, 2026-10-24.) | — |
| Models | The lead chose by difficulty (the owner delegated this). Opus for the database engineer, backend engineer, test engineer, code reviewer and security reviewer: high-risk or subtle work. Sonnet for the frontend engineer and privacy writer: clear-spec work that is always reviewed. The lead inherits the session model. | — |
| Test stack | Vitest **4.1** (unit; Vitest 5 needs `@types/node` 22+, which is a pending follow-up), pgTAP via `supabase test db` (database/RLS), Playwright (end-to-end). Tests are written before code by the test engineer. | §19 |
| Guardrails | `scripts/check-rules.mjs` (rule checks, in a hook and CI), `.claude/hooks/guard.mjs` (blocks unsafe actions), CI on every push. | §5–§13 |

## Follow-ups noted (not decisions)

- **Deploy only from Cloudflare's Git build** (T0.5 security review). The adapter copies `.env`/`.env*.local` values as plain text into the built worker, so a deploy from a machine with `.env.local` would publish secrets in the app's code. Hosted secrets go in the Cloudflare dashboard. Agents can't deploy at all.
- **npm audit (T0.5):** 7 findings (2 moderate, 5 high) in build and local-preview tooling only: glob 10.x via `@node-minify` in the adapter (the advisory covers its CLI, which isn't used), and undici 7.x in miniflare (local preview only). Neither is in the deployed worker (checked by the security reviewer). **Accepted for now** rather than regenerating the whole lockfile with overrides. Revisit when wrangler or the adapter ship fixed versions, or by Stage 11 at the latest.
- **Before real data (Stage 2+):** decide whether Cloudflare's `workers.dev` and per-version preview URLs stay public, or go behind Cloudflare Access. Today they show only the starter page.
- **Before the first route handler (Stage 2+):** `safeBackPath` (`src/lib/navigation.ts`) allows any same-site path. Turn it into a route-pattern allow-list, or refuse `/api` and `/auth`, so a crafted `?back=` can't trigger a GET route with side effects (T1.12 security review). GET route handlers must never change anything.
- `global_fetch_strictly_public` is kept, but it isn't SSRF protection. Routes that fetch URLs (AI, imports) need their own allow-lists.

- The lockfile is written with **npm 11**, which ships with Node 24 (CI, `.nvmrc`). npm 10.9.4 crashed adding Vitest (an npm 10 bug with Vite 8's optional peers). `npm ci` still works on npm 10, but `npm install` with npm 10 rewrites the lockfile (drops `libc` fields). Use Node 24, which ships npm 11, when installing packages.
- Playwright is pinned to **1.63.0** to match the cloud container's preinstalled Chromium (revision 1243). Upgrading means checking the browser match, or adding an `executablePath` override (T1.2).
- Before e2e tests touch Supabase (Stage 2+), the security reviewer checks that CI failure reports and traces can't contain personal or financial data.
- `formatCents` (T1.4 review):
  - add tests for negative cents (refunds) and for RangeError on non-integers, at the latest when refunds arrive;
  - note that old browsers without `Intl.NumberFormat` v3 lose exactness only above about $70 trillion;
  - Stage 4 must handle 0- and 3-decimal currencies (JPY prints rounded today).
- Nav (T1.3b review):
  - at 200% text, a pinned nav flashes for about 100 ms before hydration. If it's reported, add an rem-based media query that guesses the pinning before JS runs;
  - add a comment that iOS Safari's toolbar can cause one switch from static to sticky while scrolling;
  - add one 150% pinning test case.
- `@types/node` is `^20` but the runtime is Node 24. Bumping it also unblocks Vitest 5. Bump it in a later task (one change at a time).
- npm marks ESLint 9.39.5 as deprecated. Consider ESLint 10 once `eslint-config-next` supports it.
- `npm install` on a dev machine may add `@tailwindcss/oxide-wasm32-wasi` entries to `package-lock.json`. That's harmless, and it can be committed.

## Still to decide

- [ ] Exchange-rate provider (§9)
- [ ] Can the home currency change once transactions exist? Guide recommends no (§9)
- [ ] Supabase region (§16, Stage 2)
- [ ] English only at launch, or other languages?
- [ ] Can non-cash income (e.g. gifted products) be recorded? (§10)
- [ ] Exact expense category list. Draft with real artists (§7)

## Data map (§16)

To be filled in as providers and fields are added: what personal data, why, where stored, which providers process it, how long it's kept.

## Change history

- 2026-10-24 — Repository cleared to start fresh; build guide v5 adopted as the source of truth.
- 2026-10-24 — Agent team formed: specialists, test-first maker-checker workflow, stage gates with owner sign-off, automatic rule checks, safety hooks and CI.
- 2026-10-24 — First review by code-reviewer (changes required, 6 blocking) fixed:
  - the guard now parses commands word by word;
  - the checker parses whole SQL statements and now also checks views and `search_path = ''`;
  - the docs now state the Stage 2, `profiles` and `fx_rates` policy exceptions.

  Owner to turn on GitHub branch protection for `main` (T0.4).
- 2026-10-25 — **Change of direction (owner):** the app tracks how events went, and organises all income streams, instead of logging live sales. Removed: the quick-sale pad (T1.8) and Stage 10. Added: per-day cash/card event takings, a context-aware "+" button (Income/Expense), the tabs Home/Events/Expenses/Income/Settings, stream tags on non-production costs, and an event "Other costs" figure. Stage 1 re-planned in `docs/stages/stage-01.md`. Paused T1.8 review fixes kept as a local stash and patch, not committed.
- 2026-10-25 — Stage 0 signed off by the owner (T0.3, T0.4 and the questions carried over). Stage 1 opened. Live app at https://artistfinanceapp.michaelz110897.workers.dev.
- 2026-10-25 — Cloudflare worker renamed from `bentobudget` to `artistfinanceapp` (owner request) in `wrangler.jsonc`, to match the Cloudflare project and the repo name.
- 2026-10-24 — **Hosting changed from Vercel to Cloudflare** (owner's decision). Guard and deny list extended: agents can't deploy, change secrets or use remote Cloudflare commands. `.dev.vars` is treated as a secrets file. Task T0.5 added to Stage 0.
- 2026-10-24 — Round 2 (code-reviewer and security-reviewer) fixed:
  - Supabase commands now use a local-only allowlist; Vercel is limited to dev and build.
  - Agents can't merge PRs: only the owner merges (deny list plus guard).
  - The guard follows package scripts, wrappers and branch switches, and blocks recursive grep over secrets.
  - check-rules keeps definer functions in `private` and flags RLS being switched off.
  - Docs: update policies check both `using` and `with check`, `account_id`/`created_by` are immutable, server identity comes from `getUser`/`getClaims`, and the storage policy rules are written down.
  - `.gitignore` added.
