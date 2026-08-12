# Session export — 2026-08-12 (dash-site / Railway hosting)

## Context / goal
User wanted the `dash-site` project (Node/SQLite port of the GAS backend + the
website) hosted **separately** for testing/building while the **GAS web app at
`dashboardharyana.site` stays live and untouched** until the project is fully
finalized. This session set up and verified that separate hosting on Railway.

## What was investigated
- Confirmed the live `dashboardharyana.site` is served by the Cloudflare Worker
  `dashv1-proxy` (Cloudflare account `a01eb877...`), still GAS-backed
  (`/api/health` → `{"service":"dashv1-proxy"}`). **No live changes made.**
- Found the separate GitHub repo `vcharyanaco-tech/dash-site` (website +
  `src/server/` Node/SQLite backend + `railway.json` + Dockerfile) had been
  scaffolded but never actually deployed/cut over.

## Plan change
Rewrote `MIGRATION.md` so the order of work is:
- **Phase 0** — local parity check (no deploy).
- **Phase 1 — stand up a separate Railway staging host** (no impact on live).
- **Phase 2 — test & build on staging (iterate freely).**
- **Phase 3** — finalize / owner sign-off.
- **Phase 4 — cutover (DEFERRED until finalization; NOT now).**
- **Phase 5 — decommission GAS (only after soak).**

Hard constraint documented: no cutover, no Worker re-pointing, no DNS changes,
no GitHub Pages on the live custom domain while GAS owns it.

## Railway deployment
- Staging is live at **`https://dash-site-production-07cc.up.railway.app`**.
- `GET /api/health` → `{"ok":true,"name":"India Post Dashboard server",...}`.
- `POST /api {"function":"getData"}` returns live records (DB populated via
  first-boot auto-import from the baked-in `src/server/migration-export/`).

## Fixes made to get the full site served (commit b0e27c3)
1. **`Dockerfile`** — the image now bundles the repo-root frontend into
   `/app/www` and sets `DASH_STATIC_ROOT=/app/www`, so one Railway container
   serves both the API and the website (previously only the API was served;
   `/`, `/index.html`, `/app.html` were 404).
2. **`assets/styles.css`** (67 KB) — recovered from `dashv1/styles.html` (the
   "India Post Dashboard — Design System" `<style>` block); it was missing from
   the repo.
3. **`assets/site.css`** (5.5 KB) — landing-page stylesheet built using the same
   enterprise tokens (`#da291c` / `#004b87`).

Verified live after deploy: `/`, `/app.html`, `/assets/styles.css`,
`/assets/site.css`, `/app.js`, `/sw.js`, `/manifest.json`, `/docs-pwa-icon.svg`
all return 200, and `app.js` correctly targets the same-origin `/api`.

## Milestone (commit b78dd60)
- `MIGRATION.md`: marked **Phase 1 ✅ DONE** (staging live, full site serving)
  and **Phase 2 🔄 IN PROGRESS**.

## Notes / known limitations
- Local dev on this Windows box cannot build `better-sqlite3` (needs Visual
  Studio build tools); Railway's `node:22` Docker image builds it fine.
- The `data` snapshot baked into the image (`src/server/migration-export/`) is
  a point-in-time copy from ~2026-08-10. A fresh import needs new CSVs from the
  live sheet; the importer uses `INSERT OR IGNORE`, so edited rows are not
  overwritten — a full refresh requires resetting the DB volume first.
- Manual import in the Railway console should point at the baked-in CSVs:
  `DASH_IMPORT_DIR=/app/migration-export npm run import`
  (default CSV dir `/data/export` is empty.)

## Current git state (dash-site)
- HEAD: `b78dd60` — docs: mark Phase 1 done + Phase 2 in progress.
- This file added: `SESSION_EXPORT_2026-08-12.md`.
