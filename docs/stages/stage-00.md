# Stage 0 — Set up your workshop

**Status:** READY FOR SIGN-OFF. Waiting on the owner (T0.3, T0.4 and the Check yourself questions). Opened 2026-10-24; stage start commit `dd90913`.
**Guide:** §17 Stage 0, §4 (stack), §1 (habits)

## You'll learn

What each tool does:
- **Node.js** runs JavaScript on your computer.
- **npm** installs libraries.
- **Git** saves your project's history.
- **GitHub** stores that history online.
- **A code editor** is where you work.

## Done when, as checkable claims

| # | Claim | Evidence |
|---|---|---|
| 1 | The starter Next.js app (TypeScript, App Router, Tailwind) builds and passes lint and the rule checks | T0.1 `54bc667`; lead re-run |
| 2 | `.env.local` is ignored by Git before any keys exist | `git check-ignore -v .env.local` shows `.gitignore:3` |
| 3 | CI runs lint, typecheck, rule checks and build on every push, and is green | CI run #14 on `f3f3dfb`: success |
| 4 | The owner has run the app locally, changed some text and seen it update | NEEDS OWNER |
| 5 | The first app commit is on GitHub | `54bc667` pushed to the working branch (reaches `main` when the owner merges PR #1) |
| 6 | `main` is protected on GitHub: PR plus green CI required, no force pushes (team addition, not in the guide) | NEEDS OWNER |

## Task cards

### T0.1 — Scaffold the Next.js app                      Status: done
Owner agent: frontend-engineer   Tests: none. This is generated scaffolding; it's verified by build, lint and the rule checks   Security review: no. No auth, data or secrets yet
Guide: §17 Stage 0 step 3, §4
Outcome: A fresh Next.js app in the repo root, created with the current `create-next-app`. Options: TypeScript, ESLint, Tailwind CSS, App Router, `src/` directory, import alias `@/*`, npm.
Context: The repo already holds `CLAUDE.md`, `DECISIONS.md`, `.gitignore`, `docs/`, `scripts/`, `.claude/` and `.github/`. `create-next-app` refuses a non-empty folder, so generate the app in a temporary folder and copy it in, overwriting none of the existing files. Merge the generated `.gitignore` into ours, but **don't** take its `.env*` line, which would also ignore `.env.example`. Keep our `.env` and `.env*.local` rules. Check the current Next.js install docs first (§21).
Rules that apply: one new thing at a time (no extra libraries); never commit `.env*.local`; `scripts/check-rules.mjs` must pass.
Out of scope: Vitest, Supabase, Zod, any screens beyond the starter page, PWA files.
Done when: `npm run build` succeeds; `npm run lint` passes; `node scripts/check-rules.mjs` passes; `git check-ignore -v .env.local` shows it's ignored; the installed Next.js, React, TypeScript and Tailwind versions are listed in the report so the lead can record them in `DECISIONS.md`.
Evidence: commit `54bc667`. The lead re-ran every check:
- `npm run lint` exits 0;
- `npm run build` reports "Compiled successfully" and the routes `/` and `/_not-found` are static;
- `check-rules` reports 0 errors and 0 warnings;
- the guardrail tests are 52/52;
- `.env.local` is ignored (`.gitignore:3`) and `.env.example` is not.

The code reviewer approved with no blocking findings. Optional follow-ups:
- the typecheck needs `next typegen` first (moved into T0.2);
- `AGENTS.md` is now referenced from `CLAUDE.md`;
- the README was replaced;
- the page title is left for Stage 1.

### T0.2 — One command for all checks, and CI to run it   Status: done
Owner agent: backend-engineer   Tests: none. Tooling configuration; proven by running it and by CI   Security review: no
Guide: §1 (habits), §17 Stage 0
Outcome: These scripts in `package.json`:
- `typecheck` runs `next typegen && tsc --noEmit`. On a fresh checkout, a plain `tsc --noEmit` fails with "Cannot find name 'LayoutProps'", because Next generates those types (T0.1 review);
- `rules` runs `node scripts/check-rules.mjs && node --test scripts/*.test.mjs`;
- `check` runs `npm run lint && npm run typecheck && npm run rules`.

In `.github/workflows/ci.yml`, a new `app` job runs `npm ci`, `npm run check` and `npm run build`. Both jobs use the current Node.js LTS (check nodejs.org, don't assume), and `package.json` sets an `engines.node` range to match. The lead records the version in `DECISIONS.md` so the owner installs the same one. The existing `rules` job stays, moved to the same Node version.
Context: depends on T0.1.
Rules that apply: CI must not need any secrets at this stage.
Out of scope: test runners (Vitest arrives in Stage 1), Supabase.
Done when: `npm run check` passes locally; deliberately breaking a type makes `npm run typecheck` fail (revert afterwards); CI is green on the pushed commit.
Evidence: commit `f3f3dfb`. GitHub CI run #14 passed (both the `rules` and `app` jobs).
- The lead re-ran `npm run check`: exit 0, check-rules 0 errors, 52/52 tests.
- The builder showed a deliberate type error failing `typecheck` (TS2322, exit 2), and a fresh-checkout simulation passed `npm ci`, `check` and `build`.
- The code reviewer approved with no blocking findings. It verified the `@v7` actions exist, that the lockfile is in sync, and that `&&` chains pass failures through. It also re-ran everything on Node 24.22.1.
- Optional finding taken: `lint` now uses `--max-warnings=0`, so warnings fail the check.

### T0.3 — Owner runs the app on their own computer      Status: todo
Owner agent: **owner** (the lead prepares the steps)
Guide: §17 Stage 0 steps 1, 4
Steps for the owner:
1. Install Node.js LTS, Git and Visual Studio Code.
2. Clone the repo and check out the working branch.
3. Run `npm install`, then `npm run dev`.
4. Open the local address and change the heading text in `src/app/page.tsx`.
5. Watch the page update.
Done when: the owner confirms it worked.
Evidence:

### T0.4 — Protect the main branch on GitHub              Status: todo
Owner agent: **owner** (the lead prepares the steps)
Guide: §1 (save points), §17 Stage 0
Why: the agents' safety hook blocks pushes to `main`, and their permission settings block merging PRs, but a hook can be worked around. GitHub's branch protection is the real lock. Only you merge pull requests. The agents will tell you when a PR is ready.
Steps for the owner: on GitHub, go to the repo's **Settings → Branches** (or **Rules → Rulesets**) and add a rule for `main` that:
- requires a pull request before merging;
- requires the CI status checks to pass;
- blocks force pushes;
- blocks deletion.
Done when: the owner confirms the rule is active.
Evidence:

## Stage gate

**Gate run 2026-10-24 by the lead:**
- Checks re-run after the last change: `npm run check` exit 0 (lint with 0 warnings, typecheck, check-rules 0 errors, 52/52 tests); `npm run build` exit 0; CI green on `f3f3dfb`.
- "Done when" claims: 1, 2, 3 and 5 are proven (table above). Claims 4 and 6 need the owner.
- §19 sweep: Stage 0 makes no testing-checklist item testable yet. ("No secret keys in browser code, Git history or logs" becomes testable once keys exist, in Stage 2.)
- Whole-stage review: the stage diff is exactly the two reviewed task diffs plus the lead's record keeping, and both T0.1 and T0.2 were approved by the code reviewer. No security-sensitive code (auth, RLS, routes, secrets) was touched, so there was no security review.

Run the `stage-gate` skill. The "Check yourself" questions for the owner:
- What's the difference between your code on your computer, in Git and on GitHub?
- How would you undo a bad change?
