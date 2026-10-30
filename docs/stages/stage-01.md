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

### T1.10 — Income entries and income streams (replacing "sales")   Status: done
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
Lead decisions (2026-10-25), from the test engineer's questions:
- The event order stays as the card lists it (convention, today's market, shelf).
- `addDays` works within 0001–9999.
- Income needs a stream and a payment method; neither has a default.
- `add-sale` is an unknown action, not an alias.
- **An income's stream doesn't have to match its event's usual stream.** The usual stream is a smart default (§10), not a rule. The owner may overrule this.
Evidence:
- **Tests first** (test engineer): `addDays` (rollovers, leap years, years 0001–0099, phone time zones, limits); `INCOME_STREAMS` and the three events; sale becomes income in `entries.test.ts`; e2e seam `addIncome`, stream-name labels, S6.
  - Red run: 223 unit and 83 e2e failures, for the intended reasons.
  - 11 deliberate bugs in a scratch implementation were all caught.
- **Built:**
  - backend engineer: `src/lib/dates.ts`, `pretend-data.ts`, `entries.ts`;
  - frontend engineer: `EntriesProvider.tsx` (the seam renamed, locks unchanged), `EntriesList.tsx` (stream names), `TodayTotals.tsx` (comments).
  - Phone screenshot viewed by the lead: rows labelled Wholesale, Sales at events, Commissions, Expense, Subscription income and Vendor shelf rental.
- **Code review: ACCEPT, no blocking findings.** The reviewer cross-checked `addDays` against UTC arithmetic over 884,322 cases, with 0 mismatches.
  - Optional finding taken: two inaccurate comments in `dates.ts` corrected.
  - Logged for later:
    - pin `STREAMS_WITH_EVENTS` in a test, and consider an `IncomeStreamId` type when T1.12 uses it;
    - the e2e `IncomeSeed` could use `import type { IncomeInput }` (test engineer's call);
    - a cosmetic spacing nit in `entries.test.ts`;
    - the Reports page wording goes when T1.11 removes it.
- **Lead re-ran from a clean build:**
  - `npm run check` exit 0 (vitest 576/576, check-rules 0 errors, rules tests 61/61);
  - `CI=1 npx playwright test` gave **834 passed, 0 failed** (308 by-project skips);
  - the builder's Cloudflare build plus the grep found no `__bentoTest` in `.open-next`; CI repeats this on push.

### T1.10b — Event takings, stream tags on costs, event "Other costs"   Status: done
Owner agent: backend-engineer   Tests: test-engineer (Vitest)   Security review: no
Guide: §10 "Two styles, one table", §7; DECISIONS.md "Event takings", "Linking costs to events and streams", "Event 'Other costs'".
Outcome:
- One action adds an event day's takings as **two income rows**, cash and card. Both are always saved, even at $0. The stream is Sales at events, or the event's usual stream.
- Expenses get an optional **stream tag**, allowed only for event & venue and operating costs. Production costs never carry an event or a stream, including after an edit.
- Each event can have one "Other costs" figure (amount and short note), which can be set, changed or cleared.
Done when: the Vitest tests pass with hand-worked values; `npm run check` exits 0.
Lead decisions (2026-10-26), written into the `entries.test.ts` header as decisions 12–14:
- **Takings:** `add-event-takings` adds a cash row then a card row. The stream must be in `STREAMS_WITH_EVENTS` (the form pre-fills the event's usual stream). The event is optional (missing means not assigned yet). The ids are new and different from each other. Only the 6 fields are allowed. **All or nothing:** on any error, no row is added. Each row is afterwards an ordinary income entry, with no grouping id in Stage 1.
- **Stream tags:** checked after merging an edit, so moving a tagged cost to production needs `streamId: null` in the same edit.
- **Other costs:** a plain object keyed by event id. Setting it again replaces the whole figure (the note becomes "" if none is sent; the form always sends the current note). Clearing an event with no figure does nothing; an unknown event is refused.
- 11 T1.10 tests were reshaped only to add the new empty fields (`streamId: null`, `otherCosts: {}`). Their behaviour is unchanged; the lead accepted this.
Evidence:
- **Tests first** (test engineer), in `entries.test.ts` (decisions 12–14). Red run: 81 failures for the intended reasons. 18 deliberate bugs planted in a scratch implementation were all caught.
- **Built** (backend engineer): `src/lib/entries.ts`. Commit 04eb114.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 718/718, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **834 passed, 0 failed**.
- **Code review: ACCEPT, no blocking findings.** The reviewer fuzzed 6,000 random actions on frozen states: 0 production costs with a stream or event, 0 changed inputs, 0 duplicate ids, and every accepted takings action added exactly 2 rows. Four optional findings, all taken in T1.10c (tests first):
  1. pin `toBe(before)` when clearing an event with no figure;
  2. `toStrictEqual` for other costs kept across the other actions;
  3. rename the set action's `note` to `notes`, matching every other input;
  4. make the field whitelist refuse objects with an inherited prototype (inherited values were checked anyway, so this was harmless).

### T1.10c — Summaries: by event, by stream, by date range   Status: done
Owner agent: backend-engineer   Tests: test-engineer (Vitest)   Security review: no
Guide: §12 "By event or venue", "By income stream"; DECISIONS.md "Event 'Other costs'".
Outcome: pure selectors that do all the adding up:
- **Event:** takings per day (cash, card, total), event & venue costs, the result, the "Other costs" figure, and the result after it.
- **Stream:** income, the costs counted toward the stream (its tag, or else the linked event's usual stream; each cost counts toward one stream at most), and the result.
- **Date range:** income, expenses, net.

"Other costs" never enters stream or range totals.
Done when: the Vitest tests pass, including the owner's example: takings $1,000 + $2,000 + $1,500 = $4,500; event costs $500 + $299 + $200 = $999; result $3,501; with $600 other costs, $2,901. `npm run check` exits 0.
Evidence:
- **Tests first** (test engineer):
  - `src/lib/summaries.test.ts` (new; decisions A–H, with the owner's worked example checked to the cent);
  - `entries.test.ts` decisions 14–16, covering the four T1.10b review findings.
  - Red run: 29 failures in entries, plus summaries failing to load because the module didn't exist yet. 24 deliberate bugs planted in a scratch implementation were all caught.
- **Built** (backend engineer):
  - new `src/lib/summaries.ts`: `eventSummary`, `streamSummary`, `rangeTotals`;
  - `entries.ts`: the other-costs field renamed `notes` (its fields are checked), plain-object input only, and exact signed `addCents`/`subtractCents`.
- **Owner's example, as the tests prove it:**
  - convention takings $1,000 + $2,000 + $1,500 = $4,500;
  - event costs $500 + $299 + $200 = $999;
  - result $3,501;
  - with $600 other costs, $2,901;
  - the Sales at events stream shows the same $3,501;
  - June's total leaves the $600 out.
- **Code review: ACCEPT, no blocking findings.**
  - The reviewer fuzzed 3,000 random states (33,000 summary calls) against a BigInt reference: 0 mismatches.
  - `addCents`/`subtractCents` were checked against BigInt over 361,914 pairs: 0 mismatches.
  - **Optional, taken by the lead:**
    - the "ONLY place" comment corrected, since `totalsForDate` stays until T1.18;
    - the neutral error message "expected a plain object";
    - the summary lists typed `readonly`, so a screen can't change the store by accident.
  - **Optional, for the test engineer at the next test round (T1.15):**
    - pin that the summary lists hold the store's own objects (decision H);
    - direct tests for `addCents`/`subtractCents`, both signs and both edges.
- **Lead re-ran:** `npm run check` exit 0 (vitest 787/787, check-rules 0 errors, rules tests 61/61), before and after the small fixes. `CI=1 npx playwright test` gave **834 passed, 0 failed**.

### T1.11 — New bottom navigation: Home, Events, Expenses, Income, Settings   Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright; update the app-shell spec)   Security review: no
Guide: §17 Stage 1 step 2; DECISIONS.md "Navigation". Keeps T1.3/T1.3b's rules: 44px targets, pinned only when ≤25% of the screen height, works at 200% text, `aria-current` on the current tab.
Outcome:
- The bottom tabs are exactly **Home (/), Events (/events), Expenses (/expenses), Income (/income), Settings (/settings)**, in that order, each with an icon.
- `/expenses` and `/income` are new simple pages: one heading and a short "coming next" note. T1.16 and T1.17 fill them in.
- **`/reports` is removed** (a 404). Report figures move to Home and to the event and stream pages.
- Lead decision: **`/transactions` stays reachable, but leaves the tabs**, until T1.16 and T1.17 split its list into Income and Expenses. Then it's removed. This keeps each change small, and the entries-list tests keep working meanwhile.
Out of scope: the "+" button, forms and page content (later cards).
Done when: the updated Playwright tests pass at phone and desktop size; `npm run check` exits 0.
Evidence:
- **Tests first** (test engineer):
  - `e2e/app-shell.spec.ts`: the new tabs, titles, headings, `aria-current`, 5 distinct icons, every size and pinning rule re-run, and claims 16–18 (/reports is a 404 on both builds; no nav link to /transactions; /transactions temporarily answers 200).
  - `entries-list` and `expense-form` reach /transactions with a client-side move (`window.next.router.push`, test-only and temporary, with a check that the page didn't reload) instead of the removed tab.
  - Red run: 250 failures for the intended reasons. A scratch build gave 884 passed, and 4 planted bugs were all caught.
- **Built** (frontend engineer):
  - `BottomNav.tsx`: the tabs, plus Expenses (down arrow) and Income (up arrow) icons;
  - new `src/app/expenses/page.tsx` and `src/app/income/page.tsx`;
  - `src/app/reports/` deleted.
  - The lead viewed the phone screenshot: five tabs, distinct icons, Home current.
- **Code review: ACCEPT, no blocking findings.** The nav's measuring, pinning, 44px and focus code is unchanged byte for byte.
  - Optional, taken: the Income icon comment corrected.
  - Logged:
    - **for the owner's phone check (T1.9):** do the down and up arrows read as expenses and income? (They're also the usual download and upload icons.)
    - decide whether a parent tab is current on sub-pages such as /expenses/new (T1.13/T1.17);
    - the temporary /transactions block doesn't recheck its title or `<main>` (it goes away in T1.16/T1.17);
    - the Events note "Coming in Stage 4" changes in T1.15.
  - Done: T1.10's note that "the Reports page wording goes when T1.11 removes it".
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 787/787, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **884 passed, 0 failed** (308 by-project skips).

### T1.12 — Income form                                     Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no (client-only pretend data). The `back` address is checked as an internal path; see below.
Guide: §10 (streams, cash basis), §6 (native date picker, show the interpreted amount); DECISIONS.md "Event takings", "The '+' button".
Outcome: a new page `/income/new` ("Add income"), in the same style as the expense form: labels, 16px fields, 44px targets, errors only after Save, focus on the first bad field, and "Reads as $X" feedback.
- **Date** is the native picker, defaulting to today on the device.
- **Stream** is required and has no default: one of the 7 streams.
- **When the stream is Sales at events** (owner: always split cash and card):
  - Event (optional, "Not assigned yet");
  - **Cash** and **Card** amounts, both required, $0 allowed;
  - a live "Total $X".
  - Saving uses the takings action, so both rows are always saved.
- **Any other stream:** one Amount, plus a required **Payment method** (Cash, Card, Online, Bank transfer, Other; no default). For **Vendor shelf rental** only, an optional Event as well.
- **Notes** are optional.
- **Pre-fill from the page address** (T1.14 uses this):
  - `?stream=<id>` picks the stream;
  - `?event=<id>` picks the event and, when no stream is given, the event's usual stream.
  - An unknown id is ignored.
- **After Save**, go back to `?back=<path>` if it's a safe internal path: it starts with a single "/", has no "//", "\\" or scheme, and is made only of letters, digits, "-" and "/". Otherwise go back to Home. Use a replace, so Back doesn't reopen the form. A double tap saves once.
Out of scope: the "+" button (T1.14), event and stream pages (T1.15/T1.16), editing existing income.
Done when: the Playwright tests pass at phone and desktop size (valid saves for both shapes, rejected amounts with clear messages, pre-fill, the safe `back`, labels and keyboard, 320px at 200% text); `npm run check` exits 0.
Lead decisions (2026-10-26), from the test engineer's questions; the full spec is decisions I1–I12 in `e2e/income-form.spec.ts`:
- **Error wording accepted.** For example: "Choose an income stream.", "Enter the cash amount, or 0 if there was none.", "Choose a payment method." The owner may reword these.
- **Switching streams:** moving between Sales at events and Vendor shelf rental keeps the chosen event; switching to any other stream clears it. Typed amounts don't carry over when the form changes shape.
- **Cancel** goes to the same place as Save (the safe `back`, otherwise Home).
- The safe-`back` check is a small shared function in `src/lib`, so the expense form and the "+" button can reuse it.
Evidence:
- **Tests first** (test engineer): new `e2e/income-form.spec.ts` (I1–I12, 380 tests). Red run: 365 failures, all because the page didn't exist yet. A scratch form passed the full suite (1249), and 9 planted bugs were all caught.
- **Built** (frontend engineer):
  - new `src/components/IncomeForm.tsx`;
  - `src/app/income/new/page.tsx` (form inside Suspense, static route);
  - `src/lib/navigation.ts` (`safeBackPath`).
  - Lead viewed the phone screenshot: Sales at events pre-filled with the market, "Reads as" on Cash and Card, "Total $3,000.50".
- **Code review: ACCEPT.** Money, dates, store use, the double-tap guard and pre-fill all checked.
- **Security review: SECURE.** Over 70 bypass attempts on `safeBackPath` all failed: protocol-relative and backslash paths, control characters, Unicode lookalike slashes, single and double percent-encoding, dot segments, schemes, and non-strings. Stream and event values are only ever looked up in the known lists.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 787/787, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **1249 passed, 0 failed** (323 by-project skips).
- **Taken into T1.12b** (a small follow-up, tests first):
  - errors don't show on fields that appear when the form changes shape;
  - the form resets when `back` points at the form itself;
  - the payment error is also linked from each radio;
  - the comment wording;
  - a length cap of 200 on `back`;
  - unit tests for `safeBackPath` with the security reviewer's attack list;
  - tests for keeping the event between the two event streams, and for amounts not carrying over.
- **Logged:**
  - **for T1.13:** shared form parts (class strings, `Field`, error texts, payment labels) and one decision for both forms on which "Reads as" lines are live regions (check with a screen reader at T1.9);
  - notes on saved rows get tested when a list shows notes (T1.16);
  - **before the first route handler (Stage 2):** turn `back` into a route-pattern allow-list, or refuse `/api` and `/auth` (DECISIONS follow-ups).

### T1.12b — Income form: review follow-ups                 Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Vitest + Playwright)   Security review: no (the T1.12 security review proposed these items)
Guide: as T1.12. Source: the T1.12 code and security reviews' optional findings that the lead took.
Outcome:
1. Switching the stream so the form changes shape doesn't show errors on the new fields until Save is pressed again.
2. The form resets after Save even when `back` points at the form's own address.
3. The payment-method error is also linked from each radio (`aria-describedby`).
4. `safeBackPath` returns "/" for anything longer than 200 characters.
5. New `src/lib/navigation.test.ts` with the security reviewer's attack list, so the rule can't be loosened by accident.
6. Tests for two lead decisions: switching between Sales at events and Vendor shelf rental keeps the event; typed amounts don't carry over when the shape changes.
7. A comment says "mostly the same as the expense form".
Done when: the new tests pass (red first); the full Playwright suite and `npm run check` are green.
Evidence:
- **Lead decisions (2026-10-26):**
  - A shape change hides all messages until the next Save.
  - After saving back to the form itself, the next save goes Home (no `back` is left in the address).
  - The round trip (typed amounts coming back after switching away and back) is undecided and untested.
  - Idea for the owner: a "Save and add another" button for entering several days in a row.
- **Tests first** (test engineer):
  - new `src/lib/navigation.test.ts`: 76 tests, the security reviewer's attack list plus the 200-character cap;
  - `e2e/income-form.spec.ts` I13–I17.
  - Red run: 3 Vitest and 28 Playwright failures, all for the intended reasons.
- **Built** (frontend engineer):
  - `IncomeForm.tsx`: a shape change resets the errors-shown state; the key is the whole search string; the payment error is linked from each radio; the header comment.
  - `navigation.ts`: the length cap.
- **Code review: ACCEPT.**
  - Optional, taken: two comments corrected by the lead.
  - Logged:
    - for the T1.13 test round: one test that a move between one-amount streams keeps the errors showing;
    - for T1.9: a screen reader may read the payment error twice (it's linked from the group and from each radio).
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 863/863, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **1295 passed, 0 failed**.

### T1.13a — Shared form parts                              Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright; small additions)   Security review: no
Guide: §6 (show the interpreted amount). Source: the T1.12 code review (finding 5) and the T1.7/T1.12 live-region findings.
Outcome:
- **One shared module** (e.g. `src/components/form-parts.tsx`) holding what the expense and income forms both use:
  - the field, label and error class strings;
  - `Field`;
  - the `describe` helper;
  - the amount error texts;
  - the Save and Cancel styles;
  - the loading message;
  - the payment-method labels, also used by the entries list.
- Both forms use the shared module. Their look and behaviour don't change.
- **Lead decision (live regions):**
  - **"Reads as $X" lines stop being live regions** in both forms. Each stays linked from its field (`aria-describedby`), so a screen reader reads it when the field is focused. This ends the keystroke-by-keystroke chatter and the stale reading when an amount turns invalid (T1.7 and T1.12 reviews).
  - The income form's **"Total $X" stays a polite live region**.
- **Test added from the T1.12b review:** switching between two one-amount streams keeps errors showing.
Out of scope: new fields or behaviour (T1.13).
Done when: all existing tests still pass, plus the new ones; `npm run check` exits 0.
Evidence:
- **Tests first** (test engineer):
  - the expense-form F4 note, plus 3 tests: no live region, and "Reads as" is in the field's description;
  - the income-form I18 (live regions: only "Total" is live), I19 (a one-amount stream switch keeps the errors) and I20 (both forms match at 390×844).
  - Red run: 16 live-region failures, as intended. Proof: 1322 passed with the change.
- **Built** (frontend engineer):
  - new `src/components/form-parts.tsx` (class strings, `Field`, `describe`, error texts, `readsAsText`, `PAYMENT_LABELS`, `LoadingMessage`);
  - ExpenseForm, IncomeForm, EntriesList and the income page use it, and both forms got shorter;
  - "Reads as" lines are no longer live regions; "Total" stays polite.
- **Code review: ACCEPT.** The class strings, ids, error texts and focus order are byte for byte the same as before.
  - Optional, taken by the lead: one shared `LOADING_FORM` text.
  - Logged:
    - `PAYMENT_LABELS` could move to `src/lib` later;
    - if a later card adds a status line to the expense form, update the "no live region" test rather than avoid the feature.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 863/863, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **1322 passed, 0 failed**. After the `LOADING_FORM` tidy-up, which leaves the text on screen unchanged, `npm run check` exited 0 again.

### T1.13 — Expense form: stream tag, pre-fill and safe back   Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright; extend the expense-form spec)   Security review: no (reuses `safeBackPath`, already reviewed)
Guide: §7; DECISIONS.md "Linking costs to events and streams", "The '+' button".
Outcome:
- **An optional "Income stream" field** ("No stream" plus the 7 streams). It shows for event & venue and operating categories only.
- **For production categories**, the Event and Income stream fields are hidden and a one-line note says: "Production costs aren't linked to an event or stream."
- **Pre-fill from the page address:**
  - `?event=<id>` picks that event (used when the category is event & venue) and makes the stream default to the event's usual stream;
  - `?stream=<id>` picks the stream;
  - unknown ids are ignored.
- **Lead decision:** hidden fields keep their value while hidden and come back when shown again, so a pre-filled event isn't lost while the artist browses categories. Only fields allowed for the chosen category are saved. This changes the T1.7 rule "leaving event & venue resets the Event choice".
- **After Save or Cancel**, go to the safe `?back=` (`safeBackPath`), otherwise Home, using a replace.
Out of scope: the "+" button (T1.14); editing existing expenses.
Done when: the Playwright tests pass at phone and desktop size; `npm run check` exits 0.
Evidence:
- **Lead decisions (2026-10-26):**
  - The production note reads "Production costs aren't linked to an event or stream." (the owner may reword it).
  - Pre-fill never chooses a category.
  - An unknown `?stream=` counts as not given.
  - Picking an event by hand doesn't change the stream.
  - A focused field must be fully on screen (F8 kept strict), so Notes scrolls into view on focus.
  - **Cancel** is a link to the same place as Save. Unlike Save, it adds a history step, which matches the income form and is intended.
- **Tests first** (test engineer): `e2e/expense-form.spec.ts` F2/F6/F7 changed; F11–F16 added (about 80 tests per project).
  - Red run: 126 failures for the intended reasons.
  - Proof: 1509 passed with a scratch build. 3 planted bugs were caught: the old event reset, a stream sent on production, Cancel always going to "/".
  - The usage limit interrupted the proof. The lead confirmed the feature files were restored before building.
- **Built** (frontend engineer):
  - `ExpenseForm.tsx`: the Income stream select, the production note linked from Category, pre-fill, the key on the full address, `safeBackPath`, Notes scrolling into view on focus;
  - `src/app/expenses/new/page.tsx`: Suspense.
  - The lead viewed the phone screenshot: Stall or table fees with the convention and Sales at events pre-filled.
- **Code review: ACCEPT.** No hidden value can reach a save; the reviewer traced four routes, and the store refuses a leak anyway.
  - Optional, taken by the lead: a simpler category `onChange`, and the header now says "(T1.7, T1.13)".
  - Logged:
    - **for the T1.14 test round:** a test that picking an event by hand leaves the stream alone;
    - one shared pre-fill helper for both forms (later);
    - scroll Notes only on keyboard focus, to avoid a small double scroll on tap (check at T1.9);
    - **for T1.9 with a screen reader:** fields vanish without an announcement when switching to a production category.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 863/863, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **1509 passed, 0 failed**. After the two tidy-ups, `npm run check` exited 0 again.

### T1.14 — The "+" button: Income or Expense                Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no (it builds addresses for forms that already check `back` with `safeBackPath`)
Guide: DECISIONS.md "The '+' button".
Outcome:
- **One shared component, `AddButton`.**
  - A big, full-width **"+ Add"** button near the top of the page, under the heading. It's a disclosure: a button with `aria-expanded` that controls a group holding two big links.
  - **"Add income"** goes to `/income/new`; **"Add expense"** goes to `/expenses/new`.
  - **Lead design choice (the owner may change it):** a page-top button rather than a floating one, so it never overlaps the bottom tabs or large text.
- **Links:** each carries the page's pre-fill (`event`, `stream`, from props) and `back` = the current page's path, so Save returns there.
- **Behaviour:**
  - Escape closes the group and returns focus to "+ Add";
  - tapping outside closes it;
  - 44px targets; works at 320px with 200% text.
- **Where it goes now:**
  - **Home** (no pre-fill; it replaces "+ Expense");
  - **Events** (`/events`), **Expenses** (`/expenses`) and **Income** (`/income`), each with no pre-fill.
  - The event and stream pages (T1.15/T1.16) add it with their pre-fill.
- **Test carried over from the T1.13 review:** picking an event by hand in the expense form leaves the stream alone.
Out of scope: event and stream pages; editing entries.
Done when: the Playwright tests pass at phone and desktop size; `npm run check` exits 0.
Evidence:
- **Lead decisions (2026-10-26):** "+ Add" goes directly under each page's heading. Pages other than the four summary pages (the forms, Transactions) aren't checked. Leaving a page resets the button.
- **Tests first** (test engineer): new `e2e/add-button.spec.ts` (B1–B8, 218 tests).
  - Changed: app-shell claim 8 and removed-quick-sale R2 (CHANGED (T1.14), approved at T1.8). The expense-form helpers now open "+ Add". New hand-pick stream tests (from the T1.13 review).
  - Red run: 225 failures, all from the missing "+ Add" or the leftover "+ Expense". Proof: 1717 passed with a scratch build. Planted bugs were caught: `back` not encoded, no focus return, no outside close, links hidden with opacity instead of `hidden`.
- **Built** (frontend engineer):
  - new `src/components/AddButton.tsx`: a disclosure button whose links carry the event, the stream and a `back` path checked by `safeBackPath`;
  - placed on Home (replacing "+ Expense"), Events (through a new `action` slot in `ComingLater`), Expenses and Income.
  - The lead viewed the phone screenshot: "+ Add" open, showing "Add income" and "Add expense".
- **Code review: ACCEPT.**
  - Logged for the T1.15 test round: Escape should also close the group when focus isn't inside it (Safari doesn't focus a button clicked with the mouse), using a document keydown listener while open. Also refresh the stale claim-8 wording in app-shell.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 863/863, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **1717 passed, 0 failed**. Two leftover dev servers from earlier tasks were stopped.

### T1.15 — Events tab and event page                      Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no (client-only pretend data; the event id from the address is only looked up in a fixed list)
Guide: §12 "By event or venue" (with its note that production costs aren't included), §7, §6; DECISIONS.md "Event takings", "Event 'Other costs'", "The '+' button".
Outcome:
- **`/events`** replaces its "coming later" note with the list of pretend events:
  - each shows its name, its dates (a shelf rental shows "from <date>, ongoing") and its **Result** (from `eventSummary`);
  - each links to its page;
  - "+ Add" stays at the top.
- **`/events/<id>`** for each pretend event. An unknown id is a 404. The page has:
  - **heading and "+ Add":** the event name as the h1, its dates, and "+ Add" pre-filled with this event (Save comes back here);
  - **takings by day:** each day shows its date, Cash, Card and Total (Other only when there is some), then a **Takings** total;
  - **event & venue costs:** each cost with its date, category and supplier, then an **Event costs** total;
  - **Result** (takings − event costs);
  - **Other costs** (owner): an optional amount and note, with Add, Change and Clear. When set, the page shows **Result after other costs**. The page explains in one line that this is an estimate, such as stock (COGS), and isn't added to any other totals;
  - **a note:** "Production costs aren't included here." (§12);
  - **empty states** for no takings and no costs.
- **All money comes from `eventSummary`.** The screen adds nothing up itself.
- **Carried over from the T1.14 review:** Escape closes "+ Add" even when focus isn't inside it.
Out of scope: creating, editing or deleting events (Stage 4); editing entries.
Done when: the Playwright tests pass, including the owner's worked example on the convention's page:
- takings $1,000 + $2,000 + $1,500 = **$4,500**;
- costs $500 + $299 + $200 = **$999**;
- Result **$3,501**;
- with $600 other costs, **$2,901**.

`npm run check` exits 0.
Lead decisions (2026-10-26); the full spec is E1–E11 in `e2e/events.spec.ts`:
- **Wording** (the owner may reword any of it):
  - a loss shows as "-$50.00" (an ordinary hyphen, which is what `formatCents` prints);
  - dates read "22/06/2026 to 24/06/2026" and "From 02/05/2026, ongoing";
  - "No takings yet.", "No event & venue costs yet.", "Production costs aren't included here.", "Add other costs", "Change", "Clear".
- **The events list** shows the plain Result. "Other costs" appear only on the event's own page.
- **Clear** removes "Other costs" straight away, with no confirmation.
- **Not decided yet:** whether the Events tab shows as current on an event's page.
Evidence:
- **Tests first** (test engineer):
  - new `e2e/events.spec.ts` (E1–E11, 224 tests): exact dates in Sydney and Perth, money worked by hand, the owner's example entered through the real forms;
  - `add-button` B1/B3 additions (Escape with focus on `<body>`, reset on leaving a page);
  - app-shell claim 7 CHANGED.
  - Red run: 200 failures for the intended reasons. Proof: 1949 passed with a scratch build. 5 planted bugs were all caught.
- **Built** (frontend engineer):
  - `/events` list (`EventsList`);
  - `/events/[id]` (static for the three ids; any other id is a 404) with `EventDetail` and `OtherCostsEditor`;
  - `event-dates.ts`;
  - `AddButton`: a document Escape listener, and a reset when the page changes.
- **The owner's example, as shown on the convention's page** (lead viewed the phone screenshot):
  - takings $1,000 + $2,000 + $1,500 = **$4,500.00**;
  - event costs $500 + $200 + $299 = **$999.00**;
  - **Result $3,501.00**;
  - Other costs $600 ("Stock sold, at cost") gives **Result after other costs $2,901.00**;
  - the note "Production costs aren't included here." shows.
- **Code review: ACCEPT.** The reviewer grepped the components for money maths and found none; every figure comes from `eventSummary`.
  - Taken by the lead:
    - the event ids are listed once (from `pretendEvents`), not in a second constant;
    - the unused `ComingLater` action slot is removed;
    - AddButton ignores an Escape something else already handled.
  - Logged:
    - for the next test round: focus after Cancel, Save and Clear in Other costs; a unit test for `event-dates` (or move it to `src/lib`);
    - **before real data:** an extreme amount near the safe-number limit can make a summary throw and crash the page. This needs a business maximum for amounts (an owner decision, already open since T1.4) or a friendly error state.
  - No separate security review was run; the card says why. The event id from the address is only matched against three fixed ids; any other is a real 404.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 863/863, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **1949 passed, 0 failed**. After the three small fixes: `npm run check` exit 0, and the events, add-button and app-shell specs gave **923 passed, 0 failed**.

### T1.16 — Income tab and stream pages                     Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright + small Vitest additions)   Security review: no (the stream id from the address is only matched against a fixed list)
Guide: §10 (seven default streams), §12 "By income stream"; DECISIONS.md "Linking costs to events and streams", "The '+' button".
Outcome:
- **`/income`** replaces its "coming next" note with the 7 streams, in order. Each stream is a link showing its **Income** and **Result** (from `streamSummary`). "+ Add" stays at the top.
- **`/income/<stream-id>`** for each stream. An unknown id is a 404. The page has:
  - **heading and "+ Add":** the stream name as the h1, and "+ Add" pre-filled with this stream (Save comes back here);
  - **Income:** each row with its date, its event (or payment method), its notes when set, and its amount, newest first, then an **Income** total;
  - **Costs:** costs counted toward this stream, with their date, category, supplier and amount, then a **Costs** total. One line explains which costs count: tagged with this stream, or linked to an event whose usual stream this is. Production costs never count;
  - **Result**;
  - **Events:** for streams that have events (Sales at events, Vendor shelf rental), a list of the events whose usual stream this is, linking to their pages;
  - **empty states.**
- **All money comes from `streamSummary`.**
- **Test items carried over:**
  - the summary lists hold the store's own entries (T1.10c decision H);
  - direct unit tests for `addCents`/`subtractCents`;
  - focus after Cancel, Save and Clear in Other costs (T1.15);
  - `event-dates` moves to `src/lib` with a unit test (T1.15);
  - income notes are stored and shown (T1.12).
Out of scope: removing `/transactions` and the Expenses tab (T1.17); renaming or archiving streams (later stage).
Done when: the Playwright and Vitest tests pass, including the owner's example on Sales at events (income $4,500.00; costs $999.00 through the convention's usual stream; Result $3,501.00). `npm run check` exits 0.
Lead decisions (2026-10-29); the full spec is S1–S11 in `e2e/income-streams.spec.ts`:
- **Linked income rows** show the event AND the payment method, e.g. "Pretend comic convention · Cash", so a day's cash and card rows can be told apart. Unlinked rows show the payment method only.
- **Wording** (the owner may reword it): "No income yet.", "No costs yet.", "Costs count here when they're tagged with this stream, or linked to an event that usually earns from it."
- **`event-dates`** moves to `src/lib` as `formatEventDates`, with unit tests. The build fails until the move, on purpose.
- **Still to decide at the stage gate:** whether the Events and Income tabs show as current on their sub-pages.
- **The usage limit** interrupted the test engineer's proof. The lead confirmed the feature files were restored before the build.
Evidence:
- **Tests first** (test engineer):
  - new `e2e/income-streams.spec.ts` (S1–S11, 276 tests), with two datasets worked out by hand;
  - `events.spec` E8 focus tests and app-shell claim 7 CHANGED;
  - new `src/lib/event-dates.test.ts`; direct `addCents`/`subtractCents` tests; decision-H identity tests.
  - Red run: 246 failures for the intended reasons. Proof: 2233 passed with a scratch build. 6 planted bugs were caught.
- **Built** (frontend engineer):
  - `event-dates` moved to `src/lib` (`formatEventDates`);
  - `/income` list (`StreamsList`);
  - `/income/[id]` (static for the 7 streams; any other id is a 404) with `StreamDetail`.
  - **Lead viewed the phone screenshot of Sales at events:**
    - six income rows like "Pretend comic convention · Card";
    - **Income $4,500.00**;
    - three costs counted through the convention's usual stream, **Costs $999.00**;
    - **Result $3,501.00**;
    - Events links to the convention and the market.
- **Code review: ACCEPT.** There's no money maths in the components; the attribution matches `streamOfCost`; `/income/new` isn't shadowed.
  - **Taken into T1.17:**
    - one shared cost-row component for the event, stream and expenses pages;
    - clearer wording for the costs line: "…or, with no stream tag, linked to an event that usually earns from it." (a lead decision; the spec changes then).
  - **Logged:**
    - the unreachable empty state in `StreamsList`;
    - the summary error state before real data. The T1.16b cap makes overflow practically impossible.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 927/927, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **2233 passed, 0 failed** (18.8 minutes; the first attempt hit the lead's own 10-minute command limit, not a test failure).

### T1.16b — Amount cap: $9,999,999.99 per entry              Status: done
Owner agent: backend-engineer (`src/lib`), then frontend-engineer (form messages)   Tests: test-engineer (Vitest + Playwright)   Security review: no
Guide: §7; DECISIONS.md "Typed amounts: detailed rules" (owner, 2026-10-26: business maximum $9,999,999.99).
Outcome:
- `parseAmountToCents` accepts at most 999,999,999 cents, and the store refuses larger amounts too.
- Every amount field (expense, income cash, card and amount, and Other costs) shows its own message for a too-large amount: "Enter an amount up to $9,999,999.99." (the lead's wording; the owner may reword it). The format message is used only for format mistakes.
- Totals stay far from the exact-number limit, so a page can't crash on an extreme amount (T1.15 review).
Done when: the unit and browser tests pass, including $9,999,999.99 (accepted) and $10,000,000.00 (rejected with the new message) in every amount field; `npm run check` exits 0.
Evidence:
- **Lead decisions (2026-10-29):**
  - a format mistake beats size;
  - edits are capped too;
  - `totalsForDate`, the summaries and `addCents`/`subtractCents` aren't capped (totals must always show what was saved).
- **Tests first** (test engineer):
  - money.test (a 35-row table run through `parseAmountToCents` and the new `amountProblem`), entries.test (every action at 999,999,999 and at 1,000,000,000) and summaries.test (huge-value tests built directly; the same claims);
  - e2e expense-form F17, income-form I21, events E8.
  - Red run: 111 unit and 82 e2e failures for the intended reasons. Proof: 2367 passed. Planted bugs were caught, among them `>=` vs `>`, one cent over, size checked before format, no store cap, and totals inheriting the cap.
- **Built:**
  - backend engineer: `MAX_AMOUNT_CENTS`, `amountProblem`, and a capped `checkAmountCents` (`totalsForDate` keeps its own uncapped check);
  - frontend engineer: a shared `ERROR_AMOUNT_TOO_LARGE` and `amountError`, used by the expense form, the income form (cash, card, amount) and Other costs.
- **Code review: ACCEPT.** The reviewer probed 17 extra inputs (odd spaces, 22 leading zeros, 25-digit amounts): 0 disagreements between parse and message.
  - Taken by the lead: the import order, and a comment tying the message to `MAX_AMOUNT_CENTS`.
  - Logged (DECISIONS follow-ups): a matching database CHECK in Stage 2.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 1066/1066, check-rules 0 errors, rules tests 61/61). `CI=1 npx playwright test` gave **2367 passed, 0 failed** (20.2 minutes). The tidy-ups are an import order and a comment; lint was re-run after them.

### T1.17 — Expenses tab                                    Status: done
Owner agent: backend-engineer (one small summary function), then frontend-engineer (the screen)   Tests: test-engineer (Vitest + Playwright)   Security review: no
Guide: §7 (three groups), §12; DECISIONS.md "Linking costs to events and streams".
Outcome:
- **`/expenses`** replaces its "coming next" note with:
  - **totals per group:** Production, Event & venue, Operating, and **Total expenses**, from a new pure `expensesSummary(state)` in `src/lib/summaries.ts`;
  - **the expense list**, newest first. Each row shows the date, category, supplier (when set), the event (when linked), the stream (when tagged), the notes (when set) and the amount;
  - an empty state;
  - "+ Add" stays at the top.
- **One shared cost-row component**, used by the event page, the stream page and this list (T1.16 review). The rows look the same everywhere.
- **The stream page's costs line** becomes: "Costs count here when they're tagged with this stream, or, with no stream tag, linked to an event that usually earns from it." (lead wording, more exact; T1.16 review).
Out of scope: removing `/transactions` (T1.17b); editing and deleting entries.
Done when: the tests pass; `npm run check` exits 0.
Evidence:
- **Lead decisions (2026-10-29):**
  - Event-page cost rows repeat the event's name, so a cost reads the same on all three pages (the owner may prefer otherwise).
  - The markup of the totals is free; only the lines, their order and the amounts are pinned.
  - The usage limit interrupted the test engineer's planted-bug run. The lead confirmed the feature files were restored before building.
- **Tests first** (test engineer):
  - `summaries.test.ts` decision I (24 tests for `expensesSummary`);
  - new `e2e/expenses.spec.ts` (X1–X9);
  - events E6, income-streams S6/S3 and app-shell claim 7, all CHANGED (T1.17).
  - Red run: 24 unit and 104 e2e failures for the intended reasons. Planted bugs were caught: wrong order, copies instead of the store's objects, a wrong group, the row joined with " - ", the event name hidden on the event page.
- **Built:**
  - backend engineer: `expensesSummary`;
  - frontend engineer: a shared `CostRow` (used by the event, stream and expenses pages), `ExpensesOverview`, and the new stream-page explanation wording.
  - **Lead viewed the phone screenshot:**
    - Totals: Production $120.00, Event & venue $999.00, Operating $15.00, **Total expenses $1,134.00**;
    - the rows are newest first.
- **Code review: ACCEPT.** Taken by the lead:
  - an exhaustive `switch` on the group, so a fourth group would stop the build instead of being counted as operating;
  - a comment updated.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 1090/1090). `CI=1 npx playwright test` gave **2451 passed, 0 failed** (21.9 minutes). After the two tidy-ups, which don't change behaviour: `npm run check` exit 0, with 1090 unit tests.

### T1.17b — Retire the old Transactions page                 Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: yes, light (the test seam's safety tests move to a new file and must stay just as strong)
Outcome:
- `/transactions` and `EntriesList` are removed; `/transactions` is a real 404.
- The seam-lock tests (S0–S6) move to their own spec, unchanged in strength.
- Tests that checked saves on the Transactions list now check the Expenses tab and the stream pages.
Done when: the full suite passes; CI's seam grep still passes; `npm run check` exits 0.
Evidence:
- **Tests first** (test engineer):
  - the seam-lock tests S0–S6 move to the new `e2e/test-seam.spec.ts`, with S4b added (a 127.0.0.1 control);
  - Home's "today" lines, the live region and persistence move to the new `e2e/home.spec.ts`;
  - `e2e/entries-list.spec.ts` is deleted, after a claim-by-claim mapping in the test engineer's report;
  - expense-form and income-form now check saves on the Expenses tab and the stream pages;
  - app-shell claim 18: /transactions is a 404 on both servers, and nothing links to it.
  - Red run: only the 3 new 404 claims failed (×2 projects). Proof with a scratch removal: 2452 passed.
- **Built** (the lead): `src/app/transactions/` and `src/components/EntriesList.tsx` deleted; two stale comments updated.
- **Security review: SECURE.** The seam tests are at least as strong as before (S4b makes them slightly stronger). EntriesProvider, next.config and the CI grep are untouched.
- **Code review: ACCEPT.** The ports keep their intent, and most are stronger.
- **Logged for T1.17c:**
  - `role="list"` on the new lists and `<time datetime>` on rows (both dropped with the old list);
  - a test that an entry added while a list is open appears at once in its place (not ported).
- **Note:** after deleting a route, a local build can fail on stale `.next` types. Clearing `.next` and `.next-e2e` fixes it; CI's fresh checkout is unaffected.
- **Lead re-ran from a clean build:**
  - `npm run check` exit 0 (vitest 1090/1090, check-rules 0 errors);
  - `CI=1 npx playwright test` gave **2452 passed, 0 failed** (21.8 minutes);
  - the Cloudflare build gave no `__bentoTest` in `.open-next`.

  The two comment fixes came after the run and don't change behaviour; lint was re-run.

### T1.17c — List accessibility and live updates           Status: done
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no
Source: the T1.17b test engineer's and code reviewer's findings.
Outcome:
- **Lists keep their list meaning:** every list of rows (expenses, a stream's income and costs, an event's takings and costs, the events and streams lists) has `role="list"`, because Safari and VoiceOver drop list meaning when the bullets are hidden.
- **Machine-readable dates:** each row's date is a `<time datetime="YYYY-MM-DD">`.
- **Live updates:** an entry added while a list is on screen appears at once, in its newest-first place.
Done when: the new tests pass; the full suite and `npm run check` are green.
Evidence:
- **Lead decisions (2026-10-29):**
  - a one-day event has exactly one `<time>`;
  - an ongoing shelf has a `<time>` only for "From";
  - live entries appear in each list's own order (newest first on Expenses and stream pages, date order on an event page).
- **Tests first** (test engineer): expenses X10–X12, income-streams S12–S14 and events E12–E14.
  - Red run: 70 failures for the intended reasons. The live-update guards already passed.
  - Proof: 2538 passed with a scratch change.
- **Built** (frontend engineer):
  - `role="list"` on all 8 row lists;
  - `<time dateTime>` in CostRow, the stream income rows and the takings rows;
  - a new `EventDates` component for event date ranges.
  - The usage limit cut the engineer off before its final full run; the lead ran it.
- **Code review: ACCEPT.**
  - Taken: the stale header comment in `src/lib/event-dates.ts` updated.
  - **Logged for the next test round:** event-date wording now lives in two places (`formatEventDates`, unit-tested, and the `EventDates` component). The e2e exact-text tests catch any drift today. A shared pure "date parts" helper would make it one source.
- **Lead re-ran from a clean build:** `npm run check` exit 0 (vitest 1090/1090). `CI=1 npx playwright test` gave **2538 passed, 0 failed** (19.8 minutes). The comment fix came after the run; lint was re-run.

### T1.18 — Home summary: this month                         Status: done
Owner agent: backend-engineer (one small date helper), then frontend-engineer (Home)   Tests: test-engineer (Vitest + Playwright)   Security review: no
Guide: §12 (main profit view, simplified for pretend data); DECISIONS.md "Navigation" (report figures live on Home and the event and stream pages).
Outcome:
- **Layout:** Home shows its heading and "+ Add" (as now), then a **"This month"** section headed with the month's name (e.g. "October 2026" in the device's language). It has three lines:
  - **Income $X**;
  - **Expenses $X**;
  - **Net $X** (negative when costs are higher).

  All three come from `rangeTotals` over the device's current calendar month, first to last day.
- **Live region:** the summary is a polite live region, re-targeting the old "today" live-region test (D10), as promised at T1.8.
- **What goes:** the old "Today: … from N sales" and "Today's expenses" lines are removed. `totalsForDate` becomes unused and is removed with its tests (`rangeTotals` covers it).
- **Stays:** the practice-mode note.
- **New helper:** a small pure `monthRange(today)` in `src/lib/dates.ts` gives the first and last day of the month as YYYY-MM-DD, including February in leap years. It does no time-zone maths and never uses `new Date("YYYY-MM-DD")`.
- **"Other costs"** never count (`rangeTotals` already ensures this).
Out of scope: a full reports screen (Stage 6); choosing other periods.
Done when: the tests pass, including the owner's example dated this month (Income $4,500.00, Expenses $999.00, Net $3,501.00); `npm run check` exits 0.
Evidence:
- **Tests first (test-engineer):**
  - `monthRange` (53 unit tests: every month, leap and non-leap Februaries, century years, bad input);
  - `formatMonthForDisplay` (34 unit tests);
  - the `totalsForDate` tests removed with the function;
  - `e2e/home.spec.ts` H1–H11, including the owner's example and the re-targeted live-region test (D10);
  - add-button, income-form, expense-form and events specs updated where they read Home's old "Today" lines.
  - Red run: 54 unit and 307 browser tests failed for the intended reason (no helper, no summary). Proof run: 2600 passed against a scratch build, then restored with `sha256sum -c`.
- **Build:**
  - backend-engineer added `monthRange` and removed `totalsForDate`;
  - frontend-engineer added `src/components/MonthSummary.tsx` and `formatMonthForDisplay`, wired it into Home, and deleted `TodayTotals.tsx`.
  - Builder's run: 2600 passed.
- **Code review:** ACCEPT, no blocking findings. Lead tidy-up: the `strong` flag renamed to `isNet`. Follow-up logged in DECISIONS.md: Stage 4 refunds will reduce Home's Net.
- **Lead's own run (after the tidy-up, clean `.next`):** `npm run check` exit 0 (1163 unit tests passed, check-rules 0 errors, 0 warnings); `CI=1 npx playwright test`: 2600 passed, 368 skipped (phone-only or desktop-only), 0 failed (19.8m).
- **Screenshot (phone, pretend data):** "This month / October 2026 / Income $4,500.00 / Expenses $999.00 / Net $3,501.00".

### T1.19 — The "+" button becomes a small round button, bottom right   Status: building
Owner agent: frontend-engineer   Tests: test-engineer (Playwright)   Security review: no (same links and `back` handling as T1.14; only the look and position change)
Guide: §10 (mobile-first, one-handed use), §15 (accessibility); DECISIONS.md "The '+' button" (owner change, 2026-10-30).
Outcome: `AddButton` stops being a big full-width "+ Add" under the heading and becomes a **small round floating button with "+" in the middle, in the bottom-right corner** (owner's request). Everything else T1.14 built stays.
- **Look:**
  - a circle at least 56px across (never under 48px), filled indigo, with a white "+" drawn as an `aria-hidden` icon or character and a soft shadow;
  - its accessible name is **"Add"** (`aria-label`); `aria-expanded` and `aria-controls` stay.
- **Position:** `position: fixed` in the bottom-right of the window.
  - **Right edge:** `max(1rem, env(safe-area-inset-right))`.
  - **While the bottom tabs are pinned:** it sits 1rem **above** them (using `--nav-h`, which BottomNav already writes), so it never covers a tab.
  - **When the tabs are un-pinned** (`data-nav-pinned="false"`, very large text): it sits `max(1rem, env(safe-area-inset-bottom))` from the bottom of the window while the tabs are off screen. When the tabs scroll into view (they're in the page flow then), it lifts so it never covers them. **Lead ruling (test-engineer question 1):** the card's first wording contradicted "never covering a tab"; measuring how much of the nav is on screen (in JS) is allowed.
- **Opening:** tapping it shows the two links ("Add income", "Add expense") as a compact stack **just above the circle, right-aligned**, inside the window at 320px wide and with 200% text. Each link is at least 44px tall. When open, the "+" may turn into "×"; the accessible name stays "Add".
- **Placement in each page:** `<AddButton …/>` moves to the **end** of each page's content, so its reading and Tab order match where it appears (bottom). Pages: Home, Events, Expenses, Income, an event page (`event` pre-fill), an income stream page (`stream` pre-fill).
- **Never hides content:** `<main>` gets enough bottom padding (button height + its gap) that, scrolled to the end, the last line of every page is fully visible and not under the button.
- **Unchanged from T1.14:** the links and their `event`, `stream` and `back` values; closing on Escape (focus back to the button), a tap outside, or pressing the button again; the group stays `hidden` while closed; it starts closed on each new page.
Context: `src/components/AddButton.tsx` (T1.14), `src/components/BottomNav.tsx` (`--nav-h`, `data-nav-pinned`), `src/app/globals.css`, `src/app/layout.tsx`, `e2e/add-button.spec.ts`, plus specs that find the button by the name "+ Add".
Rules that apply: 44px targets; works at 320px and 200% text; no new library; dark mode readable.
Lead rulings on the tests (accepted as written):
- Tab never leaves a focused element under the button (WCAG 2.4.11), so scroll padding must cover it.
- "Right-aligned" means each link's right edge matches the button's (±1px).
- At least 56px at normal text size, at least 48px at 320px with 200% text.
- "Indigo" means an HSL hue of 230–260.
Out of scope: changing which pages show the button, the forms, or the nav.
Done when:
- the tests find the button by role `button` and name "Add", and check it's a circle at least 48px across, in the bottom-right corner, and fully above the pinned tabs on a phone (390×844) and on desktop;
- with the tabs un-pinned (large text) it doesn't overlap the tabs either;
- the open links sit inside the window, above the button, at 320px with 200% text;
- on each page, scrolled to the bottom, the last content element doesn't intersect the button;
- every T1.14 behaviour test still passes (links, pre-fill, `back`, Escape, outside tap, starts closed);
- `npm run check` exits 0 and the full Playwright run passes.
Evidence:

### T1.9 — Owner tries it on a real phone                   Status: todo
Owner agent: **owner**
Steps:
1. **Open it.** Open the preview link Cloudflare posts on the Stage 1 pull request (or the `workers.dev` link once it's merged) on your phone. Entries are pretend data and vanish on refresh, which is expected until Stage 2.
2. **Enter a 3-day event.** On the Events tab, open the pretend "Comic Con" event and tap "+ Add" → Income. Enter cash and card takings for each of its three days (e.g. $1,000, $2,000 and $1,500 in total).
3. **Add its costs.** From the same event page, "+ Add" → Expense, three times: a table fee, a hotel and food. Check that the event is already filled in.
4. **Other costs.** On the event page, add "Other costs" (e.g. $600 COGS). Check that it appears separately from the result.
5. **Other streams.** On the Income tab, open "Online sales". Add one sale ("+ Add" → Income) and one operating cost ("+ Add" → Expense). Check that the stream is filled in.
6. **Check the totals.** Look at Home's "This month", the event page, the Online sales page and the Expenses tab. Do the totals match what you entered?
7. **Things logged for this check:**
   - do the down and up arrows read as expenses and income?
   - tapping Notes: does the page jump or scroll twice?
   - with your phone's text size turned up, does anything overlap or get cut off?
   - if your phone uses a comma for decimals, the number keypad may have no "." key. Note it (comma decimals arrive in Stage 4);
   - **optional, with VoiceOver (iPhone) or TalkBack (Android):**
     - is the payment-method error read twice?
     - when you pick a production category and the event fields disappear, is that announced?
     - are the "Reads as" lines and Home's totals read out without being noisy?
     - after a failed save, does focus land on the first bad field?
8. **Report back.** Note anything awkward, too small or confusing, with a screenshot if you can.
Done when: the owner reports back, and any fixes are made.
Evidence:

## Stage gate

Run the `stage-gate` skill. The "Check yourself" questions for the owner:
- Why do entries vanish when you refresh?
- Where does "state" live, and what would make it last?
