// Income tab and stream pages (T1.16, docs/stages/stage-01.md).
// Guide §10 (the seven default income streams), §12 "By income stream";
// DECISIONS.md "Linking costs to events and streams", "The '+' button",
// "Event 'Other costs'".
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Same structure and conventions as events.spec.ts: sections are regions
// named by their h2, "a line X" is an element whose rendered text
// (whitespace collapsed) is exactly X, money is worked out by hand, and
// unknown addresses are checked for a real 404 on both servers.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop)
// unless its name says "on a phone"; those are limited to the phone project
// with a conditional `test.skip(...)`. On desktop they show as skipped.
//
// How data gets in: the test seam window.__bentoTest.addIncome / addExpense
// (entries-list.spec.ts S0–S6) for what the pages SHOW, and the real forms
// through "+ Add" for the round trips and the notes. Entries live in memory,
// so every move between screens is client-side (links, tabs).
//
// NOT testable here: "all money comes from streamSummary" (no screen adds
// amounts itself) is about the code's structure; a screen that did its own
// sums correctly would show the same figures. The code review checks it.
// Which costs count toward which stream is pinned in src/lib/summaries.test.ts
// (decisions D, F, G); this file checks that the pages show exactly that.
//
// ═══ HAND-WORKED FACTS ═══════════════════════════════════════════════════════
//
// The device clock is frozen at 2026-06-30T15:30:00Z: 01:30 on 1 July in
// Australia/Sydney, so today on the device is 2026-07-01 and the pretend
// convention runs 2026-06-22..2026-06-24 (see events.spec.ts).
// Dates show as formatDateForDisplay(iso, "en-AU") ("22/06/2026"); money as
// formatCents(cents, "AUD", "en-AU"), negatives with a hyphen-minus ("-$30.00").
//
// Which stream a cost counts toward (summaries.ts decision D): its own stream
// tag if it has one; otherwise, if it's linked to an event, that event's
// usual stream (convention and market → Sales at events; shelf → Vendor shelf
// rental); otherwise none. Production costs never have either, so they count
// toward no stream. "Other costs" figures never count (decision F).
//
// THE OWNER'S EXAMPLE (OWNER_INCOME + OWNER_COSTS), in cents:
//   income (all Sales at events, linked to the convention):
//     22/06 cash 40000, card 60000; 23/06 cash 80000, card 120000;
//     24/06 cash 50000, card 100000
//     Income 40000 + 60000 + 80000 + 120000 + 50000 + 100000 = 450000 → "$4,500.00"
//   costs (linked to the convention, NO stream tag → its usual stream):
//     22/06 Stall or table fees "Comic con organisers" 50000
//     23/06 Meals (no supplier)                        20000
//     24/06 Accommodation "Harbour Hotel"              29900
//     Costs 50000 + 20000 + 29900 = 99900 → "$999.00"
//   Result 450000 − 99900 = 350100 → "$3,501.00"
//   With $600 other costs on the convention: Sales at events is unchanged.
//
// THE MIXED DATASET (the owner's example plus MIXED_INCOME + MIXED_COSTS):
//   Online sales income: 28/06 Online 12000 "Etsy order 1042"; 30/06 Card 3550
//     → 12000 + 3550 = 15550 → "$155.50"
//   Vendor shelf rental income: 15/06 Bank transfer 25000, linked to the shelf
//     → "$250.00"
//   Costs:
//     23/06 Parking "City carpark" 4000, linked to the convention AND tagged
//           Online sales → Online sales ONLY (the tag wins)
//     29/06 Marketing "Insta ads" 2500, tagged Online sales → Online sales
//     01/06 Vendor shelf rent "Gallery Co" 15000, linked to the shelf, no tag
//           → Vendor shelf rental (the shelf's usual stream)
//     10/06 Equipment "Camera shop" 3000, tagged Wholesale → Wholesale
//     01/07 Parking "Market carpark" 3330, linked to the market, no tag
//           → Sales at events (the market's usual stream)
//     20/06 Printing "Zine printer" 11100 (production) → no stream
//     25/06 Software "Adobe" 4440, no tag, no event → no stream
//   Per stream:
//     Sales at events  Income 450000 "$4,500.00"; Costs 99900 + 3330 = 103230
//                      "$1,032.30"; Result 450000 − 103230 = 346770 "$3,467.70"
//     Online sales     Income 15550 "$155.50"; Costs 4000 + 2500 = 6500
//                      "$65.00"; Result 15550 − 6500 = 9050 "$90.50"
//     Wholesale        Income 0 "$0.00"; Costs 3000 "$30.00";
//                      Result 0 − 3000 = −3000 "-$30.00"
//     Commissions      $0.00 / $0.00 / $0.00
//     Vendor shelf rental Income 25000 "$250.00"; Costs 15000 "$150.00";
//                      Result 25000 − 15000 = 10000 "$100.00"
//     Social media, Subscription income: $0.00 / $0.00 / $0.00
//   $111.00 (Printing) and $44.40 (Software) appear on no stream page.
//
// ═══ DECISIONS (lead's, written out here so the tests can be exact) ════════
//
// S1. /income lists the seven streams in INCOME_STREAMS order: "Sales at
//     events", "Online sales", "Wholesale", "Commissions", "Vendor shelf
//     rental", "Social media", "Subscription income". Each row is ONE link in
//     <main> whose accessible name starts with the stream's name and whose
//     href is exactly "/income/<id>". Inside the link: the lines
//     "Income $X" (streamSummary incomeCents) and "Result $X" (resultCents).
//     Following a link is a client-side move. "+ Add" stays, with no
//     pre-fill (add-button.spec.ts). The "coming next" note is gone
//     (app-shell claim 7, CHANGED (T1.16)).
//
// S2. /income/<id> exists for each stream id (HTTP 200): exactly one h1, the
//     stream's name; title exactly "<name> · BentoBudget" (U+00B7). Any other
//     id is a real 404 (browser, and a GET that doesn't follow redirects, on
//     both servers). /income/new is still the income form.
//
// S3. "+ Add" on a stream page: exactly one, directly under the h1 (the h1's
//     next element sibling is the button or holds it, as on the tab pages).
//     Its links are exactly
//       /income/new?stream=<id>&back=%2Fincome%2F<id>
//       /expenses/new?stream=<id>&back=%2Fincome%2F<id>
//     Saving the form lands back on the stream page, which shows the new row.
//
// S4. Sections: exactly these level-2 headings, in order:
//       Sales at events, Vendor shelf rental: "Income", "Costs", "Result", "Events"
//       the other five:                       "Income", "Costs", "Result"
//     Each is a <section> labelled by its h2 (a region named exactly so).
//
// S5. Income: a list with one item per income entry of this stream, newest
//     first (later date first; on the same date the one added later first).
//     Each item holds its date; for income linked to an event, the text
//     "<event name> · <payment label>" (the name, a space, U+00B7, a space,
//     the label, e.g. "Pretend comic convention · Cash"), otherwise the
//     payment method's label alone ("Cash", "Card", "Online",
//     "Bank transfer", "Other"); its notes when they aren't empty; and its
//     amount (the only money amount in the item); and nothing else apart
//     from punctuation. Then the line "Income $X". With none: the line
//     "No income yet." and no list items.
//     CHANGED (lead, after the first T1.16 report): a linked row shows the
//     payment label as well as the event, so a convention day's cash and
//     card rows can be told apart. (The first version hid the label.)
//
// S6. Costs: a list with one item per cost counted toward this stream
//     (decision D above), newest first. Each item holds its date, its
//     category name, its supplier when there is one, and its amount (the only
//     money amount), and nothing else apart from punctuation. Then the line
//     "Costs $X". With none: "No costs yet." and no list items. Always, in
//     this section, an element whose whole text is exactly
//       "Costs count here when they're tagged with this stream, or linked to an event that usually earns from it."
//     (ASCII apostrophe). Production costs and untagged, unlinked costs never
//     appear on any stream page; "Other costs" figures never count.
//
// S7. Result: the line "Result $X" (income − costs; negative as "-$X").
//
// S8. Events (Sales at events and Vendor shelf rental only): one link per
//     event whose usualStreamId is this stream, in pretendEvents order, each
//     named starting with the event's name, href exactly "/events/<id>":
//       Sales at events:     the convention, then the market
//       Vendor shelf rental: the shelf
//     Following one is a client-side move to the event page.
//
// S9. Notes (carried over from T1.12): income saved through the income form
//     with notes "  Market float  " is listed with "Market float" (trimmed).
//
// S10. Size and access: each stream link on /income, "+ Add" and each event
//     link on a stream page is at least 44×44 px. On a phone at 320×568 with
//     200% text, /income and the stream pages (with data) don't scroll
//     sideways and keep every element in <main> inside 0–320 px.
//
// S11. No uncaught errors and no React hydration errors during any test.

import { expect, test as base, type Locator, type Page } from "@playwright/test";
// Type-only imports (erased at run time): the seam takes the store's own input types.
import type { ExpenseInput, IncomeInput } from "../src/lib/entries";

// ---------- fixed facts ----------

const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";

const STREAMS = [
  { id: "sales-at-events", name: "Sales at events" },
  { id: "online-sales", name: "Online sales" },
  { id: "wholesale", name: "Wholesale" },
  { id: "commissions", name: "Commissions" },
  { id: "vendor-shelf-rental", name: "Vendor shelf rental" },
  { id: "social-media", name: "Social media" },
  { id: "subscription-income", name: "Subscription income" },
] as const;
type Stream = (typeof STREAMS)[number];
const [SALES, ONLINE, WHOLESALE, COMMISSIONS, SHELF_STREAM, SOCIAL, SUBSCRIPTIONS] = STREAMS;
const STREAMS_WITH_EVENTS: readonly Stream[] = [SALES, SHELF_STREAM];

const COMIC_CON = { id: "pretend-event-comic-con", name: "Pretend comic convention" };
const MARKET = { id: "pretend-event-todays-market", name: "Pretend weekend market (today)" };
const SHELF = { id: "pretend-event-shelf", name: "Pretend gallery shelf" };

const NO_INCOME = "No income yet.";
const NO_COSTS = "No costs yet.";
const COSTS_EXPLANATION =
  "Costs count here when they're tagged with this stream, or linked to an event that usually earns from it.";

const HOOK_NAME = "__bentoTest";
const HOOK_WAIT_MS = 10_000;
const MIN_TAP_TARGET_PX = 44;
const NARROW = { width: 320, height: 568 } as const;
const FLAG_OFF_BASE_URL = "http://localhost:3001";

// The owner's example (header), added out of date order on purpose.
const OWNER_INCOME: readonly IncomeInput[] = [
  { date: "2026-06-24", streamId: "sales-at-events", amountCents: 50000, paymentMethod: "cash", eventId: COMIC_CON.id },
  { date: "2026-06-24", streamId: "sales-at-events", amountCents: 100000, paymentMethod: "card", eventId: COMIC_CON.id },
  { date: "2026-06-22", streamId: "sales-at-events", amountCents: 40000, paymentMethod: "cash", eventId: COMIC_CON.id },
  { date: "2026-06-22", streamId: "sales-at-events", amountCents: 60000, paymentMethod: "card", eventId: COMIC_CON.id },
  { date: "2026-06-23", streamId: "sales-at-events", amountCents: 80000, paymentMethod: "cash", eventId: COMIC_CON.id },
  { date: "2026-06-23", streamId: "sales-at-events", amountCents: 120000, paymentMethod: "card", eventId: COMIC_CON.id },
];
const OWNER_COSTS: readonly ExpenseInput[] = [
  { date: "2026-06-24", amountCents: 29900, categoryId: "accommodation", supplier: "Harbour Hotel", eventId: COMIC_CON.id },
  { date: "2026-06-22", amountCents: 50000, categoryId: "stall-table-fees", supplier: "Comic con organisers", eventId: COMIC_CON.id },
  { date: "2026-06-23", amountCents: 20000, categoryId: "meals", eventId: COMIC_CON.id },
];
// The rest of the mixed dataset (header).
const MIXED_INCOME: readonly IncomeInput[] = [
  { date: "2026-06-28", streamId: "online-sales", amountCents: 12000, paymentMethod: "online", notes: "Etsy order 1042" },
  { date: "2026-06-30", streamId: "online-sales", amountCents: 3550, paymentMethod: "card" },
  { date: "2026-06-15", streamId: "vendor-shelf-rental", amountCents: 25000, paymentMethod: "bank_transfer", eventId: SHELF.id },
];
const MIXED_COSTS: readonly ExpenseInput[] = [
  { date: "2026-06-23", amountCents: 4000, categoryId: "parking", supplier: "City carpark", eventId: COMIC_CON.id, streamId: "online-sales" },
  { date: "2026-06-29", amountCents: 2500, categoryId: "marketing", supplier: "Insta ads", streamId: "online-sales" },
  { date: "2026-06-01", amountCents: 15000, categoryId: "vendor-shelf-rent", supplier: "Gallery Co", eventId: SHELF.id },
  { date: "2026-06-10", amountCents: 3000, categoryId: "equipment", supplier: "Camera shop", streamId: "wholesale" },
  { date: "2026-07-01", amountCents: 3330, categoryId: "parking", supplier: "Market carpark", eventId: MARKET.id },
  { date: "2026-06-20", amountCents: 11100, categoryId: "printing", supplier: "Zine printer" },
  { date: "2026-06-25", amountCents: 4440, categoryId: "software", supplier: "Adobe" },
];

/** Each stream's figures with the mixed dataset, worked out in the header. */
const MIXED_TOTALS: Record<Stream["id"], { income: string; costs: string; result: string }> = {
  "sales-at-events": { income: "$4,500.00", costs: "$1,032.30", result: "$3,467.70" },
  "online-sales": { income: "$155.50", costs: "$65.00", result: "$90.50" },
  wholesale: { income: "$0.00", costs: "$30.00", result: "-$30.00" },
  commissions: { income: "$0.00", costs: "$0.00", result: "$0.00" },
  "vendor-shelf-rental": { income: "$250.00", costs: "$150.00", result: "$100.00" },
  "social-media": { income: "$0.00", costs: "$0.00", result: "$0.00" },
  "subscription-income": { income: "$0.00", costs: "$0.00", result: "$0.00" },
};

// ---------- fixture: no uncaught errors, no hydration errors (S11) ----------

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

function main(page: Page): Locator {
  return page.getByRole("main");
}
function mainNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Main", exact: true });
}
function heading(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}
function region(page: Page, name: "Income" | "Costs" | "Result" | "Events"): Locator {
  return main(page).getByRole("region", { name, exact: true });
}
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** A link in `container` whose accessible name starts with `name`. */
function linkStartingWith(container: Locator, name: string): Locator {
  return container.getByRole("link", { name: new RegExp(`^\\s*${escapeRegExp(name)}`) });
}
function streamLink(page: Page, stream: Stream): Locator {
  return linkStartingWith(main(page), stream.name);
}
function addButton(page: Page): Locator {
  return main(page).getByRole("button", { name: "+ Add", exact: true });
}
function incomeRows(page: Page): Locator {
  return region(page, "Income").getByRole("listitem");
}
function costRows(page: Page): Locator {
  return region(page, "Costs").getByRole("listitem");
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

async function open(page: Page, path: string): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  const response = await page.goto(path);
  expect(response?.status(), `HTTP status of ${path}`).toBe(200);
  await waitForHydration(page);
}

function streamPath(stream: Stream): string {
  return `/income/${stream.id}`;
}

async function openStream(page: Page, stream: Stream): Promise<void> {
  await open(page, streamPath(stream));
  await expect(heading(page)).toHaveText(stream.name);
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
      throw new Error(`test seam window.${HOOK_NAME} never appeared (see entries-list.spec.ts)`);
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

async function seedOwner(page: Page): Promise<void> {
  await seed(page, OWNER_INCOME, OWNER_COSTS);
}
async function seedMixed(page: Page): Promise<void> {
  await seed(page, [...OWNER_INCOME, ...MIXED_INCOME], [...OWNER_COSTS, ...MIXED_COSTS]);
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

function hasToken(text: string, token: string): boolean {
  return new RegExp(`(^| )${escapeRegExp(token)}( |$)`).test(text);
}

function amountsIn(text: string): string[] {
  return text.match(/-?\$\d[\d,]*\.\d{2}/g) ?? [];
}

/**
 * Checks a list item holds exactly these parts and nothing else apart from
 * punctuation: each part is found as whole words, its one money amount is
 * `amount`, and once all parts are removed only separators are left.
 */
function expectRowParts(text: string, parts: readonly string[], amount: string): void {
  for (const part of parts) expect(hasToken(text, part), `"${text}" holds "${part}"`).toBe(true);
  expect(amountsIn(text), `the only money amount in "${text}"`).toEqual([amount]);
  let rest = text;
  for (const part of [...parts, amount]) rest = rest.replace(part, "");
  expect(rest.replace(/[\s·•,;:|()–—-]/g, ""), `left over in "${text}"`).toBe("");
}

async function setMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__t116SameDocument = true;
  });
}
async function markerStillThere(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as Record<string, unknown>).__t116SameDocument === true);
}

function urlOnThisServer(page: Page, path: string): RegExp {
  const origin = new URL(page.url()).origin;
  return new RegExp(`^${escapeRegExp(origin)}${escapeRegExp(path)}$`);
}

async function goByTab(page: Page, name: "Home" | "Events" | "Income", hasTouch: boolean): Promise<void> {
  await press(mainNav(page).getByRole("link", { name, exact: true }), hasTouch);
  await expect(heading(page)).toHaveText(name);
}

/** On /income, follows a stream's link (client-side) to its page. */
async function followStreamLink(page: Page, stream: Stream, hasTouch: boolean): Promise<void> {
  await press(streamLink(page, stream), hasTouch);
  await expect(page).toHaveURL(urlOnThisServer(page, streamPath(stream)));
  await expect(heading(page)).toHaveText(stream.name);
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

// ═══ S1. The streams list ═══════════════════════════════════════════════════

test.describe("T1.16: the income streams list (/income)", () => {
  test("lists exactly the seven streams, in INCOME_STREAMS order", async ({ page }) => {
    await open(page, "/income");
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
      }, STREAMS.map((s) => s.name));
    expect(names).toEqual(STREAMS.map((s) => s.name));
  });

  for (const stream of STREAMS) {
    test(`"${stream.name}" is one link to exactly /income/${stream.id}`, async ({ page }) => {
      await open(page, "/income");
      await expect(streamLink(page, stream)).toHaveCount(1);
      await expect(streamLink(page, stream)).toHaveAttribute("href", streamPath(stream));
    });

    test(`with nothing entered, "${stream.name}" shows "Income $0.00" and "Result $0.00"`, async ({ page }) => {
      await open(page, "/income");
      await expectLine(streamLink(page, stream), "Income $0.00");
      await expectLine(streamLink(page, stream), "Result $0.00");
    });

    const t = MIXED_TOTALS[stream.id];
    test(`with the mixed dataset, "${stream.name}" shows "Income ${t.income}" and "Result ${t.result}"`, async ({
      page,
    }) => {
      await open(page, "/income");
      await seedMixed(page);
      await expectLine(streamLink(page, stream), `Income ${t.income}`);
      await expectLine(streamLink(page, stream), `Result ${t.result}`);
    });
  }

  test('the owner\'s example: "Sales at events" shows "Income $4,500.00" and "Result $3,501.00"', async ({ page }) => {
    await open(page, "/income");
    await seedOwner(page);
    await expectLine(streamLink(page, SALES), "Income $4,500.00");
    await expectLine(streamLink(page, SALES), "Result $3,501.00");
  });

  for (const stream of [SALES, ONLINE, SUBSCRIPTIONS]) {
    test(`following "${stream.name}" is a client-side move to its page`, async ({ page }, testInfo) => {
      await open(page, "/income");
      await setMarker(page);
      await followStreamLink(page, stream, touch(testInfo));
      expect(await markerStillThere(page), "the move didn't reload the page").toBe(true);
    });
  }

  test("entries seeded on /income are still there on Online sales after following its link", async ({
    page,
  }, testInfo) => {
    await open(page, "/income");
    await seedMixed(page);
    await followStreamLink(page, ONLINE, touch(testInfo));
    await expectLine(region(page, "Result"), "Result $90.50");
  });
});

// ═══ S2. Stream page: route, heading, title, 404 ════════════════════════════

test.describe("T1.16: the stream page's address, heading and title", () => {
  for (const stream of STREAMS) {
    test(`/income/${stream.id} answers 200 with exactly one h1, "${stream.name}"`, async ({ page }) => {
      await open(page, streamPath(stream));
      await expect(heading(page)).toHaveCount(1);
      await expect(heading(page)).toHaveText(stream.name);
    });

    test(`/income/${stream.id} has the title exactly "${stream.name} · BentoBudget"`, async ({ page }) => {
      await open(page, streamPath(stream));
      await expect(page).toHaveTitle(`${stream.name} · BentoBudget`);
      expect(await page.locator("head > title").textContent()).toBe(`${stream.name} · BentoBudget`);
    });
  }

  const UNKNOWN = ["/income/nope", "/income/online", "/income/sales-at-events-2", "/income/Online%20sales"] as const;
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

  test("the build without the test flag (port 3001) answers 200 for /income/online-sales", async ({ request }) => {
    const response = await request.get(`${FLAG_OFF_BASE_URL}/income/online-sales`, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });

  test('/income/new is still the income form (heading "Add income")', async ({ page }) => {
    await open(page, "/income/new");
    await expect(heading(page)).toHaveText("Add income");
  });
});

// ═══ S3. "+ Add" on a stream page ═══════════════════════════════════════════

test.describe('T1.16: "+ Add" on a stream page', () => {
  for (const stream of [SALES, ONLINE]) {
    test(`on ${stream.name}, there is exactly one "+ Add", directly under the h1`, async ({ page }) => {
      await openStream(page, stream);
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
  }

  for (const stream of STREAMS) {
    const back = `%2Fincome%2F${stream.id}`;
    test(`on ${stream.name}, "Add income" links to exactly /income/new?stream=${stream.id}&back=${back}`, async ({
      page,
    }, testInfo) => {
      await openStream(page, stream);
      await press(addButton(page), touch(testInfo));
      await expect(main(page).getByRole("link", { name: "Add income", exact: true })).toHaveAttribute(
        "href",
        `/income/new?stream=${stream.id}&back=${back}`,
      );
    });

    test(`on ${stream.name}, "Add expense" links to exactly /expenses/new?stream=${stream.id}&back=${back}`, async ({
      page,
    }, testInfo) => {
      await openStream(page, stream);
      await press(addButton(page), touch(testInfo));
      await expect(main(page).getByRole("link", { name: "Add expense", exact: true })).toHaveAttribute(
        "href",
        `/expenses/new?stream=${stream.id}&back=${back}`,
      );
    });
  }

  test("round trip: $45 Online income added from Online sales lands back there with the new row", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openStream(page, ONLINE);
    await expect(incomeRows(page)).toHaveCount(0);
    await setMarker(page);
    await press(addButton(page), t);
    await press(main(page).getByRole("link", { name: "Add income", exact: true }), t);
    await expect(heading(page)).toHaveText("Add income");
    await main(page).getByRole("textbox", { name: "Amount", exact: true }).fill("45");
    await main(page)
      .getByRole("group", { name: "Payment method", exact: true })
      .getByRole("radio", { name: "Online", exact: true })
      .check();
    await press(main(page).getByRole("button", { name: "Save", exact: true }), t);
    await expect(page).toHaveURL(urlOnThisServer(page, streamPath(ONLINE)));
    await expect(heading(page)).toHaveText(ONLINE.name);
    expect(await markerStillThere(page), "no reload on the way").toBe(true);
    await expect(incomeRows(page)).toHaveCount(1);
    expectRowParts(await textOf(incomeRows(page).first()), ["01/07/2026", "Online"], "$45.00");
    await expectLine(region(page, "Income"), "Income $45.00");
  });

  test("round trip: a $15 Marketing cost added from Commissions lands back there, tagged Commissions", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openStream(page, COMMISSIONS);
    await press(addButton(page), t);
    await press(main(page).getByRole("link", { name: "Add expense", exact: true }), t);
    await expect(heading(page)).toHaveText("Add expense");
    await main(page).getByLabel("Amount", { exact: true }).fill("15");
    await main(page).getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Marketing" });
    await press(main(page).getByRole("button", { name: "Save", exact: true }), t);
    await expect(page).toHaveURL(urlOnThisServer(page, streamPath(COMMISSIONS)));
    await expect(costRows(page)).toHaveCount(1);
    expectRowParts(await textOf(costRows(page).first()), ["01/07/2026", "Marketing"], "$15.00");
    await expectLine(region(page, "Costs"), "Costs $15.00");
    // 0 − 1500 = −1500 cents.
    await expectLine(region(page, "Result"), "Result -$15.00");
  });
});

// ═══ S4. Sections ═══════════════════════════════════════════════════════════

test.describe("T1.16: the stream page's sections", () => {
  for (const stream of STREAMS) {
    const expected = STREAMS_WITH_EVENTS.includes(stream)
      ? ["Income", "Costs", "Result", "Events"]
      : ["Income", "Costs", "Result"];
    test(`on ${stream.name}, the level-2 headings are exactly ${expected.join(", ")}`, async ({ page }) => {
      await openStream(page, stream);
      const h2s = await main(page)
        .getByRole("heading", { level: 2 })
        .evaluateAll((els) => els.map((e) => ((e as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim()));
      expect(h2s).toEqual(expected);
    });
  }

  for (const name of ["Income", "Costs", "Result", "Events"] as const) {
    test(`on Sales at events, "${name}" is a region named by its h2`, async ({ page }) => {
      await openStream(page, SALES);
      await expect(region(page, name)).toHaveCount(1);
      await expect(region(page, name).getByRole("heading", { level: 2, name, exact: true })).toHaveCount(1);
    });
  }
});

// ═══ S5. Income rows ════════════════════════════════════════════════════════

test.describe("T1.16: income rows", () => {
  test(`with no income, the section says "${NO_INCOME}" and lists nothing`, async ({ page }) => {
    await openStream(page, COMMISSIONS);
    await expect(region(page, "Income").getByText(NO_INCOME, { exact: true })).toBeVisible();
    await expect(incomeRows(page)).toHaveCount(0);
  });

  test('Sales at events (owner\'s example) lists six rows, newest first, each with "Pretend comic convention · <Card or Cash>"', async ({
    page,
  }) => {
    await openStream(page, SALES);
    await seedOwner(page);
    await expect(incomeRows(page)).toHaveCount(6);
    // Newest first: 24/06 card (added after cash) then cash; 23/06 card, cash; 22/06 card, cash.
    const EXPECTED = [
      ["24/06/2026", "Card", "$1,000.00"],
      ["24/06/2026", "Cash", "$500.00"],
      ["23/06/2026", "Card", "$1,200.00"],
      ["23/06/2026", "Cash", "$800.00"],
      ["22/06/2026", "Card", "$600.00"],
      ["22/06/2026", "Cash", "$400.00"],
    ] as const;
    const rows = await incomeRows(page).all();
    for (let i = 0; i < EXPECTED.length; i++) {
      const [date, label, amount] = EXPECTED[i];
      expectRowParts(await textOf(rows[i]), [date, `${COMIC_CON.name} \u00B7 ${label}`], amount);
    }
  });

  test('the owner\'s example: "Income $4,500.00" and no empty-state line', async ({ page }) => {
    await openStream(page, SALES);
    await seedOwner(page);
    await expectLine(region(page, "Income"), "Income $4,500.00");
    await expect(region(page, "Income").getByText(NO_INCOME, { exact: true })).toHaveCount(0);
  });

  test("Online sales lists its two rows newest first: 30/06 Card $35.50, then 28/06 Online with its notes $120.00", async ({
    page,
  }) => {
    await openStream(page, ONLINE);
    await seedMixed(page);
    await expect(incomeRows(page)).toHaveCount(2);
    expectRowParts(await textOf(incomeRows(page).nth(0)), ["30/06/2026", "Card"], "$35.50");
    expectRowParts(await textOf(incomeRows(page).nth(1)), ["28/06/2026", "Online", "Etsy order 1042"], "$120.00");
    await expectLine(region(page, "Income"), "Income $155.50");
  });

  test('Vendor shelf rental lists the shelf\'s bank transfer: 15/06, "Pretend gallery shelf · Bank transfer", $250.00', async ({
    page,
  }) => {
    await openStream(page, SHELF_STREAM);
    await seedMixed(page);
    await expect(incomeRows(page)).toHaveCount(1);
    expectRowParts(await textOf(incomeRows(page).first()), ["15/06/2026", `${SHELF.name} \u00B7 Bank transfer`], "$250.00");
  });

  test('an unlinked row shows its payment label: "Bank transfer" and "Other"', async ({ page }) => {
    await openStream(page, COMMISSIONS);
    await seed(
      page,
      [
        { date: "2026-06-05", streamId: "commissions", amountCents: 30000, paymentMethod: "bank_transfer" },
        { date: "2026-06-06", streamId: "commissions", amountCents: 7000, paymentMethod: "other" },
      ],
      [],
    );
    await expect(incomeRows(page)).toHaveCount(2);
    expectRowParts(await textOf(incomeRows(page).nth(0)), ["06/06/2026", "Other"], "$70.00");
    expectRowParts(await textOf(incomeRows(page).nth(1)), ["05/06/2026", "Bank transfer"], "$300.00");
    // 30000 + 7000 = 37000 cents.
    await expectLine(region(page, "Income"), "Income $370.00");
  });

  test("other streams' income never appears (Sales at events shows only its own six rows)", async ({ page }) => {
    await openStream(page, SALES);
    await seedMixed(page);
    await expect(incomeRows(page)).toHaveCount(6);
    const text = await textOf(region(page, "Income"));
    for (const word of ["Etsy order 1042", "$35.50", "$120.00", "$250.00"]) {
      expect(text.includes(word), `"${word}" in Sales at events' income`).toBe(false);
    }
  });
});

// ═══ S9. Notes saved through the form ═══════════════════════════════════════

test.describe("T1.16: income notes are stored and shown (from T1.12)", () => {
  test('takings saved from Sales at events with notes "  Market float  " show "Market float" on both rows', async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openStream(page, SALES);
    await press(addButton(page), t);
    await press(main(page).getByRole("link", { name: "Add income", exact: true }), t);
    await expect(heading(page)).toHaveText("Add income");
    await main(page).getByRole("textbox", { name: "Cash", exact: true }).fill("50");
    await main(page).getByRole("textbox", { name: "Card", exact: true }).fill("0");
    await main(page).getByLabel("Notes (optional)", { exact: true }).fill("  Market float  ");
    await press(main(page).getByRole("button", { name: "Save", exact: true }), t);
    await expect(page).toHaveURL(urlOnThisServer(page, streamPath(SALES)));
    await expect(incomeRows(page)).toHaveCount(2);
    // Newest first: the card row ($0.00) was added after the cash row ($50.00).
    expectRowParts(await textOf(incomeRows(page).nth(0)), ["01/07/2026", "Card", "Market float"], "$0.00");
    expectRowParts(await textOf(incomeRows(page).nth(1)), ["01/07/2026", "Cash", "Market float"], "$50.00");
    for (const row of await incomeRows(page).all()) {
      const raw = await row.evaluate((el) => el.textContent ?? "");
      expect(raw, "the notes are stored trimmed").not.toContain("  Market float");
      expect(raw, "the notes are stored trimmed").not.toContain("Market float  ");
    }
  });
});

// ═══ S6. Costs rows ═════════════════════════════════════════════════════════

test.describe("T1.16: cost rows", () => {
  test(`with no costs, the section says "${NO_COSTS}" and lists nothing`, async ({ page }) => {
    await openStream(page, SOCIAL);
    await expect(region(page, "Costs").getByText(NO_COSTS, { exact: true })).toBeVisible();
    await expect(costRows(page)).toHaveCount(0);
  });

  for (const stream of [SALES, ONLINE, SOCIAL]) {
    test(`on ${stream.name}, the Costs section explains exactly which costs count`, async ({ page }) => {
      await openStream(page, stream);
      await expect(region(page, "Costs").getByText(COSTS_EXPLANATION, { exact: true })).toBeVisible();
    });
  }

  test("the owner's example on Sales at events: three costs, newest first (hotel, meals, table), through the convention", async ({
    page,
  }) => {
    await openStream(page, SALES);
    await seedOwner(page);
    await expect(costRows(page)).toHaveCount(3);
    expectRowParts(await textOf(costRows(page).nth(0)), ["24/06/2026", "Accommodation", "Harbour Hotel"], "$299.00");
    expectRowParts(await textOf(costRows(page).nth(1)), ["23/06/2026", "Meals"], "$200.00");
    expectRowParts(
      await textOf(costRows(page).nth(2)),
      ["22/06/2026", "Stall or table fees", "Comic con organisers"],
      "$500.00",
    );
  });

  test('the owner\'s example: "Costs $999.00" and no empty-state line', async ({ page }) => {
    await openStream(page, SALES);
    await seedOwner(page);
    await expectLine(region(page, "Costs"), "Costs $999.00");
    await expect(region(page, "Costs").getByText(NO_COSTS, { exact: true })).toHaveCount(0);
  });

  test("Sales at events also counts the market's untagged Parking (01/07, $33.30), newest first", async ({ page }) => {
    await openStream(page, SALES);
    await seedMixed(page);
    await expect(costRows(page)).toHaveCount(4);
    expectRowParts(await textOf(costRows(page).nth(0)), ["01/07/2026", "Parking", "Market carpark"], "$33.30");
    await expectLine(region(page, "Costs"), "Costs $1,032.30");
  });

  test("a cost tagged Online sales and linked to the convention counts ONLY on Online sales", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await openStream(page, SALES);
    await seedMixed(page);
    expect((await textOf(region(page, "Costs"))).includes("City carpark"), "City carpark on Sales at events").toBe(false);
    await goByTab(page, "Income", t);
    await followStreamLink(page, ONLINE, t);
    await expect(costRows(page)).toHaveCount(2);
    // Newest first: 29/06 Marketing, then 23/06 Parking.
    expectRowParts(await textOf(costRows(page).nth(0)), ["29/06/2026", "Marketing", "Insta ads"], "$25.00");
    expectRowParts(await textOf(costRows(page).nth(1)), ["23/06/2026", "Parking", "City carpark"], "$40.00");
    await expectLine(region(page, "Costs"), "Costs $65.00");
  });

  test("an untagged cost linked to the shelf counts on Vendor shelf rental", async ({ page }) => {
    await openStream(page, SHELF_STREAM);
    await seedMixed(page);
    await expect(costRows(page)).toHaveCount(1);
    expectRowParts(await textOf(costRows(page).first()), ["01/06/2026", "Vendor shelf rent", "Gallery Co"], "$150.00");
    await expectLine(region(page, "Costs"), "Costs $150.00");
  });

  for (const stream of STREAMS) {
    test(`on ${stream.name}, the production cost ($111.00) and the untagged, unlinked Software ($44.40) never appear`, async ({
      page,
    }) => {
      await openStream(page, stream);
      await seedMixed(page);
      await expectLine(region(page, "Result"), `Result ${MIXED_TOTALS[stream.id].result}`);
      const text = await textOf(main(page));
      for (const word of ["Zine printer", "Printing", "$111.00", "Adobe", "Software", "$44.40"]) {
        expect(text.includes(word), `"${word}" on ${stream.name}`).toBe(false);
      }
    });
  }
});

// ═══ S7. Result ═════════════════════════════════════════════════════════════

test.describe("T1.16: the result", () => {
  for (const stream of STREAMS) {
    const t = MIXED_TOTALS[stream.id];
    test(`with the mixed dataset, ${stream.name} shows "Income ${t.income}", "Costs ${t.costs}" and "Result ${t.result}"`, async ({
      page,
    }) => {
      await openStream(page, stream);
      await seedMixed(page);
      await expectLine(region(page, "Result"), `Result ${t.result}`);
      if (t.income !== "$0.00") await expectLine(region(page, "Income"), `Income ${t.income}`);
      if (t.costs !== "$0.00") await expectLine(region(page, "Costs"), `Costs ${t.costs}`);
    });
  }

  test('with nothing entered: "Result $0.00"', async ({ page }) => {
    await openStream(page, SUBSCRIPTIONS);
    await expectLine(region(page, "Result"), "Result $0.00");
  });

  test('the owner\'s example on Sales at events: "Result $3,501.00" (450000 − 99900 cents)', async ({ page }) => {
    await openStream(page, SALES);
    await seedOwner(page);
    await expectLine(region(page, "Result"), "Result $3,501.00");
  });

  test("$600 other costs on the convention never count: Sales at events still shows Costs $999.00 and Result $3,501.00", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await open(page, `/events/${COMIC_CON.id}`);
    await seedOwner(page);
    const other = main(page).getByRole("region", { name: "Other costs", exact: true });
    await press(other.getByRole("button", { name: "Add other costs", exact: true }), t);
    await other.getByRole("textbox", { name: "Amount", exact: true }).fill("600");
    await press(other.getByRole("button", { name: "Save", exact: true }), t);
    await expectLine(main(page), "Result after other costs $2,901.00");
    await goByTab(page, "Income", t);
    await expectLine(streamLink(page, SALES), "Result $3,501.00");
    await followStreamLink(page, SALES, t);
    await expectLine(region(page, "Costs"), "Costs $999.00");
    await expectLine(region(page, "Result"), "Result $3,501.00");
    // The figure is not a cost row ($600.00 does appear, but only as day 1's card income row).
    await expect(costRows(page)).toHaveCount(3);
    const pageTexts = await renderedTexts(main(page));
    expect(pageTexts.filter((x) => x.startsWith("Other costs")), "no Other costs line on a stream page").toEqual([]);
  });
});

// ═══ S8. Events ═════════════════════════════════════════════════════════════

test.describe("T1.16: the Events section", () => {
  test("Sales at events lists the convention, then the market, each linking to its page", async ({ page }) => {
    await openStream(page, SALES);
    const links = region(page, "Events").getByRole("link");
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAccessibleName(new RegExp(`^\\s*${escapeRegExp(COMIC_CON.name)}`));
    await expect(links.nth(0)).toHaveAttribute("href", `/events/${COMIC_CON.id}`);
    await expect(links.nth(1)).toHaveAccessibleName(new RegExp(`^\\s*${escapeRegExp(MARKET.name)}`));
    await expect(links.nth(1)).toHaveAttribute("href", `/events/${MARKET.id}`);
  });

  test("Vendor shelf rental lists the gallery shelf only", async ({ page }) => {
    await openStream(page, SHELF_STREAM);
    const links = region(page, "Events").getByRole("link");
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveAccessibleName(new RegExp(`^\\s*${escapeRegExp(SHELF.name)}`));
    await expect(links.first()).toHaveAttribute("href", `/events/${SHELF.id}`);
  });

  for (const stream of [ONLINE, WHOLESALE, COMMISSIONS, SOCIAL, SUBSCRIPTIONS]) {
    test(`${stream.name} has no Events section and no link to an event page`, async ({ page }) => {
      await openStream(page, stream);
      await expect(main(page).getByRole("region", { name: "Events", exact: true })).toHaveCount(0);
      const toEvents = await main(page)
        .getByRole("link")
        .evaluateAll((links) =>
          links.map((a) => new URL((a as HTMLAnchorElement).href).pathname).filter((p) => p.startsWith("/events/")),
        );
      expect(toEvents).toEqual([]);
    });
  }

  test("following the convention's link is a client-side move to its page, and entries survive", async ({
    page,
  }, testInfo) => {
    await openStream(page, SALES);
    await seedOwner(page);
    await setMarker(page);
    await press(linkStartingWith(region(page, "Events"), COMIC_CON.name), touch(testInfo));
    await expect(page).toHaveURL(urlOnThisServer(page, `/events/${COMIC_CON.id}`));
    await expect(heading(page)).toHaveText(COMIC_CON.name);
    expect(await markerStillThere(page)).toBe(true);
    await expectLine(main(page).getByRole("region", { name: "Result", exact: true }), "Result $3,501.00");
  });
});

// ═══ S10. Size and access ═══════════════════════════════════════════════════

test.describe("T1.16: tap targets are at least 44×44 px", () => {
  for (const stream of STREAMS) {
    test(`on /income, the "${stream.name}" link is at least 44×44 px`, async ({ page }) => {
      await open(page, "/income");
      const b = await box(streamLink(page, stream));
      expect(b.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      expect(b.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    });
  }

  test('on Sales at events, "+ Add" and both event links are at least 44×44 px', async ({ page }) => {
    await openStream(page, SALES);
    for (const [label, control] of [
      ["+ Add", addButton(page)],
      [COMIC_CON.name, linkStartingWith(region(page, "Events"), COMIC_CON.name)],
      [MARKET.name, linkStartingWith(region(page, "Events"), MARKET.name)],
    ] as const) {
      const b = await box(control);
      expect(b.width, `${label} width`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      expect(b.height, `${label} height`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    }
  });
});

test.describe("T1.16: on a phone at 320×568 with 200% text", () => {
  async function narrowBig(page: Page, path: string): Promise<void> {
    await page.setViewportSize(NARROW);
    await open(page, path);
    await setTextSize(page, 200, "32px");
  }

  test("on a phone at 320×568 and 200% text, /income with data doesn't scroll sideways and stays inside 0–320 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await narrowBig(page, "/income");
    await seedMixed(page);
    await expectLine(streamLink(page, SALES), "Result $3,467.70");
    await expectNoSidewaysScroll(page);
    expect(await outsideWidth(page, NARROW.width)).toEqual([]);
  });

  for (const stream of [SALES, ONLINE, SHELF_STREAM]) {
    test(`on a phone at 320×568 and 200% text, ${stream.name} with data doesn't scroll sideways and stays inside 0–320 px`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await narrowBig(page, streamPath(stream));
      await seedMixed(page);
      await expectLine(region(page, "Result"), `Result ${MIXED_TOTALS[stream.id].result}`);
      await expectNoSidewaysScroll(page);
      expect(await outsideWidth(page, NARROW.width)).toEqual([]);
    });
  }
});
