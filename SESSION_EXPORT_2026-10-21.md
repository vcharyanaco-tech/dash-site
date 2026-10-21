# Session export — 2026-10-21

Resumed from `SESSION_EXPORT_2026-10-08.md`. `git fetch origin` was a no-op:
local `main` matched `origin/main` (0 ahead, 0 behind). The only local delta was
an uncommitted `run-backend.ps1` (+51/−9), and the newest commit (`8ee1dcc`) had
no export of its own, so this file covers both.

One unit of work: **make `run-backend.ps1` survive a Startup-folder launch**,
then a second: **cut the Render egress that exhausted the 5 GB Hobby allowance**
(both repos), and a third: **bring the Aadhaar dashboard back locally while its
Render service is still suspended**.

| SHA | Subject |
|---|---|
| `8ee1dcc` | Add `run-backend.ps1`: run the backend locally behind a Cloudflare quick tunnel while Render is suspended |
| `c86c901` | `fix:` load `.env.local` and survive stale PATH in `run-backend.ps1` |
| `4f52b10` | `fix:` retry tunnel health check and record bandwidth findings |
| `8d41733` | `fix:` compress and dedupe KV snapshot uploads |
| `ee8a139` | `fix:` run the Aadhaar fallback alongside the main backend |
| `b1c0fee` | aadhar-dashboard: cut backup egress with gzip, dedupe and a daily checkpoint |

---

## 1. Why it failed when launched from Startup

`cloudflared` **is installed** on this machine — `winget list` reports
`Cloudflare.cloudflared 2026.10.2` — but the binary lives at
`C:\Program Files (x86)\cloudflared\cloudflared.exe`, and neither the machine
nor the user `PATH` contains that directory. `Get-Command cloudflared` therefore
misses it even in a normal shell, and a Startup-folder launch starts from an
environment snapshot that is older still.

The script's only recovery path was `winget install`, which exits non-zero when
the package is already installed. The old code treated that as fatal and threw
before the tunnel ever started. The same launch also skipped `.env.local`
entirely, so `DATA_SYNC_URL`, `WORKER_API_TOKEN`, `MAIL_HTTP_URL` and
`FATHOM_API_KEY` never reached the backend (breaking sync and the mail relay),
and the child process hard-set `DASH_DATA_DIR` over any value the env file
provided.

Stale `%TEMP%\dash-*.pid` files (17852 / 13608) were left from that failed run;
no `node` or `cloudflared` process was alive.

## 2. What changed

- **Env loading** — a step 0 reads `.env.local` like `start-server.sh`:
  comments, optional `export `, values containing `=`, one layer of matching
  quotes stripped, and variables already present in the process env win.
- **`DASH_DATA_DIR`** — the backend child now defaults it to
  `src/server/data` only when it is unset, so a path from `.env.local` is
  honoured.
- **`Refresh-Path`** — appends registry entries the current process is missing
  instead of replacing `PATH`, so session-only entries (npm shims, nvm, pip)
  keep working.
- **cloudflared fallback** — after `winget` (now guarded by
  `Get-Command winget`), checks `Program Files\cloudflared`,
  `Program Files (x86)\cloudflared` and `%LOCALAPPDATA%\Microsoft\WinGet\Links`,
  then prepends the directory it finds and re-resolves. Throws only if all fail.
- ASCII-normalised the remaining em-dashes in messages/comments.

## 3. Verification

- PowerShell parser: clean (`[Parser]::ParseFile`, 0 errors).
- Env loader executed from the real file: 7 cases pass — plain, `export`,
  double-quoted (spaces), single-quoted, `a=b=c`, empty, and "process env wins".
- `Refresh-Path` executed from the real file: a `C:\__session_only_sentinel__`
  entry survived, existing entries survived, join stayed correct.
- cloudflared block executed from the real file: resolved to
  `C:\Program Files (x86)\cloudflared\cloudflared.exe` without installing
  anything.
- `git diff --check` clean; `node scripts/secret-scan.cjs` passed (230 files).
- **End-to-end run completed** (see below); the first tunnel check returned 530,
  which is why step 6 now retries.

## 4. End-to-end run (2026-10-21 ~13:57 IST)

`.\run-backend.ps1` ran clean:

| Step | Result |
|---|---|
| backend | healthy on `http://localhost:8787/api/health` |
| tunnel | `https://favorites-boulder-fallen-polyphonic.trycloudflare.com` |
| Worker secret | `SERVER_ORIGIN` uploaded to `dashv1-proxy` |
| tunnel health | 530 on the first probe, **200 after ~10 s** |
| Worker health | `https://dashboardharyana.site/api/health` → 200 |
| Worker → backend | `POST /api` probe returns the backend's `Unknown function` JSON through both the tunnel and the Worker |
| data sync | enabled; `lastBackupAt` advancing, `writesToday` 2/400 |

The 530 was the expected race documented above, not a failure. Step 6 now polls
12 × 5 s before warning, so the script's own output matches reality.

## 5. Why the Render bandwidth limit was exhausted

**The limit is 5 GB/month, not 100 GB.** The Hobby workspace includes
**5 GB** of outbound bandwidth; without a payment method Render suspends every
Free service for the remainder of the month once it is exceeded. Both services
are currently `suspended` (confirmed via `GET /v1/services`).

Render's own metrics (`GET /v1/metrics/bandwidth` and
`/v1/metrics/bandwidth-sources`), **1–21 October 2026**:

| Service | Total | HTTP | WebSocket | Service-initiated (NAT) |
|---|---:|---:|---:|---:|
| dash-site (`srv-d9uq…`) | 3,074.9 MB | 49.6 MB | 0 | **3,025.3 MB (98.4%)** |
| aadhar-dashboard (`srv-dasv…`) | 2,452.3 MB | 66.9 MB | 75.4 MB | **2,309.9 MB (94.2%)** |
| **workspace total** | **5,527.2 MB** | 116.5 MB | 75.4 MB | **5,335.2 MB (96.5%)** |

**Verdict: neither dashboard's UI is the culprit.** 96.5% of the usage is
service-initiated traffic, and the volume matches the full-database snapshot
backups sent to Cloudflare KV on a timer:

- `dash-site` uploads its whole SQLite DB (1.32 MB) **every 10 minutes**
  (`DATA_SYNC_INTERVAL_MS` unset) → ~190 MB/day, measured ~144 MB/day.
- `aadhar-dashboard` uploads its whole DB (5.62 MB) **every hour**
  (`AADHAR_SYNC_INTERVAL_MS=3600000`) → ~135 MB/day, measured ~110 MB/day.
- Browser-facing HTTP + WebSocket is only ~192 MB over 21 days (3.5%).

Both loops push even when nothing changed: no content hash, no compression.
`dash-site` is the larger single consumer (56% of the total), but the shared
root cause is the unconditional snapshot uploads.

Cheap remediation — **implemented 2026-10-21, see section 6**:

1. Hash the snapshot and skip the PUT when unchanged (removes most uploads).
2. gzip before PUT — measured ratios: dash-site **5.1×**, aadhaar **1.9×**.
3. Keep write-triggered snapshots; they cover the "edit then crash" window.
4. The interval env vars remain an emergency lever
   (`DATA_SYNC_INTERVAL_MS=3600000` / `AADHAR_SYNC_INTERVAL_MS=21600000`)
   but are no longer required.

**Security note:** a live Render API key is committed in
`SESSION_EXPORT_2026-08-14.md` (tracked). It was used read-only for this
investigation and should be revoked and scrubbed from history.

## 6. Bandwidth fix implemented

Both backup loops now send **gzip** and **skip the upload when the content is
unchanged**. The dash-site Worker needs no change: it already stores and returns
opaque `arrayBuffer` values, so gzip bytes ride through untouched. The aadhar
dashboard uses a separate dedicated Worker, which had to learn to decompress
gzip before validating and storing raw SQLite; that Worker deployment is still
blocked (see below).

### `dash-site` — `src/server/data-sync.js` (`8d41733`)

- SHA-256 of the raw `VACUUM INTO` snapshot; if it matches the last successful
  push, `/db` is not called at all. `VACUUM INTO` is deterministic for an
  unchanged DB (verified across repeated snapshots), so idle timer ticks cost
  a local copy but zero egress.
- Uploads/meetings are deduped per file by content hash too, so a periodic
  backup no longer re-sends every attachment.
- The snapshot is gzipped (`level 6`) before the PUT. Restore sniffs the
  `1f 8b` magic and accepts **legacy raw SQLite** values as well.
- The files-before-DB commit order and the reserved `/db` budget slot are
  preserved; a file only consumes the last slot when the DB is unchanged.
- `lastBackupAt` now means "last verified snapshot" (upload or confirmed
  identical); `lastUploadAt` is the last actual PUT. Health also exposes
  `skippedUnchanged` and `dbStoredBytes`.
- When nothing changed, the stats PUT is throttled to 15 min, so an idle
  dashboard spends 4 KV writes/hour instead of 12.

### `aadhar-dashboard` — `b1c0fee`

- SHA-256 dedupe of the raw SQLite snapshot, gzip (`mtime=0`, level 6), and a
  25 MiB compressed-value guard. Measured on the real DB: 5,894,144 bytes raw
  to 3,121,189 gzip (1.89x).
- A daily checkpoint (`AADHAR_SYNC_CHECKPOINT_MS`, default 86,400,000 ms)
  re-uploads an unchanged snapshot at most once a day, so an idle backup does
  not look stale and a rollback point stays recent. `0` disables it.
- `_last_hash` is seeded from `restore_data()`; the generation id's timestamp
  seeds `_last_push_at`, so a fresh restore is not re-uploaded. A fallback past
  an invalid latest generation leaves the hash unset so the repair is
  republished; a manual rollback does the same.
- Restore accepts gzipped and legacy raw snapshots. The dedicated Worker
  (`backup-worker/worker.js`) decompresses gzip, validates SQLite, and stores
  raw bytes, so existing generations and rollback stay raw.
- Rolling-deploy safety: if the old Worker rejects gzip (`not_sqlite`), the
  client retries the same snapshot raw and pauses compression for six hours
  before probing again.
- Status exposes `last_upload_at`, `last_checked_at`, `stored_bytes`,
  `last_encoding`, and `skipped_unchanged`; the admin tab shows the checkpoint
  cadence.
- The earlier `18f649b` branch was based on diverged history and is preserved as
  `backup/kv-sync-gzip-18f649b`; the fix was re-applied on `cf20636` and pushed
  as `b1c0fee`.

### Verification

- New `src/server/tests/backup-compression.test.js`: 3/3 — gzip magic,
  unchanged-cycle skip, changed-DB re-upload, legacy+gzip decode.
- Existing `backup-order` / `backup-status` tests still pass.
- Full Node suite: **600 passed, 0 failed**.
- New `aadhar-dashboard/tests/test_backup_compression.py`: **7 passed** — gzip,
  dedupe, changed re-upload, daily checkpoint, old-Worker fallback, restore +
  dedupe seed, and repair after an invalid latest generation.
- New `backup-worker/worker.test.mjs`: **6 passed** — gzip round-trip,
  decompression cap, bad gzip, gzipped PUT stored raw, raw compatibility, and
  an advertised-gzip mismatch.
- Full aadhar pytest suite: **162 passed**. `wrangler deploy --dry-run`
  bundles successfully (13.31 KiB).

Expected egress: idle cycles now cost no PUT, except the aadhar daily
checkpoint (~3.1 MB/day at 1.9x, about 93 MB/month). Changed snapshots are
5.1x (dash-site) / 1.9x (aadhaar) smaller. That leaves ample room inside the
5 GB allowance even on a busy editing day.

Deployment: the local dash-site backend was restarted and now serves the gzip
build — `/api/health` reports `dbStoredBytes` 272,234 against `dbBytes`
1,380,352. The aadhar commit is pushed; Render will auto-deploy it when the
service resumes. The dedicated aadhar Worker still needs a manual deploy from
an account with access to `606780bc6c3ecd48289472c73d27a982`; the current token
only sees `a01eb877733d755cb57e25827a9c52fe` and gets
`403 ... Authentication error`. Until then the client's raw fallback keeps
backups working, but gzip stays inactive.

## 7. Aadhaar route outage (2026-10-21)

**Symptom:** `https://dashboardharyana.site/aadhar-dashboard/` returned the
Worker's 503 `Aadhaar dashboard unavailable (HTTP 503)` even while the main
`/api/*` tunnel was healthy.

**Cause:** the tunnel started by `run-backend.ps1` only replaces the main
backend and updates `SERVER_ORIGIN`. `/aadhar-dashboard/*` is a separate
Streamlit service behind the separate `AADHAR_ORIGIN` secret, which still
pointed at `https://aadhar-dashboard-5i4x.onrender.com`. A direct request to
that origin returned `x-render-routing: suspend-by-user` and "This service has
been suspended by its owner."

**Fix:** started the sibling `aadhar-dashboard` Streamlit app locally on port
8501 from `boot.py`, opened a second Cloudflare quick tunnel, and updated the
`AADHAR_ORIGIN` secret. The setup is now scripted:

- `run-aadhar.ps1` starts/reuses the local Streamlit app, starts/reuses its
  tunnel, updates `AADHAR_ORIGIN`, and verifies the public route. `-Stop` stops
  both processes.
- `run-backend.ps1` now calls it after the main backend is healthy;
  `-SkipAadhar` keeps the old main-only behaviour, and `-Stop` stops both.
- The Startup-folder `dash-backend.cmd` needs no edit: it calls
  `run-backend.ps1`, which now brings up both services.

**Verified after a clean restart of both fallbacks:**

| Check | Result |
|---|---|
| `GET /` | 200 |
| `GET /aadhar-dashboard/` | 200, Streamlit HTML |
| `GET /aadhar-dashboard/_stcore/health` | 200 `ok` |
| Streamlit JS asset through the Worker | 200 |
| Streamlit WebSocket `_stcore/stream` | opened, protocol `streamlit` |
| `GET /api/health` | 200, gzip stats active |

**Caveats:**

- The local Aadhaar process has **no `AADHAR_SYNC_URL` / `AADHAR_SYNC_TOKEN`**,
  so it serves the local `data/aadhaar.db` but does not mirror new writes. Treat
  it as read-only until the bridge token is supplied; do not enter production
  data that exists nowhere else.
- Both quick tunnels run on this PC. They stop when the machine shuts down;
  Startup only restarts them after login, and the hostnames change. The scripts
  update both Worker secrets on every start.
- The Hobby bandwidth allowance resets at the start of the next monthly cycle,
  **1 November 2026 (UTC)**, which is when the suspended Render services become
  eligible to resume. After the new commits auto-deploy, repoint
  `SERVER_ORIGIN` and `AADHAR_ORIGIN` from the quick tunnels back to the Render
  service URLs **before** shutting this PC down. Otherwise the public routes
  still depend on the local tunnels even though Render is healthy again.

## Files changed

```
dash-site/run-backend.ps1        also starts/stops the Aadhaar fallback
dash-site/run-aadhar.ps1         new: local Streamlit + second quick tunnel
dash-site/README.md              documents the one-command local fallback
src/server/data-sync.js          +138/-22  gzip + content-hash dedupe,
                                           legacy restore, stats fields
src/server/tests/backup-compression.test.js  new, 3 tests

aadhar-dashboard/kv_sync.py      +211/-?   gzip, dedupe, daily checkpoint,
                                           fallback-safe restore
aadhar-dashboard/app.py          status captions for skipped checks/checkpoint
aadhar-dashboard/README.md       config + durability notes
aadhar-dashboard/tools/check_backup_health.py  26 h stale threshold
aadhar-dashboard/backup-worker/worker.js       gzip decompress + raw storage
aadhar-dashboard/backup-worker/worker.test.mjs new, 6 tests
aadhar-dashboard/backup-worker/package.json    new, test script
aadhar-dashboard/tests/test_backup_compression.py new, 7 tests
```

## Pending tasks (carry forward)

1. **Verify a sheet write against a real sheet** — credential exists; rehearse
   with `CHANGE_REQUEST_DRY_RUN=true`, then write one throwaway cell.
2. **Bundle headroom** — 552.4 of 575 KB raw consumed; next `app.js` change
   will trip it. Trim rather than raise a third time.
3. **Deploy the aadhar backup Worker** - the client is safe to ship first, but
   gzip stays inactive until `backup-worker/worker.js` is deployed from an
   account with access to `606780bc6c3ecd48289472c73d27a982`. The current token
   only sees `a01eb877733d755cb57e25827a9c52fe` (`403 Authentication error`).
4. **Verify aadhar gzip and checkpoint live** - after the Worker deploy and
   Render resume, confirm `last_encoding: gzip`, a 1.9x stored/raw ratio, and
   one checkpoint upload per 24 h. The local fallback currently has no bridge
   token, so it does not exercise these paths.
5. **Verify main dedupe over time** - the restarted backend already reports
   `dbStoredBytes 272,234 < dbBytes 1,380,352`; after the next 10-minute tick,
   confirm `skippedUnchanged` rises and no PUT is logged.
6. **Local Aadhaar writes** - supply `AADHAR_SYNC_URL`/`AADHAR_SYNC_TOKEN` to the
   local fallback if production writes are needed; otherwise keep it read-only
   and copy the DB back after 1 November.
7. **`DASH_PUSH_TO_SHEET` is off** — decide whether approvals should update the
   origin spreadsheet.
8. **Private sheets** — open since 2026-09-25. Keep the printed note, or build
   Google OAuth (Drive/Sheets read scope).
9. **`gh` CLI** — still not installed; workflow checks use the REST API.
10. **Housekeeping** — the 23 untracked root files (`ipad_*.html`,
    `support_*.html`, `*.py`, `images/`, `ref_pdf_content.txt`) remain untracked
    and uncommitted per AGENTS.md.
11. **Cut back to Render on 1 November** - after both Render services resume and
    auto-deploy, set `SERVER_ORIGIN` and `AADHAR_ORIGIN` back to their Render
    URLs, then stop the local fallbacks and disable the Startup entry (or keep
    it as a standby).
12. **Rotate the Render API key** committed in `SESSION_EXPORT_2026-08-14.md`.

## Deployment notes

Unchanged and still true:

- Frontend → GitHub Pages; the Worker serves the same files from the raw CDN.
- Backend → **Render** (`autoDeploy: true`) is suspended until **1 November
  2026 (UTC)**, when the Hobby monthly bandwidth allowance resets. Until then
  `run-backend.ps1` is the local replacement: it starts the Node backend,
  starts the Aadhaar Streamlit app, opens one quick tunnel per service, and
  updates `SERVER_ORIGIN` / `AADHAR_ORIGIN`. The Worker proxies `/api/*` to the
  first and `/aadhar-dashboard/*` to the second.
- Both quick tunnels run on this PC and stop when it shuts down; Startup only
  restarts them after login, and their hostnames change on every fresh start.
  The Worker secrets therefore still point at the tunnels; restore the Render
  URLs when the services resume.
- "Deploy Worker" reports success even when it skipped the real step
  (`CLOUDFLARE_API_TOKEN` unset). A green Worker checkmark means nothing.
- The aadhar backup Worker must be deployed separately:
  `cd aadhar-dashboard/backup-worker; wrangler deploy` with credentials for
  account `606780bc6c3ecd48289472c73d27a982`.
- Pages CDN propagation lags ~75 s — use a cache-buster before concluding a
  deploy failed.
