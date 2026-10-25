// Vitest settings for unit tests (T1.1). Run them with `npm test`.
// Unit tests are plain TypeScript functions run in Node: no browser, no jsdom.
// Component tests and browser tests (Playwright) are out of scope here.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  resolve: {
    // Same alias as tsconfig.json: `@/lib/x` means `src/lib/x`.
    alias: [{ find: /^@\//, replacement: srcDir }],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "e2e/**",
    ],
  },
});
