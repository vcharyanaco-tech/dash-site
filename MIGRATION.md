# Migration Plan — GAS web app → Node/SQLite port (`dash-site`)

**Goal:** Replace the GAS backend at `dashboardharyana.site` with `dash-site`
(the Node/SQLite port of the GAS backend plus the website) — built and tested on
a separate Railway host first, then cut over once finalized, keeping GAS as a
fallback during the soak period.

**Current status (2026-08-14): ✅ CUT OVER.** `dashboardharyana.site` is now
served by the Node/SQLite backend through the Cloudflare Worker `dashv1-proxy`
(SERVER_ORIGIN → Railway). The current dash-site frontend is served through the
Worker too. GAS remains deployed but is only a manual fallback during the soak
phase (Phase 5 pending).

**Hard constraint (current):** No regressions on the live domain. During the
soak phase the GAS Apps Script project stays untouched as a fallback; no DNS /
zone changes; no enabling of a custom domain on GitHub Pages (the repo `CNAME`
is kept per owner decision, but Pages stays pinned to the `*.github.io` URL).

---

## Current state (what works today)

| Layer | Live today (Node via Worker) | Staging / backend (`dash-site`) | Status |
| --- | --- | --- | --- |
| Records read | `records.getData()` from SQLite | same | ✅ Parity |
| Records CRUD | `records.js` SQL | same | ✅ Parity |
| Auth / sessions | `auth.js` + `sessions` table | same | ✅ Parity |
| Tasks / approvals | `tasks.js` / `workflow.js` | same | ✅ Parity |
| Audit / docs / notifications | `audit.js` / `documents.js` / `notifications.js` | same | ✅ Parity |
| AI insights / WhatsApp | Worker `/api/*` (token-gated; unconfigured) | same | ⏸ Gated |
| Frontend | Worker → dash-site repo root (raw CDN) | same files | ✅ Live |
| Production routing | Worker → Node (SERVER_ORIGIN) | — | ✅ **Cut over** |
| Email (SMTP) | `mailer.js` → Gmail App Password | same | ✅ Verified |
| GAS fallback | deployed @243, **not serving traffic** | — | 🔒 Fallback only |

---

## Phases

### Phase 0 — Verify parity locally (no code change, no deployment) ✅ DONE
1. Start the Node server: `cd src/server && npm start` (listens on `:8787`).
2. Run `node --test tests/smoke.test.js` and `node --test src/tests`.
3. Open `app.html` with `API_URL` pointed at `:8787/api`; confirm records,
   auth, tasks, reports, notifications behave identically to the live GAS app.
4. Document any feature gaps found (none expected from code review).

### Phase 1 — Stand up a separate staging host for `dash-site` (Railway) ✅ DONE
> Staging is live at `https://dash-site-production-07cc.up.railway.app` and
> serves the full site: `/api/health` ok, `/` landing page, `/app.html`
> dashboard, and `assets/styles.css` + `assets/site.css` all 200. The
> Dockerfile bundles the repo-root frontend into the image
> (`DASH_STATIC_ROOT=/app/www`) so one Railway container serves both API and
> website. Data (`data/`, SQLite + uploads) persists on a mounted volume.

### Phase 2 — Test & build on the staging host (iterate freely) ✅ DONE
> Completed on 2026-08-13/14. Parity exercised via the API dispatcher and a
> real-browser flow (headless Chrome over CDP — `verify-browser.cjs`):
> 14/14 PASS on staging, then **8/8 PASS on the live domain post-cutover**
> (login → ADMIN, no duplicate users, add update → badge flashes, admin read
> clears flash with count preserved, server `read_at` persists across reload,
> cleanup). Notable fixes shipped during this phase:
> - Dedupe users on boot (UNIQUE index on `lower(trim(email))`).
> - Submission badges flash until read by an admin (read-based, not 24h).
> - "Mark all as read" action (admin-only).
> - ReadAt parity mirrored into the GAS `Submissions.js` (repo copy only).
> - `nodemailer` dependency added for SMTP (email previously never sent).

### Phase 3 — Finalize (owner sign-off) ✅ DONE
> Owner reviewed the staging build and authorized the cutover on 2026-08-13.
> (No separate test domain was needed — the live domain itself is now used for
> verification during soak.)

### Phase 4 — Cutover ✅ EXECUTED (2026-08-13) — **was** 🔒 DEFERRED
1. Set `SERVER_ORIGIN` (Worker secret) to the final hosted server URL
   (`https://dash-site-production-07cc.up.railway.app`).
2. Re-pointed the Cloudflare Worker `dashv1-proxy` — routes `/api*`,
   `/macros/*`, `/static/*` now forward to the Node server via
   `env.SERVER_ORIGIN`; enterprise routes (`/api/ai-insights`,
   `/api/notify-whatsapp`, `/api/health`) stay local.
3. Deployed via `node src/worker/deploy-worker-api.js $CLOUDFLARE_API_TOKEN`,
   with three fixes required before deploy: restored the missing
   `const path = url.pathname;`, added a bare `POST /api` match, and passed
   `ctx` to `handleEnterpriseRoute`. Old GAS-proxy worker backed up to
   `/tmp/dashv1-proxy-live-backup-20260813.js` for rollback.
4. Verified live end-to-end: `/api/health` ok (worker-local), `POST /api` and
   `POST /macros/s/.../exec` reach the Node server, login via the live
   `/macros` path issues a token, and all static routes return 200 with
   correct content types.
5. GAS kept untouched as a fallback/reference.

> **Post-cutover follow-up (2026-08-14):** the Worker's static source
> (`GITHUB_RAW`) was repointed from the frozen `dashv1` repo bundle to the
> **dash-site repo root**, so the live domain now serves the current frontend
> (read-based flash UX + "Mark all as read"). `WORKER_API_TOKEN` secret set;
> `/api/ai-insights` and `/api/notify-whatsapp` are token-gated but
> unconfigured (no `GEMINI_API_KEY` / WhatsApp secrets yet).

### Phase 5 — Decommission GAS 🔄 PENDING SOAK (mirror removed 2026-08-17)
> GAS is the manual fallback while the Node backend soaks. It is deployed at
> version **@243** (`AKfycbxPwINC…` — the URL the old dashv1 bundle called)
> and **has not been modified** (the stale in-repo `src/gas/` mirror was
> removed 2026-08-17 — the live Apps Script project lives in `dashv1` and
> was never pushed from this repo).
1. Soak: keep GAS as fallback while the Node server runs the equivalent jobs
   (reminders, AI cache). Re-run `verify-browser.cjs` against the live domain
   after any change.
2. When the owner declares the soak complete, stop the time-driven GAS
   triggers (reminders, reports).
3. Archive the spreadsheet; revoke the Apps Script OAuth scopes if no longer
   needed.

> Note: file uploads live on disk under `data/uploads/` on the Railway volume.
> On serverless hosts, move them to R2 / object storage and update
> `documents.resolveDocumentFile`.

---

## Why SQLite is the right free + fast base
- **Free:** `better-sqlite3` is a local file DB, zero hosting cost for small
  data; upgrades to Cloudflare D1 (SQLite-compatible) keep the same SQL.
- **Fast:** synchronous, in-process reads; `getData()` cache (`dataCache`) gives
  sub-ms responses, replacing the old sheet re-reads + CacheService chunking.
- **Same functionality:** every sheet is a table; every GAS function maps 1:1 to
  a dispatcher entry, so no feature changes.

## Risks / notes
- **Live availability is the priority:** the soak phase must not regress
  `dashboardharyana.site`. Roll back the Worker (backup at
  `/tmp/dashv1-proxy-live-backup-20260813.js`) if the Node backend degrades.
- File uploads currently live on disk under `data/uploads/`; on serverless
  hosts move them to R2 / object storage.
- Secrets (`SERVER_ORIGIN`, `WORKER_API_TOKEN`) live in Worker env / secrets —
  keep them out of the repo per `AGENTS.md`.
- The spreadsheet's "review date background colour" is preserved as the
  `review_bg` column, so review-status logic is byte-for-byte equivalent.
- The `SESSION_EXPORT_*.md` files record each session's work and the runbook
  details (Railway project/env/service IDs, token refresh, SMTP vars).
