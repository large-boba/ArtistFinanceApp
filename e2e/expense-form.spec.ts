// Expense form (T1.7, docs/stages/stage-01.md).
// Guide §6 (the phone's own date picker; show the interpreted amount), §7
// (expense groups; event & venue costs prompt for an event but allow "not
// assigned yet"), §17 Stage 1 step 3, §19 "Everyday use" (big enough to tap,
// works with a screen reader and keyboard).
//
// Updated for T1.11 (new bottom tabs: Home, Events, Expenses, Income,
// Settings; DECISIONS.md "Navigation"): Transactions is no longer a tab, but
// /transactions stays reachable until T1.16 and T1.17 split its list into the
// Income and Expenses tabs (lead's decision on the T1.11 card). The tests
// that tapped the "Transactions" tab after saving now use goToTransactions()
// instead: a CLIENT-SIDE move (no reload) through Next.js's own router,
// window.next.router.push("/transactions"), the same call a next/link link
// makes. A plain page.goto("/transactions") would reload the page and wipe
// the saved expense, which would break what those tests prove. The helper
// also proves the move didn't reload the page. No assertion about the form
// or the list changed.
//
// CHANGED (T1.17b): /transactions is removed, so the tests that checked a
// saved expense on the Transactions list now check it on the Expenses tab
// with goToExpenses() (the same client-side move, to /expenses, with the same
// no-reload proof). A row there is the shared cost row (expenses.spec.ts X5):
// its rendered lines are exactly the date, the category, the supplier (when
// set), "<event> · <stream>" (when set), the notes (when set) and the
// amount. So each check is now an exact list of lines, which also pins what
// the old checks did (the supplier, trimmed; a blank supplier leaves no line;
// one amount; the date shown the local way). Two things don't carry over and
// are flagged to the lead: the old label "Expense" (every row on the Expenses
// tab is an expense) and the row's <time datetime="YYYY-MM-DD"> element (the
// shared row shows the date as text only). F9's role="list" claim moves to
// the Expenses list's own <ul>, see below.
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop)
// unless its name says "on a phone"; those are limited to the phone project
// with a conditional `test.skip(...)`, as in app-shell.spec.ts. On desktop
// they show as skipped, which is expected.
//
// ═══ DECISIONS FOR THE FORM (made here so the tests can be exact) ═══════════
//
// F1. Route. The form is its own page at /expenses/new (HTTP 200 on a direct
//     load and on refresh). Its title is exactly "Add expense · BentoBudget"
//     (middle dot U+00B7, as in app-shell claim 2) and it has exactly one
//     level-1 heading, "Add expense". The bottom navigation stays on it.
//     Home's "+ Expense" control (a link or a button, app-shell claim 8)
//     opens it with a CLIENT-SIDE move (e.g. next/link), so pretend entries
//     already in the store survive. The browser's Back button from the form
//     returns to Home with the entries still there.
//     CHANGED (T1.14): Home's "+ Expense" is replaced by the shared "+ Add"
//     button (DECISIONS.md "The '+' button"; lead's approval at T1.8). The
//     form is now reached from Home by opening "+ Add", then "Add expense",
//     whose address is exactly /expenses/new?back=%2F (add-button.spec.ts
//     B4). Every test that tapped "+ Expense" now does that, through
//     pressExpenseControl()/openFormFromHome() below, and expects that address
//     where it expected /expenses/new. What each test proves is unchanged:
//     the move is client-side, entries survive, the date is taken when the
//     form opens, Save returns to Home (safeBackPath("/") is "/").
//
// F2. The form is one real <form> inside <main>. The fields, in this DOM and
//     Tab order, each with ONE visible <label> whose whole text is exactly:
//       "Date"               <input type="date">  (the phone's own picker)
//       "Supplier (optional)" a text <input>
//       "Amount"             <input type="text" inputmode="decimal">. Not
//                            type="number": that throws away "$" and commas
//                            and can't report what was typed.
//       "Category"           a native <select> (see F5)
//       "Event"              a native <select>, ONLY for event & venue
//                            categories (see F6)
//       "Income stream (optional)" a native <select>, ONLY for event & venue
//                            and operating categories (see F11)
//       "Notes (optional)"   a <textarea>
//     then a submit <button> named exactly "Save", then a link named exactly
//     "Cancel" whose href is "/" (or the safe ?back= path, F15). Nothing focusable comes before Date in
//     <main>, so the first Tab from the top of the page lands on Date.
//     The browser's own validation bubbles must not replace the messages in
//     F4 (no `required`/`pattern` that blocks submit, or use `noValidate`).
//     CHANGED (T1.13): the "Income stream (optional)" field comes after Event
//     when Event shows, otherwise straight after Category; Cancel follows
//     ?back= (F15).
//
// F3. Date. Defaults to todayOnDevice() in the device's zone (guide §6),
//     worked out in the browser when the form OPENS (not when the app first
//     loaded, and never on the server). It can be changed; the saved entry
//     keeps exactly the "YYYY-MM-DD" in the field.
//
// F4. Amount, using the T1.4 rules (parseAmountToCents):
//     - Live feedback. While the text is a valid amount, an element whose
//       whole text is exactly "Reads as <formatCents(cents, "AUD", locale)>"
//       is shown (en-AU: "Reads as $1,234.50"; en-US: "Reads as A$1,234.50"),
//       updated on every keystroke and linked to the Amount input through
//       aria-describedby. While the text is empty or invalid, NO "Reads as"
//       text is shown anywhere in <main> (never a stale value).
//       CHANGED (T1.13a, lead's decision): "Live" means it updates as you
//       type; it is NOT a live region. The "Reads as" element has no
//       aria-live, no role status, log, alert, marquee or timer, isn't an
//       <output>, and has no live ancestor; in fact the form holds no live
//       region at all. The Amount field's accessible description includes
//       the "Reads as" text, so a screen reader reads it when the field is
//       focused, instead of on every keystroke (T1.7 review finding).
//     - Errors appear when Save is pressed (not while typing). Each is an
//       element whose whole text is exactly the message, linked to its field
//       through aria-describedby, and the field gets aria-invalid="true":
//         Amount empty or only spaces → "Enter an amount."
//         Amount anything else invalid →
//           "Enter an amount like 12.50 or $1,234.50, with no minus sign and at most 2 decimal places."
//         No category chosen          → "Choose a category."
//         Date field emptied          → "Choose a date."
//       Once shown, an error goes away (and aria-invalid is no longer
//       "true") as soon as the field becomes valid, without pressing Save.
//     - Save with any error: nothing is added, the page stays on
//       /expenses/new, and focus moves to the FIRST invalid field in form
//       order (Date, Amount, Category) so a screen reader reads its label,
//       value and error. Save is never `disabled`: pressing it is how you
//       find out what's wrong.
//
// F5. Category. A native <select> labelled "Category" whose children are, in
//     order: one <option> "Choose a category" (selected at the start, value
//     ""), then three <optgroup>s labelled exactly "Production",
//     "Event & venue" and "Operating", holding the DRAFT_CATEGORIES names in
//     the draft list's order (written out by hand below).
//
// F6. Event. A native <select> labelled "Event" is in the accessibility tree
//     only while an event & venue category is chosen. Its options, in order:
//     "Not assigned yet" (selected when it appears), then the pretend events
//     in pretendEvents()'s order. Since T1.10 those are
//     "Pretend comic convention", "Pretend weekend market (today)",
//     "Pretend gallery shelf" (pinned in src/lib/pretend-data.test.ts; the
//     zine workshop is gone). With no category, or a production or operating
//     category, there is no Event field, and saving never sends an event for
//     those (the store refuses it, guide §7).
//     CHANGED (T1.13, lead's decision): T1.7's form forgot the chosen event
//     when you left event & venue. Now a hidden Event (and a hidden Income
//     stream) KEEPS its value while hidden and shows it again when the field
//     comes back (F13). What is SAVED still follows the category: an event
//     only for event & venue, a stream only for event & venue and operating.
//     (No T1.7 test asserted the reset, so no assertion had to be removed;
//     the two "switching" tests below still hold.)
//
// F7. Save adds exactly ONE expense (also when Save is double-clicked, or
//     Enter is pressed in a field) through the store's "add-expense" action,
//     then returns to Home ("/") with a client-side move (CHANGED (T1.13): or
//     to the safe ?back= path, F15), where Home's
//     "Expenses $X" line (CHANGED (T1.18): was "Today's expenses: $X"; the
//     month's total, home.spec.ts H3) already includes it. Supplier and notes are
//     stored trimmed. Cancel adds nothing and returns to Home. Opening the
//     form again shows a fresh, empty form.
//
// F8. Layout and access (guide §19 "Everyday use", WCAG 1.4.4, 1.4.10,
//     2.4.11, 2.5.8). On a phone every control is at least 44×44 CSS px and
//     its text is at least 16 px (smaller makes iPhones zoom in on focus).
//     At 320×568 with 200% text the form doesn't scroll sideways, every
//     label, control and message stays inside 0–320 px, the whole flow still
//     works, and Tab never leaves a focused element hidden or under the nav.
//
// F9. Carried over from T1.6 (lead's optional items):
//     - Home's note is reworded. The old "These buttons start working soon"
//       is gone, and an element in <main> has exactly the text
//       "Practice mode: entries disappear when you refresh or close the app."
//       (the Stage 1 lesson, true whichever buttons work).
//     - The <ul>s carry role="list" (Safari/VoiceOver drops list semantics
//       when list-style is none): the Transactions entries list and the nav's
//       list. CHANGED (T1.17b): the Transactions list is gone; only the nav's
//       list is checked here. Whether the new lists (Expenses, event and
//       stream pages) need role="list" too is a question for the lead.
//     - The date is taken when the form opens (F3).
//
// F10. No uncaught errors and no React hydration errors during any test.
//
// ─── Added for T1.13 (stream tag, pre-fill, safe back) ─────────────────────
// (F13 gained one more lead decision in T1.14, from the T1.13 review:
// picking an event BY HAND never changes the Income stream. Only pre-fill
// from ?event= brings the event's usual stream. See the T1.14 tests at the
// end of this file.)
// Guide §7; DECISIONS.md "Linking costs to events and streams" and "The '+'
// button". Lead's decisions, written out here so the tests can be exact.
//
// F11. Income stream. A native <select> with ONE visible <label> reading
//     exactly "Income stream (optional)". Options, in order: "No stream"
//     (value "", selected at the start), then the seven INCOME_STREAMS names
//     in the guide's order: "Sales at events", "Online sales", "Wholesale",
//     "Commissions", "Vendor shelf rental", "Social media",
//     "Subscription income". No optgroups. It is in the accessibility tree
//     only while an event & venue or operating category is chosen (not with
//     no category, not for production). It never shows an error. Saving
//     stores its stream (or none for "No stream").
//     How the tests see it: expense rows don't show a stream yet (T1.16 will
//     add stream totals), so the stream claims are proven through saves that
//     succeed with no page error. The store refuses a stream on a production
//     cost and an event on a non-event cost (entries.ts), so a form that sent
//     a field the category doesn't allow throws in the page (F10).
//
// F12. Production note. While a production category is chosen, an element in
//     <main> whose whole text is exactly
//       "Production costs aren't linked to an event or stream."
//     (plain ASCII apostrophe U+0027) is shown, and the Category field's
//     aria-describedby includes it, so a screen reader hears why the fields
//     went away. With no category, or any other category, the note is absent.
//
// F13. Hidden fields keep their value (lead's decision, replacing T1.7's
//     reset). Event and Income stream remember what was chosen (by the
//     artist or by pre-fill) while hidden, and show it again when a category
//     that allows them is chosen. Only fields the chosen category allows are
//     saved.
//
// F14. Pre-fill from the page address (T1.14's "+" button uses this):
//     - ?event=<id> (an exact pretendEvents() id) pre-selects that event in
//       the Event field (seen once an event & venue category is chosen) and
//       makes the stream default to the event's usual stream:
//         pretend-event-shelf     → Vendor shelf rental
//         pretend-event-comic-con → Sales at events
//     - ?stream=<id> (an exact INCOME_STREAMS id) pre-selects the stream. With
//       both, ?stream wins for the stream field; the event still applies.
//     - Unknown ids are ignored silently (no message, no aria-invalid, no
//       page error). An unknown stream counts as "no stream given", so a known
//       event still brings its usual stream (as in income-form I8).
//     - Pre-fill never chooses a category: Category starts on
//       "Choose a category" (the artist decides which kind of cost it is).
//     - It works on a direct load and after a client-side move to the form.
//
// F15. Where Save and Cancel go: ?back=<path> through safeBackPath (the T1.12
//     rule, capped at 200 characters in T1.12b), otherwise Home ("/"). Save
//     moves there with a client-side replace, so the browser's Back
//     afterwards doesn't reopen the form; Cancel is a link to the same place.
//     Requests to any other host are blocked in these tests.
//
// F16. The old rules still hold with the new fields: errors only after Save,
//     focus on the first bad field, a double tap saves once, and 320×568 at
//     200% text works in all three shapes (no category; event & venue with
//     Event and Income stream; production with the note).
//
// ─── Added for T1.16b (the owner's amount cap) ─────────────────────────────
//
// F17. Owner (DECISIONS.md "Typed amounts: detailed rules", 2026-10-26):
//     every amount is at most $9,999,999.99 per entry. Lead's decisions:
//     - "9999999.99" (and "$9,999,999.99", "9,999,999.99") is a valid amount:
//       "Reads as $9,999,999.99" shows, and Save adds it.
//     - Anything above it that is otherwise well-formed ("10000000",
//       "10,000,000.00", "$10,000,000") is too large: NO "Reads as" while
//       typing, and after Save exactly "Enter an amount up to $9,999,999.99."
//       (a new shared text in form-parts), the Amount field gets
//       aria-invalid="true" and aria-describedby pointing at it, focus moves
//       to Amount, and nothing is saved. Like every error, it only appears
//       after Save and goes as soon as the amount is fixed.
//     - A format mistake keeps the F4 format message and never shows the cap
//       message, even when the number is also too large ("10000000.001":
//       three decimals is a format mistake first, test engineer's reading
//       matching money.test.ts amountProblem).
//
// ═══ HAND-WORKED VALUES ═════════════════════════════════════════════════════
//
// The device clock is frozen at 2026-06-30T15:30:00Z. In Australia/Sydney
// (UTC+10 in winter, no daylight saving in June) that's 01:30 on 1 July, so
// today = "2026-07-01", while the UTC date is still 30 June. In
// Australia/Perth (UTC+8) it's 23:30 on 30 June, so today = "2026-06-30".
// Day-rollover check: 13:59Z is 23:59 on 30 June in Sydney; 14:01Z is 00:01
// on 1 July.
//
// T1.16b: "9999999.99" = 9,999,999 × 100 + 99 = 999,999,999 cents, shown
// "$9,999,999.99"; "10000000" = 1,000,000,000 cents, one cent over the cap.
//
// Every expected string below is written out by hand. None is computed with
// the app's own code (parseAmountToCents, formatCents, formatDateForDisplay,
// totalsForDate, ...).

import { expect, test as base, type Locator, type Page } from "@playwright/test";
// Type-only import (erased at run time): the seam takes the store's own input type.
import type { ExpenseInput } from "../src/lib/entries";

// ---------- fixed facts ----------

/** 2026-06-30 15:30 UTC: 1 July 01:30 in Sydney, 30 June 23:30 in Perth. */
const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";
const PERTH = "Australia/Perth";
const SYDNEY_TODAY = "2026-07-01";
const PERTH_TODAY = "2026-06-30";

const FORM_PATH = "/expenses/new";
const FORM_TITLE = "Add expense · BentoBudget";
const FORM_HEADING = "Add expense";

const LABEL_DATE = "Date";
const LABEL_SUPPLIER = "Supplier (optional)";
const LABEL_AMOUNT = "Amount";
const LABEL_CATEGORY = "Category";
const LABEL_EVENT = "Event";
const LABEL_NOTES = "Notes (optional)";
const LABEL_STREAM = "Income stream (optional)"; // T1.13, F11

const ERROR_AMOUNT_EMPTY = "Enter an amount.";
const ERROR_AMOUNT_INVALID =
  "Enter an amount like 12.50 or $1,234.50, with no minus sign and at most 2 decimal places.";
const ERROR_CATEGORY = "Choose a category.";
const ERROR_DATE = "Choose a date.";
// T1.16b: the owner's cap, $9,999,999.99 per entry (lead's wording; the owner may reword it).
const ERROR_AMOUNT_TOO_LARGE = "Enter an amount up to $9,999,999.99.";

const CATEGORY_PLACEHOLDER = "Choose a category";
const NOT_ASSIGNED = "Not assigned yet";

const HOME_NOTE_OLD = "These buttons start working soon";
const HOME_NOTE_NEW = "Practice mode: entries disappear when you refresh or close the app.";

// CHANGED (T1.18): Home's month lines (home.spec.ts H3); were
// "Today's expenses: $0.00" and "Today: $0.00 from 0 sales".
const HOME_EMPTY_EXPENSES = "Expenses $0.00";
const HOME_EMPTY_SALES = "Income $0.00";

const HOOK_NAME = "__bentoTest";
const HOOK_WAIT_MS = 10_000;
const EDGE_TOLERANCE_PX = 1;
const MIN_TAP_TARGET_PX = 44;
const MIN_INPUT_FONT_PX = 16;

// DRAFT_CATEGORIES (src/lib/pretend-data.ts), written out by hand.
const PRODUCTION = [
  "Printing",
  "Merch manufacturing",
  "Art materials",
  "Packaging",
  "Shipping of stock to you",
] as const;
const EVENT_VENUE = [
  "Stall or table fees",
  "Vendor shelf rent",
  "Flights",
  "Accommodation",
  "Meals",
  "Local transport",
  "Display equipment hire",
  "Parking",
] as const;
const OPERATING = [
  "Software",
  "Website",
  "Equipment",
  "Marketing",
  "Payment fees",
  "Insurance",
  "Phone",
] as const;

// pretendEvents() names, in order, after "Not assigned yet" (T1.10's three events).
const EVENT_OPTIONS = [
  NOT_ASSIGNED,
  "Pretend comic convention",
  "Pretend weekend market (today)",
  "Pretend gallery shelf",
] as const;

// Valid amounts (owner's T1.4 rules) and what "Reads as" must show in en-AU.
const VALID_AMOUNTS: readonly { typed: string; shown: string; why: string }[] = [
  { typed: "1234.5", shown: "$1,234.50", why: "one decimal is padded" },
  { typed: "$1,234.50", shown: "$1,234.50", why: "a leading $ and thousands commas are fine" },
  { typed: "1,234.50", shown: "$1,234.50", why: "thousands commas are fine" },
  { typed: "$110", shown: "$110.00", why: "a whole number with $" },
  { typed: "0", shown: "$0.00", why: "zero is allowed" },
  { typed: "0.01", shown: "$0.01", why: "one cent" },
  { typed: "007.05", shown: "$7.05", why: "leading zeros are allowed" },
  { typed: "  12.5  ", shown: "$12.50", why: "spaces around are trimmed" },
  { typed: "1,000,000", shown: "$1,000,000.00", why: "two comma groups" },
];

// Invalid amounts and the exact error each must give after Save.
const INVALID_AMOUNTS: readonly { typed: string; error: string; why: string }[] = [
  { typed: "", error: ERROR_AMOUNT_EMPTY, why: "empty" },
  { typed: "   ", error: ERROR_AMOUNT_EMPTY, why: "only spaces" },
  { typed: "10.505", error: ERROR_AMOUNT_INVALID, why: "3 decimals are rejected, not rounded" },
  { typed: "-5", error: ERROR_AMOUNT_INVALID, why: "negative" },
  { typed: "abc", error: ERROR_AMOUNT_INVALID, why: "letters" },
  { typed: "$ 5", error: ERROR_AMOUNT_INVALID, why: "a space after $" },
  { typed: "12,50", error: ERROR_AMOUNT_INVALID, why: "comma decimals wait for Stage 4" },
  { typed: ".5", error: ERROR_AMOUNT_INVALID, why: "no digit before the point" },
];

// ---------- fixture: no uncaught errors, no hydration errors (F10) ----------

const test = base.extend<{ pageProblems: string[] }>({
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`));
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          /hydrat|Minified React error #(418|419|423|425)\b/i.test(message.text())
        ) {
          problems.push(`hydration: ${message.text()}`);
        }
      });
      await use(problems);
      expect(problems, "uncaught or hydration errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

// An Australian device in Sydney unless a describe block says otherwise.
test.use({ locale: "en-AU", timezoneId: SYDNEY });

// ---------- helpers ----------

function main(page: Page): Locator {
  return page.getByRole("main");
}

function mainNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Main", exact: true });
}

function dateField(page: Page): Locator {
  return main(page).getByLabel(LABEL_DATE, { exact: true });
}
function supplierField(page: Page): Locator {
  return main(page).getByLabel(LABEL_SUPPLIER, { exact: true });
}
function amountField(page: Page): Locator {
  return main(page).getByLabel(LABEL_AMOUNT, { exact: true });
}
function categoryField(page: Page): Locator {
  return main(page).getByRole("combobox", { name: LABEL_CATEGORY, exact: true });
}
function eventField(page: Page): Locator {
  return main(page).getByRole("combobox", { name: LABEL_EVENT, exact: true });
}
function streamField(page: Page): Locator {
  return main(page).getByRole("combobox", { name: LABEL_STREAM, exact: true });
}
function notesField(page: Page): Locator {
  return main(page).getByLabel(LABEL_NOTES, { exact: true });
}
function saveButton(page: Page): Locator {
  return main(page).getByRole("button", { name: "Save", exact: true });
}
function cancelLink(page: Page): Locator {
  return main(page).getByRole("link", { name: "Cancel", exact: true });
}

// CHANGED (T1.14): Home's way to the form. It was the "+ Expense" control;
// now it's the "+ Add" button, which opens a group holding "Add expense".

/** The address "Add expense" on Home leads to, written out by hand (add-button.spec.ts B4). */
const HOME_FORM_ADDRESS = "/expenses/new?back=%2F";

function addButton(page: Page): Locator {
  return main(page).getByRole("button", { name: "Add", exact: true }); // CHANGED (T1.19): was "+ Add" (the button is now a round "+" named "Add")
}

/** Opens "+ Add" on Home (it must start closed) and returns the "Add expense" link, ready to press. */
async function expenseControl(page: Page, hasTouch: boolean): Promise<Locator> {
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "false");
  await press(addButton(page), hasTouch);
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
  return main(page).getByRole("link", { name: "Add expense", exact: true });
}

/** Opens "+ Add" on Home and presses "Add expense" (CHANGED (T1.14): was "+ Expense"). */
async function pressExpenseControl(page: Page, hasTouch: boolean): Promise<void> {
  await press(await expenseControl(page, hasTouch), hasTouch);
}

/** An element in <main> whose whole text is exactly `text`. */
function exactText(page: Page, text: string): Locator {
  return main(page).getByText(text, { exact: true });
}

/**
 * CHANGED (T1.18): Home's "This month" section (home.spec.ts H3) has a line
 * whose rendered text, whitespace collapsed, is exactly `text` (e.g.
 * "Expenses $23.50"). Replaces the old exact "Today's expenses: $X" element.
 */
async function expectHomeLine(page: Page, text: string): Promise<void> {
  const section = page.getByRole("main").getByRole("region", { name: "This month", exact: true });
  await expect(section).toHaveCount(1);
  await expect
    .poll(
      () =>
        section.evaluate((root) =>
          [root, ...Array.from(root.querySelectorAll("*"))]
            .filter((el) => el.getClientRects().length > 0)
            .map((el) => ((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim()),
        ),
      { message: `Home's "This month" has a line reading exactly "${text}"` },
    )
    .toContain(text);
}

/** Any "Reads as …" feedback in <main>. */
function readsAs(page: Page): Locator {
  return main(page).getByText(/^\s*Reads as\b/);
}

/** Taps on a touch device (the phone project), clicks otherwise. */
async function press(locator: Locator, hasTouch: boolean): Promise<void> {
  await expect(locator).toBeVisible();
  if (hasTouch) await locator.tap();
  else await locator.click();
}

function touch(testInfo: { project: { use: { hasTouch?: boolean } } }): boolean {
  return !!testInfo.project.use.hasTouch;
}

/** Freezes the device clock, opens a path and requires HTTP 200. */
async function open(page: Page, url: string, now: Date = FROZEN_NOW): Promise<void> {
  await page.clock.setFixedTime(now);
  const response = await page.goto(url);
  expect(response?.status(), `HTTP status of ${url}`).toBe(200);
}

/** Waits for the page to have hydrated, using the nav's --nav-h (app-shell claim 15). */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--nav-h") !== "");
}

/**
 * Waits until the form is ready to use: the page has hydrated and the Date
 * field holds a date (it's filled in the browser, F3). Which date is the
 * claim of the date tests, not of this helper.
 */
async function waitForForm(page: Page): Promise<void> {
  await waitForHydration(page);
  await expect(dateField(page), "the Date field is filled in once the form is ready").toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
}

/** Opens the form directly (a full page load) and waits until it's ready. */
async function openForm(page: Page): Promise<void> {
  await open(page, FORM_PATH);
  await waitForForm(page);
}

/**
 * Opens Home, then "+ Add" → "Add expense" (a client-side move) and waits for
 * the form. CHANGED (T1.14): was "+ Expense"; the address now carries
 * ?back=%2F.
 */
async function openFormFromHome(page: Page, hasTouch: boolean): Promise<void> {
  await open(page, "/");
  await waitForHydration(page);
  await pressExpenseControl(page, hasTouch);
  await expect(page).toHaveURL(urlWithPath(HOME_FORM_ADDRESS));
  await waitForForm(page);
}

/** Matches a full URL on this server whose path is exactly `path`. */
function urlWithPath(path: string): RegExp {
  return new RegExp(`^https?://[^/]+${escapeRegExp(path)}$`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type FormValues = {
  date?: string;
  supplier?: string;
  amount?: string;
  category?: string;
  event?: string;
  notes?: string;
};

/** Fills in the form. Fields left out keep what they have. */
async function fillForm(page: Page, values: FormValues): Promise<void> {
  if (values.date !== undefined) await dateField(page).fill(values.date);
  if (values.supplier !== undefined) await supplierField(page).fill(values.supplier);
  if (values.amount !== undefined) await amountField(page).fill(values.amount);
  if (values.category !== undefined) await categoryField(page).selectOption({ label: values.category });
  if (values.event !== undefined) await eventField(page).selectOption({ label: values.event });
  if (values.notes !== undefined) await notesField(page).fill(values.notes);
}

/** Presses Save and checks the app went back to Home. */
async function saveAndExpectHome(page: Page, hasTouch: boolean): Promise<void> {
  await press(saveButton(page), hasTouch);
  await expect(page).toHaveURL(urlWithPath("/"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");
}

/** Moves to a tab with the bottom navigation (a client-side move, no reload). */
async function goToTab(
  page: Page,
  name: "Home",
  path: "/",
  hasTouch: boolean,
): Promise<void> {
  await press(mainNav(page).getByRole("link", { name, exact: true }), hasTouch);
  await expect(page).toHaveURL(urlWithPath(path));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

/**
 * CHANGED (T1.17b): moves to the Expenses tab (/expenses) with a client-side
 * move (no reload). It replaces goToTransactions(): /transactions is removed.
 * It calls Next.js's own router, window.next.router.push, the same call a
 * next/link link makes. A marker put on `window` first must still be there
 * afterwards, which proves the page wasn't reloaded (a reload starts a fresh
 * window and would wipe the saved expense).
 */
async function goToExpenses(page: Page): Promise<void> {
  const routerReady = await page.evaluate(
    () => typeof (window as unknown as { next?: { router?: { push?: unknown } } }).next?.router?.push === "function",
  );
  expect(routerReady, "Next.js's client router (window.next.router.push) is available").toBe(true);
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__t111SameDocument = true;
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push("/expenses");
  });
  await expect(page).toHaveURL(urlWithPath("/expenses"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Expenses");
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).__t111SameDocument),
    "the move to /expenses didn't reload the page",
  ).toBe(true);
}

/** CHANGED (T1.17b): the rows of the Expenses tab's "All expenses" list. */
function rows(page: Page): Locator {
  return main(page).getByRole("region", { name: "All expenses", exact: true }).getByRole("listitem");
}

/** T1.17b: a cost row's rendered lines (expenses.spec.ts X5), whitespace collapsed, empties dropped. */
async function rowLines(row: Locator): Promise<string[]> {
  return (await row.innerText())
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
}

/** The texts of the elements an element's aria-describedby points at. */
async function describedByTexts(field: Locator): Promise<string[]> {
  return field.evaluate((el) =>
    (el.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter((id) => id !== "")
      .map((id) => (document.getElementById(id)?.textContent ?? "").replace(/\s+/g, " ").trim()),
  );
}

/** Waits until the test seam is installed (T1.6), then adds expenses through it. */
async function seedExpenses(page: Page, expenses: readonly ExpenseInput[]): Promise<void> {
  await page
    .waitForFunction(
      (name) =>
        typeof (window as unknown as Record<string, { addExpense?: unknown } | undefined>)[name]?.addExpense ===
        "function",
      HOOK_NAME,
      { timeout: HOOK_WAIT_MS },
    )
    .catch(() => {
      throw new Error(`test seam window.${HOOK_NAME} never appeared (see test-seam.spec.ts)`);
    });
  await page.evaluate(
    ({ name, expenses }) => {
      const hook = (window as unknown as Record<string, { addExpense(e: unknown): void }>)[name];
      for (const e of expenses) hook.addExpense(e);
    },
    { name: HOOK_NAME, expenses: expenses as ExpenseInput[] },
  );
}

/** The accessible label text of the focused element (its <label>, or its own text). */
function focusedLabel(page: Page): Promise<{ inMain: boolean; label: string } | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const inMain = !!el.closest("main");
    const labels = (el as HTMLInputElement).labels;
    const raw = labels && labels.length > 0 ? labels[0].innerText : el.innerText;
    return { inMain, label: (raw ?? "").replace(/\s+/g, " ").trim() };
  });
}

/**
 * Presses Tab until focus leaves <main>, recording each control reached.
 * A date input keeps focus across its day/month/year parts, so repeats in a
 * row count once.
 */
async function tabOrderInMain(page: Page): Promise<string[]> {
  const seen: string[] = [];
  const first = await focusedLabel(page);
  if (first?.inMain) seen.push(first.label);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const now = await focusedLabel(page);
    if (now === null) continue;
    if (!now.inMain) {
      if (seen.length > 0) break;
      continue;
    }
    if (seen[seen.length - 1] !== now.label) seen.push(now.label);
  }
  return seen;
}

/** Sets the root font size like a browser text-size setting and checks it took. */
async function setTextSize(page: Page, percent: number, expectedPx: string): Promise<void> {
  await page.evaluate((p) => {
    document.documentElement.style.fontSize = `${p}%`;
  }, percent);
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
    "root font size after enlarging",
  ).toBe(expectedPx);
}

async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

/**
 * Puts the keyboard's starting point at the page heading, so the next Tab
 * goes to the first control after it. (Chromium remembers where focus was
 * even after blur(), so clicking the heading is the reliable way.)
 */
async function startTabbingFromTheTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("heading", { level: 1 }).click();
}

/**
 * Presses Tab through every focusable, rendered element in <main>. After each
 * press, the focused element must be fully on screen and not overlap the nav
 * (the app-shell claim 15 check, repeated here for the form).
 */
async function expectTabKeepsMainFocusClearOfNav(page: Page): Promise<void> {
  const count = await main(page).evaluate((m) => {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const found = Array.from(m.querySelectorAll(selector)).filter(
      (el) => el.getClientRects().length > 0 && el.getAttribute("tabindex") !== "-1",
    );
    found.forEach((el, i) => el.setAttribute("data-focus-test", String(i)));
    return found.length;
  });
  expect(count, "focusable elements in <main>").toBeGreaterThanOrEqual(7);

  const reached = new Set<number>();
  for (let i = 0; i < count * 4 + 20 && reached.size < count; i++) {
    await page.keyboard.press("Tab");
    await nextFrame(page);
    const state = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const nav = document.querySelector('nav[aria-label="Main"]');
      if (!el || !nav || !el.hasAttribute("data-focus-test")) return null;
      const r = el.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      return {
        index: Number(el.getAttribute("data-focus-test")),
        label: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`,
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        navTop: n.top,
        navBottom: n.bottom,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });
    if (state === null) continue;
    reached.add(state.index);
    const where = `${state.label} at top ${state.top.toFixed(1)}, bottom ${state.bottom.toFixed(1)}`;
    expect(state.top, `${where}: top on screen`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(state.bottom, `${where}: bottom on screen`).toBeLessThanOrEqual(state.vh + EDGE_TOLERANCE_PX);
    expect(state.left, `${where}: left on screen`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(state.right, `${where}: right on screen`).toBeLessThanOrEqual(state.vw + EDGE_TOLERANCE_PX);
    const overlapsNav =
      state.bottom > state.navTop + EDGE_TOLERANCE_PX && state.top < state.navBottom - EDGE_TOLERANCE_PX;
    expect(overlapsNav, `${where} overlaps the nav (${state.navTop.toFixed(1)}–${state.navBottom.toFixed(1)})`).toBe(
      false,
    );
  }
  expect(reached.size, "focusable elements in <main> reached by Tab").toBe(count);
}

// ═══ 1. Opening the form (F1) ═══════════════════════════════════════════════

test.describe("opening the form", () => {
  test('"+ Add" then "Add expense" on Home opens the form at /expenses/new?back=%2F (CHANGED (T1.14): was "+ Expense")', async ({ page }, testInfo) => {
    await open(page, "/");
    await waitForHydration(page);
    await pressExpenseControl(page, touch(testInfo));
    await expect(page).toHaveURL(urlWithPath(HOME_FORM_ADDRESS));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(FORM_HEADING);
  });

  test("/expenses/new loads directly with HTTP 200", async ({ page }) => {
    await open(page, FORM_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(FORM_HEADING);
  });

  test(`the form's page title is exactly "${FORM_TITLE}"`, async ({ page }) => {
    await open(page, FORM_PATH);
    await expect(page).toHaveTitle(FORM_TITLE);
  });

  test('the form page has exactly one level-1 heading, "Add expense"', async ({ page }) => {
    await open(page, FORM_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(FORM_HEADING);
  });

  test("the bottom navigation is still on the form page", async ({ page }) => {
    await open(page, FORM_PATH);
    await expect(mainNav(page)).toHaveCount(1);
    await expect(mainNav(page).getByRole("link")).toHaveCount(5);
  });

  test("refreshing the form shows the form again (HTTP 200, ready to use)", async ({ page }) => {
    await openForm(page);
    const response = await page.reload();
    expect(response?.status()).toBe(200);
    await waitForForm(page);
    await expect(amountField(page)).toHaveValue("");
  });

  test("the browser's Back button on the form returns to Home with earlier entries kept", async ({
    page,
  }, testInfo) => {
    await open(page, "/");
    // 2350 + 3299 = 5649 → $56.49 (the same two expenses as T1.6's A2 and A8).
    await seedExpenses(page, [
      { date: SYDNEY_TODAY, amountCents: 2350, categoryId: "printing", supplier: "Officeworks" },
      { date: SYDNEY_TODAY, amountCents: 3299, categoryId: "software", supplier: "Adobe" },
    ]);
    await expectHomeLine(page, "Expenses $56.49"); // CHANGED (T1.18): was "Today's expenses: $56.49"
    await pressExpenseControl(page, touch(testInfo));
    await expect(page).toHaveURL(urlWithPath(HOME_FORM_ADDRESS));
    await page.goBack();
    await expect(page).toHaveURL(urlWithPath("/"));
    await expectHomeLine(page, "Expenses $56.49"); // CHANGED (T1.18): was "Today's expenses: $56.49"
  });
});

// ═══ 2. Fields, labels and structure (F2, F5) ═══════════════════════════════

test.describe("the fields and their labels", () => {
  const LABELLED = [
    { label: LABEL_DATE, tag: "INPUT" },
    { label: LABEL_SUPPLIER, tag: "INPUT" },
    { label: LABEL_AMOUNT, tag: "INPUT" },
    { label: LABEL_CATEGORY, tag: "SELECT" },
    { label: LABEL_NOTES, tag: "TEXTAREA" },
  ] as const;

  for (const { label, tag } of LABELLED) {
    test(`"${label}" is a <${tag.toLowerCase()}> with exactly one visible <label> reading "${label}"`, async ({
      page,
    }) => {
      await openForm(page);
      const field = main(page).getByLabel(label, { exact: true });
      await expect(field).toHaveCount(1);
      const facts = await field.evaluate((el) => {
        const labels = Array.from((el as HTMLInputElement).labels ?? []);
        labels.forEach((l) => l.setAttribute("data-label-test", "yes"));
        return {
          tag: el.tagName,
          labels: labels.map((l) => l.innerText.replace(/\s+/g, " ").trim()),
        };
      });
      expect(facts).toEqual({ tag, labels: [label] });
      await expect(main(page).locator('label[data-label-test="yes"]')).toBeVisible();
    });
  }

  test('the Event field (when shown) has exactly one visible <label> reading "Event"', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Accommodation" });
    const field = eventField(page);
    await expect(field).toHaveCount(1);
    const facts = await field.evaluate((el) => {
      const labels = Array.from((el as HTMLSelectElement).labels ?? []);
      labels.forEach((l) => l.setAttribute("data-label-test", "yes"));
      return { tag: el.tagName, labels: labels.map((l) => l.innerText.replace(/\s+/g, " ").trim()) };
    });
    expect(facts).toEqual({ tag: "SELECT", labels: [LABEL_EVENT] });
    await expect(main(page).locator('label[data-label-test="yes"]')).toBeVisible();
  });

  test('the Date field is a native date picker (type="date")', async ({ page }) => {
    await openForm(page);
    await expect(dateField(page)).toHaveAttribute("type", "date");
  });

  test('the Amount field is a text field with the decimal keypad (type="text", inputmode="decimal")', async ({
    page,
  }) => {
    await openForm(page);
    const attrs = await amountField(page).evaluate((el) => ({
      type: el.getAttribute("type"),
      inputmode: el.getAttribute("inputmode"),
    }));
    expect(attrs).toEqual({ type: "text", inputmode: "decimal" });
  });

  test("Save is a submit button inside the same <form> as every field", async ({ page }) => {
    await openForm(page);
    const facts = await saveButton(page).evaluate((button) => {
      const form = (button as HTMLButtonElement).form;
      const names = ["Date", "Supplier (optional)", "Amount", "Category", "Notes (optional)"];
      const fieldsInForm = names.map((name) =>
        Array.from(form?.elements ?? []).some((el) =>
          Array.from((el as HTMLInputElement).labels ?? []).some(
            (l) => l.innerText.replace(/\s+/g, " ").trim() === name,
          ),
        ),
      );
      return { type: (button as HTMLButtonElement).type, inMain: !!form?.closest("main"), fieldsInForm };
    });
    expect(facts).toEqual({ type: "submit", inMain: true, fieldsInForm: [true, true, true, true, true] });
  });

  test("Save is never disabled, even with an empty form", async ({ page }) => {
    await openForm(page);
    await expect(saveButton(page)).toBeEnabled();
  });

  test('Cancel is a link to "/"', async ({ page }) => {
    await openForm(page);
    await expect(cancelLink(page)).toHaveAttribute("href", "/");
  });

  test("the form starts empty: no supplier, no amount, no notes", async ({ page }) => {
    await openForm(page);
    await expect(supplierField(page)).toHaveValue("");
    await expect(amountField(page)).toHaveValue("");
    await expect(notesField(page)).toHaveValue("");
  });

  test('Category starts on "Choose a category" (value "")', async ({ page }) => {
    await openForm(page);
    await expect(categoryField(page)).toHaveValue("");
    const selected = await categoryField(page).evaluate(
      (el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? null,
    );
    expect(selected).toBe(CATEGORY_PLACEHOLDER);
  });

  test("Category is grouped: a placeholder, then Production, Event & venue and Operating with the draft categories in order", async ({
    page,
  }) => {
    await openForm(page);
    const structure = await categoryField(page).evaluate((select) =>
      Array.from(select.children).map((child) =>
        child.tagName === "OPTGROUP"
          ? {
              group: (child as HTMLOptGroupElement).label,
              options: Array.from(child.children).map((o) => (o.textContent ?? "").trim()),
            }
          : { tag: child.tagName, text: (child.textContent ?? "").trim() },
      ),
    );
    expect(structure).toEqual([
      { tag: "OPTION", text: CATEGORY_PLACEHOLDER },
      { group: "Production", options: [...PRODUCTION] },
      { group: "Event & venue", options: [...EVENT_VENUE] },
      { group: "Operating", options: [...OPERATING] },
    ]);
  });

  test("Tab order in the form is Date, Supplier, Amount, Category, Notes, Save, Cancel", async ({ page }) => {
    await openForm(page);
    await dateField(page).focus();
    expect(await tabOrderInMain(page)).toEqual([
      LABEL_DATE,
      LABEL_SUPPLIER,
      LABEL_AMOUNT,
      LABEL_CATEGORY,
      LABEL_NOTES,
      "Save",
      "Cancel",
    ]);
  });

  // CHANGED (T1.13): the Income stream field now comes between Event and Notes (F2, F11).
  test("with an event & venue category, Tab goes Category, then Event, then Income stream, then Notes", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Parking" });
    await dateField(page).focus();
    expect(await tabOrderInMain(page)).toEqual([
      LABEL_DATE,
      LABEL_SUPPLIER,
      LABEL_AMOUNT,
      LABEL_CATEGORY,
      LABEL_EVENT,
      LABEL_STREAM,
      LABEL_NOTES,
      "Save",
      "Cancel",
    ]);
  });

  test("the first Tab from the top of the page lands on Date", async ({ page }) => {
    await openForm(page);
    await page.keyboard.press("Tab");
    await expect(dateField(page)).toBeFocused();
  });
});

// ═══ 3. Date (F3) ═══════════════════════════════════════════════════════════

test.describe("the date", () => {
  test(`defaults to today on the device: ${SYDNEY_TODAY} at 01:30 in Sydney (the UTC date is still 30 June)`, async ({
    page,
  }) => {
    await openForm(page);
    await expect(dateField(page)).toHaveValue(SYDNEY_TODAY);
  });

  test("defaults to today when reached from Home's + Add → Add expense too", async ({ page }, testInfo) => {
    await openFormFromHome(page, touch(testInfo));
    await expect(dateField(page)).toHaveValue(SYDNEY_TODAY);
  });

  test("is taken when the form opens: Home loaded at 23:59 on 30 June, form opened at 00:01 on 1 July shows 1 July", async ({
    page,
  }, testInfo) => {
    await open(page, "/", new Date("2026-06-30T13:59:00.000Z")); // 23:59 in Sydney
    await waitForHydration(page);
    await page.clock.setFixedTime(new Date("2026-06-30T14:01:00.000Z")); // 00:01 on 1 July in Sydney
    await pressExpenseControl(page, touch(testInfo));
    await expect(page).toHaveURL(urlWithPath(HOME_FORM_ADDRESS));
    await expect(dateField(page)).toHaveValue("2026-07-01");
  });

  test("can be changed, and the saved entry keeps the chosen date (2026-06-15, shown 15/06/2026)", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { date: "2026-06-15", amount: "5", category: "Printing" });
    await expect(dateField(page)).toHaveValue("2026-06-15");
    await saveAndExpectHome(page, touch(testInfo));
    // CHANGED (T1.17b): on the Expenses tab; the date is the row's first line.
    await goToExpenses(page);
    await expect(rows(page)).toHaveCount(1);
    expect(await rowLines(rows(page).first())).toEqual(["15/06/2026", "Printing", "$5.00"]);
  });

  test("an expense dated 30 June (the month before, in Sydney) doesn't change Home's expenses for July (CHANGED (T1.18): was \"another day\")", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { date: "2026-06-30", amount: "5", category: "Printing" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, HOME_EMPTY_EXPENSES); // CHANGED (T1.18)
  });

  test(`emptying the date and pressing Save shows "${ERROR_DATE}" and adds nothing`, async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { date: "", amount: "5", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_DATE)).toBeVisible();
    await expect(page).toHaveURL(urlWithPath(FORM_PATH));
  });

  test("an emptied date is marked invalid and its error is linked by aria-describedby", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { date: "", amount: "5", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true");
    expect(await describedByTexts(dateField(page))).toContain(ERROR_DATE);
  });
});

test.describe("the date late at night in Perth", () => {
  test.use({ timezoneId: PERTH });

  test(`defaults to ${PERTH_TODAY} at 23:30 in Perth`, async ({ page }) => {
    await openForm(page);
    await expect(dateField(page)).toHaveValue(PERTH_TODAY);
  });

  test("an expense saved with the default date counts in Perth's month on Home (CHANGED (T1.18))", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "5", category: "Printing" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $5.00"); // CHANGED (T1.18): was "Today's expenses: $5.00"
  });
});

// ═══ 4. Amount: live feedback and errors (F4) ═══════════════════════════════

test.describe("the amount's live feedback", () => {
  for (const { typed, shown, why } of VALID_AMOUNTS) {
    test(`"${typed}" shows "Reads as ${shown}" (${why})`, async ({ page }) => {
      await openForm(page);
      await amountField(page).fill(typed);
      await expect(exactText(page, `Reads as ${shown}`)).toBeVisible();
      await expect(readsAs(page)).toHaveCount(1);
    });
  }

  test('typing "1234.5" key by key updates the feedback on each key, and hides it on the invalid "1234."', async ({
    page,
  }) => {
    await openForm(page);
    const field = amountField(page);
    const steps: readonly [string, string | null][] = [
      ["1", "Reads as $1.00"],
      ["2", "Reads as $12.00"],
      ["3", "Reads as $123.00"],
      ["4", "Reads as $1,234.00"],
      [".", null], // "1234." isn't valid (T1.4 rules)
      ["5", "Reads as $1,234.50"],
    ];
    for (const [key, expected] of steps) {
      await field.press(key);
      if (expected === null) await expect(readsAs(page), `after "${key}"`).toHaveCount(0);
      else await expect(exactText(page, expected), `after "${key}"`).toBeVisible();
    }
  });

  test("with the amount empty, no \"Reads as\" text is shown", async ({ page }) => {
    await openForm(page);
    await expect(readsAs(page)).toHaveCount(0);
  });

  test('changing a valid "12.5" to the invalid "12.505" removes the feedback (no stale value)', async ({ page }) => {
    await openForm(page);
    await amountField(page).fill("12.5");
    await expect(exactText(page, "Reads as $12.50")).toBeVisible();
    await amountField(page).fill("12.505");
    await expect(readsAs(page)).toHaveCount(0);
  });

  test('the "Reads as" feedback is linked to the Amount field by aria-describedby', async ({ page }) => {
    await openForm(page);
    await amountField(page).fill("1234.5");
    await expect(exactText(page, "Reads as $1,234.50")).toBeVisible();
    expect(await describedByTexts(amountField(page))).toContain("Reads as $1,234.50");
  });

  test("typing an invalid amount shows no error until Save is pressed", async ({ page }) => {
    await openForm(page);
    await amountField(page).fill("-5");
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toHaveCount(0);
    await expect(amountField(page)).not.toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("the amount's feedback on a US-English device", () => {
  test.use({ locale: "en-US" });

  test('"1234.5" shows "Reads as A$1,234.50"', async ({ page }) => {
    await openForm(page);
    await amountField(page).fill("1234.5");
    await expect(exactText(page, "Reads as A$1,234.50")).toBeVisible();
  });
});

test.describe("rejected amounts", () => {
  for (const { typed, error, why } of INVALID_AMOUNTS) {
    test(`"${typed}" (${why}): Save shows exactly "${error}"`, async ({ page }, testInfo) => {
      await openForm(page);
      await fillForm(page, { amount: typed, category: "Printing" });
      await press(saveButton(page), touch(testInfo));
      await expect(exactText(page, error)).toBeVisible();
    });

    test(`"${typed}" (${why}): the Amount field gets aria-invalid="true" and aria-describedby points at the error`, async ({
      page,
    }, testInfo) => {
      await openForm(page);
      await fillForm(page, { amount: typed, category: "Printing" });
      await press(saveButton(page), touch(testInfo));
      await expect(amountField(page)).toHaveAttribute("aria-invalid", "true");
      expect(await describedByTexts(amountField(page))).toContain(error);
    });

    test(`"${typed}" (${why}): Save is blocked: the form stays open and Home's expenses stay $0.00`, async ({
      page,
    }, testInfo) => {
      await openForm(page);
      await fillForm(page, { amount: typed, category: "Printing" });
      await press(saveButton(page), touch(testInfo));
      await expect(exactText(page, error)).toBeVisible();
      await expect(page).toHaveURL(urlWithPath(FORM_PATH));
      await goToTab(page, "Home", "/", touch(testInfo));
      await expectHomeLine(page, HOME_EMPTY_EXPENSES); // CHANGED (T1.18)
    });

    test(`"${typed}" (${why}): no "Reads as" text is shown`, async ({ page }, testInfo) => {
      await openForm(page);
      await fillForm(page, { amount: typed, category: "Printing" });
      await press(saveButton(page), touch(testInfo));
      await expect(exactText(page, error)).toBeVisible();
      await expect(readsAs(page)).toHaveCount(0);
    });
  }

  test("after a blocked Save, focus moves to the Amount field", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "10.505", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(amountField(page)).toBeFocused();
  });

  test('fixing the amount after an error removes the error and aria-invalid, and shows "Reads as $10.50"', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "10.505", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toBeVisible();
    await amountField(page).fill("10.50");
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toHaveCount(0);
    await expect(amountField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(exactText(page, "Reads as $10.50")).toBeVisible();
  });

  test("an error goes from empty to invalid as the text changes after Save", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toBeVisible();
    await amountField(page).fill("abc");
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toBeVisible();
    await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toHaveCount(0);
  });
});

test.describe("a missing category", () => {
  test(`Save with no category shows exactly "${ERROR_CATEGORY}"`, async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "5" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CATEGORY)).toBeVisible();
  });

  test('the Category field gets aria-invalid="true" and aria-describedby points at its error', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "5" });
    await press(saveButton(page), touch(testInfo));
    await expect(categoryField(page)).toHaveAttribute("aria-invalid", "true");
    expect(await describedByTexts(categoryField(page))).toContain(ERROR_CATEGORY);
  });

  test("Save with no category is blocked and focus moves to Category", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "5" });
    await press(saveButton(page), touch(testInfo));
    await expect(categoryField(page)).toBeFocused();
    await expect(page).toHaveURL(urlWithPath(FORM_PATH));
  });

  test("with both the amount and the category missing, both errors show and focus goes to Amount (first in order)", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toBeVisible();
    await expect(exactText(page, ERROR_CATEGORY)).toBeVisible();
    await expect(amountField(page)).toBeFocused();
  });

  test("choosing a category after the error removes it", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "5" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CATEGORY)).toBeVisible();
    await fillForm(page, { category: "Software" });
    await expect(exactText(page, ERROR_CATEGORY)).toHaveCount(0);
    await expect(categoryField(page)).not.toHaveAttribute("aria-invalid", "true");
  });
});

// ═══ 5. The event prompt (F6) ═══════════════════════════════════════════════

test.describe("the event prompt", () => {
  test("there is no Event field before a category is chosen", async ({ page }) => {
    await openForm(page);
    await expect(eventField(page)).toHaveCount(0);
  });

  for (const category of EVENT_VENUE) {
    test(`choosing "${category}" (event & venue) shows the Event field`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { category });
      await expect(eventField(page)).toBeVisible();
    });
  }

  for (const category of [...PRODUCTION, ...OPERATING]) {
    test(`choosing "${category}" (production or operating) shows no Event field`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { category });
      await expect(categoryField(page)).toHaveValue(/.+/);
      await expect(eventField(page)).toHaveCount(0);
    });
  }

  test('the Event field offers "Not assigned yet" then the three pretend events, in that order', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Stall or table fees" });
    const options = await eventField(page).evaluate((select) =>
      Array.from((select as HTMLSelectElement).options).map((o) => (o.textContent ?? "").trim()),
    );
    expect(options).toEqual([...EVENT_OPTIONS]);
  });

  test('the Event field starts on "Not assigned yet"', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Flights" });
    const selected = await eventField(page).evaluate(
      (el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? null,
    );
    expect(selected).toBe(NOT_ASSIGNED);
  });

  test("switching from an event & venue category to a production one removes the Event field", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Accommodation" });
    await expect(eventField(page)).toBeVisible();
    await fillForm(page, { category: "Packaging" });
    await expect(eventField(page)).toHaveCount(0);
  });

  test("saving an event & venue expense with an event chosen returns Home and counts it", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, {
      amount: "$1,234.50",
      category: "Accommodation",
      event: "Pretend comic convention",
    });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $1,234.50"); // CHANGED (T1.18): was "Today's expenses: $1,234.50"
  });

  test('saving an event & venue expense left on "Not assigned yet" returns Home and counts it', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "60", category: "Stall or table fees" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $60.00"); // CHANGED (T1.18): was "Today's expenses: $60.00"
  });

  test("picking an event, then switching to a production category, saves without the hidden event", async ({
    page,
  }, testInfo) => {
    // The store refuses an event on a production expense (guide §7), so a
    // form that still sent the hidden choice would fail to save here.
    await openForm(page);
    await fillForm(page, { amount: "12", category: "Meals", event: "Pretend weekend market (today)" });
    await fillForm(page, { category: "Art materials" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $12.00"); // CHANGED (T1.18): was "Today's expenses: $12.00"
  });
});

// ═══ 6. Saving (F7) ═════════════════════════════════════════════════════════

test.describe("saving a valid expense", () => {
  test("Save returns to Home", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { supplier: "Officeworks", amount: "23.50", category: "Printing" });
    await saveAndExpectHome(page, touch(testInfo));
  });

  test(`Home then says exactly "Expenses $23.50", and the Income line is unchanged (CHANGED (T1.18))`, async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { supplier: "Officeworks", amount: "23.50", category: "Printing" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $23.50"); // CHANGED (T1.18): was "Today's expenses: $23.50"
    await expectHomeLine(page, HOME_EMPTY_SALES); // CHANGED (T1.18)
  });

  test("the new expense adds to entries already in the store: $56.49 + $23.50 = $79.99", async ({
    page,
  }, testInfo) => {
    await open(page, "/");
    // 2350 + 3299 = 5649; + 2350 typed in the form = 7999 → $79.99.
    await seedExpenses(page, [
      { date: SYDNEY_TODAY, amountCents: 2350, categoryId: "printing", supplier: "Officeworks" },
      { date: SYDNEY_TODAY, amountCents: 3299, categoryId: "software", supplier: "Adobe" },
    ]);
    await expectHomeLine(page, "Expenses $56.49"); // CHANGED (T1.18): was "Today's expenses: $56.49"
    await pressExpenseControl(page, touch(testInfo));
    await waitForForm(page);
    await fillForm(page, { amount: "23.50", category: "Packaging" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $79.99"); // CHANGED (T1.18): was "Today's expenses: $79.99"
  });

  test("two expenses through the form add up exactly: $1,234.50 + $0.50 = $1,235.00", async ({
    page,
  }, testInfo) => {
    await openFormFromHome(page, touch(testInfo));
    await fillForm(page, { amount: "1,234.50", category: "Equipment" });
    await saveAndExpectHome(page, touch(testInfo));
    await pressExpenseControl(page, touch(testInfo));
    await waitForForm(page);
    await fillForm(page, { amount: "0.5", category: "Phone" });
    await saveAndExpectHome(page, touch(testInfo));
    // 123450 + 50 = 123500 cents.
    await expectHomeLine(page, "Expenses $1,235.00"); // CHANGED (T1.18): was "Today's expenses: $1,235.00"
  });

  test("a $0.00 expense can be saved and is listed as $0.00", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "0", category: "Website" });
    await saveAndExpectHome(page, touch(testInfo));
    await goToExpenses(page); // CHANGED (T1.17b): was Transactions
    await expect(rows(page)).toHaveCount(1);
    expect(await rowLines(rows(page).first())).toEqual(["01/07/2026", "Website", "$0.00"]);
  });

  // CHANGED (T1.17b): was "on Transactions the new row shows Expense, the supplier, $23.50 and
  // today's date". On the Expenses tab there's no "Expense" label (see the header).
  test("on the Expenses tab the new row reads exactly 01/07/2026, Printing, Officeworks, $23.50", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { supplier: "Officeworks", amount: "23.50", category: "Printing" });
    await saveAndExpectHome(page, touch(testInfo));
    await goToExpenses(page);
    await expect(rows(page)).toHaveCount(1);
    expect(await rowLines(rows(page).first())).toEqual(["01/07/2026", "Printing", "Officeworks", "$23.50"]);
  });

  // CHANGED (T1.17b): the category is always shown now; a blank supplier leaves no line.
  test("a blank supplier is listed by its category name, with no supplier line", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "150", category: "Accommodation" });
    await saveAndExpectHome(page, touch(testInfo));
    await goToExpenses(page);
    await expect(rows(page)).toHaveCount(1);
    expect(await rowLines(rows(page).first())).toEqual(["01/07/2026", "Accommodation", "$150.00"]);
  });

  test('a supplier of only spaces counts as blank: the row shows "Merch manufacturing"', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { supplier: "    ", amount: "40", category: "Merch manufacturing" });
    await saveAndExpectHome(page, touch(testInfo));
    await goToExpenses(page); // CHANGED (T1.17b): exact lines, so no blank supplier line
    await expect(rows(page)).toHaveCount(1);
    expect(await rowLines(rows(page).first())).toEqual(["01/07/2026", "Merch manufacturing", "$40.00"]);
  });

  test('a supplier typed as "  Officeworks  " is listed trimmed', async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { supplier: "  Officeworks  ", amount: "23.50", category: "Printing", notes: "  A3 prints  " });
    await saveAndExpectHome(page, touch(testInfo));
    await goToExpenses(page); // CHANGED (T1.17b): was Transactions; the notes now show too, trimmed
    await expect(rows(page)).toHaveCount(1);
    expect(await rowLines(rows(page).first())).toEqual(["01/07/2026", "Printing", "Officeworks", "A3 prints", "$23.50"]);
    const raw = await rows(page).first().evaluate((el) => el.textContent ?? "");
    expect(raw).not.toContain(" A3 prints ");
    expect(raw).toContain("Officeworks");
    expect(raw).not.toContain(" Officeworks ");
  });

  test("double-clicking Save adds exactly one expense", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { amount: "23.50", category: "Printing" });
    await saveButton(page).dblclick();
    await expect(page).toHaveURL(urlWithPath("/"));
    await expectHomeLine(page, "Expenses $23.50"); // CHANGED (T1.18): was "Today's expenses: $23.50"
  });

  test("pressing Enter in the Amount field saves (the phone keyboard's Go key)", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { amount: "7.25", category: "Marketing" });
    await amountField(page).press("Enter");
    await expect(page).toHaveURL(urlWithPath("/"));
    await expectHomeLine(page, "Expenses $7.25"); // CHANGED (T1.18): was "Today's expenses: $7.25"
  });

  test("opening the form again after a save shows a fresh form", async ({ page }, testInfo) => {
    await openFormFromHome(page, touch(testInfo));
    await fillForm(page, { date: "2026-06-20", supplier: "Officeworks", amount: "23.50", category: "Parking", notes: "x" });
    await saveAndExpectHome(page, touch(testInfo));
    await pressExpenseControl(page, touch(testInfo));
    await waitForForm(page);
    await expect(dateField(page)).toHaveValue(SYDNEY_TODAY);
    await expect(supplierField(page)).toHaveValue("");
    await expect(amountField(page)).toHaveValue("");
    await expect(categoryField(page)).toHaveValue("");
    await expect(notesField(page)).toHaveValue("");
    await expect(eventField(page)).toHaveCount(0);
    await expect(readsAs(page)).toHaveCount(0);
  });

  test("Cancel returns to Home and adds nothing", async ({ page }, testInfo) => {
    await openFormFromHome(page, touch(testInfo));
    await fillForm(page, { amount: "23.50", category: "Printing" });
    await press(cancelLink(page), touch(testInfo));
    await expect(page).toHaveURL(urlWithPath("/"));
    await expectHomeLine(page, HOME_EMPTY_EXPENSES); // CHANGED (T1.18)
  });
});

// ═══ 7. Layout and access on a phone (F8) ═══════════════════════════════════

test.describe("on a phone, the form is comfortable to use", () => {
  test("on a phone, every field, Save and Cancel are at least 44×44 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    await fillForm(page, { category: "Parking" });
    const controls: [string, Locator][] = [
      [LABEL_DATE, dateField(page)],
      [LABEL_SUPPLIER, supplierField(page)],
      [LABEL_AMOUNT, amountField(page)],
      [LABEL_CATEGORY, categoryField(page)],
      [LABEL_EVENT, eventField(page)],
      [LABEL_STREAM, streamField(page)], // T1.13
      [LABEL_NOTES, notesField(page)],
      ["Save", saveButton(page)],
      ["Cancel", cancelLink(page)],
    ];
    const small: string[] = [];
    for (const [name, control] of controls) {
      const b = await control.boundingBox();
      if (b === null || b.width < MIN_TAP_TARGET_PX || b.height < MIN_TAP_TARGET_PX) {
        small.push(`${name}: ${b === null ? "not rendered" : `${b.width.toFixed(1)}×${b.height.toFixed(1)}`}`);
      }
    }
    expect(small, "controls smaller than 44×44 px").toEqual([]);
  });

  test("on a phone, text in every field is at least 16 px (so iPhones don't zoom in)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    await fillForm(page, { category: "Parking" });
    const sizes = await main(page).evaluate((m) =>
      Array.from(m.querySelectorAll('input:not([type="hidden"]), select, textarea')).map((el) => ({
        label: ((el as HTMLInputElement).labels?.[0]?.innerText ?? el.tagName).replace(/\s+/g, " ").trim(),
        px: parseFloat(getComputedStyle(el).fontSize),
      })),
    );
    // CHANGED (T1.13): 7 with Parking (Date, Supplier, Amount, Category, Event, Income stream, Notes).
    expect(sizes.length, "fields found").toBe(7);
    const tooSmall = sizes.filter((s) => s.px < MIN_INPUT_FONT_PX).map((s) => `${s.label}: ${s.px}px`);
    expect(tooSmall).toEqual([]);
  });

  test("on a phone at 390×844, scrolled to the bottom, the form ends at or above the nav's top edge", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    await fillForm(page, { category: "Parking" });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await nextFrame(page);
    const lowest = await main(page).evaluate((m) =>
      Math.max(...Array.from(m.querySelectorAll("*")).map((el) => el.getBoundingClientRect().bottom)),
    );
    const nav = await mainNav(page).boundingBox();
    expect(nav).not.toBeNull();
    expect(lowest, "lowest point of <main>'s content vs the nav's top (px)").toBeLessThanOrEqual(
      nav!.y + EDGE_TOLERANCE_PX,
    );
  });

  test("on a phone at 390×844, Tab through the form keeps each focused element clear of the nav", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    await fillForm(page, { category: "Parking" });
    await startTabbingFromTheTop(page);
    await expectTabKeepsMainFocusClearOfNav(page);
  });
});

test.describe("on a phone at 320×568 with 200% text", () => {
  const NARROW = { width: 320, height: 568 } as const;

  /** Opens the form at 320×568, 200% text, with the Event field and an error showing. */
  async function openBigTextFormWithError(page: Page, hasTouch: boolean): Promise<void> {
    await page.setViewportSize(NARROW);
    await openForm(page);
    await setTextSize(page, 200, "32px");
    await fillForm(page, { amount: "10.505", category: "Accommodation" });
    await saveButton(page).scrollIntoViewIfNeeded();
    await press(saveButton(page), hasTouch);
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toBeVisible();
    await expect(eventField(page)).toBeVisible();
  }

  test("on a phone at 320×568 and 200% text, the form doesn't scroll sideways", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openBigTextFormWithError(page, touch(testInfo));
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(clientWidth).toBe(NARROW.width);
    expect(scrollWidth, "scrollable width must not exceed the page width").toBeLessThanOrEqual(clientWidth);
  });

  test("on a phone at 320×568 and 200% text, every label, field, message and button stays inside 0–320 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openBigTextFormWithError(page, touch(testInfo));
    const outside = await main(page).evaluate((m, width) => {
      const bad: string[] = [];
      for (const el of Array.from(m.querySelectorAll("label, input, select, textarea, button, a, p, h1"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.left < -1 || r.right > width + 1) {
          bad.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 25)}": ${r.left.toFixed(1)}–${r.right.toFixed(1)}`);
        }
      }
      return bad;
    }, NARROW.width);
    expect(outside).toEqual([]);
  });

  test("on a phone at 320×568 and 200% text, Tab never leaves a focused element hidden or under the nav", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openBigTextFormWithError(page, touch(testInfo));
    await startTabbingFromTheTop(page);
    await expectTabKeepsMainFocusClearOfNav(page);
  });

  test("on a phone at 320×568 and 200% text, a valid expense can still be saved and counted on Home", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize(NARROW);
    await openForm(page);
    await setTextSize(page, 200, "32px");
    await fillForm(page, { supplier: "Officeworks", amount: "23.50", category: "Printing" });
    await saveButton(page).scrollIntoViewIfNeeded();
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $23.50"); // CHANGED (T1.18): was "Today's expenses: $23.50"
  });
});

// ═══ 8. Carried over from T1.6 (F9) ═════════════════════════════════════════

test.describe("items carried over from T1.6", () => {
  test(`Home no longer says "${HOME_NOTE_OLD}"`, async ({ page }) => {
    await open(page, "/");
    await waitForHydration(page);
    await expect(main(page)).not.toContainText(HOME_NOTE_OLD);
  });

  test(`Home's note says exactly "${HOME_NOTE_NEW}"`, async ({ page }) => {
    await open(page, "/");
    await expect(exactText(page, HOME_NOTE_NEW)).toHaveCount(1);
    await expect(exactText(page, HOME_NOTE_NEW)).toBeVisible();
  });

  // CHANGED (T1.17b): 'the Transactions entries list has role="list"' is retired with the
  // page. The Expenses tab's list has no role="list" today; whether it should is a
  // question for the lead (it would be a new requirement on the T1.17 lists).

  test('the bottom navigation\'s list has role="list"', async ({ page }) => {
    await open(page, "/");
    await expect(mainNav(page).locator("ul, ol")).toHaveCount(1);
    await expect(mainNav(page).locator("ul, ol")).toHaveAttribute("role", "list");
  });
});

// ═══ T1.13a. "Reads as" is not a live region (lead's decision) ══════════════

/**
 * Describes every live region among `el` and its ancestors: aria-live other
 * than "off", a live role (status, log, alert, marquee, timer), or <output>.
 * An empty list means nothing announces changes to this element on its own.
 */
function liveSelfOrAncestors(locator: Locator): Promise<string[]> {
  return locator.evaluate((el) => {
    const found: string[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      const live = node.getAttribute("aria-live");
      const role = node.getAttribute("role");
      if (
        (live !== null && live !== "off") ||
        ["status", "log", "alert", "marquee", "timer"].includes(role ?? "") ||
        node.tagName === "OUTPUT"
      ) {
        found.push(`${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""} aria-live=${live} role=${role}`);
      }
    }
    return found;
  });
}

/** Describes every live region inside (or being) the element. */
function liveRegionsWithin(locator: Locator): Promise<string[]> {
  return locator.evaluate((root) =>
    [root, ...Array.from(root.querySelectorAll("*"))]
      .filter((node) => {
        const live = node.getAttribute("aria-live");
        const role = node.getAttribute("role");
        return (
          (live !== null && live !== "off") ||
          ["status", "log", "alert", "marquee", "timer"].includes(role ?? "") ||
          node.tagName === "OUTPUT"
        );
      })
      .map((node) => `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""} "${(node.textContent ?? "").trim()}"`),
  );
}

test.describe("T1.13a: the Amount's \"Reads as\" is not a live region", () => {
  test('"Reads as $12.50" has no live region on itself or any ancestor', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { amount: "12.5" });
    await expect(exactText(page, "Reads as $12.50")).toBeVisible();
    expect(await liveSelfOrAncestors(exactText(page, "Reads as $12.50"))).toEqual([]);
  });

  test("the form holds no live region, with the amount empty or valid", async ({ page }) => {
    await openForm(page);
    const form = main(page).locator("form");
    await expect(form).toHaveCount(1);
    expect(await liveRegionsWithin(form), "live regions with the amount empty").toEqual([]);
    await fillForm(page, { amount: "12.5", category: "Parking" });
    await expect(exactText(page, "Reads as $12.50")).toBeVisible();
    expect(await liveRegionsWithin(form), "live regions with a valid amount").toEqual([]);
  });

  test('the Amount field\'s accessible description includes "Reads as $12.50"', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { amount: "12.5" });
    await expect(amountField(page)).toHaveAccessibleDescription(/(^|\s)Reads as \$12\.50(\s|$)/);
  });
});

// ═══ T1.13. Income stream, production note, pre-fill, safe back (F11–F16) ══

const NO_STREAM = "No stream";
// INCOME_STREAMS (src/lib/pretend-data.ts), written out by hand, in order.
const STREAM_NAMES = [
  "Sales at events",
  "Online sales",
  "Wholesale",
  "Commissions",
  "Vendor shelf rental",
  "Social media",
  "Subscription income",
] as const;
const PRODUCTION_NOTE = "Production costs aren't linked to an event or stream.";
const COMIC_CON = "Pretend comic convention";
const MARKET = "Pretend weekend market (today)";
const SHELF = "Pretend gallery shelf";

/** The text of a <select>'s selected option. */
function selectedOptionText(select: Locator): Promise<string | null> {
  return select.evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? null);
}

/** Opens the form with a query string (full load) and waits until it's ready. */
async function openFormWith(page: Page, query: string): Promise<void> {
  await open(page, FORM_PATH + query);
  await waitForForm(page);
}

/** Matches a full URL on THIS server (the page's current origin) whose path is exactly `path`. */
function urlOnThisServer(page: Page, path: string): RegExp {
  const origin = new URL(page.url()).origin;
  return new RegExp(`^${escapeRegExp(origin)}${escapeRegExp(path)}$`);
}

/** A client-side move (no reload) through Next.js's router, as goToExpenses does. */
async function goClientSide(page: Page, href: string): Promise<void> {
  const origin = new URL(page.url()).origin;
  await page.evaluate((target) => {
    (window as unknown as Record<string, unknown>).__t113SameDocument = true;
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(target);
  }, href);
  const wanted = new URL(href, origin);
  const decoded = (u: URL) => ({ origin: u.origin, path: u.pathname, query: Array.from(u.searchParams.entries()) });
  await expect.poll(() => decoded(new URL(page.url())), { message: `address after moving to ${href}` }).toEqual(
    decoded(wanted),
  );
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).__t113SameDocument),
    `the move to ${href} didn't reload the page`,
  ).toBe(true);
}

/** Checks no error message and no aria-invalid is anywhere in <main>. */
async function expectNoFormErrors(page: Page): Promise<void> {
  for (const message of [ERROR_AMOUNT_EMPTY, ERROR_AMOUNT_INVALID, ERROR_CATEGORY, ERROR_DATE]) {
    await expect(exactText(page, message)).toHaveCount(0);
  }
  await expect(main(page).locator('[aria-invalid="true"]')).toHaveCount(0);
}

// ─── F11. The Income stream field ───────────────────────────────────────────

test.describe("T1.13: the Income stream field", () => {
  test("there is no Income stream field before a category is chosen", async ({ page }) => {
    await openForm(page);
    await expect(streamField(page)).toHaveCount(0);
  });

  for (const category of [...EVENT_VENUE, ...OPERATING]) {
    test(`choosing "${category}" shows the Income stream field`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { category });
      await expect(streamField(page)).toBeVisible();
    });
  }

  for (const category of PRODUCTION) {
    test(`choosing "${category}" (production) shows no Income stream field`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { category });
      await expect(categoryField(page)).toHaveValue(/.+/);
      await expect(streamField(page)).toHaveCount(0);
    });
  }

  test('the Income stream field has exactly one visible <label> reading "Income stream (optional)"', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { category: "Software" });
    await expect(streamField(page)).toHaveCount(1);
    const facts = await streamField(page).evaluate((el) => {
      const labels = Array.from((el as HTMLSelectElement).labels ?? []);
      labels.forEach((l) => l.setAttribute("data-stream-label", "yes"));
      return { tag: el.tagName, labels: labels.map((l) => l.innerText.replace(/\s+/g, " ").trim()) };
    });
    expect(facts).toEqual({ tag: "SELECT", labels: [LABEL_STREAM] });
    await expect(main(page).locator('label[data-stream-label="yes"]')).toBeVisible();
  });

  test('the Income stream field offers "No stream", then the seven streams in the guide\'s order, with no groups', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { category: "Software" });
    const facts = await streamField(page).evaluate((el) => ({
      options: Array.from((el as HTMLSelectElement).options).map((o) => (o.textContent ?? "").trim()),
      optgroups: el.querySelectorAll("optgroup").length,
    }));
    expect(facts).toEqual({ options: [NO_STREAM, ...STREAM_NAMES], optgroups: 0 });
  });

  test('the Income stream field starts on "No stream" (value "")', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Stall or table fees" });
    await expect(streamField(page)).toHaveValue("");
    expect(await selectedOptionText(streamField(page))).toBe(NO_STREAM);
  });

  test("with an operating category, Tab goes Category, then Income stream, then Notes", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Software" });
    await dateField(page).focus();
    expect(await tabOrderInMain(page)).toEqual([
      LABEL_DATE,
      LABEL_SUPPLIER,
      LABEL_AMOUNT,
      LABEL_CATEGORY,
      LABEL_STREAM,
      LABEL_NOTES,
      "Save",
      "Cancel",
    ]);
  });

  test("with a production category, Tab goes Category, then Notes (nothing in between)", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Printing" });
    await dateField(page).focus();
    expect(await tabOrderInMain(page)).toEqual([
      LABEL_DATE,
      LABEL_SUPPLIER,
      LABEL_AMOUNT,
      LABEL_CATEGORY,
      LABEL_NOTES,
      "Save",
      "Cancel",
    ]);
  });

  test("an event & venue cost with an event and a stream saves (no page error) and is counted on Home", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "60", category: "Stall or table fees", event: COMIC_CON });
    await streamField(page).selectOption({ label: "Sales at events" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $60.00"); // CHANGED (T1.18): was "Today's expenses: $60.00"
  });

  for (const stream of STREAM_NAMES) {
    test(`an operating cost tagged "${stream}" saves (no page error) and is counted on Home`, async ({
      page,
    }, testInfo) => {
      await openForm(page);
      await fillForm(page, { amount: "9.99", category: "Software" });
      await streamField(page).selectOption({ label: stream });
      await saveAndExpectHome(page, touch(testInfo));
      await expectHomeLine(page, "Expenses $9.99"); // CHANGED (T1.18): was "Today's expenses: $9.99"
    });
  }

  // CHANGED (T1.17b): was "listed on Transactions as Software, $9.99". Exact lines, so
  // "No stream" really saved no stream (there's no stream line).
  test('an operating cost left on "No stream" saves and is listed on the Expenses tab as Software, $9.99, with no stream', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "9.99", category: "Software" });
    await saveAndExpectHome(page, touch(testInfo));
    await goToExpenses(page);
    await expect(rows(page)).toHaveCount(1);
    expect(await rowLines(rows(page).first())).toEqual(["01/07/2026", "Software", "$9.99"]);
  });
});

// ─── F12. The production note ───────────────────────────────────────────────

test.describe("T1.13: the production note", () => {
  for (const category of PRODUCTION) {
    test(`choosing "${category}" shows exactly "${PRODUCTION_NOTE}"`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { category });
      await expect(exactText(page, PRODUCTION_NOTE)).toHaveCount(1);
      await expect(exactText(page, PRODUCTION_NOTE)).toBeVisible();
    });
  }

  test("the production note is part of the Category field's description", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Printing" });
    expect(await describedByTexts(categoryField(page))).toContain(PRODUCTION_NOTE);
  });

  test("with no category, there is no production note", async ({ page }) => {
    await openForm(page);
    await expect(exactText(page, PRODUCTION_NOTE)).toHaveCount(0);
  });

  for (const category of [...EVENT_VENUE, ...OPERATING]) {
    test(`choosing "${category}" shows no production note`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { category });
      await expect(categoryField(page)).toHaveValue(/.+/);
      await expect(exactText(page, PRODUCTION_NOTE)).toHaveCount(0);
    });
  }

  test("switching from production to an event & venue category removes the note and shows Event and Income stream", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { category: "Packaging" });
    await expect(exactText(page, PRODUCTION_NOTE)).toBeVisible();
    await fillForm(page, { category: "Flights" });
    await expect(exactText(page, PRODUCTION_NOTE)).toHaveCount(0);
    await expect(eventField(page)).toBeVisible();
    await expect(streamField(page)).toBeVisible();
  });
});

// ─── F13. Hidden fields keep their value ────────────────────────────────────

test.describe("T1.13: hidden Event and Income stream keep their value", () => {
  test("pre-filled convention: Stall or table fees, then a production category, then Meals shows the convention and Sales at events again", async ({
    page,
  }) => {
    await openFormWith(page, "?event=pretend-event-comic-con");
    await fillForm(page, { category: "Stall or table fees" });
    await expect.poll(() => selectedOptionText(eventField(page))).toBe(COMIC_CON);
    await expect.poll(() => selectedOptionText(streamField(page))).toBe("Sales at events");
    await fillForm(page, { category: "Printing" });
    await expect(eventField(page)).toHaveCount(0);
    await expect(streamField(page)).toHaveCount(0);
    await expect(exactText(page, PRODUCTION_NOTE)).toBeVisible();
    await fillForm(page, { category: "Meals" });
    expect(await selectedOptionText(eventField(page))).toBe(COMIC_CON);
    expect(await selectedOptionText(streamField(page))).toBe("Sales at events");
  });

  test("chosen by the artist: Accommodation with the market and Wholesale, then Packaging, then Parking shows both again", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { category: "Accommodation", event: MARKET });
    await streamField(page).selectOption({ label: "Wholesale" });
    await fillForm(page, { category: "Packaging" });
    await expect(eventField(page)).toHaveCount(0);
    await fillForm(page, { category: "Parking" });
    expect(await selectedOptionText(eventField(page))).toBe(MARKET);
    expect(await selectedOptionText(streamField(page))).toBe("Wholesale");
  });

  test("an operating category hides only Event: the stream stays shown, and back on Flights the event is there again", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { category: "Accommodation", event: MARKET });
    await streamField(page).selectOption({ label: "Wholesale" });
    await fillForm(page, { category: "Software" });
    await expect(eventField(page)).toHaveCount(0);
    expect(await selectedOptionText(streamField(page))).toBe("Wholesale");
    await fillForm(page, { category: "Flights" });
    expect(await selectedOptionText(eventField(page))).toBe(MARKET);
  });

  test("an event and stream hidden by a production category are not saved (no page error)", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "12", category: "Meals", event: MARKET });
    await streamField(page).selectOption({ label: "Wholesale" });
    await fillForm(page, { category: "Art materials" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $12.00"); // CHANGED (T1.18): was "Today's expenses: $12.00"
  });

  test("an event hidden by an operating category is not saved (no page error), while the stream is", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "8", category: "Meals", event: MARKET });
    await streamField(page).selectOption({ label: "Online sales" });
    await fillForm(page, { category: "Marketing" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $8.00"); // CHANGED (T1.18): was "Today's expenses: $8.00"
  });
});

// ─── F14. Pre-fill from the page address ────────────────────────────────────

test.describe("T1.13: pre-fill from the page address", () => {
  test("pre-fill never chooses a category: ?event=pretend-event-shelf&stream=online-sales starts on \"Choose a category\"", async ({
    page,
  }) => {
    await openFormWith(page, "?event=pretend-event-shelf&stream=online-sales");
    await expect(categoryField(page)).toHaveValue("");
    await expect(eventField(page)).toHaveCount(0);
    await expect(streamField(page)).toHaveCount(0);
  });

  test("?event=pretend-event-shelf, then Vendor shelf rent: Event is the gallery shelf and the stream is Vendor shelf rental", async ({
    page,
  }) => {
    await openFormWith(page, "?event=pretend-event-shelf");
    await fillForm(page, { category: "Vendor shelf rent" });
    await expect.poll(() => selectedOptionText(eventField(page))).toBe(SHELF);
    await expect.poll(() => selectedOptionText(streamField(page))).toBe("Vendor shelf rental");
  });

  test("?event=pretend-event-comic-con, then Stall or table fees: Event is the convention and the stream is Sales at events", async ({
    page,
  }) => {
    await openFormWith(page, "?event=pretend-event-comic-con");
    await fillForm(page, { category: "Stall or table fees" });
    await expect.poll(() => selectedOptionText(eventField(page))).toBe(COMIC_CON);
    await expect.poll(() => selectedOptionText(streamField(page))).toBe("Sales at events");
  });

  test("?event=pretend-event-comic-con, then an operating category: no Event, the stream is Sales at events, and it saves without the event", async ({
    page,
  }, testInfo) => {
    await openFormWith(page, "?event=pretend-event-comic-con");
    await fillForm(page, { amount: "15", category: "Payment fees" });
    await expect(eventField(page)).toHaveCount(0);
    await expect.poll(() => selectedOptionText(streamField(page))).toBe("Sales at events");
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $15.00"); // CHANGED (T1.18): was "Today's expenses: $15.00"
  });

  test("?stream=online-sales, then Marketing: the stream is Online sales", async ({ page }) => {
    await openFormWith(page, "?stream=online-sales");
    await fillForm(page, { category: "Marketing" });
    await expect.poll(() => selectedOptionText(streamField(page))).toBe("Online sales");
  });

  test("?event=pretend-event-comic-con&stream=online-sales, then Stall or table fees: the convention, and the stream from ?stream (Online sales)", async ({
    page,
  }) => {
    await openFormWith(page, "?event=pretend-event-comic-con&stream=online-sales");
    await fillForm(page, { category: "Stall or table fees" });
    await expect.poll(() => selectedOptionText(eventField(page))).toBe(COMIC_CON);
    await expect.poll(() => selectedOptionText(streamField(page))).toBe("Online sales");
  });

  test("pre-filled event and stream, then a production category: the note shows and it saves without either (no page error)", async ({
    page,
  }, testInfo) => {
    await openFormWith(page, "?event=pretend-event-comic-con&stream=online-sales");
    await fillForm(page, { amount: "40", category: "Printing" });
    await expect(exactText(page, PRODUCTION_NOTE)).toBeVisible();
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $40.00"); // CHANGED (T1.18): was "Today's expenses: $40.00"
  });

  test("pre-filled event and stream save with an event & venue cost (no page error)", async ({ page }, testInfo) => {
    await openFormWith(page, "?event=pretend-event-shelf");
    await fillForm(page, { amount: "120", category: "Vendor shelf rent" });
    await expect.poll(() => selectedOptionText(eventField(page))).toBe(SHELF);
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $120.00"); // CHANGED (T1.18): was "Today's expenses: $120.00"
  });

  test("pre-fill works after a client-side move to the form too (?stream=wholesale)", async ({ page }) => {
    await open(page, "/");
    await waitForHydration(page);
    await goClientSide(page, `${FORM_PATH}?stream=wholesale`);
    await waitForForm(page);
    await fillForm(page, { category: "Website" });
    await expect.poll(() => selectedOptionText(streamField(page))).toBe("Wholesale");
  });

  const UNKNOWN: readonly { query: string; why: string; event: string; stream: string }[] = [
    { query: "?event=nope", why: "an unknown event", event: NOT_ASSIGNED, stream: NO_STREAM },
    { query: "?stream=nope", why: "an unknown stream", event: NOT_ASSIGNED, stream: NO_STREAM },
    { query: "?stream=Online%20sales", why: "a stream's name, not its id", event: NOT_ASSIGNED, stream: NO_STREAM },
    { query: "?event=nope&stream=wholesale", why: "an unknown event with a known stream", event: NOT_ASSIGNED, stream: "Wholesale" },
    { query: "?stream=nope&event=pretend-event-shelf", why: "an unknown stream counts as none, so the event brings its usual stream", event: SHELF, stream: "Vendor shelf rental" },
  ];
  for (const u of UNKNOWN) {
    test(`${u.query} (${u.why}) is handled silently: Event "${u.event}", stream "${u.stream}", no error`, async ({
      page,
    }) => {
      await openFormWith(page, u.query);
      await fillForm(page, { category: "Parking" });
      await expect.poll(() => selectedOptionText(eventField(page))).toBe(u.event);
      await expect.poll(() => selectedOptionText(streamField(page))).toBe(u.stream);
      await expectNoFormErrors(page);
    });
  }
});

// ─── F15. Where Save and Cancel go ──────────────────────────────────────────

test.describe("T1.13: the safe back address", () => {
  test.beforeEach(async ({ page }) => {
    // Never let a wrong redirect reach another host.
    await page.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => route.abort());
  });

  const OVER_LIMIT = "/" + "a".repeat(200); // 1 + 200 = 201 characters

  test('with no back, Cancel is a link to "/" and Save goes Home', async ({ page }, testInfo) => {
    await openForm(page);
    await expect(cancelLink(page)).toHaveAttribute("href", "/");
    await fillForm(page, { amount: "5", category: "Printing" });
    await saveAndExpectHome(page, touch(testInfo));
  });

  test("with back=/events, Save goes to Events and the expense is kept", async ({ page }, testInfo) => {
    await open(page, "/");
    await waitForHydration(page);
    await goClientSide(page, `${FORM_PATH}?back=${encodeURIComponent("/events")}`);
    await waitForForm(page);
    await fillForm(page, { amount: "5", category: "Printing" });
    const target = urlOnThisServer(page, "/events");
    await press(saveButton(page), touch(testInfo));
    await expect(page).toHaveURL(target);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Events");
    await goToExpenses(page); // CHANGED (T1.17b): was Transactions
    await expect(rows(page)).toHaveCount(1);
  });

  test('with back=/events, Cancel is a link to "/events"', async ({ page }) => {
    await openFormWith(page, `?back=${encodeURIComponent("/events")}`);
    await expect(cancelLink(page)).toHaveAttribute("href", "/events");
  });

  test("with back=/events, Cancel goes to Events and adds nothing", async ({ page }, testInfo) => {
    await openFormWith(page, `?back=${encodeURIComponent("/events")}`);
    await fillForm(page, { amount: "5", category: "Printing" });
    await press(cancelLink(page), touch(testInfo));
    await expect(page).toHaveURL(urlOnThisServer(page, "/events"));
    // CHANGED (T1.17b): the Expenses tab's empty state, was Transactions' "No entries yet.".
    await goToExpenses(page);
    await expect(exactText(page, "No expenses yet.")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  });

  for (const [value, why] of [
    ["//evil.example", "another site"],
    [OVER_LIMIT, "201 characters, over the cap"],
  ] as const) {
    test(`with back set to ${why}, Save goes to Home on this server`, async ({ page }, testInfo) => {
      await openFormWith(page, `?back=${encodeURIComponent(value)}`);
      await fillForm(page, { amount: "5", category: "Printing" });
      const home = urlOnThisServer(page, "/");
      await press(saveButton(page), touch(testInfo));
      await expect(page).toHaveURL(home);
      await expectHomeLine(page, "Expenses $5.00"); // CHANGED (T1.18): was "Today's expenses: $5.00"
    });

    test(`with back set to ${why}, Cancel is a link to "/"`, async ({ page }) => {
      await openFormWith(page, `?back=${encodeURIComponent(value)}`);
      await expect(cancelLink(page)).toHaveAttribute("href", "/");
    });
  }

  test("Save replaces the form in the history: Back afterwards goes to the page before the form, with the expense kept", async ({
    page,
  }, testInfo) => {
    await open(page, "/");
    await waitForHydration(page);
    await goClientSide(page, `${FORM_PATH}?back=${encodeURIComponent("/events")}`);
    await waitForForm(page);
    await fillForm(page, { amount: "5", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(page).toHaveURL(urlOnThisServer(page, "/events"));
    await page.goBack();
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");
    await expectHomeLine(page, "Expenses $5.00"); // CHANGED (T1.18): was "Today's expenses: $5.00"
  });
});

// ─── F16. The old rules still hold with the new fields ──────────────────────

test.describe("T1.13: the old rules with the new fields", () => {
  test("a pre-filled form shows no errors before Save, and Save with no category focuses Category", async ({
    page,
  }, testInfo) => {
    await openFormWith(page, "?event=pretend-event-comic-con&stream=online-sales");
    await fillForm(page, { amount: "5" });
    await expectNoFormErrors(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CATEGORY)).toBeVisible();
    await expect(categoryField(page)).toBeFocused();
  });

  test("a blocked Save keeps the chosen stream, and focus goes to Amount (first bad field)", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "10.505", category: "Software" });
    await streamField(page).selectOption({ label: "Commissions" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toBeVisible();
    await expect(amountField(page)).toBeFocused();
    expect(await selectedOptionText(streamField(page))).toBe("Commissions");
    await expect(streamField(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  test("double-clicking Save with an event and a stream adds exactly one expense", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { amount: "23.50", category: "Meals", event: MARKET });
    await streamField(page).selectOption({ label: "Sales at events" });
    await saveButton(page).dblclick();
    await expect(page).toHaveURL(urlWithPath("/"));
    await expectHomeLine(page, "Expenses $23.50"); // CHANGED (T1.18): was "Today's expenses: $23.50"
  });

  const NARROW = { width: 320, height: 568 } as const;
  const SHAPES: readonly { name: string; category: string | null; check: (page: Page) => Promise<void> }[] = [
    { name: "no category", category: null, check: async (page) => expect(streamField(page)).toHaveCount(0) },
    {
      name: "event & venue with Event and Income stream",
      category: "Accommodation",
      check: async (page) => {
        await expect(eventField(page)).toBeVisible();
        await expect(streamField(page)).toBeVisible();
      },
    },
    {
      name: "production with the note",
      category: "Printing",
      check: async (page) => expect(exactText(page, PRODUCTION_NOTE)).toBeVisible(),
    },
  ];

  for (const shape of SHAPES) {
    /** Opens the form at 320×568 and 200% text in this shape. */
    const openShape = async (page: Page) => {
      await page.setViewportSize(NARROW);
      await openForm(page);
      await setTextSize(page, 200, "32px");
      if (shape.category !== null) await fillForm(page, { category: shape.category });
      await shape.check(page);
    };

    test(`on a phone at 320×568 and 200% text (${shape.name}), the form doesn't scroll sideways`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openShape(page);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(clientWidth).toBe(NARROW.width);
      expect(scrollWidth, "scrollable width must not exceed the page width").toBeLessThanOrEqual(clientWidth);
    });

    test(`on a phone at 320×568 and 200% text (${shape.name}), every label, field, note and button stays inside 0–320 px`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openShape(page);
      const outside = await main(page).evaluate((m, width) => {
        const bad: string[] = [];
        for (const el of Array.from(m.querySelectorAll("label, input, select, textarea, button, a, p, h1"))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.left < -1 || r.right > width + 1) {
            bad.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 25)}": ${r.left.toFixed(1)}–${r.right.toFixed(1)}`);
          }
        }
        return bad;
      }, NARROW.width);
      expect(outside).toEqual([]);
    });

    test(`on a phone at 320×568 and 200% text (${shape.name}), Tab never leaves a focused element hidden or under the nav`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openShape(page);
      await startTabbingFromTheTop(page);
      await expectTabKeepsMainFocusClearOfNav(page);
    });
  }
});

// ═══ T1.14. Picking an event by hand leaves the stream alone ════════════════
// Carried over from the T1.13 code review (lead's decision, T1.13 card):
// only pre-fill from ?event= brings the event's usual stream (F14). Choosing
// an event in the Event field by hand never changes the Income stream,
// whatever it holds: "No stream", one the artist chose, or one pre-filled.
// (The gallery shelf's usual stream is Vendor shelf rental, the convention's
// is Sales at events, so a form that wrongly applied the usual stream on a
// hand pick would show those instead.)

test.describe("T1.14: picking an event by hand leaves the stream alone", () => {
  test('Parking, then the gallery shelf picked by hand: the stream stays "No stream"', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { category: "Parking" });
    expect(await selectedOptionText(streamField(page))).toBe(NO_STREAM);
    await fillForm(page, { event: SHELF });
    expect(await selectedOptionText(eventField(page))).toBe(SHELF);
    await nextFrame(page); // let any (wrong) re-render land before reading the stream
    expect(await selectedOptionText(streamField(page))).toBe(NO_STREAM);
  });

  test("Parking with Wholesale chosen, then the gallery shelf picked by hand: the stream stays Wholesale", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { category: "Parking" });
    await streamField(page).selectOption({ label: "Wholesale" });
    await fillForm(page, { event: SHELF });
    expect(await selectedOptionText(eventField(page))).toBe(SHELF);
    await nextFrame(page); // let any (wrong) re-render land before reading the stream
    expect(await selectedOptionText(streamField(page))).toBe("Wholesale");
  });

  test("?event=pretend-event-comic-con, Parking, then the gallery shelf picked by hand: the stream stays Sales at events", async ({
    page,
  }) => {
    await openFormWith(page, "?event=pretend-event-comic-con");
    await fillForm(page, { category: "Parking" });
    await expect.poll(() => selectedOptionText(streamField(page))).toBe("Sales at events");
    await fillForm(page, { event: SHELF });
    expect(await selectedOptionText(eventField(page))).toBe(SHELF);
    await nextFrame(page); // let any (wrong) re-render land before reading the stream
    expect(await selectedOptionText(streamField(page))).toBe("Sales at events");
  });

  test('Parking, the gallery shelf, then the convention, both by hand: the stream stays "No stream"', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { category: "Parking", event: SHELF });
    await fillForm(page, { event: COMIC_CON });
    expect(await selectedOptionText(eventField(page))).toBe(COMIC_CON);
    await nextFrame(page);
    expect(await selectedOptionText(streamField(page))).toBe(NO_STREAM);
  });
});

// ═══ T1.16b. The owner's amount cap, $9,999,999.99 (F17) ══════════════════

test.describe("T1.16b: the amount cap, $9,999,999.99", () => {
  for (const typed of ["9999999.99", "$9,999,999.99", "9,999,999.99"]) {
    test(`"${typed}" shows "Reads as $9,999,999.99"`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { amount: typed });
      await expect(exactText(page, "Reads as $9,999,999.99")).toBeVisible();
    });
  }

  test('"9999999.99" saves: Home says exactly "Expenses $9,999,999.99" (CHANGED (T1.18))', async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "9999999.99", category: "Printing" });
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $9,999,999.99"); // CHANGED (T1.18): was "Today's expenses: $9,999,999.99"
  });

  // CHANGED (T1.17b): was "listed on Transactions".
  test('"$9,999,999.99" saves one expense, listed on the Expenses tab as $9,999,999.99', async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "$9,999,999.99", category: "Equipment" });
    await saveAndExpectHome(page, touch(testInfo));
    await goToExpenses(page);
    await expect(rows(page)).toHaveCount(1);
    expect(await rowLines(rows(page).first())).toEqual(["01/07/2026", "Equipment", "$9,999,999.99"]);
  });

  test('typing "10000000" shows no "Reads as" text', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { amount: "10000000" });
    await expect(readsAs(page)).toHaveCount(0);
  });

  test('changing a valid "9999999.99" to "99999999.99" removes the feedback (no stale value)', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { amount: "9999999.99" });
    await expect(exactText(page, "Reads as $9,999,999.99")).toBeVisible();
    await amountField(page).fill("99999999.99");
    await expect(readsAs(page)).toHaveCount(0);
  });

  test('typing "10000000" shows no error until Save is pressed', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { amount: "10000000", category: "Printing" });
    await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toHaveCount(0);
    await expect(amountField(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  for (const typed of ["10000000", "10,000,000.00", "$10,000,000"]) {
    test(`"${typed}": Save shows exactly "${ERROR_AMOUNT_TOO_LARGE}", not the format message, and no "Reads as"`, async ({
      page,
    }, testInfo) => {
      await openForm(page);
      await fillForm(page, { amount: typed, category: "Printing" });
      await press(saveButton(page), touch(testInfo));
      await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toBeVisible();
      await expect(exactText(page, ERROR_AMOUNT_INVALID)).toHaveCount(0);
      await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toHaveCount(0);
      await expect(readsAs(page)).toHaveCount(0);
    });

    test(`"${typed}": Save is blocked: the form stays open and Home's expenses stay $0.00`, async ({
      page,
    }, testInfo) => {
      await openForm(page);
      await fillForm(page, { amount: typed, category: "Printing" });
      await press(saveButton(page), touch(testInfo));
      await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toBeVisible();
      await expect(page).toHaveURL(urlWithPath(FORM_PATH));
      await goToTab(page, "Home", "/", touch(testInfo));
      await expectHomeLine(page, HOME_EMPTY_EXPENSES); // CHANGED (T1.18)
    });
  }

  test('"10000000": the Amount field gets aria-invalid="true" and aria-describedby points at the cap message', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "10000000", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(amountField(page)).toHaveAttribute("aria-invalid", "true");
    expect(await describedByTexts(amountField(page))).toContain(ERROR_AMOUNT_TOO_LARGE);
  });

  test('"10000000": after the blocked Save, focus moves to the Amount field', async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "10000000", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toBeVisible();
    await expect(amountField(page)).toBeFocused();
  });

  test('"10000000" with no category: both errors show and focus goes to Amount (first in order)', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "10000000" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toBeVisible();
    await expect(exactText(page, ERROR_CATEGORY)).toBeVisible();
    await expect(amountField(page)).toBeFocused();
  });

  for (const { typed, why } of [
    { typed: "9999999.991", why: "three decimals, as before" },
    { typed: "10000000.001", why: "three decimals AND too large: a format mistake first" },
    { typed: "-10000000", why: "a minus sign AND too large" },
  ]) {
    test(`"${typed}" (${why}): Save shows the format message, not the cap message`, async ({ page }, testInfo) => {
      await openForm(page);
      await fillForm(page, { amount: typed, category: "Printing" });
      await press(saveButton(page), touch(testInfo));
      await expect(exactText(page, ERROR_AMOUNT_INVALID)).toBeVisible();
      await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toHaveCount(0);
      expect(await describedByTexts(amountField(page))).toContain(ERROR_AMOUNT_INVALID);
    });
  }

  test('fixing "10000000" to "9999999.99" removes the error and aria-invalid, and shows "Reads as $9,999,999.99"', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "10000000", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toBeVisible();
    await amountField(page).fill("9999999.99");
    await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toHaveCount(0);
    await expect(amountField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(exactText(page, "Reads as $9,999,999.99")).toBeVisible();
  });

  test("after Save, the error follows the text: too large, then a format mistake, then too large again", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "10000000", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toBeVisible();
    await amountField(page).fill("abc");
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toBeVisible();
    await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toHaveCount(0);
    await amountField(page).fill("10,000,000.00");
    await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toBeVisible();
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toHaveCount(0);
  });

  test('after fixing "10000000" to "9999999.99", Save adds it: Home says "Expenses $9,999,999.99" (CHANGED (T1.18))', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { amount: "10000000", category: "Printing" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_TOO_LARGE)).toBeVisible();
    await amountField(page).fill("9999999.99");
    await saveAndExpectHome(page, touch(testInfo));
    await expectHomeLine(page, "Expenses $9,999,999.99"); // CHANGED (T1.18): was "Today's expenses: $9,999,999.99"
  });
});
