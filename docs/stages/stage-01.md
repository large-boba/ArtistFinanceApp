# Stage 1 — Build the screens with pretend data

**Status:** in progress (opened 2026-10-25; stage start commit `67cee8c`)
**Guide:** §17 Stage 1. Also §6 (showing dates and amounts), §7 (expense groups), §10 (cash-sale design).

## You'll learn

Components, props, state, forms, lists and mobile-first layout. There's no database yet, so the focus is purely on how the app feels.

## Owner decisions for this stage (2026-10-25)

- **Screens:** "just build it". The team follows the guide's descriptions, and the owner reacts to the result on the Cloudflare link. No paper sketch.
- **Typed amounts** (guide's Stage 1 exercise):
  - A leading `$` is ignored ("$110" means 110.00).
  - Commas are thousands separators and are ignored ("1,100.00" means 1100.00).
  - At most 2 decimals; "10.505" is **rejected**, not rounded.
  - **Zero is allowed.**
  - Negative amounts, other symbols, letters and empty input are rejected.
  - A full stop is the only decimal mark for now. Comma decimals and per-currency decimal places come in Stage 4.

## Done when, as checkable claims

| # | Claim | Evidence |
|---|---|---|
| 1 | Home, Transactions, Events, Reports and Settings screens exist, reachable from a thumb-friendly bottom navigation bar | |
| 2 | Pretend expenses can be added through the expense form (temporary state only) | |
| 3 | Pretend sales can be added through the quick-sale number pad | |
| 4 | A list of entries and a running total are shown | |
| 5 | All of the above is comfortable on a real phone | NEEDS OWNER |
| 6 | The owner can explain every file written in this stage | NEEDS OWNER |

## Task cards

### T1.1 — Unit test runner (Vitest)                       Status: done
Owner agent: backend-engineer   Tests: a sample test proves the runner works (it must fail when broken)   Security review: no
Guide: §19 (testing). `DECISIONS.md` test stack.
Outcome:
- Vitest installed and configured for TypeScript with the `@/` alias.
- An `npm test` script; `npm run check` also runs the unit tests.
- CI runs them through `check`.
- One sample test in `src/lib/` that the next task replaces.
Rules that apply: one new library (Vitest only; no React Testing Library yet); `npm run check` stays green.
Out of scope: Playwright, component tests.
Done when:
- `npm test` passes;
- breaking the sample test makes `npm run check` fail (then revert);
- CI is green.
Evidence: commit `4a39ae1`; CI run #36 passed. The lead re-ran `npm run check`: exit 0, 1 test file passing, check-rules 0 errors, 60/60 guardrail tests. The builder and the reviewer each broke the test on purpose and saw `check` exit 1. The reviewer confirmed `npm ci` leaves the lockfile unchanged on both npm 10 and npm 11, and that no test code reaches the worker bundle. Code review approved, no blocking findings.

### T1.2 — Browser tests at phone size (Playwright)       Status: done
Owner agent: backend-engineer   Tests: a smoke test proves the runner works   Security review: no
Guide: §1 (test on a real phone early), §19 (everyday use).
Outcome:
- Playwright with Chromium, running against the built app with two projects: **phone 390×844** and **desktop**.
- An `npm run test:e2e` script, and a CI job that installs Chromium and runs it.
- One smoke test: the home page loads.
Context: Chromium is preinstalled in the cloud container. Use the installed browser, and don't run `playwright install` locally.
Out of scope: real feature tests (the test engineer writes those per task).
Done when:
- `npm run test:e2e` passes locally;
- CI's e2e job is green.
Evidence: commit `ef9b146`; CI run #38 green (rules, app and e2e jobs).
- Lead re-run: `CI=1 npm run test:e2e` 2/2 passed, also with a stray `PORT=4123` set after the review fix.
- A deliberate break failed both projects.
- The reviewer's probe confirmed the phone project is 390×844 with touch and a coarse pointer.
- Code review approved, no blocking findings. Optional fixes taken: an explicit port and a reuse-server comment. The page-error check is passed on to the T1.3 tests.

### T1.3 — App shell: replace the starter page, bottom navigation   Status: tests
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §17 Stage 1 steps 1–2, §15 (installable app comes in Stage 6), §19 (everyday use).
Outcome:
- The Next.js starter content is removed: page, starter SVGs, and the Vercel and Next.js links.
- The page title is "BentoBudget".
- A bottom navigation bar with **Home, Transactions, Events, Reports, Settings**:
  - each a real page with a heading and a short "coming in Stage N" note where it's empty;
  - the current tab is highlighted;
  - it's usable with a thumb: targets at least 44×44 px, labelled for screen readers, and it works by keyboard.
- Home shows two big buttons, **+ Sale** and **+ Expense**. They can be placeholders until T1.7 and T1.8.
Rules that apply: mobile-first; accessible; no server code; no new libraries.
Out of scope: forms, data, PWA manifest.
Done when:
- The test engineer's Playwright tests pass at phone and desktop sizes: each tab navigates, each page has its heading, the tap targets meet the minimum size, and there are no links to vercel.com or nextjs.org.
- `npm run check` passes.
Evidence:

### T1.4 — Turning typed amounts into cents                Status: building
Owner agent: backend-engineer   Tests: test-engineer (Vitest, written first)   Security review: no
Guide: §17 Stage 1 exercise, §7 (money as integer minor units), owner decisions above.
Outcome: `src/lib/money.ts` with:
- `parseAmountToCents(input: string): number | null`, following the owner's rules exactly;
- `formatCents(cents, currency, locale)`, which displays using `Intl.NumberFormat`.

No floating-point arithmetic on money: parse the whole and fraction parts as integers, as the guide's example does.
Done when: the test engineer's table of cases passes. The table includes "110", "110.5", "110.50", "$110", "1,100.00", "0", "0.00", "10.505", "-5", "abc", "", "  12.30  ", "1,10,0" and "€5".
Evidence:

### T1.5 — Pretend-data store and today's date              Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Vitest for the store logic and the date helper)   Security review: no
Guide: §6 (store a date, not a moment; `todayOnDevice`), §7 (shape), §10 (income fields).
Outcome:
- An in-memory store (React context plus a reducer) for pretend entries, which is lost on refresh on purpose. It handles:
  - **expenses:** date `YYYY-MM-DD`, supplier, amountCents, category, group, optional event and notes;
  - **sales:** date, amountCents, payment method (default cash), optional event;
  - add, edit and delete for both.
- `todayOnDevice()` from guide §6.
- A small set of pretend events.
- A **draft** category list using the guide's §7 examples, clearly labelled as pretend data. The real list is still to decide.
Rules that apply: dates stay strings, never `new Date("YYYY-MM-DD")`; money stays integer cents.
Done when: the test engineer's tests pass for adding, editing and deleting entries, the totals, and the date helper.
Evidence:

### T1.6 — Entries list and running total                  Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §17 Stage 1 step 4, §10 (a running total for the event).
Outcome:
- **Transactions** lists the pretend entries, newest first, showing the date in the device's local format, the description and the amount.
- **Home** shows "Today: $X from N sales" and today's expenses.
- An empty state when there are no entries.
Done when: the Playwright tests pass (after an entry is added it appears in the list and the totals update, and the empty state shows).
Evidence:

### T1.7 — Expense form                                     Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §17 Stage 1 step 3, §7 (groups; event & venue categories prompt for an event), §6 (native date picker, show the interpreted amount).
Outcome: "+ Expense" opens a form with:
- **date:** a native picker, defaulting to today;
- **supplier**;
- **amount:** live "interpreted as $X" feedback, with errors using the T1.4 rules;
- **category:** grouped under Production, Event & venue and Operating. Picking an event & venue category prompts for an event, allowing "not assigned yet";
- **notes**.

Saving adds the entry to the store and returns to Home.
Done when: the Playwright tests pass. They cover a valid save, rejected amounts with clear messages, the event prompt for event & venue categories, and keyboard and screen-reader labels.
Evidence:

### T1.8 — Quick-sale number pad                            Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §10 (designing cash-sale entry for a busy stall).
Outcome:
- "+ Sale" opens a large number pad, not a long form.
- Defaults: date = today, payment = cash, event = today's pretend event if there is one.
- The usual flow is type an amount, then tap Save.
- An easy undo of the last sale.
- The running total is visible.
Done when:
- The Playwright tests pass: a sale is logged in a few taps at phone size, undo works, and invalid amounts are blocked.
- A one-handed layout: the pad sits in the bottom half of the screen.
Evidence:

### T1.9 — Owner tries it on a real phone                   Status: todo
Owner agent: **owner**
Steps:
1. Open the Cloudflare link (or a PR preview link) on your phone.
2. Add three expenses and five sales.
3. Note anything awkward, too small or confusing.
Done when: the owner reports back, and any fixes are made.
Evidence:

## Stage gate

Run the `stage-gate` skill. The "Check yourself" questions for the owner:
- Why do entries vanish when you refresh?
- Where does "state" live, and what would make it last?
