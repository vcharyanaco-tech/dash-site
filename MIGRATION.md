# Migration Plan — GAS web app stays live; build & test `dash-site` on a separate host first

**Goal:** Stand up `dash-site` (the Node/SQLite port of the GAS backend plus the
website) on its **own separate host** — Railway by default, or another gateway —
so it can be built, tested and iterated in isolation, **without touching the
live deployment in any way**.

**Hard constraint (do not violate):** The GAS web app at `dashboardharyana.site`
**stays live and unchanged** until this project is **fully finalized** by the
owner. Until then:
- No cutover of traffic.
- No re-pointing of the Cloudflare Worker (`dashv1-proxy`) to a new backend.
- No DNS / zone changes.
- Do **not** enable GitHub Pages on the live custom domain while GAS owns it.

**Decision (2026-08-12):** Parallel-deploy `dash-site` to a **staging**
environment on Railway (free tier by default; Render / Fly.io / plain Docker are
drop-in alternatives). `dashv1` (GAS) remains the only thing serving the public
domain. The staging host is a throwaway sandbox: break it, wipe it, re-deploy it
as often as needed while testing.

---

## Current state (what works today)

| Layer | Live today (GAS, untouched) | Staging (`dash-site` on separate host) | Status |
| --- | --- | --- | --- |
| Records read | `getData()` from sheet | `records.getData()` from SQLite | ✅ Parity |
| Records CRUD | `RecordService` sheet writes | `records.js` SQL | ✅ Parity |
| Auth / sessions | Users sheet + CacheService | `auth.js` + `sessions` table | ✅ Parity |
| Tasks / approvals | hidden sheets | `tasks.js` / `workflow.js` | ✅ Parity |
| Audit / docs / notifications | hidden sheets | `audit.js` / `documents.js` / `notifications.js` | ✅ Parity |
| AI insights / WhatsApp | Worker → GAS | Worker `/api/*` (DB-free) | ✅ Parity |
| Frontend | `app.js` → Worker → GAS | `app.js` → staging host `/api` | ✅ Wired (staging) |
| Production routing | Worker → GAS | **GAS — unchanged** | 🔒 **Deferred until finalization** |

---

## Phases

### Phase 0 — Verify parity locally (no code change, no deployment)
1. Start the Node server: `cd src/server && npm start` (listens on `:8787`).
2. Run `node --test tests/smoke.test.js` and `node --test src/tests`.
3. Open `app.html` with `API_URL` pointed at `:8787/api`; confirm records,
   auth, tasks, reports, notifications behave identically to the live GAS app.
4. Document any feature gaps found (none expected from code review).

### Phase 1 — Stand up a separate staging host for `dash-site` (Railway)
> This is the **first** step now. It does **not** affect the live domain/GAS.
1. Containerise once: `src/server/Dockerfile` + `.dockerignore` (compiles
   `better-sqlite3` at build), `railway.json` for the free-tier deploy
   (DOCKERFILE builder, port `8787`, healthcheck `/api/health`).
2. Create a **Railway project** (or Render/Fly.io) from the `dash-site` repo's
   `railway.json`. Do **not** connect any custom domain yet — use Railway's
   auto-assigned `*.up.railway.app` URL for staging.
3. Set the runtime env: `PORT=8787`, and persist `data/` (SQLite + uploads) on a
   mounted volume so the DB survives restarts.
4. Verify the staging host is healthy:
   `GET https://<staging>.up.railway.app/api/health` returns `ok`.
5. Confirm the app boots and the full website is reachable at the staging URL.

### Phase 2 — Test & build on the staging host (iterate freely)
1. Import a copy of the live data once on first run: copy the exported CSVs into
   the host's `data/export/` and run `npm run import` (or bake a seeded DB into
   the image for a fresh start). This is a **copy** — the live spreadsheet is
   never modified.
2. Exercise full parity against the staging URL: CRUD, auth/login, tasks,
   approvals, reports, notifications, PWA / service worker / offline queue,
   AI insights, WhatsApp notify.
3. Harden as needed: `node:22` base for `better-sqlite3@13`, PORT injection,
   root `Dockerfile` build context, `.railwayignore` to avoid the 413
   "payload too large" upload error.
4. Iterate as much as needed — the staging host is disposable.

### Phase 3 — Finalize (owner sign-off)
1. Owner reviews the staging build and confirms feature parity + stability.
2. Optional: point a **separate** test domain/subdomain at the staging host if
   needed for real-browser/device testing — never the live `dashboardharyana.site`.
3. Unblock the cutover only when the owner says the project is **fully finalized**.

### Phase 4 — Cutover (🔒 DEFERRED — only after finalization, not now)
1. Set `SERVER_ORIGIN` (Worker env var / secret) to the final hosted server URL.
2. Re-point the Cloudflare Worker `dashv1-proxy` (routes `/api/*`, `/macros/*`,
   `/static/*` to the Node server via `env.SERVER_ORIGIN`; enterprise routes
   `/api/ai-insights`, `/api/notify-whatsapp`, `/api/health` stay local).
3. Deploy the Worker: `node src/worker/deploy-worker-api.js $CLOUDFLARE_API_TOKEN`
   (or `wrangler deploy` in `src/worker`).
4. Verify: `GET <server>/api/health` returns ok, and
   `POST <worker>/api {function:'getData'}` returns the live records.
5. Keep `dashv1` (GAS) untouched as a fallback/reference.

### Phase 5 — Decommission GAS (only after soak, optional)
1. Stop the time-driven GAS triggers once the Node server runs the equivalent
   jobs (reminders, AI cache).
2. Archive the spreadsheet; revoke the Apps Script OAuth scopes if no longer
   needed.

> Note: file uploads live on disk under `data/uploads/`. On serverless hosts,
> move them to R2 / object storage and update `documents.resolveDocumentFile`.

---

## Why SQLite is the right free + fast base
- **Free:** `better-sqlite3` is a local file DB, zero hosting cost for small
  data; upgrades to Cloudflare D1 (SQLite-compatible) keep the same SQL.
- **Fast:** synchronous, in-process reads; `getData()` cache (`dataCache`) gives
  sub-ms responses, replacing the old sheet re-reads + CacheService chunking.
- **Same functionality:** every sheet is a table; every GAS function maps 1:1 to
  a dispatcher entry, so no feature changes.

## Risks / notes
- **Live availability is the priority:** none of the staging work may touch
  `dashboardharyana.site`, the Cloudflare Worker routing, or the GAS script.
- File uploads currently live on disk under `data/uploads/`; on serverless
  hosts move them to R2 / object storage.
- Secrets (API keys) already live in Worker env / Script Properties — keep them
  out of the repo per `AGENTS.md`.
- The spreadsheet's "review date background colour" is preserved as the
  `review_bg` column, so review-status logic is byte-for-byte equivalent.
