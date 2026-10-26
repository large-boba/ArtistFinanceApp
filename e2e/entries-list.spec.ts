// Entries list and running total (T1.6, docs/stages/stage-01.md), updated for
// T1.10 ("Income entries and income streams (replacing 'sales')"): the store's
// "sale" entries became "income" entries with an income stream, so the seam's
// addSale became addIncome and an income row shows its stream's name where a
// sale row showed "Sale".
// Guide §6 (store a date, show it the local way), §10 ("Today: $640 from 23
// sales"; the seven income streams), §17 Stage 1 step 4, §19 (dates display
// locally; screen reader and keyboard). DECISIONS.md "What the app is for"
// (owner, 2026-10-25: tracking after the fact, not live selling).
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop)
// unless its name says "on a phone", which are limited to the phone project
// with a conditional `test.skip(...)` (as in app-shell.spec.ts).
//
// ═══ THE TEST SEAM (the builder follows this exactly) ═══════════════════════
//
// There is no form to add income until T1.12, so these tests put
// pretend entries into the store through a small hook on `window`. It must be
// impossible for it to reach the live site, so it has TWO independent locks:
//
//   Lock 1, build time. The hook exists only in a build made with the
//     environment variable NEXT_PUBLIC_E2E set to exactly "1".
//     - next.config.ts pins the value so Next.js always inlines it:
//         const e2e = process.env.NEXT_PUBLIC_E2E === "1";
//         env: { NEXT_PUBLIC_E2E: e2e ? "1" : "" },
//       Why: Next.js only inlines NEXT_PUBLIC_ variables that are SET. When it
//       is unset (as on Cloudflare), `process.env.NEXT_PUBLIC_E2E === "1"`
//       stays in the shipped JavaScript as a run-time check, and the hook's
//       code ships with it (the test engineer checked this in a scratch
//       build). Pinned to "", the minifier removes the whole branch.
//     - The flagged build goes in its own folder, never in `.next`, so it
//       can't be packaged or served by mistake:
//         distDir: e2e ? ".next-e2e" : ".next",
//       (Also add `.next-e2e/` to .gitignore and `.next-e2e/**` to the eslint
//       ignores. Next.js adds `.next-e2e/types/**/*.ts` to tsconfig.json the
//       first time; commit that change once so later runs don't dirty it.)
//     - The hook's code sits inside `if (process.env.NEXT_PUBLIC_E2E === "1")`
//       (inline, or a dynamic import() inside that branch) so it is removed
//       from builds without the flag. The string "__bentoTest" must not appear
//       in any file of a flag-off build under .next/static, nor in any
//       non-source-map file under .next/server (claim S3 below).
//   Lock 2, run time. Even in a flagged build, the hook is installed only when
//     `window.location.hostname` is exactly "localhost" or "127.0.0.1".
//
// playwright.config.ts starts TWO servers (a `webServer` array):
//   - port 3000, the baseURL: built and started with NEXT_PUBLIC_E2E=1 (use
//     the webServer `env` option, so the runner's own environment is
//     unchanged), e.g. `npm run build && npm run start -- -p 3000`.
//   - port 3001: built and started WITHOUT the variable (exactly what
//     Cloudflare builds), e.g. `npm run build && npm run start -- -p 3001`.
//   The test runner itself must not have NEXT_PUBLIC_E2E set (claim S0).
//
// The hook, when both locks are open:
//   window.__bentoTest = {
//     addIncome(income: IncomeInput): void,                (T1.10, was addSale)
//     addExpense(expense: ExpenseInput): void,
//   }
//   - Each call does exactly what the real store does for a new entry:
//     dispatch({ type: "add-income", id: crypto.randomUUID(), income }) (or
//     "add-expense"/expense) on the provider's useReducer. Nothing else: no
//     edit, delete, reset, "seed by name", URL parameter or storage. The old
//     addSale is gone: the hook has exactly the two functions above (S6).
//   - IncomeInput is src/lib/entries.ts's type (see entries.test.ts):
//     { date, streamId, amountCents, paymentMethod, eventId?, notes? }, with
//     paymentMethod required. This file writes the inputs out by hand (the
//     IncomeSeed type below) instead of importing the type, so the test build
//     still compiles before T1.10 is built and the red run shows the real
//     failures. A seed the store refuses throws in the page, which fails the
//     test through the D9 fixture.
//   - It is set by the entries provider (in the root layout) in a useEffect
//     once the page has hydrated, so it exists on every page, and it is
//     removed in that effect's cleanup. Tests wait for it to appear.
//   - It is never typed onto the global Window interface for app code; only
//     tests use it.
//
// ═══ DECISIONS FOR THE SCREENS (made here so the tests can be exact) ════════
//
// D1. Locale. Dates and amounts use the device's locale (navigator.language):
//     dates through formatDateForDisplay(iso, locale) and amounts through
//     formatCents(cents, "AUD", locale). Stage 1 has one home currency, AUD.
//     So en-AU shows "01/07/2026" and "$1,234.56"; en-US shows "7/1/2026" and
//     "A$1,234.56". Tests pin the browser with Playwright's `locale` option.
// D2. "Today" is todayOnDevice() in the device's own time zone (guide §6),
//     never the UTC date. Tests pin `timezoneId` and freeze the clock.
// D3. Home shows two lines, each its own element whose whole text is exactly:
//       "Today: <formatCents(income today)> from <N> sales"
//       "Today's expenses: <formatCents(expenses today)>"
//     with a plain ASCII apostrophe (U+0027). N counts every income row dated
//     today, from every stream, $0.00 rows included (T1.10 keeps this wording
//     until T1.18 replaces Home's "today" totals). When N is 1 it says "from 1 sale"
//     (singular). With no entries: "Today: $0.00 from 0 sales" and
//     "Today's expenses: $0.00". The two lines update as soon as an entry is
//     added, without a reload.
// D4. Transactions with no entries: an element whose whole text is exactly
//     "No entries yet." and NO list inside <main>. The old "Coming soon"
//     placeholder note is gone (no /coming (soon|in stage)/i in <main>).
// D5. Transactions with entries: exactly one list in <main> (a <ul> or <ol>,
//     role "list"), with exactly one list item per entry, in the order of
//     entriesNewestFirst (later date first; same date, the one added later
//     first). The "No entries yet." text is gone.
// D6. Each list item (row) shows, as real text a screen reader can read:
//       - the date in a <time> element whose `datetime` attribute is the
//         stored "YYYY-MM-DD" and whose text is formatDateForDisplay(date,
//         locale). Exactly one <time> per row. The raw ISO text is not shown;
//       - the label, in words (so the difference never depends on colour
//         alone, WCAG 1.4.1):
//           expense → the word "Expense";
//           income  → its stream's name from INCOME_STREAMS (T1.10), one of
//                     "Sales at events", "Online sales", "Wholesale",
//                     "Commissions", "Vendor shelf rental", "Social media",
//                     "Subscription income".
//         A row holds exactly one of these eight labels, once, and never the
//         old word "Sale" on its own;
//       - the description:
//           expense → the supplier (as stored, trimmed) if it isn't empty,
//                     otherwise the category's name from DRAFT_CATEGORIES;
//           income  → the event's name from pretendEvents() if the income has
//                     an event, otherwise its payment method label:
//                     cash "Cash", card "Card", online "Online",
//                     bank_transfer "Bank transfer", other "Other";
//       - the amount: formatCents(amountCents, "AUD", locale), shown as
//         stored, with no sign in front ("-" or "−"). Expenses are not shown
//         as negative: the guide keeps negative amounts for refunds (§10), and
//         the label says which it is. Exactly one amount per row, in its
//         own element whose whole text is the amount (e.g. <span>$12.50</span>).
//     The order of these inside a row is up to the builder.
// D7. Lost on refresh (the stage lesson). Entries live only in React state:
//     a reload or typing the address again shows the empty state, and nothing
//     is written to localStorage, sessionStorage or IndexedDB. Moving between
//     tabs with the bottom navigation (client-side) keeps them.
// D8. Layout. With a long list, nothing in <main> hides behind the nav: at
//     the very bottom of the page the last row ends at or above the nav's top
//     edge (within 1 px). The page never scrolls sideways, also at 320 px wide
//     with 200% text.
// D9. No uncaught errors and no React hydration errors during any test.
// D10. Home's two totals lines (D3) sit inside a POLITE live region: the
//     nearest ancestor-or-self with aria-live="polite", or role="status" or
//     an <output> (both polite by default). Not "assertive" or role="alert",
//     and not missing. So a screen reader reads a changed total when it is
//     next free, without interrupting.
//     Carried over from the removed quick-sale spec (its claim Q10, first
//     raised in the T1.6 review) when T1.8 deleted the pad under the owner's
//     2026-10-25 direction. Q10's other half, role="list" on the
//     Transactions list, stays in expense-form.spec.ts (F9).
//
// ═══ THE HAND-WORKED DATASET ════════════════════════════════════════════════
//
// The device clock is frozen at 2026-06-30T15:30:00Z. In Australia/Sydney
// (UTC+10 in winter) that is 01:30 on 1 July, so TODAY = "2026-07-01" there,
// while the UTC date is still 30 June. In Australia/Perth (UTC+8) it is 23:30
// on 30 June, so today = "2026-06-30" there (guide §19's late-night Perth and
// early-morning Sydney cases).
//
// Added in this order (A1 first). The seven income rows use each of the seven
// streams once, so every stream name is checked as a row label. The amounts
// and dates are the same as before T1.10, so the totals didn't change.
//        kind     date        cents  details                        label / description             amount
//   A1  income   2026-06-30   4500  Vendor shelf rental, cash, event: the shelf
//                                   "Vendor shelf rental" / "Pretend gallery shelf"           $45.00
//   A2  expense  2026-07-01   2350  Printing, "Officeworks"        "Expense" / "Officeworks"         $23.50
//   A3  income   2026-07-01   1250  Commissions, card              "Commissions" / "Card"            $12.50
//   A4  income   2026-07-01      0  Subscription income, cash (a zero row)
//                                                                  "Subscription income" / "Cash"    $0.00
//   A5  expense  2026-06-13   6000  Stall or table fees, no supplier, event: the convention
//                                                                  "Expense" / "Stall or table fees" $60.00
//   A6  expense  2026-07-02  15000  Accommodation, "Harbour Hotel" "Expense" / "Harbour Hotel"       $150.00
//   A7  income   2026-07-01   2000  Sales at events, cash, event: today's market
//                                   "Sales at events" / "Pretend weekend market (today)"      $20.00
//   A8  expense  2026-07-01   3299  Software, "  Adobe  " (stored "Adobe")
//                                                                  "Expense" / "Adobe"               $32.99
//   A9  income   2026-06-30    999  Social media, online           "Social media" / "Online"         $9.99
//   A10 income   2026-07-01 123456  Wholesale, bank_transfer       "Wholesale" / "Bank transfer"     $1,234.56
//   A11 income   2026-06-30      1  Online sales, other            "Online sales" / "Other"          $0.01
// (A9 and A11 are paired on purpose: the description "Online" never sits in a
// row labelled "Online sales", so finding "Online" can't be fooled by the label.)
//
// Newest first (date descending; same date, added later first):
//   A6 (07-02) · A10, A8, A7, A4, A3, A2 (07-01) · A11, A9, A1 (06-30) · A5 (06-13)
//
// Sydney, today 2026-07-01:
//   income   A3 1250 + A4 0 + A7 2000 + A10 123456 = 126706 cents → $1,267.06, 4 rows
//   expenses A2 2350 + A8 3299                     =   5649 cents → $56.49
// Perth, today 2026-06-30:
//   income   A1 4500 + A9 999 + A11 1 = 5500 cents → $55.00, 3 rows
//   expenses none                                 → $0.00
// (An app that wrongly used the UTC date in Sydney would show the Perth
// numbers, one that skipped $0.00 rows would say "3 sales", and one that
// counted only "Sales at events" would say "$20.00 from 1 sale".)
//
// Every expected string below is written out by hand. None is computed with
// the app's own code (formatCents, formatDateForDisplay, totalsForDate, ...).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test as base, type Locator, type Page } from "@playwright/test";
// Type-only import (erased at run time): the hook takes the store's own expense
// input type. The income input is written out by hand below (see the seam notes).
import type { ExpenseInput } from "../src/lib/entries";

// ---------- fixed facts ----------

/** 2026-06-30 15:30 UTC: 1 July 01:30 in Sydney, 30 June 23:30 in Perth. */
const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";
const PERTH = "Australia/Perth";

/** The production build WITHOUT NEXT_PUBLIC_E2E (second webServer). */
const FLAG_OFF_BASE_URL = "http://localhost:3001";
/** A hostname that is not localhost, mapped to this machine inside Chromium. */
const NON_LOCAL_HOST = "bentobudget-live.example";
const HOOK_NAME = "__bentoTest";
const HOOK_WAIT_MS = 10_000;

// Pretend event ids and names (pinned by src/lib/pretend-data.test.ts).
const TODAYS_MARKET = "pretend-event-todays-market";
const CONVENTION = "pretend-event-comic-con";
const SHELF = "pretend-event-shelf";

/**
 * What addIncome takes (src/lib/entries.ts IncomeInput, T1.10), written out by
 * hand. streamId is an INCOME_STREAMS id (pinned by pretend-data.test.ts).
 */
type IncomeSeed = {
  date: string;
  streamId: string;
  amountCents: number;
  paymentMethod: "cash" | "card" | "online" | "bank_transfer" | "other";
  eventId?: string | null;
  notes?: string;
};

type SeedItem = { kind: "income"; input: IncomeSeed } | { kind: "expense"; input: ExpenseInput };

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

/** The eight row labels (D6): "Expense" and the seven stream names, written out by hand. */
const ROW_LABELS = [
  "Expense",
  "Sales at events",
  "Online sales",
  "Wholesale",
  "Commissions",
  "Vendor shelf rental",
  "Social media",
  "Subscription income",
] as const;
type RowLabel = (typeof ROW_LABELS)[number];

type Row = {
  iso: string;
  date: string; // as shown for the locale
  label: RowLabel;
  description: string;
  amount: string; // as shown for the locale
};

/** The rows newest first, worked out by hand, in en-AU. */
const ROWS_EN_AU: readonly Row[] = [
  { iso: "2026-07-02", date: "02/07/2026", label: "Expense", description: "Harbour Hotel", amount: "$150.00" }, // A6
  { iso: "2026-07-01", date: "01/07/2026", label: "Wholesale", description: "Bank transfer", amount: "$1,234.56" }, // A10
  { iso: "2026-07-01", date: "01/07/2026", label: "Expense", description: "Adobe", amount: "$32.99" }, // A8
  { iso: "2026-07-01", date: "01/07/2026", label: "Sales at events", description: "Pretend weekend market (today)", amount: "$20.00" }, // A7
  { iso: "2026-07-01", date: "01/07/2026", label: "Subscription income", description: "Cash", amount: "$0.00" }, // A4
  { iso: "2026-07-01", date: "01/07/2026", label: "Commissions", description: "Card", amount: "$12.50" }, // A3
  { iso: "2026-07-01", date: "01/07/2026", label: "Expense", description: "Officeworks", amount: "$23.50" }, // A2
  { iso: "2026-06-30", date: "30/06/2026", label: "Online sales", description: "Other", amount: "$0.01" }, // A11
  { iso: "2026-06-30", date: "30/06/2026", label: "Social media", description: "Online", amount: "$9.99" }, // A9
  { iso: "2026-06-30", date: "30/06/2026", label: "Vendor shelf rental", description: "Pretend gallery shelf", amount: "$45.00" }, // A1
  { iso: "2026-06-13", date: "13/06/2026", label: "Expense", description: "Stall or table fees", amount: "$60.00" }, // A5
];

/** The same rows as an en-US device shows them (AUD is "A$" outside Australia). */
const DATES_EN_US: readonly string[] = [
  "7/2/2026", "7/1/2026", "7/1/2026", "7/1/2026", "7/1/2026", "7/1/2026", "7/1/2026",
  "6/30/2026", "6/30/2026", "6/30/2026", "6/13/2026",
];
const AMOUNTS_EN_US: readonly string[] = [
  "A$150.00", "A$1,234.56", "A$32.99", "A$20.00", "A$0.00", "A$12.50", "A$23.50",
  "A$0.01", "A$9.99", "A$45.00", "A$60.00",
];

const HOME_EMPTY_SALES = "Today: $0.00 from 0 sales";
const HOME_EMPTY_EXPENSES = "Today's expenses: $0.00";
const HOME_SYDNEY_SALES = "Today: $1,267.06 from 4 sales"; // 1250 + 0 + 2000 + 123456 = 126706
const HOME_SYDNEY_EXPENSES = "Today's expenses: $56.49"; // 2350 + 3299 = 5649
const HOME_PERTH_SALES = "Today: $55.00 from 3 sales"; // 4500 + 999 + 1 = 5500
const HOME_PERTH_EXPENSES = "Today's expenses: $0.00";
const EMPTY_TRANSACTIONS = "No entries yet.";

// ---------- fixture: no uncaught errors, no hydration errors (D9) ----------

const test = base.extend<{ pageProblems: string[] }>({
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`));
      page.on("console", (message) => {
        // React 19 reports hydration mismatches as errors #418/#419/#423/#425
        // in production builds, or with the word "hydrat…" in development.
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

// Australian device in Sydney unless a describe block says otherwise.
// The browser also resolves NON_LOCAL_HOST to this machine (used only by the
// "locked to localhost" tests; Playwright allows launch options only at the
// top level of a file). It changes nothing for localhost.
test.use({
  locale: "en-AU",
  timezoneId: SYDNEY,
  launchOptions: { args: [`--host-resolver-rules=MAP ${NON_LOCAL_HOST} 127.0.0.1`] },
});

// ---------- helpers ----------

/** Freezes the device clock, opens a path and requires HTTP 200. */
async function open(page: Page, url: string): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  const response = await page.goto(url);
  expect(response?.status(), `HTTP status of ${url}`).toBe(200);
}

/** Waits until the test seam is installed (the page has hydrated). */
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
      throw new Error(
        `test seam window.${HOOK_NAME} (addIncome, addExpense) never appeared: ` +
          "the app must install it when built with NEXT_PUBLIC_E2E=1 and served on localhost",
      );
    });
}

/** Opens a page of the flagged build and waits for the seam. */
async function openWithHook(page: Page, url: string): Promise<void> {
  await open(page, url);
  await waitForHook(page);
}

/** Adds entries through the seam, in order, in one go. */
async function seed(page: Page, items: readonly SeedItem[]): Promise<void> {
  await page.evaluate(
    ({ name, items }) => {
      const hook = (window as unknown as Record<string, {
        addIncome(income: unknown): void;
        addExpense(expense: unknown): void;
      }>)[name];
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

function entriesList(page: Page): Locator {
  return main(page).getByRole("list");
}

function rows(page: Page): Locator {
  return entriesList(page).getByRole("listitem");
}

/** An element in <main> whose whole text is exactly `text`. */
function exactText(page: Page, text: string): Locator {
  return main(page).getByText(text, { exact: true });
}

/** Taps on a touch device (the phone project), clicks otherwise. */
async function press(locator: Locator, hasTouch: boolean): Promise<void> {
  await expect(locator).toBeVisible();
  if (hasTouch) await locator.tap();
  else await locator.click();
}

/** Moves to a tab with the bottom navigation (a client-side move, no reload). */
async function goToTab(
  page: Page,
  name: "Home" | "Transactions",
  path: "/" | "/transactions",
  hasTouch: boolean,
): Promise<void> {
  await press(mainNav(page).getByRole("link", { name, exact: true }), hasTouch);
  // Same server and host as before, only the path changes (works for every base URL).
  await expect(page).toHaveURL(new RegExp(`^https?://[^/]+${escapeRegExp(path)}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

/** A row's text as laid out, with runs of whitespace collapsed to one space. */
async function rowText(row: Locator): Promise<string> {
  return (await row.innerText()).replace(/\s+/g, " ").trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every money amount in a piece of text ("$1,234.56", "A$0.01", ...). */
function amountsIn(text: string): string[] {
  return text.match(/[A-Z]{0,2}\$\d[\d,]*\.\d{2}/g) ?? [];
}

/** Every row label (D6: "Expense" or a stream name) in a piece of text, in order. */
function labelsIn(text: string): string[] {
  const pattern = new RegExp(`\\b(${ROW_LABELS.map(escapeRegExp).join("|")})\\b`, "g");
  return text.match(pattern) ?? [];
}

/** Every whole-word "Sale" (the old label; "Sales" doesn't count) in a piece of text. */
function oldSaleWordsIn(text: string): string[] {
  return text.match(/\bSale\b/g) ?? [];
}

/**
 * The politeness of the nearest live region holding the element (itself or an
 * ancestor): aria-live wins; otherwise role="status" or <output> mean
 * "polite" and role="alert" means "assertive". null when there is none. (D10;
 * moved from the removed quick-sale.spec.ts.)
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

/** Waits for the page to have hydrated, using the nav's --nav-h (app-shell claim 15). */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue("--nav-h") !== "",
  );
}

/** The folder holding playwright.config.ts (the repository root). */
function repoRoot(): string {
  return path.dirname(test.info().config.configFile!);
}

/** Lists every file under a folder (recursively). */
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

/** Shipped files of a build that contain `needle` (source maps excluded on the server side). */
function buildFilesContaining(distDir: string, needle: string): string[] {
  const shipped = [
    ...filesUnder(path.join(distDir, "static")),
    ...filesUnder(path.join(distDir, "server")).filter((f) => !f.endsWith(".map")),
  ];
  return shipped
    .filter((f) => readFileSync(f).includes(needle))
    .map((f) => path.relative(distDir, f));
}

// ═══ 1. Empty state ═════════════════════════════════════════════════════════

test.describe("with no entries", () => {
  test('Transactions says exactly "No entries yet."', async ({ page }) => {
    await open(page, "/transactions");
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toHaveCount(1);
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toBeVisible();
  });

  test("Transactions shows no list in <main>", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toBeVisible();
    await expect(entriesList(page)).toHaveCount(0);
  });

  test('Transactions no longer shows the "coming soon" placeholder', async ({ page }) => {
    await open(page, "/transactions");
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toBeVisible();
    await expect(main(page)).not.toContainText(/coming (soon|in stage)/i);
  });

  test(`Home says exactly "${HOME_EMPTY_SALES}"`, async ({ page }) => {
    await open(page, "/");
    await expect(exactText(page, HOME_EMPTY_SALES)).toHaveCount(1);
    await expect(exactText(page, HOME_EMPTY_SALES)).toBeVisible();
  });

  test(`Home says exactly "${HOME_EMPTY_EXPENSES}"`, async ({ page }) => {
    await open(page, "/");
    await expect(exactText(page, HOME_EMPTY_EXPENSES)).toHaveCount(1);
    await expect(exactText(page, HOME_EMPTY_EXPENSES)).toBeVisible();
  });
});

// ═══ 2. With the hand-worked dataset (Sydney, today = 2026-07-01, en-AU) ════

test.describe("with the hand-worked entries", () => {
  test("Transactions lists exactly one row per entry (11)", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(entriesList(page)).toHaveCount(1);
    await expect(rows(page)).toHaveCount(11);
  });

  test('the "No entries yet." text is gone once there are entries', async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toHaveCount(0);
  });

  test("rows are newest first: each row's <time datetime> follows the hand-worked order", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    const isoDates = await rows(page).evaluateAll((items) =>
      items.map((item) => Array.from(item.querySelectorAll("time")).map((t) => t.getAttribute("datetime"))),
    );
    expect(isoDates).toEqual(ROWS_EN_AU.map((r) => [r.iso]));
  });

  test("each row shows its date in the device's format (en-AU), in its <time> element", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    const shown = await rows(page).evaluateAll((items) =>
      items.map((item) => Array.from(item.querySelectorAll("time")).map((t) => (t.textContent ?? "").trim())),
    );
    expect(shown).toEqual(ROWS_EN_AU.map((r) => [r.date]));
  });

  test('no row shows the stored "YYYY-MM-DD" text', async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    for (let i = 0; i < ROWS_EN_AU.length; i++) {
      const text = await rowText(rows(page).nth(i));
      expect(text, `row ${i + 1}`).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  test('each row shows its label exactly once ("Expense" or its stream\'s name), and no other label', async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    for (let i = 0; i < ROWS_EN_AU.length; i++) {
      const text = await rowText(rows(page).nth(i));
      expect(labelsIn(text), `row ${i + 1}: "${text}"`).toEqual([ROWS_EN_AU[i].label]);
    }
  });

  test('no row says the old label "Sale" any more', async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    for (let i = 0; i < ROWS_EN_AU.length; i++) {
      const text = await rowText(rows(page).nth(i));
      expect(oldSaleWordsIn(text), `row ${i + 1}: "${text}"`).toEqual([]);
    }
  });

  test("each row shows its description (supplier or category; event or payment method)", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    for (let i = 0; i < ROWS_EN_AU.length; i++) {
      const text = await rowText(rows(page).nth(i));
      expect(text, `row ${i + 1}`).toMatch(
        new RegExp(`(^|[^\\p{L}])${escapeRegExp(ROWS_EN_AU[i].description)}([^\\p{L}]|$)`, "u"),
      );
    }
  });

  test("a supplier typed with spaces around it is shown trimmed", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    // A8 "  Adobe  " is row 3. The DOM text must hold "Adobe" without the spaces.
    const adobe = rows(page).nth(2);
    await expect(adobe).toContainText("Adobe");
    const raw = await adobe.evaluate((el) => el.textContent ?? "");
    expect(raw).not.toContain("  Adobe");
    expect(raw).not.toContain("Adobe  ");
  });

  test("each row shows exactly one amount, formatted in AUD for en-AU, with no sign", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    for (let i = 0; i < ROWS_EN_AU.length; i++) {
      const text = await rowText(rows(page).nth(i));
      expect(amountsIn(text), `row ${i + 1}: "${text}"`).toEqual([ROWS_EN_AU[i].amount]);
      expect(text, `row ${i + 1} has no minus sign before its amount`).not.toMatch(/[-−]\s*\$/);
    }
  });

  test("the $0.00 income is listed like any other income", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    // A4 is row 5.
    const zero = rows(page).nth(4);
    const text = await rowText(zero);
    expect(amountsIn(text)).toEqual(["$0.00"]);
    expect(labelsIn(text)).toEqual(["Subscription income"]);
    await expect(zero.locator("time")).toHaveAttribute("datetime", "2026-07-01");
  });

  test('an Online sales income is labelled "Online sales"', async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, [
      { kind: "income", input: { date: "2026-07-01", streamId: "online-sales", amountCents: 2599, paymentMethod: "card" } },
    ]);
    await expect(rows(page)).toHaveCount(1);
    const row = rows(page).first();
    const text = await rowText(row);
    expect(labelsIn(text), `row: "${text}"`).toEqual(["Online sales"]);
    expect(oldSaleWordsIn(text), `row: "${text}"`).toEqual([]);
    expect(text, "the description is the payment method").toMatch(/(^|[^\p{L}])Card([^\p{L}]|$)/u);
    expect(amountsIn(text)).toEqual(["$25.99"]);
    await expect(row.locator("time")).toHaveAttribute("datetime", "2026-07-01");
    expect(await row.ariaSnapshot(), "the label is in the accessibility tree").toContain("Online sales");
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

  test("entries added on Home are listed after tapping Transactions (state survives moving between tabs)", async ({ page }, testInfo) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", !!testInfo.project.use.hasTouch);
    await expect(rows(page)).toHaveCount(11);
  });

  test("Home's totals are still there after going to Transactions and back", async ({ page }, testInfo) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    await goToTab(page, "Home", "/", !!testInfo.project.use.hasTouch);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
    await expect(exactText(page, HOME_SYDNEY_EXPENSES)).toBeVisible();
  });

  test("an income added while Transactions is open appears straight away, in its newest-first place", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    // Today's newest entry: it goes after A6 (2 July) and before A10, i.e. row 2.
    await seed(page, [
      { kind: "income", input: { date: "2026-07-01", streamId: "sales-at-events", amountCents: 750, paymentMethod: "card" } },
    ]);
    await expect(rows(page)).toHaveCount(12);
    const second = rows(page).nth(1);
    await expect(second.locator("time")).toHaveAttribute("datetime", "2026-07-01");
    expect(amountsIn(await rowText(second))).toEqual(["$7.50"]);
    // The row that was second (A10) is now third.
    expect(amountsIn(await rowText(rows(page).nth(2)))).toEqual(["$1,234.56"]);
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

  test("Transactions shows the same stored dates as in Sydney (the zone never moves a date)", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    const shown = await rows(page).evaluateAll((items) =>
      items.map((item) => (item.querySelector("time")?.textContent ?? "").trim()),
    );
    expect(shown).toEqual(ROWS_EN_AU.map((r) => r.date));
  });
});

test.describe("on a US-English device", () => {
  test.use({ locale: "en-US" });

  test("dates show the US way (7/1/2026)", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    const shown = await rows(page).evaluateAll((items) =>
      items.map((item) => (item.querySelector("time")?.textContent ?? "").trim()),
    );
    expect(shown).toEqual(DATES_EN_US);
  });

  test('amounts show AUD the US way ("A$1,234.56")', async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    for (let i = 0; i < AMOUNTS_EN_US.length; i++) {
      expect(amountsIn(await rowText(rows(page).nth(i))), `row ${i + 1}`).toEqual([AMOUNTS_EN_US[i]]);
    }
  });

  test('Home says exactly "Today: A$1,267.06 from 4 sales"', async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, "Today: A$1,267.06 from 4 sales")).toHaveCount(1);
  });
});

// ═══ 3. Lost on refresh (the stage lesson) ══════════════════════════════════

test.describe("entries are lost on refresh, on purpose", () => {
  test("after a reload, Transactions is empty again", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    await page.reload();
    await waitForHook(page);
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toBeVisible();
    await expect(entriesList(page)).toHaveCount(0);
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

  test("typing the Transactions address again (a full page load) shows no entries", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
    await openWithHook(page, "/transactions");
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toBeVisible();
    await expect(entriesList(page)).toHaveCount(0);
  });

  test("nothing is saved in localStorage, sessionStorage or IndexedDB", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    const stored = await page.evaluate(async () => ({
      localStorage: localStorage.length,
      sessionStorage: sessionStorage.length,
      indexedDB: (await indexedDB.databases()).map((d) => d.name),
    }));
    expect(stored).toEqual({ localStorage: 0, sessionStorage: 0, indexedDB: [] });
  });
});

// ═══ 4. Accessibility ═══════════════════════════════════════════════════════

test.describe("the list is accessible", () => {
  test("the entries are a real list: a <ul> or <ol> whose items are <li>", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    const tags = await entriesList(page).evaluate((list) => ({
      list: list.tagName,
      items: Array.from(list.children).map((child) => child.tagName),
    }));
    expect(["UL", "OL"]).toContain(tags.list);
    expect(tags.items).toEqual(Array(11).fill("LI"));
  });

  test("each row's date, label, description and amount are in the accessibility tree", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    for (let i = 0; i < ROWS_EN_AU.length; i++) {
      const snapshot = await rows(page).nth(i).ariaSnapshot();
      const { date, label, description, amount } = ROWS_EN_AU[i];
      for (const part of [date, label, description, amount]) {
        expect(snapshot, `row ${i + 1} exposes "${part}" to screen readers`).toContain(part);
      }
    }
  });

  test("each row's amount is visible text", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    for (let i = 0; i < ROWS_EN_AU.length; i++) {
      await expect(rows(page).nth(i).getByText(ROWS_EN_AU[i].amount, { exact: true })).toBeVisible();
    }
  });

  test("Home's two totals are in the accessibility tree", async ({ page }) => {
    await openWithHook(page, "/");
    await seed(page, DATASET);
    await expect(exactText(page, HOME_SYDNEY_SALES)).toBeVisible();
    const snapshot = await main(page).ariaSnapshot();
    expect(snapshot).toContain(HOME_SYDNEY_SALES);
    expect(snapshot).toContain(HOME_SYDNEY_EXPENSES);
  });

  // D10. Moved from quick-sale.spec.ts when T1.8 removed the pad.
  test("Home's two totals lines sit inside a polite live region", async ({ page }) => {
    await openWithHook(page, "/");
    await expect(exactText(page, HOME_EMPTY_SALES)).toBeVisible();
    expect(await liveRegionOf(exactText(page, HOME_EMPTY_SALES)), "sales total").toBe("polite");
    expect(await liveRegionOf(exactText(page, HOME_EMPTY_EXPENSES)), "expenses total").toBe("polite");
  });
});

// ═══ 5. Layout with a long list ═════════════════════════════════════════════

test.describe("layout with a long list", () => {
  test("scrolled to the bottom, the last row ends at or above the nav's top edge", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = await rows(page).last().boundingBox();
    const nav = await mainNav(page).boundingBox();
    expect(last).not.toBeNull();
    expect(nav).not.toBeNull();
    expect(last!.y + last!.height, "bottom of the last row vs top of the nav (px)").toBeLessThanOrEqual(nav!.y + 1);
  });

  test("the Transactions page doesn't scroll sideways", async ({ page }) => {
    await openWithHook(page, "/transactions");
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("on a phone 320 px wide at 200% text, no sideways scroll and every amount is inside the screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize({ width: 320, height: 568 });
    await openWithHook(page, "/transactions");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await seed(page, DATASET);
    await expect(rows(page)).toHaveCount(11);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, "page width vs screen width").toBeLessThanOrEqual(clientWidth);
    for (let i = 0; i < ROWS_EN_AU.length; i++) {
      const amount = rows(page).nth(i).getByText(ROWS_EN_AU[i].amount, { exact: true });
      await amount.scrollIntoViewIfNeeded();
      const b = await amount.boundingBox();
      expect(b, `row ${i + 1} amount is rendered`).not.toBeNull();
      expect(b!.x, `row ${i + 1} amount left edge`).toBeGreaterThanOrEqual(0);
      expect(b!.x + b!.width, `row ${i + 1} amount right edge`).toBeLessThanOrEqual(320 + 1);
    }
  });
});

// ═══ 6. The test seam can't reach the live site ═════════════════════════════

test.describe("the test seam is locked", () => {
  test("S0: the test runner itself doesn't set NEXT_PUBLIC_E2E (so the flag-off server really is flag-off)", () => {
    expect(process.env.NEXT_PUBLIC_E2E).toBeUndefined();
  });

  test("S1: in a build without NEXT_PUBLIC_E2E, window.__bentoTest never appears", async ({ page }, testInfo) => {
    await open(page, `${FLAG_OFF_BASE_URL}/`);
    await waitForHydration(page);
    expect(await page.evaluate((name) => name in window, HOOK_NAME)).toBe(false);
    // Still absent after a client-side move to another tab.
    await goToTab(page, "Transactions", "/transactions", !!testInfo.project.use.hasTouch);
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toBeVisible();
    expect(await page.evaluate((name) => name in window, HOOK_NAME)).toBe(false);
  });

  test("S2: the flag-on build does contain the hook name (proves S3's scan can find it)", () => {
    const distDir = path.join(repoRoot(), ".next-e2e");
    expect(existsSync(path.join(distDir, "BUILD_ID")), `${distDir} holds a finished build`).toBe(true);
    expect(buildFilesContaining(distDir, HOOK_NAME).length).toBeGreaterThan(0);
  });

  test("S3: no shipped file of the flag-off build mentions __bentoTest", () => {
    const distDir = path.join(repoRoot(), ".next");
    expect(existsSync(path.join(distDir, "BUILD_ID")), `${distDir} holds a finished build`).toBe(true);
    // Both builds exist, so the flag-on one went to its own folder (S2).
    expect(existsSync(path.join(repoRoot(), ".next-e2e", "BUILD_ID")), "the flagged build is in .next-e2e").toBe(true);
    expect(buildFilesContaining(distDir, HOOK_NAME)).toEqual([]);
  });

  test("S6: the seam offers exactly addExpense and addIncome (addSale is gone; no edit, delete or reset)", async ({ page }) => {
    await open(page, "/");
    // Wait for the hook object itself (not for addIncome), so a hook that
    // still has the old addSale shows up below as the wrong list of names.
    await page.waitForFunction((name) => typeof (window as unknown as Record<string, unknown>)[name] === "object", HOOK_NAME, {
      timeout: HOOK_WAIT_MS,
    });
    const keys = await page.evaluate((name) => {
      const hook = (window as unknown as Record<string, object>)[name];
      return Object.keys(hook).sort();
    }, HOOK_NAME);
    expect(keys).toEqual(["addExpense", "addIncome"]);
  });
});

test.describe("the test seam is locked to localhost", () => {
  // NON_LOCAL_HOST resolves to this machine inside the test browser (see the
  // top-level test.use), so the flagged server on port 3000 is reached under a
  // hostname that isn't localhost.
  test("S4: control: the flagged build on localhost does install the hook", async ({ page }) => {
    await open(page, "http://localhost:3000/");
    await waitForHook(page);
  });

  test("S5: the flagged build reached under another hostname never installs the hook", async ({ page }, testInfo) => {
    await open(page, `http://${NON_LOCAL_HOST}:3000/`);
    expect(await page.evaluate(() => location.hostname)).toBe(NON_LOCAL_HOST);
    await waitForHydration(page);
    expect(await page.evaluate((name) => name in window, HOOK_NAME)).toBe(false);
    await goToTab(page, "Transactions", "/transactions", !!testInfo.project.use.hasTouch);
    await expect(exactText(page, EMPTY_TRANSACTIONS)).toBeVisible();
    expect(await page.evaluate((name) => name in window, HOOK_NAME)).toBe(false);
  });
});
