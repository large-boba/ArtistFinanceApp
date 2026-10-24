# Decisions log

Maintained by the `project-lead` agent. The full reasoning lives in `docs/build-guide.html`; section references (§) point there.

## Status

- **Current stage:** Stage 0 — Set up your workshop (not started)
- **Done:** repository cleared; build guide, project lead agent and this log added
- **In progress:** —
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
| Stack | Next.js + TypeScript (App Router), Tailwind, Supabase, Vercel. | §4 |

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
