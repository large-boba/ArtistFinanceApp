# Stage 0 — Set up your workshop

**Status:** in progress. Reopened for T0.5 (Cloudflare hosting, the owner's decision of 2026-10-24); T0.3 and T0.4 wait on the owner. Opened 2026-10-24; stage start commit `dd90913`.
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
| 5 | The first app commit is on GitHub | `54bc667`, merged to `main` in PR #1 |
| 6 | `main` is protected on GitHub: PR plus green CI required, no force pushes (team addition, not in the guide) | NEEDS OWNER |
| 7 | The app builds for Cloudflare and runs in a local Cloudflare preview; CI checks the Cloudflare build (owner-requested addition) | T0.5: preview returned 200; CI Cloudflare step green |
| 8 | The owner can open the app at a Cloudflare preview URL | NEEDS OWNER |

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

### T0.5 — Host on Cloudflare: adapter, config and local preview   Status: done
Owner agent: backend-engineer   Tests: none. Hosting configuration; proven by the Cloudflare build, the local preview and CI   Security review: yes. It touches secrets handling (`.dev.vars`) and deploy configuration
Guide: §4 (architecture; hosting replaced per `DECISIONS.md` 2026-10-24), §15 (PWA comes later, so don't add caching now), §17 Stage 0/6
Why now: the owner wants to preview the app on Cloudflare. In the guide, a hosted preview first appears in Stage 6. The owner has brought hosting forward; this card doesn't bring forward any other Stage 6 work (manifest, service worker).
Outcome:
- `@opennextjs/cloudflare` (dependency) and `wrangler` (devDependency) installed, at versions that satisfy the adapter's peer range.
- A `wrangler.jsonc` with:
  - worker name `bentobudget`;
  - `main` and `assets` as the adapter's docs specify;
  - a current `compatibility_date`;
  - the compatibility flags the adapter requires (at least `nodejs_compat`);
  - **no** `vars` holding secrets and no bindings beyond what's required (no R2, KV or D1 yet).
- An `open-next.config.ts` with the adapter's minimal default. Incremental cache/ISR comes later, with a decision first.
- `package.json` scripts:
  - `preview` runs `opennextjs-cloudflare build && opennextjs-cloudflare preview`;
  - `deploy` runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`. Agents can never run it (the guard blocks it); it's for the owner and for Cloudflare's own build system;
  - `cf-typegen` runs `wrangler types` with the adapter's recommended arguments.
- Any `next.config.ts` change the adapter's docs require for `next dev` (for example `initOpenNextCloudflareForDev()`), only if required.
- `.dev.vars.example` listing variable *names* only (empty for now is fine). `.gitignore` already covers `.dev.vars`, `.open-next/` and `.wrangler/`.
- CI `app` job: add a step that runs `npx opennextjs-cloudflare build`, so every push proves the Cloudflare build works. It must need no Cloudflare credentials.
- `README.md`: a short "Cloudflare preview" section with how to run `npm run preview` locally.

Context: the adapter's docs site isn't reachable from this container, so use the README and docs bundled in `node_modules/@opennextjs/cloudflare` after installing, plus `npx opennextjs-cloudflare --help` and `npx wrangler --help`. Next.js 16.4.3 builds with Turbopack. If the adapter needs a webpack build, or a different build command, report it. Don't change the Next.js build silently.
Rules that apply:
- one new thing: this hosting setup only;
- secrets never go in `wrangler.jsonc` or Git;
- agents never deploy or log in. Only local `build` and `preview`; the guard enforces this;
- `npm run check` must stay green.
Out of scope: creating the Cloudflare account, connecting the repo, deploying, custom domains, R2/KV/D1, caching, PWA.
Done when:
- `npm run check` passes;
- `npx opennextjs-cloudflare build` succeeds;
- `npm run preview` serves the app locally, and `curl -s localhost:<port>` returns the starter page's HTML (status 200), after which the preview is stopped;
- `npm run build` (plain Next.js) still passes;
- CI is green with the new step;
- `git status` shows no build output or secrets.
Evidence: commits `b6297ec`, `6a8b3cc` (builder) and `8977204`, `9efd734`, `4a9009f` plus the final guard commit (the lead's guardrails).
- Lead re-run: `npm run check` exit 0 (check-rules 0 errors, 60/60 guardrail tests).
- Builder evidence: `opennextjs-cloudflare build` succeeded; the local preview returned 200 with the starter page at localhost:8787; `npm run build` passed.
- CI: green on every T0.5 commit, including the new Cloudflare build step (runs #19, #21, #23).
- Code review: round 1 found 1 blocking issue (generated `cloudflare-env.d.ts` broke `check`), now fixed and confirmed in the re-review.
- Security review:
  - approved T0.5;
  - its hardening notes were taken: deploy only from Cloudflare's Git build, and an accurate comment for `global_fetch_strictly_public`;
  - three verification rounds on the lead's guardrails closed several more bypasses: extra script arguments, scoped package names, `wrangler2`, `node <path>`, `--prefix`, `--call=`;
  - npm audit findings were accepted and recorded in `DECISIONS.md`.

### T0.6 — Owner connects the repo to Cloudflare            Status: waiting on owner (steps sent 2026-10-24)
Owner agent: **owner** (the lead prepares the steps after T0.5 is accepted)
Outcome: Cloudflare builds the app from GitHub and gives a preview URL the owner can open on their phone.
Done when: the owner opens the app at its Cloudflare URL.
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
