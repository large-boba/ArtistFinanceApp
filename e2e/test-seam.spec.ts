// The test seam's locks (moved here from entries-list.spec.ts in T1.17b,
// docs/stages/stage-01.md "T1.17b — Retire the old Transactions page").
// The claims S0–S6 are UNCHANGED IN STRENGTH. The only edits:
//   - S1 and S5 used to finish with a client-side move to /transactions,
//     which T1.17b removes. They now move to the Expenses tab (/expenses)
//     instead, the same kind of move (window.next.router.push, proven not to
//     reload), and check its empty state "No expenses yet." where they
//     checked "No entries yet.". Marked CHANGED (T1.17b).
//   - ADDED (T1.17b): S4b, a second control showing the hook IS installed on
//     127.0.0.1, the other hostname lock 2 allows. Together with S4
//     (localhost) and S5 (any other hostname), lock 2 is now pinned from
//     both sides.
//
// Written by the test engineer BEFORE the code. Builders must not edit this
// file; report a disputed test to the project lead instead.
//
// ═══ WHY THE SEAM EXISTS, AND HOW IT IS LOCKED ══════════════════════════════
//
// The browser tests put pretend entries into the in-memory store through a
// small hook on `window` (it was added in T1.6, before any form existed; the
// specs still use it to set up what a page SHOWS quickly and exactly). It
// must be impossible for it to reach the live site, so it has TWO
// independent locks:
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
//     - The hook's code sits inside `if (process.env.NEXT_PUBLIC_E2E === "1")`
//       so it is removed from builds without the flag. The string
//       "__bentoTest" must not appear in any file of a flag-off build under
//       .next/static, nor in any non-source-map file under .next/server (S3).
//       CI also greps the Cloudflare package (.open-next/) for it
//       (.github/workflows/ci.yml, "Check the Cloudflare package has no test
//       seam").
//   Lock 2, run time. Even in a flagged build, the hook is installed only when
//     `window.location.hostname` is exactly "localhost" or "127.0.0.1".
//
// playwright.config.ts starts TWO servers (a `webServer` array):
//   - port 3000, the baseURL: built and started with NEXT_PUBLIC_E2E=1 (via
//     the webServer `env` option, so the runner's own environment is
//     unchanged);
//   - port 3001: built and started WITHOUT the variable (exactly what
//     Cloudflare builds).
//   The test runner itself must not have NEXT_PUBLIC_E2E set (S0).
//
// The hook, when both locks are open:
//   window.__bentoTest = {
//     addIncome(income: IncomeInput): void,
//     addExpense(expense: ExpenseInput): void,
//   }
//   - Each call does exactly what the real store does for a new entry: one
//     dispatch of "add-income"/"add-expense" with a fresh id. Nothing else:
//     no edit, delete, reset, reading of entries, URL parameter or storage
//     (S6: exactly these two functions).
//   - It is set by the entries provider (in the root layout) in a useEffect
//     once the page has hydrated, so it exists on every page, and it is
//     removed in that effect's cleanup. Tests wait for it to appear.
//
// S0. The test runner doesn't set NEXT_PUBLIC_E2E.
// S1. The flag-off build never has window.__bentoTest, also after a
//     client-side move to another screen.
// S2. The flag-on build (.next-e2e) does contain the name (so S3's scan can
//     find it).
// S3. No shipped file of the flag-off build (.next) mentions __bentoTest, and
//     the flagged build is in its own folder.
// S4. Control: the flagged build on localhost installs the hook.
// S4b. Control (ADDED, T1.17b): the flagged build on 127.0.0.1 installs it.
// S5. The flagged build reached under another hostname never installs it,
//     also after a client-side move.
// S6. The hook has exactly addExpense and addIncome.
// Every test also fails on an uncaught page error or a React hydration error.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test as base, type Page } from "@playwright/test";

// ---------- fixed facts ----------

const FROZEN_NOW = new Date("2026-06-30T15:30:00.000Z");
/** The production build WITHOUT NEXT_PUBLIC_E2E (second webServer). */
const FLAG_OFF_BASE_URL = "http://localhost:3001";
/** A hostname that is not localhost, mapped to this machine inside Chromium. */
const NON_LOCAL_HOST = "bentobudget-live.example";
const HOOK_NAME = "__bentoTest";
const HOOK_WAIT_MS = 10_000;
/** The Expenses tab's empty state (expenses.spec.ts X4). */
const NO_EXPENSES = "No expenses yet.";

// ---------- fixture: no uncaught errors, no hydration errors ----------

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
      await use(problems);
      expect(problems, "uncaught or hydration errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

// The browser resolves NON_LOCAL_HOST to this machine (used only by S5;
// Playwright allows launch options only at the top level of a file). It
// changes nothing for localhost or 127.0.0.1.
test.use({
  locale: "en-AU",
  timezoneId: "Australia/Sydney",
  launchOptions: { args: [`--host-resolver-rules=MAP ${NON_LOCAL_HOST} 127.0.0.1`] },
});

// ---------- helpers ----------

/** Freezes the device clock, opens a URL and requires HTTP 200. */
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
          "the app must install it when built with NEXT_PUBLIC_E2E=1 and served on localhost or 127.0.0.1",
      );
    });
}

/** Waits for the page to have hydrated, using the nav's --nav-h (app-shell claim 15). */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--nav-h") !== "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * CHANGED (T1.17b): was goToTransactions(). A client-side move (no reload) to
 * the Expenses tab through Next.js's own router, window.next.router.push, the
 * same call a next/link link makes. A marker put on `window` first must still
 * be there afterwards, which proves the page wasn't reloaded. The empty state
 * proves the screen really rendered after the move.
 */
async function goToExpenses(page: Page): Promise<void> {
  const routerReady = await page.evaluate(
    () => typeof (window as unknown as { next?: { router?: { push?: unknown } } }).next?.router?.push === "function",
  );
  expect(routerReady, "Next.js's client router (window.next.router.push) is available").toBe(true);
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__t117bSameDocument = true;
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push("/expenses");
  });
  await expect(page).toHaveURL(new RegExp(`^https?://[^/]+${escapeRegExp("/expenses")}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Expenses");
  expect(
    await page.evaluate(() => (window as unknown as Record<string, unknown>).__t117bSameDocument),
    "the move to /expenses didn't reload the page",
  ).toBe(true);
  await expect(page.getByRole("main").getByText(NO_EXPENSES, { exact: true })).toBeVisible();
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
  return shipped.filter((f) => readFileSync(f).includes(needle)).map((f) => path.relative(distDir, f));
}

// ═══ The test seam can't reach the live site ════════════════════════════════

test.describe("the test seam is locked", () => {
  test("S0: the test runner itself doesn't set NEXT_PUBLIC_E2E (so the flag-off server really is flag-off)", () => {
    expect(process.env.NEXT_PUBLIC_E2E).toBeUndefined();
  });

  test("S1: in a build without NEXT_PUBLIC_E2E, window.__bentoTest never appears (CHANGED (T1.17b): the move goes to /expenses)", async ({
    page,
  }) => {
    await open(page, `${FLAG_OFF_BASE_URL}/`);
    await waitForHydration(page);
    expect(await page.evaluate((name) => name in window, HOOK_NAME)).toBe(false);
    // Still absent after a client-side move to another screen.
    await goToExpenses(page);
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

  test("S6: the seam offers exactly addExpense and addIncome (addSale is gone; no edit, delete or reset)", async ({
    page,
  }) => {
    await open(page, "/");
    // Wait for the hook object itself (not for addIncome), so a hook with
    // other or extra functions shows up below as the wrong list of names.
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

  test("S4b: control: the flagged build on 127.0.0.1 does install the hook (ADDED (T1.17b))", async ({ page }) => {
    await open(page, "http://127.0.0.1:3000/");
    expect(await page.evaluate(() => location.hostname)).toBe("127.0.0.1");
    await waitForHook(page);
  });

  test("S5: the flagged build reached under another hostname never installs the hook (CHANGED (T1.17b): the move goes to /expenses)", async ({
    page,
  }) => {
    await open(page, `http://${NON_LOCAL_HOST}:3000/`);
    expect(await page.evaluate(() => location.hostname)).toBe(NON_LOCAL_HOST);
    await waitForHydration(page);
    expect(await page.evaluate((name) => name in window, HOOK_NAME)).toBe(false);
    await goToExpenses(page);
    expect(await page.evaluate((name) => name in window, HOOK_NAME)).toBe(false);
  });
});
