// Events tab and event page (T1.15, docs/stages/stage-01.md).
// Guide §12 "By event or venue" (with its note that production costs aren't
// included), §7 (event & venue costs), §6 (dates shown the local way);
// DECISIONS.md "Event takings", "Event 'Other costs'", "The '+' button".
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop)
// unless its name says "on a phone"; those are limited to the phone project
// with a conditional `test.skip(...)`, as in app-shell.spec.ts. On desktop
// they show as skipped, which is expected.
//
// How data gets in: the test seam window.__bentoTest.addIncome / addExpense
// (test-seam.spec.ts S0–S6; entries-list.spec.ts until T1.17b) for tests about what the pages SHOW, and the
// real forms through "+ Add" for tests about the FLOW (the owner's worked
// example, the round trips). The "Other costs" figure has no seam: it is
// always set through the page itself. Entries live in memory, so every move
// between screens is client-side (links, tabs), never page.goto.
//
// NOT testable here, and why: "no screen does its own money maths" (all money
// comes from eventSummary) is a rule about the code's structure. A browser
// test sees only the figures, and a screen that added the numbers up itself
// correctly would show the same ones. The code review checks it. What IS
// tested: every figure on these pages, worked out by hand below.
//
// ═══ HAND-WORKED FACTS ═══════════════════════════════════════════════════════
//
// The device clock is frozen at 2026-06-30T15:30:00Z.
//   Sydney (UTC+10, no DST in June): 01:30 on 1 July → today = 2026-07-01.
//   Perth (UTC+8): 23:30 on 30 June → today = 2026-06-30.
// pretendEvents(today) (src/lib/pretend-data.ts):
//   convention  today−9 .. today−7
//     Sydney: 2026-07-01 − 9 = 2026-06-22, − 7 = 2026-06-24
//     Perth:  2026-06-30 − 9 = 2026-06-21, − 7 = 2026-06-23
//   market      today .. today
//   shelf       today−60, no end
//     Sydney: 1 July − 30 = 1 June, − 30 more = 2 May  → 2026-05-02
//     Perth: 30 June − 29 = 1 June, − 31 more = 1 May → 2026-05-01
// The pages work "today" out in the BROWSER (as Home's totals do): the server
// doesn't know the device's date, and showing the server's dates would also be
// a hydration mismatch, which the fixture fails.
//
// Dates are shown with formatDateForDisplay(iso, "en-AU"): day/month/year
// with two-digit day and month, e.g. 2026-06-22 → "22/06/2026".
// Money is shown with formatCents(cents, "AUD", "en-AU"). A negative amount
// comes out with a plain ASCII hyphen-minus (U+002D) before the "$":
// −5000 cents → "-$50.00". (formatCents builds the text "-50.00" and
// Intl.NumberFormat en-AU keeps the sign as U+002D; checked by the test
// engineer in Node 24's ICU and in the Chromium run.) The lead's card wrote
// "−$50.00" with U+2212; the app's formatter gives U+002D, and this file pins
// what formatCents gives. Flagged to the lead.
//
// THE OWNER'S WORKED EXAMPLE (convention, Sydney dates), in cents:
//   takings  day 1 2026-06-22  cash 40000 + card  60000 = 100000 ($1,000.00)
//            day 2 2026-06-23  cash 80000 + card 120000 = 200000 ($2,000.00)
//                                (the split is the test engineer's choice)
//            day 3 2026-06-24  cash 50000 + card 100000 = 150000 ($1,500.00)
//            Takings 100000 + 200000 + 150000 = 450000 → "$4,500.00"
//   costs    2026-06-22 Stall or table fees, "Comic con organisers"  50000
//            2026-06-23 Meals, no supplier                           20000
//            2026-06-24 Accommodation, "Harbour Hotel"               29900
//            Event costs 50000 + 20000 + 29900 = 99900 → "$999.00"
//   Result   450000 − 99900 = 350100 → "$3,501.00"
//   Other costs 60000 → Result after other costs 350100 − 60000 = 290100
//            → "$2,901.00"
// Other figures used below:
//   Other costs 45000 → 350100 − 45000 = 305100 → "$3,051.00"
//   Other costs "$1,234.50" = 123450 → 350100 − 123450 = 226650 → "$2,266.50"
//   Other costs 0 → 350100 − 0 = 350100 → "$3,501.00"
//   Market: cash 30000 + card 20000 = 50000; Parking 5000;
//     Result 50000 − 5000 = 45000 → "$450.00"
//   Market with only Parking 5000: Result 0 − 5000 = −5000 → "-$50.00";
//     with Other costs 10000: −5000 − 10000 = −15000 → "-$150.00"
//   Shelf: bank transfer 25000 on 2026-06-15 → Cash $0.00, Card $0.00,
//     Other $250.00, Total $250.00; Takings $250.00
//   T1.16b, the cap: Other costs "9999999.99" = 9,999,999 × 100 + 99
//     = 999,999,999 cents → "Other costs $9,999,999.99";
//     350100 − 999999999 = −999649899 → "Result after other costs -$9,996,498.99".
//     "10000000" = 1,000,000,000 cents, one cent over the cap.
//
// ═══ DECISIONS (lead's, written out here so the tests can be exact) ════════
//
// E1. /events lists the three pretend events in pretendEvents() order:
//     "Pretend comic convention", "Pretend weekend market (today)",
//     "Pretend gallery shelf". Each row is ONE link in <main> whose accessible
//     name starts with the event's name and whose href is exactly
//     "/events/<id>". Inside the link:
//       - an element whose whole text is exactly the event's dates:
//           one-day event:   "01/07/2026"
//           multi-day event: "<start> to <end>", e.g. "22/06/2026 to 24/06/2026"
//           shelf (no end):  "From <start>, ongoing", e.g. "From 02/05/2026, ongoing"
//       - an element whose text (whitespace collapsed) is exactly
//         "Result $X", X = eventSummary(...).resultCents (BEFORE any "Other
//         costs": the figure only shows on the event's own page).
//     Following a link is a client-side move (entries survive).
//     The Events tab no longer says "coming in Stage N" (app-shell claim 7).
//
// E2. /events/<id> exists for each pretend event id (HTTP 200). Its one h1 is
//     exactly the event's name, its title is exactly "<name> · BentoBudget"
//     (U+00B7), and an element in <main> shows its dates exactly as in E1.
//     Any other id is a real 404: a browser gets 404 and a GET that does NOT
//     follow redirects gets 404, on both servers (test build 3000, and 3001
//     built without the test flag), like /reports in app-shell claim 16.
//
// E3. "+ Add" on the event page: exactly one, after the h1 and before the
//     first h2. Its links are exactly
//       /income/new?event=<id>&back=%2Fevents%2F<id>
//       /expenses/new?event=<id>&back=%2Fevents%2F<id>
//     (order event, back; URLSearchParams encoding, as add-button B4).
//     Saving the form lands back on the event page, which shows the new
//     entry.
//
// E4. Sections. The page has exactly four level-2 headings, in this order:
//     "Takings by day", "Event & venue costs", "Result", "Other costs".
//     Test engineer's decision (so each section can be found exactly): each
//     is a <section> labelled by its h2 (aria-labelledby), so it is a region
//     whose accessible name is exactly the heading's text.
//
//     "A line X" below means: an element in that section whose rendered text,
//     whitespace collapsed, is exactly X. So "Takings <span>$1.00</span>" or
//     <div><dt>Takings</dt> <dd>$1.00</dd></div> both count; a <dl> holding
//     several pairs with nothing around each pair does not (wrap each pair).
//
// E5. Takings by day: a list (<ul>/<ol>, role list) with one item per day
//     that has income linked to the event (any stream, $0 rows included),
//     oldest first. Each item's text holds the day's date and the lines
//     "Cash $X", "Card $X" and "Total $X", plus "Other $X" ONLY when that
//     day's other-method income isn't zero. (Checked as whole words in the
//     item's collapsed text, so the order inside an item is free.)
//     Then the line "Takings $X". With no takings: the line
//     "No takings yet." and no list items.
//
// E6. Event & venue costs: a list with one item per event & venue cost
//     linked to THIS event, oldest first. Each item holds the cost's date,
//     its category name, its supplier when there is one, and its amount (the
//     only money amount in the item). With no supplier, the item holds only
//     the date, category and amount (punctuation aside). Then the line
//     "Event costs $X". With none: "No event & venue costs yet." and no list
//     items. Production costs, unlinked costs and other events' costs never
//     appear, and neither do other events' takings or unlinked income.
//     CHANGED (T1.17, lead): each cost is now the SHARED cost row, the same
//     as on the Expenses tab and the stream pages (expenses.spec.ts X5). Its
//     rendered lines are exactly, in order: the date; the category; the
//     supplier (when set); "<event name> · <stream name>", or just the event
//     name when it has no stream tag (every cost here is linked to this
//     event, so this line is always there); the notes (when set); the amount.
//     Nothing else. The intent is unchanged: each row shows what the cost is,
//     and only this event's event & venue costs are listed.
//
// E7. Result: the line "Result $X" (takings − event costs; negative shown as
//     "-$X").
//
// E8. Other costs (owner: an optional figure, e.g. what the stock sold
//     there cost; never added to any other totals):
//     - Always: exactly one element on the page whose text contains
//       "isn't added to any other totals" (ASCII apostrophe), in this
//       section.
//     - No figure: a button "Add other costs"; no "Other costs $…" line and
//       no "Result after other costs …" line.
//     - "Add other costs" shows a small inline form in this section: a text
//       field labelled exactly "Amount" (focused when the form opens), a
//       field labelled exactly "Notes (optional)", and buttons "Save" and
//       "Cancel". The amount follows the forms' rules (T1.4): while valid, an
//       element "Reads as $X" is shown and is part of the Amount field's
//       description (aria-describedby); errors only after Save, with the
//       forms' exact texts ("Enter an amount." / the long invalid message),
//       aria-invalid="true", focus back on Amount, and nothing saved.
//     - Saved: the form closes; the lines "Other costs $X" and
//       "Result after other costs $Y"; an element whose whole text is the
//       notes (trimmed) when there are notes; buttons "Change" and "Clear";
//       no "Add other costs". $0 is a real figure ("Other costs $0.00").
//     - Cancel closes the form and saves nothing.
//     - "Change" opens the same form holding the current figure (its
//       "Reads as" shows it) and notes; Save replaces the figure.
//     - "Clear" removes the figure at once: both lines go, "Add other costs"
//       comes back. The Result line stays.
//     - The figure belongs to its event only, stays while moving around the
//       app (client-side), and is NOT added to anything else: the events
//       list's Result, Home's totals and the Transactions list don't change.
//       CHANGED (T1.17b): the Transactions list is removed; the Expenses tab
//       takes its place in that check (no "$777.00" row, still 3 costs).
//
//     - ADDED (T1.16, from the T1.15 review): where focus goes when the
//       form closes, so keyboard and screen-reader users aren't dropped on
//       <body>: Cancel puts focus back on the button that opened the form
//       ("Add other costs", or "Change"); Save puts it on "Change"; Clear
//       puts it on "Add other costs".
//
//     - ADDED (T1.16b, the owner's cap of $9,999,999.99 per entry; lead's
//       decisions, as expense-form F17): "9999999.99" is valid ("Reads as
//       $9,999,999.99", and Save keeps it). A well-formed amount above it
//       ("10000000", "10,000,000.00") shows no "Reads as", and after Save
//       exactly "Enter an amount up to $9,999,999.99." with aria-invalid,
//       aria-describedby and focus on Amount, and nothing is saved. A format
//       mistake keeps the format message, never the cap message.
//
// E9. The note: an element in <main> whose whole text is exactly
//     "Production costs aren't included here." (ASCII apostrophe).
//
// E10. Size and access: every control on the event page ("+ Add",
//     "Add other costs", Amount, Notes, Save, Cancel, Change, Clear) and each
//     event link on /events is at least 44×44 px. On a phone at 320×568 with
//     200% text, /events and the event page (with the owner's example, the
//     form open, and a figure set) don't scroll sideways and keep every
//     element in <main> inside 0–320 px: the takings must not be a wide
//     table.
//
// E11. No uncaught errors and no React hydration errors during any test.

import { expect, test as base, type Locator, type Page } from "@playwright/test";
// Type-only imports (erased at run time): the seam takes the store's own input types.
import type { ExpenseInput, IncomeInput } from "../src/lib/entries";

// ---------- fixed facts ----------

const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";
const PERTH = "Australia/Perth";
const TODAY = "2026-07-01"; // Sydney

const COMIC_CON = { id: "pretend-event-comic-con", name: "Pretend comic convention", dates: "22/06/2026 to 24/06/2026" };
const MARKET = { id: "pretend-event-todays-market", name: "Pretend weekend market (today)", dates: "01/07/2026" };
const SHELF = { id: "pretend-event-shelf", name: "Pretend gallery shelf", dates: "From 02/05/2026, ongoing" };
const EVENTS = [COMIC_CON, MARKET, SHELF] as const;
type PretendEvent = (typeof EVENTS)[number];

const SECTIONS = ["Takings by day", "Event & venue costs", "Result", "Other costs"] as const;
const PRODUCTION_NOTE = "Production costs aren't included here.";
const EXPLANATION_PART = "isn't added to any other totals";
const NO_TAKINGS = "No takings yet.";
const NO_COSTS = "No event & venue costs yet.";

const ERROR_AMOUNT_EMPTY = "Enter an amount.";
const ERROR_AMOUNT_INVALID =
  "Enter an amount like 12.50 or $1,234.50, with no minus sign and at most 2 decimal places.";
// T1.16b: the owner's cap, $9,999,999.99 per entry (lead's wording; the owner may reword it).
const ERROR_AMOUNT_TOO_LARGE = "Enter an amount up to $9,999,999.99.";

const HOOK_NAME = "__bentoTest";
const HOOK_WAIT_MS = 10_000;
const MIN_TAP_TARGET_PX = 44;
const NARROW = { width: 320, height: 568 } as const;
const FLAG_OFF_BASE_URL = "http://localhost:3001";

// The owner's worked example (see the header), as seam inputs. Added out of
// date order on purpose, so the page has to sort them.
const EXAMPLE_INCOME: readonly IncomeInput[] = [
  { date: "2026-06-24", streamId: "sales-at-events", amountCents: 50000, paymentMethod: "cash", eventId: COMIC_CON.id },
  { date: "2026-06-24", streamId: "sales-at-events", amountCents: 100000, paymentMethod: "card", eventId: COMIC_CON.id },
  { date: "2026-06-22", streamId: "sales-at-events", amountCents: 40000, paymentMethod: "cash", eventId: COMIC_CON.id },
  { date: "2026-06-22", streamId: "sales-at-events", amountCents: 60000, paymentMethod: "card", eventId: COMIC_CON.id },
  { date: "2026-06-23", streamId: "sales-at-events", amountCents: 80000, paymentMethod: "cash", eventId: COMIC_CON.id },
  { date: "2026-06-23", streamId: "sales-at-events", amountCents: 120000, paymentMethod: "card", eventId: COMIC_CON.id },
];
const EXAMPLE_COSTS: readonly ExpenseInput[] = [
  { date: "2026-06-24", amountCents: 29900, categoryId: "accommodation", supplier: "Harbour Hotel", eventId: COMIC_CON.id },
  { date: "2026-06-22", amountCents: 50000, categoryId: "stall-table-fees", supplier: "Comic con organisers", eventId: COMIC_CON.id },
  { date: "2026-06-23", amountCents: 20000, categoryId: "meals", eventId: COMIC_CON.id },
];

// ---------- fixture: no uncaught errors, no hydration errors (E11) ----------

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

function heading(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}

function region(page: Page, name: (typeof SECTIONS)[number]): Locator {
  return main(page).getByRole("region", { name, exact: true });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The row link for an event on /events: a link whose accessible name starts with the event's name. */
function eventLink(page: Page, event: PretendEvent): Locator {
  return main(page).getByRole("link", { name: new RegExp(`^\\s*${escapeRegExp(event.name)}`) });
}

function addButton(page: Page): Locator {
  return main(page).getByRole("button", { name: "+ Add", exact: true });
}

function otherCosts(page: Page): Locator {
  return region(page, "Other costs");
}
function addOtherCostsButton(page: Page): Locator {
  return otherCosts(page).getByRole("button", { name: "Add other costs", exact: true });
}
function ocAmount(page: Page): Locator {
  return otherCosts(page).getByRole("textbox", { name: "Amount", exact: true });
}
function ocNotes(page: Page): Locator {
  return otherCosts(page).getByRole("textbox", { name: "Notes (optional)", exact: true });
}
function ocSave(page: Page): Locator {
  return otherCosts(page).getByRole("button", { name: "Save", exact: true });
}
function ocCancel(page: Page): Locator {
  return otherCosts(page).getByRole("button", { name: "Cancel", exact: true });
}
function ocChange(page: Page): Locator {
  return otherCosts(page).getByRole("button", { name: "Change", exact: true });
}
function ocClear(page: Page): Locator {
  return otherCosts(page).getByRole("button", { name: "Clear", exact: true });
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

async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--nav-h") !== "");
}

/** Freezes the clock, opens a path (full load), requires HTTP 200 and waits for hydration. */
async function open(page: Page, path: string): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  const response = await page.goto(path);
  expect(response?.status(), `HTTP status of ${path}`).toBe(200);
  await waitForHydration(page);
}

function eventPath(event: PretendEvent): string {
  return `/events/${event.id}`;
}

/** Opens an event's page directly and checks its heading. */
async function openEvent(page: Page, event: PretendEvent): Promise<void> {
  await open(page, eventPath(event));
  await expect(heading(page)).toHaveText(event.name);
}

/** Waits for the test seam (T1.6), then adds income and expenses through it. */
async function seed(page: Page, income: readonly IncomeInput[], expenses: readonly ExpenseInput[]): Promise<void> {
  await page
    .waitForFunction(
      (name) => typeof (window as unknown as Record<string, { addIncome?: unknown } | undefined>)[name]?.addIncome === "function",
      HOOK_NAME,
      { timeout: HOOK_WAIT_MS },
    )
    .catch(() => {
      throw new Error(`test seam window.${HOOK_NAME} never appeared (see test-seam.spec.ts)`);
    });
  await page.evaluate(
    ({ name, income, expenses }) => {
      const hook = (window as unknown as Record<string, { addIncome(i: unknown): void; addExpense(e: unknown): void }>)[
        name
      ];
      for (const i of income) hook.addIncome(i);
      for (const e of expenses) hook.addExpense(e);
    },
    { name: HOOK_NAME, income: income as IncomeInput[], expenses: expenses as ExpenseInput[] },
  );
}

/** Opens the convention's page and seeds the owner's worked example. */
async function openExample(page: Page): Promise<void> {
  await openEvent(page, COMIC_CON);
  await seed(page, EXAMPLE_INCOME, EXAMPLE_COSTS);
  await expectLine(region(page, "Takings by day"), "Takings $4,500.00");
}

/** The rendered texts (whitespace collapsed) of every rendered element inside `container`. */
function renderedTexts(container: Locator): Promise<string[]> {
  return container.evaluate((root) =>
    [root, ...Array.from(root.querySelectorAll("*"))]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim()),
  );
}

/** "A line X" (E4): some rendered element inside `container` whose collapsed text is exactly `text`. */
async function expectLine(container: Locator, text: string): Promise<void> {
  await expect(container).toHaveCount(1);
  await expect
    .poll(async () => (await renderedTexts(container)).includes(text), { message: `a line reading exactly "${text}"` })
    .toBe(true);
}

/** No rendered element inside `container` has collapsed text starting with `prefix`. */
async function expectNoLineStarting(container: Locator, prefix: string): Promise<void> {
  await expect(container).toHaveCount(1);
  const found = (await renderedTexts(container)).filter((t) => t.startsWith(prefix));
  expect(found, `lines starting with "${prefix}"`).toEqual([]);
}

/** An element's rendered text, whitespace collapsed. */
async function textOf(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/\s+/g, " ").trim();
}

/** Whether `token` appears in `text` as whole words (bounded by the ends or spaces). */
function hasToken(text: string, token: string): boolean {
  return new RegExp(`(^| )${escapeRegExp(token)}( |$)`).test(text);
}

/** Every money amount in a piece of text ("$1,234.56", "-$50.00"). */
function amountsIn(text: string): string[] {
  return text.match(/-?\$\d[\d,]*\.\d{2}/g) ?? [];
}

/**
 * A cost row's rendered lines (E6, CHANGED (T1.17); expenses.spec.ts X5):
 * innerText split at line breaks, each collapsed and trimmed, empties dropped.
 */
async function rowLines(row: Locator): Promise<string[]> {
  return (await row.innerText())
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
}

function dayRows(page: Page): Locator {
  return region(page, "Takings by day").getByRole("listitem");
}
function costRows(page: Page): Locator {
  return region(page, "Event & venue costs").getByRole("listitem");
}

async function setMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__t115SameDocument = true;
  });
}
async function markerStillThere(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as Record<string, unknown>).__t115SameDocument === true);
}

function urlOnThisServer(page: Page, path: string): RegExp {
  const origin = new URL(page.url()).origin;
  return new RegExp(`^${escapeRegExp(origin)}${escapeRegExp(path)}$`);
}

/** Moves with a bottom tab (client-side) and checks the heading. */
async function goByTab(page: Page, name: "Home" | "Events", hasTouch: boolean): Promise<void> {
  await press(mainNav(page).getByRole("link", { name, exact: true }), hasTouch);
  await expect(heading(page)).toHaveText(name);
}

/** On /events, follows an event's row link (client-side) to its page. */
async function followEventLink(page: Page, event: PretendEvent, hasTouch: boolean): Promise<void> {
  await press(eventLink(page, event), hasTouch);
  await expect(page).toHaveURL(urlOnThisServer(page, eventPath(event)));
  await expect(heading(page)).toHaveText(event.name);
}

/** Opens "Add other costs", fills the form and presses Save. */
async function setOtherCosts(page: Page, hasTouch: boolean, amount: string, notes?: string): Promise<void> {
  await press(addOtherCostsButton(page), hasTouch);
  await ocAmount(page).fill(amount);
  if (notes !== undefined) await ocNotes(page).fill(notes);
  await press(ocSave(page), hasTouch);
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

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const b = await locator.boundingBox();
  expect(b, "element has a layout box (is rendered)").not.toBeNull();
  return b!;
}

async function setTextSize(page: Page, percent: number, expectedPx: string): Promise<void> {
  await page.evaluate((p) => {
    document.documentElement.style.fontSize = `${p}%`;
  }, percent);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(expectedPx);
}

/** Elements in <main> that reach outside 0–width px. */
function outsideWidth(page: Page, width: number): Promise<string[]> {
  return main(page).evaluate((m, w) => {
    const bad: string[] = [];
    for (const el of Array.from(m.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.left < -1 || r.right > w + 1) {
        bad.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 25)}": ${r.left.toFixed(1)}–${r.right.toFixed(1)}`);
      }
    }
    return bad;
  }, width);
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(clientWidth).toBe(NARROW.width);
  expect(scrollWidth, "scrollable width must not exceed the page width").toBeLessThanOrEqual(clientWidth);
}

// ═══ E1. The events list ════════════════════════════════════════════════════

test.describe("T1.15: the events list (/events)", () => {
  test("lists exactly the three pretend events, in pretendEvents order", async ({ page }) => {
    await open(page, "/events");
    const names = await main(page)
      .getByRole("link")
      .evaluateAll((links, wanted) => {
        const found: string[] = [];
        for (const a of links) {
          const text = ((a as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim();
          const name = wanted.find((w) => text.startsWith(w));
          if (name) found.push(name);
        }
        return found;
      }, EVENTS.map((e) => e.name));
    expect(names).toEqual([COMIC_CON.name, MARKET.name, SHELF.name]);
  });

  for (const event of EVENTS) {
    test(`"${event.name}" is one link to exactly /events/${event.id}`, async ({ page }) => {
      await open(page, "/events");
      await expect(eventLink(page, event)).toHaveCount(1);
      await expect(eventLink(page, event)).toHaveAttribute("href", eventPath(event));
    });

    test(`"${event.name}" shows its dates exactly: "${event.dates}"`, async ({ page }) => {
      await open(page, "/events");
      await expect(eventLink(page, event).getByText(event.dates, { exact: true })).toBeVisible();
    });

    test(`with nothing entered, "${event.name}" shows "Result $0.00"`, async ({ page }) => {
      await open(page, "/events");
      await expectLine(eventLink(page, event), "Result $0.00");
    });
  }

  test('with the owner\'s example, the convention shows "Result $3,501.00" (450000 − 99900 = 350100 cents)', async ({
    page,
  }) => {
    await open(page, "/events");
    await seed(page, EXAMPLE_INCOME, EXAMPLE_COSTS);
    await expectLine(eventLink(page, COMIC_CON), "Result $3,501.00");
  });

  test('a loss shows with a hyphen-minus: the market with only $50 Parking shows "Result -$50.00"', async ({
    page,
  }) => {
    await open(page, "/events");
    await seed(page, [], [{ date: TODAY, amountCents: 5000, categoryId: "parking", eventId: MARKET.id }]);
    await expectLine(eventLink(page, MARKET), "Result -$50.00");
    await expectLine(eventLink(page, COMIC_CON), "Result $0.00");
  });

  test("each event's Result counts only its own entries (market $450.00, convention $3,501.00, shelf $0.00)", async ({
    page,
  }) => {
    await open(page, "/events");
    await seed(
      page,
      [
        ...EXAMPLE_INCOME,
        { date: TODAY, streamId: "sales-at-events", amountCents: 30000, paymentMethod: "cash", eventId: MARKET.id },
        { date: TODAY, streamId: "sales-at-events", amountCents: 20000, paymentMethod: "card", eventId: MARKET.id },
      ],
      [...EXAMPLE_COSTS, { date: TODAY, amountCents: 5000, categoryId: "parking", eventId: MARKET.id }],
    );
    await expectLine(eventLink(page, COMIC_CON), "Result $3,501.00");
    await expectLine(eventLink(page, MARKET), "Result $450.00");
    await expectLine(eventLink(page, SHELF), "Result $0.00");
  });

  for (const event of EVENTS) {
    test(`following "${event.name}" is a client-side move to its page`, async ({ page }, testInfo) => {
      await open(page, "/events");
      await setMarker(page);
      await followEventLink(page, event, touch(testInfo));
      expect(await markerStillThere(page), "the move didn't reload the page").toBe(true);
    });
  }

  test("entries seeded on /events are still there on the convention's page after following its link", async ({
    page,
  }, testInfo) => {
    await open(page, "/events");
    await seed(page, EXAMPLE_INCOME, EXAMPLE_COSTS);
    await followEventLink(page, COMIC_CON, touch(testInfo));
    await expectLine(region(page, "Result"), "Result $3,501.00");
  });
});

test.describe("T1.15: the events list in Perth (dates follow the device's today)", () => {
  test.use({ timezoneId: PERTH });

  const PERTH_DATES = [
    { event: COMIC_CON, dates: "21/06/2026 to 23/06/2026" },
    { event: MARKET, dates: "30/06/2026" },
    { event: SHELF, dates: "From 01/05/2026, ongoing" },
  ] as const;

  for (const { event, dates } of PERTH_DATES) {
    test(`at 23:30 on 30 June in Perth, "${event.name}" shows "${dates}"`, async ({ page }) => {
      await open(page, "/events");
      await expect(eventLink(page, event).getByText(dates, { exact: true })).toBeVisible();
    });
  }
});

// ═══ E2. The event page: route, heading, title, 404 ═════════════════════════

test.describe("T1.15: the event page's address, heading and title", () => {
  for (const event of EVENTS) {
    test(`/events/${event.id} answers 200 with exactly one h1, "${event.name}"`, async ({ page }) => {
      await open(page, eventPath(event));
      await expect(heading(page)).toHaveCount(1);
      await expect(heading(page)).toHaveText(event.name);
    });

    test(`/events/${event.id} has the title exactly "${event.name} · BentoBudget"`, async ({ page }) => {
      await open(page, eventPath(event));
      await expect(page).toHaveTitle(`${event.name} · BentoBudget`);
      expect(await page.locator("head > title").textContent()).toBe(`${event.name} · BentoBudget`);
    });

    test(`/events/${event.id} shows its dates exactly: "${event.dates}"`, async ({ page }) => {
      await open(page, eventPath(event));
      await expect(main(page).getByText(event.dates, { exact: true })).toBeVisible();
    });
  }

  const UNKNOWN = [
    "/events/nope",
    "/events/pretend-event-zine-workshop",
    "/events/pretend-event-comic-con-2",
    "/events/Pretend%20comic%20convention",
  ] as const;
  for (const path of UNKNOWN) {
    test(`a browser opening ${path} gets HTTP 404`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    });

    test(`GET ${path} without following redirects answers 404 (test build)`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
    });

    test(`GET ${path} without following redirects answers 404 (build without the test flag, port 3001)`, async ({
      request,
    }) => {
      const response = await request.get(`${FLAG_OFF_BASE_URL}${path}`, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
    });
  }

  test("the build without the test flag (port 3001) answers 200 for /events/pretend-event-comic-con", async ({
    request,
  }) => {
    const response = await request.get(`${FLAG_OFF_BASE_URL}/events/${COMIC_CON.id}`, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});

// ═══ E3. "+ Add" on the event page ══════════════════════════════════════════

test.describe('T1.15: "+ Add" on the event page', () => {
  test('there is exactly one "+ Add", after the h1 and before the first h2', async ({ page }) => {
    await openEvent(page, COMIC_CON);
    await expect(addButton(page)).toHaveCount(1);
    const place = await main(page).evaluate((m) => {
      const h1 = m.querySelector("h1");
      const h2 = m.querySelector("h2");
      const button = Array.from(m.querySelectorAll("button")).find(
        (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === "+ Add",
      );
      if (!h1 || !h2 || !button) return "missing h1, h2 or button";
      const afterH1 = (h1.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const beforeH2 = (button.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return afterH1 && beforeH2 ? "between" : `afterH1 ${afterH1}, beforeH2 ${beforeH2}`;
    });
    expect(place).toBe("between");
  });

  for (const event of EVENTS) {
    const back = `%2Fevents%2F${event.id}`;
    test(`on ${event.name}, "Add income" links to exactly /income/new?event=${event.id}&back=${back}`, async ({
      page,
    }, testInfo) => {
      await openEvent(page, event);
      await press(addButton(page), touch(testInfo));
      await expect(main(page).getByRole("link", { name: "Add income", exact: true })).toHaveAttribute(
        "href",
        `/income/new?event=${event.id}&back=${back}`,
      );
    });

    test(`on ${event.name}, "Add expense" links to exactly /expenses/new?event=${event.id}&back=${back}`, async ({
      page,
    }, testInfo) => {
      await openEvent(page, event);
      await press(addButton(page), touch(testInfo));
      await expect(main(page).getByRole("link", { name: "Add expense", exact: true })).toHaveAttribute(
        "href",
        `/expenses/new?event=${event.id}&back=${back}`,
      );
    });
  }

  test("round trip: takings added from the convention's page (25/06, cash $70 + card $30) land back there with the new day", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openEvent(page, COMIC_CON);
    await expect(dayRows(page)).toHaveCount(0);
    await setMarker(page);
    await press(addButton(page), t);
    await press(main(page).getByRole("link", { name: "Add income", exact: true }), t);
    await expect(heading(page)).toHaveText("Add income");
    await main(page).getByLabel("Date", { exact: true }).fill("2026-06-25");
    await main(page).getByRole("textbox", { name: "Cash", exact: true }).fill("70");
    await main(page).getByRole("textbox", { name: "Card", exact: true }).fill("30");
    await press(main(page).getByRole("button", { name: "Save", exact: true }), t);
    await expect(page).toHaveURL(urlOnThisServer(page, eventPath(COMIC_CON)));
    await expect(heading(page)).toHaveText(COMIC_CON.name);
    expect(await markerStillThere(page), "no reload on the way").toBe(true);
    await expect(dayRows(page)).toHaveCount(1);
    const row = await textOf(dayRows(page).first());
    // 7000 + 3000 = 10000 cents.
    for (const token of ["25/06/2026", "Cash $70.00", "Card $30.00", "Total $100.00"]) {
      expect(hasToken(row, token), `"${row}" holds "${token}"`).toBe(true);
    }
    await expectLine(region(page, "Takings by day"), "Takings $100.00");
  });

  test("round trip: a $45 Parking cost added from the market's page lands back there and is listed", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openEvent(page, MARKET);
    await press(addButton(page), t);
    await press(main(page).getByRole("link", { name: "Add expense", exact: true }), t);
    await expect(heading(page)).toHaveText("Add expense");
    await main(page).getByLabel("Amount", { exact: true }).fill("45");
    await main(page).getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Parking" });
    await press(main(page).getByRole("button", { name: "Save", exact: true }), t);
    await expect(page).toHaveURL(urlOnThisServer(page, eventPath(MARKET)));
    await expect(costRows(page)).toHaveCount(1);
    const row = await textOf(costRows(page).first());
    expect(hasToken(row, "01/07/2026"), row).toBe(true);
    expect(hasToken(row, "Parking"), row).toBe(true);
    expect(amountsIn(row)).toEqual(["$45.00"]);
    await expectLine(region(page, "Event & venue costs"), "Event costs $45.00");
    // 0 − 4500 = −4500 cents.
    await expectLine(region(page, "Result"), "Result -$45.00");
  });
});

// ═══ E4. Sections ═══════════════════════════════════════════════════════════

test.describe("T1.15: the event page's sections", () => {
  for (const event of EVENTS) {
    test(`on ${event.name}, the level-2 headings are exactly ${SECTIONS.join(", ")}, in that order`, async ({
      page,
    }) => {
      await openEvent(page, event);
      const h2s = await main(page)
        .getByRole("heading", { level: 2 })
        .evaluateAll((els) => els.map((e) => ((e as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim()));
      expect(h2s).toEqual([...SECTIONS]);
    });
  }

  for (const name of SECTIONS) {
    test(`"${name}" is a region named by its h2 (a <section> with aria-labelledby)`, async ({ page }) => {
      await openEvent(page, COMIC_CON);
      await expect(region(page, name)).toHaveCount(1);
      await expect(region(page, name).getByRole("heading", { level: 2, name, exact: true })).toHaveCount(1);
    });
  }

  test(`the note "${PRODUCTION_NOTE}" is on the page`, async ({ page }) => {
    await openEvent(page, COMIC_CON);
    await expect(main(page).getByText(PRODUCTION_NOTE, { exact: true })).toBeVisible();
  });
});

// ═══ E5. Takings by day ═════════════════════════════════════════════════════

test.describe("T1.15: takings by day", () => {
  test(`with no takings, the section says "${NO_TAKINGS}" and lists no days`, async ({ page }) => {
    await openEvent(page, COMIC_CON);
    await expect(region(page, "Takings by day").getByText(NO_TAKINGS, { exact: true })).toBeVisible();
    await expect(dayRows(page)).toHaveCount(0);
  });

  test("the owner's example lists three days, oldest first", async ({ page }) => {
    await openExample(page);
    await expect(dayRows(page)).toHaveCount(3);
    const dates: string[] = [];
    for (const row of await dayRows(page).all()) {
      const text = await textOf(row);
      dates.push(["22/06/2026", "23/06/2026", "24/06/2026"].find((d) => hasToken(text, d)) ?? `none in "${text}"`);
    }
    expect(dates).toEqual(["22/06/2026", "23/06/2026", "24/06/2026"]);
  });

  const DAYS = [
    { index: 0, date: "22/06/2026", cash: "$400.00", card: "$600.00", total: "$1,000.00" },
    { index: 1, date: "23/06/2026", cash: "$800.00", card: "$1,200.00", total: "$2,000.00" },
    { index: 2, date: "24/06/2026", cash: "$500.00", card: "$1,000.00", total: "$1,500.00" },
  ] as const;
  for (const d of DAYS) {
    test(`day ${d.index + 1} reads ${d.date}, Cash ${d.cash}, Card ${d.card}, Total ${d.total}, and no Other`, async ({
      page,
    }) => {
      await openExample(page);
      const text = await textOf(dayRows(page).nth(d.index));
      for (const token of [d.date, `Cash ${d.cash}`, `Card ${d.card}`, `Total ${d.total}`]) {
        expect(hasToken(text, token), `"${text}" holds "${token}"`).toBe(true);
      }
      expect(text, "no Other line when it is zero").not.toMatch(/(^| )Other\b/);
    });
  }

  test('the owner\'s example: "Takings $4,500.00" (100000 + 200000 + 150000 cents)', async ({ page }) => {
    await openExample(page);
    await expectLine(region(page, "Takings by day"), "Takings $4,500.00");
    await expect(region(page, "Takings by day").getByText(NO_TAKINGS, { exact: true })).toHaveCount(0);
  });

  test('"Other" shows only when non-zero: a $250 bank transfer on the shelf reads Cash $0.00, Card $0.00, Other $250.00, Total $250.00', async ({
    page,
  }) => {
    await openEvent(page, SHELF);
    await seed(
      page,
      [{ date: "2026-06-15", streamId: "vendor-shelf-rental", amountCents: 25000, paymentMethod: "bank_transfer", eventId: SHELF.id }],
      [],
    );
    await expect(dayRows(page)).toHaveCount(1);
    const text = await textOf(dayRows(page).first());
    for (const token of ["15/06/2026", "Cash $0.00", "Card $0.00", "Other $250.00", "Total $250.00"]) {
      expect(hasToken(text, token), `"${text}" holds "${token}"`).toBe(true);
    }
    await expectLine(region(page, "Takings by day"), "Takings $250.00");
  });

  test("a $0 cash + $0 card day is still listed (Cash $0.00, Card $0.00, Total $0.00)", async ({ page }) => {
    await openEvent(page, MARKET);
    await seed(
      page,
      [
        { date: TODAY, streamId: "sales-at-events", amountCents: 0, paymentMethod: "cash", eventId: MARKET.id },
        { date: TODAY, streamId: "sales-at-events", amountCents: 0, paymentMethod: "card", eventId: MARKET.id },
      ],
      [],
    );
    await expect(dayRows(page)).toHaveCount(1);
    const text = await textOf(dayRows(page).first());
    for (const token of ["01/07/2026", "Cash $0.00", "Card $0.00", "Total $0.00"]) {
      expect(hasToken(text, token), `"${text}" holds "${token}"`).toBe(true);
    }
  });

  test("other events' takings and unlinked income never appear in the convention's takings", async ({ page }) => {
    await openEvent(page, COMIC_CON);
    await seed(
      page,
      [
        { date: "2026-06-22", streamId: "sales-at-events", amountCents: 40000, paymentMethod: "cash", eventId: COMIC_CON.id },
        { date: "2026-06-22", streamId: "sales-at-events", amountCents: 99900, paymentMethod: "card", eventId: MARKET.id },
        { date: "2026-06-22", streamId: "sales-at-events", amountCents: 77700, paymentMethod: "card" },
        { date: "2026-06-22", streamId: "online-sales", amountCents: 55500, paymentMethod: "online" },
      ],
      [],
    );
    await expect(dayRows(page)).toHaveCount(1);
    const text = await textOf(dayRows(page).first());
    for (const token of ["Cash $400.00", "Card $0.00", "Total $400.00"]) {
      expect(hasToken(text, token), `"${text}" holds "${token}"`).toBe(true);
    }
    await expectLine(region(page, "Takings by day"), "Takings $400.00");
  });
});

// ═══ E6. Event & venue costs ════════════════════════════════════════════════

test.describe("T1.15: event & venue costs", () => {
  test(`with no costs, the section says "${NO_COSTS}" and lists none`, async ({ page }) => {
    await openEvent(page, COMIC_CON);
    await expect(region(page, "Event & venue costs").getByText(NO_COSTS, { exact: true })).toBeVisible();
    await expect(costRows(page)).toHaveCount(0);
  });

  test("the owner's example lists three costs, oldest first: Stall or table fees, Meals, Accommodation", async ({
    page,
  }) => {
    await openExample(page);
    await expect(costRows(page)).toHaveCount(3);
    const categories: string[] = [];
    for (const row of await costRows(page).all()) {
      const text = await textOf(row);
      categories.push(["Stall or table fees", "Meals", "Accommodation"].find((c) => hasToken(text, c)) ?? `none in "${text}"`);
    }
    expect(categories).toEqual(["Stall or table fees", "Meals", "Accommodation"]);
  });

  // CHANGED (T1.17): these were "holds the date, category, supplier and one
  // amount" checks; they now pin the shared row's exact lines (E6), which
  // add the event's name.
  const COSTS = [
    { index: 0, date: "22/06/2026", category: "Stall or table fees", supplier: "Comic con organisers", amount: "$500.00" },
    { index: 2, date: "24/06/2026", category: "Accommodation", supplier: "Harbour Hotel", amount: "$299.00" },
  ] as const;
  for (const c of COSTS) {
    test(`the ${c.category} cost reads exactly ${c.date} | ${c.category} | ${c.supplier} | ${COMIC_CON.name} | ${c.amount} (CHANGED (T1.17))`, async ({
      page,
    }) => {
      await openExample(page);
      expect(await rowLines(costRows(page).nth(c.index))).toEqual([c.date, c.category, c.supplier, COMIC_CON.name, c.amount]);
    });
  }

  test(`a cost with no supplier reads exactly 23/06/2026 | Meals | ${COMIC_CON.name} | $200.00 (CHANGED (T1.17))`, async ({
    page,
  }) => {
    await openExample(page);
    expect(await rowLines(costRows(page).nth(1))).toEqual(["23/06/2026", "Meals", COMIC_CON.name, "$200.00"]);
  });

  test("a cost with a stream tag and notes reads exactly date | category | supplier | event · stream | notes | amount (ADDED (T1.17))", async ({
    page,
  }) => {
    await openEvent(page, COMIC_CON);
    await seed(
      page,
      [],
      [
        {
          date: "2026-06-23",
          amountCents: 4000,
          categoryId: "parking",
          supplier: "City carpark",
          eventId: COMIC_CON.id,
          streamId: "online-sales",
          notes: "  Saturday  ",
        },
      ],
    );
    await expect(costRows(page)).toHaveCount(1);
    expect(await rowLines(costRows(page).first())).toEqual([
      "23/06/2026",
      "Parking",
      "City carpark",
      `${COMIC_CON.name} \u00B7 Online sales`,
      "Saturday",
      "$40.00",
    ]);
    await expectLine(region(page, "Event & venue costs"), "Event costs $40.00");
  });

  test('the owner\'s example: "Event costs $999.00" (50000 + 20000 + 29900 cents)', async ({ page }) => {
    await openExample(page);
    await expectLine(region(page, "Event & venue costs"), "Event costs $999.00");
    await expect(region(page, "Event & venue costs").getByText(NO_COSTS, { exact: true })).toHaveCount(0);
  });

  test("production costs, unlinked costs and other events' costs never appear on the convention's page", async ({
    page,
  }) => {
    await openEvent(page, COMIC_CON);
    await seed(
      page,
      [],
      [
        { date: "2026-06-22", amountCents: 50000, categoryId: "stall-table-fees", supplier: "Comic con organisers", eventId: COMIC_CON.id },
        { date: "2026-06-22", amountCents: 11100, categoryId: "printing", supplier: "Zine printer" },
        { date: "2026-06-22", amountCents: 22200, categoryId: "parking", supplier: "Unlinked carpark" },
        { date: "2026-06-22", amountCents: 33300, categoryId: "parking", supplier: "Market carpark", eventId: MARKET.id },
        { date: "2026-06-22", amountCents: 44400, categoryId: "software", supplier: "Adobe", streamId: "sales-at-events" },
      ],
    );
    await expect(costRows(page)).toHaveCount(1);
    expect(amountsIn(await textOf(costRows(page).first()))).toEqual(["$500.00"]);
    await expectLine(region(page, "Event & venue costs"), "Event costs $500.00");
    const pageText = await textOf(main(page));
    for (const word of ["Zine printer", "Unlinked carpark", "Market carpark", "Adobe", "$111.00", "$222.00", "$333.00", "$444.00"]) {
      expect(pageText.includes(word), `"${word}" on the convention's page`).toBe(false);
    }
  });
});

// ═══ E7. Result ═════════════════════════════════════════════════════════════

test.describe("T1.15: the result", () => {
  test('with nothing entered: "Result $0.00"', async ({ page }) => {
    await openEvent(page, SHELF);
    await expectLine(region(page, "Result"), "Result $0.00");
  });

  test('the owner\'s example: "Result $3,501.00" (450000 − 99900 cents)', async ({ page }) => {
    await openExample(page);
    await expectLine(region(page, "Result"), "Result $3,501.00");
  });

  test('a loss: the market with only $50 Parking shows "Result -$50.00"', async ({ page }) => {
    await openEvent(page, MARKET);
    await seed(page, [], [{ date: TODAY, amountCents: 5000, categoryId: "parking", eventId: MARKET.id }]);
    await expectLine(region(page, "Result"), "Result -$50.00");
  });
});

// ═══ E8. Other costs ════════════════════════════════════════════════════════

test.describe("T1.15: other costs", () => {
  test(`with no figure, one line explains it "${EXPLANATION_PART}", inside the Other costs section`, async ({
    page,
  }) => {
    await openEvent(page, COMIC_CON);
    await expect(main(page).getByText(EXPLANATION_PART)).toHaveCount(1);
    await expect(otherCosts(page).getByText(EXPLANATION_PART)).toBeVisible();
  });

  test('with no figure: an "Add other costs" button, and no "Other costs $" or "Result after other costs" line', async ({
    page,
  }) => {
    await openExample(page);
    await expect(addOtherCostsButton(page)).toBeVisible();
    await expectNoLineStarting(otherCosts(page), "Other costs $");
    await expectNoLineStarting(main(page), "Result after other costs");
  });

  test('"Add other costs" opens a form with Amount (focused), Notes (optional), Save and Cancel', async ({
    page,
  }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await press(addOtherCostsButton(page), touch(testInfo));
    await expect(ocAmount(page)).toBeVisible();
    await expect(ocAmount(page)).toBeFocused();
    await expect(ocNotes(page)).toBeVisible();
    await expect(ocSave(page)).toBeVisible();
    await expect(ocCancel(page)).toBeVisible();
  });

  test('typing "600" shows "Reads as $600.00", and it is part of the Amount field\'s description', async ({
    page,
  }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await press(addOtherCostsButton(page), touch(testInfo));
    await ocAmount(page).fill("600");
    await expect(otherCosts(page).getByText("Reads as $600.00", { exact: true })).toBeVisible();
    expect(await describedByTexts(ocAmount(page))).toContain("Reads as $600.00");
  });

  test("the owner's example: $600 other costs shows \"Other costs $600.00\" and \"Result after other costs $2,901.00\"", async ({
    page,
  }, testInfo) => {
    await openExample(page);
    await setOtherCosts(page, touch(testInfo), "600", "Stock: 120 zines");
    await expectLine(otherCosts(page), "Other costs $600.00");
    await expectLine(main(page), "Result after other costs $2,901.00");
  });

  test("after Save: the notes, Change and Clear show; the form and \"Add other costs\" are gone; Result stays $3,501.00", async ({
    page,
  }, testInfo) => {
    await openExample(page);
    await setOtherCosts(page, touch(testInfo), "600", "  Stock: 120 zines  ");
    await expect(otherCosts(page).getByText("Stock: 120 zines", { exact: true })).toBeVisible();
    await expect(ocChange(page)).toBeVisible();
    await expect(ocClear(page)).toBeVisible();
    await expect(ocAmount(page)).toHaveCount(0);
    await expect(addOtherCostsButton(page)).toHaveCount(0);
    await expectLine(region(page, "Result"), "Result $3,501.00");
  });

  test('$0 is a real figure: "Other costs $0.00" and "Result after other costs $3,501.00"', async ({
    page,
  }, testInfo) => {
    await openExample(page);
    await setOtherCosts(page, touch(testInfo), "0");
    await expectLine(otherCosts(page), "Other costs $0.00");
    await expectLine(main(page), "Result after other costs $3,501.00");
  });

  test('"$1,234.50" is accepted: "Other costs $1,234.50", "Result after other costs $2,266.50"', async ({
    page,
  }, testInfo) => {
    await openExample(page);
    await setOtherCosts(page, touch(testInfo), "$1,234.50");
    await expectLine(otherCosts(page), "Other costs $1,234.50");
    await expectLine(main(page), "Result after other costs $2,266.50");
  });

  test('a loss after other costs: the market with $50 Parking and $100 other costs shows "Result after other costs -$150.00"', async ({
    page,
  }, testInfo) => {
    await openEvent(page, MARKET);
    await seed(page, [], [{ date: TODAY, amountCents: 5000, categoryId: "parking", eventId: MARKET.id }]);
    await expectLine(region(page, "Result"), "Result -$50.00");
    await setOtherCosts(page, touch(testInfo), "100");
    await expectLine(main(page), "Result after other costs -$150.00");
  });

  const INVALID = [
    { typed: "", error: ERROR_AMOUNT_EMPTY, why: "empty" },
    { typed: "10.505", error: ERROR_AMOUNT_INVALID, why: "3 decimals" },
    { typed: "-5", error: ERROR_AMOUNT_INVALID, why: "negative" },
    { typed: "abc", error: ERROR_AMOUNT_INVALID, why: "letters" },
  ] as const;
  for (const bad of INVALID) {
    test(`Save with ${bad.why} ("${bad.typed}") shows "${bad.error}", marks Amount invalid, focuses it and saves nothing`, async ({
      page,
    }, testInfo) => {
      await openExample(page);
      await press(addOtherCostsButton(page), touch(testInfo));
      await ocAmount(page).fill(bad.typed);
      await expect(otherCosts(page).getByText(bad.error, { exact: true })).toHaveCount(0);
      await press(ocSave(page), touch(testInfo));
      await expect(otherCosts(page).getByText(bad.error, { exact: true })).toBeVisible();
      await expect(ocAmount(page)).toHaveAttribute("aria-invalid", "true");
      expect(await describedByTexts(ocAmount(page))).toContain(bad.error);
      await expect(ocAmount(page)).toBeFocused();
      await expectNoLineStarting(otherCosts(page), "Other costs $");
      await expectNoLineStarting(main(page), "Result after other costs");
    });
  }

  test("Cancel closes the form and saves nothing", async ({ page }, testInfo) => {
    await openExample(page);
    await press(addOtherCostsButton(page), touch(testInfo));
    await ocAmount(page).fill("600");
    await press(ocCancel(page), touch(testInfo));
    await expect(ocAmount(page)).toHaveCount(0);
    await expect(addOtherCostsButton(page)).toBeVisible();
    await expectNoLineStarting(otherCosts(page), "Other costs $");
    await expectNoLineStarting(main(page), "Result after other costs");
  });

  test('"Change" opens the form holding the figure and notes; Save with 450 gives "Other costs $450.00", "Result after other costs $3,051.00"', async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openExample(page);
    await setOtherCosts(page, t, "600", "Stock estimate");
    await press(ocChange(page), t);
    await expect(otherCosts(page).getByText("Reads as $600.00", { exact: true })).toBeVisible();
    await expect(ocNotes(page)).toHaveValue("Stock estimate");
    await ocAmount(page).fill("450");
    await press(ocSave(page), t);
    await expectLine(otherCosts(page), "Other costs $450.00");
    await expectLine(main(page), "Result after other costs $3,051.00");
    await expectNoLineStarting(otherCosts(page), "Other costs $600.00");
  });

  test('"Change" then Cancel keeps $600.00', async ({ page }, testInfo) => {
    const t = touch(testInfo);
    await openExample(page);
    await setOtherCosts(page, t, "600");
    await press(ocChange(page), t);
    await ocAmount(page).fill("1");
    await press(ocCancel(page), t);
    await expectLine(otherCosts(page), "Other costs $600.00");
    await expectLine(main(page), "Result after other costs $2,901.00");
  });

  test('"Clear" removes the figure and the "after" line at once, brings back "Add other costs", and keeps "Result $3,501.00"', async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openExample(page);
    await setOtherCosts(page, t, "600", "Stock estimate");
    await press(ocClear(page), t);
    await expect(addOtherCostsButton(page)).toBeVisible();
    await expectNoLineStarting(otherCosts(page), "Other costs $");
    await expectNoLineStarting(main(page), "Result after other costs");
    await expect(otherCosts(page).getByText("Stock estimate", { exact: true })).toHaveCount(0);
    await expectLine(region(page, "Result"), "Result $3,501.00");
  });

  test(`with a figure set, the "${EXPLANATION_PART}" line is still there exactly once`, async ({ page }, testInfo) => {
    await openExample(page);
    await setOtherCosts(page, touch(testInfo), "600");
    await expect(main(page).getByText(EXPLANATION_PART)).toHaveCount(1);
    await expect(otherCosts(page).getByText(EXPLANATION_PART)).toBeVisible();
  });

  test("the figure belongs to its event only: set on the convention, the market's page has none", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openExample(page);
    await setOtherCosts(page, t, "600");
    await goByTab(page, "Events", t);
    await followEventLink(page, MARKET, t);
    await expect(addOtherCostsButton(page)).toBeVisible();
    await expectNoLineStarting(otherCosts(page), "Other costs $");
    await expectNoLineStarting(main(page), "Result after other costs");
  });

  test("the figure stays while moving around the app: Home, Events, then back to the convention", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openExample(page);
    await setOtherCosts(page, t, "600");
    await goByTab(page, "Home", t);
    await goByTab(page, "Events", t);
    await followEventLink(page, COMIC_CON, t);
    await expectLine(otherCosts(page), "Other costs $600.00");
    await expectLine(main(page), "Result after other costs $2,901.00");
  });

  test('not added to other totals: the events list still shows the convention\'s "Result $3,501.00"', async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openExample(page);
    await setOtherCosts(page, t, "600");
    await goByTab(page, "Events", t);
    await expectLine(eventLink(page, COMIC_CON), "Result $3,501.00");
  });

  test("not added to other totals: Home's today totals are the same after $600 other costs on today's market", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openEvent(page, MARKET);
    // 30000 + 20000 = 50000 cents income in 2 rows; 5000 cents Parking.
    await seed(
      page,
      [
        { date: TODAY, streamId: "sales-at-events", amountCents: 30000, paymentMethod: "cash", eventId: MARKET.id },
        { date: TODAY, streamId: "sales-at-events", amountCents: 20000, paymentMethod: "card", eventId: MARKET.id },
      ],
      [{ date: TODAY, amountCents: 5000, categoryId: "parking", eventId: MARKET.id }],
    );
    await expectLine(region(page, "Result"), "Result $450.00");
    await setOtherCosts(page, t, "600");
    // 45000 − 60000 = −15000 cents.
    await expectLine(main(page), "Result after other costs -$150.00");
    await goByTab(page, "Home", t);
    await expect(main(page).getByText("Today: $500.00 from 2 sales", { exact: true })).toBeVisible();
    await expect(main(page).getByText("Today's expenses: $50.00", { exact: true })).toBeVisible();
  });

  // CHANGED (T1.17b): was "the Transactions list has no $777.00 entry"; /transactions is
  // removed, so the Expenses tab is checked instead (the income rows are on the stream
  // pages, where income-streams.spec.ts S7 already checks other costs never count).
  test("not added to other totals: the Expenses tab has no $777.00 entry", async ({ page }, testInfo) => {
    await openExample(page);
    // $777 appears nowhere in the example, so any "$777.00" on the list would be the figure.
    await setOtherCosts(page, touch(testInfo), "777");
    await expectLine(otherCosts(page), "Other costs $777.00");
    await page.evaluate(() =>
      (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push("/expenses"),
    );
    await expect(heading(page)).toHaveText("Expenses");
    // The 3 costs from the example, nothing else.
    await expect(
      main(page).getByRole("region", { name: "All expenses", exact: true }).getByRole("listitem"),
    ).toHaveCount(3);
    expect((await textOf(main(page))).includes("$777.00")).toBe(false);
  });
});

// ═══ The owner's worked example, through the real forms ═════════════════════

test.describe("T1.15: the owner's worked example, entered through + Add", () => {
  /** On the convention's page: + Add → Add income, one day's takings, Save, back here. */
  async function addTakings(page: Page, t: boolean, date: string, cash: string, card: string): Promise<void> {
    await press(addButton(page), t);
    await press(main(page).getByRole("link", { name: "Add income", exact: true }), t);
    await expect(heading(page)).toHaveText("Add income");
    await main(page).getByLabel("Date", { exact: true }).fill(date);
    await main(page).getByRole("textbox", { name: "Cash", exact: true }).fill(cash);
    await main(page).getByRole("textbox", { name: "Card", exact: true }).fill(card);
    await press(main(page).getByRole("button", { name: "Save", exact: true }), t);
    await expect(page).toHaveURL(urlOnThisServer(page, eventPath(COMIC_CON)));
  }

  /** On the convention's page: + Add → Add expense, one cost, Save, back here. */
  async function addCost(page: Page, t: boolean, date: string, category: string, supplier: string, amount: string): Promise<void> {
    await press(addButton(page), t);
    await press(main(page).getByRole("link", { name: "Add expense", exact: true }), t);
    await expect(heading(page)).toHaveText("Add expense");
    await main(page).getByLabel("Date", { exact: true }).fill(date);
    await main(page).getByLabel("Supplier (optional)", { exact: true }).fill(supplier);
    await main(page).getByLabel("Amount", { exact: true }).fill(amount);
    await main(page).getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: category });
    await press(main(page).getByRole("button", { name: "Save", exact: true }), t);
    await expect(page).toHaveURL(urlOnThisServer(page, eventPath(COMIC_CON)));
  }

  test("takings $4,500.00, event costs $999.00, result $3,501.00, and $2,901.00 after $600 other costs", async ({
    page,
  }, testInfo) => {
    test.slow(); // six forms in one test
    const t = touch(testInfo);
    await openEvent(page, COMIC_CON);
    await addTakings(page, t, "2026-06-22", "400", "600");
    await addTakings(page, t, "2026-06-23", "800", "1,200");
    await addTakings(page, t, "2026-06-24", "500", "1000");
    await addCost(page, t, "2026-06-22", "Stall or table fees", "Comic con organisers", "500");
    await addCost(page, t, "2026-06-24", "Accommodation", "Harbour Hotel", "299");
    await addCost(page, t, "2026-06-23", "Meals", "", "200");
    await expect(dayRows(page)).toHaveCount(3);
    await expect(costRows(page)).toHaveCount(3);
    await expectLine(region(page, "Takings by day"), "Takings $4,500.00");
    await expectLine(region(page, "Event & venue costs"), "Event costs $999.00");
    await expectLine(region(page, "Result"), "Result $3,501.00");
    await setOtherCosts(page, t, "600", "Stock sold, at cost");
    await expectLine(otherCosts(page), "Other costs $600.00");
    await expectLine(main(page), "Result after other costs $2,901.00");
  });
});

// ═══ E10. Size and access ═══════════════════════════════════════════════════

test.describe("T1.15: tap targets are at least 44×44 px", () => {
  for (const event of EVENTS) {
    test(`on /events, the "${event.name}" link is at least 44×44 px`, async ({ page }) => {
      await open(page, "/events");
      const b = await box(eventLink(page, event));
      expect(b.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      expect(b.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    });
  }

  test('on the event page, "+ Add" and "Add other costs" are at least 44×44 px', async ({ page }) => {
    await openEvent(page, COMIC_CON);
    for (const [label, control] of [
      ["+ Add", addButton(page)],
      ["Add other costs", addOtherCostsButton(page)],
    ] as const) {
      const b = await box(control);
      expect(b.width, `${label} width`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      expect(b.height, `${label} height`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    }
  });

  test("the other-costs form's Amount, Notes, Save and Cancel are at least 44×44 px", async ({ page }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await press(addOtherCostsButton(page), touch(testInfo));
    for (const [label, control] of [
      ["Amount", ocAmount(page)],
      ["Notes (optional)", ocNotes(page)],
      ["Save", ocSave(page)],
      ["Cancel", ocCancel(page)],
    ] as const) {
      const b = await box(control);
      expect(b.width, `${label} width`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      expect(b.height, `${label} height`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    }
  });

  test("Change and Clear are at least 44×44 px", async ({ page }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await setOtherCosts(page, touch(testInfo), "600");
    for (const [label, control] of [
      ["Change", ocChange(page)],
      ["Clear", ocClear(page)],
    ] as const) {
      const b = await box(control);
      expect(b.width, `${label} width`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      expect(b.height, `${label} height`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    }
  });
});

test.describe("T1.15: on a phone at 320×568 with 200% text", () => {
  async function narrowBig(page: Page, path: string): Promise<void> {
    await page.setViewportSize(NARROW);
    await open(page, path);
    await setTextSize(page, 200, "32px");
  }

  test("on a phone at 320×568 and 200% text, /events doesn't scroll sideways and stays inside 0–320 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await narrowBig(page, "/events");
    await seed(page, EXAMPLE_INCOME, EXAMPLE_COSTS);
    await expectLine(eventLink(page, COMIC_CON), "Result $3,501.00");
    await expectNoSidewaysScroll(page);
    expect(await outsideWidth(page, NARROW.width)).toEqual([]);
  });

  test("on a phone at 320×568 and 200% text, the convention's page with the owner's example doesn't scroll sideways and stays inside 0–320 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await narrowBig(page, eventPath(COMIC_CON));
    await seed(page, EXAMPLE_INCOME, EXAMPLE_COSTS);
    await expectLine(region(page, "Takings by day"), "Takings $4,500.00");
    await expectNoSidewaysScroll(page);
    expect(await outsideWidth(page, NARROW.width)).toEqual([]);
  });

  test("on a phone at 320×568 and 200% text, the other-costs form open doesn't scroll sideways and stays inside 0–320 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await narrowBig(page, eventPath(COMIC_CON));
    await press(addOtherCostsButton(page), true);
    await ocAmount(page).fill("600");
    await expect(otherCosts(page).getByText("Reads as $600.00", { exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(await outsideWidth(page, NARROW.width)).toEqual([]);
  });

  test("on a phone at 320×568 and 200% text, with other costs set, the page doesn't scroll sideways and stays inside 0–320 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await narrowBig(page, eventPath(COMIC_CON));
    await seed(page, EXAMPLE_INCOME, EXAMPLE_COSTS);
    await setOtherCosts(page, true, "600", "Stock: 120 zines at five dollars each");
    await expectLine(main(page), "Result after other costs $2,901.00");
    await expectNoSidewaysScroll(page);
    expect(await outsideWidth(page, NARROW.width)).toEqual([]);
  });
});

// ═══ E8, added in T1.16: focus after the other-costs form closes ════════════

test.describe("T1.16: focus after Cancel, Save and Clear in other costs", () => {
  test('Cancel after "Add other costs" puts focus back on "Add other costs"', async ({ page }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await press(addOtherCostsButton(page), touch(testInfo));
    await expect(ocAmount(page)).toBeFocused();
    await press(ocCancel(page), touch(testInfo));
    await expect(addOtherCostsButton(page)).toBeFocused();
  });

  test('Cancel after "Change" puts focus back on "Change"', async ({ page }, testInfo) => {
    const t = touch(testInfo);
    await openEvent(page, COMIC_CON);
    await setOtherCosts(page, t, "600");
    await press(ocChange(page), t);
    await expect(ocAmount(page)).toBeFocused();
    await press(ocCancel(page), t);
    await expect(ocChange(page)).toBeFocused();
  });

  test('Save puts focus on "Change"', async ({ page }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await setOtherCosts(page, touch(testInfo), "600");
    await expectLine(otherCosts(page), "Other costs $600.00");
    await expect(ocChange(page)).toBeFocused();
  });

  test('Save from the keyboard (Enter in Amount) puts focus on "Change"', async ({ page }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await press(addOtherCostsButton(page), touch(testInfo));
    await ocAmount(page).fill("600");
    await ocAmount(page).press("Enter");
    await expectLine(otherCosts(page), "Other costs $600.00");
    await expect(ocChange(page)).toBeFocused();
  });

  test('Save after "Change" puts focus on "Change" again', async ({ page }, testInfo) => {
    const t = touch(testInfo);
    await openEvent(page, COMIC_CON);
    await setOtherCosts(page, t, "600");
    await press(ocChange(page), t);
    await ocAmount(page).fill("450");
    await press(ocSave(page), t);
    await expectLine(otherCosts(page), "Other costs $450.00");
    await expect(ocChange(page)).toBeFocused();
  });

  test('Clear puts focus on "Add other costs"', async ({ page }, testInfo) => {
    const t = touch(testInfo);
    await openEvent(page, COMIC_CON);
    await setOtherCosts(page, t, "600");
    await press(ocClear(page), t);
    await expect(addOtherCostsButton(page)).toBeFocused();
  });
});


// ═══ E8, added in T1.16b: the owner's amount cap, $9,999,999.99 ════════════

test.describe("T1.16b: the amount cap in other costs", () => {
  test('typing "9999999.99" shows "Reads as $9,999,999.99", part of the Amount field\'s description', async ({
    page,
  }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await press(addOtherCostsButton(page), touch(testInfo));
    await ocAmount(page).fill("9999999.99");
    await expect(otherCosts(page).getByText("Reads as $9,999,999.99", { exact: true })).toBeVisible();
    expect(await describedByTexts(ocAmount(page))).toContain("Reads as $9,999,999.99");
  });

  test('"$9,999,999.99" saves: "Other costs $9,999,999.99" and "Result after other costs -$9,996,498.99"', async ({
    page,
  }, testInfo) => {
    await openExample(page);
    await setOtherCosts(page, touch(testInfo), "$9,999,999.99");
    await expectLine(otherCosts(page), "Other costs $9,999,999.99");
    await expectLine(main(page), "Result after other costs -$9,996,498.99");
  });

  test('typing "10000000" shows no "Reads as" text', async ({ page }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await press(addOtherCostsButton(page), touch(testInfo));
    await ocAmount(page).fill("10000000");
    await expect(otherCosts(page).getByText(/^\s*Reads as\b/)).toHaveCount(0);
  });

  for (const typed of ["10000000", "10,000,000.00"]) {
    test(`Save with "${typed}" shows exactly "${ERROR_AMOUNT_TOO_LARGE}" (not the format message), marks Amount invalid, focuses it and saves nothing`, async ({
      page,
    }, testInfo) => {
      await openExample(page);
      await press(addOtherCostsButton(page), touch(testInfo));
      await ocAmount(page).fill(typed);
      await expect(otherCosts(page).getByText(ERROR_AMOUNT_TOO_LARGE, { exact: true })).toHaveCount(0);
      await press(ocSave(page), touch(testInfo));
      await expect(otherCosts(page).getByText(ERROR_AMOUNT_TOO_LARGE, { exact: true })).toBeVisible();
      await expect(otherCosts(page).getByText(ERROR_AMOUNT_INVALID, { exact: true })).toHaveCount(0);
      await expect(ocAmount(page)).toHaveAttribute("aria-invalid", "true");
      expect(await describedByTexts(ocAmount(page))).toContain(ERROR_AMOUNT_TOO_LARGE);
      await expect(ocAmount(page)).toBeFocused();
      await expect(otherCosts(page).getByText(/^\s*Reads as\b/)).toHaveCount(0);
      await expectNoLineStarting(otherCosts(page), "Other costs $");
      await expectNoLineStarting(main(page), "Result after other costs");
    });
  }

  test('"Change" to "10000000" is refused and the saved $600.00 stays', async ({ page }, testInfo) => {
    const t = touch(testInfo);
    await openExample(page);
    await setOtherCosts(page, t, "600");
    await press(ocChange(page), t);
    await ocAmount(page).fill("10000000");
    await press(ocSave(page), t);
    await expect(otherCosts(page).getByText(ERROR_AMOUNT_TOO_LARGE, { exact: true })).toBeVisible();
    await press(ocCancel(page), t);
    await expectLine(otherCosts(page), "Other costs $600.00");
    await expectLine(main(page), "Result after other costs $2,901.00");
  });

  test('Save with "9999999.991" (three decimals) shows the format message, not the cap message', async ({
    page,
  }, testInfo) => {
    await openEvent(page, COMIC_CON);
    await press(addOtherCostsButton(page), touch(testInfo));
    await ocAmount(page).fill("9999999.991");
    await press(ocSave(page), touch(testInfo));
    await expect(otherCosts(page).getByText(ERROR_AMOUNT_INVALID, { exact: true })).toBeVisible();
    await expect(otherCosts(page).getByText(ERROR_AMOUNT_TOO_LARGE, { exact: true })).toHaveCount(0);
    expect(await describedByTexts(ocAmount(page))).toContain(ERROR_AMOUNT_INVALID);
  });

  test('fixing "10000000" to "9999999.99" removes the error and aria-invalid, shows "Reads as", and Save keeps it', async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openEvent(page, COMIC_CON);
    await press(addOtherCostsButton(page), t);
    await ocAmount(page).fill("10000000");
    await press(ocSave(page), t);
    await expect(otherCosts(page).getByText(ERROR_AMOUNT_TOO_LARGE, { exact: true })).toBeVisible();
    await ocAmount(page).fill("9999999.99");
    await expect(otherCosts(page).getByText(ERROR_AMOUNT_TOO_LARGE, { exact: true })).toHaveCount(0);
    await expect(ocAmount(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(otherCosts(page).getByText("Reads as $9,999,999.99", { exact: true })).toBeVisible();
    await press(ocSave(page), t);
    await expectLine(otherCosts(page), "Other costs $9,999,999.99");
  });
});
