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

### Temporary local fallback (Render suspended)

Until the Render services resume, run both dashboards from this machine:

```powershell
.\run-backend.ps1
```

It starts the Node backend on port 8787 behind a Cloudflare quick tunnel and
updates the Worker's `SERVER_ORIGIN`. It then starts the sibling
`aadhar-dashboard` Streamlit app on port 8501 behind a second quick tunnel and
updates `AADHAR_ORIGIN`. Use `.\run-backend.ps1 -SkipAadhar` to start only the
main dashboard, or `.\run-backend.ps1 -Stop` to stop both.

If `E:\projects\aadhar-dashboard\.env.local` exists, `run-aadhar.ps1` loads its
`AADHAR_SYNC_URL` / `AADHAR_SYNC_TOKEN` into the Streamlit process so the local
app can restore and upload snapshots through its backup Worker. That file is
gitignored and must never be committed.

Both tunnels run on this PC. They stop when the machine shuts down, and
Startup-folder launches only bring them back after login; a quick-tunnel
hostname also changes on restart, but the scripts update the Worker secrets.
A watchdog starts with the backend and checks both public routes every minute.
If Cloudflare drops a quick tunnel, it recreates that tunnel and updates the
matching Worker secret; see `%TEMP%\tunnel-watchdog.log`. Use
`.\run-backend.ps1 -NoWatchdog` to skip it. Quick tunnels still have no uptime
guarantee; a named Cloudflare tunnel is the durable fix, but the current API
token cannot edit DNS. The permanent fix is the Render deployment resuming with
the committed code.
