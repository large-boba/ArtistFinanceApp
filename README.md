# BentoBudget

A finance app for artists: an installable web app for tracking expenses, income, events and profit.

- **How it's being built:** `docs/build-guide.html`, worked through stage by stage (`docs/stages/`)
- **Decisions and current status:** `DECISIONS.md`
- **The AI agent team and its safeguards:** `docs/TEAM.md`

## Run it locally

You need Node.js (LTS) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The home page lives in `src/app/page.tsx`.

## Cloudflare preview

The app is hosted on Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`). To see the app the way Cloudflare will run it, on your own computer:

```bash
npm run preview
```

This builds the app (`next build`), turns the build into a Cloudflare worker (in `.open-next/`), and starts Cloudflare's local runtime. Open http://localhost:8787 and press `Ctrl+C` to stop it. You don't need a Cloudflare account for this.

- `wrangler.jsonc` holds the worker's settings and `open-next.config.ts` the adapter's. Neither may contain secrets.
- Local secrets for the preview go in `.dev.vars` (copy `.dev.vars.example`). Git ignores `.dev.vars`.
- `npm run deploy` publishes to Cloudflare. Only the owner runs it; the AI agents can't.
- `npm run dev` is still the quickest way to work on pages day to day.
