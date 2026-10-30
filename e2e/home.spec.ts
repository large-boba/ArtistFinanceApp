// Home's "This month" summary (T1.18) and the life of pretend entries (moved
// here from entries-list.spec.ts in T1.17b, docs/stages/stage-01.md "T1.17b —
// Retire the old Transactions page"). Guide §6 (today is the device's own
// date), §12 (the main profit view, simplified for pretend data), §17 Stage 1
// (entries vanish on refresh), §19 (late-night Perth, early-morning Sydney;
// screen readers); DECISIONS.md "Navigation" (report figures live on Home)
// and "Event 'Other costs'" (never added to overall totals).
//
// What changed in T1.18 ("Home summary: this month"; lead's decisions,
// 2026-10-29):
//   - Home's two "today" lines ("Today: $X from N sales", "Today's expenses:
//     $X") are GONE. Every test that read them is marked CHANGED (T1.18) and
//     keeps its intent through the new month lines: "the lines update live"
//     is now "the month's totals update live", "entries on other days don't
//     count" is now "entries outside this month don't count", and so on.
//     The income-row COUNT ("from N sales") has no successor; the one test
//     that existed only for it ("from 1 sale") now checks a lone $0.00
//     income leaves every line at $0.00 without an error.
//   - The polite-live-region test (old D10, then H4) is re-targeted at the
//     new section, as promised at T1.8. CHANGED (T1.18), lead-approved.
//   - ADDED: H7 (layout), H8 (the month's name), H9 (the month boundary
//     across time zones), H10 (the owner's example and "Other costs"), H11
//     (320×568 at 200% text).
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop)
// unless its name says "on a phone"; those are limited to the phone project
// with a conditional `test.skip(...)`, as in app-shell.spec.ts. On desktop
// they show as skipped, which is expected.
//
// ═══ DECISIONS ══════════════════════════════════════════════════════════════
//
// H1. Locale. Amounts use the device's locale (navigator.language) through
//     formatCents(cents, "AUD", locale): en-AU "$1,234.56", en-US "A$1,234.56".
//     A negative amount has a plain ASCII hyphen-minus before the symbol:
//     −500 cents is "-$5.00" (as formatCents gives it; events.spec.ts header).
// H2. "Today" is the device's own date in its own time zone (guide §6), never
//     the UTC date. Tests pin `timezoneId` and freeze the clock. "This month"
//     is the calendar month that today falls in, first to last day, both
//     included: rangeTotals(state, monthRange(today).from, .to).
// H3. CHANGED (T1.18). Home has a section "This month": a <section> (or other
//     region) labelled by its own h2, whose text is exactly "This month", so
//     it is a region whose accessible name is exactly "This month" (the same
//     convention as the event page, events.spec.ts E4). Inside it, in this
//     order and nothing else:
//       - the h2 "This month";
//       - a line with the month's name in the device's language (H8);
//       - "Income <formatCents(income)>";
//       - "Expenses <formatCents(expenses)>";
//       - "Net <formatCents(income − expenses)>" (negative when costs are
//         higher, e.g. "Net -$50.00").
//     "A line X" means an element in the section whose rendered text,
//     whitespace collapsed, is exactly X (events.spec.ts E4), so
//     "Income <span>$1.00</span>" and <div><dt>Income</dt> <dd>$1.00</dd></div>
//     both count. "Exactly" is pinned by the section's whole rendered text,
//     whitespace collapsed:
//       "This month <month> Income $X Expenses $Y Net $Z".
//     With no entries: "This month July 2026 Income $0.00 Expenses $0.00
//     Net $0.00" (Sydney). The lines update as soon as an entry is added,
//     without a reload. "Other costs" figures never count (rangeTotals).
//     The old lines are gone: no "Today: …" and no "Today's expenses" text
//     anywhere in <main>.
// H4. CHANGED (T1.18). The section itself is a POLITE live region: the
//     section element has aria-live="polite" (role="status" would remove its
//     region role). Its figures are in the accessibility tree.
// H5. Lost on refresh (the stage lesson). Entries live only in React state:
//     a reload or typing an address again shows no entries, and nothing is
//     written to localStorage, sessionStorage or IndexedDB. Client-side moves
//     (tabs, links) keep them.
// H6. No uncaught errors and no React hydration errors during any test.
// H7. ADDED (T1.18). Layout: the h1 "Home", then "+ Add", then the "This
//     month" section, in document order; the section is the only one with
//     that name and holds exactly one heading, the h2. The practice-mode
//     note stays, exactly once.
//     CHANGED (T1.19, owner's change 2026-10-30): the button (now named
//     "Add", a small round button in the bottom-right corner) moves to the
//     END of the page's content. So the order is: the h1 "Home", then the
//     "This month" section, then "Add" (add-button.spec B12 checks that
//     nothing at all comes after it).
// H8. ADDED (T1.18). The month's name is what
//     Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }) gives
//     for that month, worked out from the year and month NUMBERS in UTC
//     (never the "YYYY-MM-DD" string parsed as a Date, which is the day
//     before in the Americas). Hand-worked: en-AU and en-US July 2026 "July 2026", June
//     2026 "June 2026"; de-DE July 2026 "Juli 2026" (proves the device's
//     language is used, since en-AU and en-US agree).
// H9. ADDED (T1.18). The month boundary, worked by hand below: entries on
//     the 1st and the last day of the month count; entries one day outside
//     don't. 15:30Z on 30 June is 1 July in Sydney (month July) but 30 June
//     in Perth (month June), so a 30 June entry counts in Perth only.
// H10. ADDED (T1.18). The owner's example dated within the device's month:
//     Income $4,500.00, Expenses $999.00, Net $3,501.00; $600 "Other costs"
//     on the convention leave Net at $3,501.00.
// H11. ADDED (T1.18). On a phone at 320×568 with 200% text, Home doesn't
//     scroll sideways, even with the largest totals.
//
// ═══ THE HAND-WORKED DATASET (unchanged from entries-list.spec.ts) ══════════
//
// The device clock is frozen at 2026-06-30T15:30:00Z: 01:30 on 1 July in
// Sydney (today = 2026-07-01; the UTC date is still 30 June), 23:30 on 30 June
// in Perth (today = 2026-06-30).
//
//        kind     date        cents  details
//   A1  income   2026-06-30   4500  Vendor shelf rental, cash, the shelf
//   A2  expense  2026-07-01   2350  Printing, "Officeworks"
//   A3  income   2026-07-01   1250  Commissions, card
//   A4  income   2026-07-01      0  Subscription income, cash (a zero row)
//   A5  expense  2026-06-13   6000  Stall or table fees, no supplier, the convention
//   A6  expense  2026-07-02  15000  Accommodation, "Harbour Hotel"
//   A7  income   2026-07-01   2000  Sales at events, cash, today's market
//   A8  expense  2026-07-01   3299  Software, "  Adobe  " (stored "Adobe")
//   A9  income   2026-06-30    999  Social media, online
//   A10 income   2026-07-01 123456  Wholesale, bank_transfer
//   A11 income   2026-06-30      1  Online sales, other
//
// CHANGED (T1.18): Home now totals the device's MONTH, not its day.
// Sydney, today 2026-07-01, month 2026-07-01 .. 2026-07-31:
//   income   A3 1250 + A4 0 + A7 2000 + A10 123456 = 126706 → "$1,267.06"
//   expenses A2 2350 + A6 15000 + A8 3299          =  20649 → "$206.49"
//            (A6 is 2 July: in the month, though it wasn't "today")
//   net      126706 − 20649                        = 106057 → "$1,060.57"
//   left out: A1, A9, A11 (30 June) and A5 (13 June).
// Perth, today 2026-06-30, month 2026-06-01 .. 2026-06-30:
//   income   A1 4500 + A9 999 + A11 1 = 5500 → "$55.00"
//   expenses A5 6000                    = 6000 → "$60.00"
//   net      5500 − 6000                = −500 → "-$5.00" (costs higher)
//   left out: A2, A3, A4, A7, A8, A10 (1 July) and A6 (2 July).
// (An app that used the UTC date in Sydney would show the Perth numbers; one
// that counted only "today" would show Sydney expenses "$56.49"; one that
// counted only "Sales at events" would show income "$20.00".)
//
// The dataset's expenses on the Expenses tab (expenses.spec.ts X5 rows), newest
// first (A8 was added after A2 on the same date, so it comes first):
//   A6 02/07/2026 | Accommodation | Harbour Hotel | $150.00
//   A8 01/07/2026 | Software | Adobe | $32.99
//   A2 01/07/2026 | Printing | Officeworks | $23.50
//   A5 13/06/2026 | Stall or table fees | Pretend comic convention | $60.00
// A10 on the Wholesale page (income-streams.spec.ts S5): 01/07/2026, "Bank
// transfer", $1,234.56.
//
// Every expected string is written out by hand.

import { expect, test as base, type Locator, type Page } from "@playwright/test";
// Type-only imports (erased at run time): the seam takes the store's own input types.
import type { ExpenseInput, IncomeInput } from "../src/lib/entries";

// ---------- fixed facts ----------

const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";
const PERTH = "Australia/Perth";
const HOOK_NAME = "__bentoTest";
const HOOK_WAIT_MS = 10_000;

const TODAYS_MARKET = "pretend-event-todays-market";
const CONVENTION = "pretend-event-comic-con";
const SHELF = "pretend-event-shelf";

type SeedItem = { kind: "income"; input: IncomeInput } | { kind: "expense"; input: ExpenseInput };

/** A1..A11 in the order they are added. */
const DATASET: readonly SeedItem[] = [
  /* A1  */ { kind: "income", input: { date: "2026-06-30", streamId: "vendor-shelf-rental", amountCents: 4500, paymentMethod: "cash", eventId: SHELF } },
  /* A2  */ { kind: "expense", input: { date: "2026-07-01", amountCents: 2350, categoryId: "printing", supplier: "Officeworks" } },
  /* A3  */ { kind: "income", input: { date: "2026-07-01", streamId: "commissions", amountCents: 1250, paymentMethod: "card" } },
  /* A4  */ { kind: "income", input: { date: "2026-07-01", streamId: "subscription-income", amountCents: 0, paymentMethod: "cash" } },
  /* A5  */ { kind: "expense", input: { date: "2026-06-13", amountCents: 6000, categoryId: "stall-table-fees", eventId: CONVENTION } },
  /* A6  */ { kind: "expense", input: { date: "2026-07-02", amountCents: 15000, categoryId: "accommodation", supplier: "Harbour Hotel" } },
  /* A7  */ { kind: "income", input: { date: "2026-07-01", streamId: "sales-at-events", amountCents: 2000, paymentMethod: "cash", eventId: TODAYS_MARKET } },
  /* A8  */ { kind: "expense", input: { date: "2026-07-01", amountCents: 3299, categoryId: "software", supplier: "  Adobe  " } },
  /* A9  */ { kind: "income", input: { date: "2026-06-30", streamId: "social-media", amountCents: 999, paymentMethod: "online" } },
  /* A10 */ { kind: "income", input: { date: "2026-07-01", streamId: "wholesale", amountCents: 123456, paymentMethod: "bank_transfer" } },
  /* A11 */ { kind: "income", input: { date: "2026-06-30", streamId: "online-sales", amountCents: 1, paymentMethod: "other" } },
];

/** The dataset's four expenses as the Expenses tab lists them (header). */
const DATASET_EXPENSE_ROWS: readonly string[][] = [
  ["02/07/2026", "Accommodation", "Harbour Hotel", "$150.00"],
  ["01/07/2026", "Software", "Adobe", "$32.99"],
  ["01/07/2026", "Printing", "Officeworks", "$23.50"],
  ["13/06/2026", "Stall or table fees", "Pretend comic convention", "$60.00"],
];

// CHANGED (T1.18): the month summary (H3). See the dataset arithmetic above.
const SECTION = "This month";
const MONTH_SYDNEY = "July 2026"; // today 2026-07-01
const MONTH_PERTH = "June 2026"; // today 2026-06-30
const EMPTY = { income: "Income $0.00", expenses: "Expenses $0.00", net: "Net $0.00" } as const;
const SYDNEY_LINES = { income: "Income $1,267.06", expenses: "Expenses $206.49", net: "Net $1,060.57" } as const;
const PERTH_LINES = { income: "Income $55.00", expenses: "Expenses $60.00", net: "Net -$5.00" } as const;
const PRACTICE_NOTE = "Practice mode: entries disappear when you refresh or close the app.";
const NARROW = { width: 320, height: 568 } as const;
const NO_EXPENSES = "No expenses yet.";
const NO_INCOME = "No income yet.";

// ---------- fixture: no uncaught errors, no hydration errors (H6) ----------

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

test.use({ locale: "en-AU", timezoneId: SYDNEY });

// ---------- helpers ----------

async function open(page: Page, url: string): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  const response = await page.goto(url);
  expect(response?.status(), `HTTP status of ${url}`).toBe(200);
}

async function waitForHook(page: Page): Promise<void> {
  await page
    .waitForFunction(
      (name) => {
        const hook = (window as unknown as Record<string, { addIncome?: unknown; addExpense?: unknown } | undefined>)[name];
        return typeof hook?.addIncome === "function" && typeof hook?.addExpense === "function";
      },
      HOOK_NAME,
      { timeout: HOOK_WAIT_MS },
    )
    .catch(() => {
      throw new Error(`test seam window.${HOOK_NAME} never appeared (see test-seam.spec.ts)`);
    });
}

async function openWithHook(page: Page, url: string): Promise<void> {
  await open(page, url);
  await waitForHook(page);
}

async function seed(page: Page, items: readonly SeedItem[]): Promise<void> {
  await page.evaluate(
    ({ name, items }) => {
      const hook = (window as unknown as Record<string, { addIncome(i: unknown): void; addExpense(e: unknown): void }>)[name];
      for (const item of items) {
        if (item.kind === "income") hook.addIncome(item.input);
        else hook.addExpense(item.input);
      }
    },
    { name: HOOK_NAME, items: items as SeedItem[] },
  );
}

function main(page: Page): Locator {
  return page.getByRole("main");
}
function mainNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Main", exact: true });
}
function heading(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}
/** An element in <main> whose whole text is exactly `text`. */
function exactText(page: Page, text: string): Locator {
  return main(page).getByText(text, { exact: true });
}
function expenseRows(page: Page): Locator {
  return main(page).getByRole("region", { name: "All expenses", exact: true }).getByRole("listitem");
}
function incomeRows(page: Page): Locator {
  return main(page).getByRole("region", { name: "Income", exact: true }).getByRole("listitem");
}

async function press(locator: Locator, hasTouch: boolean): Promise<void> {
  await expect(locator).toBeVisible();
  if (hasTouch) await locator.tap();
  else await locator.click();
}
function touch(testInfo: { project: { use: { hasTouch?: boolean } } }): boolean {
  return !!testInfo.project.use.hasTouch;
}

async function goByTab(page: Page, name: "Home" | "Expenses" | "Income", hasTouch: boolean): Promise<void> {
  await press(mainNav(page).getByRole("link", { name, exact: true }), hasTouch);
  await expect(heading(page)).toHaveText(name);
}

async function setMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__t117bSameDocument = true;
  });
}
async function markerStillThere(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as Record<string, unknown>).__t117bSameDocument === true);
}

/** A cost row's rendered lines (expenses.spec.ts X5). */
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

/**
 * The politeness of the nearest live region holding the element (itself or an
 * ancestor): aria-live wins; otherwise role="status" or <output> mean
 * "polite" and role="alert" means "assertive". null when there is none. (H4)
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

/** Home's "This month" section (H3): a region named exactly "This month". */
function summary(page: Page): Locator {
  return main(page).getByRole("region", { name: SECTION, exact: true });
}

/** The rendered texts (whitespace collapsed) of every rendered element inside `container`, itself included. */
function renderedTexts(container: Locator): Promise<string[]> {
  return container.evaluate((root) =>
    [root, ...Array.from(root.querySelectorAll("*"))]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => ((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim()),
  );
}

/** "A line X" (H3): some rendered element in the section whose collapsed text is exactly `text`. */
async function expectLine(page: Page, text: string): Promise<void> {
  await expect(summary(page)).toHaveCount(1);
  await expect
    .poll(async () => (await renderedTexts(summary(page))).includes(text), {
      message: `a line in "${SECTION}" reading exactly "${text}"`,
    })
    .toBe(true);
}

/** No rendered element in the section reads exactly `text`. */
async function expectNoLine(page: Page, text: string): Promise<void> {
  await expect(summary(page)).toHaveCount(1);
  expect(await renderedTexts(summary(page)), `no line reading exactly "${text}"`).not.toContain(text);
}

/** The section's whole rendered text, whitespace collapsed. */
async function summaryText(page: Page): Promise<string> {
  return (await summary(page).innerText()).replace(/\s+/g, " ").trim();
}

/** The section reads exactly "This month <month> <income> <expenses> <net>", nothing else, in that order (H3). */
async function expectSummary(
  page: Page,
  month: string,
  lines: { income: string; expenses: string; net: string },
): Promise<void> {
  await expect(summary(page)).toHaveCount(1);
  const want = `${SECTION} ${month} ${lines.income} ${lines.expenses} ${lines.net}`;
  await expect.poll(() => summaryText(page), { message: `the "${SECTION}" section's whole text` }).toBe(want);
}

/** Sets the root font size like a browser text-size setting and checks it took (add-button.spec.ts). */
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

/** True when `a` comes before `b` in the document. */
async function comesBefore(a: Locator, b: Locator): Promise<boolean> {
  const handle = await b.elementHandle();
  return a.evaluate((el, other) => !!(el.compareDocumentPosition(other as Node) & Node.DOCUMENT_POSITION_FOLLOWING), handle);
}

/** On an event page, saves an "Other costs" figure through its own form (events.spec.ts E8). */
async function setOtherCosts(page: Page, hasTouch: boolean, amount: string): Promise<void> {
  const section = main(page).getByRole("region", { name: "Other costs", exact: true });
  await press(section.getByRole("button", { name: "Add other costs", exact: true }), hasTouch);
  await section.getByRole("textbox", { name: "Amount", exact: true }).fill(amount);
  await press(section.getByRole("button", { name: "Save", exact: true }), hasTouch);
}

// ═══ H3. Home's month summary (CHANGED (T1.18): was the today totals) ═════

test.describe("Home's month summary (CHANGED (T1.18): was Home's today totals, old D3)", () => {
  test(`with no entries, the section reads exactly "This month ${MONTH_SYDNEY} Income $0.00 Expenses $0.00 Net $0.00"`, async ({
    page,
  }) => {
    await openWithHook(page, "/");
    await expectSummary(page, MONTH_SYDNEY, EMPTY);
  });

  test("with no entries, Income, Expenses and Net are each their own line reading $0.00", async ({ page }) => {
    await openWithHook(page, "/");
    await expectLine(page, EMPTY.income);
    await expectLine(page, EMPTY.expenses);
    await expectLine(page, EMPTY.net);
  });

  test(`Home says "${SYDNEY_LINES.income}" (early morning in Sydney is already July; A3 + A4 + A7 + A10)`, async ({
    page,
  }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.income);
  });

  test(`Home says "${SYDNEY_LINES.expenses}" (A2 + A6 + A8: 2 July is in the month)`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.expenses);
  });

  test(`Home says "${SYDNEY_LINES.net}" (126706 − 20649 = 106057 cents)`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.net);
  });

  test("with the dataset, the section reads exactly its heading, the month and the three lines, in order", async ({
    page,
  }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectSummary(page, MONTH_SYDNEY, SYDNEY_LINES);
  });

  test("Home no longer shows the $0.00 lines once there are entries this month", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.income);
    await expectNoLine(page, EMPTY.income);
    await expectNoLine(page, EMPTY.expenses);
    await expectNoLine(page, EMPTY.net);
  });

  test("a lone $0.00 income this month leaves every line at $0.00, with no error (CHANGED (T1.18): was \"from 1 sale\")", async ({
    page,
  }) => {
    await openWithHook(page, "/");
    await seed(page, [
      { kind: "income", input: { date: "2026-07-01", streamId: "sales-at-events", amountCents: 0, paymentMethod: "cash" } },
    ]);
    await expectSummary(page, MONTH_SYDNEY, EMPTY);
  });

  test("a month with costs higher than income shows a negative Net: $50.00 of costs alone is \"Net -$50.00\"", async ({
    page,
  }) => {
    await openWithHook(page, "/");
    // 0 − 5000 = −5000 cents.
    await seed(page, [{ kind: "expense", input: { date: "2026-07-15", amountCents: 5000, categoryId: "parking" } }]);
    await expectSummary(page, MONTH_SYDNEY, { income: "Income $0.00", expenses: "Expenses $50.00", net: "Net -$50.00" });
  });

  test("Home's month totals update straight away when an income and an expense are added", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.income);
    await setMarker(page);
    // Income 126706 + 750 = 127456 → $1,274.56; expenses 20649 + 101 = 20750
    // → $207.50; net 127456 − 20750 = 106706 → $1,067.06.
    await seed(page, [
      { kind: "income", input: { date: "2026-07-31", streamId: "online-sales", amountCents: 750, paymentMethod: "card" } },
      { kind: "expense", input: { date: "2026-07-01", amountCents: 101, categoryId: "packaging" } },
    ]);
    await expectSummary(page, MONTH_SYDNEY, {
      income: "Income $1,274.56",
      expenses: "Expenses $207.50",
      net: "Net $1,067.06",
    });
    expect(await markerStillThere(page), "the update didn't reload the page").toBe(true);
  });

  test("entries dated outside this month don't change Home's totals (CHANGED (T1.18): was \"other days\")", async ({
    page,
  }) => {
    await openWithHook(page, "/");
    // Only A1, A5, A9, A11: 30 June and 13 June, both before July.
    await seed(page, [DATASET[0], DATASET[4], DATASET[8], DATASET[10]]);
    await expectSummary(page, MONTH_SYDNEY, EMPTY);
  });

  test('the old "Today: …" and "Today\'s expenses" lines are gone from Home', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.income);
    const text = (await main(page).innerText()).replace(/\s+/g, " ");
    expect(text).not.toMatch(/Today:/);
    expect(text).not.toMatch(/Today's expenses/i);
    expect(text).not.toMatch(/from \d+ sales?\b/);
  });
});

test.describe("late at night in Perth (today = 2026-06-30, so the month is June)", () => {
  test.use({ timezoneId: PERTH });

  test(`Home says "${PERTH_LINES.income}" (A1 + A9 + A11)`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, PERTH_LINES.income);
  });

  test(`Home says "${PERTH_LINES.expenses}" (A5, 13 June)`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, PERTH_LINES.expenses);
  });

  test(`Home says "${PERTH_LINES.net}" (5500 − 6000 = −500 cents: costs higher)`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, PERTH_LINES.net);
  });

  test(`the section reads exactly "This month ${MONTH_PERTH} …" with the Perth lines`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectSummary(page, MONTH_PERTH, PERTH_LINES);
  });
});

test.describe("on a US-English device", () => {
  test.use({ locale: "en-US" });

  test('Home says "Income A$1,267.06", "Expenses A$206.49" and "Net A$1,060.57" under "July 2026"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectSummary(page, MONTH_SYDNEY, {
      income: "Income A$1,267.06",
      expenses: "Expenses A$206.49",
      net: "Net A$1,060.57",
    });
  });

  test('with no entries, Home says "Net A$0.00"', async ({ page }) => {
    await openWithHook(page, "/");
    await expectLine(page, "Net A$0.00");
  });
});

// ═══ H4. Screen readers (CHANGED (T1.18): re-targeted at the section) ═══════

test.describe("Home's month summary is accessible (CHANGED (T1.18): was D10, the two today lines)", () => {
  test('the "This month" section is a polite live region (aria-live="polite" on the section)', async ({ page }) => {
    await openWithHook(page, "/");
    await expectLine(page, EMPTY.income);
    await expect(summary(page)).toHaveAttribute("aria-live", "polite");
  });

  test("the lines inside the section resolve to a polite live region", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.net);
    const net = summary(page).getByText(/^\s*Net\b/).last();
    expect(await liveRegionOf(net), "the Net line").toBe("polite");
    const month = summary(page).getByText(MONTH_SYDNEY, { exact: true });
    expect(await liveRegionOf(month), "the month's name").toBe("polite");
  });

  test("the month's name and the three amounts are in the accessibility tree", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.income);
    const snapshot = await summary(page).ariaSnapshot();
    expect(snapshot).toContain(MONTH_SYDNEY);
    expect(snapshot).toContain("$1,267.06");
    expect(snapshot).toContain("$206.49");
    expect(snapshot).toContain("$1,060.57");
  });
});

// ═══ H7. Layout (ADDED (T1.18)) ═════════════════════════════════════════════

test.describe("Home's layout (ADDED (T1.18))", () => {
  test('there is exactly one region named "This month"', async ({ page }) => {
    await openWithHook(page, "/");
    await expect(summary(page)).toHaveCount(1);
  });

  test('the section holds exactly one heading, a level-2 heading reading exactly "This month"', async ({ page }) => {
    await openWithHook(page, "/");
    await expect(summary(page).getByRole("heading")).toHaveCount(1);
    await expect(summary(page).getByRole("heading", { level: 2 })).toHaveText(SECTION);
  });

  // CHANGED (T1.19): was 'the h1 "Home" comes before "+ Add", which comes
  // before the "This month" section'. The button is now named "Add" and sits
  // at the end of the content, so it comes AFTER the section.
  test('the h1 "Home" comes before the "This month" section, which comes before "Add"', async ({ page }) => {
    await openWithHook(page, "/");
    await expect(summary(page)).toHaveCount(1);
    await expect(heading(page)).toHaveText("Home");
    const add = main(page).getByRole("button", { name: "Add", exact: true });
    await expect(add).toHaveCount(1);
    expect(await comesBefore(heading(page), summary(page)), "h1 before the section").toBe(true);
    expect(await comesBefore(summary(page), add), "the section before Add").toBe(true);
  });

  test("the practice-mode note stays, exactly once", async ({ page }) => {
    await openWithHook(page, "/");
    await expect(exactText(page, PRACTICE_NOTE)).toHaveCount(1);
    await expect(exactText(page, PRACTICE_NOTE)).toBeVisible();
  });
});

// ═══ H8. The month's name in the device's language (ADDED (T1.18)) ═════════

test.describe("the month's name (ADDED (T1.18))", () => {
  test(`in Sydney on 1 July, the month's name is its own line reading exactly "${MONTH_SYDNEY}"`, async ({ page }) => {
    await openWithHook(page, "/");
    await expectLine(page, MONTH_SYDNEY);
  });

  test.describe("in Perth", () => {
    test.use({ timezoneId: PERTH });
    test(`at 23:30 on 30 June, the month's name reads exactly "${MONTH_PERTH}"`, async ({ page }) => {
      await openWithHook(page, "/");
      await expectLine(page, MONTH_PERTH);
    });
  });

  test.describe("on a US-English device", () => {
    test.use({ locale: "en-US" });
    test('the month\'s name reads exactly "July 2026"', async ({ page }) => {
      await openWithHook(page, "/");
      await expectLine(page, "July 2026");
    });
  });

  test.describe("on a German device (the device's language is really used)", () => {
    test.use({ locale: "de-DE" });
    test('the month\'s name reads exactly "Juli 2026"', async ({ page }) => {
      await openWithHook(page, "/");
      await expect(summary(page)).toHaveCount(1);
      await expect
        .poll(async () => (await renderedTexts(summary(page))).includes("Juli 2026"), {
          message: 'a line reading exactly "Juli 2026"',
        })
        .toBe(true);
    });
  });

  test.describe("in Los Angeles (where the string \"2026-07-01\" parsed as a Date would still be June)", () => {
    test.use({ timezoneId: "America/Los_Angeles" });
    test('on 1 July at 01:30 local time, the month\'s name reads exactly "July 2026", not "June 2026"', async ({ page }) => {
      // 2026-07-01T08:30Z is 01:30 on 1 July in Los Angeles (UTC−7 in summer).
      await page.clock.setFixedTime(new Date("2026-07-01T08:30:00.000Z"));
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
      await waitForHook(page);
      await expectLine(page, "July 2026");
      await expectNoLine(page, "June 2026");
    });
  });
});

// ═══ H9. The month boundary, across time zones (ADDED (T1.18)) ═════════════
//
// One dataset, every amount a different digit so a wrong day shows at once:
//   income   2026-05-31 100000, 06-01 20000, 06-30 3000, 07-01 400,
//            07-31 50, 08-01 6
//   expenses 2026-05-31 9, 06-01 80, 06-30 700, 07-01 6000, 07-31 50000,
//            08-01 400000
// Sydney (month July, 07-01 .. 07-31):
//   income 400 + 50 = 450 → "$4.50"; expenses 6000 + 50000 = 56000 → "$560.00";
//   net 450 − 56000 = −55550 → "-$555.50".
// Perth (month June, 06-01 .. 06-30):
//   income 20000 + 3000 = 23000 → "$230.00"; expenses 80 + 700 = 780 → "$7.80";
//   net 23000 − 780 = 22220 → "$222.20".

const BOUNDARY: readonly SeedItem[] = [
  { kind: "income", input: { date: "2026-05-31", streamId: "commissions", amountCents: 100000, paymentMethod: "card" } },
  { kind: "income", input: { date: "2026-06-01", streamId: "commissions", amountCents: 20000, paymentMethod: "card" } },
  { kind: "income", input: { date: "2026-06-30", streamId: "commissions", amountCents: 3000, paymentMethod: "card" } },
  { kind: "income", input: { date: "2026-07-01", streamId: "commissions", amountCents: 400, paymentMethod: "card" } },
  { kind: "income", input: { date: "2026-07-31", streamId: "commissions", amountCents: 50, paymentMethod: "card" } },
  { kind: "income", input: { date: "2026-08-01", streamId: "commissions", amountCents: 6, paymentMethod: "card" } },
  { kind: "expense", input: { date: "2026-05-31", amountCents: 9, categoryId: "software" } },
  { kind: "expense", input: { date: "2026-06-01", amountCents: 80, categoryId: "software" } },
  { kind: "expense", input: { date: "2026-06-30", amountCents: 700, categoryId: "software" } },
  { kind: "expense", input: { date: "2026-07-01", amountCents: 6000, categoryId: "software" } },
  { kind: "expense", input: { date: "2026-07-31", amountCents: 50000, categoryId: "software" } },
  { kind: "expense", input: { date: "2026-08-01", amountCents: 400000, categoryId: "software" } },
];

test.describe("the month boundary in Sydney (ADDED (T1.18); month July)", () => {
  test('1 and 31 July count, 30 June and 1 August don\'t: "Income $4.50"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, BOUNDARY);
    await expectLine(page, "Income $4.50");
  });

  test('1 and 31 July count, 30 June and 1 August don\'t: "Expenses $560.00"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, BOUNDARY);
    await expectLine(page, "Expenses $560.00");
  });

  test('1 and 31 July count, 30 June and 1 August don\'t: "Net -$555.50"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, BOUNDARY);
    await expectLine(page, "Net -$555.50");
  });

  test("at 01:30 on 1 July in Sydney, a 30 June income doesn't count: \"Income $0.00\" under \"July 2026\"", async ({
    page,
  }) => {
    await openWithHook(page, "/");
    await seed(page, [
      { kind: "income", input: { date: "2026-06-30", streamId: "online-sales", amountCents: 4500, paymentMethod: "online" } },
    ]);
    await expectSummary(page, MONTH_SYDNEY, EMPTY);
  });
});

test.describe("the month boundary in Perth (ADDED (T1.18); month June)", () => {
  test.use({ timezoneId: PERTH });

  test('1 and 30 June count, 31 May and 1 July don\'t: "Income $230.00"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, BOUNDARY);
    await expectLine(page, "Income $230.00");
  });

  test('1 and 30 June count, 31 May and 1 July don\'t: "Expenses $7.80"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, BOUNDARY);
    await expectLine(page, "Expenses $7.80");
  });

  test('1 and 30 June count, 31 May and 1 July don\'t: "Net $222.20"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, BOUNDARY);
    await expectLine(page, "Net $222.20");
  });

  test("at 23:30 on 30 June in Perth, the same 30 June income counts: \"Income $45.00\" under \"June 2026\"", async ({
    page,
  }) => {
    await openWithHook(page, "/");
    await seed(page, [
      { kind: "income", input: { date: "2026-06-30", streamId: "online-sales", amountCents: 4500, paymentMethod: "online" } },
    ]);
    await expectSummary(page, MONTH_PERTH, { income: "Income $45.00", expenses: "Expenses $0.00", net: "Net $45.00" });
  });
});

// ═══ H10. The owner's example, dated this month (ADDED (T1.18)) ═════════════
//
// DECISIONS.md "What the app is for": day 1 $1,000, day 2 $2,000, day 3
// $1,500; table $500, hotel $299, food $200. In cents:
//   takings 40000 + 60000 = 100000; 80000 + 120000 = 200000;
//           50000 + 100000 = 150000; 100000 + 200000 + 150000 = 450000 → "$4,500.00"
//   costs   50000 + 20000 + 29900 = 99900 → "$999.00"
//   net     450000 − 99900 = 350100 → "$3,501.00"
//   "Other costs" 60000 on the convention: still "$3,501.00" (never added to
//   overall totals). (An app that subtracted it would show "$2,901.00".)
// Sydney (month July): the pretend convention ran 22–24 June, before July,
// so the takings and costs are dated 1–3 July explicitly (lead's note), still
// linked to the convention. Perth (month June): the convention runs 21–23
// June (today − 9 .. today − 7), inside June, so they use its own dates.

function ownerExample(day1: string, day2: string, day3: string): SeedItem[] {
  const take = (date: string, amountCents: number, paymentMethod: "cash" | "card"): SeedItem => ({
    kind: "income",
    input: { date, streamId: "sales-at-events", amountCents, paymentMethod, eventId: CONVENTION },
  });
  return [
    take(day1, 40000, "cash"),
    take(day1, 60000, "card"),
    take(day2, 80000, "cash"),
    take(day2, 120000, "card"),
    take(day3, 50000, "cash"),
    take(day3, 100000, "card"),
    { kind: "expense", input: { date: day1, amountCents: 50000, categoryId: "stall-table-fees", supplier: "Comic con organisers", eventId: CONVENTION } },
    { kind: "expense", input: { date: day2, amountCents: 20000, categoryId: "meals", eventId: CONVENTION } },
    { kind: "expense", input: { date: day3, amountCents: 29900, categoryId: "accommodation", supplier: "Harbour Hotel", eventId: CONVENTION } },
  ];
}
const OWNER_LINES = { income: "Income $4,500.00", expenses: "Expenses $999.00", net: "Net $3,501.00" } as const;

test.describe("the owner's example on Home (ADDED (T1.18); Sydney, dated 1–3 July)", () => {
  const EXAMPLE = ownerExample("2026-07-01", "2026-07-02", "2026-07-03");

  test(`Home says "${OWNER_LINES.income}"`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, EXAMPLE);
    await expectLine(page, OWNER_LINES.income);
  });

  test(`Home says "${OWNER_LINES.expenses}"`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, EXAMPLE);
    await expectLine(page, OWNER_LINES.expenses);
  });

  test(`Home says "${OWNER_LINES.net}"`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, EXAMPLE);
    await expectLine(page, OWNER_LINES.net);
  });

  test(`$600 "Other costs" on the convention leave Home at exactly "${OWNER_LINES.net}" (not "Net $2,901.00")`, async ({
    page,
  }, testInfo) => {
    await openWithHook(page, `/events/${CONVENTION}`);
    await expect(heading(page)).toHaveText("Pretend comic convention");
    await seed(page, EXAMPLE);
    await setOtherCosts(page, touch(testInfo), "600");
    const otherCosts = main(page).getByRole("region", { name: "Other costs", exact: true });
    await expect
      .poll(async () => (await renderedTexts(otherCosts)).includes("Other costs $600.00"), {
        message: 'the event page shows "Other costs $600.00" (the figure was really saved)',
      })
      .toBe(true);
    await goByTab(page, "Home", touch(testInfo));
    await expectSummary(page, MONTH_SYDNEY, OWNER_LINES);
  });
});

test.describe("the owner's example on Home (ADDED (T1.18); Perth, the convention's own June dates)", () => {
  test.use({ timezoneId: PERTH });

  test(`with $600 "Other costs" on the convention, the section reads exactly "This month ${MONTH_PERTH} ${OWNER_LINES.income} ${OWNER_LINES.expenses} ${OWNER_LINES.net}"`, async ({
    page,
  }, testInfo) => {
    await openWithHook(page, `/events/${CONVENTION}`);
    await expect(heading(page)).toHaveText("Pretend comic convention");
    await seed(page, ownerExample("2026-06-21", "2026-06-22", "2026-06-23"));
    await setOtherCosts(page, touch(testInfo), "600");
    const otherCosts = main(page).getByRole("region", { name: "Other costs", exact: true });
    await expect
      .poll(async () => (await renderedTexts(otherCosts)).includes("Other costs $600.00"), {
        message: 'the event page shows "Other costs $600.00" (the figure was really saved)',
      })
      .toBe(true);
    await goByTab(page, "Home", touch(testInfo));
    await expectSummary(page, MONTH_PERTH, OWNER_LINES);
  });
});

// ═══ H11. Small screen, big text (ADDED (T1.18)) ════════════════════════════
//
// The largest totals one month can easily reach in a test: two capped
// incomes and one capped cost (the owner's cap is 999,999,999 cents):
//   income 999999999 + 999999999 = 1999999998 → "$19,999,999.98"
//   expenses 999999999 → "$9,999,999.99"; net 1999999998 − 999999999
//   = 999999999 → "$9,999,999.99".

const BIG: readonly SeedItem[] = [
  { kind: "income", input: { date: "2026-07-01", streamId: "wholesale", amountCents: 999999999, paymentMethod: "bank_transfer" } },
  { kind: "income", input: { date: "2026-07-02", streamId: "wholesale", amountCents: 999999999, paymentMethod: "bank_transfer" } },
  { kind: "expense", input: { date: "2026-07-03", amountCents: 999999999, categoryId: "equipment" } },
];
const BIG_LINES = { income: "Income $19,999,999.98", expenses: "Expenses $9,999,999.99", net: "Net $9,999,999.99" } as const;

test.describe("on a phone at 320×568 with 200% text (ADDED (T1.18))", () => {
  test("on a phone at 320×568 and 200% text, Home with the largest totals doesn't scroll sideways", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize(NARROW);
    await openWithHook(page, "/");
    await seed(page, BIG);
    await expectSummary(page, MONTH_SYDNEY, BIG_LINES);
    await setTextSize(page, 200, "32px");
    await nextFrame(page);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, "scrollable width must not exceed the page width").toBeLessThanOrEqual(clientWidth);
  });

  test("on a phone at 320×568 and 200% text, every rendered element of the section stays inside 0–320 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize(NARROW);
    await openWithHook(page, "/");
    await seed(page, BIG);
    await expectSummary(page, MONTH_SYDNEY, BIG_LINES);
    await setTextSize(page, 200, "32px");
    await nextFrame(page);
    const outside = await summary(page).evaluate((root) =>
      [root, ...Array.from(root.querySelectorAll("*"))]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { tag: el.tagName.toLowerCase(), left: r.left, right: r.right };
        })
        .filter((b) => b.left < -0.5 || b.right > 320.5),
    );
    expect(outside, "elements poking outside the 320 px screen").toEqual([]);
  });
});

// ═══ H5. Entries survive client-side moves, and are lost on refresh ════════

test.describe("entries survive moving between screens (CHANGED (T1.17b): was the Transactions list)", () => {
  test("entries added on Home are listed on the Expenses tab after a client-side move", async ({ page }, testInfo) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.income); // CHANGED (T1.18): was the today sales line
    await setMarker(page);
    await goByTab(page, "Expenses", touch(testInfo));
    expect(await markerStillThere(page), "the move didn't reload the page").toBe(true);
    await expect(expenseRows(page)).toHaveCount(4);
    expect(await allRowLines(expenseRows(page))).toEqual(DATASET_EXPENSE_ROWS);
  });

  test("entries added on Home are listed on their stream's page after a client-side move (Wholesale: A10)", async ({
    page,
  }, testInfo) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await setMarker(page);
    await goByTab(page, "Income", touch(testInfo));
    await press(main(page).getByRole("link", { name: /^\s*Wholesale/ }), touch(testInfo));
    await expect(heading(page)).toHaveText("Wholesale");
    expect(await markerStillThere(page), "the moves didn't reload the page").toBe(true);
    await expect(incomeRows(page)).toHaveCount(1);
    expect(await rowLines(incomeRows(page).first())).toEqual(["01/07/2026", "Bank transfer", "$1,234.56"]);
  });

  test("Home's month totals are still there after going to the Expenses tab and back (CHANGED (T1.18): was the today totals)", async ({
    page,
  }, testInfo) => {
    await openWithHook(page, "/expenses");
    await seed(page, DATASET);
    await expect(expenseRows(page)).toHaveCount(4);
    await goByTab(page, "Home", touch(testInfo));
    await expectSummary(page, MONTH_SYDNEY, SYDNEY_LINES);
  });
});

test.describe("entries are lost on refresh, on purpose (CHANGED (T1.17b): checked on the Expenses tab and a stream page)", () => {
  test("after a reload, the Expenses tab is empty again", async ({ page }) => {
    await openWithHook(page, "/expenses");
    await seed(page, DATASET);
    await expect(expenseRows(page)).toHaveCount(4);
    await page.reload();
    await waitForHook(page);
    await expect(exactText(page, NO_EXPENSES)).toBeVisible();
    await expect(expenseRows(page)).toHaveCount(0);
  });

  test("after a reload, a stream page (Wholesale) is empty again", async ({ page }) => {
    await openWithHook(page, "/income/wholesale");
    await seed(page, DATASET);
    await expect(incomeRows(page)).toHaveCount(1);
    await page.reload();
    await waitForHook(page);
    await expect(exactText(page, NO_INCOME)).toBeVisible();
    await expect(incomeRows(page)).toHaveCount(0);
  });

  test("after a reload, Home's month totals are back to $0.00 (CHANGED (T1.18): was \"$0.00 from 0 sales\")", async ({
    page,
  }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.income);
    await page.reload();
    await waitForHook(page);
    await expectSummary(page, MONTH_SYDNEY, EMPTY);
  });

  test("typing the Expenses address again (a full page load) shows no entries", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expectLine(page, SYDNEY_LINES.income); // CHANGED (T1.18): was the today sales line
    await openWithHook(page, "/expenses");
    await expect(exactText(page, NO_EXPENSES)).toBeVisible();
    await expect(expenseRows(page)).toHaveCount(0);
  });

  test("nothing is saved in localStorage, sessionStorage or IndexedDB", async ({ page }) => {
    await openWithHook(page, "/expenses");
    await seed(page, DATASET);
    await expect(expenseRows(page)).toHaveCount(4);
    const stored = await page.evaluate(async () => ({
      localStorage: localStorage.length,
      sessionStorage: sessionStorage.length,
      indexedDB: (await indexedDB.databases()).map((d) => d.name),
    }));
    expect(stored).toEqual({ localStorage: 0, sessionStorage: 0, indexedDB: [] });
  });
});
