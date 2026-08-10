# Migration Plan — Spreadsheet (GAS) → SQLite backend

**Goal:** Replace the Google Sheets data source in `dashv1` with a free, fast,
self-hosted database backend, **without changing any user-facing functionality**.

**Decision (2026-08-10):** Reuse `dash-site` as the migration base. It already
contains a complete SQLite-backed Node port of the GAS backend:
- `src/server/schema.sql` mirrors every hidden sheet (records, users, tasks,
  submissions, approvals, audit, documents, sessions, settings, ai_cache).
- `src/server/db.js` replaces `SpreadsheetApp` + `CacheService`.
- `src/server/records.js` re-implements `getData()`, CRUD and review-status
  logic identically to `code.gs` / `RecordService.gs`.
- `src/server/index-dispatch.js` exposes the exact GAS `function(args)`
  surface over `POST /api`.
- `app.js` already calls `http://localhost:8787/api`, **not** Apps Script.

The only remaining GAS dependency is the Cloudflare Worker proxy, which still
routes `/static/` and `/macros/` to the GAS script. That is the cutover point.

---

## Current state (what works today)

| Layer | Today (GAS) | In `dash-site` base | Status |
| --- | --- | --- | --- |
| Records read | `getData()` from sheet | `records.getData()` from SQLite | ✅ Parity |
| Records CRUD | `RecordService` sheet writes | `records.js` SQL | ✅ Parity |
| Auth / sessions | Users sheet + CacheService | `auth.js` + `sessions` table | ✅ Parity |
| Tasks / approvals | hidden sheets | `tasks.js` / `workflow.js` | ✅ Parity |
| Audit / docs / notifications | hidden sheets | `audit.js` / `documents.js` / `notifications.js` | ✅ Parity |
| AI insights / WhatsApp | Worker → GAS | Worker `/api/*` (already DB-free) | ✅ Parity |
| Frontend | `app.js` → Worker → GAS | `app.js` → `localhost:8787/api` | ✅ Wired (dev) |
| Production routing | Worker → GAS | Worker → GAS (not yet DB) | ⚠️ **Cutover needed** |

---

## Migration phases

### Phase 0 — Verify parity (no code change)
1. Start the Node server: `cd src/server && npm start` (listens on `:8787`).
2. Run `node --test tests/smoke.test.js` and `node --test src/tests`.
3. Open `app.html` with `API_URL` pointed at `:8787/api`; confirm records,
   auth, tasks, reports, notifications behave identically to the live GAS app.
4. Document any feature gaps found (none expected from code review).

### Phase 1 — Production data cutover
1. Export live data from the spreadsheet (records, users, tasks, audit,
   documents) to CSV.
   - One-time helper: `src/server/export-from-gas.js` reads the live sheet via
     the gviz JSON endpoint using a session cookie (never hardcoded):
     `set DASH_SPREADSHEET_ID=...; set DASH_GAS_COOKIE="SID=...; ..."; npm run export`
     → writes `records.csv`, `users.csv`, `tasks.csv`, `submissions.csv`,
     `notifications.csv`, `approvals.csv`, `audit.csv`, `documents.csv` into
     `data/export/` (gitignored).
2. Idempotent import: `src/server/import-from-gas.js` (`npm run import`)
   inserts rows into the SQLite tables, preserving record `row` numbers so
   display IDs (`id = row - START_ROW + 1`) stay stable. Existing rows are
   skipped via `INSERT OR IGNORE`.
3. Seed bootstrap admin + settings via existing `seed.js`.
4. Snapshot the old spreadsheet as read-only archive (keep for rollback).

### Phase 2 — Re-point the Cloudflare Worker ✅ DONE
1. `src/worker/worker.js` now forwards `/api/*` (except enterprise routes),
   `/macros/*` and `/static/*` to the Node server via `env.SERVER_ORIGIN`.
   Enterprise routes (`/api/ai-insights`, `/api/notify-whatsapp`,
   `/api/health`) stay local — they use Worker-only secrets.
2. `app.js` `API_URL` derives from `location.origin + '/api'` so the same
   build works on `dashboardharyana.site` and localhost.
3. Set `SERVER_ORIGIN` (Worker env var / secret) to the hosted server URL, then
   deploy the Worker: `node src/worker/deploy-worker-api.js $CLOUDFLARE_API_TOKEN`
   (or `wrangler deploy` in `src/worker`).

### Phase 3 — Deployment & hosting
1. Containerise the server: `src/server/Dockerfile` + `.dockerignore`
   (compiles `better-sqlite3` at build; `railway.json` for one-click free-tier
   deploy, or use Render/Fly.io with the same Dockerfile).
2. On the host, set `SERVER_ORIGIN` = the public server URL (e.g.
   `https://dash-api.up.railway.app`). Persist `data/` (SQLite + uploads) on a
   mounted volume so the DB survives restarts.
3. Import the live data once on first run: copy the exported CSVs into the
   host's `data/export/` and run `npm run import` (or bake a seeded DB into the
   image for a fresh start).
4. Set the Worker `SERVER_ORIGIN` secret and deploy the Worker (Phase 2 step 3).
5. Verify: `GET <server>/api/health` returns ok, and
   `POST <worker>/api {function:'getData'}` returns the live records.
6. Keep `dashv1` (GAS) untouched as a fallback/reference.

> Note: file uploads live on disk under `data/uploads/`. On serverless hosts,
> move them to R2 / object storage and update `documents.resolveDocumentFile`.

### Phase 4 — Decommission GAS (optional, after soak)
1. Stop the time-driven GAS triggers once the Node server runs the equivalent
   jobs (reminders, AI cache).
2. Archive the spreadsheet; revoke the Apps Script OAuth scopes if no longer
   needed.

---

## Why SQLite is the right free + fast base
- **Free:** `better-sqlite3` is a local file DB, zero hosting cost for small
  data; upgrades to Cloudflare D1 (SQLite-compatible) keep the same SQL.
- **Fast:** synchronous, in-process reads; `getData()` cache (`dataCache`) gives
  sub-ms responses, replacing the old sheet re-reads + CacheService chunking.
- **Same functionality:** every sheet is a table; every GAS function maps 1:1 to
  a dispatcher entry, so no feature changes.

## Risks / notes
- File uploads currently live on disk under `data/uploads/`; on serverless
  hosts move them to R2 / object storage.
- Secrets (API keys) already live in Worker env / Script Properties — keep them
  out of the repo per `AGENTS.md`.
- The spreadsheet's "review date background colour" is preserved as the
  `review_bg` column, so review-status logic is byte-for-byte equivalent.
