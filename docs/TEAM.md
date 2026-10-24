# The BentoBudget team

This is a plain-English guide to the AI agents building BentoBudget: who does what, how work moves between them, and what protects the app from mistakes.

## Who's on the team

| Agent | What they do | Model, and why |
|---|---|---|
| **Project lead** | Runs the build. Plans each stage, writes a "task card" for every piece of work, hands it to the right specialist, checks the result, keeps `DECISIONS.md` up to date, and explains everything to you. Your main contact. | Same as your session. It runs as your session. |
| **Test engineer** | Writes the tests *before* the code exists, from each task's "Done when" line and the guide's testing checklist (§19). The tests decide when a task is finished. | Opus. The tests are the main safety net. |
| **Database engineer** | Builds the database: tables, the privacy rules (RLS) and the permission function, file-storage rules, and the SQL behind the reports. | Opus. Mistakes here leak data and are hard to fix once real data exists. |
| **Backend engineer** | Builds the server code: login, checking inputs, currency conversion, tax maths, receipt reading, CSV import and export. | Opus. Money, dates and currency logic is easy to get subtly wrong. |
| **Frontend engineer** | Builds what you see and tap: screens, forms, the quick-sale number pad, the installable app. | Sonnet. Interface work with clear specs, and every change is reviewed. |
| **Code reviewer** | Checks every change against its task card and the guide's rules, especially dates, money, currency and tax. Can read and run tests, but can't change anything. | Opus. Has to spot subtle finance bugs. |
| **Security reviewer** | Attacks every change that touches logins, privacy rules, files, server routes or secrets, the way a nosy or hostile user would. Read-only. | Opus. This is the most important lock in the app. |
| **Privacy writer** | Keeps the data map current and, at Stage 11, drafts the privacy policy, terms and breach plan for a lawyer to review. | Sonnet. These are drafts, and a lawyer checks them. |

## How a piece of work flows

```
Lead writes a task card
  → Test engineer writes tests that fail (proving they test something real)
  → A builder writes code until the tests pass
  → Code reviewer (and security reviewer, if needed) check it, read-only
  → The builder fixes every blocking problem, then it's reviewed again
  → The lead runs every check personally, commits, and explains it to you
```

At the end of each stage the lead runs a **stage gate**:
1. It collects evidence that the stage's "Done when" line is true.
2. It lists anything only you can check, such as testing on a real phone.
3. It asks you the stage's "Check yourself" questions.
4. It **waits for your sign-off** before starting the next stage.

## What protects the app from mistakes

No team, human or AI, can promise zero mistakes. This one is built so that mistakes get **caught before they're accepted**:

1. **Tests come first, from a different agent.** The builder can't change them to make its own work pass.
2. **Builders never approve their own work.** Separate reviewers check it, and they can't edit code.
3. **A separate attacker-style security review** covers anything sensitive.
4. **Automatic rule checks** (`scripts/check-rules.mjs`) run after every edit and on GitHub. They catch the guide's most costly mistakes, whatever any agent claims:
   - a table without privacy rules;
   - dates stored as timestamps;
   - money stored as decimals;
   - secrets exposed to the browser;
   - a receipt input that skips the photo library.
5. **Safety hooks and a deny list** (`.claude/settings.json`) block the usual ways an agent could:
   - edit the build guide;
   - read secret files;
   - force-push or push to `main`;
   - merge a pull request;
   - deploy;
   - change a live database.

   They're a seatbelt, not a lock. A determined workaround could slip past. The real locks are:
   - `.gitignore` keeps secret files out of Git;
   - GitHub branch protection on `main` (your Stage 0 task);
   - the reviewers.
6. **Stage gates with evidence, and your sign-off.**

## What only you can do

- **Accounts and keys:** create accounts (Supabase, Vercel, email, AI and exchange-rate providers) and enter real keys in `.env.local`. Agents are blocked from reading that file, and Git ignores it.
- **Branch protection:** turn on branch protection for `main` on GitHub (Stage 0, T0.4).
- **Decisions:** make the decisions listed under "Still to decide" in `DECISIONS.md`.
- **Real devices:** test on real phones, including the installed app, the camera and the photo library.
- **`main` branch:** merge pull requests into `main`.
- **Before launch:** get the professional security review and the privacy lawyer's review (guide Stage 11).

## How to start

In a terminal in this repo, run `claude`. The project lead starts automatically, because `.claude/settings.json` sets `"agent": "project-lead"`. Tell it something like "Start Stage 0."
