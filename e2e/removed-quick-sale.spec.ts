// The quick-sale pad is gone (T1.8, docs/stages/stage-01.md).
// Guide: DECISIONS.md "What the app is for" and "Quick-sale pad" (owner,
// 2026-10-25). These replace §10's live cash-sale design ("Designing cash-sale
// entry for a busy stall") and §17 Stage 1's "quick-sale number pad": the app
// tracks how an event went AFTER the fact, so there is no live sale pad.
//
// Written by the test engineer BEFORE the code is deleted. Builders must not
// edit this file; report a disputed test to the project lead instead.
//
// Every test runs in both Playwright projects (phone 390×844 and desktop).
//
// ═══ CLAIMS ═════════════════════════════════════════════════════════════════
//
// R1. /sale no longer exists. A browser opening it gets HTTP 404, and a plain
//     GET that does NOT follow redirects gets 404 too, so sending people
//     somewhere else (a 3xx to Home) doesn't count as removing it. This holds
//     for both servers in playwright.config.ts: the test build (port 3000,
//     the baseURL) and the build made without the test flag (port 3001,
//     built exactly the way Cloudflare builds the live app).
//
// R2. Home has no way into the pad:
//     - no link or button whose accessible name contains the whole word
//       "Sale" in any letter case ("+ Sale", "Quick sale", "Add sale" all
//       count; "Sales" on its own does not, so later income-stream names like
//       "Sales at events" (T1.10+) don't trip this);
//     - no link whose address leads to /sale (or anything under /sale/).
//     Home keeps exactly one visible "+ Expense" control (app-shell claim 8).
//
// R3. No uncaught errors and no React hydration errors during any test in
//     this file (same fixture as entries-list.spec.ts D9 and expense-form F10).
//
// NOT claimed here (still true until T1.10 replaces them, and covered by
// entries-list.spec.ts): the store's "sale" entries, the add-sale action and
// the window.__bentoTest.addSale seam stay. The new "+" button, navigation and
// income forms are later cards and aren't anticipated.

import { expect, test as base, type Page } from "@playwright/test";

/** The test build (playwright.config.ts baseURL) answers relative paths. */
const PAD_PATH = "/sale";
/** The second server, built without NEXT_PUBLIC_E2E (as Cloudflare builds it). */
const FLAG_OFF_BASE_URL = "http://localhost:3001";
const NOT_FOUND = 404;

// ---------- fixture: no uncaught errors, no hydration errors (R3) ----------

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

// ---------- helpers ----------

/** Opens Home, requires HTTP 200 and waits until the page has hydrated. */
async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status(), "HTTP status of /").toBe(200);
  // The nav publishes --nav-h on <html> once it runs in the browser
  // (app-shell claim 15), so this means the client code is live.
  await page.waitForFunction(
    () => document.documentElement.style.getPropertyValue("--nav-h") !== "",
  );
}

// ═══ R1. /sale is a 404 ═════════════════════════════════════════════════════

test.describe("the quick-sale pad's page is gone", () => {
  test("a browser opening /sale gets HTTP 404", async ({ page }) => {
    const response = await page.goto(PAD_PATH);
    expect(response?.status(), `HTTP status of ${PAD_PATH}`).toBe(NOT_FOUND);
  });

  test("GET /sale, without following redirects, answers HTTP 404", async ({ request }) => {
    const response = await request.get(PAD_PATH, { maxRedirects: 0 });
    expect(response.status(), `HTTP status of ${PAD_PATH}`).toBe(NOT_FOUND);
  });

  test("the build made without the test flag (port 3001) answers GET /sale with HTTP 404", async ({
    request,
  }) => {
    const response = await request.get(`${FLAG_OFF_BASE_URL}${PAD_PATH}`, { maxRedirects: 0 });
    expect(response.status(), `HTTP status of ${FLAG_OFF_BASE_URL}${PAD_PATH}`).toBe(NOT_FOUND);
  });
});

// ═══ R2. Home has no way into the pad ═══════════════════════════════════════

test.describe("Home has no quick-sale control", () => {
  test('Home has no link or button whose name contains the word "Sale"', async ({ page }) => {
    await openHome(page);
    // \b on both sides: "Sale", "+ Sale", "Quick sale" match; "Sales" doesn't.
    const saleWord = /\bsale\b/i;
    await expect(page.getByRole("link", { name: saleWord })).toHaveCount(0);
    await expect(page.getByRole("button", { name: saleWord })).toHaveCount(0);
  });

  test("Home has no link that leads to /sale", async ({ page }) => {
    await openHome(page);
    // Every link's resolved address, kept only if its path is /sale or under it.
    const toPad = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => new URL((a as HTMLAnchorElement).href).pathname)
        .filter((path) => path === "/sale" || path.startsWith("/sale/")),
    );
    expect(toPad, "links on Home whose path is /sale").toEqual([]);
  });

  test('Home still has exactly one visible "+ Expense" control', async ({ page }) => {
    await openHome(page);
    const expense = page
      .getByRole("button", { name: "+ Expense", exact: true })
      .or(page.getByRole("link", { name: "+ Expense", exact: true }));
    await expect(expense).toHaveCount(1);
    await expect(expense).toBeVisible();
  });
});

// ═══ R3. Home still loads cleanly ═══════════════════════════════════════════

test.describe("Home without the pad", () => {
  test("Home loads and hydrates with no uncaught or hydration errors", async ({ page, pageProblems }) => {
    await openHome(page);
    // Checked here as well as in the fixture, so this test's own claim is
    // explicit: removing the button mustn't break Home in the browser.
    expect(pageProblems, "uncaught or hydration errors on Home").toEqual([]);
  });
});
