# Session export — 2026-08-16 (migration CSVs: live data only, dashboard no longer reads them)

## Context / goal
Resumed from the 2026-08-15 export. Working in the **dash-site** repo
(`vcharyanaco-tech/dash-site`, Render/Railway + Cloudflare worker). The baked-in
`src/server/migration-export/*.csv` snapshot was stale and — worse — was still
auto-imported into the SQLite DB on first boot (`start.js`/`index.js`), so an
old snapshot could repopulate/overwrite-a-round a fresh boot. Goal:
1. make every CSV in `migration-export/` reflect the **current live dashboard
   data**, and
2. stop the dashboard from reading the CSVs at all.

## How the current live data was obtained
- Full live SQLite snapshot pulled straight from the Worker's KV backup bridge
  (the same bytes `data-sync.js` restores/backs up):
  - Worker KV namespace `DATA_BACKUP_KV` = `AI_INSIGHTS_KV`
    (`3aed6a4c7ad842c7b5fba1558a68ab06`, account
    `a01eb877733d755cb57e25827a9c52fe`)
  - GET `https://api.cloudflare.com/client/v4/accounts/{acct}/storage/kv/namespaces/{ns}/values/backup%3Adb.sqlite`
    with `Authorization: Bearer $env:CLOUDFLARE_API_TOKEN` → `live-backup.db`
  - Opened read-only with `better-sqlite3` (from `src/server/node_modules`) —
    no server, no auth, no living DB needed.
- Live counts at snapshot time: records 21, users 7, submissions 6,
  notifications 279, audit 169, tasks 0, documents 0. (KV `backup:stats`
  lastBackupAt `2026-08-16T01:00:18Z`.)

## 1. Dashboard no longer reads the CSVs (commit `ef05d64`)
- Removed the first-boot auto-import of `migration-export/*.csv` from both entry
  points:
  - `src/server/start.js` — deleted the "one-time data import" block (the
    container entrypoint; used by the root Dockerfile / Render / Railway).
  - `src/server/index.js` — deleted the `MIGRATION_DIR` import block (for direct
    `node index.js` runs).
- Replaced with a NOTE comment: live SQLite DB restored from the KV bridge by
  `data-sync.js` (when the file is absent) — or a brand-new empty DB — is the
  single source of truth. Manual one-time restores remain possible via
  `npm run import` (`DASH_IMPORT_DIR`) and `adminSyncFromSheet`.
- `seed.js` unaffected (demo records only on empty DB; never reads CSVs).

## 2. CSVs regenerated to live data
- Regenerated via a throwaway node script that reads `live-backup.db` and
  writes importer-compatible CSVs (RFC-4180, CRLF, quoted/escaped fields,
  timestamps as epoch ms, display ids for records `row-3`):
  - `submissions.csv` → 6 rows (commit `ef05d64`)
  - `records.csv` → 21, `users.csv` → 7, `notifications.csv` → 279,
    `audit.csv` → 169 (commit `960f4f9`)
  - `tasks.csv` / `documents.csv` → already accurate (0 rows), unchanged
  - `approvals.csv` → **left unchanged**: it is a snapshot of the GAS
    *approvals* sheet (`src/gas/Workflow.js`); the live SQLite DB has no
    approvals table, so there is no live data to source it from.
- **Validation:** round-tripped every CSV through the real
  `import-from-gas.js` into a scratch DB (`DASH_DATA_DIR` + `DASH_IMPORT_DIR`
  temp dirs). Row counts + field values match live exactly. Residual "diffs"
  are importer-side normalizations, not CSV errors: record fields are
  `.trim()`ed on import (drops trailing spaces/newlines that live rows
  legitimately contain), and empty lock/reset fields import as `0` vs live
  `null` (semantically "not set" on both sides).
- `npm test` in `src/server` → **31/31 pass**, and `require('./index')` loads.

## Where things stand
- Commits: `ef05d64` (fix: stop first-boot import of stale migration-export
  CSVs; refresh submissions.csv), `960f4f9` (feat: refresh
  records/users/notifications/audit CSVs). `main` clean, both pushed.
- Live `https://dashboardharyana.site/api/health` → ok; KV backup fresh
  (`2026-08-16T01:00Z`, writesToday 19/400 budget). Render/Railway auto-deploy
  the code change on next build.

## Suggested next steps
1. Optionally automate the CSV refresh: add a repo script
   (`scripts/refresh-migration-csv.cjs`) that pulls the KV snapshot via the
   CF API + `CLOUDFLARE_API_TOKEN` and regenerates the CSVs, so the task is
   repeatable instead of one-off.
2. Decide whether `approvals.csv` should be re-exported from the GAS approvals
   sheet manually (no SQLite mirror exists).
3. Consider whether to delete `migration-export/` entirely now that nothing
   reads it (files are inert; the folder is just an archive).