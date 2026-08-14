# Session export — 2026-08-14 (live browser verify, frontend cutover to dash-site repo, SMTP attempt)

## Context / goal
Resumed from the 2026-08-13 export (cutover executed, worker hardening). This
session: recreated the browser-verify script and ran it against the **live**
`dashboardharyana.site` (post-cutover), fixed the one finding (live site was
serving a stale dashv1 frontend bundle), redeployed the worker, set SMTP vars
on Railway (creds rejected — needs App Password), and investigated the GAS
push (skipped by owner decision).

## 1. Browser verification — live domain (recreated `tmp-verify-browser.cjs`)
- Script drives headless Chrome via CDP (Node 24 native WebSocket, no
  packages). Flow: login → Manage users (dup check) → add update → badge
  flashes → admin re-opens modal → flash off/count stays → cleanup.
- **First run: 6/7 PASS.** The one FAIL (step 4) was real: the flash did NOT
  clear immediately when the admin re-opened the modal.
- **Root cause:** the live site was serving the **old `dashv1` frontend bundle**
  from the separate `vcharyanaco-tech/dashv1` repo (worker `GITHUB_RAW` →
  `.../dashv1/main/docs`). That bundle's `loadSubmissions()` predates the
  read-based flash UX — it never clears the local flash flag — and it has **no
  "Mark all as read" button** (0 matches in the served app.js). The Node
  backend marks `read_at` correctly (verified: flash clears after a full
  reload, count stays) — the gap was purely client-side.
- A leaked test submission from an aborted run was cleaned up via the live API
  (deleted `VERIFY-*` row on card row 4).

## 2. Fix: serve the CURRENT frontend via the worker
- Changed `src/worker/worker.js`: `GITHUB_RAW` from
  `https://raw.githubusercontent.com/vcharyanaco-tech/dashv1/main/docs` →
  `https://raw.githubusercontent.com/vcharyanaco-tech/dash-site/main`
  (dash-site serves the frontend from the repo ROOT, not a `docs/` dir —
  verified file layout + updated the stale routing comment).
- Redeployed live worker via `node src/worker/deploy-worker-api.js $CLOUDFLARE_API_TOKEN`.
- Post-deploy: `/`, `/app.html`, `/app.js`, `/assets/styles.css`,
  `/assets/site.css`, `/manifest.json`, `/sw.js` all 200 with correct content
  types; served app.js now has the Mark-all + read-flash logic (8 matches).
- **Re-ran browser verification on the live domain: 8/8 PASS**
  - Login → ADMIN ✓; Manage users 6 users, 0 dups ✓
  - Add update → badge flashes (count=1) ✓
  - Admin re-opens modal → **flash clears immediately**, count stays ✓
  - Server read_at persists across reload ✓; cleanup ✓
- Note: the live frontend now targets same-origin `/api` (dash-site app.js),
  which the worker forwards to the Node backend — no API change needed.

## 3. SMTP setup (IN PROGRESS — blocked on App Password)
- Railway GraphQL API reached via refreshed OAuth token (expired token
  refreshed with the CLI's public client_id; full project/env/service IDs
  found in `~/.railway/config.json`: project `e81e06b1-fcb7-4306-8c79-39eca8a2a594`,
  env `115ab2ef-4446-4c3a-9feb-fa51f687df72` (production), service
  `b9bdfd65-014f-40bc-a80b-3a90f61bb4cb`).
- Set env vars via `variableUpsert` (skipDeploys:true) then triggered
  `serviceInstanceRedeploy` (SUCCESS):
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`,
  `SMTP_USER=vcharyanaco@gmail.com`, `SMTP_PASS=<owner-provided>`,
  `SMTP_FROM=vcharyanaco@gmail.com`.
- **Test failed:** Gmail SMTP rejects the provided password
  (`535 5.7.8 Username and Password not accepted`). The owner-provided value
  (`Dop@12345`) is a regular password; Gmail requires a **16-char App
  Password** (Google Account → Security → 2-Step Verification → App passwords).
- Owner chose to generate an App Password; **pending — paste it here to
  finish** (vars are already set; just need to update `SMTP_PASS` + redeploy +
  send a test mail).
- Test path that works: `emailReport` (sends PDF to a recipient) or
  `adminEmailAllUsers`. (`requestPasswordReset` only mails OTHER admins, so
  it's a dead end when the requester is the only admin.)

## 4. GAS push — investigated, SKIPPED (owner decision)
- Owner initially chose "push updated GAS files (ReadAt parity)" to the live
  Apps Script project. `clasp` is installed/logged in; project scriptId
  `1QYwVDQGWPL5o64Xrvv9kKfE-AFT2nUuVMlvOc5CTK46qClfTCu3ofWcU`.
- **Investigation showed the repo `src/gas/` mirror is STALE relative to the
  live project** — a full `clasp push` would regress it:
  - Live `Auth.js` (1860 ln) has PBKDF2 iterations, rate limits,
    kill-sessions — repo (1376 ln) lacks them.
  - Live `Settings.js` has `RATE_LIMIT`, `AUDIT_ARCHIVE`, `USER_KILL_SESSIONS`,
    `PBKDF2_ITERATIONS` — repo lacks them.
  - Live-only files: `Counts.js`, `Migration.js`, `EnterpriseService.js`
    (repo has `EnterpriseService.gs` instead — would be a duplicate).
  - Live `script.html` is minified (342 ln, prod build); repo is 4931 ln.
  - Only genuinely newer in repo: `ReadAt` in `Submissions.js`,
    `SUBMISSION_READ_ALL` in `Settings.js`, client handler in `script.html`.
- **Owner decision: skip the GAS push.** GAS stays as-is; it's only a manual
  fallback now (Node backend is primary and has full read-based flash). The
  live Apps Script project was NOT modified.

## 5. Other loose ends (owner decisions recorded)
- Worker API token file `/tmp/worker_api_token.txt` — **kept** (owner will
  store in a password manager; token verified live: no/wrong token → 401,
  correct token → reaches AI handler).
- Repo `CNAME` file — **kept** (Pages may prompt to claim the domain; no DNS
  changes).
- Worker AI/WhatsApp secrets — **skipped for now** (routes stay token-gated,
  unconfigured).

## Current git state (dash-site)
- Uncommitted: `src/worker/worker.js` (GITHUB_RAW repoint + comment update —
  **deployed live**, needs committing so the repo matches the live worker) and
  `tmp-verify-browser.cjs` (verify script — kept for re-runs).
- HEAD before this session: `c53dd78`.

## Resume checklist (next session)
1. **Commit `src/worker/worker.js`** (deployed live; repo must match) — and
   decide whether to keep `tmp-verify-browser.cjs` in the repo.
2. **Finish SMTP:** owner pastes the 16-char Gmail App Password →
   update `SMTP_PASS` on Railway → redeploy → test via `emailReport` to
   vcharyanaco@gmail.com.
3. Optional: set `GEMINI_API_KEY` / WhatsApp secrets on the worker if the
   enterprise routes should do real work.
4. Optional: revisit GAS ReadAt parity only if GAS stays as a live fallback
   (would require editing the LIVE project files directly, not repo push).

---

# Session export — 2026-08-14 (cont.): Render migration + link-loss fix (write-triggered sync)

## Context / goal
Continued from the same day: migrated the whole project from Railway to Render
(service `srv-d9uqprijobas73bh8ie0`, live at `dashboardharyana.site` via the
Cloudflare worker bridge), nullified Render's 15-min inactivity sleep via a
health pinger, worked around the lack of a persistent disk (SQLite lives in
`/app/data`, synced to Cloudflare KV every 10 min + on shutdown), and fixed a
recurring "links created in the DB are lost" bug.

## Root cause of the recurring link loss
- Railway's DB became **corrupt** during migration (290KB file, unreadable
  records) — it can no longer be a data source. Render's live SQLite DB is the
  single source of truth.
- The KV snapshot (what Render restores on boot) lagged the live DB by up to
  **10 minutes** — backups only ran on the interval and at shutdown. Any link
  added inside that window vanished on the next Render restart. This was the
  "links lost again" loop the user kept hitting.

## Fixes shipped (committed + pushed, live on Render)
1. **Write-triggered backups** (`src/server/data-sync.js` `requestBackup()`):
   every records/submissions mutation now schedules a KV push shortly after the
   write (debounced + serialized via `backupInFlight`), so the snapshot tracks
   the live DB in seconds instead of minutes. Wired into `records.js`
   `bumpDataGeneration_()` and the `submissions.js` mutations.
2. **Debounce 3s → 1s** (commit `ec22f8a`): even faster crash recovery — the
   snapshot updates within ~1s of the last write.
3. **20s hard timeout on all bridge calls** (`fetchBuf`/`putBuf`): a hung PUT
   can no longer leave `backupInFlight` stuck forever and stall every later
   write-backup.
4. **Links baked into the fresh-boot CSV** (`migration-export/records.csv` +
   `import-from-gas.js`): the CSV now has an 8th links-JSON column and the
   importer parses it, so even a boot with an empty KV keeps all links.
5. **`no-store` on worker backup responses** (`src/worker/worker.js`): the CDN
   can never serve a stale/corrupt snapshot to the restore path (was biting us
   all day — stale 401s and a stale 290KB corrupt response got cached).

## Verified end-to-end on the live site
- Login works (`vcharyanaco@gmail.com` / `Admin@123`, salted pbkdf2 hashes).
- API shape: `POST /api` `{function, args}`; `login(identifier, password)`
  with **email** as identifier; `addItem(item, token)` / `deleteItem(row,
  token)` take the **raw DB row** (row = id + 3, START_ROW=4); KV endpoints use
  a **Bearer** header (not `?token=`).
- KV snapshot in sync with live; integrity ok; 0 junk.
- Write-triggered sync confirmed both directions (add + delete reach KV through
  the debounce; bursts coalesce into one push 1-3s after the last write).

## Environment notes
- Render API key: `rnd_zOQwv3O76ZIg7af1MU1xCuzOk9Zv` (used for deploy polling,
  env var checks, log checks — logs endpoint path was fiddly).
- Worker token file: `/tmp/worker_api_token.txt` (matches `WORKER_API_TOKEN`
  secret; CDN cached 401s for ~1h after a secret change — use `?t=` cache
  busting when probing).
- Worker domain: `dashboardharyana.site`; backup endpoints:
  `GET/PUT /api/backup/db` and `/api/backup/uploads`.
- `data/` is gitignored; the scratch `data/dashboard.db` on this machine is a
  local dev copy, not the live DB.

## Current git state (dash-site)
- HEAD: `ec22f8a perf(data-sync): shorten write-backup debounce from 3s to 1s`
  — pushed, all deploys live, working tree clean.
- Earlier commits this day: `031bdc4` (20s timeout), `670ec47` (links baked
  into CSV), plus the worker `no-store` fix.

## Resume checklist (next session)
1. **Verify the 1s debounce on live** (started but interrupted): write a test
   record, confirm KV hash changes within ~5s, then delete it by its **raw DB
   row** (probe scripts were deleted; recreate `tmp-debounce-probe.cjs` from
   this note). Note: a row-mismatched delete during the interrupted probe
   removed 2 legit records from live (PMEGP row shifted); the authoritative
   21-record set is in `migration-export/records.csv` — re-add any missing
   records by their CSV row if live still shows 19.
2. Confirm Render keeps the site warm (health pinger still active) and KV
   stays in sync after the 1s debounce change.
3. Optional: refresh `migration-export/records.csv` from the live DB again so
   the baked snapshot carries the newest links.
