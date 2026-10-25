// Quick-sale number pad (T1.8, docs/stages/stage-01.md).
// Guide §10 "Designing cash-sale entry for a busy stall" (a number pad, not a
// long form; smart defaults; type amount, tap save; a running total; easy
// undo; helper-friendly), §6 (the date is today on the device), §7 (money is
// whole cents), §19 Everyday use ("a cash sale can be logged in a few seconds
// with one hand"; big tap targets; screen reader and keyboard).
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop)
// unless its name says "on a phone"; those are limited to the phone project
// with a conditional `test.skip(...)` (as in app-shell.spec.ts).
//
// The tests reuse the T1.6 test seam (window.__bentoTest, see the header of
// e2e/entries-list.spec.ts) only to put a sale into the store that did NOT
// come from the pad, and as the "page has hydrated" signal. Every sale under
// test is made by tapping the pad (or typing on a keyboard).
//
// ═══ DECISIONS FOR THE PAD (made here so the tests can be exact) ════════════
//
// Q1. Route and heading. The pad is its own page at /sale (HTTP 200). Its
//     title is exactly "Quick sale · BentoBudget" (middle dot U+00B7), and
//     it has exactly one level-1 heading, whose text is exactly "Quick sale".
//     The bottom navigation stays on this page (it lives in the root layout);
//     the tests use its Home and Transactions tabs to move around.
//
// Q2. "+ Sale" on Home opens /sale as a client-side move (a <Link>, or a
//     button that calls the router), so the pretend entries in memory are
//     kept. Leaving the pad with the nav keeps them too.
//
// Q3. Layout, inside <main>:
//     a. A large amount display: an <output> (or role="status") element whose
//        accessible name is exactly "Amount" (aria-label, aria-labelledby or
//        <label for>). It is a polite live region, so each change is
//        announced (an <output> is one already; never aria-live="off" or
//        "assertive"). Its whole text is the currency symbol for the device's
//        locale followed by exactly the characters typed so far:
//          en-AU: nothing typed → "$"; "12.50" → "$12.50"; "5." → "$5."
//          en-US: "5" → "A$5" (the same symbol formatCents uses there).
//        No grouping commas are added while typing (tests only type amounts
//        under 1,000 when they check the display), nothing is rounded.
//     b. The keys: exactly 12 buttons (type="button") inside an element with
//        role "group" whose accessible name is exactly "Number pad"
//        (e.g. <div role="group" aria-label="Number pad">). Their accessible
//        names are exactly "0" … "9", "Decimal point" (shows ".") and
//        "Backspace" (may show "⌫"; any icon is aria-hidden). Phone-keypad
//        layout, 3 columns × 4 rows:
//            1  2  3
//            4  5  6
//            7  8  9
//            .  0  ⌫
//        (same row = same vertical centre; same column = same horizontal
//        centre; rows top to bottom, columns left to right, as drawn.)
//     c. One button named exactly "Save" (outside or inside the group).
//     d. Event: a native <select> (role combobox) with accessible name
//        exactly "Event". It has exactly one option whose text is "No event",
//        and one for "Pretend weekend market (today)". Other events may be
//        listed too.
//     e. Payment method: five native radio buttons (<input type="radio">,
//        role radio) in a group whose accessible name is exactly
//        "Payment method" (a <fieldset> with that <legend>, or
//        role="radiogroup" with that label). Their names, in this order:
//        "Cash", "Card", "Online", "Bank transfer", "Other". Styling them as
//        big segmented buttons is fine as long as Playwright's `check()` on
//        the radio works.
//     f. The running total: an element whose whole text is exactly
//        "Today: <total> from <N> sales" ("1 sale" when N is 1), the same
//        wording and maths as Home (T1.6 D3): every sale dated today on the
//        device, from any event, $0.00 sales included, amounts formatted
//        with formatCents(cents, "AUD", locale).
//
// Q4. Typing rules (keys and physical keyboard alike):
//     - A digit is added at the end. If the amount is exactly "0", a digit
//       replaces the zero ("0" then "5" shows "$5").
//     - Once there are 2 digits after the point, more digits are ignored
//       ("1.259" can't be typed: the display stays "$1.25").
//     - "." is ignored if there is already a point. On an empty amount it
//       gives "0." (so ". 5 0" is "$0.50").
//     - Backspace removes the last character; on an empty amount it does
//       nothing.
//     - Save is enabled only when the typed text is an amount that
//       parseAmountToCents (src/lib/money.ts) accepts. While it isn't
//       (nothing typed, "0.", "5."), Save is disabled (the `disabled`
//       attribute, or aria-disabled="true" with the click ignored), and
//       neither a tap on Save nor Enter records anything. Zero ("0") is a
//       valid amount (owner's rule) and saves a $0.00 sale.
//
// Q5. Saving:
//     - Save adds one sale with the store's normal "add-sale" action:
//         date          = todayOnDevice() taken AT THE MOMENT OF SAVING (not
//                         when the pad was opened; a pad left open over
//                         midnight saves the new day);
//         amountCents   = parseAmountToCents(typed text);
//         paymentMethod = the checked radio;
//         eventId       = the chosen event, or null for "No event".
//     - The pad STAYS OPEN for the next sale (most sales are "type amount,
//       tap save"): the display goes back to "$" (nothing typed), Save is
//       disabled again, and the running total updates at once. So a
//       fat-fingered double tap on Save records one sale, not two.
//     - Payment method goes back to Cash after each save (most stall sales
//       are cash, and a leftover "Card" would mislabel the next cash sale).
//       The event choice stays as it was for the rest of the visit.
//     - A message whose element's whole text is exactly
//         "Sale of <amount> saved."   (e.g. "Sale of $12.50 saved.")
//       appears inside a polite live region (role="status", an <output>, or
//       aria-live="polite" on it or an ancestor), so screen readers hear it.
//       The Undo button is a separate element, not inside that text.
//
// Q6. Defaults when the pad opens: nothing typed; payment "Cash" checked;
//     event = the pretend event running today ("Pretend weekend market
//     (today)", id pretend-event-todays-market), or "No event" if none.
//
// Q7. Undo:
//     - No Undo button before the first save on this visit.
//     - After a save, one button named exactly "Undo" (at least 44×44 px).
//       It removes exactly the most recent sale saved on this visit (the
//       store's "delete" action with that sale's id) and nothing else. The
//       running totals on the pad and on Home go back at once.
//     - It stays until it is used, the next sale is saved (then it undoes
//       that newer sale), or the person leaves the pad. There is no time
//       limit (WCAG 2.2.1: no timeout a person can't control); a queue at a
//       stall can take minutes.
//     - Typing the next amount doesn't remove it, and using it doesn't clear
//       what has been typed since.
//     - One level only: after it's used the Undo button is gone, and the
//       message's element reads exactly "Sale of <amount> removed."
//     - Coming back to the pad later shows no Undo button.
//
// Q8. Keyboard: with focus on the page itself (nothing focused, as after
//     loading), typing 0–9 and "." and pressing Backspace edit the amount
//     with the Q4 rules, and Enter saves (when Save is enabled). When a pad
//     key has keyboard focus, Enter or Space presses THAT key only (it must
//     not also save). Tab never leaves a focused control hidden under the
//     nav or off screen.
//
// Q9. Size and reach:
//     - Every key, Save and Undo are at least 44×44 CSS px (their own box).
//     - On the phone (390×844, 100% text), right after the pad opens and
//       without any scrolling, all 12 keys and Save lie entirely in the lower
//       half of the screen (top ≥ 422 px), end at or above the nav's top edge,
//       and are the topmost element at their centre (nothing covers them).
//       This still holds once the "saved" message and Undo are showing, and
//       Undo itself is then fully on screen and above the nav.
//     - At 320×568 with 200% text: the page never scrolls sideways; every
//       key, Save and the amount display stay inside 0–320 px; keys and Save
//       stay at least 44×44; each, once scrolled into view, is the topmost
//       element at its centre (not hidden behind the nav); and a sale can be
//       made by tapping.
//
// Q10. Carried over from the T1.6 review (lead, 2026-10-25):
//     - Home's two totals lines sit inside a polite live region.
//     - The Transactions list <ul> has an explicit role="list" (Safari and
//       VoiceOver drop list semantics from unstyled lists otherwise).
//
// Q11. No uncaught page errors and no React hydration errors in any test.
//
// ═══ HAND-WORKED FACTS ══════════════════════════════════════════════════════
//
// The device clock is frozen at 2026-06-30T15:30:00Z. In Australia/Sydney
// (UTC+10 in winter) that is 01:30 on 1 July, so today = "2026-07-01" there,
// while the UTC date is still 30 June. In Australia/Perth (UTC+8) it is 23:30
// on 30 June, so today = "2026-06-30" (guide §19's Perth/Sydney cases).
// en-AU shows those dates as "01/07/2026" and "30/06/2026".
//
// Every expected string below is written out by hand, with the arithmetic in
// a comment next to it. None is computed with the app's own code.

import { expect, test as base, type Locator, type Page, type TestInfo } from "@playwright/test";
// Type-only import (erased at run time): the seam takes the store's own input type.
import type { SaleInput } from "../src/lib/entries";

// ---------- fixed facts ----------

/** 2026-06-30 15:30 UTC: 1 July 01:30 in Sydney, 30 June 23:30 in Perth. */
const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";
const PERTH = "Australia/Perth";

const HOOK_NAME = "__bentoTest";
const HOOK_WAIT_MS = 10_000;
const MIN_TAP_PX = 44;
const EDGE_TOLERANCE_PX = 1;

const PAD_PATH = "/sale";
const PAD_HEADING = "Quick sale";
const PAD_TITLE = "Quick sale · BentoBudget";

const TODAYS_MARKET_ID = "pretend-event-todays-market";
const TODAYS_MARKET = "Pretend weekend market (today)";
const NO_EVENT = "No event";

const PAYMENT_LABELS = ["Cash", "Card", "Online", "Bank transfer", "Other"] as const;
type PaymentLabel = (typeof PAYMENT_LABELS)[number];

/** The 12 key names in phone-keypad order, row by row. */
const KEY_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["Decimal point", "0", "Backspace"],
] as const;
const KEY_NAMES: readonly string[] = KEY_ROWS.flat();

const EMPTY_DISPLAY = "$";
const EMPTY_TOTAL = "Today: $0.00 from 0 sales";
const NO_ENTRIES = "No entries yet.";

// ---------- fixture: no uncaught errors, no hydration errors (Q11) ----------

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

// An Australian device in Sydney unless a describe block says otherwise.
test.use({ locale: "en-AU", timezoneId: SYDNEY });

// ---------- helpers ----------

function isTouch(testInfo: TestInfo): boolean {
  return !!testInfo.project.use.hasTouch;
}

function skipUnlessPhone(testInfo: TestInfo): void {
  test.skip(testInfo.project.name !== "phone", "phone-layout claim");
}

/** Freezes the device clock (unless `clock` is false), opens a path, requires HTTP 200. */
async function open(page: Page, url: string, clock = true): Promise<void> {
  if (clock) await page.clock.setFixedTime(FROZEN_NOW);
  const response = await page.goto(url);
  expect(response?.status(), `HTTP status of ${url}`).toBe(200);
}

/** Waits until the T1.6 test seam is installed, i.e. the page has hydrated. */
async function waitForHook(page: Page): Promise<void> {
  await page
    .waitForFunction(
      (name) => {
        const hook = (window as unknown as Record<string, { addSale?: unknown } | undefined>)[name];
        return typeof hook?.addSale === "function";
      },
      HOOK_NAME,
      { timeout: HOOK_WAIT_MS },
    )
    .catch(() => {
      throw new Error(`test seam window.${HOOK_NAME} never appeared (is port 3000 the NEXT_PUBLIC_E2E=1 build?)`);
    });
}

/** Adds sales through the seam (NOT through the pad). */
async function seedSales(page: Page, sales: readonly SaleInput[]): Promise<void> {
  await page.evaluate(
    ({ name, sales }) => {
      const hook = (window as unknown as Record<string, { addSale(sale: unknown): void }>)[name];
      for (const sale of sales) hook.addSale(sale);
    },
    { name: HOOK_NAME, sales: sales as SaleInput[] },
  );
}

/** Opens the pad directly, waits for hydration and for the amount display. */
async function openPad(page: Page, clock = true): Promise<void> {
  await open(page, PAD_PATH, clock);
  await waitForHook(page);
  await expect(amountDisplay(page)).toBeVisible();
}

function main(page: Page): Locator {
  return page.getByRole("main");
}

function mainNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Main", exact: true });
}

function exactText(page: Page, text: string): Locator {
  return main(page).getByText(text, { exact: true });
}

function numberPad(page: Page): Locator {
  return main(page).getByRole("group", { name: "Number pad", exact: true });
}

function key(page: Page, name: string): Locator {
  return numberPad(page).getByRole("button", { name, exact: true });
}

function saveButton(page: Page): Locator {
  return main(page).getByRole("button", { name: "Save", exact: true });
}

function undoButton(page: Page): Locator {
  return main(page).getByRole("button", { name: "Undo", exact: true });
}

function amountDisplay(page: Page): Locator {
  return main(page).getByRole("status", { name: "Amount", exact: true });
}

function eventSelect(page: Page): Locator {
  return main(page).getByRole("combobox", { name: "Event", exact: true });
}

function paymentGroup(page: Page): Locator {
  return main(page)
    .getByRole("radiogroup", { name: "Payment method", exact: true })
    .or(main(page).getByRole("group", { name: "Payment method", exact: true }));
}

function paymentRadio(page: Page, label: PaymentLabel): Locator {
  return paymentGroup(page).getByRole("radio", { name: label, exact: true });
}

function homeSaleControl(page: Page): Locator {
  return page
    .getByRole("button", { name: "+ Sale", exact: true })
    .or(page.getByRole("link", { name: "+ Sale", exact: true }));
}

/** Taps on a touch device (the phone project), clicks otherwise. */
async function press(locator: Locator, hasTouch: boolean): Promise<void> {
  await expect(locator).toBeVisible();
  if (hasTouch) await locator.tap();
  else await locator.click();
}

/** "." means Decimal point, "<" means Backspace; every other character is a digit key. */
function keyNameFor(char: string): string {
  if (char === ".") return "Decimal point";
  if (char === "<") return "Backspace";
  if (/^[0-9]$/.test(char)) return char;
  throw new Error(`no pad key for ${JSON.stringify(char)}`);
}

/** Taps pad keys one by one, e.g. "12.50" or "123<". */
async function tapKeys(page: Page, keys: string, hasTouch: boolean): Promise<void> {
  for (const char of keys) await press(key(page, keyNameFor(char)), hasTouch);
}

/** Taps the keys, then Save, then waits for the pad to be ready for the next sale. */
async function saveSale(page: Page, keys: string, hasTouch: boolean, emptyDisplay = EMPTY_DISPLAY): Promise<void> {
  await tapKeys(page, keys, hasTouch);
  await expect(saveButton(page)).toBeEnabled();
  await press(saveButton(page), hasTouch);
  await expect(amountDisplay(page)).toHaveText(emptyDisplay);
}

async function choosePayment(page: Page, label: PaymentLabel): Promise<void> {
  await paymentRadio(page, label).check();
  await expect(paymentRadio(page, label)).toBeChecked();
}

async function chooseEvent(page: Page, label: string): Promise<void> {
  await eventSelect(page).selectOption({ label });
  await expect(eventSelect(page).locator("option:checked")).toHaveText(label);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Moves with the bottom navigation (a client-side move, no reload). */
async function goToTab(page: Page, name: "Home" | "Transactions", path: "/" | "/transactions", hasTouch: boolean) {
  await press(mainNav(page).getByRole("link", { name, exact: true }), hasTouch);
  await expect(page).toHaveURL(new RegExp(`^https?://[^/]+${escapeRegExp(path)}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

/** From Home, opens the pad with "+ Sale". */
async function openPadFromHome(page: Page, hasTouch: boolean): Promise<void> {
  await press(homeSaleControl(page), hasTouch);
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/sale$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(PAD_HEADING);
  await expect(amountDisplay(page)).toBeVisible();
}

function transactionRows(page: Page): Locator {
  return main(page).getByRole("list").getByRole("listitem");
}

/** A row's text as laid out, whitespace collapsed. */
async function rowText(row: Locator): Promise<string> {
  return (await row.innerText()).replace(/\s+/g, " ").trim();
}

/** Every money amount in a piece of text ("$12.50", "A$0.01", ...). */
function amountsIn(text: string): string[] {
  return text.match(/[A-Z]{0,2}\$\d[\d,]*\.\d{2}/g) ?? [];
}

/** Each Transactions row as { iso, amounts, text }, top to bottom. */
async function readRows(page: Page): Promise<{ iso: (string | null)[]; amounts: string[]; text: string }[]> {
  const out = [];
  const count = await transactionRows(page).count();
  for (let i = 0; i < count; i++) {
    const row = transactionRows(page).nth(i);
    const text = await rowText(row);
    const iso = await row.locator("time").evaluateAll((ts) => ts.map((t) => t.getAttribute("datetime")));
    out.push({ iso, amounts: amountsIn(text), text });
  }
  return out;
}

/** True when `text` contains `word` with no letter touching either side. */
function hasWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}([^\\p{L}]|$)`, "u").test(text);
}

/**
 * The politeness of the nearest live region holding the element (itself or an
 * ancestor): aria-live wins; otherwise role="status" or <output> mean
 * "polite" and role="alert" means "assertive". null when there is none.
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

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const b = await locator.boundingBox();
  expect(b, "element has a layout box").not.toBeNull();
  return b!;
}

/** True when the topmost element at the centre of `locator` is it or inside it. */
function isTopmostAtCentre(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && (hit === el || el.contains(hit));
  });
}

/** The nav's top edge on screen, or the screen height if the nav is below the screen. */
async function reachableBottom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main"]');
    const top = nav ? nav.getBoundingClientRect().top : Infinity;
    return Math.min(top, window.innerHeight);
  });
}

/**
 * On the phone, without scrolling: each named control lies in the lower half
 * of the screen, ends at or above the nav (and the screen's bottom), and is
 * the topmost element at its centre.
 */
async function expectInLowerHalfAndReachable(page: Page, controls: Locator[], labels: string[]) {
  expect(await page.evaluate(() => window.scrollY), "the page hasn't scrolled").toBe(0);
  const half = (await page.evaluate(() => window.innerHeight)) / 2;
  const bottom = await reachableBottom(page);
  const problems: string[] = [];
  for (let i = 0; i < controls.length; i++) {
    const b = await box(controls[i]);
    if (b.y < half - EDGE_TOLERANCE_PX) problems.push(`${labels[i]}: top ${b.y.toFixed(1)} is above the middle (${half})`);
    if (b.y + b.height > bottom + EDGE_TOLERANCE_PX) {
      problems.push(`${labels[i]}: bottom ${(b.y + b.height).toFixed(1)} is below the nav/screen edge (${bottom.toFixed(1)})`);
    }
    if (!(await isTopmostAtCentre(controls[i]))) problems.push(`${labels[i]}: something covers its centre`);
  }
  expect(problems, "pad controls not in thumb reach").toEqual([]);
}

async function openPadWithTextSize(page: Page, width: number, height: number, percent: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await openPad(page);
  await page.evaluate((p) => {
    document.documentElement.style.fontSize = `${p}%`;
  }, percent);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(`${(16 * percent) / 100}px`);
}

function nextFrame(page: Page): Promise<unknown> {
  return page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * Presses Tab through every focusable control in <main> (for a radio group,
 * the checked radio, which is the one Tab reaches). After each press the
 * focused control must be fully on screen and not overlap the nav.
 */
async function expectTabKeepsFocusClearOfNav(page: Page): Promise<void> {
  const count = await main(page).evaluate((m) => {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([type="radio"]), input[type="radio"]:checked:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const found = Array.from(m.querySelectorAll(selector)).filter(
      (el) => el.getClientRects().length > 0 && el.getAttribute("tabindex") !== "-1",
    );
    found.forEach((el, i) => el.setAttribute("data-focus-test", String(i)));
    return found.length;
  });
  expect(count, "focusable controls in <main>").toBeGreaterThanOrEqual(KEY_NAMES.length);
  const reached = new Set<number>();
  for (let n = 0; n < count + 20 && reached.size < count; n++) {
    await page.keyboard.press("Tab");
    await nextFrame(page);
    const state = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const nav = document.querySelector('nav[aria-label="Main"]');
      if (!el || !nav || !el.hasAttribute("data-focus-test")) return null;
      const r = el.getBoundingClientRect();
      const nr = nav.getBoundingClientRect();
      return {
        index: Number(el.getAttribute("data-focus-test")),
        label: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`,
        top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        navTop: nr.top, navBottom: nr.bottom, vw: window.innerWidth, vh: window.innerHeight,
      };
    });
    if (state === null) continue;
    reached.add(state.index);
    const where = `${state.label} at top ${state.top.toFixed(1)}, bottom ${state.bottom.toFixed(1)}`;
    expect(state.top, `${where}: top on screen`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(state.bottom, `${where}: bottom on screen`).toBeLessThanOrEqual(state.vh + EDGE_TOLERANCE_PX);
    expect(state.left, `${where}: left on screen`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(state.right, `${where}: right on screen`).toBeLessThanOrEqual(state.vw + EDGE_TOLERANCE_PX);
    const overlapsNav = state.bottom > state.navTop + EDGE_TOLERANCE_PX && state.top < state.navBottom - EDGE_TOLERANCE_PX;
    expect(overlapsNav, `${where} overlaps the nav (${state.navTop.toFixed(1)}–${state.navBottom.toFixed(1)})`).toBe(false);
  }
  expect(reached.size, "focusable controls in <main> reached by Tab").toBe(count);
}

// ═══ 1. Opening the pad ═════════════════════════════════════════════════════

test.describe("opening the pad", () => {
  test('"+ Sale" on Home opens the pad at /sale', async ({ page }, testInfo) => {
    await open(page, "/");
    await waitForHook(page);
    await openPadFromHome(page, isTouch(testInfo));
  });

  test("/sale answers HTTP 200 with its own title", async ({ page }) => {
    await open(page, PAD_PATH);
    await expect(page).toHaveTitle(PAD_TITLE);
  });

  test('/sale has exactly one level-1 heading, "Quick sale"', async ({ page }) => {
    await openPad(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PAD_HEADING);
  });

  test('"+ Sale" keeps the entries already in memory (client-side move)', async ({ page }, testInfo) => {
    await open(page, "/");
    await waitForHook(page);
    // One $20.00 sale today, added through the seam: 2000 cents → "$20.00 from 1 sale".
    await seedSales(page, [{ date: "2026-07-01", amountCents: 2000, paymentMethod: "cash" }]);
    await expect(exactText(page, "Today: $20.00 from 1 sale")).toBeVisible();
    await openPadFromHome(page, isTouch(testInfo));
    await expect(exactText(page, "Today: $20.00 from 1 sale")).toBeVisible();
  });
});

// ═══ 2. What the pad shows ══════════════════════════════════════════════════

test.describe("the pad's parts", () => {
  test('the number pad group holds exactly 12 buttons: "0"–"9", "Decimal point", "Backspace"', async ({ page }) => {
    await openPad(page);
    await expect(numberPad(page)).toHaveCount(1);
    const names = await numberPad(page).getByRole("button").evaluateAll((buttons) =>
      buttons.map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim()),
    );
    expect(names.length).toBe(12);
    for (const name of KEY_NAMES) await expect(key(page, name), `key "${name}"`).toHaveCount(1);
  });

  test("every pad key is a type=button button (never submits a form)", async ({ page }) => {
    await openPad(page);
    const types = await numberPad(page).getByRole("button").evaluateAll((buttons) =>
      buttons.map((b) => `${b.tagName}:${b.getAttribute("type")}`),
    );
    expect(types).toEqual(Array(12).fill("BUTTON:button"));
  });

  test("the keys are in phone-keypad layout (1 2 3 / 4 5 6 / 7 8 9 / . 0 ⌫)", async ({ page }) => {
    await openPad(page);
    const centres: { name: string; x: number; y: number }[][] = [];
    for (const row of KEY_ROWS) {
      const line = [];
      for (const name of row) {
        const b = await box(key(page, name));
        line.push({ name, x: b.x + b.width / 2, y: b.y + b.height / 2 });
      }
      centres.push(line);
    }
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const k = centres[r][c];
        expect(Math.abs(k.y - centres[r][0].y), `"${k.name}" is on the same row as "${centres[r][0].name}"`).toBeLessThanOrEqual(2);
        expect(Math.abs(k.x - centres[0][c].x), `"${k.name}" is in the same column as "${centres[0][c].name}"`).toBeLessThanOrEqual(2);
        if (c > 0) expect(k.x, `"${k.name}" is right of "${centres[r][c - 1].name}"`).toBeGreaterThan(centres[r][c - 1].x);
        if (r > 0) expect(k.y, `"${k.name}" is below "${centres[r - 1][c].name}"`).toBeGreaterThan(centres[r - 1][c].y);
      }
    }
  });

  test('there is exactly one "Save" button', async ({ page }) => {
    await openPad(page);
    await expect(saveButton(page)).toHaveCount(1);
  });

  test('the amount display is a polite live region named "Amount" that starts as "$"', async ({ page }) => {
    await openPad(page);
    await expect(amountDisplay(page)).toHaveCount(1);
    await expect(amountDisplay(page)).toHaveText(EMPTY_DISPLAY);
    expect(await liveRegionOf(amountDisplay(page))).toBe("polite");
  });

  test('the payment-method group has five radios in order: Cash, Card, Online, Bank transfer, Other', async ({ page }) => {
    await openPad(page);
    await expect(paymentGroup(page)).toHaveCount(1);
    const radios = paymentGroup(page).getByRole("radio");
    await expect(radios).toHaveCount(5);
    for (let i = 0; i < PAYMENT_LABELS.length; i++) {
      await expect(radios.nth(i)).toHaveAccessibleName(PAYMENT_LABELS[i]);
    }
    const native = await radios.evaluateAll((els) => els.map((e) => `${e.tagName}:${e.getAttribute("type")}`));
    expect(native).toEqual(Array(5).fill("INPUT:radio"));
  });

  test('the "Event" select offers "No event" once and today\'s market', async ({ page }) => {
    await openPad(page);
    await expect(eventSelect(page)).toHaveCount(1);
    expect(await eventSelect(page).evaluate((s) => s.tagName)).toBe("SELECT");
    const options = await eventSelect(page).evaluate((s) =>
      Array.from((s as HTMLSelectElement).options).map((o) => o.text.trim()),
    );
    expect(options.filter((o) => o === NO_EVENT)).toHaveLength(1);
    expect(options).toContain(TODAYS_MARKET);
  });

  test(`the running total starts as "${EMPTY_TOTAL}"`, async ({ page }) => {
    await openPad(page);
    await expect(exactText(page, EMPTY_TOTAL)).toHaveCount(1);
    await expect(exactText(page, EMPTY_TOTAL)).toBeVisible();
  });

  test("there is no Undo button before the first save", async ({ page }) => {
    await openPad(page);
    await expect(undoButton(page)).toHaveCount(0);
  });
});

// ═══ 3. Typing an amount ════════════════════════════════════════════════════

test.describe("typing an amount with the keys", () => {
  test('tapping 1 2 . 5 0 shows "$12.50"', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "12.50", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText("$12.50");
  });

  test('a third decimal can\'t be typed: 1 . 2 5 9 shows "$1.25"', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "1.259", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText("$1.25");
  });

  test('a second point is ignored: 1 . . 5 shows "$1.5"', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "1..5", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText("$1.5");
  });

  test('a point on an empty amount gives "$0."', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, ".", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText("$0.");
  });

  test('a digit after a lone zero replaces it: 0 5 shows "$5"', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "05", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText("$5");
  });

  test('Backspace removes the last character: 1 2 3 ⌫ shows "$12"', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "123<", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText("$12");
  });

  test('Backspace on an empty amount leaves "$"', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "<<", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText(EMPTY_DISPLAY);
  });

  test('"5." (incomplete) shows "$5." and Save is disabled', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "5.", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText("$5.");
    await expect(saveButton(page)).toBeDisabled();
  });

  test("Save is disabled while nothing is typed", async ({ page }) => {
    await openPad(page);
    await expect(saveButton(page)).toBeDisabled();
  });

  test("Save is enabled once a valid amount is typed", async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "5", isTouch(testInfo));
    await expect(saveButton(page)).toBeEnabled();
  });
});

// ═══ 4. Blocked amounts record nothing ══════════════════════════════════════

test.describe("invalid amounts are blocked", () => {
  test("an empty amount can't be saved, even by forcing a tap on Save", async ({ page }, testInfo) => {
    await openPad(page);
    await saveButton(page).click({ force: true });
    await expect(exactText(page, EMPTY_TOTAL)).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    await expect(exactText(page, NO_ENTRIES)).toBeVisible();
  });

  test('"." alone (shown "$0.") can\'t be saved, even by forcing a tap on Save', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, ".", isTouch(testInfo));
    await expect(saveButton(page)).toBeDisabled();
    await saveButton(page).click({ force: true });
    await expect(amountDisplay(page)).toHaveText("$0.");
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    await expect(exactText(page, NO_ENTRIES)).toBeVisible();
  });

  test("Enter on an empty amount records nothing", async ({ page }, testInfo) => {
    await openPad(page);
    await page.keyboard.press("Enter");
    await expect(exactText(page, EMPTY_TOTAL)).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    await expect(exactText(page, NO_ENTRIES)).toBeVisible();
  });

  test('Enter on "5." records nothing', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "5.", isTouch(testInfo));
    // Move focus off the last tapped key, so Enter goes to the page (Q8).
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Enter");
    await expect(exactText(page, EMPTY_TOTAL)).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    await expect(exactText(page, NO_ENTRIES)).toBeVisible();
  });

  test('zero is allowed: 0 then Save records a $0.00 sale ("Today: $0.00 from 1 sale")', async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "0", isTouch(testInfo));
    await expect(exactText(page, "Today: $0.00 from 1 sale")).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    const rows = await readRows(page);
    expect(rows.map((r) => r.amounts)).toEqual([["$0.00"]]);
  });

  test('typing . 5 0 records $0.50 (the point on an empty amount becomes "0.")', async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, ".50", isTouch(testInfo));
    // 50 cents → "$0.50 from 1 sale".
    await expect(exactText(page, "Today: $0.50 from 1 sale")).toBeVisible();
  });
});

// ═══ 5. Saving ══════════════════════════════════════════════════════════════

test.describe("logging a sale", () => {
  test("from Home, 7 taps (+ Sale, 1, 2, ., 5, 0, Save) record exactly one $12.50 sale", async ({ page }, testInfo) => {
    const touch = isTouch(testInfo);
    await open(page, "/");
    await waitForHook(page);
    await press(homeSaleControl(page), touch); // tap 1
    await expect(amountDisplay(page)).toBeVisible();
    await tapKeys(page, "12.50", touch); // taps 2–6
    await press(saveButton(page), touch); // tap 7
    await expect(exactText(page, "Today: $12.50 from 1 sale")).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", touch);
    const rows = await readRows(page);
    expect(rows.map((r) => r.amounts)).toEqual([["$12.50"]]);
    expect(hasWord(rows[0].text, "Sale")).toBe(true);
  });

  test('after Save the pad stays open, empty ("$"), with Save disabled again', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "12.50", isTouch(testInfo));
    await press(saveButton(page), isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText(EMPTY_DISPLAY);
    await expect(page).toHaveURL(/\/sale$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PAD_HEADING);
    await expect(saveButton(page)).toBeDisabled();
  });

  test('after Save the pad says exactly "Sale of $12.50 saved." in a polite live region', async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    const message = exactText(page, "Sale of $12.50 saved.");
    await expect(message).toHaveCount(1);
    await expect(message).toBeVisible();
    expect(await liveRegionOf(message)).toBe("polite");
  });

  test('three sales in a row (5, 10, 2.50) give "Today: $17.50 from 3 sales" on the pad', async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "5", isTouch(testInfo));
    await saveSale(page, "10", isTouch(testInfo));
    await saveSale(page, "2.50", isTouch(testInfo));
    // 500 + 1000 + 250 = 1750 cents.
    await expect(exactText(page, "Today: $17.50 from 3 sales")).toBeVisible();
  });

  test("a double tap on Save records one sale, not two", async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "5", isTouch(testInfo));
    await saveButton(page).dblclick();
    await expect(exactText(page, "Today: $5.00 from 1 sale")).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    await expect(transactionRows(page)).toHaveCount(1);
  });

  test("a large end-of-day total (1234.56) is recorded exactly as $1,234.56", async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "1234.56", isTouch(testInfo));
    // 123456 cents.
    await expect(exactText(page, "Today: $1,234.56 from 1 sale")).toBeVisible();
  });
});

// ═══ 6. Defaults ════════════════════════════════════════════════════════════

test.describe("smart defaults", () => {
  test('payment defaults to "Cash" (and only Cash is checked)', async ({ page }) => {
    await openPad(page);
    for (const label of PAYMENT_LABELS) {
      if (label === "Cash") await expect(paymentRadio(page, label)).toBeChecked();
      else await expect(paymentRadio(page, label)).not.toBeChecked();
    }
  });

  test(`the event defaults to today's pretend event, "${TODAYS_MARKET}"`, async ({ page }) => {
    await openPad(page);
    await expect(eventSelect(page).locator("option:checked")).toHaveText(TODAYS_MARKET);
  });

  test("a default sale is stored with today's event (Transactions shows the event's name)", async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    const rows = await readRows(page);
    expect(rows).toHaveLength(1);
    expect(hasWord(rows[0].text, TODAYS_MARKET), rows[0].text).toBe(true);
  });

  test("a default sale with No event is stored as Cash (Transactions shows \"Cash\")", async ({ page }, testInfo) => {
    await openPad(page);
    await chooseEvent(page, NO_EVENT);
    await saveSale(page, "12.50", isTouch(testInfo));
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    const rows = await readRows(page);
    expect(rows).toHaveLength(1);
    expect(hasWord(rows[0].text, "Cash"), rows[0].text).toBe(true);
    expect(rows[0].amounts).toEqual(["$12.50"]);
  });

  test("01:30 in Sydney: the sale is dated 2026-07-01, not the UTC date", async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    await expect(transactionRows(page)).toHaveCount(1);
    await expect(transactionRows(page).first().locator("time")).toHaveAttribute("datetime", "2026-07-01");
    await expect(transactionRows(page).first().locator("time")).toHaveText("01/07/2026");
  });

  test("the date is taken when Save is tapped: a pad opened at 23:59 and saved at 00:01 gives the new day", async ({ page }, testInfo) => {
    // Opened at 2026-06-30 13:59:00Z = 23:59 on 30 June in Sydney.
    await page.clock.setFixedTime(new Date("2026-06-30T13:59:00.000Z"));
    const response = await page.goto(PAD_PATH);
    expect(response?.status()).toBe(200);
    await waitForHook(page);
    await tapKeys(page, "7", isTouch(testInfo));
    // Two minutes later: 14:01Z = 00:01 on 1 July in Sydney.
    await page.clock.setFixedTime(new Date("2026-06-30T14:01:00.000Z"));
    await press(saveButton(page), isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText(EMPTY_DISPLAY);
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    await expect(transactionRows(page)).toHaveCount(1);
    await expect(transactionRows(page).first().locator("time")).toHaveAttribute("datetime", "2026-07-01");
  });

  test("after Save, payment goes back to Cash and the event choice stays", async ({ page }, testInfo) => {
    await openPad(page);
    await chooseEvent(page, NO_EVENT);
    await choosePayment(page, "Card");
    await saveSale(page, "1", isTouch(testInfo));
    await expect(paymentRadio(page, "Cash")).toBeChecked();
    await expect(paymentRadio(page, "Card")).not.toBeChecked();
    await expect(eventSelect(page).locator("option:checked")).toHaveText(NO_EVENT);
    // The next sale is cash with no event: rows newest first are "Cash $2.00", then "Card $1.00".
    await saveSale(page, "2", isTouch(testInfo));
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    const rows = await readRows(page);
    expect(rows.map((r) => r.amounts)).toEqual([["$2.00"], ["$1.00"]]);
    expect(hasWord(rows[0].text, "Cash"), rows[0].text).toBe(true);
    expect(hasWord(rows[1].text, "Card"), rows[1].text).toBe(true);
  });
});

test.describe("late at night in Perth (today = 2026-06-30)", () => {
  test.use({ timezoneId: PERTH });

  test("23:30 in Perth: the sale is dated 2026-06-30", async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    await expect(transactionRows(page)).toHaveCount(1);
    await expect(transactionRows(page).first().locator("time")).toHaveAttribute("datetime", "2026-06-30");
    await expect(transactionRows(page).first().locator("time")).toHaveText("30/06/2026");
  });
});

// ═══ 7. Changing payment method and event ═══════════════════════════════════

test.describe("changing payment method and event", () => {
  test("each payment method can be chosen and is stored (Cash, Card, Online, Bank transfer, Other)", async ({ page }, testInfo) => {
    await openPad(page);
    await chooseEvent(page, NO_EVENT);
    for (const label of PAYMENT_LABELS) {
      await choosePayment(page, label);
      await saveSale(page, "1", isTouch(testInfo));
    }
    // 5 × 100 cents = 500 → "$5.00 from 5 sales".
    await expect(exactText(page, "Today: $5.00 from 5 sales")).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    const rows = await readRows(page);
    // Newest first: the last one saved ("Other") is on top.
    const expected = ["Other", "Bank transfer", "Online", "Card", "Cash"];
    expect(rows).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(hasWord(rows[i].text, expected[i]), `row ${i + 1}: "${rows[i].text}"`).toBe(true);
      expect(rows[i].amounts).toEqual(["$1.00"]);
    }
  });

  test('the event can be changed to "No event"', async ({ page }) => {
    await openPad(page);
    await chooseEvent(page, NO_EVENT);
    await expect(eventSelect(page).locator("option:checked")).toHaveText(NO_EVENT);
  });

  test("a sale with No event is not linked to today's market", async ({ page }, testInfo) => {
    await openPad(page);
    await chooseEvent(page, NO_EVENT);
    await choosePayment(page, "Card");
    await saveSale(page, "3", isTouch(testInfo));
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    const rows = await readRows(page);
    expect(rows).toHaveLength(1);
    expect(hasWord(rows[0].text, "Card"), rows[0].text).toBe(true);
    expect(rows[0].text).not.toContain(TODAYS_MARKET);
  });
});

// ═══ 8. Running total ═══════════════════════════════════════════════════════

test.describe("the running total", () => {
  test('updates on the pad straight after Save: "Today: $12.50 from 1 sale"', async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await expect(exactText(page, "Today: $12.50 from 1 sale")).toBeVisible();
    await expect(exactText(page, EMPTY_TOTAL)).toHaveCount(0);
  });

  test("Home shows the same total after going back with the nav", async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await saveSale(page, "3", isTouch(testInfo));
    await goToTab(page, "Home", "/", isTouch(testInfo));
    // 1250 + 300 = 1550 cents.
    await expect(exactText(page, "Today: $15.50 from 2 sales")).toBeVisible();
  });

  test("includes sales that didn't come from the pad", async ({ page }, testInfo) => {
    await open(page, "/");
    await waitForHook(page);
    await seedSales(page, [{ date: "2026-07-01", amountCents: 2000, paymentMethod: "card" }]);
    await openPadFromHome(page, isTouch(testInfo));
    await saveSale(page, "12.50", isTouch(testInfo));
    // 2000 + 1250 = 3250 cents.
    await expect(exactText(page, "Today: $32.50 from 2 sales")).toBeVisible();
  });
});

// ═══ 9. Undo ════════════════════════════════════════════════════════════════

test.describe("undo", () => {
  test('after a save there is one "Undo" button', async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await expect(undoButton(page)).toHaveCount(1);
    await expect(undoButton(page)).toBeVisible();
  });

  test("Undo removes exactly the last sale and the pad's total goes back", async ({ page }, testInfo) => {
    const touch = isTouch(testInfo);
    await open(page, "/");
    await waitForHook(page);
    // A sale from elsewhere: 2000 cents, today, at the market.
    await seedSales(page, [{ date: "2026-07-01", amountCents: 2000, paymentMethod: "cash", eventId: TODAYS_MARKET_ID }]);
    await openPadFromHome(page, touch);
    await saveSale(page, "12.50", touch);
    await saveSale(page, "3", touch);
    // 2000 + 1250 + 300 = 3550.
    await expect(exactText(page, "Today: $35.50 from 3 sales")).toBeVisible();
    await press(undoButton(page), touch);
    // 3550 − 300 = 3250.
    await expect(exactText(page, "Today: $32.50 from 2 sales")).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", touch);
    const rows = await readRows(page);
    // Newest first: the pad's $12.50, then the seeded $20.00. The $3.00 is gone.
    expect(rows.map((r) => r.amounts)).toEqual([["$12.50"], ["$20.00"]]);
  });

  test("Home's total goes back after Undo", async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await saveSale(page, "3", isTouch(testInfo));
    await press(undoButton(page), isTouch(testInfo));
    await goToTab(page, "Home", "/", isTouch(testInfo));
    await expect(exactText(page, "Today: $12.50 from 1 sale")).toBeVisible();
  });

  test('after Undo the button is gone and the message reads "Sale of $3.00 removed."', async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await saveSale(page, "3", isTouch(testInfo));
    await press(undoButton(page), isTouch(testInfo));
    await expect(undoButton(page)).toHaveCount(0);
    const message = exactText(page, "Sale of $3.00 removed.");
    await expect(message).toBeVisible();
    expect(await liveRegionOf(message)).toBe("polite");
    await expect(exactText(page, "Sale of $3.00 saved.")).toHaveCount(0);
  });

  test("typing the next amount keeps Undo, and Undo keeps what was typed", async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await tapKeys(page, "7", isTouch(testInfo));
    await expect(undoButton(page)).toBeVisible();
    await press(undoButton(page), isTouch(testInfo));
    await expect(exactText(page, EMPTY_TOTAL)).toBeVisible();
    await expect(amountDisplay(page)).toHaveText("$7");
  });

  test("Undo has no time limit: still there and working two minutes later", async ({ page }, testInfo) => {
    await page.clock.install({ time: FROZEN_NOW });
    await openPad(page, false);
    await saveSale(page, "12.50", isTouch(testInfo));
    await page.clock.runFor(120_000);
    await expect(undoButton(page)).toBeVisible();
    await press(undoButton(page), isTouch(testInfo));
    await expect(exactText(page, EMPTY_TOTAL)).toBeVisible();
  });

  test("Undo is gone after leaving the pad and coming back", async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await goToTab(page, "Home", "/", isTouch(testInfo));
    await openPadFromHome(page, isTouch(testInfo));
    await expect(exactText(page, "Today: $12.50 from 1 sale")).toBeVisible();
    await expect(undoButton(page)).toHaveCount(0);
  });
});

// ═══ 10. Keyboard ═══════════════════════════════════════════════════════════

test.describe("keyboard", () => {
  test("typing 12.50 then Enter records a $12.50 sale", async ({ page }, testInfo) => {
    await openPad(page);
    await page.keyboard.type("12.50");
    await expect(amountDisplay(page)).toHaveText("$12.50");
    await page.keyboard.press("Enter");
    await expect(exactText(page, "Today: $12.50 from 1 sale")).toBeVisible();
    await goToTab(page, "Transactions", "/transactions", isTouch(testInfo));
    expect((await readRows(page)).map((r) => r.amounts)).toEqual([["$12.50"]]);
  });

  test("the Backspace key edits the amount: 129 ⌫ .5 shows $12.5", async ({ page }) => {
    await openPad(page);
    await page.keyboard.type("129");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(".5");
    await expect(amountDisplay(page)).toHaveText("$12.5");
  });

  test("typing follows the same rules as the keys: 1.259 shows $1.25", async ({ page }) => {
    await openPad(page);
    await page.keyboard.type("1.259");
    await expect(amountDisplay(page)).toHaveText("$1.25");
  });

  test('Enter on a Tab-focused "7" key types 7 and doesn\'t save', async ({ page }) => {
    await openPad(page);
    const seven = key(page, "7");
    let focused = false;
    for (let i = 0; i < 60 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await seven.evaluate((el) => el === document.activeElement);
    }
    expect(focused, 'Tab reaches the "7" key').toBe(true);
    await page.keyboard.press("Enter");
    await expect(amountDisplay(page)).toHaveText("$7");
    await expect(exactText(page, EMPTY_TOTAL)).toBeVisible();
    await expect(undoButton(page)).toHaveCount(0);
  });

  test("on a phone at 390×844, Tab never leaves a focused pad control hidden under the nav", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    await openPad(page);
    await expectTabKeepsFocusClearOfNav(page);
  });
});

// ═══ 11. Size and one-handed reach ══════════════════════════════════════════

test.describe("tap targets and reach", () => {
  test("every key and Save are at least 44×44 px", async ({ page }) => {
    await openPad(page);
    const small: string[] = [];
    for (const name of KEY_NAMES) {
      const b = await box(key(page, name));
      if (b.width < MIN_TAP_PX || b.height < MIN_TAP_PX) small.push(`${name}: ${b.width}×${b.height}`);
    }
    const s = await box(saveButton(page));
    if (s.width < MIN_TAP_PX || s.height < MIN_TAP_PX) small.push(`Save: ${s.width}×${s.height}`);
    expect(small, "controls smaller than 44×44").toEqual([]);
  });

  test("Undo is at least 44×44 px", async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "5", isTouch(testInfo));
    const b = await box(undoButton(page));
    expect(b.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(b.height).toBeGreaterThanOrEqual(MIN_TAP_PX);
  });

  test("on a phone, the 12 keys and Save sit in the lower half of the screen, above the nav, uncovered", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await openPad(page);
    await expectInLowerHalfAndReachable(
      page,
      [...KEY_NAMES.map((n) => key(page, n)), saveButton(page)],
      [...KEY_NAMES, "Save"],
    );
  });

  test("on a phone, after a save (message and Undo showing) the keys and Save are still in the lower half, above the nav", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await expect(undoButton(page)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectInLowerHalfAndReachable(
      page,
      [...KEY_NAMES.map((n) => key(page, n)), saveButton(page)],
      [...KEY_NAMES, "Save"],
    );
  });

  test("on a phone, after a save Undo is fully on screen and above the nav without scrolling", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo));
    await page.evaluate(() => window.scrollTo(0, 0));
    const b = await box(undoButton(page));
    const bottom = await reachableBottom(page);
    expect(b.y, "Undo top").toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(b.y + b.height, "Undo bottom vs nav top").toBeLessThanOrEqual(bottom + EDGE_TOLERANCE_PX);
    expect(await isTopmostAtCentre(undoButton(page)), "nothing covers Undo").toBe(true);
  });
});

test.describe("on a phone at 320×568 with 200% text", () => {
  test("on a phone at 320×568 and 200% text, /sale doesn't scroll sideways, even showing 12345.67", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    await openPadWithTextSize(page, 320, 568, 200);
    await tapKeys(page, "12345.67", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText("$12345.67");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, "page width vs screen width").toBeLessThanOrEqual(clientWidth);
    const d = await box(amountDisplay(page));
    expect(d.x, "amount display left edge").toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(d.x + d.width, "amount display right edge").toBeLessThanOrEqual(320 + EDGE_TOLERANCE_PX);
  });

  test("on a phone at 320×568 and 200% text, every key and Save stay inside 0–320 px and at least 44×44", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    await openPadWithTextSize(page, 320, 568, 200);
    const problems: string[] = [];
    for (const [label, loc] of [...KEY_NAMES.map((n) => [n, key(page, n)] as const), ["Save", saveButton(page)] as const]) {
      await loc.scrollIntoViewIfNeeded();
      const b = await box(loc);
      if (b.x < -EDGE_TOLERANCE_PX || b.x + b.width > 320 + EDGE_TOLERANCE_PX) problems.push(`${label}: x ${b.x}–${b.x + b.width}`);
      if (b.width < MIN_TAP_PX || b.height < MIN_TAP_PX) problems.push(`${label}: ${b.width}×${b.height}`);
    }
    expect(problems).toEqual([]);
  });

  test("on a phone at 320×568 and 200% text, each key and Save, scrolled into view, is not hidden behind the nav", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    await openPadWithTextSize(page, 320, 568, 200);
    const covered: string[] = [];
    for (const [label, loc] of [...KEY_NAMES.map((n) => [n, key(page, n)] as const), ["Save", saveButton(page)] as const]) {
      await loc.scrollIntoViewIfNeeded();
      if (!(await isTopmostAtCentre(loc))) covered.push(label);
    }
    expect(covered, "controls covered at their centre").toEqual([]);
  });

  test("on a phone at 320×568 and 200% text, a sale can be made by tapping (4 2 Save → $42.00)", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    await openPadWithTextSize(page, 320, 568, 200);
    await saveSale(page, "42", true);
    await expect(exactText(page, "Today: $42.00 from 1 sale")).toBeVisible();
  });

  test("on a phone at 320×568 and 200% text, Tab never leaves a focused pad control hidden under the nav", async ({ page }, testInfo) => {
    skipUnlessPhone(testInfo);
    await openPadWithTextSize(page, 320, 568, 200);
    await expectTabKeepsFocusClearOfNav(page);
  });
});

// ═══ 12. Screen readers, and the T1.6 carry-overs ═══════════════════════════

test.describe("screen readers", () => {
  test('the amount display is exposed as status "Amount" with the typed amount', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "12.5", isTouch(testInfo));
    await expect(amountDisplay(page)).toMatchAriaSnapshot('- status "Amount": "$12.5"');
  });

  test("Home's two totals lines sit inside a polite live region", async ({ page }) => {
    await open(page, "/");
    await waitForHook(page);
    await expect(exactText(page, EMPTY_TOTAL)).toBeVisible();
    expect(await liveRegionOf(exactText(page, EMPTY_TOTAL)), "sales total").toBe("polite");
    expect(await liveRegionOf(exactText(page, "Today's expenses: $0.00")), "expenses total").toBe("polite");
  });

  test('the Transactions list has an explicit role="list"', async ({ page }) => {
    await open(page, "/transactions");
    await waitForHook(page);
    await seedSales(page, [{ date: "2026-07-01", amountCents: 500 }]);
    await expect(transactionRows(page)).toHaveCount(1);
    const list = main(page).getByRole("list");
    await expect(list).toHaveCount(1);
    await expect(list).toHaveAttribute("role", "list");
  });
});

// ═══ 13. Another locale ═════════════════════════════════════════════════════

test.describe("on a US-English device", () => {
  test.use({ locale: "en-US" });

  test('the display uses the locale\'s AUD symbol: 5 shows "A$5"', async ({ page }, testInfo) => {
    await openPad(page);
    await tapKeys(page, "5", isTouch(testInfo));
    await expect(amountDisplay(page)).toHaveText("A$5");
  });

  test('the saved message uses the locale\'s format: "Sale of A$12.50 saved."', async ({ page }, testInfo) => {
    await openPad(page);
    await saveSale(page, "12.50", isTouch(testInfo), "A$");
    await expect(exactText(page, "Sale of A$12.50 saved.")).toBeVisible();
  });
});
