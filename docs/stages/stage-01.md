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

### T1.3 — App shell: replace the starter page, bottom navigation   Status: done
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
Evidence: commits `186b39e` (shell), `bb3da79` (200% text fix) and `3be7d45` (focus-not-hidden fix).
- Tests first: the T1.3 spec has 329 passing runs (177 skipped by project).
- Lead re-run: `npm run check` exit 0; `CI=1 npx playwright test` 329 passed.
- Code review, three rounds:
  1. BLOCKING: nav overflow at 200% text (WCAG 1.4.4). Fixed with a wrapping nav.
  2. BLOCKING: the sticky multi-row nav hid focused controls on short screens (WCAG 2.4.11). Fixed with a static nav when the screen is 700px tall or less, plus scroll-padding.
  3. Approve. 9 viewports × 2 text sizes × 5 pages, with 0 cases of hidden focus.
- Follow-ups go to T1.3b.

### T1.3b — Keep the nav pinned unless it's too tall (before T1.6)   Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §10 (fast entry at a stall), §19 (everyday use).
Why: the T1.3 final review found that the 700px height rule un-pins the nav for most iPhones in a Safari tab (visible height is about 664px). That makes switching tabs slow once Transactions is a long list.
Outcome:
- The nav stays sticky at the bottom unless its **measured** height is more than a set share of the visible screen (the lead suggests 25%). Only then does it sit in page flow. The share is measured with the existing ResizeObserver, not guessed from the screen height.
- Focus must still never be hidden (the T1.3 tests stay green).
- Review cleanups:
  - no 700/701px gap: use `height >` and `height <=`, or remove the media queries;
  - `observe(nav, { box: "border-box" })`;
  - a better first-paint fallback for `--nav-h`;
  - fix the layout comment about "sticky".
Done when:
- New tests pass: at 390×664 (Safari iPhone) and 375×667 at 100% the nav is sticky; at 320×568 and 568×320 at 200% it isn't.
- All existing T1.3 tests still pass.
- `npm run check` passes.
Lead decisions (2026-10-25), from the test engineer's questions:
- The 25% share is measured against `window.innerHeight`, not `visualViewport`, so pinch-zoom never un-pins the nav.
- The rule is re-checked when the nav resizes **and** when only the screen height changes.
- The T1.3 decision-14 tap test now scrolls the tab into view first, because at 200% text on a tall phone the nav sits at the end of the page.
- A suite of about 3.6 minutes is acceptable.

Evidence: commit `a610f8f`; CI run #49 green.
- Tests first: 66 failed before the change.
- Lead re-run: `npm run check` exit 0; `CI=1 npx playwright test` 455 passed.
- Code review approved, no blocking findings. Probe results: the switch happens exactly at 25%, there's no flip-flop under 60 rapid resizes, and no ResizeObserver errors.
- Optional follow-ups logged in `DECISIONS.md`.

### T1.4 — Turning typed amounts into cents                Status: done
Owner agent: backend-engineer   Tests: test-engineer (Vitest, written first)   Security review: no
Guide: §17 Stage 1 exercise, §7 (money as integer minor units), owner decisions above.
Outcome: `src/lib/money.ts` with:
- `parseAmountToCents(input: string): number | null`, following the owner's rules exactly;
- `formatCents(cents, currency, locale)`, which displays using `Intl.NumberFormat`.

No floating-point arithmetic on money: parse the whole and fraction parts as integers, as the guide's example does.
Done when: the test engineer's table of cases passes. The table includes "110", "110.5", "110.50", "$110", "1,100.00", "0", "0.00", "10.505", "-5", "abc", "", "  12.30  ", "1,10,0" and "€5".
Evidence: commit `087d4e1`; CI run #42 green.
- Tests first: 101 Vitest cases. They failed before the code existed and pass now. They were also run against five deliberately wrong versions, and every one failed.
- Lead re-run: `npm run check` exit 0.
- Code review approved, no blocking findings. A fuzz test of 2.5M inputs against an independent reference found 0 differences.
- Optional follow-ups logged in `DECISIONS.md`.
- Note: the lead's commit `5fc8b66` accidentally removed the sample test, and CI run #40 failed. It was restored in `8dd7ff7` (run #41 green).

### T1.5 — Pretend-data store and today's date              Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Vitest for the store logic and the date helper)   Security review: no
Guide: §6 (store a date, not a moment; `todayOnDevice`), §7 (shape), §10 (income fields).
Outcome:
- The pure state logic for pretend entries: a reducer, with types and selectors, which is lost on refresh on purpose. The React context provider that holds it moved to **T1.6**, its first user (lead, 2026-10-25). It handles:
  - **expenses:** date `YYYY-MM-DD`, supplier, amountCents, category, group, optional event and notes;
  - **sales:** date, amountCents, payment method (default cash), optional event;
  - add, edit and delete for both.
- `todayOnDevice()` from guide §6.
- A small set of pretend events.
- A **draft** category list using the guide's §7 examples, clearly labelled as pretend data. The real list is still to decide.
Rules that apply: dates stay strings, never `new Date("YYYY-MM-DD")`; money stays integer cents.
Done when: the test engineer's tests pass for adding, editing and deleting entries, the totals, and the date helper.
Evidence: commit for T1.5; 287 tests written first, and 388 unit tests pass in total.
- Lead re-run: `npm run check` exit 0.
- Code review approved, no blocking findings. Fuzz checks found 0 mismatches:
  - 50k instants × every IANA zone;
  - 60k dates × 29 locales;
  - 200k random reducer actions.
- Follow-up in progress: reject `-0` cents, and add tests for explicit `undefined` in edits and for year 0000.

### T1.6 — Entries list and running total                  Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §17 Stage 1 step 4, §10 (a running total for the event).
Outcome:
- (Moved from T1.5) the React context provider in the root layout: `useReducer(entriesReducer, pretendEvents(todayOnDevice()).map(e => e.id), createEntriesState)`, with entry ids from `crypto.randomUUID()`. It's a client component, kept as small as possible.
- **Transactions** lists the pretend entries, newest first, showing the date in the device's local format, the description and the amount.
- **Home** shows "Today: $X from N sales" and today's expenses.
- An empty state when there are no entries.
Done when: the Playwright tests pass (after an entry is added it appears in the list and the totals update, and the empty state shows).
Lead decisions (2026-10-25), from the test engineer's questions:
- **Test seam approved, with both locks.** `window.__bentoTest` exists only in a build made with `NEXT_PUBLIC_E2E=1` (pinned in next.config, built into `.next-e2e`), and it installs only on localhost or 127.0.0.1. Tests S1–S5 prove it never ships. A **security review is required** before acceptance.
- Money and dates show in the device's locale (an en-US device shows "A$").
- Wording:
  - "Today: $X from N sales" ("1 sale" when singular);
  - "Today's expenses: $X";
  - "No entries yet.".
- Rows show the words "Sale" or "Expense", positive amounts, a `<time datetime>`, and the amount in its own element.
- Sales show the event name if there is one, otherwise the payment method. Expenses show the supplier, otherwise the category.

Evidence: commit `24b1ea2`. 94 browser tests written first; the full suite passes 548.
- Lead re-run: `npm run check` exit 0.
- **Security review approved.** It built the app exactly as Cloudflare does and found no trace of the seam anywhere in `.open-next`. The hostname lock held against tricky names, and the impact if enabled is informational. Both hardening items were taken: a CI step that fails if `__bentoTest` appears in `.open-next`, and a check-rules rule blocking `NEXT_PUBLIC_E2E` in env and wrangler files.
- **Code review approved.** The guide rules hold, the contrast is AAA, and there are no hydration errors.
- Optional items carried into T1.7/T1.8: reword the Home note, add `role="list"` on the `<ul>`s (Safari/VoiceOver), take the date at the moment of adding, and make Home's totals a polite live region.

### T1.7 — Expense form                                     Status: done
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
Lead decisions (2026-10-25), from the test engineer's questions:
- The form is its own page at `/expenses/new`; the header decisions F1–F10 in `e2e/expense-form.spec.ts` are approved.
- The Home note reads "Practice mode: entries disappear when you refresh or close the app." (the owner may reword it).
- `role="list"` goes on the nav `<ul>` too.
- Expense rows don't show the linked event in Stage 1 (T1.6 D6 stands; event views come in Stage 4).
- Accepted:
  - a Cancel link;
  - errors only on Save;
  - category required, with no default;
  - the expense Event defaults to "Not assigned yet".
- Process: browser test runs share ports 3000/3001, so run only one at a time.

Evidence:
- **Built:** `src/app/expenses/new/page.tsx` and `src/components/ExpenseForm.tsx`; "+ Expense" on Home is a link; `role="list"` on the nav and Transactions lists; the new Home note. Commit 0a3a2e2, then the review fixes in the next commit.
- **Tests unchanged by the builder:** `e2e/expense-form.spec.ts` was last modified at 11:04 UTC, before the build started at 13:51 UTC.
- **Lead re-ran (after the review fixes):** `npm run check` exit 0 (vitest 405/405, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test e2e/expense-form.spec.ts e2e/app-shell.spec.ts e2e/entries-list.spec.ts e2e/smoke.spec.ts` gave **820 passed, 0 failed** (312 skipped are by-project skips).
- **Screenshots** (390×844, viewed by the lead): the form reading "$1,234.5" as "Reads as $1,234.50", with the Event field shown for "Stall or table fees"; and the "10.505" error in red with the field outlined.
- **Code review: ACCEPT, no blocking findings.** Optional findings taken (cheap and clearly right):
  - the entry id is made before the double-tap guard is set, so a failed `crypto.randomUUID()` (plain-HTTP dev on a phone) can't leave Save stuck;
  - Save uses `router.replace("/")`, so Back from Home doesn't reopen an empty form.
- **Optional findings logged, not taken:**
  - The "Reads as" live region speaks on every keystroke and goes silent when the amount turns invalid. Consider a debounced, visually hidden announcement. Check it in the T1.9 phone check with VoiceOver or TalkBack.
  - Focus moves to the first bad field before React adds the error attributes. It should be fine in practice; confirm with a real screen reader at T1.9.
  - The error wording is about format, so it misleads only for amounts above the safe-integer limit. Revisit when a business maximum is decided.
  - Tidy-ups: build class names with a helper instead of a trailing space; drop the duplicate `min-h` on Notes; comment the TypeScript-only check on line 104.
  - Test gaps (for the test engineer, later): the chosen event and the notes aren't proven to be stored (Stage 4 event views can cover the event); focus to Date when the date is bad; the "Go key" test name.
- **For T1.9:** on a phone set to a comma-decimal region, the decimal keypad may have no "." key until Stage 4 adds comma decimals. Note this in the phone-check steps.

### T1.8 — Quick-sale number pad                            Status: tests
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
Lead decisions (2026-10-25), from the test engineer's questions:
- The pad is at `/sale`; the header decisions Q1–Q11 in `e2e/quick-sale.spec.ts` are approved.
- Payment resets to Cash after each save, while the event choice stays.
- Undo has no time limit and stays until the next save or leaving the pad (WCAG 2.2.1).
- An empty amount shows "$".
- "." on an empty amount gives "0.", and a digit after a lone "0" replaces it.
- The pad's running total counts all of today's sales, matching Home. Per-event totals come in Stage 4.

Review round 1 (code-reviewer: CHANGES REQUIRED). Fixes, tests first:
- **B1:** the pad's running total must use the device's date at render time, not the date when the pad opened. A sale saved after midnight must show in "Today: …" at once.
- **B2:** saving the same amount twice in a row must still be announced: each save replaces the text inside the `role="status"` region, while the region stays mounted.
- **Optional, taken:**
  - (a) `todaySalesText` moves to `src/lib/entries.ts` with a unit test (it was a plain function inside a client component file);
  - (b) the `--nav-h` fallback in the pad matches globals.css, including the home-bar inset;
  - (c) after Undo, focus goes to the amount display;
  - (d) a reach check at 390×664 (an iPhone Safari tab, as in T1.3b): all keys and Save are fully on screen above the nav without scrolling.
- **Test gaps closed:**
  - a real same-moment double click on Save;
  - Undo removes the pad's own sale, not "the newest entry";
  - typing digits while the Event select is focused leaves the amount alone.
- **Logged, not taken:** a digit cap on amounts. "No business maximum yet" is on record in DECISIONS.md, so the cap is the owner's call.

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
