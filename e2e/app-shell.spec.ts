// App shell tests (T1.3): the starter page is gone, and a bottom navigation
// bar with five tabs works by touch, by mouse and by keyboard.
// Updated for T1.11 ("New bottom navigation: Home, Events, Expenses, Income,
// Settings"), following the owner's 2026-10-25 change of direction
// (DECISIONS.md "What the app is for" and "Navigation"): the app tracks how
// events went after the fact and organises income streams, so the tabs are
// now Home, Events, Expenses, Income, Settings. Transactions leaves the tabs
// and Reports is removed. Every decision changed for T1.11 is marked
// "CHANGED (T1.11)" with the reason; 16–18 are new.
// Written by the test engineer before the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop)
// unless it says "on a phone" in its name. Those are limited to the phone
// project with a conditional `test.skip(...)`, because "fixed at the bottom of
// the screen" and "visible without scrolling" are phone-layout claims. On
// desktop they show as skipped, which is expected.
//
// DECISIONS THE BUILDER MUST FOLLOW (made here so the tests can be exact):
//
// 1. Routes. Each tab is its own page at these paths:
//      Home → /    Events → /events    Expenses → /expenses
//      Income → /income    Settings → /settings
//    Each answers HTTP 200.
//    CHANGED (T1.11): was Home, Transactions, Events, Reports, Settings. The
//    owner's new tabs (DECISIONS.md "Navigation") replace the guide's. The
//    Transactions list will be split into the Expenses and Income tabs
//    (T1.16, T1.17); report figures move to Home and to the event and stream
//    pages. What happens to /reports and /transactions is in 16–18.
//
// 2. Page titles (lead's decision, WCAG 2.4.2: each page has its own title).
//    Exact matches, not "starts with":
//      Home → "BentoBudget"
//      every other screen → "<Screen> · BentoBudget", with a middle dot
//      (U+00B7) and one space on each side, e.g. "Expenses · BentoBudget"
//      and "Income · BentoBudget".
//    CHANGED (T1.11): only the example, because Reports is gone.
//
// 3. Navigation landmark. Exactly one `<nav>` whose accessible name is exactly
//    "Main" (e.g. `<nav aria-label="Main">`), on every page. It contains
//    exactly five links, in DOM order: Home, Events, Expenses, Income,
//    Settings. Each link's accessible name is exactly that word (icons must be
//    `aria-hidden` so they don't add to the name), and its `href` is exactly
//    the path above.
//    CHANGED (T1.11): the new five tabs and their order (see 1).
//    Icons (new in T1.11, from the card's "each with an icon"): each link
//    holds exactly one <svg> with aria-hidden="true", drawn at least 16×16 px
//    (T1.3's are 24×24 at 100% text), and the five icons are five different
//    pictures (their markup differs), so no tab reuses another tab's icon.
//
// 4. Current tab. The link for the page you're on has `aria-current="page"`.
//    The other four have no `aria-current` attribute at all. The current tab
//    must also LOOK different: some computed style (colour, background, font
//    weight, border, underline, shadow, opacity) of the link or something
//    inside it differs from the other tabs, with no hover or focus involved.
//
// 5. Headings. Each page has exactly one level-1 heading, whose text is
//    exactly the screen's name ("Home", "Events", "Expenses", "Income",
//    "Settings").
//    CHANGED (T1.11): the new screen names.
//
// 6. Main landmark. Each page has exactly one `<main>` for its content, and
//    the navigation is outside it.
//
// 7. Empty screens. Events and Settings say they're coming later with a
//    short note matching /coming in Stage \d+/i.
//    Expenses and Income are new, simple pages (T1.11): one heading and a
//    short note in <main> containing the words "coming next" in any letter
//    case (/\bcoming next\b/i, e.g. "Coming next."). They aren't told to say
//    "Coming in Stage N" because T1.16 and T1.17 fill them in within Stage 1
//    itself, and "Coming in Stage 1" would read oddly while Stage 1 is the
//    current stage.
//    CHANGED (T1.11): Reports is gone (see 16); Expenses and Income added.
//    (Transactions was never checked here: T1.6 replaced its placeholder with
//    the entries list.)
//    CHANGED (T1.15): Events is no longer a placeholder. T1.15 replaces its
//    note with the list of pretend events (events.spec.ts E1), so only
//    Settings must say "coming in Stage N", and Events must NOT.
//    CHANGED (T1.16): Income is no longer a "coming next" page. T1.16
//    replaces its note with the seven income streams
//    (income-streams.spec.ts S1), so only Expenses must say "coming next"
//    (until T1.17), and Income must NOT.
//    CHANGED (T1.17): Expenses is no longer a "coming next" page. T1.17
//    replaces its note with the totals per group and the expense list
//    (expenses.spec.ts X1–X5), so Expenses must NOT say "coming next". No
//    page is left with a "coming next" note, so that half of the claim is
//    retired: the list of "coming next" pages and its loop are removed
//    rather than left empty (an empty loop makes no tests and would read as
//    if something were still checked).
//
// 8. Home button. Home has exactly one control whose accessible name is
//    exactly "+ Add" (since T1.14; it was "+ Expense", see the CHANGED notes
//    below). The name equals the visible label, so speech-input users can say
//    what they see (WCAG 2.5.3); screen readers read it as "plus Add".
//    CHANGED (T1.8) by the owner's 2026-10-25 direction (DECISIONS.md "What
//    the app is for" and "Quick-sale pad"): T1.3's second button, "+ Sale",
//    and the quick-sale pad it opened are removed. The proof that they are
//    gone (/sale is a 404, no "Sale" control on Home) is in
//    removed-quick-sale.spec.ts.
//    CHANGED (T1.14) by the owner's "+" button decision (DECISIONS.md "The
//    '+' button"; lead's approval given in advance at T1.8): Home's control
//    is now the shared "+ Add" button (a <button>, a disclosure offering
//    "Add income" and "Add expense"), which REPLACES "+ Expense". So Home has
//    exactly one control whose accessible name is exactly "+ Add", and none
//    named "+ Expense". The button's own behaviour is in add-button.spec.ts.
//    Claims 9, 10 and 14 below now check "+ Add" where they checked
//    "+ Expense" (HOME_BUTTONS); nothing else about them changed.
//
// 9. Tap targets. Every nav link and Home's "+ Add" are at least 44×44
//    CSS pixels (their own bounding box, not a parent's).
//
// 10. Phone layout (390×844). The nav is visible, inside the screen's width,
//     and its bottom edge is the bottom of the viewport (within 1 px) on every
//     page, and it stays there while a long page scrolls underneath. On Home,
//     "+ Add" (CHANGED (T1.14), was "+ Expense") is fully on screen without
//     scrolling and not covered by the nav.
//
// 11. Keyboard. Pressing Tab from the top of the page reaches the five nav
//     links in order. A keyboard-focused link shows a visible focus indicator
//     on the link itself (an outline or a box-shadow) that isn't there when it
//     isn't focused. Enter on a focused link opens its page.
//
// 12. No uncaught errors. Any uncaught error in the page (`pageerror`) during
//     ANY test in this file fails that test.
//
// 13. Starter leftovers. No element on any page has an href pointing at
//     vercel.com or nextjs.org, no page contains "To get started, edit", and
//     the starter images (/next.svg, /vercel.svg, /file.svg, /globe.svg,
//     /window.svg) are no longer served (HTTP 404).
//
// 14. Bigger text (WCAG 1.4.4 Resize text, added after T1.3 review). On the
//     phone (390 px wide), with the root font size at 150% and at 200%, on
//     every page: all five nav links are fully on screen horizontally
//     (0 ≤ left, right ≤ 390, within 1 px), each is still at least 44×44 px,
//     each can be tapped and opens its page (scrolled to first when the nav
//     isn't pinned, see 15), and the page doesn't scroll
//     sideways (scrollWidth ≤ clientWidth). The tests set
//     `document.documentElement.style.fontSize`, the way a browser text-size
//     setting scales everything sized in rem. Labels may wrap, shrink to an
//     icon with an accessible name, or the bar may grow taller; all five tabs
//     must stay reachable.
//     T1.11: unchanged, and re-run for the new tabs on every new screen.
//     Content must not hide behind a taller nav either, at 150% and 200% on
//     every page: after scrolling to the very bottom, the lowest-ending
//     element inside <main> ends at or above the nav's top edge (within
//     1 px). On Home, "+ Add" (CHANGED (T1.14), was "+ Expense"), once
//     scrolled to the top of the screen
//     (`scrollIntoView({ block: "start" })`, the most a person can scroll it
//     up), is fully on screen and ends at or above the nav's top edge. It is
//     still at least 44×44 px and inside 0–390 px.
//
// 15. When the nav is pinned (WCAG 2.4.11 Focus not obscured; lead's
//     decision for T1.3b, replacing T1.3's "700 px tall or less → static"
//     rule). Tested in the phone project at 320×568, 568×320, 390×844,
//     844×390, 390×664 (an iPhone's visible height in a Safari tab),
//     375×667, 390×700 and 390×701, each at 100% and 200% text:
//     - The 25% rule. Let H be the nav's own measured height (its border
//       box, getBoundingClientRect().height, which is the same pinned or
//       not) and V the visible screen height (window.innerHeight).
//       If H ≤ 25% of V, the nav is sticky at the bottom of the screen: the
//       nav or an ancestor has computed position sticky (or fixed), and its
//       bottom edge stays on the bottom of the screen while a long page
//       scrolls. Exactly 25% still counts as sticky.
//       If H > 25% of V, the nav is NOT pinned: neither it nor any ancestor
//       has computed position sticky or fixed. It sits in the normal page
//       flow after <main>, so scrolled to the very bottom the nav is the
//       last thing on the page and all of <main>'s content ends above it.
//     - The rule follows the MEASURED height, live: if the nav grows or
//       shrinks after the page loads (bigger text, or any style change), or
//       only the screen height changes (rotation, a browser toolbar), the
//       pinning is re-decided. The tests change the nav's size at runtime
//       with an inline style to prove it.
//     - Hand-worked expected outcomes for the main cases are written next to
//       PINNING_CASES below. With T1.3's nav: every case at 100% text is
//       sticky, and every case at 200% text is static.
//     - Whenever the nav is sticky, the computed scroll-padding-bottom on
//       <html> is at least the nav's height (0.01 px allowed for number
//       formatting), so the browser scrolls a focused element clear of it.
//       There must be no screen height where the nav is sticky without it
//       (T1.3 had a gap between 700 and 701 px; Chromium can't be given a
//       fractional viewport, so the tests check 700 and 701 each side).
//     - The nav publishes its border-box height as the CSS variable --nav-h
//       on <html>, and it updates when only the nav's padding changes (the
//       content box alone would miss that).
//     - Either way, pressing Tab through every focusable element in <main>
//       leaves each one fully on screen and not overlapped by the nav at all,
//       including on a long page. Nav links are exempt.
//     - At 320 px wide and 200% text, no page scrolls sideways
//       (scrollWidth ≤ clientWidth), and each page's h1 text stays inside
//       0–320 px (long words must wrap, not overflow or get clipped).
//     T1.11: the rule is unchanged and every case is re-run for the new tabs.
//     The hand-worked row counts next to PINNING_CASES are redone for the new
//     labels ("Expenses" is the widest now); every expected outcome stays the
//     same.
//
// 16. /reports is removed (NEW, T1.11; the card: "/reports is removed (a
//     404)"). A browser opening it gets HTTP 404, and a plain GET that does
//     NOT follow redirects gets 404 too, so sending people elsewhere (a 3xx
//     to Home) doesn't count as removing it. This holds on both servers in
//     playwright.config.ts: the test build (port 3000, the baseURL) and the
//     build made without the test flag (port 3001, built the way Cloudflare
//     builds the live app). Same method as removed-quick-sale.spec.ts R1.
//     No link anywhere on any tab's page (nav or <main>) leads to /reports or
//     anything under it, so nothing points at the missing page.
//
// 17. Transactions leaves the tabs (NEW, T1.11, lead's decision on the card).
//     On every tab's page and on /transactions itself, the "Main" nav has no
//     link whose path is /transactions or anything under it.
//     CHANGED (T1.17b): /transactions no longer exists, so it is no longer
//     opened here; the tab pages are still checked. The wider claim (no link
//     ANYWHERE leads to it) is 18 below.
//
// 18. TEMPORARY (NEW, T1.11, lead's decision on the card): /transactions
//     stays reachable by its address until T1.16 and T1.17 split its list
//     into the Income and Expenses tabs; then those cards remove it and
//     replace these tests. Until then: it answers HTTP 200, has exactly one
//     level-1 heading, "Transactions", and still shows the "Main" nav with
//     the five tabs of 3. Because /transactions isn't one of the tabs, no nav
//     link there has aria-current at all (aria-current="page" on a tab would
//     tell a screen reader you're on a page you aren't on).
//     The entries-list and expense-form specs now reach /transactions with a
//     client-side move that doesn't use the nav (see their headers).
//     CHANGED (T1.17b): RETIRED. T1.17b removes /transactions (its list is
//     split into the Expenses tab and the stream pages, T1.16/T1.17). Claim 18
//     is now, like 16 for /reports:
//       - /transactions is a real 404: a browser opening it gets HTTP 404, and
//         a GET that does NOT follow redirects gets 404 too (a 3xx elsewhere
//         doesn't count as removing it), on both servers (3000, the test
//         build, and 3001, built without the test flag as Cloudflare builds
//         it). /transactions/anything (e.g. /transactions/2026) is a 404 as
//         well;
//       - no link anywhere leads to it (nav or <main>, any path that is
//         /transactions or under it) on: the five tab pages, the three event
//         pages, the seven stream pages and the two forms.
import {
  expect,
  test as base,
  type Locator,
  type Page,
} from "@playwright/test";

const MIN_TAP_TARGET_PX = 44;

// The five tabs, in the order they must appear in the navigation bar.
// `title` is written out by hand (not built from `name`) so the expected
// value is a fixed known answer. "\u00B7" is the middle dot.
// CHANGED (T1.11): the owner's new tabs (DECISIONS.md "Navigation").
const SCREENS = [
  { name: "Home", path: "/", title: "BentoBudget" },
  { name: "Events", path: "/events", title: "Events \u00B7 BentoBudget" },
  { name: "Expenses", path: "/expenses", title: "Expenses \u00B7 BentoBudget" },
  { name: "Income", path: "/income", title: "Income \u00B7 BentoBudget" },
  { name: "Settings", path: "/settings", title: "Settings \u00B7 BentoBudget" },
] as const;

type Screen = (typeof SCREENS)[number];

// Screens still empty until a later stage, so they show a "coming in Stage N"
// note (claim 7). CHANGED (T1.11): Reports is gone. CHANGED (T1.15): Events
// now lists the pretend events, so only Settings is left.
const PLACEHOLDER_SCREENS = SCREENS.filter((s) => ["Settings"].includes(s.name));

// The simple pages (claim 7, T1.11) had a "coming next" note. CHANGED (T1.16):
// Income now lists the streams. CHANGED (T1.17): Expenses now lists the
// expenses, so no page has the note and the list is retired (see claim 7).

// Removed and de-tabbed pages (claims 16\u201318).
const REPORTS_PATH = "/reports";
const TRANSACTIONS_PATH = "/transactions";
/** The second server, built without NEXT_PUBLIC_E2E (as Cloudflare builds it). */
const FLAG_OFF_BASE_URL = "http://localhost:3001";
const NOT_FOUND = 404;

const STARTER_IMAGES = [
  "/next.svg",
  "/vercel.svg",
  "/file.svg",
  "/globe.svg",
  "/window.svg",
] as const;

// Every test in this file fails if the page throws an uncaught error
// (claim 12). The check runs after the test body, so it covers everything
// the test did, including client-side navigation.
const test = base.extend<{ uncaughtPageErrors: string[] }>({
  uncaughtPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "uncaught errors thrown in the page").toEqual([]);
    },
    { auto: true },
  ],
});

// ---------- helpers ----------

/** Opens a path and requires a 200 response (a missing page is a 404). */
async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), `HTTP status of ${path}`).toBe(200);
}

function mainNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Main", exact: true });
}

function navLink(page: Page, name: string): Locator {
  return mainNav(page).getByRole("link", { name, exact: true });
}

// Home's big buttons (claim 8). "+ Sale" was removed in T1.8 (owner's
// 2026-10-25 direction). CHANGED (T1.14): "+ Add" replaces "+ Expense".
const HOME_BUTTONS = ["+ Add"] as const;
type HomeButton = (typeof HOME_BUTTONS)[number];

/** The Home control with this exact accessible name, as a button or a link. */
function homeControl(page: Page, name: HomeButton): Locator {
  return page
    .getByRole("button", { name, exact: true })
    .or(page.getByRole("link", { name, exact: true }));
}

/** A different screen to start from, so following the link is a real move. */
function otherScreen(screen: Screen): Screen {
  return screen.path === "/" ? SCREENS[4] : SCREENS[0];
}

/** Taps on a touch device (the phone project), clicks otherwise. */
async function press(locator: Locator, hasTouch: boolean): Promise<void> {
  await expect(locator).toBeVisible();
  if (hasTouch) await locator.tap();
  else await locator.click();
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const b = await locator.boundingBox();
  expect(b, "element has a layout box (is rendered)").not.toBeNull();
  return b!;
}

function viewportHeight(page: Page): Promise<number> {
  return page.evaluate(() => window.innerHeight);
}

function viewportWidth(page: Page): Promise<number> {
  return page.evaluate(() => window.innerWidth);
}

/**
 * Presses Tab from wherever focus is until `target` has focus. Fails if it
 * takes more than `maxPresses`.
 */
async function tabUntilFocused(
  page: Page,
  target: Locator,
  maxPresses = 40,
): Promise<void> {
  await expect(target).toBeVisible();
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`Tab didn't reach the target within ${maxPresses} presses`);
}

/** A fingerprint of how a link looks: its styles and its children's styles. */
async function looksSignature(link: Locator): Promise<string> {
  await expect(link).toBeVisible();
  return link.evaluate((root) => {
    const props = [
      "color",
      "background-color",
      "background-image",
      "font-weight",
      "border-top-color",
      "border-bottom-color",
      "border-top-width",
      "border-bottom-width",
      "text-decoration-line",
      "box-shadow",
      "opacity",
      "outline-style",
    ];
    const elements = [root, ...Array.from(root.querySelectorAll("*"))];
    return elements
      .map((el) => {
        const cs = getComputedStyle(el);
        return el.tagName + "{" + props.map((p) => cs.getPropertyValue(p)).join(";") + "}";
      })
      .join("");
  });
}

/** The parts of a link's computed style that draw a focus indicator. */
function focusStyle(link: Locator) {
  return link.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
    };
  });
}

// ---------- 13. starter leftovers and the title ----------

test.describe("the starter page is gone", () => {
  for (const screen of SCREENS) {
    test(`${screen.name} (${screen.path}) has the page title exactly "${screen.title}"`, async ({
      page,
    }) => {
      await open(page, screen.path);
      await expect(page).toHaveTitle(screen.title);
      // toHaveTitle and document.title both collapse whitespace, so also
      // compare the raw <title> text character for character: one plain space
      // each side of the middle dot, nothing else. Exactly one <title>.
      const titleElement = page.locator("head > title");
      await expect(titleElement).toHaveCount(1);
      expect(await titleElement.textContent()).toBe(screen.title);
    });

    test(`${screen.name} (${screen.path}) has no links to vercel.com or nextjs.org`, async ({
      page,
    }) => {
      await open(page, screen.path);
      await expect(
        page.locator('[href*="vercel.com" i], [href*="nextjs.org" i]'),
      ).toHaveCount(0);
    });

    test(`${screen.name} (${screen.path}) has no "To get started, edit" text`, async ({
      page,
    }) => {
      await open(page, screen.path);
      await expect(page.locator("body")).not.toContainText(
        /to get started, edit/i,
      );
    });
  }

  for (const image of STARTER_IMAGES) {
    test(`the starter image ${image} is no longer served`, async ({
      request,
    }) => {
      const response = await request.get(image);
      expect(response.status()).toBe(404);
    });
  }
});

// ---------- 2, 3, 4, 5, 6, 7. navigation and screens ----------

test.describe("bottom navigation", () => {
  for (const screen of SCREENS) {
    test(`on ${screen.name}, the "Main" navigation lists exactly Home, Events, Expenses, Income, Settings in that order`, async ({
      page,
    }) => {
      await open(page, screen.path);
      await expect(mainNav(page)).toHaveCount(1);
      await expect(mainNav(page)).toBeVisible();
      const links = mainNav(page).getByRole("link");
      await expect(links).toHaveCount(SCREENS.length);
      for (let i = 0; i < SCREENS.length; i++) {
        await expect(links.nth(i)).toHaveAccessibleName(SCREENS[i].name);
      }
    });
  }

  for (const screen of SCREENS) {
    test(`the "${screen.name}" link points to ${screen.path}`, async ({
      page,
    }) => {
      await open(page, "/");
      await expect(navLink(page, screen.name)).toHaveAttribute(
        "href",
        screen.path,
      );
    });

    test(`tapping "${screen.name}" opens ${screen.path}`, async ({
      page,
    }, testInfo) => {
      const start = otherScreen(screen);
      await open(page, start.path);
      await press(
        navLink(page, screen.name),
        !!testInfo.project.use.hasTouch,
      );
      await expect(page).toHaveURL(screen.path);
    });

    test(`after tapping "${screen.name}", only that link has aria-current="page"`, async ({
      page,
    }, testInfo) => {
      const start = otherScreen(screen);
      await open(page, start.path);
      await press(
        navLink(page, screen.name),
        !!testInfo.project.use.hasTouch,
      );
      await expect(page).toHaveURL(screen.path);
      for (const other of SCREENS) {
        const link = navLink(page, other.name);
        if (other.name === screen.name) {
          await expect(link).toHaveAttribute("aria-current", "page");
        } else {
          await expect(link).not.toHaveAttribute("aria-current", /.*/);
        }
      }
    });

    test(`on ${screen.name}, the current tab looks different from every other tab`, async ({
      page,
    }) => {
      await open(page, screen.path);
      // Load directly and park the mouse in a corner so hover and focus
      // styles can't be mistaken for the highlight.
      await page.mouse.move(0, 0);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const current = await looksSignature(navLink(page, screen.name));
      for (const other of SCREENS) {
        if (other.name === screen.name) continue;
        const otherLooks = await looksSignature(navLink(page, other.name));
        expect(
          otherLooks,
          `"${other.name}" must not look the same as the current tab "${screen.name}"`,
        ).not.toBe(current);
      }
    });

    test(`${screen.name} has exactly one level-1 heading, "${screen.name}"`, async ({
      page,
    }) => {
      await open(page, screen.path);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(screen.name);
    });

    test(`${screen.name} has exactly one main landmark, with the navigation outside it`, async ({
      page,
    }) => {
      await open(page, screen.path);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(
        page.getByRole("main").getByRole("navigation", { name: "Main", exact: true }),
      ).toHaveCount(0);
      await expect(mainNav(page)).toHaveCount(1);
    });
  }

  for (const screen of PLACEHOLDER_SCREENS) {
    test(`${screen.name} shows a "coming in Stage N" note`, async ({
      page,
    }) => {
      await open(page, screen.path);
      await expect(page.getByRole("main")).toContainText(/coming in Stage \d+/i);
    });
  }

  test('Events no longer shows a "coming in Stage N" note (CHANGED (T1.15))', async ({ page }) => {
    await open(page, "/events");
    await expect(page.getByRole("main")).not.toContainText(/coming in Stage \d+/i);
  });

  test('Income no longer shows a "coming next" note (CHANGED (T1.16))', async ({ page }) => {
    await open(page, "/income");
    await expect(page.getByRole("main")).not.toContainText(/\bcoming next\b/i);
  });

  test('Expenses no longer shows a "coming next" note (CHANGED (T1.17))', async ({ page }) => {
    await open(page, "/expenses");
    await expect(page.getByRole("main")).not.toContainText(/\bcoming next\b/i);
  });

  // Claim 3, icons (T1.11: "each with an icon").
  for (const screen of SCREENS) {
    test(`the "${screen.name}" nav link holds exactly one aria-hidden icon, at least 16×16 px`, async ({
      page,
    }) => {
      await open(page, "/");
      const icon = navLink(page, screen.name).locator("svg");
      await expect(icon).toHaveCount(1);
      await expect(icon).toHaveAttribute("aria-hidden", "true");
      const b = await box(icon);
      expect(b.width, "icon width in CSS px").toBeGreaterThanOrEqual(16);
      expect(b.height, "icon height in CSS px").toBeGreaterThanOrEqual(16);
    });
  }

  test("the five nav icons are five different pictures", async ({ page }) => {
    await open(page, "/");
    const pictures: string[] = [];
    for (const screen of SCREENS) {
      const icon = navLink(page, screen.name).locator("svg");
      await expect(icon).toHaveCount(1);
      pictures.push(await icon.evaluate((svg) => svg.innerHTML.replace(/\s+/g, " ").trim()));
    }
    expect(pictures.every((p) => p !== ""), "every icon draws something").toBe(true);
    expect(new Set(pictures).size, "number of different icons").toBe(SCREENS.length);
  });
});

// ---------- 8. Home button ----------

test.describe("Home's big button", () => {
  for (const name of HOME_BUTTONS) {
    test(`Home has exactly one visible control named "${name}"`, async ({
      page,
    }) => {
      await open(page, "/");
      const control = homeControl(page, name);
      await expect(control).toHaveCount(1);
      await expect(control).toBeVisible();
    });
  }

  test('Home has no control named "+ Expense" any more (CHANGED (T1.14): "+ Add" replaces it)', async ({
    page,
  }) => {
    await open(page, "/");
    await expect(page.getByRole("button", { name: "+ Expense", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "+ Expense", exact: true })).toHaveCount(0);
  });

  test("on a phone, + Add is fully on screen above the navigation without scrolling", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await open(page, "/");
    const navTop = (await box(mainNav(page))).y;
    for (const name of HOME_BUTTONS) {
      const b = await box(homeControl(page, name));
      expect(b.y, `${name} top is on screen`).toBeGreaterThanOrEqual(0);
      expect(
        b.y + b.height,
        `${name} bottom is above the navigation bar`,
      ).toBeLessThanOrEqual(navTop);
    }
  });
});

// ---------- 9. tap target size ----------

test.describe("tap targets are at least 44×44 px", () => {
  for (const screen of SCREENS) {
    test(`the "${screen.name}" nav link is at least 44×44 px`, async ({
      page,
    }) => {
      await open(page, "/");
      const b = await box(navLink(page, screen.name));
      expect(b.width, "width in CSS px").toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      expect(b.height, "height in CSS px").toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    });
  }

  for (const name of HOME_BUTTONS) {
    test(`the Home "${name}" control is at least 44×44 px`, async ({
      page,
    }) => {
      await open(page, "/");
      const b = await box(homeControl(page, name));
      expect(b.width, "width in CSS px").toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
      expect(b.height, "height in CSS px").toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
    });
  }
});

// ---------- 10. phone: fixed at the bottom ----------

test.describe("on a phone, the navigation sits at the bottom of the screen", () => {
  for (const screen of SCREENS) {
    test(`on a phone, the navigation's bottom edge is the bottom of the screen on ${screen.name}`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await open(page, screen.path);
      await expect(mainNav(page)).toBeVisible();
      const b = await box(mainNav(page));
      const vh = await viewportHeight(page);
      const vw = await viewportWidth(page);
      expect(vh, "phone viewport height").toBe(844);
      expect(Math.abs(b.y + b.height - vh), "gap between nav bottom and screen bottom (px)").toBeLessThanOrEqual(1);
      expect(b.x, "nav left edge is on screen").toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, "nav right edge is on screen").toBeLessThanOrEqual(vw);
    });
  }

  test("on a phone, the navigation stays at the bottom while a long page scrolls", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await open(page, "/");
    // Make the page long: add 3000 px of filler to the page content, with
    // markers halfway down and at the end. Scrolling them into view scrolls
    // whichever element actually scrolls (the window or an inner container).
    await page.getByRole("main").evaluate((main) => {
      const filler = document.createElement("div");
      filler.style.cssText = "height:3000px;flex:none;position:relative";
      for (const [id, top] of [["scroll-middle", 1500], ["scroll-end", 2990]] as const) {
        const marker = document.createElement("div");
        marker.setAttribute("data-testid", id);
        marker.style.cssText = `position:absolute;top:${top}px;height:10px;width:10px`;
        filler.appendChild(marker);
      }
      main.appendChild(filler);
    });
    const vh = await viewportHeight(page);

    for (const id of ["scroll-middle", "scroll-end"]) {
      const marker = page.getByTestId(id);
      expect(
        (await box(marker)).y,
        `${id} starts below the screen (the page is long)`,
      ).toBeGreaterThan(vh);
    }

    for (const id of ["scroll-middle", "scroll-end"]) {
      const marker = page.getByTestId(id);
      await marker.scrollIntoViewIfNeeded();
      const m = await box(marker);
      expect(m.y, `${id} scrolled onto the screen`).toBeLessThan(vh);
      expect(m.y + m.height, `${id} scrolled onto the screen`).toBeGreaterThan(0);
      await expect(mainNav(page)).toBeVisible();
      const b = await box(mainNav(page));
      expect(
        Math.abs(b.y + b.height - vh),
        `after scrolling to ${id}, gap between nav bottom and screen bottom (px)`,
      ).toBeLessThanOrEqual(1);
    }
  });
});

// ---------- 11. keyboard ----------

test.describe("keyboard", () => {
  test("Tab from the top of the page reaches the five nav links in order", async ({
    page,
  }) => {
    await open(page, "/");
    const handles = await mainNav(page).getByRole("link").elementHandles();
    expect(handles.length, "number of nav links").toBe(SCREENS.length);

    const reached: number[] = [];
    for (let i = 0; i < 40 && reached.length < SCREENS.length; i++) {
      await page.keyboard.press("Tab");
      const index = await page.evaluate(
        (links) => links.findIndex((l) => l === document.activeElement),
        handles,
      );
      if (index !== -1 && reached[reached.length - 1] !== index) reached.push(index);
    }
    // T1.11: compare each reached link's own visible label (icons are
    // aria-hidden, so it equals the accessible name, claim 3), not just its
    // position, so a nav with the old tabs can't pass this test.
    const reachedNames: string[] = [];
    for (const i of reached) {
      reachedNames.push(((await handles[i].textContent()) ?? "").replace(/\s+/g, " ").trim());
    }
    expect(reachedNames).toEqual(SCREENS.map((s) => s.name));
  });

  for (const screen of SCREENS) {
    test(`the "${screen.name}" link shows a visible focus indicator when reached by Tab`, async ({
      page,
    }) => {
      await open(page, "/");
      const link = navLink(page, screen.name);
      await tabUntilFocused(page, link);
      const focused = await focusStyle(link);

      const hasOutline =
        focused.outlineStyle !== "none" &&
        parseFloat(focused.outlineWidth) > 0 &&
        focused.outlineColor !== "rgba(0, 0, 0, 0)" &&
        focused.outlineColor !== "transparent";
      const hasShadow = focused.boxShadow !== "none";
      expect(
        hasOutline || hasShadow,
        `focused "${screen.name}" has an outline or box-shadow: ${JSON.stringify(focused)}`,
      ).toBe(true);

      await link.evaluate((el) => (el as HTMLElement).blur());
      const unfocused = await focusStyle(link);
      expect(
        unfocused,
        `"${screen.name}" focus indicator goes away when focus leaves`,
      ).not.toEqual(focused);
    });
  }

  test('pressing Enter on the Tab-focused "Events" link opens /events', async ({
    page,
  }) => {
    await open(page, "/");
    const link = navLink(page, "Events");
    await tabUntilFocused(page, link);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/events");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Events");
  });
});

// ---------- 14. bigger text (WCAG 1.4.4) ----------

const PHONE_WIDTH_PX = 390;
const EDGE_TOLERANCE_PX = 1;
// Known answers: Chromium's default root font size is 16 px, so 150% is
// 24 px and 200% is 32 px. Each test checks the size really took effect.
const TEXT_SIZES = [
  { percent: 150, rootPx: "24px" },
  { percent: 200, rootPx: "32px" },
] as const;

type TextSize = { readonly percent: number; readonly rootPx: string };

async function rootFontSize(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
}

/** Opens a page, then enlarges the root font size and checks it applied. */
async function openWithTextSize(page: Page, path: string, size: TextSize): Promise<void> {
  await open(page, path);
  await page.evaluate((percent) => {
    document.documentElement.style.fontSize = `${percent}%`;
  }, size.percent);
  expect(await rootFontSize(page), "root font size after enlarging").toBe(size.rootPx);
}

test.describe("on a phone, the navigation still works with bigger text", () => {
  for (const size of TEXT_SIZES) {
    for (const screen of SCREENS) {
      test(`on a phone at ${size.percent}% text on ${screen.name}, all five nav links are fully on screen horizontally`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        expect(page.viewportSize()?.width, "phone viewport width").toBe(PHONE_WIDTH_PX);
        await openWithTextSize(page, screen.path, size);
        // Measure all five first, so a failure lists every link that's off.
        const offScreen: string[] = [];
        for (const tab of SCREENS) {
          const b = await box(navLink(page, tab.name));
          const left = b.x;
          const right = b.x + b.width;
          if (left < -EDGE_TOLERANCE_PX || right > PHONE_WIDTH_PX + EDGE_TOLERANCE_PX) {
            offScreen.push(`${tab.name}: left ${left.toFixed(1)}, right ${right.toFixed(1)}`);
          }
        }
        expect(offScreen, `nav links outside 0–${PHONE_WIDTH_PX} px`).toEqual([]);
      });

      test(`on a phone at ${size.percent}% text on ${screen.name}, every nav link is at least 44×44 px`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        await openWithTextSize(page, screen.path, size);
        for (const tab of SCREENS) {
          const b = await box(navLink(page, tab.name));
          expect(b.width, `"${tab.name}" width in CSS px`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
          expect(b.height, `"${tab.name}" height in CSS px`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
        }
      });

      test(`on a phone at ${size.percent}% text on ${screen.name}, the page doesn't scroll sideways`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        await openWithTextSize(page, screen.path, size);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(clientWidth, "page width (px)").toBe(PHONE_WIDTH_PX);
        expect(scrollWidth, "scrollable width (px) must not exceed the page width").toBeLessThanOrEqual(
          clientWidth,
        );
      });

      test(`on a phone at ${size.percent}% text on ${screen.name}, each nav link can be tapped and opens its page`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        for (const tab of SCREENS) {
          await openWithTextSize(page, screen.path, size);
          // A finger can only tap what's on screen. At 200% the nav is taller
          // than 25% of the 844 px screen (257 px = 30.5%), so under the
          // T1.3b rule it isn't pinned and sits after the page content: a
          // person scrolls down to it first. (A pinned nav is already on
          // screen, so this scroll changes nothing for it.)
          await navLink(page, tab.name).scrollIntoViewIfNeeded();
          await expect(navLink(page, tab.name), `"${tab.name}" is fully on screen`).toBeInViewport({
            ratio: 1,
          });
          await press(navLink(page, tab.name), true);
          await expect(page, `after tapping "${tab.name}"`).toHaveURL(tab.path);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(tab.name);
          // The bigger text must still be in place, or the tap proved nothing.
          expect(await rootFontSize(page), "root font size after tapping").toBe(size.rootPx);
        }
      });

      test(`on a phone at ${size.percent}% text on ${screen.name}, the end of the page isn't hidden behind the nav`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        await openWithTextSize(page, screen.path, size);
        // Scroll the window, and any element that scrolls, to the very bottom.
        await page.evaluate(() => {
          for (const el of [document.scrollingElement, ...Array.from(document.querySelectorAll("*"))]) {
            if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
          }
          window.scrollTo(0, document.documentElement.scrollHeight);
        });
        const navTop = (await box(mainNav(page))).y;
        // The lowest bottom edge of anything rendered inside <main> (its own
        // padding doesn't count, only real content).
        const contentBottom = await page.getByRole("main").evaluate((main) => {
          let lowest = -Infinity;
          for (const el of Array.from(main.querySelectorAll("*"))) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) lowest = Math.max(lowest, r.bottom);
          }
          return lowest;
        });
        expect(contentBottom, "main has rendered content").toBeGreaterThan(-Infinity);
        expect(
          contentBottom,
          `bottom of the page content (px) vs the nav's top edge at ${navTop.toFixed(1)} px`,
        ).toBeLessThanOrEqual(navTop + EDGE_TOLERANCE_PX);
      });
    }

    for (const name of HOME_BUTTONS) {
      test(`on a phone at ${size.percent}% text, Home's "${name}" is fully visible above the nav when scrolled into view`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        await openWithTextSize(page, "/", size);
        const control = homeControl(page, name);
        await expect(control).toBeVisible();
        await control.evaluate((el) => el.scrollIntoView({ block: "start" }));
        await expect(control, `"${name}" is fully on screen`).toBeInViewport({ ratio: 1 });
        const b = await box(control);
        const navTop = (await box(mainNav(page))).y;
        expect(b.y, `"${name}" top (px)`).toBeGreaterThanOrEqual(0);
        expect(
          b.y + b.height,
          `"${name}" bottom (px) vs the nav's top edge at ${navTop.toFixed(1)} px`,
        ).toBeLessThanOrEqual(navTop + EDGE_TOLERANCE_PX);
      });

      test(`on a phone at ${size.percent}% text, Home's "${name}" is at least 44×44 px and inside 0–390 px`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        await openWithTextSize(page, "/", size);
        const b = await box(homeControl(page, name));
        expect(b.width, "width in CSS px").toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
        expect(b.height, "height in CSS px").toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
        expect(b.x, "left edge (px)").toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
        expect(b.x + b.width, "right edge (px)").toBeLessThanOrEqual(PHONE_WIDTH_PX + EDGE_TOLERANCE_PX);
      });
    }
  }
});

// ---------- 15. when the nav is pinned: the 25% rule (WCAG 2.4.11) ----------

// The nav stays sticky unless its measured height is MORE than this share of
// the visible screen height (lead's decision, T1.3b).
const NAV_SHARE_LIMIT = 0.25;
// Allowed difference when a pixel value comes back as a CSS string, e.g. a
// height of 64.76190185 px written out as "64.7619px".
const CSS_NUMBER_TOLERANCE_PX = 0.01;

const SCREEN_SIZES = [
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 390, height: 664 },
  { width: 375, height: 667 },
] as const;
// Known answers again: 100% is 16 px, 200% is 32 px.
const FOCUS_TEXT_SIZES = [
  { percent: 100, rootPx: "16px" },
  { percent: 200, rootPx: "32px" },
] as const;
const TEXT_100 = FOCUS_TEXT_SIZES[0];
const TEXT_200 = FOCUS_TEXT_SIZES[1];

type Pinning = "sticky" | "static";

// Hand-worked expected outcomes of the 25% rule, for T1.3's nav. These are
// fixed known answers: the tests below don't recompute them.
//
// At 100% text (root 16 px): each tab is at least 4rem = 64 px tall (its icon
// 24 px + 2 px gap + a 16 px label line = 42 px fits inside), all five tabs
// fit on one row at every width here, and the nav adds a 1 px top border.
// The home-bar padding, env(safe-area-inset-bottom), is 0 in Chromium.
// So the nav is 64 + 1 = 65 px tall, and 25% of the screen is height ÷ 4.
//   390×844: 65 / 844 =  7.7%  (limit 211 px)    → sticky
//   390×664: 65 / 664 =  9.8%  (limit 166 px)    → sticky  (T1.3 had static)
//   375×667: 65 / 667 =  9.7%  (limit 166.75 px) → sticky  (T1.3 had static)
//   320×568: 65 / 568 = 11.4%  (limit 142 px)    → sticky  (T1.3 had static)
//   844×390: 65 / 390 = 16.7%  (limit 97.5 px)   → sticky  (T1.3 had static)
//   568×320: 65 / 320 = 20.3%  (limit 80 px)     → sticky  (T1.3 had static)
//   390×700: 65 / 700 =  9.3%  (limit 175 px)    → sticky  (T1.3 had static)
//   390×701: 65 / 701 =  9.3%  (limit 175.25 px) → sticky
//
// At 200% text (root 32 px): each row of tabs is 4rem = 128 px, so even one
// row plus the border is 129 px. Labels are 0.75rem = 24 px text below 640 px
// wide, so the tabs wrap.
// CHANGED (T1.11): the row counts below are redone for the new labels. The
// label widths are Geist's own glyph widths, measured once in Chromium as
// plain text (not the nav): at 24 px, regular weight, Home 64.6, Events 74.0,
// Expenses 105.7, Income 80.9, Settings 90.8 px; bold (the current tab) adds
// at most 8.2 px (Expenses 113.8). Each tab is its label plus 2 × 0.5rem =
// 32 px of padding (the 1.5rem = 48 px icon is narrower than every label):
//   Home 96.6, Events 106.0, Expenses 137.7, Income 112.9, Settings 122.8 px,
//   all five = 576.0 px.
//   320 wide: Home+Events = 202.6, + Expenses = 340.3 > 320 → row 1 is
//             Home, Events; Expenses+Income = 250.6 (258.8 if one is bold),
//             + Settings = 373.4 > 320 → row 2 is Expenses, Income; row 3 is
//             Settings → 3 × 128 + 1 = 385 px
//   375, 390 wide: Home+Events+Expenses = 340.3 (348.5 at most with bold),
//             + Income = 453.2 > 390 → 2 rows → 2 × 128 + 1 = 257 px
//   568 wide: all five = 576.0 > 568 → 2 rows (Settings wraps) → 257 px
//   844 wide: at 640 px and wider the labels are 0.875rem = 28 px (Home 75.4,
//             Events 86.3, Expenses 123.3, Income 94.4, Settings 106.0, plus
//             32 each = 645.3 px ≤ 844), so all five fit on 1 row → 129 px
// At 100% text the labels are 12 px (Home 32.3, Events 37.0, Expenses 52.8,
// Income 40.5, Settings 45.4, plus 16 px padding each = 288.0 px, at most
// 292.3 with bold), so all five fit on one row even at 320 wide.
// None of this changes an outcome. At 390 wide or narrower, 1 row at 200% is
// impossible whatever the labels (five tabs of at least 48 + 32 = 80 px =
// 400 px > 390), so the nav is at least 257 px, over 25% of every height
// tested at those widths (257 / 844 = 30.5%). At 568×320 and 844×390 even
// 1 row (129 px) is over 25% (40.3% and 33.1%).
//   320×568: 385 / 568 = 67.8% → static
//   568×320: 257 / 320 = 80.3% → static (even 1 row would be 40.3%)
//   390×844: 257 / 844 = 30.5% → static (T1.3 had sticky)
//   844×390: 129 / 390 = 33.1% → static
//   390×664: 257 / 664 = 38.7% → static
//   375×667: 257 / 667 = 38.5% → static
//   390×700: 257 / 700 = 36.7% → static
//   390×701: 257 / 701 = 36.7% → static (T1.3 had sticky)
const PINNING_CASES: readonly {
  width: number;
  height: number;
  size: TextSize;
  expected: Pinning;
}[] = [
  { width: 390, height: 844, size: TEXT_100, expected: "sticky" },
  { width: 390, height: 664, size: TEXT_100, expected: "sticky" },
  { width: 375, height: 667, size: TEXT_100, expected: "sticky" },
  { width: 320, height: 568, size: TEXT_100, expected: "sticky" },
  { width: 844, height: 390, size: TEXT_100, expected: "sticky" },
  { width: 568, height: 320, size: TEXT_100, expected: "sticky" },
  { width: 390, height: 700, size: TEXT_100, expected: "sticky" },
  { width: 390, height: 701, size: TEXT_100, expected: "sticky" },
  { width: 320, height: 568, size: TEXT_200, expected: "static" },
  { width: 568, height: 320, size: TEXT_200, expected: "static" },
  { width: 390, height: 844, size: TEXT_200, expected: "static" },
  { width: 844, height: 390, size: TEXT_200, expected: "static" },
  { width: 390, height: 664, size: TEXT_200, expected: "static" },
  { width: 375, height: 667, size: TEXT_200, expected: "static" },
  { width: 390, height: 700, size: TEXT_200, expected: "static" },
  { width: 390, height: 701, size: TEXT_200, expected: "static" },
];

/** Waits for the browser to finish layout and any scroll from focusing. */
function nextFrame(page: Page): Promise<unknown> {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/** The nav and each of its ancestors up to <html>, as "tag: position". */
function navAndAncestorPositions(page: Page): Promise<string[]> {
  return mainNav(page).evaluate((nav) => {
    const found: string[] = [];
    for (let el: Element | null = nav; el; el = el.parentElement) {
      found.push(`${el.tagName.toLowerCase()}: ${getComputedStyle(el).position}`);
    }
    return found;
  });
}

/** "sticky" if the nav or any ancestor is sticky or fixed, else "static". */
async function navPinning(page: Page): Promise<Pinning> {
  const positions = await navAndAncestorPositions(page);
  return positions.some((p) => p.endsWith(": sticky") || p.endsWith(": fixed"))
    ? "sticky"
    : "static";
}

/** The nav's own border-box height and the visible screen height, in px. */
async function navAndScreenHeight(page: Page) {
  await nextFrame(page);
  return mainNav(page).evaluate((nav) => ({
    navHeight: nav.getBoundingClientRect().height,
    screenHeight: window.innerHeight,
  }));
}

function describeShare(m: { navHeight: number; screenHeight: number }): string {
  return `nav ${m.navHeight} px of a ${m.screenHeight} px screen = ${((m.navHeight / m.screenHeight) * 100).toFixed(1)}%`;
}

/**
 * Asserts the nav's pinning. The nav may decide after a frame or two (it
 * measures itself), so this waits for the expected state, then checks it is
 * still the same two frames later, so a state that flips back can't pass.
 */
async function expectNavPinning(page: Page, expected: Pinning, context: string): Promise<void> {
  await nextFrame(page);
  await expect
    .poll(() => navPinning(page), { message: `nav pinning: ${context}` })
    .toBe(expected);
  await nextFrame(page);
  await nextFrame(page);
  const positions = await navAndAncestorPositions(page);
  expect(
    await navPinning(page),
    `nav pinning, still, two frames later: ${context}; positions: ${positions.join(", ")}`,
  ).toBe(expected);
}

/** Reads --nav-h from <html> as a number of px (NaN if it isn't set). */
function publishedNavHeight(page: Page): Promise<number> {
  return page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")),
  );
}

/** Reads the computed scroll-padding-bottom of <html>, raw and as px. */
function rootScrollPaddingBottom(page: Page) {
  return page.evaluate(() => {
    const raw = getComputedStyle(document.documentElement).scrollPaddingBottom;
    return { raw, px: parseFloat(raw) };
  });
}

/** Sets an inline style on the nav, as if its CSS had changed at runtime. */
function styleNav(page: Page, property: "paddingBottom" | "minHeight", value: string) {
  return mainNav(page).evaluate(
    (nav, [p, v]) => {
      (nav as HTMLElement).style[p as "paddingBottom" | "minHeight"] = v;
    },
    [property, value] as const,
  );
}

/** Makes <main> long: 3000 px of filler with a marker 1500 px down. */
async function makeMainLong(page: Page): Promise<void> {
  await page.getByRole("main").evaluate((main) => {
    const filler = document.createElement("div");
    filler.style.cssText = "height:3000px;flex:none;position:relative";
    const marker = document.createElement("div");
    marker.setAttribute("data-testid", "long-page-middle");
    marker.style.cssText = "position:absolute;top:1500px;height:10px;width:10px";
    filler.appendChild(marker);
    main.appendChild(filler);
  });
}

/** Adds 30 buttons to the end of <main>, so Tab must scroll past the nav. */
async function addFillerButtons(page: Page): Promise<void> {
  await page.getByRole("main").evaluate((main) => {
    for (let i = 1; i <= 30; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Filler ${i}`;
      button.style.cssText = "display:block;height:3rem;margin:1rem 0";
      main.appendChild(button);
    }
  });
}

/**
 * Presses Tab through every focusable, rendered element inside <main>. After
 * each press, the focused element must be fully on screen and must not
 * overlap the nav at all. Focus on nav links (or anything outside <main>) is
 * exempt. Fails if Tab doesn't reach every element in <main>.
 */
async function expectTabKeepsMainFocusClearOfNav(page: Page): Promise<void> {
  // Number every focusable, rendered element inside <main>.
  const count = await page.getByRole("main").evaluate((main) => {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const found = Array.from(main.querySelectorAll(selector)).filter(
      (el) => el.getClientRects().length > 0 && el.getAttribute("tabindex") !== "-1",
    );
    found.forEach((el, i) => el.setAttribute("data-focus-test", String(i)));
    return found.length;
  });

  const reached = new Set<number>();
  const maxPresses = count + SCREENS.length + 10;
  for (let press = 0; press < maxPresses && reached.size < count; press++) {
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
        label: `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`,
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        navTop: n.top,
        navBottom: n.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    if (state === null) continue; // focus is in the nav or elsewhere: exempt
    reached.add(state.index);
    const where = `${state.label} at top ${state.top.toFixed(1)}, bottom ${state.bottom.toFixed(1)}`;
    expect(state.top, `${where}: top is on screen`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(state.bottom, `${where}: bottom is on screen (height ${state.viewportHeight})`).toBeLessThanOrEqual(
      state.viewportHeight + EDGE_TOLERANCE_PX,
    );
    expect(state.left, `${where}: left is on screen`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(state.right, `${where}: right is on screen`).toBeLessThanOrEqual(
      state.viewportWidth + EDGE_TOLERANCE_PX,
    );
    const overlapsNav =
      state.bottom > state.navTop + EDGE_TOLERANCE_PX &&
      state.top < state.navBottom - EDGE_TOLERANCE_PX;
    expect(
      overlapsNav,
      `${where} overlaps the nav (top ${state.navTop.toFixed(1)}, bottom ${state.navBottom.toFixed(1)})`,
    ).toBe(false);
  }
  expect(reached.size, "focusable elements in <main> reached by Tab").toBe(count);
}

test.describe("on a phone, the navigation never hides focused content", () => {
  for (const viewport of SCREEN_SIZES) {
    const sizeLabel = `${viewport.width}×${viewport.height}`;
    for (const size of FOCUS_TEXT_SIZES) {
      for (const screen of SCREENS) {
        test(`on a phone at ${sizeLabel} and ${size.percent}% text on ${screen.name}, Tab never leaves a focused element in <main> hidden or under the nav`, async ({
          page,
        }, testInfo) => {
          test.skip(testInfo.project.name !== "phone", "phone-layout claim");
          await page.setViewportSize(viewport);
          await openWithTextSize(page, screen.path, size);

          await expectTabKeepsMainFocusClearOfNav(page);
        });
      }
    }
  }

  // A page long enough that Tab must scroll focus past the nav: 30 extra
  // buttons at the end of <main>. At 100% the nav is sticky on all four of
  // these screens, so the page has to scroll each button clear of it.
  const longPageSizes = [
    { width: 390, height: 844 },
    { width: 390, height: 664 },
    { width: 375, height: 667 },
    { width: 568, height: 320 },
  ] as const;
  for (const viewport of longPageSizes) {
    for (const size of FOCUS_TEXT_SIZES) {
      test(`on a phone at ${viewport.width}×${viewport.height} and ${size.percent}% text, Tab through a long page keeps each focused element clear of the nav`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        await page.setViewportSize(viewport);
        await openWithTextSize(page, "/", size);
        await addFillerButtons(page);
        await expectTabKeepsMainFocusClearOfNav(page);
      });
    }
  }

  // The nav grows by 40 px of padding after load (65 → 105 px at 390×844,
  // 105 / 844 = 12.4%, so it stays sticky). The scroll padding must grow too.
  test("on a phone at 390×844, Tab through a long page keeps focus clear of the nav after only the nav's padding grows", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithTextSize(page, "/", TEXT_100);
    await addFillerButtons(page);
    await styleNav(page, "paddingBottom", "40px");
    await expectNavPinning(page, "sticky", "390×844 at 100% with 40 px extra padding (105 / 844 = 12.4%)");
    await expectTabKeepsMainFocusClearOfNav(page);
  });

  const narrow = { width: 320, height: 568 } as const;
  for (const screen of SCREENS) {
    test(`on a phone at 320×568 and 200% text on ${screen.name}, the page doesn't scroll sideways`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await page.setViewportSize(narrow);
      await openWithTextSize(page, screen.path, TEXT_200);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(clientWidth, "page width (px)").toBe(narrow.width);
      expect(scrollWidth, "scrollable width (px) must not exceed the page width").toBeLessThanOrEqual(clientWidth);
    });

    test(`on a phone at 320×568 and 200% text on ${screen.name}, the h1 text stays inside 0–320 px`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await page.setViewportSize(narrow);
      await openWithTextSize(page, screen.path, TEXT_200);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveCount(1);
      // Measure the text itself, so text that spills out of (or is clipped
      // by) its box is caught.
      const text = await h1.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        return { left: r.left, right: r.right };
      });
      expect(text.left, "h1 text left edge (px)").toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
      expect(text.right, "h1 text right edge (px)").toBeLessThanOrEqual(narrow.width + EDGE_TOLERANCE_PX);
    });
  }
});

test.describe("on a phone, the navigation is pinned unless it's taller than 25% of the screen", () => {
  for (const c of PINNING_CASES) {
    const label = `${c.width}×${c.height} and ${c.size.percent}% text`;

    // Known answers, worked by hand above PINNING_CASES.
    for (const screen of SCREENS) {
      test(`on a phone at ${label} on ${screen.name}, the nav is ${c.expected === "sticky" ? "sticky" : "not sticky or fixed"}`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        await page.setViewportSize({ width: c.width, height: c.height });
        await openWithTextSize(page, screen.path, c.size);
        const m = await navAndScreenHeight(page);
        await expectNavPinning(page, c.expected, `${label} on ${screen.name}: ${describeShare(m)}`);
      });
    }

    // The rule itself, against the height measured in the browser. This
    // catches a nav that matches the table above for the wrong reason.
    test(`on a phone at ${label}, on every screen the nav is sticky exactly when its measured height is at most 25% of the screen`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await page.setViewportSize({ width: c.width, height: c.height });
      for (const screen of SCREENS) {
        await openWithTextSize(page, screen.path, c.size);
        const m = await navAndScreenHeight(page);
        expect(m.screenHeight, "visible screen height (px)").toBe(c.height);
        const byRule: Pinning = m.navHeight > NAV_SHARE_LIMIT * m.screenHeight ? "static" : "sticky";
        await expectNavPinning(page, byRule, `${label} on ${screen.name}: ${describeShare(m)}`);
      }
    });

    if (c.expected === "sticky") {
      test(`on a phone at ${label}, on every screen the sticky nav's bottom edge stays on the bottom of the screen while a long page scrolls`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        await page.setViewportSize({ width: c.width, height: c.height });
        for (const screen of SCREENS) {
          await openWithTextSize(page, screen.path, c.size);
          await makeMainLong(page);
          const marker = page.getByTestId("long-page-middle");
          expect((await box(marker)).y, `${screen.name}: the marker starts below the screen`).toBeGreaterThan(c.height);
          for (const moment of ["at the top of the page", "scrolled halfway down"]) {
            if (moment === "scrolled halfway down") {
              await marker.evaluate((el) => el.scrollIntoView({ block: "center" }));
              await nextFrame(page);
              const mk = await box(marker);
              expect(mk.y, `${screen.name}: the marker scrolled onto the screen`).toBeLessThan(c.height);
            }
            const b = await box(mainNav(page));
            expect(
              Math.abs(b.y + b.height - c.height),
              `${screen.name} ${moment}: gap between the nav's bottom and the screen's bottom (px)`,
            ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
          }
        }
      });

      // T1.3's gap: at a height between 700 and 701 px, the nav was sticky
      // with no scroll padding. Any sticky nav must come with enough padding.
      test(`on a phone at ${label}, the sticky nav has scroll-padding-bottom on <html> at least its own height`, async ({
        page,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "phone", "phone-layout claim");
        await page.setViewportSize({ width: c.width, height: c.height });
        await openWithTextSize(page, "/", c.size);
        await expectNavPinning(page, "sticky", label);
        const m = await navAndScreenHeight(page);
        const padding = await rootScrollPaddingBottom(page);
        expect(
          padding.px,
          `scroll-padding-bottom "${padding.raw}" vs the nav's height ${m.navHeight} px`,
        ).toBeGreaterThanOrEqual(m.navHeight - CSS_NUMBER_TOLERANCE_PX);
      });
    } else {
      for (const screen of SCREENS) {
        test(`on a phone at ${label} on ${screen.name}, scrolling reaches the end of the page with the nav last`, async ({
          page,
        }, testInfo) => {
          test.skip(testInfo.project.name !== "phone", "phone-layout claim");
          await page.setViewportSize({ width: c.width, height: c.height });
          await openWithTextSize(page, screen.path, c.size);
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await nextFrame(page);
          const m = await page.evaluate(() => {
            const nav = document.querySelector('nav[aria-label="Main"]')!.getBoundingClientRect();
            const main = document.querySelector("main")!;
            let contentBottom = -Infinity;
            for (const el of Array.from(main.querySelectorAll("*"))) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) contentBottom = Math.max(contentBottom, r.bottom);
            }
            return {
              navTop: nav.top,
              navBottom: nav.bottom,
              contentBottom,
              viewportHeight: window.innerHeight,
            };
          });
          expect(
            Math.abs(m.navBottom - m.viewportHeight),
            "scrolled to the end, the nav's bottom is the bottom of the screen (px gap)",
          ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
          expect(m.contentBottom, "main has rendered content").toBeGreaterThan(-Infinity);
          expect(
            m.contentBottom,
            `end of <main>'s content (px) vs the nav's top at ${m.navTop.toFixed(1)}`,
          ).toBeLessThanOrEqual(m.navTop + EDGE_TOLERANCE_PX);
        });
      }
    }
  }

  // The boundary, with the nav's height set exactly at runtime (min-height
  // on its border box; its content is only 65 px at 100% text). 25% of 844 px
  // is 844 ÷ 4 = 211 px exactly.
  //   211 / 844 = 25.000% → not MORE than 25% → sticky
  //   212 / 844 = 25.118% → static
  // These also prove the rule follows the measured height, not the screen
  // size or the text size: the screen and text stay the same throughout.
  test("on a phone at 390×844, a nav grown to exactly 25% of the screen (211 px) is still sticky", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithTextSize(page, "/", TEXT_100);
    await styleNav(page, "minHeight", "211px");
    await expect.poll(async () => (await navAndScreenHeight(page)).navHeight, { message: "nav height (px)" }).toBe(211);
    await expectNavPinning(page, "sticky", "211 / 844 = 25.000%");
  });

  test("on a phone at 390×844, a nav grown to 1 px over 25% of the screen (212 px) is not sticky or fixed", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithTextSize(page, "/", TEXT_100);
    await expectNavPinning(page, "sticky", "65 / 844 = 7.7% before growing");
    await styleNav(page, "minHeight", "212px");
    await expect.poll(async () => (await navAndScreenHeight(page)).navHeight, { message: "nav height (px)" }).toBe(212);
    await expectNavPinning(page, "static", "212 / 844 = 25.118%");
  });

  test("on a phone at 390×844, a nav that grew over 25% and shrinks back to 211 px is sticky again", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithTextSize(page, "/", TEXT_100);
    await styleNav(page, "minHeight", "212px");
    await expectNavPinning(page, "static", "212 / 844 = 25.118%");
    await styleNav(page, "minHeight", "211px");
    await expect.poll(async () => (await navAndScreenHeight(page)).navHeight, { message: "nav height (px)" }).toBe(211);
    await expectNavPinning(page, "sticky", "211 / 844 = 25.000%");
  });

  // Only the screen height changes; the nav's own size doesn't, so watching
  // the nav alone isn't enough. A 200 px nav (min-height):
  //   200 / 844 = 23.7% → sticky
  //   200 / 780 = 25.6% → static
  test("on a phone, when only the screen height changes, the nav's pinning is re-decided (200 px nav: 390×844 sticky, 390×780 static, 390×844 sticky)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithTextSize(page, "/", TEXT_100);
    await styleNav(page, "minHeight", "200px");
    await expect.poll(async () => (await navAndScreenHeight(page)).navHeight, { message: "nav height (px)" }).toBe(200);
    await expectNavPinning(page, "sticky", "200 / 844 = 23.7%");

    await page.setViewportSize({ width: 390, height: 780 });
    expect(await navAndScreenHeight(page), "only the screen height changed").toEqual({
      navHeight: 200,
      screenHeight: 780,
    });
    await expectNavPinning(page, "static", "200 / 780 = 25.6%");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNavPinning(page, "sticky", "200 / 844 = 23.7% again");
  });

  // The boundary case keeps its scroll padding too: a 211 px sticky nav needs
  // at least 211 px of scroll-padding-bottom.
  test("on a phone at 390×844, a nav grown to exactly 25% (211 px) has scroll-padding-bottom on <html> of at least 211 px", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithTextSize(page, "/", TEXT_100);
    await styleNav(page, "minHeight", "211px");
    await expectNavPinning(page, "sticky", "211 / 844 = 25.000%");
    await expect
      .poll(async () => (await rootScrollPaddingBottom(page)).px, {
        message: "scroll-padding-bottom on <html> (px)",
      })
      .toBeGreaterThanOrEqual(211 - CSS_NUMBER_TOLERANCE_PX);
  });
});

test.describe("on a phone, the nav publishes its measured height as --nav-h", () => {
  // Review note on T1.3: observing only the content box misses a change in
  // padding. Known answer: the nav grows by exactly the 40 px of padding
  // added (its bottom padding is env(safe-area-inset-bottom) = 0 in
  // Chromium), e.g. 65 → 105 px at 100% text.
  test("on a phone at 390×844, adding 40 px of bottom padding to the nav grows it by exactly 40 px and --nav-h follows its new border-box height", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithTextSize(page, "/", TEXT_100);
    const before = await navAndScreenHeight(page);
    await expect
      .poll(() => publishedNavHeight(page), { message: "--nav-h before the change (px)" })
      .toBeCloseTo(before.navHeight, 2);

    await styleNav(page, "paddingBottom", "40px");
    const after = await navAndScreenHeight(page);
    expect(after.navHeight - before.navHeight, "growth of the nav's border box (px)").toBeCloseTo(40, 2);
    await expect
      .poll(() => publishedNavHeight(page), { message: `--nav-h after the change vs the nav's ${after.navHeight} px` })
      .toBeCloseTo(after.navHeight, 2);
  });

  test("on a phone at 390×844, after only the nav's padding grows by 40 px, scroll-padding-bottom on <html> is at least the nav's new height", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithTextSize(page, "/", TEXT_100);
    await styleNav(page, "paddingBottom", "40px");
    // 105 / 844 = 12.4%, so the nav is still sticky.
    await expectNavPinning(page, "sticky", "105 / 844 = 12.4%");
    const after = await navAndScreenHeight(page);
    await expect
      .poll(async () => (await rootScrollPaddingBottom(page)).px, {
        message: `scroll-padding-bottom on <html> (px) vs the nav's ${after.navHeight} px`,
      })
      .toBeGreaterThanOrEqual(after.navHeight - CSS_NUMBER_TOLERANCE_PX);
  });
});

// ---------- 16, 17, 18. /reports removed, /transactions out of the tabs ----------

/**
 * The resolved path of every link inside `scope` that is `prefix` itself or
 * anything under it (e.g. "/reports", "/reports/2026"). Query strings and
 * fragments don't hide a link: only the path is compared.
 */
function linkPathsUnder(scope: Locator, prefix: string): Promise<string[]> {
  return scope.evaluate(
    (root, p) =>
      Array.from(root.querySelectorAll("a[href]"))
        .map((a) => new URL((a as HTMLAnchorElement).href).pathname)
        .filter((path) => path === p || path.startsWith(`${p}/`)),
    prefix,
  );
}

test.describe("/reports is removed (T1.11)", () => {
  test("a browser opening /reports gets HTTP 404", async ({ page }) => {
    const response = await page.goto(REPORTS_PATH);
    expect(response?.status(), `HTTP status of ${REPORTS_PATH}`).toBe(NOT_FOUND);
  });

  test("GET /reports, without following redirects, answers HTTP 404", async ({ request }) => {
    const response = await request.get(REPORTS_PATH, { maxRedirects: 0 });
    expect(response.status(), `HTTP status of ${REPORTS_PATH}`).toBe(NOT_FOUND);
  });

  test("the build made without the test flag (port 3001) answers GET /reports with HTTP 404", async ({
    request,
  }) => {
    const response = await request.get(`${FLAG_OFF_BASE_URL}${REPORTS_PATH}`, { maxRedirects: 0 });
    expect(response.status(), `HTTP status of ${FLAG_OFF_BASE_URL}${REPORTS_PATH}`).toBe(NOT_FOUND);
  });

  for (const screen of SCREENS) {
    test(`${screen.name} (${screen.path}) has no link anywhere that leads to /reports`, async ({
      page,
    }) => {
      await open(page, screen.path);
      expect(
        await linkPathsUnder(page.locator("body"), REPORTS_PATH),
        `links on ${screen.name} whose path is ${REPORTS_PATH} or under it`,
      ).toEqual([]);
    });
  }
});

test.describe("Transactions is no longer a tab (T1.11)", () => {
  // CHANGED (T1.17b): /transactions itself left this list (it's a 404 now, claim 18).
  for (const path of SCREENS.map((s) => s.path)) {
    test(`on ${path}, the "Main" navigation has no link that leads to /transactions`, async ({
      page,
    }) => {
      await open(page, path);
      await expect(mainNav(page)).toHaveCount(1);
      expect(
        await linkPathsUnder(mainNav(page), TRANSACTIONS_PATH),
        `nav links on ${path} whose path is ${TRANSACTIONS_PATH} or under it`,
      ).toEqual([]);
    });
  }
});

// Claim 18, CHANGED (T1.17b): the TEMPORARY "/transactions is still reachable"
// tests are retired (T1.17b removes the page). Replaced by these.

/** Every page that stays, where no link may lead to /transactions (claim 18). */
const PAGES_WITHOUT_TRANSACTIONS_LINKS = [
  ...SCREENS.map((s) => s.path),
  "/events/pretend-event-comic-con",
  "/events/pretend-event-todays-market",
  "/events/pretend-event-shelf",
  "/income/sales-at-events",
  "/income/online-sales",
  "/income/wholesale",
  "/income/commissions",
  "/income/vendor-shelf-rental",
  "/income/social-media",
  "/income/subscription-income",
  "/expenses/new",
  "/income/new",
] as const;

test.describe("/transactions is removed (T1.17b)", () => {
  test("a browser opening /transactions gets HTTP 404", async ({ page }) => {
    const response = await page.goto(TRANSACTIONS_PATH);
    expect(response?.status(), `HTTP status of ${TRANSACTIONS_PATH}`).toBe(NOT_FOUND);
  });

  // (No "/transactions/" case: Next.js answers any trailing slash with its own 308 to the
  // address without it, which then 404s; that redirect isn't the page.)
  for (const path of [TRANSACTIONS_PATH, `${TRANSACTIONS_PATH}/2026`]) {
    test(`GET ${path}, without following redirects, answers HTTP 404 (test build)`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), `HTTP status of ${path}`).toBe(NOT_FOUND);
    });

    test(`GET ${path}, without following redirects, answers HTTP 404 (build without the test flag, port 3001)`, async ({
      request,
    }) => {
      const response = await request.get(`${FLAG_OFF_BASE_URL}${path}`, { maxRedirects: 0 });
      expect(response.status(), `HTTP status of ${FLAG_OFF_BASE_URL}${path}`).toBe(NOT_FOUND);
    });
  }

  for (const path of PAGES_WITHOUT_TRANSACTIONS_LINKS) {
    test(`${path} has no link anywhere that leads to /transactions`, async ({ page }) => {
      await open(page, path);
      // After hydration too, so a link added only in the browser is seen.
      await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--nav-h") !== "");
      expect(
        await linkPathsUnder(page.locator("body"), TRANSACTIONS_PATH),
        `links on ${path} whose path is ${TRANSACTIONS_PATH} or under it`,
      ).toEqual([]);
    });
  }
});

// ---------- 12. no uncaught errors, end to end ----------

test("visiting every screen and tapping through every tab throws no uncaught errors", async ({
  page,
  uncaughtPageErrors,
}, testInfo) => {
  for (const screen of SCREENS) await open(page, screen.path);
  await open(page, "/");
  for (const screen of SCREENS) {
    await press(navLink(page, screen.name), !!testInfo.project.use.hasTouch);
    await expect(page).toHaveURL(screen.path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(screen.name);
  }
  // The automatic check also runs after the test; this makes the claim explicit.
  expect(uncaughtPageErrors).toEqual([]);
});
