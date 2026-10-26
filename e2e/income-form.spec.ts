// Income form (T1.12, docs/stages/stage-01.md).
// Guide §10 (the seven income streams, cash basis), §6 (the phone's own date
// picker; show the interpreted amount); DECISIONS.md "Event takings" (owner:
// event takings are always split into cash and card, saved as two income
// rows) and "The '+' button" (pre-fill from the page it's opened on).
// The income form deliberately mirrors the expense form, so these decisions
// follow e2e/expense-form.spec.ts (F1–F10) wherever they can.
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop)
// unless its name says "on a phone"; those are limited to the phone project
// with a conditional `test.skip(...)`, as in app-shell.spec.ts. On desktop
// they show as skipped, which is expected.
//
// How the tests see what was saved: there is no income list yet (T1.16), so
// they use two existing screens, through client-side moves that keep the
// in-memory entries:
//   - Home's "Today: $X from N sales" line (entries-list D3), which adds up
//     every income row dated today, $0.00 rows included;
//   - the Transactions list (still reachable by its address until T1.16/T1.17
//     remove it, app-shell claim 18), reached with goToTransactions(), the
//     same helper as in entries-list.spec.ts. Each income row shows its
//     stream's name, its date, its amount, and as its description the
//     event's name when it has an event, otherwise its payment method
//     ("Cash", "Card", "Online", "Bank transfer", "Other") (entries-list D6).
//     Rows on the same date are listed newest first, so for one day's takings
//     the CARD row (added second) comes first and the CASH row second.
// No new test seam is used or needed.
//
// ═══ DECISIONS (lead's, written out here so the tests can be exact) ════════
//
// I1. Route. The form is its own page at /income/new (HTTP 200 on a direct
//     load and on refresh). Its title is exactly "Add income · BentoBudget"
//     (middle dot U+00B7) and it has exactly one level-1 heading,
//     "Add income". The bottom navigation stays on it (five links), and NO
//     nav link has aria-current there: the form isn't one of the tabs. (Which
//     tab, if any, a sub-page highlights is decided later; until then, none.)
//
// I2. The form is one real <form> inside <main>. Every field has ONE visible
//     <label> whose whole text is exactly:
//       "Date"             <input type="date"> (the phone's own picker)
//       "Income stream"    a native <select> (see I4)
//       "Event"            a native <select>, only for the two streams that
//                          can have an event (see I5, I6)
//       "Cash", "Card"     <input type="text" inputmode="decimal">, only for
//                          Sales at events (I5)
//       "Amount"           <input type="text" inputmode="decimal">, only for
//                          the other six streams (I6)
//       "Payment method"   a <fieldset> whose <legend> text is exactly
//                          "Payment method", holding exactly five
//                          <input type="radio">, each with one visible
//                          <label>, in this order: "Cash", "Card", "Online",
//                          "Bank transfer", "Other". All five share one
//                          non-empty `name`, so they are one group for the
//                          keyboard and screen readers. Only for the other six
//                          streams (I6). None is checked at the start: there
//                          is no default (DECISIONS.md, entries.ts).
//       "Notes (optional)" a <textarea>
//     then a submit <button> named exactly "Save", then a link named exactly
//     "Cancel" (I8). The browser's own validation bubbles must not replace
//     the messages below (no `required`/`pattern` that blocks submit, or use
//     `noValidate`). Save is never `disabled`.
//     DOM and Tab order: Date, Income stream, Event (when shown), then Cash
//     and Card, or Amount and Payment method, then Notes, Save, Cancel. Tab
//     enters the radio group once (on "Cash" while none is checked). Nothing
//     focusable comes before Date in <main>.
//     The Event field sits straight after Income stream in BOTH shapes (the
//     test engineer's choice, so the field doesn't jump around).
//
// I3. Date. Defaults to todayOnDevice() in the device's zone (guide §6),
//     worked out in the browser when the form OPENS, as in expense-form F3.
//     The saved rows keep exactly the "YYYY-MM-DD" in the field.
//
// I4. Income stream. A native <select> whose options are, in order: one
//     <option> "Choose a stream" (selected at the start, value ""), then the
//     seven INCOME_STREAMS names in the guide's order (written out below).
//     No <optgroup>. Required, with no default. While no stream is chosen,
//     the form shows only Date, Income stream, Notes, Save and Cancel: no
//     Event, Cash, Card, Amount or Payment method field.
//
// I5. Sales at events (owner: always split cash and card).
//     - Event: options "Not assigned yet" (selected when it appears, value
//       ""), then the three pretend events in pretendEvents()'s order:
//       "Pretend comic convention", "Pretend weekend market (today)",
//       "Pretend gallery shelf". Optional.
//     - Cash and Card are both required; $0 is allowed. Each has its own
//       "Reads as <formatCents(cents, "AUD", locale)>" feedback, exactly as
//       expense-form F4 describes for Amount: an element whose whole text is
//       "Reads as $1,000.00", linked to ITS field through aria-describedby,
//       shown only while that field's text is a valid amount.
//       CHANGED (T1.13a, lead's decision): "Reads as" lines (Cash, Card and
//       Amount) are NOT live regions: no aria-live, no role status, log,
//       alert, marquee or timer, no <output>, and no live ancestor. A screen
//       reader reads them when their field is focused (through
//       aria-describedby), instead of chattering on every keystroke. The
//       Total below stays a polite live region: in the takings shape it is
//       the ONLY live region in the form; the one-amount shape has none.
//     - Total. While BOTH Cash and Card are valid amounts, an element in
//       <main> whose whole text is exactly "Total <formatCents(cash + card)>"
//       (en-AU "Total $3,000.50"; en-US "Total A$3,000.50"; one plain space,
//       no colon) is shown inside a POLITE live region (the nearest
//       ancestor-or-self with aria-live="polite", or role="status", or an
//       <output>; not "assertive"/role="alert"). While either is empty or
//       invalid, no text starting "Total" is in <main> (never a stale sum).
//     - Save adds exactly TWO income rows through the store's
//       "add-event-takings" action: stream Sales at events, the form's date,
//       the chosen event (or none), the same notes; the cash row (payment
//       method cash) first, then the card row (card). Both are saved even when
//       one or both are $0.
//
// I6. Any other stream (Online sales, Wholesale, Commissions, Vendor shelf
//     rental, Social media, Subscription income).
//     - One Amount (required, expense-form F4's rules and feedback) and the
//       Payment method radio group (required, no default).
//     - Vendor shelf rental ALSO shows the optional Event field (the same
//       options as in I5). The other five streams have no Event field.
//     - Save adds exactly ONE income row through "add-income" with that
//       stream, amount, payment method and the event (Vendor shelf rental
//       only; none otherwise).
//     - Switching the stream away from one that can have an event (Sales at
//       events, Vendor shelf rental) to one that can't clears the chosen
//       event: switching back shows "Not assigned yet", and saving under the
//       new stream never sends the old event (the store would refuse it).
//
// I7. Errors appear only when Save is pressed (not while typing). Each is an
//     element whose whole text is exactly the message, linked to its field
//     through aria-describedby; that field gets aria-invalid="true" (for the
//     Payment method group: the <fieldset>'s aria-describedby points at the
//     message). Exact messages (chosen by the test engineer, in the expense
//     form's style):
//       Date emptied                   → "Choose a date."
//       No stream chosen               → "Choose an income stream."
//       Cash empty or only spaces      → "Enter the cash amount, or 0 if there was none."
//       Card empty or only spaces      → "Enter the card amount, or 0 if there was none."
//       Amount empty or only spaces    → "Enter an amount."
//       Cash, Card or Amount invalid   →
//         "Enter an amount like 12.50 or $1,234.50, with no minus sign and at most 2 decimal places."
//       No payment method chosen       → "Choose a payment method."
//     Once shown, an error goes away (and aria-invalid is no longer "true")
//     as soon as its field becomes valid, without pressing Save.
//     Save with any error: nothing is added, the page stays on /income/new,
//     and focus moves to the FIRST invalid field in form order (Date, Income
//     stream, Cash, Card, Amount, Payment method; for Payment method, the
//     first radio, "Cash").
//
// I8. Pre-fill from the page address (T1.14's "+" button uses this):
//     - ?stream=<id> picks that stream (an INCOME_STREAMS id, exact).
//     - ?event=<id> picks that event (a pretendEvents() id, exact) and, when
//       no stream is given, the event's usual stream:
//         pretend-event-shelf        → Vendor shelf rental + Pretend gallery shelf
//         pretend-event-comic-con    → Sales at events + Pretend comic convention
//         pretend-event-todays-market→ Sales at events + Pretend weekend market (today)
//     - Both given, and the stream can have an event: both apply, even when
//       the event's usual stream is the other one (the usual stream is a
//       smart default, not a rule: lead's T1.10 decision).
//     - Both given, and the stream can't have an event: the stream applies,
//       the event is ignored (no Event field, the saved row has no event).
//     - An unknown id (any value that isn't exactly a known id, e.g. a name
//       like "Online sales", or another letter case) is ignored silently: no
//       error message, no aria-invalid, no page error. An unknown stream
//       counts as "no stream given", so a known event still brings its usual
//       stream (test engineer's reading of the card).
//     - Pre-filled values are ordinary starting values: they can be changed,
//       and nothing is shown as an error before Save.
//     - Pre-fill works on a direct load AND after a client-side move to the
//       form (how T1.14's button will open it).
//
// I9. Where Save goes (and Cancel). ?back=<path> is used only if it is a SAFE
//     internal path, exactly the card's rule: it starts with a single "/",
//     has no "//", "\\" or scheme, and is made only of ASCII letters, digits,
//     "-" and "/". Otherwise (missing, empty or unsafe) the target is Home,
//     "/". Save moves there with a CLIENT-SIDE REPLACE (router.replace): the
//     entries survive, and pressing the browser's Back afterwards does not
//     reopen the form. Unsafe values tested, each landing on "/" of the SAME
//     server: "//evil.example", "https://evil.example", "/\evil",
//     "javascript:alert(1)", "/income?x=1", "/events#top", "/ev ents",
//     "events", "/events/../settings", "/%2F%2Fevil.example", "".
//     Safe values tested: "/events", "/income", "/settings".
//     Cancel is a link whose href is the same target ("/" or the safe back
//     path); it adds nothing (the test engineer's choice, mirroring
//     expense-form's Cancel to "/").
//     Requests to any other host are blocked in these tests, so a wrong
//     implementation can't reach the network.
//
// I10. Save adds its rows ONCE, also when Save is double-clicked or Enter is
//     pressed in a field. Opening the form again shows a fresh, empty form.
//
// I11. Layout and access (guide §19, WCAG 1.4.4, 1.4.10, 2.4.11, 2.5.8), as
//     expense-form F8: on a phone every field, Save and Cancel are at least
//     44×44 CSS px, and so is each payment method's <label> (the tap target
//     for a radio); field text is at least 16 px. At 320×568 with 200% text,
//     in both shapes and with an error showing: no sideways scroll, every
//     label, control and message stays inside 0–320 px, Tab never leaves a
//     focused element hidden or under the nav, Save can be scrolled fully on
//     screen without overlapping the nav, and a valid save still works.
//
// I12. No uncaught errors and no React hydration errors during any test.
//
// ─── Added for T1.12b (review follow-ups the lead took) ───────────────────────
//
// I13. A shape change doesn't bring premature errors. Once Save has been
//     pressed with a mistake, errors follow typing (I7), but only for the
//     fields that were on the form when Save was pressed. When the stream
//     changes and the form changes shape (no stream → Sales at events, no
//     stream → another stream, or between Sales at events and the one-amount
//     shape), the NEW fields (Cash and Card, or Amount and Payment method)
//     show no error message and no aria-invalid until Save is pressed again.
//     That next Save shows their errors and focuses the first bad field as in
//     I7. (The stream's own error goes once a stream is chosen, as before.)
//
// I14. The form starts fresh after Save even when ?back= is the form's own
//     address (/income/new). Save then stays on /income/new (no query) and
//     the form is empty: stream "Choose a stream", no shape fields, empty
//     notes, today's date, no messages, no "Reads as", no total. A second
//     valid Save on that fresh form adds a second income (the double-tap
//     guard belongs to one form, not to the page). The address after the
//     first Save is plain /income/new, with no ?back=, so by I9 the second
//     Save goes to Home.
//
// I15. The payment method error is linked from each radio too. After a
//     blocked Save with no payment method, the error element has a non-empty
//     id, every one of the five radios' aria-describedby includes that id, and
//     the <fieldset>'s aria-describedby still includes it (I7). Once a method
//     is chosen and the error is gone, no radio's description reads it.
//
// I16. ?back= is capped at 200 characters (safeBackPath, see
//     src/lib/navigation.test.ts for the full table). Seen here through
//     Cancel's href: a safe-looking 200-character back is kept, 201 gives "/".
//
// I17. Two lead decisions (2026-10-26), tests only:
//     - Moving between the two streams that can have an event (Sales at
//       events ↔ Vendor shelf rental) KEEPS the chosen event, and saving
//       stores it. Moving on to a stream without events still clears it (I6).
//     - Typed amounts don't carry over when the shape changes: Online sales
//       with Amount "50", switched to Sales at events, shows empty Cash and
//       Card, no "Reads as" and no total; Sales at events with Cash and Card
//       typed, switched to Wholesale, shows an empty Amount and no "Reads as".
//       (What a round trip back to the first shape shows isn't decided, so it
//       isn't tested.)
//
// ─── Added for T1.13a (shared form parts) ──────────────────────────────────
//
// I18. Live regions (lead's decision): see the CHANGED (T1.13a) note in I5.
//     No "Reads as" line is a live region, each stays in its field's
//     accessible description, and the Total is the only live region.
//
// I19. Moving between two one-amount streams is NOT a shape change (T1.12b
//     review): after a blocked Save on Online sales, switching to Wholesale
//     and then to Vendor shelf rental keeps "Enter an amount." and
//     "Choose a payment method." showing, and Amount keeps
//     aria-invalid="true".
//
// I20. The two forms still look alike (a cheap guard for the shared module):
//     on a phone at 390×844, the Amount field has the same measured height in
//     both forms, and Save has the same measured height and font size.
//
// ═══ HAND-WORKED VALUES ═════════════════════════════════════════════════════
//
// The device clock is frozen at 2026-06-30T15:30:00Z. In Australia/Sydney
// (UTC+10 in winter) that's 01:30 on 1 July, so today = "2026-07-01" (shown
// "01/07/2026" in en-AU), while the UTC date is still 30 June. In
// Australia/Perth (UTC+8) it's 23:30 on 30 June, so today = "2026-06-30".
//
// Takings (the owner's "day 1 $1,000"-style entry, with cents):
//   Cash "$1,000"   → 100000 cents → "Reads as $1,000.00"
//   Card "2,000.5"  → 200050 cents → "Reads as $2,000.50"
//   Total 100000 + 200050 = 300050 cents → "Total $3,000.50"
//   Home: "Today: $3,000.50 from 2 sales"
//   Transactions (newest first): card row $2,000.50, then cash row $1,000.00
// Small takings: Cash "100" + Card "250" = 10000 + 25000 = 35000 → "Total $350.00",
//   Home "Today: $350.00 from 2 sales".
// Zero takings: "0" + "0" → "Total $0.00", Home "Today: $0.00 from 2 sales".
// One-amount income: Wholesale "1,234.56" by Bank transfer → 123456 cents,
//   Home "Today: $1,234.56 from 1 sale"; row "Wholesale" / "Bank transfer" / $1,234.56.
//
// Every expected string below is written out by hand. None is computed with
// the app's own code (parseAmountToCents, formatCents, formatDateForDisplay,
// totalsForDate, pretendEvents, ...).

import { expect, test as base, type Locator, type Page } from "@playwright/test";

// ---------- fixed facts ----------

/** 2026-06-30 15:30 UTC: 1 July 01:30 in Sydney, 30 June 23:30 in Perth. */
const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";
const PERTH = "Australia/Perth";
const SYDNEY_TODAY = "2026-07-01";
const PERTH_TODAY = "2026-06-30";

const FORM_PATH = "/income/new";
const FORM_TITLE = "Add income · BentoBudget";
const FORM_HEADING = "Add income";

const LABEL_DATE = "Date";
const LABEL_STREAM = "Income stream";
const LABEL_EVENT = "Event";
const LABEL_CASH = "Cash";
const LABEL_CARD = "Card";
const LABEL_AMOUNT = "Amount";
const LABEL_PAYMENT = "Payment method";
const LABEL_NOTES = "Notes (optional)";

const ERROR_DATE = "Choose a date.";
const ERROR_STREAM = "Choose an income stream.";
const ERROR_CASH_EMPTY = "Enter the cash amount, or 0 if there was none.";
const ERROR_CARD_EMPTY = "Enter the card amount, or 0 if there was none.";
const ERROR_AMOUNT_EMPTY = "Enter an amount.";
const ERROR_AMOUNT_INVALID =
  "Enter an amount like 12.50 or $1,234.50, with no minus sign and at most 2 decimal places.";
const ERROR_PAYMENT = "Choose a payment method.";
const ALL_ERRORS = [
  ERROR_DATE,
  ERROR_STREAM,
  ERROR_CASH_EMPTY,
  ERROR_CARD_EMPTY,
  ERROR_AMOUNT_EMPTY,
  ERROR_AMOUNT_INVALID,
  ERROR_PAYMENT,
] as const;

const STREAM_PLACEHOLDER = "Choose a stream";
const NOT_ASSIGNED = "Not assigned yet";

// INCOME_STREAMS (src/lib/pretend-data.ts), written out by hand, in order.
const SALES_AT_EVENTS = "Sales at events";
const VENDOR_SHELF = "Vendor shelf rental";
const STREAM_NAMES = [
  SALES_AT_EVENTS,
  "Online sales",
  "Wholesale",
  "Commissions",
  VENDOR_SHELF,
  "Social media",
  "Subscription income",
] as const;
// The five streams that can't have an event.
const NO_EVENT_STREAMS = ["Online sales", "Wholesale", "Commissions", "Social media", "Subscription income"] as const;
// The six streams that take one Amount and a payment method.
const ONE_AMOUNT_STREAMS = STREAM_NAMES.filter((s) => s !== SALES_AT_EVENTS);

// pretendEvents() names, in order, after "Not assigned yet".
const COMIC_CON = "Pretend comic convention";
const MARKET = "Pretend weekend market (today)";
const SHELF = "Pretend gallery shelf";
const EVENT_OPTIONS = [NOT_ASSIGNED, COMIC_CON, MARKET, SHELF] as const;

// Payment methods: radio label → what an income row with no event shows.
const PAYMENT_LABELS = ["Cash", "Card", "Online", "Bank transfer", "Other"] as const;
type PaymentLabel = (typeof PAYMENT_LABELS)[number];

const HOME_NO_INCOME = "Today: $0.00 from 0 sales";
const EMPTY_TRANSACTIONS = "No entries yet.";

const EDGE_TOLERANCE_PX = 1;
const MIN_TAP_TARGET_PX = 44;
const MIN_INPUT_FONT_PX = 16;

// Invalid amounts and the exact error each must give after Save (Amount field).
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

// Valid amounts and what "Reads as" must show in en-AU (T1.4 rules).
const VALID_AMOUNTS: readonly { typed: string; shown: string; why: string }[] = [
  { typed: "1234.5", shown: "$1,234.50", why: "one decimal is padded" },
  { typed: "$1,234.50", shown: "$1,234.50", why: "a leading $ and thousands commas are fine" },
  { typed: "0", shown: "$0.00", why: "zero is allowed" },
  { typed: "007.05", shown: "$7.05", why: "leading zeros are allowed" },
  { typed: "  12.5  ", shown: "$12.50", why: "spaces around are trimmed" },
];

// I9: unsafe ?back= values. Each must land on "/" of this same server.
const UNSAFE_BACKS: readonly { value: string; why: string }[] = [
  { value: "//evil.example", why: "a protocol-relative address to another site" },
  { value: "https://evil.example", why: "a full address to another site" },
  { value: "/\\evil", why: "a backslash (browsers treat it like a slash)" },
  { value: "javascript:alert(1)", why: "a scheme" },
  { value: "/income?x=1", why: "a query string ('?' and '=' aren't allowed)" },
  { value: "/events#top", why: "a fragment ('#' isn't allowed)" },
  { value: "/ev ents", why: "a space" },
  { value: "events", why: "no leading slash" },
  { value: "/events/../settings", why: "dots" },
  { value: "/%2F%2Fevil.example", why: "percent-encoding ('%' isn't allowed)" },
  { value: "", why: "empty" },
];
const SAFE_BACKS: readonly { value: string; heading: string }[] = [
  { value: "/events", heading: "Events" },
  { value: "/income", heading: "Income" },
  { value: "/settings", heading: "Settings" },
];

// ---------- fixture: no uncaught errors, no hydration errors (I12) ----------

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
      // I9: never let a wrong redirect reach another host.
      await page.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => route.abort());
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
function streamField(page: Page): Locator {
  return main(page).getByRole("combobox", { name: LABEL_STREAM, exact: true });
}
function eventField(page: Page): Locator {
  return main(page).getByRole("combobox", { name: LABEL_EVENT, exact: true });
}
function cashField(page: Page): Locator {
  return main(page).getByRole("textbox", { name: LABEL_CASH, exact: true });
}
function cardField(page: Page): Locator {
  return main(page).getByRole("textbox", { name: LABEL_CARD, exact: true });
}
function amountField(page: Page): Locator {
  return main(page).getByRole("textbox", { name: LABEL_AMOUNT, exact: true });
}
function paymentGroup(page: Page): Locator {
  return main(page).getByRole("group", { name: LABEL_PAYMENT, exact: true });
}
function paymentRadio(page: Page, label: PaymentLabel): Locator {
  return paymentGroup(page).getByRole("radio", { name: label, exact: true });
}
function anyRadio(page: Page): Locator {
  return main(page).getByRole("radio");
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

/** An element in <main> whose whole text is exactly `text`. */
function exactText(page: Page, text: string): Locator {
  return main(page).getByText(text, { exact: true });
}

/** Any "Reads as …" feedback in <main>. */
function readsAs(page: Page): Locator {
  return main(page).getByText(/^\s*Reads as\b/);
}

/** Any "Total …" text in <main>. */
function totalText(page: Page): Locator {
  return main(page).getByText(/^\s*Total\b/);
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
 * field holds a date (filled in the browser, I3).
 */
async function waitForForm(page: Page): Promise<void> {
  await waitForHydration(page);
  await expect(dateField(page), "the Date field is filled in once the form is ready").toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
}

/** Opens the form directly (a full page load), with an optional query string, and waits until it's ready. */
async function openForm(page: Page, query = ""): Promise<void> {
  await open(page, FORM_PATH + query);
  await waitForForm(page);
}

/** The form address with `?back=<value>`, the value percent-encoded once. */
function formWithBack(value: string): string {
  return `${FORM_PATH}?back=${encodeURIComponent(value)}`;
}

/** Matches a full URL on THIS server (origin of `page` now) whose path is exactly `path`, no query. */
function urlOnThisServer(page: Page, path: string): RegExp {
  const origin = new URL(page.url()).origin;
  return new RegExp(`^${escapeRegExp(origin)}${escapeRegExp(path)}$`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A client-side move (no reload) to `href` through Next.js's own router,
 * window.next.router.push, the same call a next/link link makes (as in
 * entries-list.spec.ts). A marker put on `window` first must still be there
 * afterwards, which proves the page wasn't reloaded.
 */
async function goClientSide(page: Page, href: string): Promise<void> {
  const routerReady = await page.evaluate(
    () => typeof (window as unknown as { next?: { router?: { push?: unknown } } }).next?.router?.push === "function",
  );
  expect(routerReady, "Next.js's client router (window.next.router.push) is available").toBe(true);
  const origin = new URL(page.url()).origin;
  await page.evaluate((target) => {
    (window as unknown as Record<string, unknown>).__t112SameDocument = true;
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(target);
  }, href);
  // Compare the decoded address (origin, path and query values), so the way
  // the browser chooses to percent-encode the query can't matter.
  const wanted = new URL(href, origin);
  const decoded = (u: URL) => ({
    origin: u.origin,
    path: u.pathname,
    query: Array.from(u.searchParams.entries()),
  });
  await expect
    .poll(() => decoded(new URL(page.url())), { message: `address after moving to ${href}` })
    .toEqual(decoded(wanted));
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).__t112SameDocument),
    `the move to ${href} didn't reload the page`,
  ).toBe(true);
}

/** Moves client-side to /transactions (no tab for it since T1.11) and checks its heading. */
async function goToTransactions(page: Page): Promise<void> {
  await goClientSide(page, "/transactions");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Transactions");
}

/** Opens Home (full load), then moves client-side to the form at `href`. */
async function openFormFromHome(page: Page, href: string = FORM_PATH): Promise<void> {
  await open(page, "/");
  await waitForHydration(page);
  await goClientSide(page, href);
  await waitForForm(page);
}

/** Moves to Home with the bottom navigation (client-side). */
async function goHomeByNav(page: Page, hasTouch: boolean): Promise<void> {
  await press(mainNav(page).getByRole("link", { name: "Home", exact: true }), hasTouch);
  await expect(page).toHaveURL(urlOnThisServer(page, "/"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");
}

type FormValues = {
  date?: string;
  stream?: string;
  event?: string;
  cash?: string;
  card?: string;
  amount?: string;
  payment?: PaymentLabel;
  notes?: string;
};

/** Fills in the form, in form order. Fields left out keep what they have. */
async function fillForm(page: Page, values: FormValues): Promise<void> {
  if (values.date !== undefined) await dateField(page).fill(values.date);
  if (values.stream !== undefined) await streamField(page).selectOption({ label: values.stream });
  if (values.event !== undefined) await eventField(page).selectOption({ label: values.event });
  if (values.cash !== undefined) await cashField(page).fill(values.cash);
  if (values.card !== undefined) await cardField(page).fill(values.card);
  if (values.amount !== undefined) await amountField(page).fill(values.amount);
  if (values.payment !== undefined) await paymentRadio(page, values.payment).check();
  if (values.notes !== undefined) await notesField(page).fill(values.notes);
}

/** Presses Save and checks the app went to `path` (Home by default) on this server. */
async function saveAndExpect(page: Page, hasTouch: boolean, path = "/", heading = "Home"): Promise<void> {
  const target = urlOnThisServer(page, path);
  await press(saveButton(page), hasTouch);
  await expect(page).toHaveURL(target);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
}

function rows(page: Page): Locator {
  return main(page).getByRole("list").getByRole("listitem");
}

/** A row's text as laid out, with runs of whitespace collapsed to one space. */
async function rowText(row: Locator): Promise<string> {
  return (await row.innerText()).replace(/\s+/g, " ").trim();
}

/** Every money amount in a piece of text ("$1,234.56", "A$0.01", ...). */
function amountsIn(text: string): string[] {
  return text.match(/[A-Z]{0,2}\$\d[\d,]*\.\d{2}/g) ?? [];
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

/** The text of a <select>'s selected option. */
function selectedText(select: Locator): Promise<string | null> {
  return select.evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? null);
}

/** The texts of a <select>'s options, in order, and whether it has optgroups. */
function optionsOf(select: Locator): Promise<{ options: string[]; optgroups: number }> {
  return select.evaluate((el) => ({
    options: Array.from((el as HTMLSelectElement).options).map((o) => (o.textContent ?? "").trim()),
    optgroups: el.querySelectorAll("optgroup").length,
  }));
}

/**
 * The politeness of the nearest live region holding the element (itself or
 * an ancestor), as in entries-list.spec.ts D10. null when there is none.
 */
function liveRegionOf(locator: Locator): Promise<string | null> {
  return locator.evaluate((el) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const live = node.getAttribute("aria-live");
      if (live !== null) return live;
      const role = node.getAttribute("role");
      if (role === "status" || (role === null && node.tagName === "OUTPUT")) return "polite";
      if (role === "alert") return "assertive";
    }
    return null;
  });
}

/** Checks no error message and no aria-invalid is anywhere in <main>. */
async function expectNoErrorsShown(page: Page): Promise<void> {
  for (const message of ALL_ERRORS) {
    await expect(exactText(page, message), `"${message}" is not shown`).toHaveCount(0);
  }
  await expect(main(page).locator('[aria-invalid="true"]')).toHaveCount(0);
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

/** Puts the keyboard's starting point at the page heading (as in expense-form.spec.ts). */
async function startTabbingFromTheTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("heading", { level: 1 }).click();
}

/**
 * Presses Tab through every focusable, rendered element in <main>. After each
 * press, the focused element must be fully on screen and not overlap the nav
 * (the app-shell claim 15 check, as in expense-form.spec.ts). A radio group
 * is one Tab stop, so only its first radio is counted.
 */
async function expectTabKeepsMainFocusClearOfNav(page: Page): Promise<void> {
  const count = await main(page).evaluate((m) => {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const seenRadioNames = new Set<string>();
    const found = Array.from(m.querySelectorAll(selector)).filter((el) => {
      if (el.getClientRects().length === 0 || el.getAttribute("tabindex") === "-1") return false;
      if (el instanceof HTMLInputElement && el.type === "radio") {
        if (seenRadioNames.has(el.name)) return false;
        seenRadioNames.add(el.name);
      }
      return true;
    });
    found.forEach((el, i) => el.setAttribute("data-focus-test", String(i)));
    return found.length;
  });
  expect(count, "focusable elements in <main>").toBeGreaterThanOrEqual(6);

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

/** Every label, control and message in <main> outside 0–width px. */
function outsideWidth(page: Page, width: number): Promise<string[]> {
  return main(page).evaluate((m, w) => {
    const bad: string[] = [];
    for (const el of Array.from(m.querySelectorAll("label, legend, input, select, textarea, button, a, p, h1, output"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.left < -1 || r.right > w + 1) {
        bad.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 25)}": ${r.left.toFixed(1)}–${r.right.toFixed(1)}`);
      }
    }
    return bad;
  }, width);
}

// ═══ I1. Opening the form ═══════════════════════════════════════════════════

test.describe("opening the form", () => {
  test("/income/new loads directly with HTTP 200 and shows the form", async ({ page }) => {
    await openForm(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(FORM_HEADING);
  });

  test(`the form's page title is exactly "${FORM_TITLE}"`, async ({ page }) => {
    await open(page, FORM_PATH);
    await expect(page).toHaveTitle(FORM_TITLE);
  });

  test('the form page has exactly one level-1 heading, "Add income"', async ({ page }) => {
    await open(page, FORM_PATH);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(FORM_HEADING);
  });

  test("the bottom navigation is still on the form page, with its five links", async ({ page }) => {
    await open(page, FORM_PATH);
    await expect(mainNav(page)).toHaveCount(1);
    await expect(mainNav(page).getByRole("link")).toHaveCount(5);
  });

  test("on the form page, no nav link has aria-current (the form isn't a tab)", async ({ page }) => {
    await openForm(page);
    await expect(mainNav(page).getByRole("link")).toHaveCount(5);
    await expect(mainNav(page).locator("[aria-current]")).toHaveCount(0);
  });

  test("a client-side move from Home opens the form, ready to use", async ({ page }) => {
    await openFormFromHome(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(FORM_HEADING);
    await expect(streamField(page)).toBeVisible();
  });

  test("refreshing the form shows the form again (HTTP 200, ready to use)", async ({ page }) => {
    await openForm(page);
    const response = await page.reload();
    expect(response?.status()).toBe(200);
    await waitForForm(page);
    await expect(streamField(page)).toHaveValue("");
  });
});

// ═══ I2, I4. Fields, labels and structure ═══════════════════════════════════

/** Checks a field has exactly one visible <label> whose text is `label`, and its tag. */
async function expectLabelledOnce(page: Page, field: Locator, tag: string, label: string): Promise<void> {
  await expect(field).toHaveCount(1);
  const facts = await field.evaluate((el) => {
    document.querySelectorAll("[data-label-test]").forEach((l) => l.removeAttribute("data-label-test"));
    const labels = Array.from((el as HTMLInputElement).labels ?? []);
    labels.forEach((l) => l.setAttribute("data-label-test", "yes"));
    return { tag: el.tagName, labels: labels.map((l) => l.innerText.replace(/\s+/g, " ").trim()) };
  });
  expect(facts).toEqual({ tag, labels: [label] });
  await expect(main(page).locator('label[data-label-test="yes"]')).toBeVisible();
}

test.describe("the fields and their labels", () => {
  test('"Date" is an <input> with exactly one visible <label> reading "Date"', async ({ page }) => {
    await openForm(page);
    await expectLabelledOnce(page, dateField(page), "INPUT", LABEL_DATE);
  });

  test('"Income stream" is a <select> with exactly one visible <label> reading "Income stream"', async ({ page }) => {
    await openForm(page);
    await expectLabelledOnce(page, streamField(page), "SELECT", LABEL_STREAM);
  });

  test('"Notes (optional)" is a <textarea> with exactly one visible <label> reading "Notes (optional)"', async ({
    page,
  }) => {
    await openForm(page);
    await expectLabelledOnce(page, notesField(page), "TEXTAREA", LABEL_NOTES);
  });

  test('with Sales at events, "Event" is a <select> with exactly one visible <label> reading "Event"', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expectLabelledOnce(page, eventField(page), "SELECT", LABEL_EVENT);
  });

  for (const [label, locate] of [
    [LABEL_CASH, cashField],
    [LABEL_CARD, cardField],
  ] as const) {
    test(`with Sales at events, "${label}" is an <input> with exactly one visible <label> reading "${label}"`, async ({
      page,
    }) => {
      await openForm(page);
      await fillForm(page, { stream: SALES_AT_EVENTS });
      await expectLabelledOnce(page, locate(page), "INPUT", label);
    });

    test(`with Sales at events, "${label}" is a text field with the decimal keypad (type="text", inputmode="decimal")`, async ({
      page,
    }) => {
      await openForm(page);
      await fillForm(page, { stream: SALES_AT_EVENTS });
      const attrs = await locate(page).evaluate((el) => ({
        type: el.getAttribute("type"),
        inputmode: el.getAttribute("inputmode"),
      }));
      expect(attrs).toEqual({ type: "text", inputmode: "decimal" });
    });
  }

  test('with Online sales, "Amount" is an <input> with exactly one visible <label> reading "Amount"', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    await expectLabelledOnce(page, amountField(page), "INPUT", LABEL_AMOUNT);
  });

  test('with Online sales, "Amount" is a text field with the decimal keypad (type="text", inputmode="decimal")', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    const attrs = await amountField(page).evaluate((el) => ({
      type: el.getAttribute("type"),
      inputmode: el.getAttribute("inputmode"),
    }));
    expect(attrs).toEqual({ type: "text", inputmode: "decimal" });
  });

  test('with Online sales, "Payment method" is a <fieldset> with the legend "Payment method" and five radios Cash, Card, Online, Bank transfer, Other, each with one visible <label>', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    await expect(paymentGroup(page)).toHaveCount(1);
    const facts = await paymentGroup(page).evaluate((group) => ({
      tag: group.tagName,
      legend: (group.querySelector(":scope > legend")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      radios: Array.from(group.querySelectorAll('input[type="radio"]')).map((r) => {
        const labels = Array.from((r as HTMLInputElement).labels ?? []);
        return {
          labels: labels.map((l) => l.innerText.replace(/\s+/g, " ").trim()),
          visible: labels.every((l) => l.getClientRects().length > 0),
        };
      }),
    }));
    expect(facts).toEqual({
      tag: "FIELDSET",
      legend: LABEL_PAYMENT,
      radios: PAYMENT_LABELS.map((l) => ({ labels: [l], visible: true })),
    });
  });

  test("the five payment method radios share one non-empty name (one group for the keyboard)", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    const names = await paymentGroup(page).evaluate((group) =>
      Array.from(group.querySelectorAll('input[type="radio"]')).map((r) => (r as HTMLInputElement).name),
    );
    expect(names).toHaveLength(5);
    expect(names[0], "the radios' name").not.toBe("");
    expect(new Set(names).size, "different names among the five radios").toBe(1);
  });

  test("no payment method is chosen at the start", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    for (const label of PAYMENT_LABELS) {
      await expect(paymentRadio(page, label), `"${label}" is not checked`).not.toBeChecked();
    }
  });

  test('the Date field is a native date picker (type="date")', async ({ page }) => {
    await openForm(page);
    await expect(dateField(page)).toHaveAttribute("type", "date");
  });

  test("Save is a submit button inside the same <form> as the fields", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    const facts = await saveButton(page).evaluate((button) => {
      const form = (button as HTMLButtonElement).form;
      const names = ["Date", "Income stream", "Event", "Cash", "Card", "Notes (optional)"];
      const fieldsInForm = names.map((name) =>
        Array.from(form?.elements ?? []).some((el) =>
          Array.from((el as HTMLInputElement).labels ?? []).some(
            (l) => l.innerText.replace(/\s+/g, " ").trim() === name,
          ),
        ),
      );
      return { type: (button as HTMLButtonElement).type, inMain: !!form?.closest("main"), fieldsInForm };
    });
    expect(facts).toEqual({ type: "submit", inMain: true, fieldsInForm: [true, true, true, true, true, true] });
  });

  test("Save is never disabled, even with an empty form", async ({ page }) => {
    await openForm(page);
    await expect(saveButton(page)).toBeEnabled();
  });

  test('Income stream starts on "Choose a stream" (value "")', async ({ page }) => {
    await openForm(page);
    await expect(streamField(page)).toHaveValue("");
    expect(await selectedText(streamField(page))).toBe(STREAM_PLACEHOLDER);
  });

  test('Income stream offers "Choose a stream", then the seven streams in the guide\'s order, with no groups', async ({
    page,
  }) => {
    await openForm(page);
    expect(await optionsOf(streamField(page))).toEqual({
      options: [STREAM_PLACEHOLDER, ...STREAM_NAMES],
      optgroups: 0,
    });
  });

  test("with no stream chosen, there is no Event, Cash, Card, Amount or Payment method field", async ({ page }) => {
    await openForm(page);
    await expect(eventField(page)).toHaveCount(0);
    await expect(cashField(page)).toHaveCount(0);
    await expect(cardField(page)).toHaveCount(0);
    await expect(amountField(page)).toHaveCount(0);
    await expect(paymentGroup(page)).toHaveCount(0);
    await expect(anyRadio(page)).toHaveCount(0);
  });

  test("the form starts empty: no stream and no notes", async ({ page }) => {
    await openForm(page);
    await expect(streamField(page)).toHaveValue("");
    await expect(notesField(page)).toHaveValue("");
  });

  test("Tab order with no stream is Date, Income stream, Notes, Save, Cancel", async ({ page }) => {
    await openForm(page);
    await dateField(page).focus();
    expect(await tabOrderInMain(page)).toEqual([LABEL_DATE, LABEL_STREAM, LABEL_NOTES, "Save", "Cancel"]);
  });

  test("Tab order with Sales at events is Date, Income stream, Event, Cash, Card, Notes, Save, Cancel", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await dateField(page).focus();
    expect(await tabOrderInMain(page)).toEqual([
      LABEL_DATE,
      LABEL_STREAM,
      LABEL_EVENT,
      LABEL_CASH,
      LABEL_CARD,
      LABEL_NOTES,
      "Save",
      "Cancel",
    ]);
  });

  test("Tab order with Online sales is Date, Income stream, Amount, the payment radios (once), Notes, Save, Cancel", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    await dateField(page).focus();
    // With no radio checked, Tab enters the group on its first radio, "Cash".
    expect(await tabOrderInMain(page)).toEqual([
      LABEL_DATE,
      LABEL_STREAM,
      LABEL_AMOUNT,
      "Cash",
      LABEL_NOTES,
      "Save",
      "Cancel",
    ]);
  });

  test("Tab order with Vendor shelf rental is Date, Income stream, Event, Amount, the payment radios, Notes, Save, Cancel", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: VENDOR_SHELF });
    await dateField(page).focus();
    expect(await tabOrderInMain(page)).toEqual([
      LABEL_DATE,
      LABEL_STREAM,
      LABEL_EVENT,
      LABEL_AMOUNT,
      "Cash",
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

  test("a payment method can be chosen with the keyboard: Tab to the group, then Space checks Cash", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    await amountField(page).focus();
    await page.keyboard.press("Tab");
    await expect(paymentRadio(page, "Cash")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(paymentRadio(page, "Cash")).toBeChecked();
  });
});

// ═══ I3. The date ═══════════════════════════════════════════════════════════

test.describe("the date", () => {
  test(`defaults to today on the device: ${SYDNEY_TODAY} at 01:30 in Sydney (the UTC date is still 30 June)`, async ({
    page,
  }) => {
    await openForm(page);
    await expect(dateField(page)).toHaveValue(SYDNEY_TODAY);
  });

  test("is taken when the form opens: Home loaded at 23:59 on 30 June, form opened at 00:01 on 1 July shows 1 July", async ({
    page,
  }) => {
    await open(page, "/", new Date("2026-06-30T13:59:00.000Z")); // 23:59 in Sydney
    await waitForHydration(page);
    await page.clock.setFixedTime(new Date("2026-06-30T14:01:00.000Z")); // 00:01 on 1 July in Sydney
    await goClientSide(page, FORM_PATH);
    await expect(dateField(page)).toHaveValue("2026-07-01");
  });

  test("a changed date is saved on both takings rows (2026-06-15, shown 15/06/2026), and today's income on Home stays $0.00", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { date: "2026-06-15", stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, HOME_NO_INCOME)).toBeVisible();
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(rows(page).nth(i).locator("time")).toHaveAttribute("datetime", "2026-06-15");
      await expect(rows(page).nth(i).locator("time")).toHaveText("15/06/2026");
    }
  });

  test(`emptying the date and pressing Save shows "${ERROR_DATE}", focuses Date and adds nothing`, async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await dateField(page).fill("");
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_DATE)).toBeVisible();
    await expect(dateField(page)).toBeFocused();
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true");
    expect(await describedByTexts(dateField(page))).toContain(ERROR_DATE);
    await expect(page).toHaveURL(urlOnThisServer(page, FORM_PATH));
    await goHomeByNav(page, touch(testInfo));
    await expect(exactText(page, HOME_NO_INCOME)).toBeVisible();
  });
});

test.describe("the date late at night in Perth", () => {
  test.use({ timezoneId: PERTH });

  test(`defaults to ${PERTH_TODAY} at 23:30 in Perth`, async ({ page }) => {
    await openForm(page);
    await expect(dateField(page)).toHaveValue(PERTH_TODAY);
  });

  test("takings saved with the default date count in Perth's today on Home: $350.00 from 2 sales", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, "Today: $350.00 from 2 sales")).toBeVisible();
  });
});

// ═══ I5. Sales at events: event, cash, card, total ══════════════════════════

test.describe("Sales at events: the event", () => {
  test('the Event field offers "Not assigned yet" then the three pretend events, in that order', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    expect((await optionsOf(eventField(page))).options).toEqual([...EVENT_OPTIONS]);
  });

  test('the Event field starts on "Not assigned yet" (value "")', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expect(eventField(page)).toHaveValue("");
    expect(await selectedText(eventField(page))).toBe(NOT_ASSIGNED);
  });

  test("Sales at events shows Cash and Card, and no Amount or Payment method", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expect(cashField(page)).toBeVisible();
    await expect(cardField(page)).toBeVisible();
    await expect(amountField(page)).toHaveCount(0);
    await expect(paymentGroup(page)).toHaveCount(0);
    await expect(anyRadio(page)).toHaveCount(0);
  });

  test("Cash and Card start empty", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expect(cashField(page)).toHaveValue("");
    await expect(cardField(page)).toHaveValue("");
  });
});

test.describe("Sales at events: Reads as and the live total", () => {
  test('Cash "$1,000" shows "Reads as $1,000.00", linked to the Cash field', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "$1,000" });
    await expect(exactText(page, "Reads as $1,000.00")).toBeVisible();
    expect(await describedByTexts(cashField(page))).toContain("Reads as $1,000.00");
  });

  test('Card "2,000.5" shows "Reads as $2,000.50", linked to the Card field', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, card: "2,000.5" });
    await expect(exactText(page, "Reads as $2,000.50")).toBeVisible();
    expect(await describedByTexts(cardField(page))).toContain("Reads as $2,000.50");
  });

  test("each field's Reads as is its own: Cash's feedback isn't linked to Card, and Card's isn't linked to Cash", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "$1,000", card: "2,000.5" });
    const cash = await describedByTexts(cashField(page));
    const card = await describedByTexts(cardField(page));
    expect(cash).toContain("Reads as $1,000.00");
    expect(cash).not.toContain("Reads as $2,000.50");
    expect(card).toContain("Reads as $2,000.50");
    expect(card).not.toContain("Reads as $1,000.00");
  });

  test('Cash "$1,000" and Card "2,000.5" show exactly "Total $3,000.50" (100000 + 200050 cents)', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "$1,000", card: "2,000.5" });
    await expect(exactText(page, "Total $3,000.50")).toHaveCount(1);
    await expect(exactText(page, "Total $3,000.50")).toBeVisible();
  });

  test('Cash "0" and Card "0" show exactly "Total $0.00"', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "0", card: "0" });
    await expect(exactText(page, "Total $0.00")).toBeVisible();
  });

  test("the total sits in a polite live region", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await expect(exactText(page, "Total $350.00")).toBeVisible();
    expect(await liveRegionOf(exactText(page, "Total $350.00"))).toBe("polite");
  });

  test("the total follows typing: 100 + 250 = $350.00, then Card 250.5 gives $350.50", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await expect(exactText(page, "Total $350.00")).toBeVisible();
    await cardField(page).fill("250.5");
    await expect(exactText(page, "Total $350.50")).toBeVisible();
    await expect(exactText(page, "Total $350.00")).toHaveCount(0);
  });

  test("with only Cash filled in, no total is shown", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100" });
    await expect(exactText(page, "Reads as $100.00")).toBeVisible();
    await expect(totalText(page)).toHaveCount(0);
  });

  test("with Card invalid (10.505), no total is shown", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "10.505" });
    await expect(exactText(page, "Reads as $100.00")).toBeVisible();
    await expect(totalText(page)).toHaveCount(0);
  });

  test("making Cash invalid after a total showed removes the total (no stale sum)", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await expect(exactText(page, "Total $350.00")).toBeVisible();
    await cashField(page).fill("-100");
    await expect(totalText(page)).toHaveCount(0);
  });

  test("before anything is typed, no Reads as and no total are shown", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expect(readsAs(page)).toHaveCount(0);
    await expect(totalText(page)).toHaveCount(0);
  });
});

test.describe("Sales at events on a US-English device", () => {
  test.use({ locale: "en-US" });

  test('Cash "$1,000" and Card "2,000.5" show "Reads as A$1,000.00", "Reads as A$2,000.50" and "Total A$3,000.50"', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "$1,000", card: "2,000.5" });
    await expect(exactText(page, "Reads as A$1,000.00")).toBeVisible();
    await expect(exactText(page, "Reads as A$2,000.50")).toBeVisible();
    await expect(exactText(page, "Total A$3,000.50")).toBeVisible();
  });
});

test.describe("Sales at events: saving", () => {
  test('saving Cash $1,000 and Card $2,000.50 returns Home with "Today: $3,000.50 from 2 sales"', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "$1,000", card: "2,000.5" });
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, "Today: $3,000.50 from 2 sales")).toBeVisible();
  });

  test("with no event, Transactions lists two Sales at events rows: Card $2,000.50 first, then Cash $1,000.00", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "$1,000", card: "2,000.5" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(2);
    const first = await rowText(rows(page).nth(0));
    const second = await rowText(rows(page).nth(1));
    // Newest first: the card row was added after the cash row.
    expect(first).toMatch(/\bSales at events\b/);
    expect(first).toMatch(/\bCard\b/);
    expect(first).not.toMatch(/\bCash\b/);
    expect(amountsIn(first)).toEqual(["$2,000.50"]);
    expect(second).toMatch(/\bSales at events\b/);
    expect(second).toMatch(/\bCash\b/);
    expect(second).not.toMatch(/\bCard\b/);
    expect(amountsIn(second)).toEqual(["$1,000.00"]);
  });

  test("both rows are dated today (2026-07-01, shown 01/07/2026)", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(rows(page).nth(i).locator("time")).toHaveAttribute("datetime", SYDNEY_TODAY);
      await expect(rows(page).nth(i).locator("time")).toHaveText("01/07/2026");
    }
  });

  test('with the event "Pretend weekend market (today)", both rows show that event: $250.00 then $100.00', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, event: MARKET, cash: "100", card: "250" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(2);
    const texts = [await rowText(rows(page).nth(0)), await rowText(rows(page).nth(1))];
    for (const text of texts) {
      expect(text).toMatch(/\bSales at events\b/);
      expect(text).toContain(MARKET);
    }
    expect(texts.map((t) => amountsIn(t))).toEqual([["$250.00"], ["$100.00"]]);
  });

  test("$0 cash and $0 card still save both rows: Home says \"Today: $0.00 from 2 sales\"", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "0", card: "0" });
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, "Today: $0.00 from 2 sales")).toBeVisible();
  });

  test("$0 cash with $80 card saves both rows: Card $80.00 and Cash $0.00", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "0", card: "80" });
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, "Today: $80.00 from 2 sales")).toBeVisible();
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(2);
    const first = await rowText(rows(page).nth(0));
    const second = await rowText(rows(page).nth(1));
    expect(first).toMatch(/\bCard\b/);
    expect(amountsIn(first)).toEqual(["$80.00"]);
    expect(second).toMatch(/\bCash\b/);
    expect(amountsIn(second)).toEqual(["$0.00"]);
  });

  test("double-clicking Save adds the two rows once: $350.00 from 2 sales", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await saveButton(page).dblclick();
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await expect(exactText(page, "Today: $350.00 from 2 sales")).toBeVisible();
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(2);
  });

  test("pressing Enter in the Card field saves (the phone keyboard's Go key)", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await cardField(page).press("Enter");
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await expect(exactText(page, "Today: $350.00 from 2 sales")).toBeVisible();
  });
});

// ═══ I6. Every other stream: amount, payment method, event ══════════════════

test.describe("other streams: the fields", () => {
  for (const stream of ONE_AMOUNT_STREAMS) {
    test(`${stream} shows Amount and Payment method, and no Cash or Card amount fields`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { stream });
      await expect(amountField(page)).toBeVisible();
      await expect(paymentGroup(page)).toBeVisible();
      await expect(cashField(page)).toHaveCount(0);
      await expect(cardField(page)).toHaveCount(0);
      await expect(totalText(page)).toHaveCount(0);
    });
  }

  for (const stream of NO_EVENT_STREAMS) {
    test(`${stream} has no Event field`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { stream });
      await expect(amountField(page)).toBeVisible();
      await expect(eventField(page)).toHaveCount(0);
    });
  }

  test('Vendor shelf rental shows the Event field, starting on "Not assigned yet", with the same four options', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: VENDOR_SHELF });
    await expect(eventField(page)).toBeVisible();
    expect(await selectedText(eventField(page))).toBe(NOT_ASSIGNED);
    expect((await optionsOf(eventField(page))).options).toEqual([...EVENT_OPTIONS]);
  });

  test("Amount starts empty", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Wholesale" });
    await expect(amountField(page)).toHaveValue("");
  });
});

test.describe("other streams: the amount's live feedback", () => {
  for (const { typed, shown, why } of VALID_AMOUNTS) {
    test(`Amount "${typed}" shows "Reads as ${shown}" (${why}), linked to the Amount field`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { stream: "Commissions", amount: typed });
      await expect(exactText(page, `Reads as ${shown}`)).toBeVisible();
      expect(await describedByTexts(amountField(page))).toContain(`Reads as ${shown}`);
    });
  }

  test('changing a valid "12.5" to the invalid "12.505" removes the feedback (no stale value)', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Commissions", amount: "12.5" });
    await expect(exactText(page, "Reads as $12.50")).toBeVisible();
    await amountField(page).fill("12.505");
    await expect(readsAs(page)).toHaveCount(0);
  });

  test("typing an invalid amount shows no error until Save is pressed", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Commissions", amount: "10.505" });
    await expectNoErrorsShown(page);
  });
});

test.describe("other streams: saving", () => {
  test('Wholesale $1,234.56 by Bank transfer returns Home with "Today: $1,234.56 from 1 sale"', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Wholesale", amount: "1,234.56", payment: "Bank transfer" });
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, "Today: $1,234.56 from 1 sale")).toBeVisible();
  });

  test("on Transactions, the Wholesale row shows Wholesale, Bank transfer, $1,234.56 and today's date", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Wholesale", amount: "1,234.56", payment: "Bank transfer" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(1);
    const text = await rowText(rows(page).first());
    expect(text).toMatch(/\bWholesale\b/);
    expect(text).toMatch(/\bBank transfer\b/);
    expect(amountsIn(text)).toEqual(["$1,234.56"]);
    await expect(rows(page).first().locator("time")).toHaveAttribute("datetime", SYDNEY_TODAY);
  });

  // Each radio saves its own payment method: the row (no event) shows its label.
  for (const method of PAYMENT_LABELS) {
    test(`choosing "${method}" saves an income whose row says "${method}"`, async ({ page }, testInfo) => {
      await openForm(page);
      await fillForm(page, { stream: "Commissions", amount: "5", payment: method });
      await saveAndExpect(page, touch(testInfo));
      await goToTransactions(page);
      await expect(rows(page)).toHaveCount(1);
      const text = await rowText(rows(page).first());
      expect(text).toMatch(/\bCommissions\b/);
      const others = PAYMENT_LABELS.filter((m) => m !== method);
      expect(text).toContain(method);
      for (const other of others) {
        // "Card" and "Cash" are whole words; check none of the other labels appears.
        expect(text, `row text "${text}" must not say "${other}"`).not.toMatch(new RegExp(`\\b${other}\\b`));
      }
      expect(amountsIn(text)).toEqual(["$5.00"]);
    });
  }

  for (const stream of ONE_AMOUNT_STREAMS) {
    test(`a ${stream} income is listed under its own stream's name`, async ({ page }, testInfo) => {
      await openForm(page);
      await fillForm(page, { stream, amount: "9.99", payment: "Online" });
      await saveAndExpect(page, touch(testInfo));
      await expect(exactText(page, "Today: $9.99 from 1 sale")).toBeVisible();
      await goToTransactions(page);
      await expect(rows(page)).toHaveCount(1);
      const text = await rowText(rows(page).first());
      const labels = STREAM_NAMES.filter((s) => new RegExp(`\\b${escapeRegExp(s)}\\b`).test(text));
      expect(labels).toEqual([stream]);
    });
  }

  test("a $0.00 income can be saved: Home says \"Today: $0.00 from 1 sale\"", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Social media", amount: "0", payment: "Online" });
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, "Today: $0.00 from 1 sale")).toBeVisible();
  });

  test('Vendor shelf rental $45 with the event "Pretend gallery shelf" is listed with that event', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: VENDOR_SHELF, event: SHELF, amount: "45", payment: "Bank transfer" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(1);
    const text = await rowText(rows(page).first());
    expect(text).toMatch(/\bVendor shelf rental\b/);
    expect(text).toContain(SHELF);
    expect(text).not.toMatch(/\bBank transfer\b/);
    expect(amountsIn(text)).toEqual(["$45.00"]);
  });

  test('Vendor shelf rental left on "Not assigned yet" is listed by its payment method', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: VENDOR_SHELF, amount: "45", payment: "Bank transfer" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(1);
    const text = await rowText(rows(page).first());
    expect(text).toMatch(/\bBank transfer\b/);
    expect(text).not.toContain(SHELF);
  });

  test("double-clicking Save adds exactly one income", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "23.50", payment: "Online" });
    await saveButton(page).dblclick();
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await expect(exactText(page, "Today: $23.50 from 1 sale")).toBeVisible();
  });

  test("pressing Enter in the Amount field saves (the phone keyboard's Go key)", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "7.25", payment: "Card" });
    await amountField(page).press("Enter");
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await expect(exactText(page, "Today: $7.25 from 1 sale")).toBeVisible();
  });
});

test.describe("switching streams clears an event the new stream can't have", () => {
  test("Sales at events with a convention, switched to Online sales and back, shows \"Not assigned yet\"", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, event: COMIC_CON });
    await fillForm(page, { stream: "Online sales" });
    await expect(eventField(page)).toHaveCount(0);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    expect(await selectedText(eventField(page))).toBe(NOT_ASSIGNED);
  });

  test("Vendor shelf rental with the shelf, switched to Wholesale, saves with no event", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: VENDOR_SHELF, event: SHELF });
    await fillForm(page, { stream: "Wholesale", amount: "60", payment: "Bank transfer" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(1);
    const text = await rowText(rows(page).first());
    expect(text).toMatch(/\bWholesale\b/);
    expect(text).toMatch(/\bBank transfer\b/);
    expect(text).not.toContain(SHELF);
  });

  test("Vendor shelf rental with the shelf, switched to Social media and back, shows \"Not assigned yet\"", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: VENDOR_SHELF, event: SHELF });
    await fillForm(page, { stream: "Social media" });
    await fillForm(page, { stream: VENDOR_SHELF });
    expect(await selectedText(eventField(page))).toBe(NOT_ASSIGNED);
  });
});

// ═══ I7. Errors after Save ══════════════════════════════════════════════════

test.describe("a missing stream", () => {
  test(`Save with no stream shows exactly "${ERROR_STREAM}", marks the field invalid and links the message`, async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_STREAM)).toBeVisible();
    await expect(streamField(page)).toHaveAttribute("aria-invalid", "true");
    expect(await describedByTexts(streamField(page))).toContain(ERROR_STREAM);
  });

  test("Save with no stream is blocked: focus moves to Income stream and nothing is added", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await press(saveButton(page), touch(testInfo));
    await expect(streamField(page)).toBeFocused();
    await expect(page).toHaveURL(urlOnThisServer(page, FORM_PATH));
    await goHomeByNav(page, touch(testInfo));
    await expect(exactText(page, HOME_NO_INCOME)).toBeVisible();
  });

  test("with the date emptied and no stream, focus goes to Date (first in order) and both errors show", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await dateField(page).fill("");
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_DATE)).toBeVisible();
    await expect(exactText(page, ERROR_STREAM)).toBeVisible();
    await expect(dateField(page)).toBeFocused();
  });

  test("choosing a stream after the error removes it", async ({ page }, testInfo) => {
    await openForm(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_STREAM)).toBeVisible();
    await fillForm(page, { stream: "Online sales" });
    await expect(exactText(page, ERROR_STREAM)).toHaveCount(0);
    await expect(streamField(page)).not.toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("Sales at events: missing or rejected amounts", () => {
  test(`with Cash and Card both empty, Save shows "${ERROR_CASH_EMPTY}" and "${ERROR_CARD_EMPTY}", each linked to its own field`, async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CASH_EMPTY)).toBeVisible();
    await expect(exactText(page, ERROR_CARD_EMPTY)).toBeVisible();
    await expect(cashField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(cardField(page)).toHaveAttribute("aria-invalid", "true");
    const cash = await describedByTexts(cashField(page));
    const card = await describedByTexts(cardField(page));
    expect(cash).toContain(ERROR_CASH_EMPTY);
    expect(cash).not.toContain(ERROR_CARD_EMPTY);
    expect(card).toContain(ERROR_CARD_EMPTY);
    expect(card).not.toContain(ERROR_CASH_EMPTY);
  });

  test("with Cash and Card both empty, focus moves to Cash and nothing is added", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await press(saveButton(page), touch(testInfo));
    await expect(cashField(page)).toBeFocused();
    await expect(page).toHaveURL(urlOnThisServer(page, FORM_PATH));
    await goHomeByNav(page, touch(testInfo));
    await expect(exactText(page, HOME_NO_INCOME)).toBeVisible();
  });

  test(`with Cash filled and Card empty, only "${ERROR_CARD_EMPTY}" shows and focus moves to Card`, async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CARD_EMPTY)).toBeVisible();
    await expect(exactText(page, ERROR_CASH_EMPTY)).toHaveCount(0);
    await expect(cardField(page)).toBeFocused();
    await expect(cashField(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  test(`Cash of only spaces counts as empty: "${ERROR_CASH_EMPTY}"`, async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "   ", card: "5" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CASH_EMPTY)).toBeVisible();
  });

  for (const [label, field, other] of [
    [LABEL_CASH, cashField, cardField],
    [LABEL_CARD, cardField, cashField],
  ] as const) {
    for (const typed of ["10.505", "-5", "abc"]) {
      test(`${label} "${typed}" is rejected after Save with the amount message, linked to ${label}, and nothing is added`, async ({
        page,
      }, testInfo) => {
        await openForm(page);
        await fillForm(page, { stream: SALES_AT_EVENTS });
        await field(page).fill(typed);
        await other(page).fill("5");
        await press(saveButton(page), touch(testInfo));
        await expect(exactText(page, ERROR_AMOUNT_INVALID)).toHaveCount(1);
        await expect(field(page)).toHaveAttribute("aria-invalid", "true");
        expect(await describedByTexts(field(page))).toContain(ERROR_AMOUNT_INVALID);
        await expect(field(page)).toBeFocused();
        await expect(page).toHaveURL(urlOnThisServer(page, FORM_PATH));
        await goHomeByNav(page, touch(testInfo));
        await expect(exactText(page, HOME_NO_INCOME)).toBeVisible();
      });
    }
  }

  test("fixing Cash after an error removes the error and aria-invalid, and shows its Reads as and the total", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "10.505", card: "5" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toBeVisible();
    await cashField(page).fill("10.5");
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toHaveCount(0);
    await expect(cashField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(exactText(page, "Reads as $10.50")).toBeVisible();
    // 1050 + 500 = 1550 cents.
    await expect(exactText(page, "Total $15.50")).toBeVisible();
  });

  test("typing invalid Cash and Card shows no error until Save is pressed", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "-1", card: "abc" });
    await expectNoErrorsShown(page);
  });
});

test.describe("other streams: missing or rejected amounts and payment method", () => {
  for (const { typed, error, why } of INVALID_AMOUNTS) {
    test(`Amount "${typed}" (${why}): Save shows exactly "${error}", linked to Amount, and adds nothing`, async ({
      page,
    }, testInfo) => {
      await openForm(page);
      await fillForm(page, { stream: "Online sales", amount: typed, payment: "Online" });
      await press(saveButton(page), touch(testInfo));
      await expect(exactText(page, error)).toBeVisible();
      await expect(amountField(page)).toHaveAttribute("aria-invalid", "true");
      expect(await describedByTexts(amountField(page))).toContain(error);
      await expect(amountField(page)).toBeFocused();
      await expect(readsAs(page)).toHaveCount(0);
      await expect(page).toHaveURL(urlOnThisServer(page, FORM_PATH));
      await goHomeByNav(page, touch(testInfo));
      await expect(exactText(page, HOME_NO_INCOME)).toBeVisible();
    });
  }

  test(`with no payment method, Save shows exactly "${ERROR_PAYMENT}", linked to the Payment method group`, async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "23.50" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_PAYMENT)).toBeVisible();
    expect(await describedByTexts(paymentGroup(page))).toContain(ERROR_PAYMENT);
  });

  test('with no payment method, Save is blocked: focus moves to the first radio, "Cash", and nothing is added', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "23.50" });
    await press(saveButton(page), touch(testInfo));
    await expect(paymentRadio(page, "Cash")).toBeFocused();
    await expect(page).toHaveURL(urlOnThisServer(page, FORM_PATH));
    await goHomeByNav(page, touch(testInfo));
    await expect(exactText(page, HOME_NO_INCOME)).toBeVisible();
  });

  test("with the amount empty and no payment method, both errors show and focus goes to Amount (first in order)", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toBeVisible();
    await expect(exactText(page, ERROR_PAYMENT)).toBeVisible();
    await expect(amountField(page)).toBeFocused();
  });

  test("choosing a payment method after the error removes it", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "23.50" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_PAYMENT)).toBeVisible();
    await paymentRadio(page, "Card").check();
    await expect(exactText(page, ERROR_PAYMENT)).toHaveCount(0);
  });

  test('fixing the amount after an error removes the error and aria-invalid, and shows "Reads as $10.50"', async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "10.505", payment: "Online" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toBeVisible();
    await amountField(page).fill("10.5");
    await expect(exactText(page, ERROR_AMOUNT_INVALID)).toHaveCount(0);
    await expect(amountField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(exactText(page, "Reads as $10.50")).toBeVisible();
  });
});

// ═══ I8. Pre-fill from the page address ═════════════════════════════════════

test.describe("pre-fill from the page address", () => {
  test("?stream=online-sales selects Online sales, with Amount and Payment method and no Event", async ({ page }) => {
    await openForm(page, "?stream=online-sales");
    await expect.poll(() => selectedText(streamField(page))).toBe("Online sales");
    await expect(amountField(page)).toBeVisible();
    await expect(paymentGroup(page)).toBeVisible();
    await expect(eventField(page)).toHaveCount(0);
  });

  test('?stream=sales-at-events selects Sales at events, with the Event on "Not assigned yet"', async ({ page }) => {
    await openForm(page, "?stream=sales-at-events");
    await expect.poll(() => selectedText(streamField(page))).toBe(SALES_AT_EVENTS);
    await expect(cashField(page)).toBeVisible();
    expect(await selectedText(eventField(page))).toBe(NOT_ASSIGNED);
  });

  test("?event=pretend-event-shelf selects Vendor shelf rental and Pretend gallery shelf", async ({ page }) => {
    await openForm(page, "?event=pretend-event-shelf");
    await expect.poll(() => selectedText(streamField(page))).toBe(VENDOR_SHELF);
    await expect.poll(() => selectedText(eventField(page))).toBe(SHELF);
    await expect(amountField(page)).toBeVisible();
  });

  test("?event=pretend-event-comic-con selects Sales at events and Pretend comic convention", async ({ page }) => {
    await openForm(page, "?event=pretend-event-comic-con");
    await expect.poll(() => selectedText(streamField(page))).toBe(SALES_AT_EVENTS);
    await expect.poll(() => selectedText(eventField(page))).toBe(COMIC_CON);
    await expect(cashField(page)).toBeVisible();
  });

  test("?event=pretend-event-todays-market selects Sales at events and Pretend weekend market (today)", async ({
    page,
  }) => {
    await openForm(page, "?event=pretend-event-todays-market");
    await expect.poll(() => selectedText(streamField(page))).toBe(SALES_AT_EVENTS);
    await expect.poll(() => selectedText(eventField(page))).toBe(MARKET);
  });

  test("?stream=vendor-shelf-rental&event=pretend-event-comic-con applies both (the usual stream is only a default)", async ({
    page,
  }) => {
    await openForm(page, "?stream=vendor-shelf-rental&event=pretend-event-comic-con");
    await expect.poll(() => selectedText(streamField(page))).toBe(VENDOR_SHELF);
    await expect.poll(() => selectedText(eventField(page))).toBe(COMIC_CON);
  });

  test("?stream=sales-at-events&event=pretend-event-shelf applies both", async ({ page }) => {
    await openForm(page, "?stream=sales-at-events&event=pretend-event-shelf");
    await expect.poll(() => selectedText(streamField(page))).toBe(SALES_AT_EVENTS);
    await expect.poll(() => selectedText(eventField(page))).toBe(SHELF);
  });

  test("?stream=online-sales&event=pretend-event-comic-con selects Online sales and ignores the event", async ({
    page,
  }) => {
    await openForm(page, "?stream=online-sales&event=pretend-event-comic-con");
    await expect.poll(() => selectedText(streamField(page))).toBe("Online sales");
    await expect(eventField(page)).toHaveCount(0);
    await expectNoErrorsShown(page);
  });

  test("?stream=online-sales&event=pretend-event-comic-con saves an Online sales row with no event", async ({
    page,
  }, testInfo) => {
    await openForm(page, "?stream=online-sales&event=pretend-event-comic-con");
    await expect.poll(() => selectedText(streamField(page))).toBe("Online sales");
    await fillForm(page, { amount: "12", payment: "Online" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(1);
    const text = await rowText(rows(page).first());
    expect(text).toMatch(/\bOnline sales\b/);
    expect(text).not.toContain(COMIC_CON);
    expect(amountsIn(text)).toEqual(["$12.00"]);
  });

  test("takings saved from ?event=pretend-event-comic-con are linked to the convention", async ({
    page,
  }, testInfo) => {
    await openForm(page, "?event=pretend-event-comic-con");
    await expect.poll(() => selectedText(eventField(page))).toBe(COMIC_CON);
    await fillForm(page, { cash: "1,000", card: "2,000" });
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, "Today: $3,000.00 from 2 sales")).toBeVisible();
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const text = await rowText(rows(page).nth(i));
      expect(text).toMatch(/\bSales at events\b/);
      expect(text).toContain(COMIC_CON);
    }
  });

  test("a pre-filled stream can still be changed", async ({ page }) => {
    await openForm(page, "?stream=online-sales");
    await expect.poll(() => selectedText(streamField(page))).toBe("Online sales");
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expect(cashField(page)).toBeVisible();
    await expect(amountField(page)).toHaveCount(0);
  });

  test("a pre-filled form shows no errors before Save", async ({ page }) => {
    await openForm(page, "?event=pretend-event-shelf");
    await expect.poll(() => selectedText(eventField(page))).toBe(SHELF);
    await expectNoErrorsShown(page);
  });

  test("pre-fill works after a client-side move to the form too (?stream=wholesale)", async ({ page }) => {
    await openFormFromHome(page, `${FORM_PATH}?stream=wholesale`);
    await expect.poll(() => selectedText(streamField(page))).toBe("Wholesale");
    await expect(amountField(page)).toBeVisible();
  });

  const UNKNOWN: readonly { query: string; why: string; stream: string; event: string | null }[] = [
    { query: "?stream=nope", why: "an unknown stream id", stream: STREAM_PLACEHOLDER, event: null },
    { query: "?stream=Online%20sales", why: "a stream's name, not its id", stream: STREAM_PLACEHOLDER, event: null },
    { query: "?stream=ONLINE-SALES", why: "another letter case", stream: STREAM_PLACEHOLDER, event: null },
    { query: "?event=nope", why: "an unknown event id", stream: STREAM_PLACEHOLDER, event: null },
    { query: "?stream=online-sales&event=nope", why: "a known stream with an unknown event", stream: "Online sales", event: null },
    { query: "?stream=sales-at-events&event=nope", why: "an unknown event on a stream with events", stream: SALES_AT_EVENTS, event: NOT_ASSIGNED },
    { query: "?stream=nope&event=pretend-event-shelf", why: "an unknown stream counts as none given, so the event brings its usual stream", stream: VENDOR_SHELF, event: SHELF },
  ];
  for (const u of UNKNOWN) {
    test(`${u.query} (${u.why}) is handled silently: stream "${u.stream}", event ${u.event === null ? "field absent" : `"${u.event}"`}, no error`, async ({
      page,
    }) => {
      await openForm(page, u.query);
      await expect.poll(() => selectedText(streamField(page))).toBe(u.stream);
      if (u.event === null) await expect(eventField(page)).toHaveCount(0);
      else await expect.poll(() => selectedText(eventField(page))).toBe(u.event);
      await expectNoErrorsShown(page);
    });
  }
});

// ═══ I9. Where Save and Cancel go: the safe `back` address ══════════════════

test.describe("after Save: the safe back address", () => {
  test("with no back, Save goes to Home", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "5", payment: "Online" });
    await saveAndExpect(page, touch(testInfo), "/", "Home");
  });

  for (const { value, heading } of SAFE_BACKS) {
    test(`with back=${value} (safe), Save goes to ${value} and the income is kept`, async ({ page }, testInfo) => {
      await openFormFromHome(page, formWithBack(value));
      await fillForm(page, { stream: "Online sales", amount: "5", payment: "Online" });
      await saveAndExpect(page, touch(testInfo), value, heading);
      await goToTransactions(page);
      await expect(rows(page)).toHaveCount(1);
    });
  }

  for (const { value, why } of UNSAFE_BACKS) {
    test(`with back=${JSON.stringify(value)} (${why}), Save goes to Home on this server and the income is kept`, async ({
      page,
    }, testInfo) => {
      await openFormFromHome(page, formWithBack(value));
      await fillForm(page, { stream: "Online sales", amount: "5", payment: "Online" });
      await saveAndExpect(page, touch(testInfo), "/", "Home");
      await expect(exactText(page, "Today: $5.00 from 1 sale")).toBeVisible();
    });
  }

  test("Save replaces the form in the history: Back afterwards goes to the page before the form, not the form", async ({
    page,
  }, testInfo) => {
    await openFormFromHome(page, formWithBack("/events"));
    await fillForm(page, { stream: "Online sales", amount: "5", payment: "Online" });
    await saveAndExpect(page, touch(testInfo), "/events", "Events");
    await page.goBack();
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Home");
    // Still the same page session (Back was a client-side move), so the income is there.
    await expect(exactText(page, "Today: $5.00 from 1 sale")).toBeVisible();
  });

  test("opening the form again after a save shows a fresh form", async ({ page }, testInfo) => {
    await openFormFromHome(page);
    await fillForm(page, { date: "2026-06-20", stream: SALES_AT_EVENTS, event: MARKET, cash: "1", card: "2", notes: "x" });
    await saveAndExpect(page, touch(testInfo));
    await goClientSide(page, FORM_PATH);
    await waitForForm(page);
    await expect(dateField(page)).toHaveValue(SYDNEY_TODAY);
    await expect(streamField(page)).toHaveValue("");
    await expect(notesField(page)).toHaveValue("");
    await expect(eventField(page)).toHaveCount(0);
    await expect(cashField(page)).toHaveCount(0);
    await expect(readsAs(page)).toHaveCount(0);
    await expect(totalText(page)).toHaveCount(0);
  });
});

test.describe("Cancel", () => {
  test('with no back, Cancel is a link to "/"', async ({ page }) => {
    await openForm(page);
    await expect(cancelLink(page)).toHaveAttribute("href", "/");
  });

  test('with back=/events, Cancel is a link to "/events"', async ({ page }) => {
    await openForm(page, `?back=${encodeURIComponent("/events")}`);
    await expect(cancelLink(page)).toHaveAttribute("href", "/events");
  });

  test('with an unsafe back (//evil.example), Cancel is a link to "/"', async ({ page }) => {
    await openForm(page, `?back=${encodeURIComponent("//evil.example")}`);
    await expect(cancelLink(page)).toHaveAttribute("href", "/");
  });

  test("Cancel returns to Home and adds nothing", async ({ page }, testInfo) => {
    await openFormFromHome(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await press(cancelLink(page), touch(testInfo));
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await expect(exactText(page, HOME_NO_INCOME)).toBeVisible();
  });

  test("after Cancel, Transactions still has no entries", async ({ page }, testInfo) => {
    await openFormFromHome(page);
    await fillForm(page, { stream: "Online sales", amount: "5", payment: "Online" });
    await press(cancelLink(page), touch(testInfo));
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await goToTransactions(page);
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toBeVisible();
  });
});

// ═══ I11. Layout and access on a phone ══════════════════════════════════════

test.describe("on a phone, the form is comfortable to use", () => {
  test("on a phone, with Sales at events, every field, Save and Cancel are at least 44×44 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    const controls: [string, Locator][] = [
      [LABEL_DATE, dateField(page)],
      [LABEL_STREAM, streamField(page)],
      [LABEL_EVENT, eventField(page)],
      [LABEL_CASH, cashField(page)],
      [LABEL_CARD, cardField(page)],
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

  test("on a phone, with Vendor shelf rental, Event, Amount and each payment method's label are at least 44×44 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    await fillForm(page, { stream: VENDOR_SHELF });
    const small: string[] = [];
    for (const [name, control] of [
      [LABEL_EVENT, eventField(page)],
      [LABEL_AMOUNT, amountField(page)],
    ] as const) {
      const b = await control.boundingBox();
      if (b === null || b.width < MIN_TAP_TARGET_PX || b.height < MIN_TAP_TARGET_PX) {
        small.push(`${name}: ${b === null ? "not rendered" : `${b.width.toFixed(1)}×${b.height.toFixed(1)}`}`);
      }
    }
    const labelBoxes = await paymentGroup(page).evaluate((group) =>
      Array.from(group.querySelectorAll('input[type="radio"]')).map((r) => {
        const label = (r as HTMLInputElement).labels?.[0];
        const b = label?.getBoundingClientRect();
        return { name: (label?.innerText ?? "?").trim(), width: b?.width ?? 0, height: b?.height ?? 0 };
      }),
    );
    expect(labelBoxes).toHaveLength(5);
    for (const l of labelBoxes) {
      if (l.width < MIN_TAP_TARGET_PX || l.height < MIN_TAP_TARGET_PX) {
        small.push(`label "${l.name}": ${l.width.toFixed(1)}×${l.height.toFixed(1)}`);
      }
    }
    expect(small, "controls and radio labels smaller than 44×44 px").toEqual([]);
  });

  test("on a phone, tapping a payment method's label checks its radio", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    await press(paymentGroup(page).locator("label", { hasText: /^\s*Bank transfer\s*$/ }), true);
    await expect(paymentRadio(page, "Bank transfer")).toBeChecked();
  });

  test("on a phone, text in every field is at least 16 px (so iPhones don't zoom in), in both shapes", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    const tooSmall: string[] = [];
    for (const stream of [SALES_AT_EVENTS, VENDOR_SHELF]) {
      await fillForm(page, { stream });
      const sizes = await main(page).evaluate((m) =>
        Array.from(m.querySelectorAll('input:not([type="hidden"]):not([type="radio"]), select, textarea')).map((el) => ({
          label: ((el as HTMLInputElement).labels?.[0]?.innerText ?? el.tagName).replace(/\s+/g, " ").trim(),
          px: parseFloat(getComputedStyle(el).fontSize),
        })),
      );
      // Sales at events: Date, Stream, Event, Cash, Card, Notes = 6.
      // Vendor shelf rental: Date, Stream, Event, Amount, Notes = 5.
      expect(sizes.length, `text fields with ${stream}`).toBe(stream === SALES_AT_EVENTS ? 6 : 5);
      tooSmall.push(...sizes.filter((s) => s.px < MIN_INPUT_FONT_PX).map((s) => `${stream} / ${s.label}: ${s.px}px`));
    }
    expect(tooSmall).toEqual([]);
  });

  test("on a phone at 390×844, Tab through the form keeps each focused element clear of the nav", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    await fillForm(page, { stream: VENDOR_SHELF });
    await startTabbingFromTheTop(page);
    await expectTabKeepsMainFocusClearOfNav(page);
  });
});

test.describe("on a phone at 320×568 with 200% text", () => {
  const NARROW = { width: 320, height: 568 } as const;

  /** Opens the form at 320×568 and 200% text, in one shape, with an error showing. */
  async function openBigTextFormWithError(page: Page, hasTouch: boolean, shape: "takings" | "one amount"): Promise<void> {
    await page.setViewportSize(NARROW);
    await openForm(page);
    await setTextSize(page, 200, "32px");
    if (shape === "takings") {
      await fillForm(page, { stream: SALES_AT_EVENTS, event: MARKET, cash: "10.505", card: "2,000.5" });
    } else {
      await fillForm(page, { stream: VENDOR_SHELF, event: SHELF, amount: "1,234.5" });
    }
    await saveButton(page).scrollIntoViewIfNeeded();
    await press(saveButton(page), hasTouch);
    await expect(
      exactText(page, shape === "takings" ? ERROR_AMOUNT_INVALID : ERROR_PAYMENT),
    ).toBeVisible();
  }

  for (const shape of ["takings", "one amount"] as const) {
    test(`on a phone at 320×568 and 200% text (${shape}), the form doesn't scroll sideways`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openBigTextFormWithError(page, touch(testInfo), shape);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(clientWidth).toBe(NARROW.width);
      expect(scrollWidth, "scrollable width must not exceed the page width").toBeLessThanOrEqual(clientWidth);
    });

    test(`on a phone at 320×568 and 200% text (${shape}), every label, field, message and button stays inside 0–320 px`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openBigTextFormWithError(page, touch(testInfo), shape);
      expect(await outsideWidth(page, NARROW.width)).toEqual([]);
    });

    test(`on a phone at 320×568 and 200% text (${shape}), Tab never leaves a focused element hidden or under the nav`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openBigTextFormWithError(page, touch(testInfo), shape);
      await startTabbingFromTheTop(page);
      await expectTabKeepsMainFocusClearOfNav(page);
    });

    test(`on a phone at 320×568 and 200% text (${shape}), Save can be scrolled fully on screen, clear of the nav`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openBigTextFormWithError(page, touch(testInfo), shape);
      await saveButton(page).scrollIntoViewIfNeeded();
      await expect(saveButton(page)).toBeInViewport({ ratio: 1 });
      const save = await saveButton(page).boundingBox();
      const nav = await mainNav(page).boundingBox();
      expect(save).not.toBeNull();
      expect(nav).not.toBeNull();
      const overlaps = save!.y + save!.height > nav!.y + EDGE_TOLERANCE_PX && save!.y < nav!.y + nav!.height - EDGE_TOLERANCE_PX;
      expect(overlaps, `Save (${save!.y.toFixed(1)}–${(save!.y + save!.height).toFixed(1)}) overlaps the nav (${nav!.y.toFixed(1)}–${(nav!.y + nav!.height).toFixed(1)})`).toBe(false);
    });
  }

  test("on a phone at 320×568 and 200% text, takings can still be saved and counted on Home", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize(NARROW);
    await openForm(page);
    await setTextSize(page, 200, "32px");
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await saveButton(page).scrollIntoViewIfNeeded();
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, "Today: $350.00 from 2 sales")).toBeVisible();
  });

  test("on a phone at 320×568 and 200% text, a one-amount income can still be saved and counted on Home", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize(NARROW);
    await openForm(page);
    await setTextSize(page, 200, "32px");
    await fillForm(page, { stream: "Wholesale", amount: "1,234.56" });
    const label = paymentGroup(page).locator("label", { hasText: /^\s*Bank transfer\s*$/ });
    await label.scrollIntoViewIfNeeded();
    await press(label, touch(testInfo));
    await saveButton(page).scrollIntoViewIfNeeded();
    await saveAndExpect(page, touch(testInfo));
    await expect(exactText(page, "Today: $1,234.56 from 1 sale")).toBeVisible();
  });
});

// ═══ T1.12b ═════════════════════════════════════════════════════════════════

/** Checks Cash and Card show no message and no aria-invalid. */
async function expectTakingsFieldsQuiet(page: Page): Promise<void> {
  await expect(cashField(page)).toBeVisible();
  await expect(cardField(page)).toBeVisible();
  await expect(exactText(page, ERROR_CASH_EMPTY)).toHaveCount(0);
  await expect(exactText(page, ERROR_CARD_EMPTY)).toHaveCount(0);
  await expect(exactText(page, ERROR_AMOUNT_INVALID)).toHaveCount(0);
  await expect(cashField(page)).not.toHaveAttribute("aria-invalid", "true");
  await expect(cardField(page)).not.toHaveAttribute("aria-invalid", "true");
}

/** Checks Amount and Payment method show no message and no aria-invalid. */
async function expectOneAmountFieldsQuiet(page: Page): Promise<void> {
  await expect(amountField(page)).toBeVisible();
  await expect(paymentGroup(page)).toBeVisible();
  await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toHaveCount(0);
  await expect(exactText(page, ERROR_AMOUNT_INVALID)).toHaveCount(0);
  await expect(exactText(page, ERROR_PAYMENT)).toHaveCount(0);
  await expect(amountField(page)).not.toHaveAttribute("aria-invalid", "true");
  expect(await describedByTexts(paymentGroup(page))).not.toContain(ERROR_PAYMENT);
}

// ─── I13. A shape change doesn't bring premature errors ─────────────────────

test.describe("T1.12b: after a blocked Save, a new shape shows no errors until the next Save", () => {
  test(`Save on an empty form, then Sales at events: "${ERROR_STREAM}" goes and Cash and Card show no error or aria-invalid`, async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_STREAM)).toBeVisible();
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expect(exactText(page, ERROR_STREAM)).toHaveCount(0);
    await expectTakingsFieldsQuiet(page);
    await expectNoErrorsShown(page);
  });

  test("Save on an empty form, then Sales at events, then Save again: both cash and card errors show and focus moves to Cash", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await press(saveButton(page), touch(testInfo));
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expectTakingsFieldsQuiet(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CASH_EMPTY)).toBeVisible();
    await expect(exactText(page, ERROR_CARD_EMPTY)).toBeVisible();
    await expect(cashField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(cardField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(cashField(page)).toBeFocused();
  });

  test(`Save on an empty form, then Online sales: "${ERROR_STREAM}" goes and Amount and Payment method show no error or aria-invalid`, async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_STREAM)).toBeVisible();
    await fillForm(page, { stream: "Online sales" });
    await expect(exactText(page, ERROR_STREAM)).toHaveCount(0);
    await expectOneAmountFieldsQuiet(page);
    await expectNoErrorsShown(page);
  });

  test("Save on an empty form, then Online sales, then Save again: the amount and payment errors show and focus moves to Amount", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await press(saveButton(page), touch(testInfo));
    await fillForm(page, { stream: "Online sales" });
    await expectOneAmountFieldsQuiet(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toBeVisible();
    await expect(exactText(page, ERROR_PAYMENT)).toBeVisible();
    await expect(amountField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(amountField(page)).toBeFocused();
  });

  test("cash/card errors showing, then switching to Wholesale: Amount and Payment method show no error until the next Save", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CASH_EMPTY)).toBeVisible();
    await fillForm(page, { stream: "Wholesale" });
    await expectOneAmountFieldsQuiet(page);
    await expectNoErrorsShown(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toBeVisible();
    await expect(exactText(page, ERROR_PAYMENT)).toBeVisible();
  });

  test("amount/payment errors showing, then switching to Sales at events: Cash and Card show no error until the next Save", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toBeVisible();
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expectTakingsFieldsQuiet(page);
    await expectNoErrorsShown(page);
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CASH_EMPTY)).toBeVisible();
    await expect(cashField(page)).toBeFocused();
  });

  test("cash/card errors showing, then switching to Vendor shelf rental (the one-amount stream that keeps the event): Amount and Payment method show no error", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_CARD_EMPTY)).toBeVisible();
    await fillForm(page, { stream: VENDOR_SHELF });
    await expectOneAmountFieldsQuiet(page);
  });
});

// ─── I14. The form starts fresh when back is the form itself ────────────────

test.describe("T1.12b: with back=/income/new, Save starts a fresh form", () => {
  const SELF_BACK = `?back=${encodeURIComponent(FORM_PATH)}`;

  test("after a valid Save, the page is /income/new again with an empty form", async ({ page }, testInfo) => {
    await openForm(page, SELF_BACK);
    await fillForm(page, { date: "2026-06-20", stream: "Online sales", amount: "5", payment: "Online", notes: "first" });
    await press(saveButton(page), touch(testInfo));
    await expect(page).toHaveURL(urlOnThisServer(page, FORM_PATH));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(FORM_HEADING);
    await expect.poll(() => selectedText(streamField(page))).toBe(STREAM_PLACEHOLDER);
    await expect(streamField(page)).toHaveValue("");
    await expect(amountField(page)).toHaveCount(0);
    await expect(paymentGroup(page)).toHaveCount(0);
    await expect(notesField(page)).toHaveValue("");
    await expect(dateField(page)).toHaveValue(SYDNEY_TODAY);
    await expect(readsAs(page)).toHaveCount(0);
    await expect(totalText(page)).toHaveCount(0);
    await expectNoErrorsShown(page);
  });

  test("a second valid Save on the fresh form adds a second income and goes Home: \"Today: $12.00 from 2 sales\" (500 + 700 cents)", async ({
    page,
  }, testInfo) => {
    await openForm(page, SELF_BACK);
    await fillForm(page, { stream: "Online sales", amount: "5", payment: "Online" });
    await press(saveButton(page), touch(testInfo));
    await expect(page).toHaveURL(urlOnThisServer(page, FORM_PATH));
    await expect.poll(() => selectedText(streamField(page))).toBe(STREAM_PLACEHOLDER);
    await fillForm(page, { stream: "Wholesale", amount: "7", payment: "Card" });
    // The address no longer has ?back= (I9), so this Save goes to Home.
    await saveAndExpect(page, touch(testInfo), "/", "Home");
    await expect(exactText(page, "Today: $12.00 from 2 sales")).toBeVisible();
  });

  test("takings then a one-amount income, both through the self-returning form: Home says \"Today: $355.00 from 3 sales\" (10000 + 25000 + 500 cents)", async ({
    page,
  }, testInfo) => {
    await openForm(page, SELF_BACK);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await press(saveButton(page), touch(testInfo));
    await expect.poll(() => selectedText(streamField(page))).toBe(STREAM_PLACEHOLDER);
    await expect(cashField(page)).toHaveCount(0);
    await fillForm(page, { stream: "Commissions", amount: "5", payment: "Cash" });
    // The address no longer has ?back= (I9), so this Save goes to Home.
    await saveAndExpect(page, touch(testInfo), "/", "Home");
    await expect(exactText(page, "Today: $355.00 from 3 sales")).toBeVisible();
  });
});

// ─── I15. The payment error is linked from each radio ───────────────────────

test.describe("T1.12b: the payment method error is linked from every radio", () => {
  /** Opens Online sales with an amount and no method, and presses Save. Returns the error's id. */
  async function blockedSaveWithoutPayment(page: Page, hasTouch: boolean): Promise<string> {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "23.50" });
    await press(saveButton(page), hasTouch);
    await expect(exactText(page, ERROR_PAYMENT)).toBeVisible();
    const id = await exactText(page, ERROR_PAYMENT).evaluate((el) => el.id);
    expect(id, "the payment error element's id").not.toBe("");
    return id;
  }

  /** Each radio's aria-describedby ids, in order. */
  function radioDescribedByIds(page: Page): Promise<string[][]> {
    return paymentGroup(page).evaluate((group) =>
      Array.from(group.querySelectorAll('input[type="radio"]')).map((r) =>
        (r.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((x) => x !== ""),
      ),
    );
  }

  test("after a blocked Save with no payment method, all five radios' aria-describedby include the error's id", async ({
    page,
  }, testInfo) => {
    const id = await blockedSaveWithoutPayment(page, touch(testInfo));
    const ids = await radioDescribedByIds(page);
    expect(ids).toHaveLength(5);
    expect(
      ids.map((list) => list.includes(id)),
      `each radio's aria-describedby ids: ${JSON.stringify(ids)}`,
    ).toEqual([true, true, true, true, true]);
  });

  test("after a blocked Save with no payment method, each radio's description reads the error", async ({
    page,
  }, testInfo) => {
    await blockedSaveWithoutPayment(page, touch(testInfo));
    for (const label of PAYMENT_LABELS) {
      expect(await describedByTexts(paymentRadio(page, label)), `"${label}" radio's description`).toContain(
        ERROR_PAYMENT,
      );
    }
  });

  test("after a blocked Save with no payment method, the fieldset's aria-describedby still includes the error's id", async ({
    page,
  }, testInfo) => {
    const id = await blockedSaveWithoutPayment(page, touch(testInfo));
    const ids = await paymentGroup(page).evaluate((g) =>
      (g.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((x) => x !== ""),
    );
    expect(ids).toContain(id);
  });

  test("once a payment method is chosen, the error is gone and no radio's description reads it", async ({
    page,
  }, testInfo) => {
    await blockedSaveWithoutPayment(page, touch(testInfo));
    await paymentRadio(page, "Online").check();
    await expect(exactText(page, ERROR_PAYMENT)).toHaveCount(0);
    for (const label of PAYMENT_LABELS) {
      expect(await describedByTexts(paymentRadio(page, label)), `"${label}" radio's description`).not.toContain(
        ERROR_PAYMENT,
      );
    }
  });
});

// ─── I16. back is capped at 200 characters ──────────────────────────────────

test.describe("T1.12b: back is capped at 200 characters", () => {
  // Hand-built: "/" + 199 × "a" = 200 characters; "/" + 200 × "a" = 201.
  const AT_LIMIT = "/" + "a".repeat(199);
  const OVER_LIMIT = "/" + "a".repeat(200);

  test("with a safe-looking 200-character back, Cancel links to it unchanged", async ({ page }) => {
    expect(AT_LIMIT.length).toBe(200);
    await openForm(page, `?back=${encodeURIComponent(AT_LIMIT)}`);
    await expect(cancelLink(page)).toHaveAttribute("href", AT_LIMIT);
  });

  test('with a safe-looking 201-character back, Cancel links to "/"', async ({ page }) => {
    expect(OVER_LIMIT.length).toBe(201);
    await openForm(page, `?back=${encodeURIComponent(OVER_LIMIT)}`);
    await expect(cancelLink(page)).toHaveAttribute("href", "/");
  });

  test("with a safe-looking 201-character back, Save goes to Home", async ({ page }, testInfo) => {
    await openForm(page, `?back=${encodeURIComponent(OVER_LIMIT)}`);
    await fillForm(page, { stream: "Online sales", amount: "5", payment: "Online" });
    await saveAndExpect(page, touch(testInfo), "/", "Home");
    await expect(exactText(page, "Today: $5.00 from 1 sale")).toBeVisible();
  });
});

// ─── I17. Lead decisions: events kept between event streams; amounts not carried ─

test.describe("T1.12b: moving between the two event streams keeps the event", () => {
  test("Sales at events with the convention, switched to Vendor shelf rental, keeps the convention selected", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, event: COMIC_CON });
    await fillForm(page, { stream: VENDOR_SHELF });
    expect(await selectedText(eventField(page))).toBe(COMIC_CON);
  });

  test("that kept convention is saved with the Vendor shelf rental income", async ({ page }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, event: COMIC_CON });
    await fillForm(page, { stream: VENDOR_SHELF, amount: "45", payment: "Bank transfer" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(1);
    const text = await rowText(rows(page).first());
    expect(text).toMatch(/\bVendor shelf rental\b/);
    expect(text).toContain(COMIC_CON);
    expect(amountsIn(text)).toEqual(["$45.00"]);
  });

  test('then switching to Online sales removes the Event field, and back to Sales at events shows "Not assigned yet"', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, event: COMIC_CON });
    await fillForm(page, { stream: VENDOR_SHELF });
    expect(await selectedText(eventField(page))).toBe(COMIC_CON);
    await fillForm(page, { stream: "Online sales" });
    await expect(eventField(page)).toHaveCount(0);
    await fillForm(page, { stream: SALES_AT_EVENTS });
    expect(await selectedText(eventField(page))).toBe(NOT_ASSIGNED);
  });

  test("Vendor shelf rental with the shelf, switched to Sales at events, keeps the shelf and saves both takings rows with it", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: VENDOR_SHELF, event: SHELF });
    await fillForm(page, { stream: SALES_AT_EVENTS });
    expect(await selectedText(eventField(page))).toBe(SHELF);
    await fillForm(page, { cash: "10", card: "20" });
    await saveAndExpect(page, touch(testInfo));
    await goToTransactions(page);
    await expect(rows(page)).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      expect(await rowText(rows(page).nth(i))).toContain(SHELF);
    }
  });
});

test.describe("T1.12b: typed amounts don't carry over when the shape changes", () => {
  test('Online sales with Amount "50", switched to Sales at events: Cash and Card are empty, with no Reads as and no total', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "50" });
    await expect(exactText(page, "Reads as $50.00")).toBeVisible();
    await fillForm(page, { stream: SALES_AT_EVENTS });
    await expect(cashField(page)).toHaveValue("");
    await expect(cardField(page)).toHaveValue("");
    await expect(readsAs(page)).toHaveCount(0);
    await expect(totalText(page)).toHaveCount(0);
  });

  test('Sales at events with Cash "100" and Card "250", switched to Wholesale: Amount is empty, with no Reads as', async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await expect(exactText(page, "Total $350.00")).toBeVisible();
    await fillForm(page, { stream: "Wholesale" });
    await expect(amountField(page)).toHaveValue("");
    await expect(readsAs(page)).toHaveCount(0);
    await expect(totalText(page)).toHaveCount(0);
  });
});

// ═══ T1.13a ═════════════════════════════════════════════════════════════════

/** Describes every live region among `el` and its ancestors (aria-live not "off", a live role, or <output>). */
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

/** The text of every live region inside (or being) the element. */
function liveRegionTextsWithin(locator: Locator): Promise<string[]> {
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
      .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim()),
  );
}

// ─── I18. "Reads as" is not a live region; the Total still is ───────────────

test.describe('T1.13a: "Reads as" lines are not live regions', () => {
  for (const [label, locate, typed, shown] of [
    [LABEL_CASH, cashField, "100", "Reads as $100.00"],
    [LABEL_CARD, cardField, "250", "Reads as $250.00"],
  ] as const) {
    test(`${label}'s "${shown}" has no live region on itself or any ancestor`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { stream: SALES_AT_EVENTS });
      await locate(page).fill(typed);
      await expect(exactText(page, shown)).toBeVisible();
      expect(await liveSelfOrAncestors(exactText(page, shown))).toEqual([]);
    });

    test(`${label}'s accessible description includes "${shown}"`, async ({ page }) => {
      await openForm(page);
      await fillForm(page, { stream: SALES_AT_EVENTS });
      await locate(page).fill(typed);
      await expect(locate(page)).toHaveAccessibleDescription(
        new RegExp(`(^|\\s)${escapeRegExp(shown)}(\\s|$)`),
      );
    });
  }

  test('Amount\'s "Reads as $12.50" has no live region on itself or any ancestor', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "12.5" });
    await expect(exactText(page, "Reads as $12.50")).toBeVisible();
    expect(await liveSelfOrAncestors(exactText(page, "Reads as $12.50"))).toEqual([]);
  });

  test('Amount\'s accessible description includes "Reads as $12.50"', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales", amount: "12.5" });
    await expect(amountField(page)).toHaveAccessibleDescription(/(^|\s)Reads as \$12\.50(\s|$)/);
  });

  test("in the one-amount shape the form holds no live region, with the amount empty or valid", async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    const form = main(page).locator("form");
    expect(await liveRegionTextsWithin(form), "with the amount empty").toEqual([]);
    await fillForm(page, { amount: "12.5" });
    await expect(exactText(page, "Reads as $12.50")).toBeVisible();
    expect(await liveRegionTextsWithin(form), "with a valid amount").toEqual([]);
  });

  test('with Cash and Card valid, the form\'s only live region holds exactly "Total $350.00"', async ({ page }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "100", card: "250" });
    await expect(exactText(page, "Total $350.00")).toBeVisible();
    expect(await liveRegionTextsWithin(main(page).locator("form"))).toEqual(["Total $350.00"]);
  });

  test("with only Cash valid, the form has at most one live region and none holds a \"Reads as\"", async ({
    page,
  }) => {
    await openForm(page);
    await fillForm(page, { stream: SALES_AT_EVENTS, cash: "12.5" });
    await expect(exactText(page, "Reads as $12.50")).toBeVisible();
    const texts = await liveRegionTextsWithin(main(page).locator("form"));
    expect(texts.length, `live regions: ${JSON.stringify(texts)}`).toBeLessThanOrEqual(1);
    expect(texts.filter((t) => /Reads as/.test(t))).toEqual([]);
  });
});

// ─── I19. Between two one-amount streams, errors stay ───────────────────────

test.describe("T1.13a: switching between one-amount streams keeps the errors", () => {
  test("after a blocked Save on Online sales, Wholesale then Vendor shelf rental keep both errors and Amount's aria-invalid", async ({
    page,
  }, testInfo) => {
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    await press(saveButton(page), touch(testInfo));
    await expect(exactText(page, ERROR_AMOUNT_EMPTY)).toBeVisible();
    await expect(exactText(page, ERROR_PAYMENT)).toBeVisible();
    for (const stream of ["Wholesale", VENDOR_SHELF]) {
      await fillForm(page, { stream });
      await expect(exactText(page, ERROR_AMOUNT_EMPTY), `after switching to ${stream}`).toBeVisible();
      await expect(exactText(page, ERROR_PAYMENT), `after switching to ${stream}`).toBeVisible();
      await expect(amountField(page), `after switching to ${stream}`).toHaveAttribute("aria-invalid", "true");
    }
  });
});

// ─── I20. The two forms still look alike ────────────────────────────────────

test.describe("T1.13a: the expense and income forms look alike", () => {
  /** Amount's height, Save's height and Save's font size on the page now. */
  function measure(page: Page) {
    return main(page).evaluate((m) => {
      const amount = Array.from(m.querySelectorAll("label"))
        .find((l) => l.textContent?.trim() === "Amount")
        ?.control?.getBoundingClientRect().height;
      const save = Array.from(m.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Save");
      return {
        amountHeight: amount ?? null,
        saveHeight: save?.getBoundingClientRect().height ?? null,
        saveFontSize: save ? getComputedStyle(save).fontSize : null,
      };
    });
  }

  test("on a phone at 390×844, Amount's height and Save's height and font size are the same in both forms", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openForm(page);
    await fillForm(page, { stream: "Online sales" });
    const income = await measure(page);
    await open(page, "/expenses/new");
    await expect(main(page).getByRole("textbox", { name: LABEL_AMOUNT, exact: true })).toBeVisible();
    const expense = await measure(page);
    expect(income.amountHeight, "income Amount height (px)").not.toBeNull();
    expect(income.saveHeight, "income Save height (px)").not.toBeNull();
    expect(income).toEqual(expense);
  });
});
