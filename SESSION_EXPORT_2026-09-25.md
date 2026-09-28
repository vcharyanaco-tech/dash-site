# Session export — 2026-09-25 (deployed 2026-09-28)

## Deployment
- `aadhar-dashboard` is live on Render at `https://aadhar-dashboard-5i4x.onrender.com`
  (service `srv-dasvqh8473hc73e53a3g`, blueprint `exs-dasvkr60tbcc7399igbg`).
- Plan `free`, region `oregon`, native Python runtime, `PYTHON_VERSION=3.14.3`,
  `numInstances=1`, autoDeploy on commit, **no persistent disk** (Render only offers
  disks on paid plans, and the user accepted the data loss).
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` set as Render env vars, not committed.
- Cloudflare secret `AADHAR_ORIGIN` set on worker `dashv1-proxy`, not committed.
- Health check `/aadhar-dashboard/_stcore/health` returns `200 ok`; the app page
  serves at `/aadhar-dashboard/`.
- **Local data was not migrated.** `data/aadhaar.db` is not on the service, and on
  the free plan it would be discarded on the next deploy anyway. The service starts
  with an empty database bootstrapped from the admin credentials.

## Sync
- `git fetch origin` on 2026-09-28 found a new upstream commit `a60c8c9` ("Delete
  aadhar-dashboard directory") that removed the old React SPA build. Fast-forwarded
  with `git pull origin main --ff-only`; `main` is now synchronized with `origin/main`.
- Both repos had no git identity configured; set `vcharyanaco-tech
  <vcharyanaco@gmail.com>` as a repo-local identity in `dash-site` and
  `aadhar-dashboard` to match existing history.
- 20 untracked scraped/support files remain intentionally unstaged.
- Corrected the test-runner path in `AGENTS.md`: the real path is
  `src/server/run-tests.cjs`, not `src/server/tests/run-tests.cjs`.

## Work completed
- Hardened the Aadhaar Streamlit app authentication, database initialization, backup validation, admin restore flow, and deployment data directory.
- Added Streamlit base-path/CORS/upload configuration and Render persistent-disk Blueprint configuration.
- Added the `/aadhar-dashboard/` HTTP and WebSocket proxy route with canonical redirects, upstream failover responses, and security headers.
- Updated all landing-page Aadhaar links to `/aadhar-dashboard/`.
- Set the Worker compatibility date to the locally supported date and enabled `nodejs_compat`.
- Removed the legacy Aadhaar SPA/build files from the Aadhaar repository in favor of the Streamlit application.

## Files changed
- `E:\projects\aadhar-dashboard\app.py`
- `E:\projects\aadhar-dashboard\requirements.txt`
- `E:\projects\aadhar-dashboard\.streamlit\config.toml`
- `E:\projects\aadhar-dashboard\render.yaml`
- `E:\projects\aadhar-dashboard\.gitignore`
- `E:\projects\aadhar-dashboard\logo.png`
- `E:\projects\aadhar-dashboard\run_app.bat`
- Legacy Aadhaar repository files scheduled for deletion
- `E:\projects\dash-site\index.html`
- `E:\projects\dash-site\src\worker\worker.js`
- `E:\projects\dash-site\src\worker\wrangler.toml`

## Verification
- `node src/server/run-tests.cjs`: 514 passed, 0 failed (re-run 2026-09-28).
- `node --check src/worker/worker.js`: passed (re-run 2026-09-28).
- `python -m py_compile app.py`: passed (re-run 2026-09-28).
- Staged trees confirmed to contain no `data/`, `.venv/`, `__pycache__/`, `*.db` or `*.lnk`.
- `AADHAR_ORIGIN` verified absent from `wrangler.toml`; it stays a Wrangler secret.
- Aadhaar Python compile, Streamlit admin backup UI smoke test, and `git diff --check`: passed.
- Aadhaar isolated backup validation/restore test: passed.
- Direct Streamlit HTTP/WebSocket checks: passed.
- Local Wrangler proxy checks: redirects, health, CSP, WebSocket, and untrusted-origin rejection passed.
- `wrangler deploy --dry-run --no-bundle`: passed; bundled Worker output validated previously.

## Removals
- `aadhar-dashboard`: orphaned React source (`src/*.tsx`, 9 files) and the legacy
  Vite/Tailwind/Node build config, since the app is now Streamlit.
- `dash-site`: `aadhar.html`, superseded by the Streamlit origin. Its old URL is
  still handled by the 308 redirect in `worker.js`.

## Commits
- `a18ce19`, `a58b907`, `234d152` (aadhar-dashboard): Streamlit migration, README, and the
  switch to the free Render plan in `oregon` with no disk.
- `92debba` (dash-site) `feat: proxy /aadhar-dashboard/ to the Streamlit origin; drop legacy aadhar.html`
- Both repos pushed to `origin/main`.

## Pending Tasks
- Verify the canonical route end to end at `https://dashboardharyana.site/aadhar-dashboard/`
  after this push deploys the Worker, including a WebSocket connection.
- Sign in at the canonical URL with the admin credentials and confirm the app is
  usable with an empty database.
- Decide how real data reaches the service. Options: re-upload the source
  spreadsheets after each deploy, attach a disk on a paid plan, or move to
  Render Postgres.
- Rotate the Render API key. It was shared in a chat transcript, so treat it as
  exposed. The Render admin password was also shared in plaintext and is weak;
  consider replacing it.
- Never stage unrelated scraped/support files or commit `data/aadhaar.db`.
