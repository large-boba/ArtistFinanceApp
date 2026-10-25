// App shell tests (T1.3): the starter page is gone, and a bottom navigation
// bar with five tabs works by touch, by mouse and by keyboard.
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
//      Home → /    Transactions → /transactions    Events → /events
//      Reports → /reports    Settings → /settings
//    Each answers HTTP 200.
//
// 2. Page titles (lead's decision, WCAG 2.4.2: each page has its own title).
//    Exact matches, not "starts with":
//      Home → "BentoBudget"
//      every other screen → "<Screen> · BentoBudget", with a middle dot
//      (U+00B7) and one space on each side, e.g. "Reports · BentoBudget".
//
// 3. Navigation landmark. Exactly one `<nav>` whose accessible name is exactly
//    "Main" (e.g. `<nav aria-label="Main">`), on every page. It contains
//    exactly five links, in DOM order: Home, Transactions, Events, Reports,
//    Settings. Each link's accessible name is exactly that word (icons must be
//    `aria-hidden` so they don't add to the name), and its `href` is exactly
//    the path above.
//
// 4. Current tab. The link for the page you're on has `aria-current="page"`.
//    The other four have no `aria-current` attribute at all. The current tab
//    must also LOOK different: some computed style (colour, background, font
//    weight, border, underline, shadow, opacity) of the link or something
//    inside it differs from the other tabs, with no hover or focus involved.
//
// 5. Headings. Each page has exactly one level-1 heading, whose text is
//    exactly the screen's name ("Home", "Transactions", ...).
//
// 6. Main landmark. Each page has exactly one `<main>` for its content, and
//    the navigation is outside it.
//
// 7. Empty screens. Events, Reports and Settings say they're coming later
//    with a short note matching /coming in Stage \d+/i. (Transactions isn't
//    checked here because T1.6 replaces its placeholder with the entries list.)
//
// 8. Home buttons. Home has exactly one control (a <button> or a link) whose
//    accessible name is exactly "+ Sale", and exactly one named exactly
//    "+ Expense". The name equals the visible label, so speech-input users can
//    say what they see (WCAG 2.5.3); screen readers read it as "plus Sale".
//
// 9. Tap targets. Every nav link and both Home buttons are at least 44×44
//    CSS pixels (their own bounding box, not a parent's).
//
// 10. Phone layout (390×844). The nav is visible, inside the screen's width,
//     and its bottom edge is the bottom of the viewport (within 1 px) on every
//     page, and it stays there while a long page scrolls underneath. On Home,
//     both buttons are fully on screen without scrolling and not covered by
//     the nav.
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
//     each can be tapped and opens its page, and the page doesn't scroll
//     sideways (scrollWidth ≤ clientWidth). The tests set
//     `document.documentElement.style.fontSize`, the way a browser text-size
//     setting scales everything sized in rem. Labels may wrap, shrink to an
//     icon with an accessible name, or the bar may grow taller; all five tabs
//     must stay reachable.
//     Content must not hide behind a taller nav either, at 150% and 200% on
//     every page: after scrolling to the very bottom, the lowest-ending
//     element inside <main> ends at or above the nav's top edge (within
//     1 px). On Home, "+ Sale" and "+ Expense", once scrolled to the top of
//     the screen (`scrollIntoView({ block: "start" })`, the most a person
//     can scroll them up), are fully on screen and end at or above the nav's
//     top edge. Both are still at least 44×44 px and inside 0–390 px.
//
// 15. Short and landscape screens (WCAG 2.4.11 Focus not obscured; lead's
//     design decision after the T1.3 re-review). Tested in the phone project
//     at 320×568, 568×320, 390×844 and 844×390, each at 100% and 200% text:
//     - On a screen 700 CSS px tall or less, the nav is NOT sticky or fixed
//       (neither it nor any ancestor has computed position sticky/fixed). It
//       sits in the normal page flow after <main>, so it never covers
//       content. Scrolled to the very bottom, the nav is the last thing on
//       the page and all of <main>'s content ends above it.
//     - On taller screens it stays sticky at the bottom (the earlier tests at
//       390×844 still apply), and the page must scroll a focused element
//       clear of it (e.g. with scroll-padding-bottom).
//     - Either way, pressing Tab through every focusable element in <main>
//       leaves each one fully on screen and not overlapped by the nav at all.
//       Nav links are exempt.
//     - At 320 px wide and 200% text, no page scrolls sideways
//       (scrollWidth ≤ clientWidth), and each page's h1 text stays inside
//       0–320 px (long words like "Transactions" must wrap, not overflow or
//       get clipped).
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
const SCREENS = [
  { name: "Home", path: "/", title: "BentoBudget" },
  { name: "Transactions", path: "/transactions", title: "Transactions \u00B7 BentoBudget" },
  { name: "Events", path: "/events", title: "Events \u00B7 BentoBudget" },
  { name: "Reports", path: "/reports", title: "Reports \u00B7 BentoBudget" },
  { name: "Settings", path: "/settings", title: "Settings \u00B7 BentoBudget" },
] as const;

type Screen = (typeof SCREENS)[number];

// Screens that stay empty for all of Stage 1, so they show a "coming" note.
const PLACEHOLDER_SCREENS = SCREENS.filter((s) =>
  ["Events", "Reports", "Settings"].includes(s.name),
);

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

/** The Home control with this exact accessible name, as a button or a link. */
function homeControl(page: Page, name: "+ Sale" | "+ Expense"): Locator {
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
    test(`on ${screen.name}, the "Main" navigation lists exactly Home, Transactions, Events, Reports, Settings in that order`, async ({
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
});

// ---------- 8. Home buttons ----------

test.describe("Home's two big buttons", () => {
  for (const name of ["+ Sale", "+ Expense"] as const) {
    test(`Home has exactly one visible control named "${name}"`, async ({
      page,
    }) => {
      await open(page, "/");
      const control = homeControl(page, name);
      await expect(control).toHaveCount(1);
      await expect(control).toBeVisible();
    });
  }

  test("on a phone, + Sale and + Expense are fully on screen above the navigation without scrolling", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "phone-layout claim");
    await open(page, "/");
    const navTop = (await box(mainNav(page))).y;
    for (const name of ["+ Sale", "+ Expense"] as const) {
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

  for (const name of ["+ Sale", "+ Expense"] as const) {
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
    expect(reached.map((i) => SCREENS[i].name)).toEqual(SCREENS.map((s) => s.name));
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
          // A finger can only tap what's on screen.
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

    for (const name of ["+ Sale", "+ Expense"] as const) {
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

// ---------- 15. short and landscape screens (WCAG 2.4.11) ----------

const SHORT_SCREEN_MAX_HEIGHT_PX = 700;
const SCREEN_SIZES = [
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
] as const;
// Known answers again: 100% is 16 px, 200% is 32 px.
const FOCUS_TEXT_SIZES = [
  { percent: 100, rootPx: "16px" },
  { percent: 200, rootPx: "32px" },
] as const;

/** Waits for the browser to finish layout and any scroll from focusing. */
function nextFrame(page: Page): Promise<unknown> {
  return page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
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

test.describe("on a phone, the navigation never hides content on short or landscape screens", () => {
  for (const viewport of SCREEN_SIZES) {
    const sizeLabel = `${viewport.width}×${viewport.height}`;
    const isShort = viewport.height <= SHORT_SCREEN_MAX_HEIGHT_PX;

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

        if (isShort) {
          test(`on a phone at ${sizeLabel} and ${size.percent}% text on ${screen.name}, the nav isn't sticky or fixed`, async ({
            page,
          }, testInfo) => {
            test.skip(testInfo.project.name !== "phone", "phone-layout claim");
            await page.setViewportSize(viewport);
            await openWithTextSize(page, screen.path, size);
            const positions = await mainNav(page).evaluate((nav) => {
              const found: string[] = [];
              for (let el: Element | null = nav; el; el = el.parentElement) {
                found.push(`${el.tagName.toLowerCase()}: ${getComputedStyle(el).position}`);
              }
              return found;
            });
            const pinned = positions.filter((p) => p.endsWith(": sticky") || p.endsWith(": fixed"));
            expect(pinned, `positions of the nav and its ancestors: ${positions.join(", ")}`).toEqual([]);
          });

          test(`on a phone at ${sizeLabel} and ${size.percent}% text on ${screen.name}, scrolling reaches the end of the page with the nav last`, async ({
            page,
          }, testInfo) => {
            test.skip(testInfo.project.name !== "phone", "phone-layout claim");
            await page.setViewportSize(viewport);
            await openWithTextSize(page, screen.path, size);
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
  }

  // The tall screen keeps a sticky nav, so make a page long enough that Tab
  // must scroll focus past it: 30 extra buttons at the end of <main>.
  for (const size of FOCUS_TEXT_SIZES) {
    test(`on a phone at 390×844 and ${size.percent}% text, Tab through a long page scrolls each focused element clear of the sticky nav`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await page.setViewportSize({ width: 390, height: 844 });
      await openWithTextSize(page, "/", size);
      await page.getByRole("main").evaluate((main) => {
        for (let i = 1; i <= 30; i++) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = `Filler ${i}`;
          button.style.cssText = "display:block;height:3rem;margin:1rem 0";
          main.appendChild(button);
        }
      });
      await expectTabKeepsMainFocusClearOfNav(page);
    });
  }

  const narrow = { width: 320, height: 568 } as const;
  const big = FOCUS_TEXT_SIZES[1];
  for (const screen of SCREENS) {
    test(`on a phone at 320×568 and 200% text on ${screen.name}, the page doesn't scroll sideways`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "phone", "phone-layout claim");
      await page.setViewportSize(narrow);
      await openWithTextSize(page, screen.path, big);
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
      await openWithTextSize(page, screen.path, big);
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
