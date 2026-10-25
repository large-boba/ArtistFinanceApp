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
