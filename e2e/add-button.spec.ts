// The "+" button: Income or Expense (T1.14, docs/stages/stage-01.md).
// Guide: DECISIONS.md "The '+' button" (owner: one "+" button on Home and on
// every income or expense summary page; tapping it offers Income or Expense;
// it pre-fills the form from the page it's on; Home's pre-fills nothing) and
// "Navigation" (the tabs Home, Events, Expenses, Income, Settings).
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop)
// unless its name says "on a phone"; those are limited to the phone project
// with a conditional `test.skip(...)`, as in app-shell.spec.ts. On desktop
// they show as skipped, which is expected.
//
// How the tests see what was saved: the forms already exist (T1.12, T1.13),
// and Home's "This month" section (home.spec.ts H3) adds up every entry dated
// in the device's month: "Income $X" and "Expenses $X". CHANGED (T1.18): it
// used to be Home's today totals, "Today: $X from N sales" and "Today's expenses:
// $X"; every entry in B6 is dated today (1 July in Sydney), so the amounts
// are unchanged and only the wording of each line moved.
// Entries live in memory, so every move between screens in this file is a
// CLIENT-SIDE move (a link or the bottom nav), never page.goto, and the moves
// through "Add income"/"Add expense" are proven not to reload the page with a
// marker on `window` (the same technique as goClientSide in the form specs).
//
// ═══ DECISIONS (lead's, written out here so the tests can be exact) ════════
//
// B1. Where it is. Exactly one AddButton on each of Home (/), Events
//     (/events), Expenses (/expenses) and Income (/income), each with NO
//     pre-fill. It sits near the top of the page, under the h1: it comes
//     after the h1 in the document, its top edge is at or below the h1's
//     bottom edge, and it is the FIRST focusable element in <main>. It is
//     full-width: its width equals the width of <main>'s content box (main's
//     clientWidth minus its left and right padding), within 1 px.
//     Lead design (the owner may change it): a page-top button, not a
//     floating one, so it never overlaps the bottom tabs or large text.
//     The event and stream pages (T1.15/T1.16) add it later with their
//     pre-fill; the event page's links are tested in events.spec.ts.
//     Settings has no "+ Add" (lead confirmed after T1.14).
//     ADDED (T1.15, lead's answer after T1.14): "+ Add" goes DIRECTLY under
//     the h1: the h1's next element sibling is the "+ Add" button or holds it.
//     It is ONE shared component: the button and the two links have the
//     same `class` on all four pages.
//     CHANGED (T1.19, owner's change 2026-10-30, DECISIONS.md "The '+'
//     button"): the button is no longer a full-width page-top button under
//     the h1. It is a small round button floating in the bottom-right corner
//     (B9-B14 below), and <AddButton/> moves to the END of each page's
//     content. So the "directly under the h1", "first focusable element in
//     <main>" and "full-width" claims are REMOVED here (and in home.spec H7,
//     expenses.spec X1, events.spec E3, income-streams.spec S3), replaced by
//     B12 ("at the end": last focusable, nothing after it) and B9/B10 (round,
//     bottom-right). "Comes after the h1" and "its top is at or below the
//     h1's bottom" stay: both are still true of a button at the bottom.
//
// B2. Names. The button is a real <button> whose accessible name AND visible
//     text are exactly "+ Add" (WCAG 2.5.3: say what you see). The two links'
//     accessible names are exactly "Add income" and "Add expense".
//     CHANGED (T1.19): the button's accessible name is exactly "Add", given
//     by aria-label="Add"; what it shows is a "+" (or, while open, a "×")
//     drawn as an aria-hidden character or icon, so the name a speech-input
//     user says ("Add") is the button's label and the glyph is decoration.
//     Every locator in the e2e specs now finds it by role button and exact
//     name "Add" (exact, so "Add income"/"Add expense" never match). Below,
//     "+ Add" in older claims means this button.
//     Home's old "+ Expense" link is gone: no link or button on Home is named
//     "+ Expense" (it REPLACES it). app-shell claim 8 and removed-quick-sale
//     R2 change with it (marked "CHANGED (T1.14)" there).
//
// B3. A disclosure (WAI-ARIA disclosure pattern).
//     - Closed at start, on every page load AND when a page is reached again
//       after a round trip: aria-expanded="false", and neither link is in the
//       accessibility tree (getByRole finds 0), nor reachable with Tab.
//     - Opening it (tap, click, Enter or Space on the focused button) sets
//       aria-expanded="true" and shows both links. aria-controls then holds
//       the id of an element in the page whose role is "group" and which
//       holds exactly these two links, "Add income" FIRST, then
//       "Add expense" (document order). Tab from "+ Add" reaches
//       "Add income", then "Add expense".
//     - Closing: Escape closes the group and puts focus back on "+ Add"
//       (also when focus was on one of the links); a tap or click outside it
//       (on the page heading) closes it; pressing "+ Add" again closes it.
//     - ADDED (T1.15, from the T1.14 code review): Escape closes it even when
//       focus isn't inside it, e.g. opened with a mouse click and then focus
//       moved to <body>.
//     - ADDED (T1.15, lead's answer after T1.14): leaving a page resets it.
//       Opened on Home, then a move to Events and back to Home with the
//       bottom tabs (client-side): it is closed.
//
// B4. The links' addresses, EXACT (`href` attribute, character for
//     character). Each link carries the page's pre-fill and `back` = the
//     current page's path. Parameter order: event, stream, back (only the
//     ones that apply). Encoding: URLSearchParams, so "/" becomes "%2F" and
//     a space would become "+". With no pre-fill (all four pages now):
//       Home      /income/new?back=%2F          /expenses/new?back=%2F
//       Events    /income/new?back=%2Fevents    /expenses/new?back=%2Fevents
//       Expenses  /income/new?back=%2Fexpenses  /expenses/new?back=%2Fexpenses
//       Income    /income/new?back=%2Fincome    /expenses/new?back=%2Fincome
//     For the later pages (not tested here), e.g. an event page at
//     /events/pretend-event-shelf would give
//       /income/new?event=pretend-event-shelf&back=%2Fevents%2Fpretend-event-shelf
//     and a stream page with both would put event before stream before back.
//
// B5. Following a link is a client-side move (no reload, so entries in
//     memory survive) to the form, which then shows its own heading.
//
// B6. Round trips. Saving the form returns to the page "+ Add" was on (the
//     forms already follow a safe ?back=, T1.12/T1.13), and Home's totals
//     include the new entry. Hand-worked amounts (AUD cents):
//       Home → Add income, Online sales $25, Card        → 2500 → "Income $25.00"
//       Home → Add expense, Software $9.95                → 995  → "Expenses $9.95"
//       /expenses → Add expense, Printing $23.50          → 2350 → "Expenses $23.50"
//       /events → Add income, Sales at events,
//                 cash $100 + card $250.50                → 10000 + 25050 = 35050
//                                                         → "Income $350.50"
//       /income → Add income, Commissions $80, Bank transfer → 8000 → "Income $80.00"
//     (CHANGED (T1.18): the Home lines were the old "today" wording.)
//
// B7. Size and reach (guide §19, WCAG 2.5.8, 1.4.4, 1.4.10).
//     - "+ Add", "Add income" and "Add expense" are each at least 44×44 CSS px
//       (their own box) on every page.
//     - On a phone at 390×844, "+ Add" is fully on screen without scrolling
//       (scrollY is 0) and ends above the nav's top edge, on all four pages.
//     - On a phone at 320×568 with 200% text, on all four pages: no sideways
//       scroll with the group closed or open; all three controls stay inside
//       0–320 px and at least 44×44 px; Tab from "+ Add" to each link leaves
//       the focused link fully on screen and not overlapping the nav; and a
//       tap on "Add expense" opens the form.
//
// B8. No uncaught errors and no React hydration errors during any test
//     (fixture below, same as the form specs).
//
// ═══ T1.19: the small round button, bottom right (test engineer's reading
//     of the card, docs/stages/stage-01.md T1.19; numbers worked by hand) ════
//
// The pages (P6): Home /, /events, /expenses, /income, an event page
// /events/pretend-event-comic-con (event pre-fill) and a stream page
// /income/online-sales (stream pre-fill).
// "Window right edge" = document.documentElement.clientWidth (a fixed
// element's containing block; excludes a desktop scrollbar). "Window bottom"
// = window.innerHeight. Chromium in Playwright has no safe-area insets, so
// env(safe-area-inset-*) is 0 and max(1rem, env(...)) is exactly 1rem:
// 16 px at 100% text, 32 px at 200% text. Tolerance 1 px everywhere.
//
// B9. Look (on every P6 page, phone and desktop):
//     - a circle: width >= 56 px at 100% text (card: "at least 56px"), never
//       under 48 px (also at 320x568 and 200% text); |width - height| <= 1;
//       each computed corner radius >= width/2 - 0.5 (so it really is round);
//     - filled indigo: the computed background colour, turned into sRGB with
//       a 1x1 canvas, has an HSL hue between 230 and 260 degrees and HSV
//       saturation >= 0.4 (Tailwind indigo-500..950 sit at about 240-248;
//       blue-600 is about 221 and violet-600 about 265, both outside);
//     - its glyph is white (computed `color` rgb(255, 255, 255)) and the
//       white-on-background contrast is >= 4.5:1 (WCAG 1.4.3, the "+" is the
//       button's only visible label), in light AND dark colour schemes;
//     - a shadow: computed box-shadow is not "none";
//     - name exactly "Add" from aria-label="Add", closed AND open; every
//       visible text character and every <svg>/<img> inside the button sits
//       inside an aria-hidden="true" element, and at least one rendered
//       aria-hidden element (the glyph) is there. Visible text while closed
//       is "+" or nothing (an icon); while open "+", "×" or nothing.
// B10. Position while the tabs are pinned (phone 390x844, desktop 1280x800,
//     every P6 page, page not scrolled): right edge = clientWidth - 16;
//     bottom = nav top - 16 ("1rem above them"), so it never covers a tab.
//     It floats: on every P6 page made long (a 150vh block added before the
//     AddButton, see makeLong), after scrolling 300 px its box is exactly
//     where it was (0.5 px).
// B11. Position while the tabs are un-pinned (phone 390x844 at 200% text:
//     data-nav-pinned="false", app-shell claim 15; nav about 257 px = 30.5%
//     of 844): on a page made long (a 150vh block added before the
//     AddButton, so the nav starts below the window), at the top of the
//     page, bottom = innerHeight - 32 and right edge = clientWidth - 32
//     (max(1rem, 0) at a 32 px rem), clear of the nav. Scrolled to the very bottom (the nav is now on screen, in the
//     page flow), it is still fully on screen and its box does NOT intersect
//     the nav's box: "never covering a tab" and the Done-when "with the tabs
//     un-pinned it doesn't overlap the tabs either". (See QUESTIONS in the
//     report: the card's literal "max(1rem, safe-area) from the window
//     bottom" would sit ON the nav here; app-shell claim 14's "end of the
//     page isn't hidden behind the nav" and its "each nav link can be tapped"
//     already demand the same.)
//     ADDED (T1.19 review): scrolled to the very bottom, its bottom is the
//     nav's top − 16 (the same 16 px gap as when pinned). And the button must
//     settle at innerHeight − 32 WITHOUT a scroll when the tabs switch from
//     pinned to un-pinned: (a) every P6 page made long, then text 200%;
//     (b) /income, long by itself, then text 200%; (c) the other order: 200%
//     on Home (already un-pinned), then a client-side move to /income.
// B11b. ADDED (T1.19 review): un-pinned (phone 390x844, 200% text), Tab
//     through every focusable element in <main> (with the 12 B14 fillers)
//     never leaves the focused element intersecting the button (WCAG 2.4.11).
//     ADDED (T1.19 review round 2): the same with a 1200 px plain block
//     before each of 6 fillers, so every Tab lands on a control that starts
//     below the window; and the convention's page with the owner's example,
//     no fillers.
// B11c. ADDED (T1.19 review round 2): phone, pinned, 390x844. With an
//     ordinary link scrolled level with the button (not under the circle),
//     a tap on its left side, and a slow press (pointer down, 150 ms, up),
//     each open that link's page.
// B12. At the end of the content (every P6 page): with the group closed the
//     button is the LAST focusable element in <main>, and every rendered
//     element in <main> that isn't part of the AddButton (the button, the
//     group named by aria-controls, their ancestors and descendants) comes
//     BEFORE the button in document order.
// B13. Opening (every P6 page; at the project's own size AND on the phone at
//     320x568 with 200% text): each link is fully inside the window
//     (0..clientWidth, 0..innerHeight) without scrolling, at least 44 px
//     tall, ends at or above the button's top (bottom <= button top), and is
//     right-aligned with the circle (link right edge = button right edge,
//     1 px). The two links are a stack: their boxes don't overlap and one is
//     above the other. "Just above": the gap between the lower link's bottom
//     and the button's top is 0..2rem (32 px at 100%, 64 px at 200%).
// B14. Never hides content (every P6 page, seeded with the owner's example
//     so lists are long; at the project's own size AND with the window only
//     360 px high, where every page scrolls (Home is the shortest: about
//     330 px of content and padding even with T1.14's 24 px bottom padding,
//     more than the 295 px above the tabs) and the tabs stay pinned
//     (65 <= 25% of 360 = 90)):
//     scrolled to the very bottom, no rendered element in <main> other than
//     the AddButton's own parts intersects the button's box (more than 1 px
//     each way). At 360 px the test first checks the page really scrolls.
//     Also: pressing Tab through every focusable element in <main> (not the
//     AddButton's own) never leaves the focused element overlapping the
//     button (WCAG 2.4.11; the browser must scroll focus clear of it, as
//     scroll-padding does for the nav). Some pages have no focusable content
//     besides Add, so that test first adds 12 plain 3rem buttons at the end
//     of the content, before the AddButton (as app-shell claim 15 does).
//
// The device clock is frozen at 2026-06-30T15:30:00Z: 01:30 on 1 July in
// Australia/Sydney, so today on the device is 2026-07-01 and both forms'
// Date fields default to it, the same date Home's totals use.

import { expect, test as base, type Locator, type Page } from "@playwright/test";
// Type-only imports (erased at run time): the seam takes the store's own input types (T1.19 B14).
import type { ExpenseInput, IncomeInput } from "../src/lib/entries";

// ---------- fixed facts ----------

const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";

// CHANGED (T1.19): was "+ Add" (B2).
const ADD_BUTTON = "Add";
const ADD_INCOME = "Add income";
const ADD_EXPENSE = "Add expense";

const MIN_TAP_TARGET_PX = 44;
const EDGE_TOLERANCE_PX = 1;
const NARROW = { width: 320, height: 568 } as const;

/** The four pages with "+ Add" now, and their exact link addresses (B4), by hand. */
const PAGES = [
  {
    name: "Home",
    path: "/",
    heading: "Home",
    incomeHref: "/income/new?back=%2F",
    expenseHref: "/expenses/new?back=%2F",
  },
  {
    name: "Events",
    path: "/events",
    heading: "Events",
    incomeHref: "/income/new?back=%2Fevents",
    expenseHref: "/expenses/new?back=%2Fevents",
  },
  {
    name: "Expenses",
    path: "/expenses",
    heading: "Expenses",
    incomeHref: "/income/new?back=%2Fexpenses",
    expenseHref: "/expenses/new?back=%2Fexpenses",
  },
  {
    name: "Income",
    path: "/income",
    heading: "Income",
    incomeHref: "/income/new?back=%2Fincome",
    expenseHref: "/expenses/new?back=%2Fincome",
  },
] as const;

type AppPage = (typeof PAGES)[number];

const HOME = PAGES[0];
const EVENTS = PAGES[1];
const EXPENSES = PAGES[2];
const INCOME = PAGES[3];

// ---------- fixture: no uncaught errors, no hydration errors (B8) ----------

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
      // Never let a wrong address reach another host.
      await page.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => route.abort());
      await use(problems);
      expect(problems, "uncaught or hydration errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

// An Australian device in Sydney.
test.use({ locale: "en-AU", timezoneId: SYDNEY });

// ---------- helpers ----------

function main(page: Page): Locator {
  return page.getByRole("main");
}

function mainNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Main", exact: true });
}

function addButton(page: Page): Locator {
  return main(page).getByRole("button", { name: ADD_BUTTON, exact: true });
}

function incomeLink(page: Page): Locator {
  return main(page).getByRole("link", { name: ADD_INCOME, exact: true });
}

function expenseLink(page: Page): Locator {
  return main(page).getByRole("link", { name: ADD_EXPENSE, exact: true });
}

function heading(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}

// (REMOVED (T1.18): exactText, whose only users were the old "today" lines;
// expectHomeLine below replaces them.)

/**
 * CHANGED (T1.18): Home's "This month" section (home.spec.ts H3) has a line
 * whose rendered text, whitespace collapsed, is exactly `text` (e.g.
 * "Income $25.00"). Replaces the old exact "Today: $X from N sales" element.
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

/** Taps on a touch device (the phone project), clicks otherwise. */
async function press(locator: Locator, hasTouch: boolean): Promise<void> {
  await expect(locator).toBeVisible();
  if (hasTouch) await locator.tap();
  else await locator.click();
}

function touch(testInfo: { project: { use: { hasTouch?: boolean } } }): boolean {
  return !!testInfo.project.use.hasTouch;
}

/** Waits for the page to have hydrated, using the nav's --nav-h (app-shell claim 15). */
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

/** Opens the group with a tap or click, and checks it opened. */
async function openGroup(page: Page, hasTouch: boolean): Promise<void> {
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "false");
  await press(addButton(page), hasTouch);
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
}

/** Checks the group is closed: aria-expanded="false" and neither link in the accessibility tree. */
async function expectClosed(page: Page): Promise<void> {
  await expect(addButton(page)).toHaveAttribute("aria-expanded", "false");
  await expect(incomeLink(page)).toHaveCount(0);
  await expect(expenseLink(page)).toHaveCount(0);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches a full URL on THIS server whose path is exactly `path`, with no query. */
function urlOnThisServer(page: Page, path: string): RegExp {
  const origin = new URL(page.url()).origin;
  return new RegExp(`^${escapeRegExp(origin)}${escapeRegExp(path)}$`);
}

/** The current address, decoded (path and query pairs), so percent-encoding choices don't matter. */
function decodedAddress(page: Page): { path: string; query: [string, string][] } {
  const u = new URL(page.url());
  return { path: u.pathname, query: Array.from(u.searchParams.entries()) };
}

/** Puts a marker on `window`. It survives a client-side move and is gone after a reload. */
async function setMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__t114SameDocument = true;
  });
}

async function markerStillThere(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as Record<string, unknown>).__t114SameDocument === true);
}

/** Waits until a form is ready: hydrated and its Date field holds a date (T1.7 F3, T1.12 I3). */
async function waitForForm(page: Page): Promise<void> {
  await waitForHydration(page);
  await expect(main(page).getByLabel("Date", { exact: true })).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
}

/** Presses Save on the form in <main>. */
async function save(page: Page, hasTouch: boolean): Promise<void> {
  await press(main(page).getByRole("button", { name: "Save", exact: true }), hasTouch);
}

/** Goes to Home with the bottom navigation (a client-side move) and checks the heading. */
async function goHomeByNav(page: Page, hasTouch: boolean): Promise<void> {
  await press(mainNav(page).getByRole("link", { name: "Home", exact: true }), hasTouch);
  await expect(page).toHaveURL(urlOnThisServer(page, "/"));
  await expect(heading(page)).toHaveText("Home");
}

/** Opens "+ Add" and follows one of its links, checking it was a client-side move to that form. */
async function followLink(
  page: Page,
  which: "income" | "expense",
  from: AppPage,
  hasTouch: boolean,
): Promise<void> {
  await openGroup(page, hasTouch);
  await setMarker(page);
  await press(which === "income" ? incomeLink(page) : expenseLink(page), hasTouch);
  await expect
    .poll(() => decodedAddress(page), { message: "address after following the link" })
    .toEqual({ path: which === "income" ? "/income/new" : "/expenses/new", query: [["back", from.path]] });
  await expect(heading(page)).toHaveText(which === "income" ? "Add income" : "Add expense");
  expect(await markerStillThere(page), "following the link didn't reload the page").toBe(true);
  await waitForForm(page);
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const b = await locator.boundingBox();
  expect(b, "element has a layout box (is rendered)").not.toBeNull();
  return b!;
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

/** Page's scrollable width vs its visible width. */
function horizontalOverflow(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/** The focused element's text, or null. */
function focusedText(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    return (el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
  });
}

/** Where the focused element is, against the screen and the nav. */
function focusedPlace(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const nav = document.querySelector('nav[aria-label="Main"]');
    if (!el || !nav) return null;
    const r = el.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    return {
      text: (el.innerText ?? "").replace(/\s+/g, " ").trim(),
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
}

// ═══ B1. Where it is ════════════════════════════════════════════════════════

test.describe('T1.14: "+ Add" is on Home, Events, Expenses and Income', () => {
  for (const p of PAGES) {
    test(`${p.name} (${p.path}) has exactly one visible "Add" button (CHANGED (T1.19): was "+ Add")`, async ({ page }) => {
      await open(page, p.path);
      await expect(addButton(page)).toHaveCount(1);
      await expect(addButton(page)).toBeVisible();
    });

    test(`on ${p.name}, "Add" comes after the h1 in the page and its top is at or below the h1's bottom`, async ({
      page,
    }) => {
      await open(page, p.path);
      // CHANGED (T1.19): the button is found by its locator (name "Add"), not
      // by matching its text in the page, because its text is now just "+".
      await expect(addButton(page)).toHaveCount(1);
      const button = await addButton(page).elementHandle();
      const follows = await heading(page).evaluate(
        (h1, b) => !!b && (h1.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        button,
      );
      expect(follows, '"Add" follows the h1 in document order').toBe(true);
      const h1 = await box(heading(page));
      const b = await box(addButton(page));
      expect(b.y, `"Add" top vs the h1's bottom at ${(h1.y + h1.height).toFixed(1)} px`).toBeGreaterThanOrEqual(
        h1.y + h1.height - EDGE_TOLERANCE_PX,
      );
    });

    // REMOVED (T1.19): "directly under the h1", "the first focusable element
    // in <main>" and "full-width: as wide as <main>'s content box". The owner
    // moved the button to the bottom-right corner (DECISIONS.md, 2026-10-30).
    // Replaced by B12 ("at the end": the LAST focusable element, nothing
    // after it) and B9/B10 (a circle in the bottom-right corner), below.
  }

  test('Settings has no "Add" button (not one of the card\'s pages)', async ({ page }) => {
    await open(page, "/settings");
    await expect(page.getByRole("button", { name: ADD_BUTTON, exact: true })).toHaveCount(0);
  });

  test("it is one shared component: the button and both links have the same class on all four pages", async ({
    page,
  }, testInfo) => {
    const seen: { page: string; button: string | null; income: string | null; expense: string | null }[] = [];
    for (const p of PAGES) {
      await open(page, p.path);
      await openGroup(page, touch(testInfo));
      seen.push({
        page: p.name,
        button: await addButton(page).getAttribute("class"),
        income: await incomeLink(page).getAttribute("class"),
        expense: await expenseLink(page).getAttribute("class"),
      });
    }
    const home = seen[0];
    expect(home.button, "the button has a class").not.toBeNull();
    expect(home.income, "the income link has a class").not.toBeNull();
    expect(home.expense, "the expense link has a class").not.toBeNull();
    for (const s of seen) {
      expect({ button: s.button, income: s.income, expense: s.expense }, `classes on ${s.page}`).toEqual({
        button: home.button,
        income: home.income,
        expense: home.expense,
      });
    }
  });
});

// ═══ B2. Names, and Home's "+ Expense" is gone ═════════════════════════════

test.describe("T1.14: names", () => {
  for (const p of PAGES) {
    // CHANGED (T1.19): was "a <button> whose visible text is exactly '+ Add'".
    // The name now comes from aria-label="Add" and the "+" is aria-hidden (B9);
    // the glyph checks are in "T1.19: look" below.
    test(`on ${p.name}, "Add" is a <button> with aria-label exactly "Add" and accessible name exactly "Add"`, async ({
      page,
    }) => {
      await open(page, p.path);
      expect(await addButton(page).evaluate((el) => el.tagName)).toBe("BUTTON");
      await expect(addButton(page)).toHaveAttribute("aria-label", ADD_BUTTON);
      await expect(addButton(page)).toHaveAccessibleName(ADD_BUTTON);
    });

    test(`on ${p.name}, the opened links are named exactly "Add income" and "Add expense"`, async ({
      page,
    }, testInfo) => {
      await open(page, p.path);
      await openGroup(page, touch(testInfo));
      await expect(incomeLink(page)).toHaveCount(1);
      await expect(expenseLink(page)).toHaveCount(1);
      await expect(incomeLink(page)).toHaveAccessibleName(ADD_INCOME);
      await expect(expenseLink(page)).toHaveAccessibleName(ADD_EXPENSE);
    });
  }

  test('Home has no link or button named "+ Expense" any more (CHANGED (T1.14): "+ Add" replaces it)', async ({
    page,
  }) => {
    await open(page, "/");
    await expect(page.getByRole("link", { name: /^\s*\+\s*Expense\s*$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^\s*\+\s*Expense\s*$/i })).toHaveCount(0);
  });

  test("with the group closed, Home's <main> has no visible link to either form", async ({ page }) => {
    await open(page, "/");
    const formLinks = await main(page)
      .getByRole("link")
      .evaluateAll((links) =>
        links
          .map((a) => new URL((a as HTMLAnchorElement).href).pathname)
          .filter((path) => path === "/expenses/new" || path === "/income/new"),
      );
    expect(formLinks).toEqual([]);
  });
});

// ═══ B3. A disclosure ═══════════════════════════════════════════════════════

test.describe("T1.14: closed at start", () => {
  for (const p of PAGES) {
    test(`on ${p.name}, "Add" starts with aria-expanded="false" and neither link in the accessibility tree`, async ({
      page,
    }) => {
      await open(page, p.path);
      await expectClosed(page);
    });

    test(`on ${p.name}, with the group closed, Tab from "Add" doesn't reach either link`, async ({ page }) => {
      await open(page, p.path);
      await addButton(page).focus();
      await page.keyboard.press("Tab");
      const text = await focusedText(page);
      expect([ADD_INCOME, ADD_EXPENSE], `focused after Tab: ${JSON.stringify(text)}`).not.toContain(text);
    });
  }
});

test.describe("T1.14: opening", () => {
  for (const p of PAGES) {
    test(`on ${p.name}, a tap or click sets aria-expanded="true" and shows both links`, async ({ page }, testInfo) => {
      await open(page, p.path);
      await press(addButton(page), touch(testInfo));
      await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
      await expect(incomeLink(page)).toBeVisible();
      await expect(expenseLink(page)).toBeVisible();
    });
  }

  test("Enter on the focused button opens the group", async ({ page }) => {
    await open(page, "/");
    await addButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
    await expect(incomeLink(page)).toBeVisible();
    await expect(expenseLink(page)).toBeVisible();
  });

  test("Space on the focused button opens the group", async ({ page }) => {
    await open(page, "/");
    await addButton(page).focus();
    await page.keyboard.press("Space");
    await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
    await expect(incomeLink(page)).toBeVisible();
    await expect(expenseLink(page)).toBeVisible();
  });

  test("when open, aria-controls names an element with role group holding exactly the two links, income first", async ({
    page,
  }, testInfo) => {
    await open(page, "/");
    await openGroup(page, touch(testInfo));
    const id = await addButton(page).getAttribute("aria-controls");
    expect(id, "aria-controls is set").toBeTruthy();
    expect(id!.trim(), "aria-controls is one id").not.toMatch(/\s/);
    const group = page.locator(`[id="${id}"]`);
    await expect(group).toHaveCount(1);
    await expect(group).toHaveRole("group");
    const names = await group.getByRole("link").evaluateAll((links) =>
      links.map((a) => (a as HTMLElement).innerText.replace(/\s+/g, " ").trim()),
    );
    expect(names).toEqual([ADD_INCOME, ADD_EXPENSE]);
  });

  test('when open, Tab from "Add" reaches "Add income" and then "Add expense"', async ({ page }) => {
    await open(page, "/");
    await addButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(incomeLink(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(expenseLink(page)).toBeFocused();
  });
});

test.describe("T1.14: closing", () => {
  test('Escape closes the group and focus returns to "Add"', async ({ page }) => {
    await open(page, "/");
    await addButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expectClosed(page);
    await expect(addButton(page)).toBeFocused();
  });

  test('Escape with focus on "Add expense" closes the group and focus returns to "Add"', async ({ page }) => {
    await open(page, "/");
    await addButton(page).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(expenseLink(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expectClosed(page);
    await expect(addButton(page)).toBeFocused();
  });

  for (const p of PAGES) {
    test(`on ${p.name}, a tap or click outside (on the heading) closes the group`, async ({ page }, testInfo) => {
      await open(page, p.path);
      await openGroup(page, touch(testInfo));
      await press(heading(page), touch(testInfo));
      await expectClosed(page);
    });
  }

  test('pressing "Add" again closes the group', async ({ page }, testInfo) => {
    await open(page, "/");
    await openGroup(page, touch(testInfo));
    await press(addButton(page), touch(testInfo));
    await expectClosed(page);
  });

  test("opened with a mouse click, then focus moved to <body>: Escape still closes it (T1.15, from the T1.14 review)", async ({
    page,
  }) => {
    await open(page, "/");
    await addButton(page).click();
    await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(await page.evaluate(() => document.activeElement === document.body), "focus is on <body>").toBe(true);
    await page.keyboard.press("Escape");
    await expectClosed(page);
  });

  test("leaving a page resets it: opened on Home, then Events and back to Home with the tabs, it is closed (T1.15)", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await open(page, "/");
    await openGroup(page, t);
    await setMarker(page);
    await press(mainNav(page).getByRole("link", { name: "Events", exact: true }), t);
    await expect(heading(page)).toHaveText("Events");
    await expectClosed(page);
    await press(mainNav(page).getByRole("link", { name: "Home", exact: true }), t);
    await expect(heading(page)).toHaveText("Home");
    expect(await markerStillThere(page), "the moves were client-side").toBe(true);
    await expectClosed(page);
  });
});

// ═══ B4. Exact addresses ════════════════════════════════════════════════════

test.describe("T1.14: the links' addresses", () => {
  for (const p of PAGES) {
    test(`on ${p.name}, "Add income" links to exactly ${p.incomeHref}`, async ({ page }, testInfo) => {
      await open(page, p.path);
      await openGroup(page, touch(testInfo));
      await expect(incomeLink(page)).toHaveAttribute("href", p.incomeHref);
    });

    test(`on ${p.name}, "Add expense" links to exactly ${p.expenseHref}`, async ({ page }, testInfo) => {
      await open(page, p.path);
      await openGroup(page, touch(testInfo));
      await expect(expenseLink(page)).toHaveAttribute("href", p.expenseHref);
    });
  }
});

// ═══ B5. Following a link is a client-side move ═════════════════════════════

test.describe("T1.14: following a link", () => {
  for (const p of PAGES) {
    test(`on ${p.name}, "Add income" opens the income form with back=${p.path}, without reloading`, async ({
      page,
    }, testInfo) => {
      await open(page, p.path);
      await followLink(page, "income", p, touch(testInfo));
    });

    test(`on ${p.name}, "Add expense" opens the expense form with back=${p.path}, without reloading`, async ({
      page,
    }, testInfo) => {
      await open(page, p.path);
      await followLink(page, "expense", p, touch(testInfo));
    });
  }
});

// ═══ B6. Round trips ════════════════════════════════════════════════════════

test.describe("T1.14: round trips", () => {
  test("Home → Add income (Online sales, $25, Card) → Save lands on Home showing \"Income $25.00\" (CHANGED (T1.18))", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await open(page, HOME.path);
    await expectHomeLine(page, "Income $0.00"); // CHANGED (T1.18): was "Today: $0.00 from 0 sales"
    await followLink(page, "income", HOME, t);
    await main(page).getByRole("combobox", { name: "Income stream", exact: true }).selectOption({ label: "Online sales" });
    await main(page).getByRole("textbox", { name: "Amount", exact: true }).fill("25");
    await main(page)
      .getByRole("group", { name: "Payment method", exact: true })
      .getByRole("radio", { name: "Card", exact: true })
      .check();
    await save(page, t);
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await expect(heading(page)).toHaveText("Home");
    // 2500 cents.
    await expectHomeLine(page, "Income $25.00"); // CHANGED (T1.18): was "Today: $25.00 from 1 sale"
  });

  test("Home → Add expense (Software, $9.95) → Save lands on Home showing \"Expenses $9.95\" (CHANGED (T1.18))", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await open(page, HOME.path);
    await followLink(page, "expense", HOME, t);
    await main(page).getByLabel("Amount", { exact: true }).fill("9.95");
    await main(page).getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Software" });
    await save(page, t);
    await expect(page).toHaveURL(urlOnThisServer(page, "/"));
    await expect(heading(page)).toHaveText("Home");
    // 995 cents.
    await expectHomeLine(page, "Expenses $9.95"); // CHANGED (T1.18): was "Today's expenses: $9.95"
  });

  test("/expenses → Add expense (Printing, $23.50) → Save lands on /expenses, and Home shows \"Expenses $23.50\" (CHANGED (T1.18))", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await open(page, EXPENSES.path);
    await followLink(page, "expense", EXPENSES, t);
    await main(page).getByLabel("Amount", { exact: true }).fill("23.50");
    await main(page).getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Printing" });
    await save(page, t);
    await expect(page).toHaveURL(urlOnThisServer(page, "/expenses"));
    await expect(heading(page)).toHaveText("Expenses");
    await goHomeByNav(page, t);
    // 2350 cents.
    await expectHomeLine(page, "Expenses $23.50"); // CHANGED (T1.18): was "Today's expenses: $23.50"
  });

  test("/events → Add income (Sales at events, cash $100 + card $250.50) → Save lands on /events, and Home shows \"Income $350.50\" (CHANGED (T1.18))", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await open(page, EVENTS.path);
    await followLink(page, "income", EVENTS, t);
    await main(page).getByRole("combobox", { name: "Income stream", exact: true }).selectOption({ label: "Sales at events" });
    await main(page).getByRole("textbox", { name: "Cash", exact: true }).fill("100");
    await main(page).getByRole("textbox", { name: "Card", exact: true }).fill("250.50");
    await save(page, t);
    await expect(page).toHaveURL(urlOnThisServer(page, "/events"));
    await expect(heading(page)).toHaveText("Events");
    await goHomeByNav(page, t);
    // 10000 + 25050 = 35050 cents, two income rows.
    await expectHomeLine(page, "Income $350.50"); // CHANGED (T1.18): was "Today: $350.50 from 2 sales"
  });

  test("/income → Add income (Commissions, $80, Bank transfer) → Save lands on /income, and Home shows \"Income $80.00\" (CHANGED (T1.18))", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await open(page, INCOME.path);
    await followLink(page, "income", INCOME, t);
    await main(page).getByRole("combobox", { name: "Income stream", exact: true }).selectOption({ label: "Commissions" });
    await main(page).getByRole("textbox", { name: "Amount", exact: true }).fill("80");
    await main(page)
      .getByRole("group", { name: "Payment method", exact: true })
      .getByRole("radio", { name: "Bank transfer", exact: true })
      .check();
    await save(page, t);
    await expect(page).toHaveURL(urlOnThisServer(page, "/income"));
    await expect(heading(page)).toHaveText("Income");
    await goHomeByNav(page, t);
    // 8000 cents.
    await expectHomeLine(page, "Income $80.00"); // CHANGED (T1.18): was "Today: $80.00 from 1 sale"
  });

  test('after a round trip back to Home, "Add" is closed again', async ({ page }, testInfo) => {
    const t = touch(testInfo);
    await open(page, HOME.path);
    await followLink(page, "expense", HOME, t);
    await main(page).getByLabel("Amount", { exact: true }).fill("1");
    await main(page).getByRole("combobox", { name: "Category", exact: true }).selectOption({ label: "Phone" });
    await save(page, t);
    await expect(heading(page)).toHaveText("Home");
    await expectClosed(page);
  });
});

// ═══ B7. Size and reach ═════════════════════════════════════════════════════

test.describe("T1.14: tap targets are at least 44×44 px", () => {
  for (const p of PAGES) {
    for (const [label, find] of [
      [ADD_BUTTON, addButton],
      [ADD_INCOME, incomeLink],
      [ADD_EXPENSE, expenseLink],
    ] as const) {
      test(`on ${p.name}, "${label}" is at least 44×44 px`, async ({ page }, testInfo) => {
        await open(page, p.path);
        await openGroup(page, touch(testInfo));
        const b = await box(find(page));
        expect(b.width, "width in CSS px").toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
        expect(b.height, "height in CSS px").toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      });
    }
  }
});

test.describe("T1.14: on a phone at 390×844", () => {
  for (const p of PAGES) {
    test(`on a phone, on ${p.name}, "Add" is fully on screen without scrolling and above the nav`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      await open(page, p.path);
      expect(await page.evaluate(() => window.scrollY), "the page hasn't scrolled").toBe(0);
      await expect(addButton(page)).toBeInViewport({ ratio: 1 });
      const b = await box(addButton(page));
      const navTop = (await box(mainNav(page))).y;
      expect(b.y, "top (px)").toBeGreaterThanOrEqual(0);
      expect(b.y + b.height, `bottom (px) vs the nav's top at ${navTop.toFixed(1)} px`).toBeLessThanOrEqual(
        navTop + EDGE_TOLERANCE_PX,
      );
    });
  }
});

test.describe("T1.14: on a phone at 320×568 with 200% text", () => {
  /** Opens a page at 320×568 and 200% text (root font 32px). */
  async function openNarrowBig(page: Page, path: string): Promise<void> {
    await page.setViewportSize(NARROW);
    await open(page, path);
    await setTextSize(page, 200, "32px");
    await nextFrame(page);
  }

  for (const p of PAGES) {
    test(`on a phone at 320×568 and 200% text, ${p.name} doesn't scroll sideways with the group closed`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openNarrowBig(page, p.path);
      await expectClosed(page);
      const { scrollWidth, clientWidth } = await horizontalOverflow(page);
      expect(clientWidth).toBe(NARROW.width);
      expect(scrollWidth, "scrollable width must not exceed the page width").toBeLessThanOrEqual(clientWidth);
    });

    test(`on a phone at 320×568 and 200% text, ${p.name} doesn't scroll sideways with the group open`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openNarrowBig(page, p.path);
      await openGroup(page, true);
      const { scrollWidth, clientWidth } = await horizontalOverflow(page);
      expect(clientWidth).toBe(NARROW.width);
      expect(scrollWidth, "scrollable width must not exceed the page width").toBeLessThanOrEqual(clientWidth);
    });

    test(`on a phone at 320×568 and 200% text, on ${p.name}, all three controls are at least 44×44 px and inside 0–320 px`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openNarrowBig(page, p.path);
      await openGroup(page, true);
      for (const [label, find] of [
        [ADD_BUTTON, addButton],
        [ADD_INCOME, incomeLink],
        [ADD_EXPENSE, expenseLink],
      ] as const) {
        const b = await box(find(page));
        expect(b.width, `"${label}" width`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
        expect(b.height, `"${label}" height`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
        expect(b.x, `"${label}" left edge`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
        expect(b.x + b.width, `"${label}" right edge`).toBeLessThanOrEqual(NARROW.width + EDGE_TOLERANCE_PX);
      }
    });

    test(`on a phone at 320×568 and 200% text, on ${p.name}, Tab to each opened link leaves it fully on screen and clear of the nav`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openNarrowBig(page, p.path);
      await addButton(page).focus();
      await page.keyboard.press("Enter");
      await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
      for (const name of [ADD_INCOME, ADD_EXPENSE]) {
        await page.keyboard.press("Tab");
        await nextFrame(page);
        const s = await focusedPlace(page);
        expect(s?.text, "focused element").toBe(name);
        const where = `"${name}" at top ${s!.top.toFixed(1)}, bottom ${s!.bottom.toFixed(1)}`;
        expect(s!.top, `${where}: top on screen`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
        expect(s!.bottom, `${where}: bottom on screen`).toBeLessThanOrEqual(s!.vh + EDGE_TOLERANCE_PX);
        expect(s!.left, `${where}: left on screen`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
        expect(s!.right, `${where}: right on screen`).toBeLessThanOrEqual(s!.vw + EDGE_TOLERANCE_PX);
        const overlapsNav =
          s!.bottom > s!.navTop + EDGE_TOLERANCE_PX && s!.top < s!.navBottom - EDGE_TOLERANCE_PX;
        expect(overlapsNav, `${where} overlaps the nav (${s!.navTop.toFixed(1)}–${s!.navBottom.toFixed(1)})`).toBe(false);
      }
    });

    test(`on a phone at 320×568 and 200% text, on ${p.name}, tapping "Add expense" opens the expense form`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openNarrowBig(page, p.path);
      await openGroup(page, true);
      await expenseLink(page).scrollIntoViewIfNeeded();
      await expenseLink(page).tap();
      await expect
        .poll(() => decodedAddress(page), { message: "address after tapping Add expense" })
        .toEqual({ path: "/expenses/new", query: [["back", p.path]] });
      await expect(heading(page)).toHaveText("Add expense");
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// T1.19: the small round button, bottom right (B9–B14 in the header)
// ═══════════════════════════════════════════════════════════════════════════

const COMIC_CON_ID = "pretend-event-comic-con";
const ONLINE_SALES_ID = "online-sales";

/** P6: every page that shows the button (the card's list). */
const P6 = [
  { name: "Home", path: "/" },
  { name: "Events", path: "/events" },
  { name: "Expenses", path: "/expenses" },
  { name: "Income", path: "/income" },
  { name: "the event page (Pretend comic convention)", path: `/events/${COMIC_CON_ID}` },
  { name: "the stream page (Online sales)", path: `/income/${ONLINE_SALES_ID}` },
] as const;

const MIN_CIRCLE_PX = 56; // card: "at least 56px across"
const NEVER_UNDER_PX = 48; // card: "never under 48px"
const PHONE = { width: 390, height: 844 } as const;
const SHORT_WINDOW_HEIGHT = 360; // tabs stay pinned (65 px <= 25% of 360 = 90 px) and every P6 page scrolls
const MIN_CONTRAST = 4.5;
// Indigo, as an HSL hue (degrees). Tailwind v4 indigo-500 rgb(97,95,255) → 240.7,
// indigo-700 rgb(67,45,215) → 247.8, indigo-900 rgb(49,44,133) → 243.4 (worked by hand:
// hue = 60 × ((R − G) / (max − min) + 4) when B is the largest). blue-600 rgb(21,93,252)
// → 221.3 and violet-600 rgb(127,34,254) → 265.4 fall outside.
const INDIGO_HUE = { min: 230, max: 260 } as const;
const MIN_SATURATION = 0.4;

// The owner's example (same data as expenses.spec.ts OWNER_COSTS/OWNER_INCOME),
// seeded so the list pages, the event page and the stream page are long.
const OWNER_COSTS: readonly ExpenseInput[] = [
  { date: "2026-06-24", amountCents: 29900, categoryId: "accommodation", supplier: "Harbour Hotel", eventId: COMIC_CON_ID },
  { date: "2026-06-22", amountCents: 50000, categoryId: "stall-table-fees", supplier: "Comic con organisers", eventId: COMIC_CON_ID },
  { date: "2026-06-23", amountCents: 20000, categoryId: "meals", eventId: COMIC_CON_ID },
  { date: "2026-06-20", amountCents: 12000, categoryId: "printing", supplier: "Zine printer" },
  { date: "2026-06-30", amountCents: 1500, categoryId: "software", supplier: "Adobe", streamId: ONLINE_SALES_ID },
];
const OWNER_INCOME: readonly IncomeInput[] = [
  { date: "2026-06-22", streamId: "sales-at-events", amountCents: 40000, paymentMethod: "cash", eventId: COMIC_CON_ID },
  { date: "2026-06-22", streamId: "sales-at-events", amountCents: 60000, paymentMethod: "card", eventId: COMIC_CON_ID },
  { date: "2026-06-23", streamId: "sales-at-events", amountCents: 80000, paymentMethod: "cash", eventId: COMIC_CON_ID },
  { date: "2026-06-23", streamId: "sales-at-events", amountCents: 120000, paymentMethod: "card", eventId: COMIC_CON_ID },
  { date: "2026-06-24", streamId: "sales-at-events", amountCents: 50000, paymentMethod: "cash", eventId: COMIC_CON_ID },
  { date: "2026-06-24", streamId: "sales-at-events", amountCents: 100000, paymentMethod: "card", eventId: COMIC_CON_ID },
  { date: "2026-06-30", streamId: ONLINE_SALES_ID, amountCents: 12345, paymentMethod: "online", notes: "Etsy order 1042" },
];

/** Waits for the test seam (T1.6) and adds the owner's example through it. */
async function seedOwnerExample(page: Page): Promise<void> {
  await page
    .waitForFunction(() => typeof (window as unknown as Record<string, { addIncome?: unknown } | undefined>).__bentoTest?.addIncome === "function", undefined, {
      timeout: 10_000,
    })
    .catch(() => {
      throw new Error("test seam window.__bentoTest never appeared (see test-seam.spec.ts)");
    });
  await page.evaluate(
    ({ income, expenses }) => {
      const hook = (window as unknown as Record<string, { addIncome(i: unknown): void; addExpense(e: unknown): void }>)
        .__bentoTest;
      for (const i of income) hook.addIncome(i);
      for (const e of expenses) hook.addExpense(e);
    },
    { income: OWNER_INCOME as IncomeInput[], expenses: OWNER_COSTS as ExpenseInput[] },
  );
  await nextFrame(page);
}

type Rect = { top: number; bottom: number; left: number; right: number; width: number; height: number };

function rectOf(b: { x: number; y: number; width: number; height: number }): Rect {
  return { top: b.y, bottom: b.y + b.height, left: b.x, right: b.x + b.width, width: b.width, height: b.height };
}

/** True when two boxes share more than 1 px both across and down. */
function intersects(a: Rect, b: Rect): boolean {
  const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return across > EDGE_TOLERANCE_PX && down > EDGE_TOLERANCE_PX;
}

function fmt(r: Rect): string {
  return `top ${r.top.toFixed(1)}, bottom ${r.bottom.toFixed(1)}, left ${r.left.toFixed(1)}, right ${r.right.toFixed(1)}`;
}

/** The window as a fixed element sees it, the root font size and the nav's pinned state. */
function windowFacts(page: Page) {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    innerHeight: window.innerHeight,
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
    pinned: document.documentElement.dataset.navPinned ?? null,
  }));
}

async function buttonRect(page: Page): Promise<Rect> {
  return rectOf(await box(addButton(page)));
}

async function navRect(page: Page): Promise<Rect> {
  return rectOf(await box(mainNav(page)));
}

/** Waits until BottomNav has decided the nav is pinned ("true") or not ("false"). */
async function expectPinned(page: Page, pinned: "true" | "false"): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.navPinned ?? null), {
      message: `html[data-nav-pinned] should be "${pinned}"`,
    })
    .toBe(pinned);
  await nextFrame(page);
}

/** Scrolls the window, and anything inside that scrolls, to the very bottom (as app-shell claim 14). */
async function scrollToVeryBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const el of [document.scrollingElement, ...Array.from(document.querySelectorAll("*"))]) {
      if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await nextFrame(page);
}

/**
 * Rendered elements in <main> that intersect the button, other than the
 * AddButton's own parts (the button, the group its aria-controls names, and
 * their ancestors and descendants).
 */
async function contentUnderButton(page: Page): Promise<string[]> {
  const button = await addButton(page).elementHandle();
  return main(page).evaluate((m, b) => {
    if (!b) return ["(no button)"];
    const id = b.getAttribute("aria-controls");
    const group = id ? document.getElementById(id) : null;
    const part = (el: Element) =>
      el === b || el.contains(b) || b.contains(el) || (!!group && (el === group || el.contains(group) || group.contains(el)));
    const br = b.getBoundingClientRect();
    const hits: string[] = [];
    for (const el of Array.from(m.querySelectorAll("*"))) {
      if (part(el) || el.getClientRects().length === 0) continue;
      const r = el.getBoundingClientRect();
      const across = Math.min(r.right, br.right) - Math.max(r.left, br.left);
      const down = Math.min(r.bottom, br.bottom) - Math.max(r.top, br.top);
      if (across > 1 && down > 1) {
        hits.push(
          `<${el.tagName.toLowerCase()}> "${((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 40)}" ` +
            `(top ${r.top.toFixed(1)}, bottom ${r.bottom.toFixed(1)}) vs button top ${br.top.toFixed(1)}, bottom ${br.bottom.toFixed(1)}`,
        );
      }
    }
    return hits;
  }, button);
}

/** Converts a CSS colour to sRGB 0–255 (and alpha) by painting it on a 1×1 canvas. */
function cssColoursToRgb(page: Page, colours: string[]): Promise<number[][]> {
  return page.evaluate((list) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    return list.map((css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "rgba(0, 0, 0, 0)";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    });
  }, colours);
}

function hslHue([r, g, b]: number[]): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return NaN;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function hsvSaturation([r, g, b]: number[]): number {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}

/** WCAG 2.x contrast ratio of two sRGB colours. */
function contrast(a: number[], b: number[]): number {
  const lum = ([r, g, bl]: number[]) => {
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The button's colours: its background and the colour of its aria-hidden glyph. */
async function buttonColours(page: Page): Promise<{ background: number[]; glyph: number[] }> {
  const [bgCss, glyphCss] = await addButton(page).evaluate((b) => {
    const glyph = b.querySelector('[aria-hidden="true"]');
    return [getComputedStyle(b).backgroundColor, glyph ? getComputedStyle(glyph).color : "rgba(0, 0, 0, 0)"];
  });
  const [background, glyph] = await cssColoursToRgb(page, [bgCss, glyphCss]);
  return { background, glyph };
}

/** Checks the button is a circle at least `minPx` across. */
async function expectCircle(page: Page, minPx: number): Promise<void> {
  const b = await box(addButton(page));
  expect(b.width, "width in CSS px").toBeGreaterThanOrEqual(minPx);
  expect(b.height, "height in CSS px").toBeGreaterThanOrEqual(minPx);
  expect(Math.abs(b.width - b.height), `width ${b.width} vs height ${b.height}`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  const radii = await addButton(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
  });
  for (const r of radii) {
    // A percentage (e.g. "50%") is of the box; anything else is a length in px.
    const px = r.trim().endsWith("%") ? (parseFloat(r) / 100) * b.width : parseFloat(r);
    expect(px, `corner radius "${r}" vs half the width ${(b.width / 2).toFixed(1)} px`).toBeGreaterThanOrEqual(
      b.width / 2 - 0.5,
    );
  }
}

/** Opens a page on the phone at 320×568 with 200% text (as B7). */
async function openNarrowBigText(page: Page, path: string): Promise<void> {
  await page.setViewportSize(NARROW);
  await open(page, path);
  await setTextSize(page, 200, "32px");
  await nextFrame(page);
}

/** Opens a page on the phone at 390×844 with 200% text, where the tabs are NOT pinned. */
async function openUnpinned(page: Page, path: string): Promise<void> {
  expect(page.viewportSize()).toEqual(PHONE);
  await open(page, path);
  await setTextSize(page, 200, "32px");
  await expectPinned(page, "false");
}

/**
 * B14 / B11b: adds 12 plain 3rem filler buttons at the end of the content
 * (before the AddButton), then presses Tab through every focusable element in
 * <main> other than the AddButton's own. After each press the focused
 * element must not intersect the button's box. Fails if Tab misses any.
 */
async function expectTabNeverUnderButton(
  page: Page,
  options: { fillers?: number; spacerPx?: number } = {},
): Promise<void> {
  // ADDED (T1.19 review round 2): `fillers` (default 12; 0 = only the page's
  // own controls) and `spacerPx` (a plain, non-focusable block that tall
  // before each filler, so Tab lands on a control that starts below the window).
  const fillers = options.fillers ?? 12;
  const spacerPx = options.spacerPx ?? 0;
  const button = await addButton(page).elementHandle();
  const count = await main(page).evaluate((m, { b, fillers, spacerPx }) => {
    if (!b) return 0;
    // Some pages have no focusable content besides Add (Home, /expenses, a
    // stream page), so, like app-shell claim 15's long page, put 12
    // ordinary 3rem buttons at the end of the content, just BEFORE the
    // AddButton (before main's child that holds it), so every page has
    // focusable content right down to the bottom.
    let holder: Element = b;
    while (holder.parentElement && holder.parentElement !== m) holder = holder.parentElement;
    for (let i = 1; i <= fillers; i++) {
      if (spacerPx > 0) {
        const spacer = document.createElement("div");
        spacer.setAttribute("data-t119-spacer", "");
        spacer.style.cssText = `display:block;height:${spacerPx}px`;
        m.insertBefore(spacer, holder);
      }
      const filler = document.createElement("button");
      filler.type = "button";
      filler.textContent = `Filler ${i}`;
      filler.style.cssText = "display:block;width:100%;height:3rem;margin:0.5rem 0";
      m.insertBefore(filler, holder);
    }
    const id = b.getAttribute("aria-controls");
    const group = id ? document.getElementById(id) : null;
    const part = (el: Element) =>
      el === b || el.contains(b) || b.contains(el) || (!!group && (el === group || el.contains(group) || group.contains(el)));
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const found = Array.from(m.querySelectorAll(selector)).filter(
      (el) => !part(el) && el.getClientRects().length > 0 && el.getAttribute("tabindex") !== "-1",
    );
    found.forEach((el, i) => el.setAttribute("data-t119-focus", String(i)));
    return found.length;
  }, { b: button, fillers, spacerPx });
  expect(count, `focusable elements in <main> besides Add (${fillers} fillers and the page's own)`).toBeGreaterThanOrEqual(
    Math.max(fillers, 1),
  );
  const reached = new Set<number>();
  const problems: string[] = [];
  for (let i = 0; i < count + 20 && reached.size < count; i++) {
    await page.keyboard.press("Tab");
    await nextFrame(page);
    const state = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.hasAttribute("data-t119-focus")) return null;
      const r = el.getBoundingClientRect();
      return {
        index: Number(el.getAttribute("data-t119-focus")),
        label: `${el.tagName.toLowerCase()} "${(el.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 30)}"`,
        rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height },
      };
    });
    if (state === null) continue;
    reached.add(state.index);
    const b = await buttonRect(page);
    if (intersects(state.rect, b)) problems.push(`${state.label} at ${fmt(state.rect)} is under the button at ${fmt(b)}`);
  }
  expect(reached.size, "focusable elements in <main> reached by Tab").toBe(count);
  expect(problems).toEqual([]);
}

/**
 * Makes the page long (as app-shell claim 15 does): puts a plain block one
 * window and a half tall at the end of the content, just BEFORE the AddButton
 * (before main's child that holds it), so an un-pinned nav starts below the window.
 */
async function makeLong(page: Page): Promise<void> {
  const button = await addButton(page).elementHandle();
  await main(page).evaluate((m, b) => {
    if (!b) return;
    let holder: Element = b;
    while (holder.parentElement && holder.parentElement !== m) holder = holder.parentElement;
    const filler = document.createElement("div");
    filler.setAttribute("data-t119-filler", "");
    filler.style.cssText = "display:block;height:150vh";
    m.insertBefore(filler, holder);
  }, button);
  await nextFrame(page);
  await nextFrame(page);
}

/**
 * B13: opens the group, without scrolling, and checks the stack: both links
 * inside the window, at least 44 px tall, above the button, right-aligned with
 * it, one above the other, the lower one 0–2rem above the button.
 */
async function expectStackAboveButton(page: Page, hasTouch: boolean): Promise<void> {
  const before = await windowFacts(page);
  await openGroup(page, hasTouch);
  await nextFrame(page);
  const after = await windowFacts(page);
  expect(after.scrollY, "opening the group doesn't scroll the page").toBe(before.scrollY);
  const button = await buttonRect(page);
  const links: [string, Rect][] = [
    [ADD_INCOME, rectOf(await box(incomeLink(page)))],
    [ADD_EXPENSE, rectOf(await box(expenseLink(page)))],
  ];
  for (const [name, r] of links) {
    const where = `"${name}" at ${fmt(r)}; window ${after.clientWidth}×${after.innerHeight}; button at ${fmt(button)}`;
    expect(r.left, `${where}: left inside the window`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(r.right, `${where}: right inside the window`).toBeLessThanOrEqual(after.clientWidth + EDGE_TOLERANCE_PX);
    expect(r.top, `${where}: top inside the window`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(r.bottom, `${where}: bottom inside the window`).toBeLessThanOrEqual(after.innerHeight + EDGE_TOLERANCE_PX);
    expect(r.height, `${where}: height`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    expect(r.bottom, `${where}: ends at or above the button's top`).toBeLessThanOrEqual(button.top + EDGE_TOLERANCE_PX);
    expect(Math.abs(r.right - button.right), `${where}: right edge lines up with the button's`).toBeLessThanOrEqual(
      EDGE_TOLERANCE_PX,
    );
  }
  const [a, b] = [links[0][1], links[1][1]];
  const stacked = a.bottom <= b.top + EDGE_TOLERANCE_PX || b.bottom <= a.top + EDGE_TOLERANCE_PX;
  expect(stacked, `the links are a stack, one above the other (income ${fmt(a)}; expense ${fmt(b)})`).toBe(true);
  const gap = button.top - Math.max(a.bottom, b.bottom);
  expect(gap, "gap between the lower link and the button (px)").toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
  expect(gap, `gap is at most 2rem (${2 * after.rootPx} px)`).toBeLessThanOrEqual(2 * after.rootPx + EDGE_TOLERANCE_PX);
}

// ═══ B9. Look ════════════════════════════════════════════════════════════════

test.describe("T1.19: look", () => {
  for (const p of P6) {
    test(`on ${p.name}, "Add" is a circle at least 56 px across`, async ({ page }) => {
      await open(page, p.path);
      await expectCircle(page, MIN_CIRCLE_PX);
    });

    test(`on ${p.name}, "Add" keeps the accessible name exactly "Add" while open`, async ({ page }, testInfo) => {
      await open(page, p.path);
      await openGroup(page, touch(testInfo));
      await expect(addButton(page)).toHaveCount(1);
      await expect(addButton(page)).toHaveAccessibleName(ADD_BUTTON);
      await expect(addButton(page)).toHaveAttribute("aria-label", ADD_BUTTON);
    });

    test(`on ${p.name}, everything "Add" shows is aria-hidden: a "+" closed, "+" or "×" open`, async ({
      page,
    }, testInfo) => {
      await open(page, p.path);
      const inspect = () =>
        addButton(page).evaluate((b) => {
          const hidden = (n: Node) => {
            for (let el = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement; el && el !== b.parentElement; el = el.parentElement) {
              if (el.getAttribute("aria-hidden") === "true") return true;
            }
            return false;
          };
          const exposed: string[] = [];
          const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
          for (let t = walker.nextNode(); t; t = walker.nextNode()) {
            if ((t.textContent ?? "").trim() !== "" && !hidden(t)) exposed.push(`text "${(t.textContent ?? "").trim()}"`);
          }
          for (const el of Array.from(b.querySelectorAll("svg, img"))) {
            if (!hidden(el)) exposed.push(`<${el.tagName.toLowerCase()}>`);
          }
          const glyphs = Array.from(b.querySelectorAll('[aria-hidden="true"]')).filter((el) => el.getClientRects().length > 0);
          return { exposed, glyphCount: glyphs.length, text: (b as HTMLElement).innerText.replace(/\s+/g, "") };
        });
      const closed = await inspect();
      expect(closed.exposed, "text or icons inside the button that aren't aria-hidden (closed)").toEqual([]);
      expect(closed.glyphCount, "rendered aria-hidden glyph elements (closed)").toBeGreaterThanOrEqual(1);
      expect(["+", ""], `visible text while closed: ${JSON.stringify(closed.text)}`).toContain(closed.text);
      await openGroup(page, touch(testInfo));
      const opened = await inspect();
      expect(opened.exposed, "text or icons inside the button that aren't aria-hidden (open)").toEqual([]);
      expect(opened.glyphCount, "rendered aria-hidden glyph elements (open)").toBeGreaterThanOrEqual(1);
      expect(["+", "×", ""], `visible text while open: ${JSON.stringify(opened.text)}`).toContain(opened.text);
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    test.describe(`${scheme} colour scheme`, () => {
      test.use({ colorScheme: scheme });

      test(`in the ${scheme} scheme, "Add" is filled indigo`, async ({ page }) => {
        await open(page, "/");
        const { background } = await buttonColours(page);
        expect(background[3], `background alpha of rgba(${background.join(", ")})`).toBe(255);
        const hue = hslHue(background);
        expect(hue, `hue of rgb(${background.slice(0, 3).join(", ")})`).toBeGreaterThanOrEqual(INDIGO_HUE.min);
        expect(hue, `hue of rgb(${background.slice(0, 3).join(", ")})`).toBeLessThanOrEqual(INDIGO_HUE.max);
        expect(hsvSaturation(background), "saturation").toBeGreaterThanOrEqual(MIN_SATURATION);
      });

      test(`in the ${scheme} scheme, the "+" on "Add" is white with at least 4.5:1 contrast`, async ({ page }) => {
        await open(page, "/");
        const { background, glyph } = await buttonColours(page);
        expect(glyph, "glyph colour (rgba)").toEqual([255, 255, 255, 255]);
        expect(contrast(glyph, background), `white on rgb(${background.slice(0, 3).join(", ")})`).toBeGreaterThanOrEqual(
          MIN_CONTRAST,
        );
      });
    });
  }

  test('"Add" has a shadow', async ({ page }) => {
    await open(page, "/");
    const shadow = await addButton(page).evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow, "computed box-shadow").not.toBe("none");
  });

  for (const p of P6) {
    test(`on a phone at 320×568 and 200% text, on ${p.name}, "Add" is still a circle at least 48 px across`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openNarrowBigText(page, p.path);
      await expectCircle(page, NEVER_UNDER_PX);
    });
  }
});

// ═══ B10. Position while the tabs are pinned ══════════════════════════════════

test.describe("T1.19: position while the tabs are pinned", () => {
  for (const p of P6) {
    test(`on ${p.name}, "Add" is 16 px from the window's right edge and its bottom is 16 px above the tabs`, async ({
      page,
    }) => {
      await open(page, p.path);
      await expectPinned(page, "true");
      const w = await windowFacts(page);
      expect(w.scrollY, "the page hasn't scrolled").toBe(0);
      expect(w.rootPx, "root font size (px)").toBe(16);
      const b = await buttonRect(page);
      const n = await navRect(page);
      // Right: clientWidth − max(1rem, 0) = clientWidth − 16.
      expect(Math.abs(b.right - (w.clientWidth - 16)), "distance from the expected right edge (px)").toBeLessThanOrEqual(
        EDGE_TOLERANCE_PX,
      );
      // Bottom: nav top − 1rem = nav top − 16.
      expect(Math.abs(b.bottom - (n.top - 16)), `bottom ${b.bottom.toFixed(1)} vs nav top ${n.top.toFixed(1)} − 16`).toBeLessThanOrEqual(
        EDGE_TOLERANCE_PX,
      );
      expect(b.bottom, "fully above the tabs").toBeLessThanOrEqual(n.top);
      expect(b.top, "top on screen").toBeGreaterThanOrEqual(0);
    });
  }

  for (const p of P6) {
    test(`on ${p.name} made long, "Add" stays put while the page scrolls`, async ({ page }) => {
      await open(page, p.path);
      await expectPinned(page, "true");
      await makeLong(page);
      const before = await buttonRect(page);
      const w = await windowFacts(page);
      expect(w.scrollHeight - w.innerHeight, "the page can scroll at least 300 px").toBeGreaterThanOrEqual(300);
      await page.evaluate(() => window.scrollTo(0, 300));
      await nextFrame(page);
      expect((await windowFacts(page)).scrollY, "scrolled").toBe(300);
      const after = await buttonRect(page);
      expect(Math.abs(after.top - before.top), `top before ${before.top}, after ${after.top}`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.right - before.right), `right before ${before.right}, after ${after.right}`).toBeLessThanOrEqual(
        0.5,
      );
    });
  }
});

// ═══ B11. Position while the tabs are un-pinned (very large text) ═════════════

test.describe("T1.19: position while the tabs are un-pinned (phone, 200% text)", () => {
  for (const p of P6) {
    test(`on a phone at 200% text, on ${p.name} made long, at the top of the page "Add" is 32 px from the window's bottom and right edges and clear of the tabs`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openUnpinned(page, p.path);
      await makeLong(page);
      const w = await windowFacts(page);
      expect(w.scrollY, "the page hasn't scrolled").toBe(0);
      expect((await navRect(page)).top, "the un-pinned nav is below the window (the page is long)").toBeGreaterThanOrEqual(
        w.innerHeight,
      );
      const b = await buttonRect(page);
      // max(1rem, 0) at a 32 px rem = 32 px.
      expect(Math.abs(b.bottom - (w.innerHeight - 32)), `bottom ${b.bottom.toFixed(1)} vs ${w.innerHeight} − 32`).toBeLessThanOrEqual(
        EDGE_TOLERANCE_PX,
      );
      expect(Math.abs(b.right - (w.clientWidth - 32)), `right ${b.right.toFixed(1)} vs ${w.clientWidth} − 32`).toBeLessThanOrEqual(
        EDGE_TOLERANCE_PX,
      );
      const n = await navRect(page);
      expect(intersects(b, n), `button ${fmt(b)} overlaps the nav ${fmt(n)}`).toBe(false);
    });

    test(`on a phone at 200% text, on ${p.name}, scrolled to the very bottom, "Add" is on screen and doesn't overlap the tabs`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openUnpinned(page, p.path);
      await scrollToVeryBottom(page);
      const n = await navRect(page);
      const w = await windowFacts(page);
      expect(n.top, "the nav is now on screen").toBeLessThan(w.innerHeight);
      await expect(addButton(page)).toBeInViewport({ ratio: 1 });
      const b = await buttonRect(page);
      expect(intersects(b, n), `button ${fmt(b)} overlaps the nav ${fmt(n)}`).toBe(false);
      // ADDED (T1.19 review): lifted above the visible tabs by the same 16 px
      // gap as when they are pinned (lead accepted 16 px, not the first 4 px).
      // Scrolled to the very bottom the whole nav is on screen, so the bottom
      // is nav top − 16.
      expect(Math.abs(b.bottom - (n.top - 16)), `bottom ${b.bottom.toFixed(1)} vs nav top ${n.top.toFixed(1)} − 16`).toBeLessThanOrEqual(
        EDGE_TOLERANCE_PX,
      );
    });

    // ADDED (T1.19 review, bug 1): the page is long FIRST, then the text grows
    // and the tabs switch from pinned to un-pinned with no scroll. The button
    // must come down to 32 px from the window bottom without waiting for the
    // person to scroll (it used to stay about 261 px up: the tabs' height
    // measured while they were still pinned).
    test(`on a phone, on ${p.name} made long, growing the text to 200% (no scroll) brings "Add" down to 32 px from the window's bottom`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      expect(page.viewportSize()).toEqual(PHONE);
      await open(page, p.path);
      await expectPinned(page, "true");
      await makeLong(page);
      await setTextSize(page, 200, "32px");
      await expectPinned(page, "false");
      await expectSettledAtWindowBottom(page);
    });
  }

  // ADDED (T1.19 review, bug 1): the same, on a page that is long by itself
  // (/income: seven stream links, 1173 px tall at 100% text, measured).
  test('on a phone, on /income (long by itself), growing the text to 200% (no scroll) brings "Add" down to 32 px from the window\'s bottom', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    expect(page.viewportSize()).toEqual(PHONE);
    await open(page, INCOME.path);
    await expectPinned(page, "true");
    await setTextSize(page, 200, "32px");
    await expectPinned(page, "false");
    await expectSettledAtWindowBottom(page);
  });

  // ADDED (T1.19 review, bug 1, the other order): the tabs are already
  // un-pinned (200% text on Home), then a client-side move goes straight to
  // a page that is already long (/income).
  test('on a phone at 200% text, moving from Home to /income (already long) with the tabs puts "Add" 32 px from the window\'s bottom', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openUnpinned(page, HOME.path);
    await setMarker(page);
    const tab = mainNav(page).getByRole("link", { name: "Income", exact: true });
    await tab.scrollIntoViewIfNeeded();
    await press(tab, true);
    await expect(heading(page)).toHaveText("Income");
    expect(await markerStillThere(page), "the move was client-side").toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "text still 200%").toBe("32px");
    await expectPinned(page, "false");
    await expectSettledAtWindowBottom(page);
  });
});

/**
 * Un-pinned tabs below the window: waits (a few frames) for the button's
 * bottom to settle at innerHeight − 32 (max(1rem, 0) at a 32 px rem), with the
 * page not scrolled and the nav below the window.
 */
async function expectSettledAtWindowBottom(page: Page): Promise<void> {
  const w = await windowFacts(page);
  expect(w.scrollY, "the page hasn't scrolled").toBe(0);
  expect((await navRect(page)).top, "the un-pinned nav is below the window (the page is long)").toBeGreaterThanOrEqual(
    w.innerHeight,
  );
  await expect
    .poll(async () => Math.round(Math.abs((await buttonRect(page)).bottom - (w.innerHeight - 32)) * 10) / 10, {
      message: `distance (px) of "Add"'s bottom from ${w.innerHeight} − 32`,
      timeout: 2_000,
    })
    .toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  const n = await navRect(page);
  const b = await buttonRect(page);
  expect(intersects(b, n), `button ${fmt(b)} overlaps the nav ${fmt(n)}`).toBe(false);
}

// ═══ B11b. Un-pinned: focus is never under the button (ADDED, T1.19 review) ═══
//
// WCAG 2.4.11, bug 2 from the code review. Phone 390×844, 200% text, tabs
// un-pinned. Like B14's pinned Tab test: 12 filler buttons (3rem = 96 px
// each here) make every page long, then Tab goes through everything in <main>.
// The button covers the bottom 32 + 56 = 88 px of the window, so the browser
// must scroll each focused element at least that far clear of the bottom.
// (Worked by hand: min(88px, 8vh) is 67.52 px at 844 px high, about 20 px
// short, so a filler focused at the scroll-padding edge overlaps the button.)

test.describe("T1.19: un-pinned tabs (phone, 200% text), Tab never leaves focus under the button", () => {
  for (const p of P6) {
    test(`on a phone at 200% text, on ${p.name}, Tab never leaves a focused element in <main> under "Add"`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openUnpinned(page, p.path);
      await expectTabNeverUnderButton(page);
      expect(await page.evaluate(() => document.documentElement.dataset.navPinned), "still un-pinned").toBe("false");
    });
  }
});

// ADDED (T1.19 review round 2, bug 1): focus that has to SCROLL into view.
// The B11b fillers are 16 px apart, so each next one is already on screen
// before it is focused. Here every filler has a plain, non-focusable 1200 px
// block before it (more than the 844 px window), so each Tab lands on a
// control that starts BELOW the window and the browser has to scroll it up.
// It must still end clear of the button. And the real case: the convention's
// event page with the owner's example, 200% text, no fillers at all.
test.describe("T1.19: un-pinned tabs (phone, 200% text), focus that scrolls into view isn't left under the button", () => {
  for (const p of P6) {
    test(`on a phone at 200% text, on ${p.name}, Tab to controls that start below the window never leaves one under "Add"`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openUnpinned(page, p.path);
      await expectTabNeverUnderButton(page, { fillers: 6, spacerPx: 1200 });
    });
  }

  test(`on a phone at 200% text, on the convention's page with the owner's example, Tab never leaves a focused element in <main> under "Add"`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await openUnpinned(page, `/events/${COMIC_CON_ID}`);
    await seedOwnerExample(page);
    await expectPinned(page, "false");
    await expectTabNeverUnderButton(page, { fillers: 0 });
  });
});

// ADDED (T1.19 review round 2, bug 2): a tap on an ordinary link that sits in
// the button's band (but away from the circle) must still open the link.
// Chrome focuses a link on pointer-down, so anything that scrolls the page on
// focus moves the link out from under the finger before pointer-up, and the
// tap misses. Phone (hasTouch), pinned tabs, 390x844, /events with a 1000 px
// plain block put before its content so its first event link can be
// scrolled down into the button's band.
test.describe("T1.19: tapping a link beside the button still opens it (phone, pinned)", () => {
  const CONVENTION = { name: "Pretend comic convention", path: `/events/${COMIC_CON_ID}` };

  /** Opens /events, moves its content down, scrolls the convention's link into the button's band. */
  async function linkInButtonBand(page: Page): Promise<{ link: Locator; x: number; y: number }> {
    expect(page.viewportSize()).toEqual(PHONE);
    await open(page, EVENTS.path);
    await expectPinned(page, "true");
    await main(page).evaluate((m) => {
      const spacer = document.createElement("div");
      spacer.setAttribute("data-t119-spacer", "");
      spacer.style.cssText = "display:block;height:1000px";
      m.insertBefore(spacer, m.firstChild);
    });
    await makeLong(page);
    const link = main(page).getByRole("link", { name: new RegExp(`^\\s*${escapeRegExp(CONVENTION.name)}`) });
    await expect(link).toHaveCount(1);
    const b = await buttonRect(page);
    const before = rectOf(await box(link));
    // Put the link's middle level with the button's middle.
    const delta = before.top + before.height / 2 - (b.top + b.height / 2);
    await page.evaluate((d) => window.scrollBy({ top: d, behavior: "instant" }), delta);
    await nextFrame(page);
    const l = rectOf(await box(link));
    const after = await buttonRect(page);
    expect(l.bottom > after.top && l.top < after.bottom, `link ${fmt(l)} overlaps the button's band ${fmt(after)}`).toBe(true);
    expect(l.left + 20, "the tap point is left of the circle").toBeLessThan(after.left);
    expect(await link.evaluate((el) => el === document.activeElement), "the link isn't focused yet").toBe(false);
    return { link, x: l.left + 20, y: l.top + l.height / 2 };
  }

  test('on a phone, tapping the left side of an event link level with "Add" opens that event', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    expect(testInfo.project.use.hasTouch, "the phone project has touch").toBe(true);
    const { link } = await linkInButtonBand(page);
    const l = rectOf(await box(link));
    await link.tap({ position: { x: 20, y: l.height / 2 } });
    await expect(page).toHaveURL(urlOnThisServer(page, CONVENTION.path));
    await expect(heading(page)).toHaveText(CONVENTION.name);
  });

  test('on a phone, a slow press (pointer down, 150 ms, pointer up) on the left side of an event link level with "Add" opens that event', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    const { x, y } = await linkInButtonBand(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await expect(page).toHaveURL(urlOnThisServer(page, CONVENTION.path));
    await expect(heading(page)).toHaveText(CONVENTION.name);
  });
});

// ═══ B12. At the end of the content ═══════════════════════════════════════════

test.describe("T1.19: at the end of each page's content", () => {
  for (const p of P6) {
    test(`on ${p.name}, with the group closed, "Add" is the last focusable element in <main>`, async ({ page }) => {
      await open(page, p.path);
      await expectClosed(page);
      const button = await addButton(page).elementHandle();
      const last = await main(page).evaluate((m, b) => {
        const selector =
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
        const found = Array.from(m.querySelectorAll(selector)).filter((e) => e.getClientRects().length > 0);
        const el = found[found.length - 1];
        if (!el) return "nothing focusable";
        return el === b ? "the Add button" : `${el.tagName} "${(el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
      }, button);
      expect(last).toBe("the Add button");
    });

    test(`on ${p.name}, nothing rendered in <main> comes after "Add" except its own group`, async ({ page }) => {
      await open(page, p.path);
      const button = await addButton(page).elementHandle();
      const after = await main(page).evaluate((m, b) => {
        if (!b) return ["(no button)"];
        const id = b.getAttribute("aria-controls");
        const group = id ? document.getElementById(id) : null;
        const part = (el: Element) =>
          el === b || el.contains(b) || b.contains(el) || (!!group && (el === group || el.contains(group) || group.contains(el)));
        return Array.from(m.querySelectorAll("*"))
          .filter((el) => !part(el) && el.getClientRects().length > 0)
          .filter((el) => (b.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)
          .map((el) => `<${el.tagName.toLowerCase()}> "${((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 40)}"`);
      }, button);
      expect(after, "rendered elements after the Add button").toEqual([]);
    });
  }
});

// ═══ B13. Opening: a compact stack just above the circle ══════════════════════

test.describe("T1.19: the opened links", () => {
  for (const p of P6) {
    test(`on ${p.name}, the opened links sit just above "Add", right-aligned with it, inside the window`, async ({
      page,
    }, testInfo) => {
      await open(page, p.path);
      await expectStackAboveButton(page, touch(testInfo));
    });

    test(`on a phone at 320×568 and 200% text, on ${p.name}, the opened links sit just above "Add", right-aligned with it, inside the window`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await openNarrowBigText(page, p.path);
      await expectStackAboveButton(page, true);
    });
  }
});

// ═══ B14. Never hides content ════════════════════════════════════════════════

test.describe("T1.19: the button never hides content", () => {
  for (const p of P6) {
    test(`on ${p.name} with the owner's example, scrolled to the very bottom, no content in <main> is under "Add"`, async ({
      page,
    }) => {
      await open(page, p.path);
      await seedOwnerExample(page);
      await expectPinned(page, "true");
      await scrollToVeryBottom(page);
      expect(await contentUnderButton(page)).toEqual([]);
    });

    test(`in a window 360 px high, on ${p.name} with the owner's example, the page scrolls, and scrolled to the very bottom no content in <main> is under "Add"`, async ({
      page,
    }) => {
      const width = page.viewportSize()!.width;
      await page.setViewportSize({ width, height: SHORT_WINDOW_HEIGHT });
      await open(page, p.path);
      await seedOwnerExample(page);
      await expectPinned(page, "true");
      const w = await windowFacts(page);
      expect(w.scrollHeight, `the page is taller than the ${SHORT_WINDOW_HEIGHT} px window`).toBeGreaterThan(w.innerHeight);
      await scrollToVeryBottom(page);
      expect((await windowFacts(page)).scrollY, "scrolled down").toBeGreaterThan(0);
      expect(await contentUnderButton(page)).toEqual([]);
    });

    test(`in a window 360 px high, on ${p.name} with the owner's example, Tab never leaves a focused element in <main> under "Add"`, async ({
      page,
    }) => {
      const width = page.viewportSize()!.width;
      await page.setViewportSize({ width, height: SHORT_WINDOW_HEIGHT });
      await open(page, p.path);
      await seedOwnerExample(page);
      await expectPinned(page, "true");
      await expectTabNeverUnderButton(page);
    });
  }
});
