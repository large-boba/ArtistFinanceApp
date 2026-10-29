// Expenses tab (T1.17, docs/stages/stage-01.md).
// Guide §7 (the three expense groups), §12; DECISIONS.md "Costs", "Linking
// costs to events and streams", "Event 'Other costs'", "The '+' button".
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Same structure and conventions as events.spec.ts and income-streams.spec.ts:
// sections are regions named by their h2, "a line X" is an element whose
// rendered text (whitespace collapsed) is exactly X, and money is worked out
// by hand. Every test runs in both Playwright projects (phone 390×844 and
// desktop) unless its name says "on a phone"; those are limited to the phone
// project with a conditional `test.skip(...)`, so on desktop they show as
// skipped.
//
// How data gets in: the test seam window.__bentoTest.addIncome / addExpense
// (test-seam.spec.ts S0–S6; entries-list.spec.ts until T1.17b) for what the page SHOWS, and the real form
// through "+ Add" for the round trips and the owner's example. Entries live in
// memory, so every move between screens is client-side (tabs, links, or
// window.next.router.push, the call a next/link link makes).
//
// NOT testable here: "all money comes from expensesSummary" (no screen adds
// amounts itself) and "one shared cost-row component" are about the code's
// structure; the code review checks them. What IS tested: every figure, the
// exact parts of every row and their order, that the event page, the stream
// page and this list show a cost IDENTICALLY, and the same `class` on a cost
// row on all three pages (a cheap structural hint). The summary itself is
// pinned in src/lib/summaries.test.ts (decision I).
//
// ═══ HAND-WORKED FACTS ═══════════════════════════════════════════════════════
//
// The device clock is frozen at 2026-06-30T15:30:00Z.
//   Sydney (UTC+10): 01:30 on 1 July → today = 2026-07-01 (the form's default date).
//   Perth (UTC+8):   23:30 on 30 June → today = 2026-06-30.
// Dates show as formatDateForDisplay(iso, "en-AU") ("22/06/2026"); money as
// formatCents(cents, "AUD", "en-AU").
//
// THE OWNER'S EXAMPLE (lead, T1.17): the convention's three costs plus a $120
// Printing (production) cost and a $15 Software (operating) cost tagged
// Online sales. In cents:
//   22/06 Stall or table fees "Comic con organisers" 50000  event & venue, convention
//   23/06 Meals (no supplier)                        20000  event & venue, convention
//   24/06 Accommodation "Harbour Hotel"              29900  event & venue, convention
//   20/06 Printing "Zine printer"                    12000  production
//   30/06 Software "Adobe"                            1500  operating, tagged Online sales
//   Production    12000                         → "$120.00"
//   Event & venue 50000 + 20000 + 29900 = 99900 → "$999.00"
//   Operating     1500                          → "$15.00"
//   Total         12000 + 99900 + 1500 = 113400 → "$1,134.00"
//   Newest first: 30/06 Software, 24/06 Accommodation, 23/06 Meals,
//                 22/06 Stall or table fees, 20/06 Printing.
//
// THE ROWS DATASET (every shape of row), seeded in this order:
//   a 23/06 Parking "City carpark" 4000, convention AND tagged Online sales, notes "Saturday"
//   b 29/06 Marketing "Insta ads" 2500, tagged Online sales
//   c 01/07 Meals (no supplier) 0, linked to the market, notes "Free lunch from the organisers"
//   d 28/06 Website (no supplier, no event, no stream, no notes) 1999
//   e 26/06 Packaging "Box Co" 3450, notes "  Mailers  " (stored trimmed: "Mailers")
//   f 01/06 Vendor shelf rent "Gallery Co" 15000, linked to the shelf
//   g 10/06 Equipment "Camera shop" 3000, tagged Wholesale
//   h 28/06 Phone "Telco" 500 (same date as d, added after it → listed before it)
//   Production    3450                               → "$34.50"
//   Event & venue 4000 + 0 + 15000 = 19000           → "$190.00"
//   Operating     2500 + 1999 + 3000 + 500 = 7999     → "$79.99"
//   Total         3450 + 19000 + 7999 = 30449        → "$304.49"
//   Newest first: c 01/07, b 29/06, h 28/06, d 28/06, e 26/06, a 23/06, g 10/06, f 01/06.
//
// THE CAP (T1.16b): two capped costs, Printing 999999999 and Website 999999999:
//   Production "$9,999,999.99", Event & venue "$0.00", Operating "$9,999,999.99",
//   Total 1999999998 → "$19,999,999.98" (totals aren't capped).
//
// ═══ DECISIONS (lead's, T1.17; written out here so the tests can be exact) ══
//
// X1. The top of /expenses: exactly one h1, "Expenses"; then "+ Add"
//     DIRECTLY under it (the h1's next element sibling is the button or holds
//     it; exactly one; before the first h2); then the sections. Its links
//     stay as add-button.spec B4 says (no pre-fill, back=/expenses).
//
// X2. Sections: exactly these level-2 headings, in order: "Totals",
//     "All expenses". Each is a <section> labelled by its h2 (a region named
//     exactly so). The "coming next" note is gone (app-shell claim 7,
//     CHANGED (T1.17)).
//
// X3. Totals: the lines, exactly and in this order,
//       "Production $X", "Event & venue $X", "Operating $X", "Total expenses $X"
//     (from expensesSummary), ALWAYS shown, "$0.00" included. These four are
//     the only money amounts in the section.
//
// X4. All expenses: a list with one item per expense, newest first (later
//     date first; on the same date the one added later first). With none:
//     the line "No expenses yet." and no list items (the Totals still show).
//
// X5. THE COST ROW (shared by this list, the event page's "Event & venue
//     costs" and the stream page's "Costs"). The row is the list item. Its
//     rendered lines (its innerText split at line breaks, each line's
//     whitespace collapsed and trimmed, empty lines dropped) are EXACTLY, in
//     this order:
//       1. the date                                  "22/06/2026"
//       2. the category name                         "Stall or table fees"
//       3. the supplier, only when set               "Comic con organisers"
//       4. only when there's an event or a stream:
//            both:        "<event name> · <stream name>"  (space, U+00B7, space)
//            event only:  "<event name>"
//            stream only: "<stream name>"
//       5. the notes, only when set (trimmed)        "Saturday"
//       6. the amount                                "$500.00"
//     and nothing else (no hidden extra text either: innerText includes
//     visually-hidden text). So each part is its own block-level line; a
//     builder who wants the amount on the right of the date can use a flex
//     row, whose items are still separate lines in innerText.
//     The li has the same `class` on all three pages.
//
// X6. Round trip: "+ Add" → "Add expense" → Save → back on /expenses (no
//     reload) with the new row and the totals updated.
//
// X7. Never counted or listed here: income, and an event's "Other costs"
//     figure (DECISIONS.md "Event 'Other costs'").
//
// X8. Size and access: every link and button in <main> is at least 44×44 px.
//     On a phone at 320×568 with 200% text, /expenses with data doesn't scroll
//     sideways and keeps every element in <main> inside 0–320 px.
//
// X9. No uncaught errors and no React hydration errors during any test.

import { expect, test as base, type Locator, type Page } from "@playwright/test";
// Type-only imports (erased at run time): the seam takes the store's own input types.
import type { ExpenseInput, IncomeInput } from "../src/lib/entries";

// ---------- fixed facts ----------

const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";
const PERTH = "Australia/Perth";

const COMIC_CON = { id: "pretend-event-comic-con", name: "Pretend comic convention" };
const MARKET = { id: "pretend-event-todays-market", name: "Pretend weekend market (today)" };
const SHELF = { id: "pretend-event-shelf", name: "Pretend gallery shelf" };

const SECTIONS = ["Totals", "All expenses"] as const;
const NO_EXPENSES = "No expenses yet.";

const HOOK_NAME = "__bentoTest";
const HOOK_WAIT_MS = 10_000;
const MIN_TAP_TARGET_PX = 44;
const NARROW = { width: 320, height: 568 } as const;

/** "<event> · <stream>" (X5 line 4 when both are set). */
const both = (event: string, stream: string) => `${event} · ${stream}`;

/** The four Totals lines (X3), in order. */
function totalsLines(production: string, eventVenue: string, operating: string, total: string): string[] {
  return [`Production ${production}`, `Event & venue ${eventVenue}`, `Operating ${operating}`, `Total expenses ${total}`];
}
const ZERO_TOTALS = totalsLines("$0.00", "$0.00", "$0.00", "$0.00");

// The owner's example (header), seeded out of date order on purpose.
const OWNER_COSTS: readonly ExpenseInput[] = [
  { date: "2026-06-24", amountCents: 29900, categoryId: "accommodation", supplier: "Harbour Hotel", eventId: COMIC_CON.id },
  { date: "2026-06-22", amountCents: 50000, categoryId: "stall-table-fees", supplier: "Comic con organisers", eventId: COMIC_CON.id },
  { date: "2026-06-23", amountCents: 20000, categoryId: "meals", eventId: COMIC_CON.id },
  { date: "2026-06-20", amountCents: 12000, categoryId: "printing", supplier: "Zine printer" },
  { date: "2026-06-30", amountCents: 1500, categoryId: "software", supplier: "Adobe", streamId: "online-sales" },
];
const OWNER_TOTALS = totalsLines("$120.00", "$999.00", "$15.00", "$1,134.00");
const OWNER_ROWS: readonly string[][] = [
  ["30/06/2026", "Software", "Adobe", "Online sales", "$15.00"],
  ["24/06/2026", "Accommodation", "Harbour Hotel", COMIC_CON.name, "$299.00"],
  ["23/06/2026", "Meals", COMIC_CON.name, "$200.00"],
  ["22/06/2026", "Stall or table fees", "Comic con organisers", COMIC_CON.name, "$500.00"],
  ["20/06/2026", "Printing", "Zine printer", "$120.00"],
];
// The convention's takings (events.spec.ts): income, never on this page.
const OWNER_INCOME: readonly IncomeInput[] = [
  { date: "2026-06-22", streamId: "sales-at-events", amountCents: 40000, paymentMethod: "cash", eventId: COMIC_CON.id },
  { date: "2026-06-22", streamId: "sales-at-events", amountCents: 60000, paymentMethod: "card", eventId: COMIC_CON.id },
  { date: "2026-06-23", streamId: "sales-at-events", amountCents: 80000, paymentMethod: "cash", eventId: COMIC_CON.id },
  { date: "2026-06-23", streamId: "sales-at-events", amountCents: 120000, paymentMethod: "card", eventId: COMIC_CON.id },
  { date: "2026-06-24", streamId: "sales-at-events", amountCents: 50000, paymentMethod: "cash", eventId: COMIC_CON.id },
  { date: "2026-06-24", streamId: "sales-at-events", amountCents: 100000, paymentMethod: "card", eventId: COMIC_CON.id },
  { date: "2026-06-30", streamId: "online-sales", amountCents: 12345, paymentMethod: "online", notes: "Etsy order 1042" },
];

// The rows dataset (header), in seeding order a..h.
const ROWS_COSTS: readonly ExpenseInput[] = [
  { date: "2026-06-23", amountCents: 4000, categoryId: "parking", supplier: "City carpark", eventId: COMIC_CON.id, streamId: "online-sales", notes: "Saturday" },
  { date: "2026-06-29", amountCents: 2500, categoryId: "marketing", supplier: "Insta ads", streamId: "online-sales" },
  { date: "2026-07-01", amountCents: 0, categoryId: "meals", eventId: MARKET.id, notes: "Free lunch from the organisers" },
  { date: "2026-06-28", amountCents: 1999, categoryId: "website" },
  { date: "2026-06-26", amountCents: 3450, categoryId: "packaging", supplier: "Box Co", notes: "  Mailers  " },
  { date: "2026-06-01", amountCents: 15000, categoryId: "vendor-shelf-rent", supplier: "Gallery Co", eventId: SHELF.id },
  { date: "2026-06-10", amountCents: 3000, categoryId: "equipment", supplier: "Camera shop", streamId: "wholesale" },
  { date: "2026-06-28", amountCents: 500, categoryId: "phone", supplier: "Telco" },
];
const ROWS_TOTALS = totalsLines("$34.50", "$190.00", "$79.99", "$304.49");
const ROW_C = ["01/07/2026", "Meals", MARKET.name, "Free lunch from the organisers", "$0.00"];
const ROW_B = ["29/06/2026", "Marketing", "Insta ads", "Online sales", "$25.00"];
const ROW_H = ["28/06/2026", "Phone", "Telco", "$5.00"];
const ROW_D = ["28/06/2026", "Website", "$19.99"];
const ROW_E = ["26/06/2026", "Packaging", "Box Co", "Mailers", "$34.50"];
const ROW_A = ["23/06/2026", "Parking", "City carpark", both(COMIC_CON.name, "Online sales"), "Saturday", "$40.00"];
const ROW_G = ["10/06/2026", "Equipment", "Camera shop", "Wholesale", "$30.00"];
const ROW_F = ["01/06/2026", "Vendor shelf rent", "Gallery Co", SHELF.name, "$150.00"];
const ROWS_IN_ORDER = [ROW_C, ROW_B, ROW_H, ROW_D, ROW_E, ROW_A, ROW_G, ROW_F];

// ---------- fixture: no uncaught errors, no hydration errors (X9) ----------

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
function region(page: Page, name: string): Locator {
  return main(page).getByRole("region", { name, exact: true });
}
function totals(page: Page): Locator {
  return region(page, "Totals");
}
function allExpenses(page: Page): Locator {
  return region(page, "All expenses");
}
function expenseRows(page: Page): Locator {
  return allExpenses(page).getByRole("listitem");
}
function addButton(page: Page): Locator {
  return main(page).getByRole("button", { name: "+ Add", exact: true });
}
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

async function openExpenses(page: Page): Promise<void> {
  await open(page, "/expenses");
  await expect(heading(page)).toHaveText("Expenses");
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

function renderedTexts(container: Locator): Promise<string[]> {
  return container.evaluate((root) =>
    [root, ...Array.from(root.querySelectorAll("*"))]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim()),
  );
}

/** "A line X": some rendered element inside `container` whose collapsed text is exactly `text`. */
async function expectLine(container: Locator, text: string): Promise<void> {
  await expect(container).toHaveCount(1);
  await expect
    .poll(async () => (await renderedTexts(container)).includes(text), { message: `a line reading exactly "${text}"` })
    .toBe(true);
}

async function textOf(locator: Locator): Promise<string> {
  return (await locator.innerText()).replace(/\s+/g, " ").trim();
}

function amountsIn(text: string): string[] {
  return text.match(/-?\$\d[\d,]*\.\d{2}/g) ?? [];
}

/**
 * The Totals section reads exactly these four lines (X3): each is a line, they
 * come in this document order, and they hold the section's only amounts.
 */
async function expectTotals(page: Page, lines: readonly string[]): Promise<void> {
  for (const line of lines) await expectLine(totals(page), line);
  const order = await totals(page).evaluate((root, wanted) => {
    const all = [root, ...Array.from(root.querySelectorAll("*"))].filter((el) => el.getClientRects().length > 0);
    const texts = all.map((el) => ((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim());
    // Each line's LAST (innermost) element with exactly that text, in document order.
    return wanted.map((w) => texts.lastIndexOf(w));
  }, lines as string[]);
  expect(
    order.every((index, i) => index >= 0 && (i === 0 || index > order[i - 1])),
    `the Totals lines in the order ${lines.join(" | ")} (positions ${order.join(", ")})`,
  ).toBe(true);
  expect(amountsIn(await textOf(totals(page))), "the only amounts in Totals").toEqual(lines.map((l) => amountsIn(l)[0]));
}

/** A cost row's rendered lines (X5): innerText split at line breaks, collapsed, trimmed, empties dropped. */
async function rowLines(row: Locator): Promise<string[]> {
  return (await row.innerText())
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
}

async function allRowLines(rows: Locator): Promise<string[][]> {
  const out: string[][] = [];
  for (const row of await rows.all()) out.push(await rowLines(row));
  return out;
}

async function setMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__t117SameDocument = true;
  });
}
async function markerStillThere(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as Record<string, unknown>).__t117SameDocument === true);
}

function urlOnThisServer(page: Page, path: string): RegExp {
  const origin = new URL(page.url()).origin;
  return new RegExp(`^${escapeRegExp(origin)}${escapeRegExp(path)}$`);
}

async function goByTab(page: Page, name: "Home" | "Events" | "Expenses" | "Income", hasTouch: boolean): Promise<void> {
  await press(mainNav(page).getByRole("link", { name, exact: true }), hasTouch);
  await expect(heading(page)).toHaveText(name);
}

/** A client-side move with Next.js's own router (the call a next/link link makes). */
async function routerPush(page: Page, path: string, h1: string): Promise<void> {
  const ready = await page.evaluate(
    () => typeof (window as unknown as { next?: { router?: { push?: unknown } } }).next?.router?.push === "function",
  );
  expect(ready, "Next.js's client router (window.next.router.push) is available").toBe(true);
  await page.evaluate((target) => {
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(target);
  }, path);
  await expect(page).toHaveURL(urlOnThisServer(page, path));
  await expect(heading(page)).toHaveText(h1);
}

/** On /expenses: "+ Add" → "Add expense" (client-side), checks the form's heading. */
async function openAddExpense(page: Page, t: boolean): Promise<void> {
  await press(addButton(page), t);
  await press(main(page).getByRole("link", { name: "Add expense", exact: true }), t);
  await expect(heading(page)).toHaveText("Add expense");
}

type FormCost = {
  date?: string;
  supplier?: string;
  amount: string;
  category: string;
  event?: string;
  stream?: string;
  notes?: string;
};

/** Fills the expense form and saves. Fields left out keep the form's defaults. */
async function fillAndSave(page: Page, t: boolean, cost: FormCost): Promise<void> {
  if (cost.date !== undefined) await main(page).getByLabel("Date", { exact: true }).fill(cost.date);
  if (cost.supplier !== undefined) await main(page).getByLabel("Supplier (optional)", { exact: true }).fill(cost.supplier);
  await main(page).getByLabel("Amount", { exact: true }).fill(cost.amount);
  await main(page).getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: cost.category });
  if (cost.event !== undefined) {
    await main(page).getByRole("combobox", { name: "Event", exact: true }).selectOption({ label: cost.event });
  }
  if (cost.stream !== undefined) {
    await main(page)
      .getByRole("combobox", { name: "Income stream (optional)", exact: true })
      .selectOption({ label: cost.stream });
  }
  if (cost.notes !== undefined) await main(page).getByLabel("Notes (optional)", { exact: true }).fill(cost.notes);
  await press(main(page).getByRole("button", { name: "Save", exact: true }), t);
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

// ═══ X1, X2. The top of the page and its sections ═══════════════════════════

test.describe("T1.17: the top of /expenses and its sections", () => {
  test('exactly one h1, "Expenses"', async ({ page }) => {
    await openExpenses(page);
    await expect(heading(page)).toHaveCount(1);
  });

  test('exactly one "+ Add", directly under the h1', async ({ page }) => {
    await openExpenses(page);
    await expect(addButton(page)).toHaveCount(1);
    const direct = await heading(page).evaluate((h1) => {
      const next = h1.nextElementSibling;
      if (!next) return "nothing after the h1";
      const isIt = (el: Element) =>
        el.tagName === "BUTTON" && (el.textContent ?? "").replace(/\s+/g, " ").trim() === "+ Add";
      if (isIt(next) || Array.from(next.querySelectorAll("button")).some(isIt)) return "yes";
      return `next sibling is <${next.tagName.toLowerCase()}> "${(next.textContent ?? "").trim().slice(0, 40)}"`;
    });
    expect(direct).toBe("yes");
  });

  test('"+ Add" comes before the first section heading', async ({ page }) => {
    await openExpenses(page);
    const place = await main(page).evaluate((m) => {
      const h2 = m.querySelector("h2");
      const button = Array.from(m.querySelectorAll("button")).find(
        (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === "+ Add",
      );
      if (!h2 || !button) return "missing h2 or button";
      return (button.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 ? "before" : "after";
    });
    expect(place).toBe("before");
  });

  test(`the level-2 headings are exactly ${SECTIONS.join(", ")}, in that order`, async ({ page }) => {
    await openExpenses(page);
    const h2s = await main(page)
      .getByRole("heading", { level: 2 })
      .evaluateAll((els) => els.map((e) => ((e as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim()));
    expect(h2s).toEqual([...SECTIONS]);
  });

  for (const name of SECTIONS) {
    test(`"${name}" is a region named by its h2`, async ({ page }) => {
      await openExpenses(page);
      await expect(region(page, name)).toHaveCount(1);
      await expect(region(page, name).getByRole("heading", { level: 2, name, exact: true })).toHaveCount(1);
    });
  }

  test('the old "coming next" note is gone', async ({ page }) => {
    await openExpenses(page);
    await expect(main(page)).not.toContainText(/\bcoming next\b/i);
  });
});

// ═══ X3. Totals ═════════════════════════════════════════════════════════════

test.describe("T1.17: totals per group", () => {
  test("with nothing entered, all four lines show $0.00, in order", async ({ page }) => {
    await openExpenses(page);
    await expectTotals(page, ZERO_TOTALS);
  });

  test("the owner's example: Production $120.00, Event & venue $999.00, Operating $15.00, Total expenses $1,134.00", async ({
    page,
  }) => {
    await openExpenses(page);
    await seed(page, [], OWNER_COSTS);
    await expectTotals(page, OWNER_TOTALS);
  });

  test("the rows dataset: Production $34.50, Event & venue $190.00, Operating $79.99, Total expenses $304.49", async ({
    page,
  }) => {
    await openExpenses(page);
    await seed(page, [], ROWS_COSTS);
    await expectTotals(page, ROWS_TOTALS);
  });

  test("a group with nothing still shows $0.00: only a $19.99 Website cost gives $0.00 / $0.00 / $19.99 / $19.99", async ({
    page,
  }) => {
    await openExpenses(page);
    await seed(page, [], [{ date: "2026-06-28", amountCents: 1999, categoryId: "website" }]);
    await expectTotals(page, totalsLines("$0.00", "$0.00", "$19.99", "$19.99"));
  });

  test("totals aren't capped: two $9,999,999.99 costs give Total expenses $19,999,999.98", async ({ page }) => {
    await openExpenses(page);
    await seed(
      page,
      [],
      [
        { date: "2026-06-01", amountCents: 999999999, categoryId: "printing" },
        { date: "2026-06-02", amountCents: 999999999, categoryId: "website" },
      ],
    );
    await expectTotals(page, totalsLines("$9,999,999.99", "$0.00", "$9,999,999.99", "$19,999,999.98"));
  });

  test("income never counts: with the convention's takings and an Etsy sale, the owner's totals are unchanged", async ({
    page,
  }) => {
    await openExpenses(page);
    await seed(page, OWNER_INCOME, OWNER_COSTS);
    await expectTotals(page, OWNER_TOTALS);
  });
});

// ═══ X4, X5. All expenses ═══════════════════════════════════════════════════

test.describe("T1.17: all expenses", () => {
  test(`with no expenses, the section says "${NO_EXPENSES}" and lists nothing`, async ({ page }) => {
    await openExpenses(page);
    await expect(allExpenses(page).getByText(NO_EXPENSES, { exact: true })).toBeVisible();
    await expect(expenseRows(page)).toHaveCount(0);
  });

  test(`with only income entered, it still says "${NO_EXPENSES}" and lists nothing`, async ({ page }) => {
    await openExpenses(page);
    await seed(page, OWNER_INCOME, []);
    await expect(allExpenses(page).getByText(NO_EXPENSES, { exact: true })).toBeVisible();
    await expect(expenseRows(page)).toHaveCount(0);
    await expectTotals(page, ZERO_TOTALS);
  });

  test("the owner's example lists five rows, newest first, each with exactly its parts", async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], OWNER_COSTS);
    await expect(expenseRows(page)).toHaveCount(5);
    expect(await allRowLines(expenseRows(page))).toEqual(OWNER_ROWS);
  });

  test(`with expenses there is no "${NO_EXPENSES}" line`, async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], OWNER_COSTS);
    await expect(expenseRows(page)).toHaveCount(5);
    await expect(allExpenses(page).getByText(NO_EXPENSES, { exact: true })).toHaveCount(0);
  });

  test("the rows dataset lists eight rows newest first (on 28/06, Phone added after Website comes first)", async ({
    page,
  }) => {
    await openExpenses(page);
    await seed(page, [], ROWS_COSTS);
    await expect(expenseRows(page)).toHaveCount(8);
    expect(await allRowLines(expenseRows(page))).toEqual(ROWS_IN_ORDER);
  });

  const SHAPES = [
    { index: 5, what: "supplier, event AND stream ('<event> · <stream>'), notes", lines: ROW_A },
    { index: 1, what: "supplier and a stream only", lines: ROW_B },
    { index: 0, what: "no supplier, an event only, notes, and a $0.00 amount", lines: ROW_C },
    { index: 3, what: "nothing optional: only date, category and amount", lines: ROW_D },
    { index: 4, what: "a production cost with supplier and notes (stored trimmed)", lines: ROW_E },
    { index: 7, what: "an event & venue cost linked to the shelf", lines: ROW_F },
    { index: 6, what: "an operating cost tagged Wholesale", lines: ROW_G },
  ] as const;
  for (const s of SHAPES) {
    test(`a row with ${s.what} reads exactly: ${s.lines.join(" | ")}`, async ({ page }) => {
      await openExpenses(page);
      await seed(page, [], ROWS_COSTS);
      await expect(expenseRows(page)).toHaveCount(8);
      expect(await rowLines(expenseRows(page).nth(s.index))).toEqual(s.lines);
    });
  }

  test("each row's one money amount is its own, last line", async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], ROWS_COSTS);
    await expect(expenseRows(page)).toHaveCount(8);
    for (const lines of await allRowLines(expenseRows(page))) {
      expect(amountsIn(lines.join(" ")), `amounts in ${lines.join(" | ")}`).toEqual([lines[lines.length - 1]]);
    }
  });

  test("income never appears in the list: the takings and the Etsy sale aren't rows", async ({ page }) => {
    await openExpenses(page);
    await seed(page, OWNER_INCOME, OWNER_COSTS);
    await expect(expenseRows(page)).toHaveCount(5);
    const text = await textOf(main(page));
    for (const word of ["Etsy order 1042", "$123.45", "Cash", "Card", "$1,200.00"]) {
      expect(text.includes(word), `"${word}" on /expenses`).toBe(false);
    }
  });
});

// ═══ X6. Round trips through "+ Add" ════════════════════════════════════════

test.describe('T1.17: round trips through "+ Add"', () => {
  test("a $15 Software cost tagged Online sales with notes lands back on /expenses as a new row (no reload)", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openExpenses(page);
    await expect(expenseRows(page)).toHaveCount(0);
    await setMarker(page);
    await openAddExpense(page, t);
    await fillAndSave(page, t, {
      supplier: "Adobe",
      amount: "15",
      category: "Software",
      stream: "Online sales",
      notes: "  Yearly plan  ",
    });
    await expect(page).toHaveURL(urlOnThisServer(page, "/expenses"));
    await expect(heading(page)).toHaveText("Expenses");
    expect(await markerStillThere(page), "no reload on the way").toBe(true);
    await expect(expenseRows(page)).toHaveCount(1);
    // Sydney: today is 2026-07-01, the form's default date.
    expect(await rowLines(expenseRows(page).first())).toEqual([
      "01/07/2026",
      "Software",
      "Adobe",
      "Online sales",
      "Yearly plan",
      "$15.00",
    ]);
    await expectTotals(page, totalsLines("$0.00", "$0.00", "$15.00", "$15.00"));
  });

  test("the owner's example entered through the form: five rows, newest first, and Total expenses $1,134.00", async ({
    page,
  }, testInfo) => {
    test.slow(); // five forms in one test
    const t = touch(testInfo);
    await openExpenses(page);
    const costs: FormCost[] = [
      { date: "2026-06-22", supplier: "Comic con organisers", amount: "500", category: "Stall or table fees", event: COMIC_CON.name },
      { date: "2026-06-24", supplier: "Harbour Hotel", amount: "299", category: "Accommodation", event: COMIC_CON.name },
      { date: "2026-06-23", amount: "200", category: "Meals", event: COMIC_CON.name },
      { date: "2026-06-20", supplier: "Zine printer", amount: "120", category: "Printing" },
      { date: "2026-06-30", supplier: "Adobe", amount: "15", category: "Software", stream: "Online sales" },
    ];
    for (const cost of costs) {
      await openAddExpense(page, t);
      await fillAndSave(page, t, cost);
      await expect(page).toHaveURL(urlOnThisServer(page, "/expenses"));
    }
    await expect(expenseRows(page)).toHaveCount(5);
    expect(await allRowLines(expenseRows(page))).toEqual(OWNER_ROWS);
    await expectTotals(page, OWNER_TOTALS);
  });
});

// ═══ X7. Other costs are never here; moves keep the entries ═════════════════

test.describe("T1.17: other costs never count, and entries survive client-side moves", () => {
  test("$600 other costs set on the convention's page change nothing on /expenses", async ({ page }, testInfo) => {
    const t = touch(testInfo);
    await open(page, `/events/${COMIC_CON.id}`);
    await seed(page, OWNER_INCOME, OWNER_COSTS);
    const other = main(page).getByRole("region", { name: "Other costs", exact: true });
    await press(other.getByRole("button", { name: "Add other costs", exact: true }), t);
    await other.getByRole("textbox", { name: "Amount", exact: true }).fill("600");
    await other.getByRole("textbox", { name: "Notes (optional)", exact: true }).fill("Stock sold, at cost");
    await press(other.getByRole("button", { name: "Save", exact: true }), t);
    await expectLine(main(page), "Result after other costs $2,901.00");
    await goByTab(page, "Expenses", t);
    await expectTotals(page, OWNER_TOTALS);
    await expect(expenseRows(page)).toHaveCount(5);
    const text = await textOf(main(page));
    expect(text.includes("$600.00"), "$600.00 on /expenses").toBe(false);
    expect(text.includes("Stock sold, at cost"), "the figure's notes on /expenses").toBe(false);
  });

  test("entries seeded on Home are listed after the Expenses tab (client-side)", async ({ page }, testInfo) => {
    await open(page, "/");
    await seed(page, [], OWNER_COSTS);
    await setMarker(page);
    await goByTab(page, "Expenses", touch(testInfo));
    expect(await markerStillThere(page)).toBe(true);
    await expect(expenseRows(page)).toHaveCount(5);
    await expectTotals(page, OWNER_TOTALS);
  });

  test("entries seeded on /income are listed after window.next.router.push('/expenses')", async ({ page }) => {
    await open(page, "/income");
    await seed(page, [], ROWS_COSTS);
    await setMarker(page);
    await routerPush(page, "/expenses", "Expenses");
    expect(await markerStillThere(page)).toBe(true);
    expect(await allRowLines(expenseRows(page))).toEqual(ROWS_IN_ORDER);
  });

  // The form opened from an event page pre-fills the event AND its usual
  // stream (expense-form.spec.ts F14), so the row reads "<market> · Sales at events".
  test("a cost added from the market's page shows on /expenses with the market's name and its usual stream", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await open(page, `/events/${MARKET.id}`);
    await press(addButton(page), t);
    await press(main(page).getByRole("link", { name: "Add expense", exact: true }), t);
    await expect(heading(page)).toHaveText("Add expense");
    await fillAndSave(page, t, { amount: "45", category: "Parking", supplier: "Market carpark" });
    await expect(page).toHaveURL(urlOnThisServer(page, `/events/${MARKET.id}`));
    await goByTab(page, "Expenses", t);
    await expect(expenseRows(page)).toHaveCount(1);
    expect(await rowLines(expenseRows(page).first())).toEqual([
      "01/07/2026",
      "Parking",
      "Market carpark",
      both(MARKET.name, "Sales at events"),
      "$45.00",
    ]);
    await expectTotals(page, totalsLines("$0.00", "$45.00", "$0.00", "$45.00"));
  });
});

// ═══ X5. The shared cost row on the event page, the stream page and here ════

test.describe("T1.17: a cost row is the same on /expenses, the event page and the stream page", () => {
  /** The lines and the li's class of the one cost row in `rows`. */
  async function onlyRow(rows: Locator): Promise<{ lines: string[]; className: string }> {
    await expect(rows).toHaveCount(1);
    const row = rows.first();
    return { lines: await rowLines(row), className: (await row.getAttribute("class")) ?? "" };
  }

  test("City carpark (convention, tagged Online sales, notes) reads the same on all three pages", async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], [ROWS_COSTS[0]]);
    const here = await onlyRow(expenseRows(page));
    expect(here.lines).toEqual(ROW_A);
    await routerPush(page, `/events/${COMIC_CON.id}`, COMIC_CON.name);
    const onEvent = await onlyRow(region(page, "Event & venue costs").getByRole("listitem"));
    await routerPush(page, "/income/online-sales", "Online sales");
    const onStream = await onlyRow(region(page, "Costs").getByRole("listitem"));
    expect(onEvent.lines, "the event page's row").toEqual(ROW_A);
    expect(onStream.lines, "the stream page's row").toEqual(ROW_A);
  });

  test("Meals with no supplier (convention, no tag) reads the same on all three pages", async ({ page }) => {
    const LINES = ["23/06/2026", "Meals", COMIC_CON.name, "$200.00"];
    await openExpenses(page);
    await seed(page, [], [OWNER_COSTS[2]]);
    expect((await onlyRow(expenseRows(page))).lines).toEqual(LINES);
    await routerPush(page, `/events/${COMIC_CON.id}`, COMIC_CON.name);
    expect((await onlyRow(region(page, "Event & venue costs").getByRole("listitem"))).lines).toEqual(LINES);
    // No tag, so it counts toward the convention's usual stream, Sales at events.
    await routerPush(page, "/income/sales-at-events", "Sales at events");
    expect((await onlyRow(region(page, "Costs").getByRole("listitem"))).lines).toEqual(LINES);
  });

  test("the cost row's <li> has the same, non-empty class on all three pages", async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], [ROWS_COSTS[0]]);
    const here = (await onlyRow(expenseRows(page))).className;
    await routerPush(page, `/events/${COMIC_CON.id}`, COMIC_CON.name);
    const onEvent = (await onlyRow(region(page, "Event & venue costs").getByRole("listitem"))).className;
    await routerPush(page, "/income/online-sales", "Online sales");
    const onStream = (await onlyRow(region(page, "Costs").getByRole("listitem"))).className;
    expect(here.trim(), "the class on /expenses").not.toBe("");
    expect([onEvent, onStream]).toEqual([here, here]);
  });
});

// ═══ Perth: the device's own today, stored dates untouched ══════════════════

test.describe("T1.17: in Perth (today is 30/06/2026 on the device)", () => {
  test.use({ timezoneId: PERTH });

  test("a cost saved with the form's default date is listed as 30/06/2026", async ({ page }, testInfo) => {
    const t = touch(testInfo);
    await openExpenses(page);
    await openAddExpense(page, t);
    await fillAndSave(page, t, { amount: "9.95", category: "Software" });
    await expect(page).toHaveURL(urlOnThisServer(page, "/expenses"));
    await expect(expenseRows(page)).toHaveCount(1);
    expect(await rowLines(expenseRows(page).first())).toEqual(["30/06/2026", "Software", "$9.95"]);
    await expectTotals(page, totalsLines("$0.00", "$0.00", "$9.95", "$9.95"));
  });

  test("stored dates are shown as they are: the owner's example reads the same as in Sydney", async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], OWNER_COSTS);
    await expect(expenseRows(page)).toHaveCount(5);
    expect(await allRowLines(expenseRows(page))).toEqual(OWNER_ROWS);
  });
});

// ═══ X8. Size and access ════════════════════════════════════════════════════

test.describe("T1.17: tap targets are at least 44×44 px", () => {
  test("every link and button in <main> on /expenses (with data) is at least 44×44 px", async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], ROWS_COSTS);
    await expect(expenseRows(page)).toHaveCount(8);
    const controls = await main(page).locator("a, button").all();
    expect(controls.length, "at least the + Add button").toBeGreaterThanOrEqual(1);
    for (const control of controls) {
      if (!(await control.isVisible())) continue;
      const name = await textOf(control);
      const b = await box(control);
      expect(b.width, `"${name}" width`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      expect(b.height, `"${name}" height`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    }
  });
});

test.describe("T1.17: on a phone at 320×568 with 200% text", () => {
  async function narrowBig(page: Page): Promise<void> {
    await page.setViewportSize(NARROW);
    await open(page, "/expenses");
    await setTextSize(page, 200, "32px");
  }

  test("on a phone at 320×568 and 200% text, /expenses with no data doesn't scroll sideways and stays inside 0–320 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await narrowBig(page);
    await expectTotals(page, ZERO_TOTALS);
    await expectNoSidewaysScroll(page);
    expect(await outsideWidth(page, NARROW.width)).toEqual([]);
  });

  test("on a phone at 320×568 and 200% text, /expenses with long rows and capped totals doesn't scroll sideways and stays inside 0–320 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await narrowBig(page);
    await seed(page, [], [
      ...ROWS_COSTS,
      {
        date: "2026-06-24",
        amountCents: 999999999,
        categoryId: "display-equipment-hire",
        supplier: "Harbour Exhibition and Convention Centre Pty Ltd",
        eventId: MARKET.id,
        streamId: "vendor-shelf-rental",
        notes: "Two tables, four chairs, lighting rig and backdrop for the weekend",
      },
      { date: "2026-06-25", amountCents: 999999999, categoryId: "merch-manufacturing", supplier: "Supercalifragilisticmerch" },
    ]);
    await expect(expenseRows(page)).toHaveCount(10);
    // Production 3450 + 999999999 = 1000003449; event & venue 19000 + 999999999 = 1000018999;
    // operating 7999; total 1000003449 + 1000018999 + 7999 = 2000030447.
    await expectTotals(page, totalsLines("$10,000,034.49", "$10,000,189.99", "$79.99", "$20,000,304.47"));
    await expectNoSidewaysScroll(page);
    expect(await outsideWidth(page, NARROW.width)).toEqual([]);
  });
});

// ═══ ADDED (T1.17b): carried over from the retired entries-list.spec.ts ═════
// The Transactions list's claims that still apply to a list of costs, checked
// on the Expenses tab (old D1 en-US locale, D5 a real list, the accessibility
// tree, D8 nothing hidden behind the nav).

test.describe("T1.17b: on a US-English device (from entries-list D1)", () => {
  test.use({ locale: "en-US" });

  test('rows show dates the US way and AUD as "A$" (owner\'s example)', async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], OWNER_COSTS);
    await expect(expenseRows(page)).toHaveCount(5);
    expect(await allRowLines(expenseRows(page))).toEqual([
      ["6/30/2026", "Software", "Adobe", "Online sales", "A$15.00"],
      ["6/24/2026", "Accommodation", "Harbour Hotel", COMIC_CON.name, "A$299.00"],
      ["6/23/2026", "Meals", COMIC_CON.name, "A$200.00"],
      ["6/22/2026", "Stall or table fees", "Comic con organisers", COMIC_CON.name, "A$500.00"],
      ["6/20/2026", "Printing", "Zine printer", "A$120.00"],
    ]);
  });

  test('the totals show AUD as "A$": A$120.00 / A$999.00 / A$15.00 / A$1,134.00', async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], OWNER_COSTS);
    for (const line of totalsLines("A$120.00", "A$999.00", "A$15.00", "A$1,134.00")) {
      await expectLine(totals(page), line);
    }
  });
});

test.describe("T1.17b: the list is accessible and clear of the nav (from entries-list D5, D8)", () => {
  test("the expenses are a real list: one <ul> or <ol> in All expenses whose children are all <li>", async ({
    page,
  }) => {
    await openExpenses(page);
    await seed(page, [], ROWS_COSTS);
    await expect(expenseRows(page)).toHaveCount(8);
    const lists = await allExpenses(page).evaluate((section) =>
      Array.from(section.querySelectorAll("ul, ol")).map((list) => ({
        tag: list.tagName,
        children: Array.from(list.children).map((c) => c.tagName),
      })),
    );
    expect(lists.length, "lists in All expenses").toBe(1);
    expect(["UL", "OL"]).toContain(lists[0].tag);
    expect(lists[0].children).toEqual(Array(8).fill("LI"));
  });

  test("each row's lines are in the accessibility tree", async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], ROWS_COSTS);
    await expect(expenseRows(page)).toHaveCount(8);
    for (let i = 0; i < ROWS_IN_ORDER.length; i++) {
      const snapshot = await expenseRows(page).nth(i).ariaSnapshot();
      for (const part of ROWS_IN_ORDER[i]) {
        expect(snapshot, `row ${i + 1} exposes "${part}" to screen readers`).toContain(part);
      }
    }
  });

  test("scrolled to the bottom, the last row ends at or above the nav's top edge", async ({ page }) => {
    await openExpenses(page);
    await seed(page, [], ROWS_COSTS);
    await expect(expenseRows(page)).toHaveCount(8);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = await box(expenseRows(page).last());
    const nav = await box(mainNav(page));
    expect(last.y + last.height, "bottom of the last row vs top of the nav (px)").toBeLessThanOrEqual(nav.y + 1);
  });
});
