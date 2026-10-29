// Home's "today" totals and the life of pretend entries (moved here from
// entries-list.spec.ts in T1.17b, docs/stages/stage-01.md "T1.17b — Retire
// the old Transactions page"). Guide §6 (today is the device's own date),
// §10 ("Today: $640 from 23 sales"), §17 Stage 1 (entries vanish on refresh),
// §19 (late-night Perth, early-morning Sydney; screen readers).
//
// What moved, and what changed (T1.17b):
//   - Home's two totals lines (old D3), their polite live region (old D10)
//     and their place in the accessibility tree: moved UNCHANGED. They stay
//     until T1.18 replaces Home's "today" totals with the month summary;
//     T1.18 will mark these CHANGED.
//   - "Lost on refresh" (old D7) and "entries survive client-side moves":
//     their intent is kept, but the list they looked at was /transactions,
//     which T1.17b removes. They now look at the Expenses tab (expense rows)
//     and a stream page (income rows). Marked CHANGED (T1.17b).
//   - The Transactions list's own row tests (old D4–D6, D8) are retired with
//     the page; where their intent still applies it now lives in
//     expenses.spec.ts and income-streams.spec.ts (see the mapping in the
//     T1.17b report).
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop).
//
// ═══ DECISIONS ══════════════════════════════════════════════════════════════
//
// H1. Locale. Amounts use the device's locale (navigator.language) through
//     formatCents(cents, "AUD", locale): en-AU "$1,234.56", en-US "A$1,234.56".
// H2. "Today" is the device's own date in its own time zone (guide §6), never
//     the UTC date. Tests pin `timezoneId` and freeze the clock.
// H3. Home shows two lines, each its own element whose whole text is exactly:
//       "Today: <formatCents(income today)> from <N> sales"
//       "Today's expenses: <formatCents(expenses today)>"
//     with a plain ASCII apostrophe. N counts every income row dated today,
//     from every stream, $0.00 rows included; "from 1 sale" when N is 1.
//     With no entries: "Today: $0.00 from 0 sales" and "Today's expenses: $0.00".
//     They update as soon as an entry is added, without a reload.
// H4. The two lines sit inside a POLITE live region (aria-live="polite", or
//     role="status" or <output>), never assertive or missing; and both are in
//     the accessibility tree.
// H5. Lost on refresh (the stage lesson). Entries live only in React state:
//     a reload or typing an address again shows no entries, and nothing is
//     written to localStorage, sessionStorage or IndexedDB. Client-side moves
//     (tabs, links) keep them.
// H6. No uncaught errors and no React hydration errors during any test.
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
// Sydney, today 2026-07-01:
//   income   A3 1250 + A4 0 + A7 2000 + A10 123456 = 126706 → "$1,267.06", 4 rows
//   expenses A2 2350 + A8 3299                     =   5649 → "$56.49"
// Perth, today 2026-06-30:
//   income   A1 4500 + A9 999 + A11 1 = 5500 → "$55.00", 3 rows
//   expenses none                       → "$0.00"
// (An app that used the UTC date in Sydney would show the Perth numbers, one
// that skipped $0.00 rows would say "3 sales", and one that counted only
// "Sales at events" would say "$20.00 from 1 sale".)
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

const HOME_EMPTY_SALES = "Today: $0.00 from 0 sales";
const HOME_EMPTY_EXPENSES = "Today's expenses: $0.00";
const HOME_SYDNEY_SALES = "Today: $1,267.06 from 4 sales"; // 1250 + 0 + 2000 + 123456 = 126706
const HOME_SYDNEY_EXPENSES = "Today's expenses: $56.49"; // 2350 + 3299 = 5649
const HOME_PERTH_SALES = "Today: $55.00 from 3 sales"; // 4500 + 999 + 1 = 5500
const HOME_PERTH_EXPENSES = "Today's expenses: $0.00";
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

// ═══ H3. Home's totals ══════════════════════════════════════════════════════

test.describe("Home's today totals (moved from entries-list.spec.ts D3)", () => {
  test(`with no entries, Home says exactly "${HOME_EMPTY_SALES}"`, async ({ page }) => {
    await open(page, "/");
    await expect(exactText(page, HOME_EMPTY_SALES)).toHaveCount(1);
    await expect(exactText(page, HOME_EMPTY_SALES)).toBeVisible();
  });

  test(`with no entries, Home says exactly "${HOME_EMPTY_EXPENSES}"`, async ({ page }) => {
    await open(page, "/");
    await expect(exactText(page, HOME_EMPTY_EXPENSES)).toHaveCount(1);
    await expect(exactText(page, HOME_EMPTY_EXPENSES)).toBeVisible();
  });

  test(`Home says exactly "${HOME_SYDNEY_SALES}" (early morning in Sydney is already 1 July)`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toHaveCount(1);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
  });

  test(`Home says exactly "${HOME_SYDNEY_EXPENSES}"`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_EXPENSES)).toHaveCount(1);
    await expect(exactText(page, HOME_SYDNEY_EXPENSES)).toBeVisible();
  });

  test("Home no longer shows the empty totals once there are entries today", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
    await expect(exactText(page, HOME_EMPTY_SALES)).toHaveCount(0);
    await expect(exactText(page, HOME_EMPTY_EXPENSES)).toHaveCount(0);
  });

  test('a single $0.00 income today shows as "Today: $0.00 from 1 sale"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, [
      { kind: "income", input: { date: "2026-07-01", streamId: "sales-at-events", amountCents: 0, paymentMethod: "cash" } },
    ]);
    await expect(exactText(page, "Today: $0.00 from 1 sale")).toHaveCount(1);
    await expect(exactText(page, "Today: $0.00 from 1 sale")).toBeVisible();
  });

  test("Home's totals update straight away when an income and an expense are added", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
    // 126706 + 750 = 127456 → $1,274.56 from 5 sales; 5649 + 101 = 5750 → $57.50.
    await seed(page, [
      { kind: "income", input: { date: "2026-07-01", streamId: "online-sales", amountCents: 750, paymentMethod: "card" } },
      { kind: "expense", input: { date: "2026-07-01", amountCents: 101, categoryId: "packaging" } },
    ]);
    await expect(exactText(page, "Today: $1,274.56 from 5 sales")).toBeVisible();
    await expect(exactText(page, "Today's expenses: $57.50")).toBeVisible();
  });

  test("entries dated on other days don't change Home's totals", async ({ page }) => {
    await openWithHook(page, "/");
    // Only A1, A5, A6, A9, A11: none is dated 2026-07-01.
    await seed(page, [DATASET[0], DATASET[4], DATASET[5], DATASET[8], DATASET[10]]);
    await expect(exactText(page, HOME_EMPTY_SALES)).toBeVisible();
    await expect(exactText(page, HOME_EMPTY_EXPENSES)).toBeVisible();
  });
});

test.describe("late at night in Perth (today = 2026-06-30)", () => {
  test.use({ timezoneId: PERTH });

  test(`Home says exactly "${HOME_PERTH_SALES}"`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_PERTH_SALES)).toHaveCount(1);
    await expect(exactText(page, HOME_PERTH_SALES)).toBeVisible();
  });

  test(`Home says exactly "${HOME_PERTH_EXPENSES}"`, async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_PERTH_SALES)).toBeVisible();
    await expect(exactText(page, HOME_PERTH_EXPENSES)).toHaveCount(1);
  });
});

test.describe("on a US-English device", () => {
  test.use({ locale: "en-US" });

  test('Home says exactly "Today: A$1,267.06 from 4 sales"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, "Today: A$1,267.06 from 4 sales")).toHaveCount(1);
  });
});

// ═══ H4. Screen readers ═════════════════════════════════════════════════════

test.describe("Home's totals are accessible (moved from entries-list.spec.ts D10)", () => {
  test("Home's two totals are in the accessibility tree", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
    const snapshot = await main(page).ariaSnapshot();
    expect(snapshot).toContain(HOME_SYDNEY_SALES);
    expect(snapshot).toContain(HOME_SYDNEY_EXPENSES);
  });

  test("Home's two totals lines sit inside a polite live region", async ({ page }) => {
    await openWithHook(page, "/");
    await expect(exactText(page, HOME_EMPTY_SALES)).toBeVisible();
    expect(await liveRegionOf(exactText(page, HOME_EMPTY_SALES)), "sales total").toBe("polite");
    expect(await liveRegionOf(exactText(page, HOME_EMPTY_EXPENSES)), "expenses total").toBe("polite");
  });
});

// ═══ H5. Entries survive client-side moves, and are lost on refresh ════════

test.describe("entries survive moving between screens (CHANGED (T1.17b): was the Transactions list)", () => {
  test("entries added on Home are listed on the Expenses tab after a client-side move", async ({ page }, testInfo) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
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

  test("Home's totals are still there after going to the Expenses tab and back", async ({ page }, testInfo) => {
    await openWithHook(page, "/expenses");
    await seed(page, DATASET);
    await expect(expenseRows(page)).toHaveCount(4);
    await goByTab(page, "Home", touch(testInfo));
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
    await expect(exactText(page, HOME_SYDNEY_EXPENSES)).toBeVisible();
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

  test("after a reload, Home's totals are back to $0.00 from 0 sales", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
    await page.reload();
    await waitForHook(page);
    await expect(exactText(page, HOME_EMPTY_SALES)).toBeVisible();
    await expect(exactText(page, HOME_EMPTY_EXPENSES)).toBeVisible();
  });

  test("typing the Expenses address again (a full page load) shows no entries", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
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
