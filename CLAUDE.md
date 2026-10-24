# BentoBudget

A finance app for artists: an installable web app (PWA) for tracking expenses, income, events and profit. Built with Next.js + TypeScript, Tailwind, Supabase and Vercel.

## Every agent working here

- `docs/build-guide.html` is the source of truth for architecture, design rules and stage order. Read the sections your task cites. Nobody edits it.
- `DECISIONS.md` records what's decided, what's still open and the current stage. Don't make a decision listed under "Still to decide". Stop and report it instead.
- The `project-lead` agent runs the build as the main session. It holds the full list of non-negotiable rules in `.claude/agents/project-lead.md`. When your work touches security, dates, money, receipts, imports or exports, read that list first.
- The team, its workflow and its safeguards are described in `docs/TEAM.md`. Stage plans and task cards are in `docs/stages/`.
- Work only within the current stage and your task card. One new thing (library, table or screen) per change.
- Don't edit tests written by `test-engineer` to make your code pass. Report a disputed test to the lead.
- Before reporting, run `npm run check` (before Stage 0 adds it: `node scripts/check-rules.mjs && node --test scripts/*.test.mjs`). Paste real output. Say plainly when a check couldn't run.
- Explain what your code does in plain English. The owner is learning as they build.
- **Next.js 16 differs from older versions.** Before writing Next.js code, read the matching guide in `node_modules/next/dist/docs/` (see `AGENTS.md`). The cloud container can't always reach nextjs.org, and the bundled docs match the installed version exactly.

## Rules that are easy to get wrong

- RLS is enabled in the same migration that creates a table. From Stage 3, account-scoped tables' policies use `private.has_permission(account_id, '<permission>')`. The exceptions are Stage 2's owner-only policies, `profiles` (own row) and `fx_rates` (read-only). Views use `security_invoker = true`.
- Transaction dates are `date` columns and `YYYY-MM-DD` strings, never timestamps. Time zones are IANA names.
- Money is integer minor units (decimals per ISO 4217). Exchange rates are `numeric`. Converted home amounts are locked.
- Secrets stay server-side. Never commit `.env.local`. Never log financial details or personal data.
- Nothing from the receipt AI is saved without the artist confirming.

## Automatic guardrails

- `scripts/check-rules.mjs` checks the rules above. It runs after every edit (a hook) and in CI. To silence one finding on purpose, add a `check-rules-ignore: <reason>` comment, which the code reviewer will question.
- `.claude/hooks/guard.mjs` blocks:
  - editing the build guide or `.env*.local` files;
  - force-pushes, pushes to `main` and `--no-verify`;
  - commands that change a hosted Supabase project.
