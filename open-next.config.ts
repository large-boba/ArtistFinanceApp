// OpenNext adapter settings: how the Next.js build is turned into a
// Cloudflare worker. This is the adapter's minimal default with no
// incremental cache (ISR); adding one needs a decision first (T0.5).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
