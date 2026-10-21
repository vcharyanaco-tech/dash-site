# dash-site

India Post Dashboard — Circle Office, Haryana. This repository is the
**website-deployable** form of the project: the app itself lives at the repo
root (deployed straight to GitHub Pages), and the supporting backend + source
material is organised under `src/`.

## Deployable website (repo root)

| Path | What it is |
| --- | --- |
| `index.html` | Public landing page |
| `app.html` | The dashboard app (SPA) |
| `/aadhar-dashboard/` | Aadhaar MIS Reporting dashboard — Haryana Circle. Streamlit app (source in the separate `aadhar-dashboard` repo) proxied by the Cloudflare Worker from an origin on Render. `/aadhar.html` and `/aadhar-dashboard/index.html` 308-redirect here. |
| `app.js` | App bundle (talks to the GAS/Worker API) |
| `offline-queue.js` | Offline request queue for the app |
| `sw.js` / `manifest.json` | PWA service worker + manifest |
| `assets/styles.css` | App styles |
| `assets/site.css` | Landing-page styles |
| `about.html`, `privacy.html`, `support.html`, `terms.html`, `data-deletion.html` | Public info pages |
| `CNAME` | Custom domain (`dashboardharyana.site`) |

GitHub Actions (`.github/workflows/pages.yml`) deploys the repo root to GitHub
Pages on every push to `main`.

## Supporting source (`src/`)

| Path | What it is |
| --- | --- |
| `src/server/` | Node + SQLite backend (CRUD, auth, reports, notifications, AI, meetings) |
| `src/worker/` | Cloudflare Worker proxy (routes `/api/*`, static `/app.html`) |
| `src/tests/` | Node unit tests (`node --test src/tests`) |
| `src/scripts/` | Deploy / build PowerShell scripts |
| `src/docs/` | Architecture, deployment, developer + admin guides |

The live deployment runs the self-contained Node backend (`src/server/`) and
Cloudflare Worker (`src/worker/`). The original Apps Script project lives in
the separate `dashv1` repo; the stale in-repo `src/gas/` mirror was removed.

> **Migration base:** `src/server/` is a complete SQLite-backed Node port of the
> GAS backend (see `MIGRATION.md`). It already serves the app via
> `POST /api` (the same `function(args)` surface as GAS), so the spreadsheet can
> be retired as the data source without changing frontend functionality.

## Quick start

```bash
# Serve the website locally
python -m http.server 8080

# Run the unit tests
node --test src/tests
```

### Temporary local fallback (dash-site only)

Dash-site's Render backend is still suspended until 1 November 2026, so the
main dashboard runs from this machine. The Aadhaar dashboard is no longer part
of this fallback: it now runs on a **separate Render account** at
`https://aadhar-dashboard-9ljo.onrender.com`, still exposed through
`https://dashboardharyana.site/aadhar-dashboard/`.

```powershell
.\run-backend.ps1
```

This starts the Node backend on port 8787 behind a Cloudflare quick tunnel,
updates the Worker's `SERVER_ORIGIN`, and leaves `AADHAR_ORIGIN` pointed at the
dedicated Render service. It also starts a main-only tunnel watchdog.

- `.\run-backend.ps1 -WithAadhar` is the emergency local Aadhaar fallback. It
  starts the sibling Streamlit app on port 8501 behind a second quick tunnel,
  repoints `AADHAR_ORIGIN` at that tunnel, and monitors both routes.
- `.\run-aadhar.ps1 -Stop` (or `.\run-backend.ps1 -Stop`) stops the local app
  and tunnel and restores `AADHAR_ORIGIN` to the Render URL.
- `.\run-backend.ps1 -SkipAadhar` is kept as an alias for the default
  main-only mode. `-NoWatchdog` skips the watchdog.

If `E:\projects\aadhar-dashboard\.env.local` exists, `run-aadhar.ps1` loads its
`AADHAR_SYNC_URL` / `AADHAR_SYNC_TOKEN` into the Streamlit process so the local
fallback can restore and upload snapshots through its backup Worker. That file
is gitignored and must never be committed.

The main quick tunnel runs on this PC. It stops when the machine shuts down, and
Startup-folder launches only bring it back after login; the hostname changes on
restart, but the script updates the Worker secret. The watchdog checks the main
public route every minute and recreates a dropped tunnel; see
`%TEMP%\tunnel-watchdog.log`. Quick tunnels still have no uptime guarantee; a
named Cloudflare tunnel is the durable fix for dash-site, but the current API
token cannot edit DNS. The permanent fix is the dash-site Render deployment
resuming with the committed code.
