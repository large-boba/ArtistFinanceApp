---
name: stage-gate
description: Procedure the project lead runs to close a BentoBudget build stage. Use when every task in docs/stages/stage-NN.md is accepted and the lead believes the stage's "Done when" line is met.
---

# Stage gate

A stage closes only on evidence, never on an agent's word. Work through every step. If any step fails, the stage stays open: record what failed in the stage file and plan the fix.

## 1. Re-run every check yourself

- `npm run check` (lint, typecheck, unit tests, rule checks). Before Stage 0 adds it, run `node scripts/check-rules.mjs && node --test scripts/*.test.mjs`.
- `supabase test db` once database tests exist (Stage 2 onward). It needs local Supabase (Docker). If Docker isn't available, the database checks are **not run**. Say so; never report them as passing.
- `npx playwright test` once end-to-end tests exist.
- Check that CI is green on the latest pushed commit.

Paste the final lines of each command's output into the stage file under **Evidence**.

## 2. Prove every "Done when" line

Open the stage in `docs/build-guide.html` (§17). Split its "Done when" sentence into separate claims. For each claim, record in the stage file:
- the evidence (a test name and its result, a command output, a screenshot path, or a hand-checked total);
- or `NEEDS OWNER`, with the exact steps for the owner to follow.

## 3. Sweep the testing checklist

Go through §19 and list every item this stage makes testable. Each one must have a passing test or a `NEEDS OWNER` entry. Items that belong to later stages stay unticked.

## 4. Review the whole stage diff

Run `git diff <stage-start-commit>..HEAD`. Dispatch `code-reviewer` on the whole diff. If the stage touched auth, RLS, storage, route handlers or secrets, dispatch `security-reviewer` too. Fix every blocking finding before going on.

## 5. Update the records

- `DECISIONS.md`: the status block, any new decisions with reasons, and the data map if personal data or a provider was added.
- The stage file: mark the stage `READY FOR SIGN-OFF`.

## 6. Hand over to the owner

Send the owner:
1. The status block (the format in the lead's instructions).
2. What was built, in plain English, with the two or three concepts worth understanding.
3. Every `NEEDS OWNER` step, numbered, with exact commands or taps.
4. The stage's **"Check yourself"** questions. Ask them, help the owner reason, and don't just give the answers.

Then **stop and wait**. The stage is closed only when the owner says so. Record the sign-off date in the stage file and `DECISIONS.md`, then plan the next stage.
