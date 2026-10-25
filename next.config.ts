import type { NextConfig } from "next";

// TEST-ONLY SWITCH (T1.6). The end-to-end tests need a small "back door"
// (window.__bentoTest, see src/components/EntriesProvider.tsx) to put pretend
// entries into the app, because the real forms don't exist yet. That back door
// must never reach the live site, so it has two locks. This is lock 1:
//
//  - It is only built in when the build is made with NEXT_PUBLIC_E2E=1.
//  - We "pin" the value below. Next.js only swaps NEXT_PUBLIC_ variables for
//    their value at build time when they are SET. On Cloudflare the variable
//    is not set, so without this pin the check would stay in the shipped
//    JavaScript and the back door's code would ship with it. Pinned to "",
//    the build sees `"" === "1"` (always false) and removes the code.
//  - The flagged build goes into its own folder (.next-e2e), so it can never
//    be packaged or served by mistake in place of the normal build.
const e2e = process.env.NEXT_PUBLIC_E2E === "1";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_E2E: e2e ? "1" : "" },
  distDir: e2e ? ".next-e2e" : ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
