# Session export — 2026-08-13 (dash-site / bugs fixed, parity, Pages, CUTOVER EXECUTED, worker hardened)

## Context / goal
Continue building out `dash-site` (Node/SQLite port of the GAS backend) on the
Railway staging host. This session: fixed the two reported bugs (duplicate
users in Manage users; submission badge flash), shipped "Mark all as read",
mirrored read-based flash into the GAS backend, enabled GitHub Pages, rotated
the staging admin password, verified everything in a real browser, **executed
the live cutover** (deployed the repo worker → `dashboardharyana.site` now
serves the Node backend), set `WORKER_API_TOKEN`, and started SMTP
configuration.

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

## CUTOVER EXECUTED (this session, live)
- **Deployed the repo's `worker.js` to the live `dashv1-proxy`** via
  `node src/worker/deploy-worker-api.js $CLOUDFLARE_API_TOKEN` —
  `dashboardharyana.site` now routes to the Node/Railway backend, not GAS.
  Old GAS-proxy worker backed up to `/tmp/dashv1-proxy-live-backup-20260813.js`
  (0 SERVER_ORIGIN refs / 5 script.google.com refs — verified) for rollback.
- **Two fixes were needed to the repo worker before deploying** (found during
  verification — deploying as-is would have broken the live site):
  1. `const path = url.pathname;` was **missing** (regression in the Phase 2
     commit `975fdfe`; present in `b4b6e01`) — every static route would have
     served `index.html`.
  2. Bare `POST /api` fell through to static (worker only matched `/api/`) —
     added an exact `/api` match.
- **Verified live end-to-end after deploy:**
  - `/api/health` → worker-local `{"ok":true,"service":"dashv1-proxy"}`
  - bare `POST /api` dispatcher + `POST /macros/s/.../exec` (the live
    frontend's actual API_URL) → `{"result":<epoch ms>}` from the Node server
    (x-railway headers present)
  - **login via the live `/macros` path with `Vish@9194`** →
    `success:true, role:ADMIN`, token issued (full path: frontend → Worker →
    Node → SQLite)
  - static pages `/`, `/app.html`, `/app.js`, `/assets/styles.css`,
    `/manifest.json` all 200 with correct content-types
- **No frontend change was needed:** the live `dashv1` bundle's `API_URL` is
  same-host `https://dashboardharyana.site/macros/s/AKfycbx.../exec`, which the
  new worker forwards to `SERVER_ORIGIN + '/api'` (the Node dispatcher).
- `POST /api/preview-check` (dashv1 app.js) is not a Node route → 404, but the
  frontend handles it gracefully (optional feature).
- **Runbook context (as previously drafted):** full Phase 0–5 in chat; the
  remaining phases are: verify in browser on the live domain, keep GAS as
  fallback during soak, then Phase 5 (stop GAS triggers, archive spreadsheet).
  Node server config: AI/WhatsApp keys come from the settings table
  (`spGet_`), not env vars; email needs SMTP (below); uploads live on disk.

## WORKER_API_TOKEN set (live worker hardened)
- Generated a 40-char token, saved to `/tmp/worker_api_token.txt` (the only
  place it exists outside Cloudflare — grab it and store in a password
  manager, then delete the file).
- Set as a `secret_text` binding on `dashv1-proxy` via the Cloudflare API
  (same mechanism as `SERVER_ORIGIN`).
- **Fixed a latent worker bug surfaced by the token:** `handleEnterpriseRoute`
  called `handleAiInsights(request, env, ctx)` without receiving `ctx` →
  `error code: 1101` on a valid-token call. Added the `ctx` param. (Unreachable
  before, because every call was rejected as unauthorized.)
- **Verified live:**
  | Route | No token | Wrong token | Correct token |
  | --- | --- | --- | --- |
  | `POST /api/ai-insights` | `unauthorized` 401 | `unauthorized` 401 | `AI not configured` (no `GEMINI_API_KEY` secret — expected) |
  | `POST /api/notify-whatsapp` | `unauthorized` 401 | `unauthorized` 401 | `WhatsApp not configured` (no WA secrets — expected) |
  | `GET /api/health` | open by design | | |
- Worker secrets now: `SERVER_ORIGIN`, `WORKER_API_TOKEN` (both secret_text),
  plus the `AI_INSIGHTS_KV` binding from the deploy script.

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
| GitHub `main` | HEAD `7f11169` (pushed) — session export + nodemailer dep |
| Railway staging | `dash-site-production-07cc.up.railway.app` — LIVE, all fixes, verified 14/14 in browser |
| GitHub Pages | `vcharyanaco-tech.github.io/dash-site` — LIVE, workflow success (frontend-only) |
| Cloudflare Worker `dashv1-proxy` | **NEW build live** — repo worker.js with path/`/api`/`ctx` fixes; secrets: `SERVER_ORIGIN` + `WORKER_API_TOKEN` |
| Live `dashboardharyana.site` | **CUT OVER to Node backend** (Worker → Railway). Frontend unchanged (dashv1 bundle); API now hits Node/SQLite |
| GAS Apps Script | repo updated with ReadAt; **not pushed to the project yet** (now only relevant as fallback) |

## Current git state (dash-site)
- HEAD: `7f11169` — docs: save 2026-08-13 session export + add nodemailer dependency
- Uncommitted: `src/worker/worker.js` — the three cutover fixes (`path`
  restore, bare `/api` match, `ctx` param for `handleEnterpriseRoute`).
  **These are deployed live but NOT yet committed** — commit them so the repo
  matches the live worker.

## Resume checklist (next session)
1. **Commit the pending `src/worker/worker.js` fixes** (deployed live, not in
   git yet).
2. Get the Gmail address + App Password from the owner; set `SMTP_*` vars on
   Railway; send a test mail to confirm.
3. **Browser-verify the live domain post-cutover** — re-run
   `tmp-verify-browser.cjs` (login → Manage users → submission flash) against
   `dashboardharyana.site` now that it serves the Node backend.
4. Consider setting `GEMINI_API_KEY`/`WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`
   on the worker if the local AI/WhatsApp routes should do real work (currently
   they are token-gated but unconfigured).
5. Decide whether to push the updated GAS files (clasp/editor) — only relevant
   if GAS stays as a fallback during soak.
6. Decide on the `CNAME` file (Pages may prompt to claim the live domain).
7. Grab `/tmp/worker_api_token.txt` → password manager → delete the file.
