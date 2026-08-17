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
