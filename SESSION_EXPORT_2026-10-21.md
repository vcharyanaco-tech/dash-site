# Session export — 2026-10-21

Resumed from `SESSION_EXPORT_2026-10-08.md`. `git fetch origin` was a no-op:
local `main` matched `origin/main` (0 ahead, 0 behind). The only local delta was
an uncommitted `run-backend.ps1` (+51/−9), and the newest commit (`8ee1dcc`) had
no export of its own, so this file covers both.

One unit of work: **make `run-backend.ps1` survive a Startup-folder launch.**

| SHA | Subject |
|---|---|
| `8ee1dcc` | Add `run-backend.ps1`: run the backend locally behind a Cloudflare quick tunnel while Render is suspended |
| `c86c901` | `fix:` load `.env.local` and survive stale PATH in `run-backend.ps1` |

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

Cheap remediation (not yet implemented):

1. Hash the snapshot and skip the PUT when unchanged (removes most uploads).
2. gzip before PUT — measured ratios: dash-site **5.1×**, aadhaar **1.9×**.
3. Raise `DATA_SYNC_INTERVAL_MS` to 1 h; aadhaar already runs hourly.
4. Keep write-triggered snapshots; they cover the "edit then crash" window.

Interim env-only mitigation (no code): `DATA_SYNC_INTERVAL_MS=3600000` on
dash-site and `AADHAR_SYNC_INTERVAL_MS=21600000` on aadhaar → ~55 MB/day total
(~1.7 GB/month), comfortably inside 5 GB.

**Security note:** a live Render API key is committed in
`SESSION_EXPORT_2026-08-14.md` (tracked). It was used read-only for this
investigation and should be revoked and scrubbed from history.

## Files changed

```
run-backend.ps1   +87/-11   env loading, DASH_DATA_DIR default, PATH append,
                            winget guard + cloudflared install fallback,
                            step-6 tunnel health retry
```

## Pending tasks (carry forward)

1. **Verify a sheet write against a real sheet** — credential exists; rehearse
   with `CHANGE_REQUEST_DRY_RUN=true`, then write one throwaway cell.
2. **Bundle headroom** — 552.4 of 575 KB raw consumed; next `app.js` change
   will trip it. Trim rather than raise a third time.
3. **Decide the bandwidth fix** — dedupe/compress the KV snapshots in
   `src/server/data-sync.js` (and mirror it in `aadhar-dashboard`), or apply
   the env-only interim mitigation. Details in section 5.
4. **`DASH_PUSH_TO_SHEET` is off** — decide whether approvals should update the
   origin spreadsheet.
5. **Private sheets** — open since 2026-09-25. Keep the printed note, or build
   Google OAuth (Drive/Sheets read scope).
6. **`gh` CLI** — still not installed; workflow checks use the REST API.
7. **Housekeeping** — the 23 untracked root files (`ipad_*.html`,
   `support_*.html`, `*.py`, `images/`, `ref_pdf_content.txt`) remain untracked
   and uncommitted per AGENTS.md.
8. **Rotate the Render API key** committed in `SESSION_EXPORT_2026-08-14.md`.

## Deployment notes

Unchanged and still true:

- Frontend → GitHub Pages; the Worker serves the same files from the raw CDN.
- Backend → **Render** (`autoDeploy: true`) is suspended; `run-backend.ps1` is
  the local replacement. The Worker only proxies `/api/*`.
- "Deploy Worker" reports success even when it skipped the real step
  (`CLOUDFLARE_API_TOKEN` unset). A green Worker checkmark means nothing.
- Pages CDN propagation lags ~75 s — use a cache-buster before concluding a
  deploy failed.
