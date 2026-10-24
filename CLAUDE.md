# BentoBudget

A finance app for artists: an installable web app (PWA) for tracking expenses, income, events and profit. Built with Next.js + TypeScript, Tailwind, Supabase and Vercel.

## Every agent working here

- `docs/build-guide.html` is the source of truth for architecture, design rules and stage order. Read the sections your task cites.
- `DECISIONS.md` records what's decided, what's still open and the current stage. Don't make a decision listed under "Still to decide". Stop and report it instead.
- The `project-lead` agent (`.claude/agents/project-lead.md`) directs the build and holds the full list of non-negotiable rules. When your work touches security, dates, money, receipts, imports or exports, read that list first.
- Work only within the current stage. One new thing (library, table or screen) per change. Commit when something works.
- Explain what your code does in plain English. The owner is learning as they build.

## Rules that are easy to get wrong

- RLS is enabled in the same migration that creates a table. Policies use `private.has_permission(account_id, '<permission>')`.
- Transaction dates are `date` columns and `YYYY-MM-DD` strings, never timestamps. Time zones are IANA names.
- Money is integer minor units (decimals per ISO 4217). Exchange rates are `numeric`. Converted home amounts are locked.
- Secrets stay server-side. Never commit `.env.local`. Never log financial details or personal data.
- Nothing from the receipt AI is saved without the artist confirming.
