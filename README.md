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

### Backend hosting

Dash-site runs on Render at `https://dash-site-2wkg.onrender.com` (service
`srv-d9uqprijobas73bh8ie0`, `autoDeploy: true`). The Cloudflare Worker
(`dashv1-proxy`) proxies `POST /api` and `/macros/*` to it through
`SERVER_ORIGIN`, which must be that Render URL.

The Worker's `*/10 * * * *` cron pings `SERVER_ORIGIN/api/health` so the free
instance never idles out, skipping 21:00-06:00 IST to bank instance-hours
overnight. The `DATA_BACKUP_KV` bridge restores `dashboard.db` on boot and
uploads a snapshot every 10 minutes and on SIGTERM, so redeploys and free-tier
restarts keep the data.

- The Render service must have `WORKER_API_TOKEN` set to the same value as the
  Worker secret (it is in the gitignored `.env.local`). Without it the boot
  restore fails with `401` and the instance comes up with an empty database.
- `/api/health` is answered by the Worker itself, so it cannot prove the origin
  is reachable. Probe `POST /api` (e.g. `getServerTime`) instead. A stale
  `SERVER_ORIGIN` shows as `Error loading app: HTTP 530` in `app.html`.

The Aadhaar dashboard is separate: it runs on its own Render account at
`https://aadhar-dashboard-9ljo.onrender.com`, exposed through
`https://dashboardharyana.site/aadhar-dashboard/` via `AADHAR_ORIGIN`.
`run-aadhar.ps1` remains as a manual local fallback for it (see the script and
`E:\projects\aadhar-dashboard\.env.local`, which is gitignored).

The dash-site quick-tunnel scripts (`run-backend.ps1`, `watch-tunnels.ps1`) and
their Startup-folder launcher were removed on 2026-11-02 when the Render service
resumed. They remain in git history (`git show 7ecb632:run-backend.ps1`) if a
temporary local origin is ever needed again.
