# Decisions log

Maintained by the `project-lead` agent. The full reasoning lives in `docs/build-guide.html`; section references (§) point there.

## Status

- **Current stage:** Stage 0 — Set up your workshop (in progress, see `docs/stages/stage-00.md`)
- **Done:** repository cleared; build guide, decisions log and agent team (lead + 7 specialists, guardrails, CI) added
- **In progress:** T0.5 Cloudflare hosting setup → backend-engineer. T0.1 and T0.2 are done; T0.3 and T0.4 need the owner.
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
| Build team | The project lead runs as the main session and directs 7 specialists: test engineer, database engineer, backend engineer, frontend engineer, code reviewer, security reviewer, privacy writer. See `docs/TEAM.md`. | — |
| Check-ins | The lead works through a whole stage, then waits for the owner's sign-off. It stops earlier only for owner decisions, owner-only actions or phone checks, or a guide/reality conflict. (Owner's choice, 2026-10-24.) | — |
| Models | The lead chose by difficulty (the owner delegated this). Opus for the database engineer, backend engineer, test engineer, code reviewer and security reviewer: high-risk or subtle work. Sonnet for the frontend engineer and privacy writer: clear-spec work that is always reviewed. The lead inherits the session model. | — |
| Test stack | Vitest (unit), pgTAP via `supabase test db` (database/RLS), Playwright (end-to-end). Tests are written before code by the test engineer. | §19 |
| Guardrails | `scripts/check-rules.mjs` (rule checks, in a hook and CI), `.claude/hooks/guard.mjs` (blocks unsafe actions), CI on every push. | §5–§13 |

## Follow-ups noted (not decisions)

- `@types/node` is `^20` but the runtime is Node 24. Bump it in a later task (one change at a time).
- npm marks ESLint 9.39.5 as deprecated. Consider ESLint 10 once `eslint-config-next` supports it.
- `npm install` on a dev machine may add `@tailwindcss/oxide-wasm32-wasi` entries to `package-lock.json`. That's harmless, and it can be committed.

## Still to decide

- [ ] Exchange-rate provider (§9)
- [ ] Can the home currency change once transactions exist? Guide recommends no (§9)
- [ ] Supabase region (§16, Stage 2)
- [ ] English only at launch, or other languages?
- [ ] Can non-cash income (e.g. gifted products) be recorded? (§10)
- [ ] Is the offline market-day queue needed for the first release? Ask artists (§15, Stage 10)
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
- 2026-10-24 — **Hosting changed from Vercel to Cloudflare** (owner's decision). Guard and deny list extended: agents can't deploy, change secrets or use remote Cloudflare commands. `.dev.vars` is treated as a secrets file. Task T0.5 added to Stage 0.
- 2026-10-24 — Round 2 (code-reviewer and security-reviewer) fixed:
  - Supabase commands now use a local-only allowlist; Vercel is limited to dev and build.
  - Agents can't merge PRs: only the owner merges (deny list plus guard).
  - The guard follows package scripts, wrappers and branch switches, and blocks recursive grep over secrets.
  - check-rules keeps definer functions in `private` and flags RLS being switched off.
  - Docs: update policies check both `using` and `with check`, `account_id`/`created_by` are immutable, server identity comes from `getUser`/`getClaims`, and the storage policy rules are written down.
  - `.gitignore` added.
