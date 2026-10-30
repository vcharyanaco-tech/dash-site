# Session export - 2026-10-30

## 1. OpenCode mobile access

Exposed the shared OpenCode service (`127.0.0.1:28894`, pid `16004`) through a
Cloudflare quick tunnel so the mobile app can connect from outside the LAN:

| Item | Value |
|---|---|
| tunnel URL | `https://endless-trademarks-literally-fabrics.trycloudflare.com` |
| cloudflared pid | `20228` (log `%TEMP%\opencode-tunnel.log`, url `%TEMP%\opencode-tunnel.url`) |
| pairing | `opencode pair --url <tunnel-url>` (one-time link, expires in 5 minutes) |

A first attempt fronted a standalone `opencode serve --hostname 0.0.0.0 --port
49374`. Pairing links minted by `opencode pair` belong to the shared service, so
they returned `401` against the standalone server; the tunnel was repointed at
the shared service and the link verified `200`. Port `4096` was already taken by
the Kilo Code extension server (`kilo.exe`).

The tunnel is **not** covered by `watch-tunnels.ps1`, so a network drop leaves it
dead until it is restarted by hand.

## 2. Dashboard regression: `HTTP 405` on `POST /api`

`POST https://dashboardharyana.site/api` returned `405 Method Not Allowed` with
a Cloudflare API envelope:

```json
{"success":false,"result":null,"errors":[{"code":10005,"message":"Method Not Allowed"}]}
```

`/api/health` still returned `200` because the Worker answers it locally, and
`GET /` still served the site.

### Root cause

When quick-tunnel registration failed, cloudflared logged:

```
failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": dial tcp: lookup api.trycloudflare.com: no such host
```

The URL regex in `run-backend.ps1` matched that error line, so the script stored
`https://api.trycloudflare.com` as the tunnel URL and pushed it to the Worker as
`SERVER_ORIGIN`. Proxied `/api` calls then hit the trycloudflare API endpoint,
which answers `405`. Earlier in the day the local resolver intermittently
returned NXDOMAIN for `api.trycloudflare.com`, which is what triggered the failed
registrations and the watchdog restart loop.

### Fix

`run-backend.ps1` and `run-aadhar.ps1` now exclude the API host when parsing the
tunnel URL (`https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com`). A registration
failure now reaches the existing "URL not found" throw instead of writing a bogus
origin.

### Verified

| Check | Result |
|---|---|
| `run-backend.ps1 -SkipAadhar` | new tunnel, `SERVER_ORIGIN` updated |
| tunnel `/api/health` | `200` |
| `POST https://dashboardharyana.site/api` (`getServerTime`) | `200` |
| dashboard tunnel | `https://boxed-bruce-ashley-text.trycloudflare.com` |
| watchdog | restarted, `main` mode, pid `11024` |

## 3. Commits

| SHA | Subject |
|---|---|
| `7ecb632` | `fix:` ignore trycloudflare API host when parsing the tunnel URL |

Files changed:

```
dash-site/run-backend.ps1   exclude api.* when parsing the quick-tunnel URL
dash-site/run-aadhar.ps1    same guard for the Aadhaar tunnel
```

## Pending tasks (carry forward)

1. **Quick-tunnel DNS flakiness** - `api.trycloudflare.com` intermittently fails
   to resolve on this machine (observed 03:58Z and 04:14Z). Each failure leaves
   the dashboard tunnel dead until the watchdog retries. A point-in-time test of
   six lookups resolved cleanly, so the resolver (ISP/router) is the suspect; a
   public resolver or a named tunnel would remove this failure mode.
2. **OpenCode tunnel uptime** - not monitored. Add it to `watch-tunnels.ps1` or
   replace the quick tunnel with a named one with a stable hostname.
3. **Dash-site cutover on 1 November 2026** - unchanged: let dash-site deploy,
   point `SERVER_ORIGIN` back at Render, then stop the local backend/tunnel and
   disable or keep the watchdog as a standby.
4. **Credential hygiene** - never commit `.env.local`, `.cloudflare.local`,
   `.render.local`, the bridge token or the Cloudflare/Render API tokens.
