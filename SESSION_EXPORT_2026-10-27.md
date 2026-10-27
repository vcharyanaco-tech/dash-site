# Session export - 2026-10-27

## 1. Incident

The live dashboard (`https://dashboardharyana.site/app.html`) showed:

```
Error loading app: HTTP 530
```

The Aadhaar dashboard (`/aadhar-dashboard/`) and the marketing homepage were
still healthy. The failing request was the main dashboard's `POST /api`, which
the Cloudflare Worker proxies to the local Node backend through a quick tunnel.

## 2. Root cause

The backend and tunnel were both alive. The Worker's `SERVER_ORIGIN` secret was
still pointing at the previous quick-tunnel hostname, so Cloudflare returned
`HTTP 530` for the proxied API call.

`run-backend.ps1` started at 09:29 IST and attempted to update the secret with:

```powershell
wrangler secret put SERVER_ORIGIN
```

Wrangler failed with `A fetch request failed, likely due to a connectivity
issue`. Because the script runs with `$ErrorActionPreference = 'Stop'`, the
native-command stderr aborted it at step 5. It never reached the watchdog start
or the end-to-end check, leaving the stale secret in place.

This was masked by `/api/health`: the Worker answers that route itself, so it
returned `200` while the proxied `POST /api` returned `530`. The quick tunnel's
own `/api/health` was also `200`, proving the tunnel itself was fine.

## 3. Immediate fix

Updated `SERVER_ORIGIN` through the Cloudflare API to the current quick-tunnel
URL, then verified:

| Check | Result |
|---|---|
| `POST https://dashboardharyana.site/api` (`getServerTime`) | `200`, JSON result |
| `POST /api` (`getAppData`, unauthenticated) | `200`, expected token error |
| `app.html` in Playwright | login screen visible, no error panel |
| Browser API responses | four `200`s |
| Page errors | none |

The dashboard was usable again without restarting the backend, tunnel or
database.

## 4. Hardening (`run-backend.ps1`)

- Replaced the wrangler secret upload with a direct Cloudflare API `PUT` to the
  Worker secrets endpoint, using `CLOUDFLARE_API_TOKEN` and the account/Worker
  names from the environment and `src/worker/wrangler.toml`. The token is never
  printed or committed.
- Added three retries with backoff for the secret update.
- Added a public-route check that calls `POST /api` with `getServerTime`; this
  proves the Worker reaches the Node backend, unlike `/api/health`.
- If the first public check fails, the script retries the secret update and
  probes again.
- A failed update now warns clearly but no longer aborts before the watchdog
  starts.
- Updated `README.md` with the `HTTP 530` symptom and the difference between
  Worker-local `/api/health` and proxied `POST /api`.

A fresh run reused the healthy backend and tunnel, updated the secret, verified
the public route, and started the main-only watchdog (pid `12756`).

## 5. Verification

- `run-backend.ps1` PowerShell parser: clean.
- `node scripts/secret-scan.cjs`: passed, 234 tracked files checked.
- `git diff --check`: clean.
- Re-ran the live browser check: title `India Post Dashboard`, login visible,
  no `messagePanel` error, no page errors, four API responses all `200`.
- Watchdog process `12756` is alive in `main` mode; log:
  `%TEMP%\tunnel-watchdog.log`.

## 6. Commits

| SHA | Subject |
|---|---|
| `04a0808` | `fix:` verify the Worker reaches the quick tunnel |

Files changed:

```
dash-site/run-backend.ps1   Cloudflare API secret update, retries and public
                            POST /api verification; no wrangler abort
dash-site/README.md         document HTTP 530 and the proxy health distinction
```

## Pending tasks (carry forward)

1. **Watch the main tunnel** - keep this machine and the watchdog running. If
   `SERVER_ORIGIN` goes stale again, run `.\run-backend.ps1`; it now updates and
   verifies the public route. The durable fix is a named Cloudflare tunnel with
   a stable hostname, still blocked by the current token's DNS permission.
2. **Dash-site cutover on 1 November 2026** - when the old workspace's Hobby
   bandwidth resets, let dash-site auto-deploy, set `SERVER_ORIGIN` back to the
   Render URL, then stop the local backend/tunnel and disable the watchdog (or
   keep it as a standby). Do not move dash-site before then.
3. **Aadhaar checkpoint** - the Aadhaar service is independent and still on its
   dedicated Render workspace. Keep watching the daily backup checkpoint.
4. **Credential hygiene** - never commit `.env.local`, `.cloudflare.local`,
   `.render.local`, the bridge token or the Cloudflare/Render API tokens. The
   old Render API key in `SESSION_EXPORT_2026-08-14.md` still needs revocation.
