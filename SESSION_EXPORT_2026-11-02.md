# Session export - 2026-11-02

## 1. Dash-site restored to Render

Render bandwidth was restored, so the quick-tunnel fallback for dash-site was
retired and the deployment returned to its original hosting.

| Item | Value |
|---|---|
| Render service | `srv-d9uqprijobas73bh8ie0` (`dash-site`, free) |
| Origin | `https://dash-site-2wkg.onrender.com` |
| Worker | `dashv1-proxy`, route `dashboardharyana.site/*` |
| Worker secret | `SERVER_ORIGIN=https://dash-site-2wkg.onrender.com` |
| Cron | `*/10 * * * *`, keep-alive ping with 21:00-06:00 IST skip |

### Empty-database fix

The first boot after resuming came up with a 4,096-byte empty DB and
`dataSync.error: backup bridge PUT 401`. Render's `WORKER_API_TOKEN` was a
42-char legacy value; the bridge requires the current 64-char token. The env var
was updated through the Render API (value never printed), a new deploy
(`dep-dbk0tek9v7es73bcgi0g`) reached `live`, and boot restore pulled the KV
snapshot:

- `database.sizeBytes`: `1531904`
- `dataSync.uploads`: `0`, `dataSync.error`: empty
- `lastBackupAt` advanced to a fresh timestamp

The Worker `SERVER_ORIGIN` was then switched from the tunnel URL to the Render
URL, and the public route verified:

| Check | Result |
|---|---|
| `POST https://dashboardharyana.site/api` (`getServerTime`) | `200` |
| `https://dashboardharyana.site/app.html` | `200` |
| Render `/api/health` | `200`, 1.53 MB DB, no sync error |
| `GET /api/backup/db` with the bridge token | `200` (297,759 bytes gzipped) |

## 2. Quick-tunnel setup removed

Deleted now that Render is primary:

- `run-backend.ps1` (dash-site backend + tunnel orchestrator)
- `watch-tunnels.ps1` (main-only tunnel watchdog)
- Startup launcher
  `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\dash-backend.cmd`
- Stale `%TEMP%` state: `dash-backend.*`, `dash-run-backend.log`,
  `dash-tunnel.*`, `tunnel-watchdog.*`

`run-aadhar.ps1` is kept as the manual Aadhaar-only fallback; its stale
references to the removed scripts were cleaned up. No `cloudflared.exe` or
dash-site `node.exe` process remains, and the watchdog pid is dead.

`README.md` section "Temporary local fallback" was replaced with "Backend
hosting", documenting the Render origin, the matching `WORKER_API_TOKEN`
requirement, the cron/keep-alive and night skip, the backup bridge, and the
`HTTP 530` symptom of a stale `SERVER_ORIGIN`.

## 3. Per-link preview zoom memory

The in-page link preview (used by presentation mode hyperlinks) always reset to
80% when reopened. Zoom is now remembered per preview target:

- First open of a document still starts at the 80% default.
- Zoom in/out/pinch (and Reset) store the value under
  `localStorage['dash.preview.zoomByTarget']`, keyed by the embeddable URL
  (Drive `/preview`, Sheets `htmlview`, or the raw URL), so each record's link
  reopens at its own last zoom.
- The map is capped at 500 entries (oldest evicted) and every access is wrapped
  in `try/catch`, so private mode or a full quota falls back to the 80% default.
- Works with the presentation warm-frame cache: the stored zoom is re-applied
  whenever a cached iframe is adopted.

Changed `src/app/ai.js` and rebuilt `app.js` with `node build/build-app.js`; the
backend and `run-aadhar.ps1` are untouched by this part.

## 4. Incident: the test suite overwrote the live KV snapshot

After the cutover, every real user (including admin) got
`Invalid email, username or password.` while Render still reported a healthy
1.53 MB database.

**Root cause.** The agent shell had `DATA_SYNC_URL` and `WORKER_API_TOKEN` in
its ambient environment (taken from `.env.local` for the manual restore).
`node src/server/run-tests.cjs` inherited them, so test files that boot
`index.js` had the KV bridge enabled: they created/restored a scratch DB and
`backupData()` uploaded it to `backup:db.sqlite`, replacing production data with
the test seed (9 test users, 31 records). A 2026-11-02 Render restart then
restored that snapshot, so real accounts no longer existed. The tell-tale was
`backup-status.test.js` failing (`enabled` was `true` under the ambient env).

**Recovery.**

1. Built a `VACUUM INTO` snapshot from the local production DB
   (`src/server/data/dashboard.db`) - verified `integrity_check=ok`, 20 users,
   38 records, 63 submissions, 1,531,904 bytes.
2. PUT the gzipped snapshot (297,759 bytes) to
   `https://dashboardharyana.site/api/backup/db`.
3. Triggered Render deploy `dep-dbk3gtajnfac739g16d0`; boot restore came up at
   1,531,904 bytes.
4. Discovered the old instance's SIGTERM backup had overwritten KV with the test
   DB *after* the deploy started, so re-PUT the production snapshot once the old
   instance was gone and verified KV: 20 users / 38 records.
5. Verified the test account `vali_viewer@test.com` now gets
   `Invalid email, username or password.` (it logged in while the test DB was
   live), and that Render/Worker health show the restored DB.

No uploads or meetings were lost: both KV lists and the local directories were
already empty.

**Prevention.**

- `src/server/run-tests.cjs` deletes `DATA_SYNC_URL`/`WORKER_API_TOKEN` before
  spawning the seed and test runner, with a comment explaining the incident.
- `src/server/tests/test-bootstrap.js` does the same for direct `node --test`
  runs (opt out with `DASH_TEST_KEEP_BRIDGE=1`).
- `backup-status.test.js` explicitly blanks the bridge env so it no longer
  depends on the caller's shell.
- Re-ran the full suite with the production env still exported: 600/600 pass and
  the KV snapshot stayed at 1,531,904 bytes / 20 users.

## 5. Commits

| SHA | Subject |
|---|---|
| `4c5aa88` | `chore:` restore dash-site to Render and remove the quick-tunnel setup |
| `b90d06d` | `feat:` remember the preview zoom per link target |
| _pending_ | `fix:` stop test runs from overwriting the live KV backup |

Files changed:

```
dash-site/README.md                       Render hosting section replaces the tunnel guide
dash-site/run-backend.ps1                 deleted
dash-site/watch-tunnels.ps1               deleted
dash-site/run-aadhar.ps1                  drop references to the removed scripts
dash-site/src/app/ai.js                   per-target preview zoom memory
dash-site/app.js                          rebuilt from src/app modules
dash-site/src/server/run-tests.cjs        clear the live bridge env before tests
dash-site/src/server/tests/test-bootstrap.js  same guard for direct runs
dash-site/src/server/tests/backup-status.test.js  pin the bridge off
dash-site/SESSION_EXPORT_2026-11-02.md
```

## Pending tasks (carry forward)

1. **Rotate the leaked Render API key** - the key committed in
   `SESSION_EXPORT_2026-08-14.md` still authenticates against both services
   (`dash-site` and `aadhar-dashboard`). It was used for this recovery and must
   be revoked and scrubbed from history; create a replacement and store it only
   in the gitignored `.render.local` with a restricted ACL.
2. **OpenCode mobile tunnel** - the separate quick tunnel for the OpenCode
   service is not monitored and dies with the machine; see
   `SESSION_EXPORT_2026-10-30.md`. Replace with a named tunnel if it must stay
   reachable.
3. **CLI upgrade** - the `@opencode/cli` 2.2.2 upgrade was interrupted and the
   CLI was rolled back to 2.2.0. Re-run `npm install -g @opencode/cli` with
   OpenCode closed.
4. **Credential hygiene** - never commit `.env.local`, `.cloudflare.local`,
   `.render.local`, the bridge token or the Cloudflare/Render API tokens.
