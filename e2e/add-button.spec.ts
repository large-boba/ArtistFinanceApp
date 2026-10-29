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
// and Home's running totals (home.spec.ts H3, was entries-list D3) add up every entry dated today:
// "Today: $X from N sales" for income, "Today's expenses: $X" for expenses.
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
//
// B2. Names. The button is a real <button> whose accessible name AND visible
//     text are exactly "+ Add" (WCAG 2.5.3: say what you see). The two links'
//     accessible names are exactly "Add income" and "Add expense".
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
//       Home → Add income, Online sales $25, Card        → 2500 → "Today: $25.00 from 1 sale"
//       Home → Add expense, Software $9.95                → 995  → "Today's expenses: $9.95"
//       /expenses → Add expense, Printing $23.50          → 2350 → "Today's expenses: $23.50"
//       /events → Add income, Sales at events,
//                 cash $100 + card $250.50                → 10000 + 25050 = 35050
//                                                         → "Today: $350.50 from 2 sales"
//       /income → Add income, Commissions $80, Bank transfer → 8000 → "Today: $80.00 from 1 sale"
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
// The device clock is frozen at 2026-06-30T15:30:00Z: 01:30 on 1 July in
// Australia/Sydney, so today on the device is 2026-07-01 and both forms'
// Date fields default to it, the same date Home's totals use.

import { expect, test as base, type Locator, type Page } from "@playwright/test";

// ---------- fixed facts ----------

const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
const SYDNEY = "Australia/Sydney";

const ADD_BUTTON = "+ Add";
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
    test(`${p.name} (${p.path}) has exactly one visible "+ Add" button`, async ({ page }) => {
      await open(page, p.path);
      await expect(addButton(page)).toHaveCount(1);
      await expect(addButton(page)).toBeVisible();
    });

    test(`on ${p.name}, "+ Add" comes after the h1 in the page and its top is at or below the h1's bottom`, async ({
      page,
    }) => {
      await open(page, p.path);
      const follows = await heading(page).evaluate((h1, name) => {
        const button = Array.from(document.querySelectorAll("main button")).find(
          (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === name,
        );
        return !!button && (h1.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }, ADD_BUTTON);
      expect(follows, '"+ Add" follows the h1 in document order').toBe(true);
      const h1 = await box(heading(page));
      const b = await box(addButton(page));
      expect(b.y, `"+ Add" top vs the h1's bottom at ${(h1.y + h1.height).toFixed(1)} px`).toBeGreaterThanOrEqual(
        h1.y + h1.height - EDGE_TOLERANCE_PX,
      );
    });

    test(`on ${p.name}, "+ Add" is directly under the h1: the h1's next element sibling is the button or holds it (T1.15)`, async ({
      page,
    }) => {
      await open(page, p.path);
      const direct = await heading(page).evaluate((h1, name) => {
        const next = h1.nextElementSibling;
        if (!next) return "nothing after the h1";
        const isIt = (el: Element) =>
          el.tagName === "BUTTON" && (el.textContent ?? "").replace(/\s+/g, " ").trim() === name;
        if (isIt(next) || Array.from(next.querySelectorAll("button")).some(isIt)) return "yes";
        return `next sibling is <${next.tagName.toLowerCase()}> "${(next.textContent ?? "").trim().slice(0, 40)}"`;
      }, ADD_BUTTON);
      expect(direct).toBe("yes");
    });

    test(`on ${p.name}, "+ Add" is the first focusable element in <main>`, async ({ page }) => {
      await open(page, p.path);
      const first = await main(page).evaluate((m) => {
        const selector =
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
        const el = Array.from(m.querySelectorAll(selector)).find((e) => e.getClientRects().length > 0);
        return el ? `${el.tagName} ${(el.textContent ?? "").replace(/\s+/g, " ").trim()}` : null;
      });
      expect(first).toBe(`BUTTON ${ADD_BUTTON}`);
    });

    test(`on ${p.name}, "+ Add" is full-width: as wide as <main>'s content box`, async ({ page }) => {
      await open(page, p.path);
      const contentWidth = await main(page).evaluate((m) => {
        const cs = getComputedStyle(m);
        return m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      });
      const b = await box(addButton(page));
      expect(Math.abs(b.width - contentWidth), `button width ${b.width} vs content width ${contentWidth}`).toBeLessThanOrEqual(
        EDGE_TOLERANCE_PX,
      );
    });
  }

  test('Settings has no "+ Add" (not one of the card\'s pages)', async ({ page }) => {
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
    test(`on ${p.name}, "+ Add" is a <button> whose visible text is exactly "+ Add"`, async ({ page }) => {
      await open(page, p.path);
      expect(await addButton(page).evaluate((el) => el.tagName)).toBe("BUTTON");
      expect(await addButton(page).evaluate((el) => (el as HTMLElement).innerText.replace(/\s+/g, " ").trim())).toBe(
        ADD_BUTTON,
      );
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
    test(`on ${p.name}, "+ Add" starts with aria-expanded="false" and neither link in the accessibility tree`, async ({
      page,
    }) => {
      await open(page, p.path);
      await expectClosed(page);
    });

    test(`on ${p.name}, with the group closed, Tab from "+ Add" doesn't reach either link`, async ({ page }) => {
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

  test('when open, Tab from "+ Add" reaches "Add income" and then "Add expense"', async ({ page }) => {
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
  test('Escape closes the group and focus returns to "+ Add"', async ({ page }) => {
    await open(page, "/");
    await addButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(addButton(page)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expectClosed(page);
    await expect(addButton(page)).toBeFocused();
  });

  test('Escape with focus on "Add expense" closes the group and focus returns to "+ Add"', async ({ page }) => {
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

  test('pressing "+ Add" again closes the group', async ({ page }, testInfo) => {
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
  test("Home → Add income (Online sales, $25, Card) → Save lands on Home showing \"Today: $25.00 from 1 sale\"", async ({
    page,
  }, testInfo) => {
    const t = touch(testInfo);
    await open(page, HOME.path);
    await expect(exactText(page, "Today: $0.00 from 0 sales")).toBeVisible();
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
    await expect(exactText(page, "Today: $25.00 from 1 sale")).toBeVisible();
  });

  test("Home → Add expense (Software, $9.95) → Save lands on Home showing \"Today's expenses: $9.95\"", async ({
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
    await expect(exactText(page, "Today's expenses: $9.95")).toBeVisible();
  });

  test("/expenses → Add expense (Printing, $23.50) → Save lands on /expenses, and Home shows \"Today's expenses: $23.50\"", async ({
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
    await expect(exactText(page, "Today's expenses: $23.50")).toBeVisible();
  });

  test("/events → Add income (Sales at events, cash $100 + card $250.50) → Save lands on /events, and Home shows \"Today: $350.50 from 2 sales\"", async ({
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
    await expect(exactText(page, "Today: $350.50 from 2 sales")).toBeVisible();
  });

  test("/income → Add income (Commissions, $80, Bank transfer) → Save lands on /income, and Home shows \"Today: $80.00 from 1 sale\"", async ({
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
    await expect(exactText(page, "Today: $80.00 from 1 sale")).toBeVisible();
  });

  test('after a round trip back to Home, "+ Add" is closed again', async ({ page }, testInfo) => {
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
    test(`on a phone, on ${p.name}, "+ Add" is fully on screen without scrolling and above the nav`, async ({
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
