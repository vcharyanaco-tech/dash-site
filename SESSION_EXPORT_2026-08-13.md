# Session export — 2026-08-13 (dash-site / bugs fixed, parity, Pages, cutover prep)

## Context / goal
Continue building out `dash-site` (Node/SQLite port of the GAS backend) on the
Railway staging host. This session: fixed the two reported bugs (duplicate
users in Manage users; submission badge flash), shipped "Mark all as read",
mirrored read-based flash into the GAS backend, enabled GitHub Pages, rotated
the staging admin password, verified everything in a real browser, drafted the
cutover runbook, and started SMTP configuration.

## Fixes shipped (all verified + deployed)

### 1. Users shown twice in Manage users (commit 72e659c)
- **Root cause:** `users.email` had no UNIQUE constraint, so the first-boot CSV
  import's `INSERT OR IGNORE` never conflicted on re-import — on a persistent
  volume every deploy appended a fresh copy of every user.
- **Fix (`src/server/db.js`, boot migration):** dedupe users keeping the
  earliest row per `lower(trim(email))`, then add a unique index on the same
  normalization so future imports skip existing accounts. Hardened the index to
  `lower(trim(email))` (a `lower(email)`-only index let a whitespace-padded
  email slip past — caught by a new unit test).
- Live check after restart: 6 users, **no duplicates**, bootstrap admin
  present (via `adminGetUsers`).

### 2. Badge flashes until read by admin (commit 72e659c)
- Flash is now **read-based**, not time-based (was 24h).
- `submissions.read_at` column (0 = unread); migration backfills existing
  history as already-read so old updates don't suddenly flash.
- Server: a card flashes while it has any unread update; an **admin** opening
  the card's update list marks those submissions read — viewer/editor reads do
  NOT clear it. Counter shows the total either way.
- Client (`app.js` + GAS `script.html` mirror): after an admin opens the
  submissions modal, that card's badge stops flashing.

### 3. "Mark all as read" action (commit 6d2483e)
- Dashboard action (check-circle icon, admin-only, shown while any badge
  flashes). One call sets `read_at` on every unread submission (single UPDATE),
  logs `SUBMISSION_READ_ALL`, counters untouched.
- Mirrored into the GAS frontend (`script.html`).

### 4. GAS backend parity: ReadAt column (commit b56e362)
- `src/gas/Submissions.js`: `ReadAt` column appended to the submissions sheet
  **after** the live sheet's extra `RowVersion`/`UpdatedBy` columns (col 13 —
  inserting at 11 would have clobbered `RowVersion`). Flash is read-based
  there too; admin reads + `markAllSubmissionsRead` write ReadAt; existing
  history is backfilled as read on first boot after deploy (header-join check
  runs once).
- `src/gas/Settings.js`: `SUBMISSION_READ_ALL` action.
- `src/gas/script.html`: client handler now calls the backend.
- `src/server/import-from-gas.js`: importer preserves ReadAt (13th CSV column)
  and parses GAS formatted dates (`8/10/2026 14:32:54`) via new
  `importTimestamp_`; older CSVs still import history as read.
- **Note:** GAS files are committed but NOT deployed to the live Apps Script
  project yet — needs clasp/editor push to take effect.

## GitHub Pages enabled (this session)
- Repo previously had NO Pages site (API 404) → the `pages.yml` workflow died
  at "Setup Pages" on every commit. Enabled via API
  (`POST /repos/.../pages` with `build_type: workflow`, source `main /`),
  reran the workflow → **success**.
- Live at `https://vcharyanaco-tech.github.io/dash-site/` (serves the
  repo-root frontend).
- **Caveat (owner chose to keep it):** the repo's `CNAME` file
  (`dashboardharyana.site`) deploys with the site, so Pages will prompt to
  claim the live domain. GitHub reports `cname: null` today (no active custom
  domain), but activating it would require DNS changes on
  `dashboardharyana.site` — against the MIGRATION.md constraint. Deleting the
  `CNAME` from the repo keeps Pages pinned to the `*.github.io` URL.
- **Pages is frontend-only:** its `app.js` targets same-origin `/api`, which
  GitHub Pages cannot serve (405/404). Login/flow verification FAILS there by
  design — the working endpoints are Railway staging and the live domain via
  the Worker.

## Admin password rotated (live staging)
- Default `Admin@123` changed on Railway staging for `vcharyanaco@gmail.com`.
- Final password chosen by owner: **`Vish@9194`** (verified: login success,
  old + generated passwords rejected). App-format hash, so the boot re-seed
  won't override it; `mustChange` cleared.
- Temp file holding the interim generated password deleted on request.

## Browser verification (headless Chrome via CDP, no packages)
- Reusable script `tmp-verify-browser.cjs` (created, run, then deleted):
  login → Manage users (duplicates check) → add update → badge flashes →
  admin re-opens modal → flash off, count stays → cleanup.
- **Railway staging: 14/14 PASS** (login, role ADMIN, 6 users no dups, flash
  to read, cleanup).
- **GitHub Pages: expected FAIL at login** (`HTTP 405` on same-origin `/api`)
  — confirms Pages is a static mirror only.
- Node 24 native WebSocket drives Chrome DevTools Protocol — no puppeteer.

## Cutover runbook (drafted — NOT executed)
- Full Phase 0–5 runbook in chat; key findings:
  - Live worker `dashv1-proxy` **has `SERVER_ORIGIN` set** as a secret
    binding, but **`WORKER_API_TOKEN` is NOT set**.
  - **The deployed worker is OLD:** 0 references to `SERVER_ORIGIN` (fetched
    script vs repo worker.js which has 7). It still proxies `/macros/*`,
    `/static/*` → `script.google.com` (GAS) and treats `/api/*` as
    enterprise (hence live `/api/` → `{"error":"unauthorized"}`).
  - Blocker for cutover: **deploy the repo's `worker.js`** via
    `node src/worker/deploy-worker-api.js $CLOUDFLARE_API_TOKEN` (or
    `wrangler deploy`) to flip routing to the Node backend. `SERVER_ORIGIN`
    secret is already there.
  - Live `dashboardharyana.site` still GAS-backed: its `app.js` API_URL is the
    Apps Script `/macros/s/.../exec` endpoint.
  - Node server config: AI/WhatsApp keys come from the settings table
    (`spGet_`), not env vars; email needs SMTP (below); uploads live on disk.

## SMTP configuration (IN PROGRESS)
- Mailer (`src/server/mailer.js`) sends via nodemailer when `SMTP_HOST`,
  `SMTP_USER`, `SMTP_PASS` are set (optional `SMTP_PORT`=587,
  `SMTP_SECURE`, `SMTP_FROM`); otherwise logs to `data/outbox.log`.
- **Gap fixed:** `nodemailer` was missing from `package.json` (require failed
  silently → mail never sent). Added `nodemailer@^6.9.16` (installed 6.10.1),
  package-lock updated. 16/16 tests still pass.
- **Owner chose Gmail App Password** for the provider (same sender as GAS).
  **Blocked on:** the Gmail address (tool didn't relay the typed value) + the
  16-char App Password (needs 2-Step Verification enabled on the account).
- Railway env vars to set once creds known: `SMTP_HOST=smtp.gmail.com`,
  `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- Railway token available locally (`~/.railway/config.json` → accessToken);
  project/environment/service ids recorded (project `e81e06b1-...`,
  environment `115ab2ef-...` production, service `b9bdfd65-...`).

## Deployments / infra state
| Target | Status |
| --- | --- |
| GitHub `main` | HEAD `b56e362` (pushed) |
| Railway staging | `dash-site-production-07cc.up.railway.app` — LIVE, all fixes, verified 14/14 in browser |
| GitHub Pages | `vcharyanaco-tech.github.io/dash-site` — LIVE, workflow success (frontend-only) |
| Cloudflare Worker `dashv1-proxy` | old build live; `SERVER_ORIGIN` secret set, `WORKER_API_TOKEN` missing; repo worker.js NOT deployed |
| Live `dashboardharyana.site` | still GAS-backed (unchanged, per MIGRATION.md) |
| GAS Apps Script | repo updated with ReadAt; not pushed to the project yet |

## Current git state (dash-site)
- HEAD: `b56e362` — feat(gas): mirror read-based submission flash via ReadAt sheet column
- Uncommitted: `src/server/package.json` + `package-lock.json` (nodemailer
  dependency, part of the in-progress SMTP work).
- This file added: `SESSION_EXPORT_2026-08-13.md`.

## Resume checklist (next session)
1. Get the Gmail address + App Password from the owner; set `SMTP_*` vars on
   Railway; send a test mail to confirm.
2. Decide whether to deploy the repo `worker.js` (flips live routing to Node)
   — needs explicit owner go-ahead (live change).
3. Optionally set `WORKER_API_TOKEN` on the worker.
4. Push the updated GAS files (clasp/editor) so the `ReadAt` column goes live.
5. Decide on the `CNAME` file (Pages may prompt to claim the live domain).
6. Re-run `tmp-verify-browser.cjs` against the live domain post-cutover.
