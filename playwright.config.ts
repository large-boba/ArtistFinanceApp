// Playwright settings for browser (end-to-end) tests (T1.2).
// Run them with `npm run test:e2e`. They drive a real Chromium browser against
// the production build of the app, at a phone size and at a desktop size.
//
// @playwright/test is pinned to an exact version on purpose: each Playwright
// version expects one exact Chromium build. 1.63.0 expects Chromium revision
// 1243, which is the one preinstalled in the cloud container. CI downloads the
// matching browser with `npx playwright install --with-deps chromium`.
// When you upgrade Playwright, check that the two still match.
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

// A phone-sized screen (390 × 844, like a common iPhone) with touch and a
// mobile user agent. It starts from Playwright's "Pixel 7" preset because that
// preset is meant for Chromium; only the screen size is changed.
const phone = {
  ...devices["Pixel 7"],
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
};

const desktop = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1280, height: 800 },
};

export default defineConfig({
  testDir: "e2e",
  // Fail CI if someone leaves `test.only` in a test file.
  forbidOnly: isCI,
  // No automatic retries: a flaky test should fail loudly, not be hidden.
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    // Keep a trace (a step-by-step recording) only when a test fails.
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: phone },
    { name: "desktop", use: desktop },
  ],
  // Build and start the production app before the tests run.
  // Locally, an app already running on port 3000 is reused to save time;
  // CI always starts a fresh one.
  webServer: {
    // Pass the port explicitly so a PORT variable in the shell can't move the app.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    // Locally, anything already listening on this port (e.g. `npm run dev`) is
    // reused instead of a fresh production build. Stop it first for a true run.
    reuseExistingServer: !isCI,
    // A cold `next build` can take a few minutes on a slow machine.
    timeout: 300_000,
  },
});
