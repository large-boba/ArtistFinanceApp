# Stage 0 — Set up your workshop

**Status:** not started
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
| 1 | The starter Next.js app (TypeScript, App Router, Tailwind) builds and passes lint and the rule checks | |
| 2 | `.env.local` is ignored by Git before any keys exist | |
| 3 | CI runs lint, typecheck, rule checks and build on every push, and is green | |
| 4 | The owner has run the app locally, changed some text and seen it update | NEEDS OWNER |
| 5 | The first app commit is on GitHub | |

## Task cards

### T0.1 — Scaffold the Next.js app                      Status: todo
Owner agent: frontend-engineer   Tests: none. This is generated scaffolding; it's verified by build, lint and the rule checks   Security review: no. No auth, data or secrets yet
Guide: §17 Stage 0 step 3, §4
Outcome: A fresh Next.js app in the repo root, created with the current `create-next-app`. Options: TypeScript, ESLint, Tailwind CSS, App Router, `src/` directory, import alias `@/*`, npm.
Context: The repo already holds `CLAUDE.md`, `DECISIONS.md`, `docs/`, `scripts/`, `.claude/` and `.github/`. `create-next-app` refuses a non-empty folder, so generate the app in a temporary folder and copy it in, overwriting none of the existing files. Merge `.gitignore` if both have one. Check the current Next.js install docs first (§21).
Rules that apply: one new thing at a time (no extra libraries); never commit `.env*.local`; `scripts/check-rules.mjs` must pass.
Out of scope: Vitest, Supabase, Zod, any screens beyond the starter page, PWA files.
Done when: `npm run build` succeeds; `npm run lint` passes; `node scripts/check-rules.mjs` passes; `git check-ignore -v .env.local` shows it's ignored; the installed Next.js, React, TypeScript and Tailwind versions are listed in the report so the lead can record them in `DECISIONS.md`.
Evidence:

### T0.2 — One command for all checks, and CI to run it   Status: todo
Owner agent: backend-engineer   Tests: none. Tooling configuration; proven by running it and by CI   Security review: no
Guide: §1 (habits), §17 Stage 0
Outcome: These scripts in `package.json`:
- `typecheck` runs `tsc --noEmit`;
- `rules` runs `node scripts/check-rules.mjs && node --test scripts/*.test.mjs`;
- `check` runs `npm run lint && npm run typecheck && npm run rules`.

In `.github/workflows/ci.yml`, a new `app` job runs `npm ci`, `npm run check` and `npm run build` on Node 22. The existing `rules` job stays.
Context: depends on T0.1.
Rules that apply: CI must not need any secrets at this stage.
Out of scope: test runners (Vitest arrives in Stage 1), Supabase.
Done when: `npm run check` passes locally; deliberately breaking a type makes `npm run typecheck` fail (revert afterwards); CI is green on the pushed commit.
Evidence:

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

## Stage gate

Run the `stage-gate` skill. The "Check yourself" questions for the owner:
- What's the difference between your code on your computer, in Git and on GitHub?
- How would you undo a bad change?
