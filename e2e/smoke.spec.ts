// Smoke test (T1.2): proves the browser test runner, the built app and the
// browser all work together. It deliberately doesn't check the page's content,
// because T1.3 replaces the starter page.
import { expect, test } from "@playwright/test";

test("the home page loads and has a title", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok(), "the server answered with a success status").toBe(true);
  // Any non-empty title: the exact title is T1.3's job.
  await expect(page).toHaveTitle(/\S/);
});
