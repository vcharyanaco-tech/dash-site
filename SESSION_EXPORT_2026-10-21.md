# Session export — 2026-10-21

Resumed from `SESSION_EXPORT_2026-10-08.md`. `git fetch origin` was a no-op:
local `main` matched `origin/main` (0 ahead, 0 behind). The only local delta was
an uncommitted `run-backend.ps1` (+51/−9), and the newest commit (`8ee1dcc`) had
no export of its own, so this file covers both.

One unit of work: **make `run-backend.ps1` survive a Startup-folder launch**,
then a second: **cut the Render egress that exhausted the 5 GB Hobby allowance**
(both repos), a third: **bring the Aadhaar dashboard back locally while its
Render service is still suspended**, a fourth: **move Aadhaar to a separate
Render workspace with its full database, leaving dash-site on the old account**,
and a fifth: **diagnose the one- to two-minute first load and reduce the new
free instance's 512 MB memory pressure**.

| SHA | Subject |
|---|---|
| `8ee1dcc` | Add `run-backend.ps1`: run the backend locally behind a Cloudflare quick tunnel while Render is suspended |
| `c86c901` | `fix:` load `.env.local` and survive stale PATH in `run-backend.ps1` |
| `4f52b10` | `fix:` retry tunnel health check and record bandwidth findings |
| `8d41733` | `fix:` compress and dedupe KV snapshot uploads |
| `ee8a139` | `fix:` run the Aadhaar fallback alongside the main backend |
| `d5cb345` | `fix:` keep the local fallback tunnels alive |
| `e85395f` | `fix:` wait longer for a new quick tunnel |
| `b1c0fee` | aadhar-dashboard: cut backup egress with gzip, dedupe and a daily checkpoint |
| `ba672a5` | `feat:` load Aadhaar bridge credentials from a local ignored file |
| `ca06e3a` | aadhar-dashboard: distinguish an existing local db from a failed restore |
| `6eab278` | aadhar-dashboard: explicitly ignore the local bridge env file |
| `f121f3c` | aadhar-dashboard: add a scoped local deploy helper for the backup Worker |
| `5c6d667` | aadhar-dashboard: record dedicated Render service and local credentials |
| `61837a6` | `fix:` make dash-site fallback main-only after Aadhaar migration |
| `2153fc3` | aadhar-dashboard: keep the chosen upload file after a failed save |
| `322b1b9` | aadhar-dashboard: bound memory use on the free Render instance |
| `5182cc7` | aadhar-dashboard: document the free-instance memory limit and mitigations |

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
- Live deploy check: Worker version `9a4d6f8f-6440-4c73-82f6-88d2b2654e23`;
  `/stats` reports `lastEncoding: gzip`, `lastReceivedBytes` 2,943,314 and
  `lastBytes` 5,894,144. The app log shows `5894144 -> 2943314 bytes gzip`.

Expected egress: idle cycles now cost no PUT, except the aadhar daily
checkpoint (~3.1 MB/day at 1.9x, about 93 MB/month). Changed snapshots are
5.1x (dash-site) / 1.9x (aadhaar) smaller. That leaves ample room inside the
5 GB allowance even on a busy editing day.

Deployment: the local dash-site backend was restarted and now serves the gzip
build — `/api/health` reports `dbStoredBytes` 272,235 against `dbBytes`
1,380,352. The aadhar commit is pushed; Render will auto-deploy it when the
service resumes.

The dedicated aadhar Worker was deployed on 2026-10-21 at 11:05 UTC with the
scoped local Cloudflare credential (version `9a4d6f8f-6440-4c73-82f6-88d2b2654e23`).
The local Aadhaar fallback has the bridge token (section 7), so the path is
exercised end to end: restarting the app pushed generation
`1792580718266-1b814c` at 11:05:18 UTC. It sent **2,943,314 gzip bytes**, stored
**5,894,144 raw bytes** (2.0x), and `/stats` reports `lastEncoding: gzip`. The
raw-upload fallback remains for old clients, so the Worker is backward
compatible.

Live check at 10:21 UTC: `skippedUnchanged` is **2**, `lastUploadAt` stayed at
10:01 across the later checks, and `dbStoredBytes` is 272,235 against
`dbBytes` 1,380,352. The main dedupe/gzip path is working end to end.

## 7. Aadhaar route outage (2026-10-21)

> Historical: this section records the temporary local fallback. Section 8
> supersedes it; Aadhaar now runs on the dedicated Render workspace.

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
  the app, its tunnel and the watchdog.
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

After the bridge restore and 16:08 IST restart, the public Aadhaar page and
`_stcore/health` still returned 200, the main `POST /api` origin probe returned
200, and the app log reported `bridge active` before pushing generation
`1792579160976-561845` at 10:39 UTC.

**Tunnel reliability:** at 09:56 UTC a network timeout killed both quick
tunnels. `cloudflared` logged `Unauthorized: Tunnel not found` and retried
forever; `/api/health` still answered because the Worker handles that path
itself, which hid the failure. `watch-tunnels.ps1` now probes the real origins
every 60 seconds (`POST /api`, which must reach Node, and the Aadhaar health
URL), then invokes the idempotent setup scripts to recreate only the dead
tunnel and update its secret. `run-backend.ps1` now reuses a healthy backend
and tunnel, and starts the watchdog; `-Stop` stops it. Tested by killing each
tunnel: Aadhaar recovered in about 2 minutes, main in about 1.5 minutes, without
restarting either local app. The first Aadhaar pass hit the old 45 s tunnel
health window and left the secret for the next pass, so that window was raised
to 90 s; the next watchdog tick would still have repaired it.

**Caveats:**

- **Bridge enabled.** `run-aadhar.ps1` now loads `AADHAR_SYNC_URL` and
  `AADHAR_SYNC_TOKEN` from `E:\projects\aadhar-dashboard\.env.local`, which is
  gitignored (`*.local` plus an explicit `.env.local` entry) and must never be
  committed. Before enabling it, the old local DB was copied to
  `data\aadhaar.db.pre-bridge-restore-20261021-160822.bak`, then the newest
  valid bridge snapshot was restored: generation `1792413087806-b725b9`
  (2026-10-19T12:31:27.806Z), **26 uploads, 3,102 transactions, 91 camps,
  12 users**, newest upload `2026-10-14 06:21`. The next boot pushed a fresh
  generation `1792579160976-561845` at 2026-10-21T10:39:20.976Z (5,894,144
  bytes raw), so the bridge is current and new local writes are mirrored again.
  The old database had 7 uploads, 871 transactions and no camps.
- **Gzip is live.** The gzip-capable Worker was deployed with the scoped
  credential at 11:05 UTC (version `9a4d6f8f-6440-4c73-82f6-88d2b2654e23`).
  Restarting the app cleared its six-hour raw backoff and pushed generation
  `1792580718266-1b814c`: **2,943,314 gzip bytes sent, 5,894,144 raw bytes
  stored** (2.0x), with `/stats` reporting `lastEncoding: gzip`. Raw uploads are
  still accepted for old clients.
- The Cloudflare API credential is stored only in the gitignored
  `E:\projects\aadhar-dashboard\.cloudflare.local`; its ACL is restricted to
  the current user, SYSTEM and Administrators. `backup-worker/deploy.ps1`
  refuses to deploy unless both that file and `wrangler.toml` point at the
  Aadhaar backup account, so the token is not used for dash-site.
- Both quick tunnels run on this PC. They stop when the machine shuts down;
  Startup only restarts them after login, and the hostnames change. The scripts
  update both Worker secrets on every start, and the watchdog recreates a
  dropped tunnel. Quick tunnels still have no uptime guarantee. A named
  Cloudflare tunnel would be stable, but the current API token can list tunnels
  and zones yet gets `403` on DNS records, so the DNS route cannot be created
  without a token addition or one dashboard step.
- The Hobby bandwidth allowance resets at the start of the next monthly cycle,
  **1 November 2026 (UTC)**, which is when the suspended Render services become
  eligible to resume. After the new commits auto-deploy, repoint
  `SERVER_ORIGIN` and `AADHAR_ORIGIN` from the quick tunnels back to the Render
  service URLs **before** shutting this PC down. Otherwise the public routes
  still depend on the local tunnels even though Render is healthy again.

## 8. Aadhaar moved to a dedicated Render workspace (2026-10-21)

The local-fallback notes in section 7 are historical. Aadhaar no longer runs on
this PC: it was moved to a separate Render workspace so the two dashboards have
independent free-tier bandwidth and suspension blast radius. The public URL did
not change.

| | |
| --- | --- |
| Workspace | `Vik's workspace team` (`tea-dbca8lrrjlhs73bb87p0`) |
| Service | `srv-dbcadio473hc73fkdu30` |
| Origin | `https://aadhar-dashboard-9ljo.onrender.com` |
| Deploy | `dep-dbcadj8473hc73fkduu0` (live) |
| Public URL | `https://dashboardharyana.site/aadhar-dashboard/` (unchanged) |

What was copied and verified:

- Service settings are the same as `render.yaml`: free plan, Oregon, Python,
  `pip install -r requirements.txt`, `python boot.py`, health path
  `/aadhar-dashboard/_stcore/health`, auto-deploy on commit, and all six
  environment variables (Python version, bridge URL/token, backup intervals and
  first-run temporary password).
- A final local backup was pushed as generation `1792583343622-211419`: **26
  uploads, 3,102 transactions (`tx`), 91 camps and 12 users**, newest upload
  `2026-10-14 06:21`, 5,894,144 raw bytes. The bridge `/db` download and the
  local `data\aadhaar.db` have the same SHA-256
  (`1C414C5B7BDCE56BED1A804DD20DF9AD8741EC38D1738A6D0086F1E8DF2036F3`), so the
  copied database is byte-for-byte identical.
- The new service's log confirms it restored that generation at boot, then
  pushed generation `1792583437615-941d20` at 11:50:37 UTC: 2,920,536 gzip bytes
  sent, 5,894,144 raw bytes stored, `lastEncoding: gzip`.
- The dash-site Worker secret `AADHAR_ORIGIN` was changed to the new Render URL.
  Direct Render health, public health and the public Streamlit page all return
  200; a public `_stcore/stream` WebSocket opened successfully.
- The keepalive Worker secret `AADHAR_ORIGIN` was changed to the same URL and
  `/ping` returned 200. The 12:10 UTC cron tick then updated
  `lastSuccessAt: 2026-10-21T12:10:13.683Z`, `lastOk: true`, status 200,
  `consecutiveFailures: 0`, so the keepalive path is confirmed.
- A user commit (`a40d307`, merged as `1b9b8ff`, "ok") landed on `main` at
  12:07 UTC and auto-triggered deploy `dep-dbcamejm8hqs73bl9gp0`. It went live
  at 12:10 UTC, restored generation `1792583437615-941d20` (5,894,144 bytes),
  skipped the unchanged upload, and passed direct/public health checks. That
  confirms auto-deploy and restore-before-Streamlit in the new workspace.
- The local Aadhaar app and tunnel were stopped. `run-backend.ps1` now defaults
  to dash-site only and starts a main-only watchdog. `-WithAadhar` keeps the
  emergency local fallback; `run-aadhar.ps1 -Stop` restores `AADHAR_ORIGIN` to
  the Render URL. README and the watchdog mode are updated.
- The new Render API key is stored only in the gitignored
  `E:\projects\aadhar-dashboard\.render.local` with a restricted ACL. The
  Cloudflare token remains only in `.cloudflare.local`, and the bridge token in
  `.env.local`. None are committed or printed.

The old Aadhaar service `srv-dasvqh8473hc73e53a3g` remains suspended in the old
workspace, but its auto-deploy was set to `no` so future Aadhaar commits cannot
redeploy it or compete for the bridge. It can be deleted after the new service
has survived a deploy/keepalive cycle. Dash-site remains on that old workspace
until its bandwidth allowance resets on **1 November 2026 (UTC)**.

## 9. Aadhaar free-instance OOM and slow first load (2026-10-22)

The public page was loading, but the first request sometimes took roughly one
to two minutes. Warm requests were normally sub-second, so the routing path was
not the problem. Render's event log showed two `server_failed` events with
`reason.oomKilled.memoryLimit: "512Mi"`:

| Time (UTC) | Event | Next `server_available` |
|---|---|---|
| 04:22:49 | instance `srv-dbcadio473hc73fkdu30-x79xg` killed | 04:23:19 |
| 04:26:40 | same instance killed again | 04:27:27 |

The 30-second memory samples were 202-223 MB before the first kill, then
reached 377 MB before the second. The spike between samples crossed 512 MB, so
the metric chart understates the peak. The logs showed a dashboard session
reconnecting immediately before the first kill and no application traceback;
this was memory pressure, not a code exception or a bad proxy route.

Mitigations in `322b1b9` (kept on the free plan):

- `render.yaml` and the live service now set `MALLOC_ARENA_MAX=2`,
  `MALLOC_TRIM_THRESHOLD_=65536`, `OPENBLAS_NUM_THREADS=1`,
  `OMP_NUM_THREADS=1`, `NUMEXPR_NUM_THREADS=1` and `MKL_NUM_THREADS=1`.
- Report caches are bounded to 8 entries; logo/target/backup-status caches to 1.
- `parsers.iter_sheets` reads one Excel sheet at a time instead of loading the
  whole workbook with `sheet_name=None`; `parse_first_usable` uses it.
- `.streamlit/config.toml` sets `disconnectedSessionTTL = 30` so a closed tab's
  state is released sooner.

Verification: deploy `dep-dbcp7jjm8hqs73aikh60` (commit `322b1b9`) went live at
04:42:08 UTC, restored generation `1792643524660-29f017`, and passed public page
and health checks at about 0.37 s. Memory settled at ~124 MB after boot and
~198 MB with the dashboard loaded, down from ~202 MB and ~261 MB before the
change. The docs-only follow-up `5182cc7` deployed as
`dep-dbcp9pdg1s2s738a7v3g` at 04:47:00 UTC and also returned 200 on both
public checks. No new `server_failed` event was recorded by 04:48 UTC. The full
Python suite passed (162 tests).

This does not make 512 MB support unlimited concurrent users. If the OOM
returns under normal use, the reliable fix is a paid instance with more RAM:
Render Starter Plus (1 GB, $15/month) or Standard (2 GB, $25/month). Starter
($7/month) is still 512 MB and would not address the limit. The free plan was
kept for now; the keepalive and night-skip schedule are unchanged.

### 9.1 Quick-tunnel audit (2026-10-22 06:24-06:27 UTC)

Aadhaar is **not** loading through a quick tunnel.

- Public `https://dashboardharyana.site/aadhar-dashboard/` and
  `.../_stcore/health` returned 200 with `x-render-origin-server: uvicorn` and
  a fresh `rndr-id`, so the Worker is proxying straight to Render.
- `%TEMP%\aadhar-tunnel.url` is absent, `%TEMP%\tunnel-watchdog.mode` is
  `main`, and no Streamlit process is running. The only dash-site cloudflared
  process targets `localhost:8787`; the other `localhost:8080` tunnel belongs
  to the local OpenCode server, not Aadhaar.
- The new Render key sees service `srv-dbcadio473hc73fkdu30` in owner
  `tea-dbca8lrrjlhs73bb87p0` ("Vik's workspace"), and the old service
  `srv-dasvqh8473hc73e53a3g` returns 404 on that key. The workspaces are
  separate as intended.
- Removing the Aadhaar quick tunnel therefore changes nothing: there is
  nothing left to remove. Removing the **dash-site** quick tunnel would stop
  the main dashboard's `/api/*` path until `SERVER_ORIGIN` is switched to the
  Render URL on 1 November or a named tunnel replaces it. Aadhaar would stay up.

Backup dedupe and gzip are independent of the tunnel and still live:

- `GET https://aadhar-backup.aadhar-haryana.workers.dev/health` at 06:27 UTC:
  latest generation `1792649453249-5430be`, `lastEncoding: gzip`,
  `lastBytes: 5894144`, `lastReceivedBytes: 2905022` (50.7% smaller on the
  wire), `pushesToday: 8/120`, `trackedGenerations: 12`.
- `tests/test_backup_compression.py`: 7 passed. Dash-site
  `src/server/tests/backup-compression.test.js`: 3 passed (gzip, unchanged
  snapshot skipped, changed snapshot re-uploaded, gzip/raw restore).
- Gzip is transport compression for the backup PUT; the Worker stores raw
  SQLite and restores either encoding. Dedupe is a SHA-256 comparison in the
  Aadhaar process, with a daily checkpoint that republishes an unchanged
  snapshot once per 24 h.

No `server_failed` event has been recorded since the 04:26:40 UTC OOM; the
latest deploy (`5182cc7`) remains live.

## Files changed

```
dash-site/run-backend.ps1        main-only by default; -WithAadhar local fallback;
                                  starts/stops watchdog; no longer repoints
                                  AADHAR_ORIGIN unless fallback is requested
dash-site/run-aadhar.ps1         local Streamlit + second quick tunnel; loads
                                  ignored bridge env; restarts app on env change;
                                  -Stop restores AADHAR_ORIGIN to Render
dash-site/watch-tunnels.ps1      main-only default; records watchdog mode;
                                  optional Aadhaar probing with -WithAadhar
dash-site/README.md              documents main-only fallback and separate
                                  Aadhaar Render service
src/server/data-sync.js          +138/-22  gzip + content-hash dedupe,
                                           legacy restore, stats fields
src/server/tests/backup-compression.test.js  new, 3 tests

aadhar-dashboard/kv_sync.py      +211/-?   gzip, dedupe, daily checkpoint,
                                           fallback-safe restore
aadhar-dashboard/app.py          status captions for skipped checks/checkpoint;
                                  bounded report caches (max_entries)
aadhar-dashboard/parsers.py      iter_sheets: one Excel sheet at a time
aadhar-dashboard/.streamlit/config.toml  disconnectedSessionTTL = 30
aadhar-dashboard/render.yaml     memory/thread env vars for the 512 MB cap
aadhar-dashboard/README.md       config + durability notes; local deploy helper;
                                  free-instance memory/OOM guidance
aadhar-dashboard/tools/check_backup_health.py  26 h stale threshold
aadhar-dashboard/backup-worker/worker.js       gzip decompress + raw storage;
                                  deployed as version 9a4d6f8f...
aadhar-dashboard/backup-worker/worker.test.mjs new, 6 tests
aadhar-dashboard/backup-worker/package.json    new, test script
aadhar-dashboard/backup-worker/deploy.ps1      scoped local deploy helper;
                                  refuses any other account
aadhar-dashboard/tests/test_backup_compression.py new, 7 tests
aadhar-dashboard/boot.py         corrects the false "empty database" warning
                                  when a populated local db already exists
aadhar-dashboard/.gitignore      explicit .env.local, .cloudflare.local and
                                  .render.local
aadhar-dashboard/README.md       dedicated Render workspace, new origin and
                                  credential-file guidance
aadhar-dashboard/.env.local      local only, ignored, never committed:
                                  bridge URL + token
aadhar-dashboard/.cloudflare.local  local only, ignored, never committed:
                                  scoped Cloudflare API token + account id
aadhar-dashboard/.render.local   local only, ignored, never committed:
                                  Render API key for the Aadhaar workspace
```

## Pending tasks (carry forward)

1. **Verify a sheet write against a real sheet** — credential exists; rehearse
   with `CHANGE_REQUEST_DRY_RUN=true`, then write one throwaway cell.
2. **Bundle headroom** — 552.4 of 575 KB raw consumed; next `app.js` change
   will trip it. Trim rather than raise a third time.
3. **Verify the aadhar daily checkpoint live** - gzip is confirmed; after 24 h
   of no writes, confirm the unchanged snapshot is re-uploaded once.
4. **`DASH_PUSH_TO_SHEET` is off** — decide whether approvals should update the
   origin spreadsheet.
5. **Private sheets** — open since 2026-09-25. Keep the printed note, or build
   Google OAuth (Drive/Sheets read scope).
6. **`gh` CLI** — still not installed; workflow checks use the REST API.
7. **Housekeeping** — the 23 untracked root files (`ipad_*.html`,
   `support_*.html`, `*.py`, `images/`, `ref_pdf_content.txt`) remain untracked
   and uncommitted per AGENTS.md.
8. **Dash-site cutover on 1 November** - Aadhaar is already on its dedicated
   Render workspace. When the old workspace's bandwidth resets, let dash-site
   auto-deploy, set `SERVER_ORIGIN` back to its Render URL, then stop the local
   backend/tunnel and disable the Startup entry (or keep it as a standby). Do
   not move dash-site until then; its Hobby allowance is still exhausted.
9. **Watch the next Aadhaar backup/deploy cycle** - keepalive and auto-deploy
   are confirmed in the new workspace. The next real write (or the daily
   checkpoint) should show a new bridge generation and a healthy Render deploy;
   check `/stats` and the Render deploy log rather than assuming.
10. **Old Aadhaar service cleanup** - `srv-dasvqh8473hc73e53a3g` is still
    suspended in the old workspace. Delete it only after the new service has
    completed a deploy and keepalive cycle; keep the old dash-site service until
    1 November.
11. **Credential hygiene** - revoke the Render API key committed in
    `SESSION_EXPORT_2026-08-14.md`. If this chat transcript is shared, also
    rotate the new Render API key, the bridge token and the scoped Cloudflare
    API token, then update the ignored `.render.local`, `.env.local` and
    `.cloudflare.local` files. Never commit or print them.
12. **Durable tunnel** - for the remaining dash-site fallback, if the Cloudflare
    token gets `DNS:Edit` (or a record is added from the dashboard), create a
    named tunnel with a stable hostname and point `SERVER_ORIGIN` at it. That
    removes the quick-tunnel recreation and secret churn. The current dash-site
    token lists tunnels and zones but DNS records return `403`.
13. **Aadhaar free-instance memory** - watch Render events and memory after
    `322b1b9`. The working set is now ~198 MB with a dashboard loaded, but the
    free plan still caps at 512 MB. If `oomKilled` returns under normal
    concurrent use, decide on Starter Plus (1 GB) or Standard (2 GB); do not
    pay for Starter, which is still 512 MB. Keepalive and the night skip are
    unchanged, so the first morning request can still pay a cold start.

## Deployment notes

Unchanged and still true:

- Frontend → GitHub Pages; the Worker serves the same files from the raw CDN.
- **Dash-site backend → Render** (`autoDeploy: true`) is still suspended until
  **1 November 2026 (UTC)**, when the old workspace's Hobby bandwidth resets.
  Until then `run-backend.ps1` is its local replacement: it starts only the Node
  backend and main quick tunnel and updates `SERVER_ORIGIN`. The Worker proxies
  `/api/*` to that tunnel.
- **Aadhaar backend → dedicated Render workspace**, service
  `srv-dbcadio473hc73fkdu30`, origin
  `https://aadhar-dashboard-9ljo.onrender.com`, auto-deploy on commit. The
  dash-site Worker proxies `/aadhar-dashboard/*` to it using `AADHAR_ORIGIN`;
  the public URL is unchanged. The keepalive Worker points at the same origin
  and keeps its 10-minute cron with the 21:00-06:00 IST night skip.
- The Aadhaar emergency fallback loads `AADHAR_SYNC_URL` /
  `AADHAR_SYNC_TOKEN` from the gitignored
  `E:\projects\aadhar-dashboard\.env.local` on every `run-aadhar.ps1` start and
  restarts the app when that file changes. The file is not in git; do not
  print it, commit it, or copy it into another repo. `run-backend.ps1 -WithAadhar`
  enables this fallback; the default run leaves Aadhaar on Render.
- Only the main quick tunnel runs on this PC now. It stops when the machine
  shuts down; Startup restarts it after login, and its hostname changes on every
  fresh start. `watch-tunnels.ps1` probes the main origin and recreates a dropped
  tunnel within about a minute; `run-backend.ps1 -NoWatchdog` opts out. A named
  tunnel is the durable alternative once DNS edit access is available. Aadhaar
  no longer depends on this machine.
- "Deploy Worker" reports success even when it skipped the real step
  (`CLOUDFLARE_API_TOKEN` unset). A green Worker checkmark means nothing.
- The aadhar backup Worker was deployed separately with credentials for account
  `606780bc6c3ecd48289472c73d27a982`. Future updates on this machine use
  `aadhar-dashboard/backup-worker/deploy.ps1`, which reads the gitignored
  `.cloudflare.local` and refuses to target any other account.
- Pages CDN propagation lags ~75 s — use a cache-buster before concluding a
  deploy failed.
