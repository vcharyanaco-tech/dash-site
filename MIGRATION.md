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
   documents) to JSON/CSV.
2. Add an idempotent import script (`src/server/import-from-gas.js`) that
   inserts rows into the SQLite tables, preserving `row` numbers for records so
   display IDs stay stable.
3. Seed bootstrap admin + settings via existing `seed.js`.
4. Snapshot the old spreadsheet as read-only archive (keep for rollback).

### Phase 2 — Re-point the Cloudflare Worker
1. Change Worker routing so `/macros/*` and `/static/*` no longer proxy to GAS;
   instead send API calls to the Node server (origin set via `env.SERVER_ORIGIN`)
   and serve static assets from GitHub Pages / R2.
2. Keep `/api/*` enterprise routes (AI, WhatsApp) as-is — they already use env
   secrets, not the spreadsheet.
3. Deploy Worker via `src/worker/deploy-worker-api.js`.

### Phase 3 — Deployment & hosting
1. Host the Node server on a free tier: Cloudflare Workers + D1, Railway,
   Render, or Fly.io (free). Use the existing `data/dashboard.db` (or D1).
2. Update `app.js` `API_URL` to the production origin (env-injected, not
   hardcoded `localhost`).
3. Keep `dashv1` (GAS) untouched as a fallback/reference.

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
