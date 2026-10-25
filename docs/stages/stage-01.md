# Stage 1 — Build the screens with pretend data

**Status:** in progress (opened 2026-10-25; stage start commit `67cee8c`)
**Guide:** §17 Stage 1. Also §6 (showing dates and amounts), §7 (expense groups), §10 (income streams). **Re-planned on 2026-10-25** after the owner's change of direction: see DECISIONS.md, "What the app is for" and the rows after it.

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
| 1 | Home, Events, Expenses, Income and Settings screens exist, reachable from a thumb-friendly bottom navigation bar (owner's tabs, 2026-10-25) | |
| 2 | Pretend expenses can be added through the expense form (temporary state only), tagged with an event or income stream where the rules allow | |
| 3 | Pretend income can be added: event takings per day as cash + card, other streams as one amount and a payment method | |
| 4 | A "+" button on Home and every summary page offers Income or Expense, pre-filled from the page it's on | |
| 5 | Event pages show takings by day, event & venue costs, the optional "Other costs" figure and the result; stream pages show income, tagged costs and the result | |
| 6 | All of the above is comfortable on a real phone | NEEDS OWNER |
| 7 | The owner can explain every file written in this stage | NEEDS OWNER |

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

### T1.8 — Remove the quick-sale pad                       Status: done
Owner agent: frontend-engineer   Tests: test-engineer (update the specs that mention "+ Sale"; prove /sale is gone)   Security review: no
Guide: DECISIONS.md "What the app is for" and "Quick-sale pad" (these replace §10's cash-sale design and §17 Stage 1's "quick-sale number pad").
Outcome: the pad (`src/app/sale/`, `src/components/QuickSale.tsx`, `e2e/quick-sale.spec.ts`) and Home's "+ Sale" button are deleted. Nothing else changes yet: the sale entries in the store stay until T1.10 replaces them.
Out of scope: the new navigation, income forms and the "+" button (later cards).
Done when: `/sale` returns 404; Home has no "+ Sale"; the full Playwright suite passes; `npm run check` exits 0.
History: the original pad card (built in 671a37a, review round 1 found 2 blocking issues) was cancelled when the owner changed direction. Its tests-first fix round was paused mid-build and kept only as a local stash and patch.
Evidence:
- **Tests first** (test engineer): `e2e/removed-quick-sale.spec.ts` covers:
  - R1: /sale is a 404 on the test build and on the build without the test flag, with redirects not followed;
  - R2: Home has no "Sale" control and no link to /sale, and still has "+ Expense";
  - R3: no page or hydration errors.

  `e2e/app-shell.spec.ts` now expects only "+ Expense". Red run: the 5 removal tests failed in both projects (200 instead of 404, one "+ Sale" link); everything else passed.
- **Built** (frontend engineer):
  - deleted `src/app/sale/`, `src/components/QuickSale.tsx` and `e2e/quick-sale.spec.ts`;
  - "+ Sale" removed from Home;
  - `todaySalesText` no longer exported;
  - stale comments reworded.
- **Code review: CHANGES REQUIRED, 1 blocking.** Deleting the pad's spec also removed the only test that Home's totals sit in a polite live region (the T1.6-review carry-over). Fixed by the test engineer: the test and its helper moved to `e2e/entries-list.spec.ts` (claim D10). Proof it can fail: with `aria-live` removed, both projects failed (Expected "polite", Received null); the file was restored byte for byte. Optional findings taken: a re-wrapped comment in `entries.ts`, and stale live-selling comments in the unit tests reworded (no assertion changed).
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 405/405, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **828 passed, 0 failed** (308 skipped are by-project skips).
- **For T1.18:** the new Home summary must also be a polite live region; D10 will be re-targeted then, with the lead's approval.

### T1.10 — Income entries and income streams (replacing "sales")   Status: tests
Owner agent: backend-engineer (`src/lib`), then frontend-engineer (wiring: the test seam, the entries list, Home's totals)   Tests: test-engineer (Vitest + the e2e seam contract)   Security review: no (pure functions, pretend data)
Guide: §10 (seven default streams, cash basis, "the event's usual stream"), §7, §6; DECISIONS.md rows from "What the app is for" to "Event 'Other costs'".
Outcome:
- **`src/lib/pretend-data.ts`:**
  - `INCOME_STREAMS`: the 7 default streams with stable ids, in the guide's order.
  - Pretend events gain a **usual stream**. Shelf rentals use Vendor shelf rental; everything else uses Sales at events.
  - The events become:
    - a finished **3-day** convention whose dates are worked out from today;
    - today's market (keep the id `pretend-event-todays-market`);
    - an ongoing shelf rental with no end date.
  - Date arithmetic is a small pure helper on `YYYY-MM-DD` strings (no `new Date("YYYY-MM-DD")`, no time-zone maths).
- **`src/lib/entries.ts`:**
  - The `"sale"` entry kind becomes **`"income"`**: date, stream, amount, payment method (required), an optional event, and notes.
  - An event may be linked only for the Sales at events and Vendor shelf rental streams.
  - The add-sale action becomes **add-income**; edit and delete keep working.
  - `totalsForDate` counts income rows, so Home keeps working until T1.18.
- **Wiring** (frontend-engineer):
  - The test seam's `addSale` becomes `addIncome`, with the same safety locks (only when `NEXT_PUBLIC_E2E` is "1" and on localhost).
  - The Transactions list shows an income row with its stream name.
  - Home's wording is unchanged.
Out of scope: event takings, stream tags and "Other costs" (T1.10b); summaries (T1.10c); any new screen.
Done when: the Vitest and updated Playwright tests pass; the seam is still absent from the Cloudflare build (CI grep); `npm run check` exits 0.
Evidence:

### T1.10b — Event takings, stream tags on costs, event "Other costs"   Status: todo
Owner agent: backend-engineer   Tests: test-engineer (Vitest)   Security review: no
Guide: §10 "Two styles, one table", §7; DECISIONS.md "Event takings", "Linking costs to events and streams", "Event 'Other costs'".
Outcome:
- One action adds an event day's takings as **two income rows**, cash and card. Both are always saved, even at $0. The stream is Sales at events, or the event's usual stream.
- Expenses get an optional **stream tag**, allowed only for event & venue and operating costs. Production costs never carry an event or a stream, including after an edit.
- Each event can have one "Other costs" figure (amount and short note), which can be set, changed or cleared.
Done when: the Vitest tests pass with hand-worked values; `npm run check` exits 0.
Evidence:

### T1.10c — Summaries: by event, by stream, by date range   Status: todo
Owner agent: backend-engineer   Tests: test-engineer (Vitest)   Security review: no
Guide: §12 "By event or venue", "By income stream"; DECISIONS.md "Event 'Other costs'".
Outcome: pure selectors that do all the adding up:
- **Event:** takings per day (cash, card, total), event & venue costs, the result, the "Other costs" figure, and the result after it.
- **Stream:** income, the costs counted toward the stream (its tag, or else the linked event's usual stream; each cost counts toward one stream at most), and the result.
- **Date range:** income, expenses, net.

"Other costs" never enters stream or range totals.
Done when: the Vitest tests pass, including the owner's example: takings $1,000 + $2,000 + $1,500 = $4,500; event costs $500 + $299 + $200 = $999; result $3,501; with $600 other costs, $2,901. `npm run check` exits 0.
Evidence:

### T1.11 — New bottom navigation: Home, Events, Expenses, Income, Settings   Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright; update app-shell and entries-list specs)   Security review: no
Guide: §17 Stage 1 step 2; DECISIONS.md "Navigation". Keeps T1.3/T1.3b's rules: 44px targets, pinned only when ≤25% of the screen height, works at 200% text.
Outcome: the five tabs in that order. Expenses and Income are simple pages for now (filled in by T1.16 and T1.17). Transactions and Reports leave the nav and their routes are removed; the entries list moves under Expenses and Income in later cards.
Done when: the updated Playwright tests pass at phone and desktop size; `npm run check` exits 0.
Evidence:

### T1.12 — Income form                                     Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §10, §6; DECISIONS.md "Event takings".
Outcome: `/income/new`, built in the same style as the expense form:
- date and stream fields;
- for **Sales at events**: event, **Cash** and **Card** amounts (both required, 0 allowed) and a live total;
- for other streams: one amount and a payment method;
- notes.

It reads pre-fill values from the page address (event, stream). Saving adds the rows and goes back to where you came from.
Done when: the Playwright tests pass (valid saves for both shapes, rejected amounts, pre-fill, labels and keyboard); `npm run check` exits 0.
Evidence:

### T1.13 — Expense form: stream tag and pre-fill             Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright; extend expense-form spec)   Security review: no
Guide: §7; DECISIONS.md "Linking costs to events and streams".
Outcome:
- An optional **Income stream** field for event & venue and operating categories. It's hidden for production costs, with a one-line note: "Production costs aren't linked to an event or stream."
- Pre-fill of the event or stream from the page address.
- Saving returns to where you came from.
Done when: the Playwright tests pass; `npm run check` exits 0.
Evidence:

### T1.14 — The "+" button: Income or Expense                Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: DECISIONS.md "The '+' button".
Outcome: one shared "+" button component. Tapping it offers **Income** and **Expense** (keyboard and screen-reader friendly, 44px targets, reachable above the nav). Each choice opens its form, pre-filled with the page's event or stream. On Home nothing is pre-filled.
Done when: the Playwright tests pass; `npm run check` exits 0.
Evidence:

### T1.15 — Events tab and event page                      Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §12 "By event or venue" (with its note that production costs aren't included), §7; DECISIONS.md "Event 'Other costs'".
Outcome:
- **Events list:** each event with its dates and result.
- **Event page:**
  - takings by day (cash, card, total);
  - event & venue costs;
  - the result;
  - the optional "Other costs" figure (add, change, clear) and the result after it;
  - a note that production costs aren't included;
  - the "+" button, pre-filled with this event.
Done when: the Playwright tests pass, including the owner's worked example; `npm run check` exits 0.
Evidence:

### T1.16 — Income tab and stream pages                     Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §10 (seven default streams), §12 "By income stream".
Outcome:
- **Income tab:** the 7 streams, each with its total.
- **Stream page:** its income entries, tagged costs, the result, and the "+" button pre-filled with this stream.

"Sales at events" also lists its events.
Done when: the Playwright tests pass; `npm run check` exits 0.
Evidence:

### T1.17 — Expenses tab                                    Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §7, §12.
Outcome: the expense list (newest first), totals per group (production, event & venue, operating), and the "+" button.
Done when: the Playwright tests pass; `npm run check` exits 0.
Evidence:

### T1.18 — Home summary                                    Status: todo
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Guide: §12 (main profit view, simplified for pretend data).
Outcome: Home shows this month's income, expenses and net, and the "+" button with nothing pre-filled. It replaces "today" totals, which suited live selling.
Done when: the Playwright tests pass; `npm run check` exits 0.
Evidence:

### T1.9 — Owner tries it on a real phone                   Status: todo
Owner agent: **owner**
Steps:
1. Open the Cloudflare link (or a PR preview link) on your phone.
2. Enter the takings for a 3-day event (cash and card per day), three event costs, one online sale and one operating cost. Then check the event page and the stream pages.
3. Note anything awkward, too small or confusing.
Done when: the owner reports back, and any fixes are made.
Evidence:

## Stage gate

Run the `stage-gate` skill. The "Check yourself" questions for the owner:
- Why do entries vanish when you refresh?
- Where does "state" live, and what would make it last?
