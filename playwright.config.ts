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
// The second server, built without the test flag (see webServer below).
const FLAG_OFF_PORT = 3001;
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
  // Build and start the production app before the tests run. TWO servers:
  //  - port 3000 (the baseURL) is the TEST build: made with NEXT_PUBLIC_E2E=1,
  //    which turns on the test-only hook window.__bentoTest (T1.6). The flag
  //    is passed through the webServer `env` option, so it applies to these
  //    commands only and the test runner's own environment stays clean. This
  //    build goes into its own folder, .next-e2e (see next.config.ts).
  //  - port 3001 is built WITHOUT the flag, exactly the way Cloudflare builds
  //    the live app (into .next). Tests use it to prove the hook is not there.
  // Locally, anything already listening on a port (e.g. `npm run dev`) is
  // reused instead of a fresh production build. Stop it first for a true run;
  // a reused server on 3000 that lacks the flag makes the entries tests fail.
  // CI always starts fresh ones.
  webServer: [
    {
      // Pass the port explicitly so a PORT variable in the shell can't move the app.
      command: `npm run build && npm run start -- -p ${PORT}`,
      url: BASE_URL,
      env: { NEXT_PUBLIC_E2E: "1" },
      reuseExistingServer: !isCI,
      // A cold `next build` can take a few minutes on a slow machine.
      timeout: 300_000,
    },
    {
      command: `npm run build && npm run start -- -p ${FLAG_OFF_PORT}`,
      url: `http://localhost:${FLAG_OFF_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 300_000,
    },
  ],
});
