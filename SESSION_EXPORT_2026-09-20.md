# Session Export — 2026-09-20

Continuation of the 2026-09-19 session. The user supplied two zips and asked for
them to be brought onto the repo **line to line** on top of the local work, then
committed and pushed:

1. **Part 15 stable record identity** (`record_id` work) — already shipped and
   pushed as `43d87f1` from the local session.
2. `dash-site-presentation-mode-updated.zip` — verified to be an OLDER snapshot;
   ITS content is already in HEAD, no separate merge needed.
3. `C:\Users\vikph\Downloads\dash-site-targets-8-to-12-final.zip` — the targets
   8-12 release, based on `a1b6451` (pre-Part-15).

This session merged the targets 8-12 zip onto `main` (which already carried the
Part 15 work), fixed the two regressions the merge surfaced, and pushed.

Repo state at start: `origin/main` == `43d87f1`, working tree otherwise clean
modulo the two documented strays (`VS tools.code-workspace`,
`dash-site-presentation-mode-big-pickle.md`), left uncommitted as established.

---

## Targets 8-12 zip — MERGED ONTO main

The targets 8-12 zip is version-controlled: extracted to
`C:\Users\vikph\AppData\Local\Temp\zipdash-8-12`, materialized as commit
`a24a454` on branch `import-8-12` (based on `a1b6451`), then merged into `main`
with `--no-commit` for inspection. Auto-merge was clean — **zero conflicts** —
because the zip branch started before Part 15 and only Part 15 touched the
overlapping areas (`db.js` migrations, `documents.js`).

**What arrived with the zip (32 changed + 5 new files, +2230/-345):**

- **New client module `src/app/workspace.js`** — Dash Workspace 2.0: global
  search, attention/notification center, exec snapshot, Dash AI
  (`askDashboardAi`), mobile toggle. Registered in `src/app/entry.js` (module
  list grew 21 → 22 modules).
- **New server modules** `analytics.js`, `automation.js`, `security.js` plus a
  `tests/ops12.test.js`.
- **Client rework:** `presentation.js` (+310), `myday.js` (+146),
  `studio.js` (+91), `ai.js` (+88), `manifest.json` (+113), `core.js`,
  `dashboard.js`, `init.js`, `realtime.js`, `session.js`, `styles.css` (+344),
  `sw.js`, `app.html`.
- **Server wiring:** `index.js` (AUTH_ARG_INDEX gains `getAnalytics: 1`,
  `listAutomationRules: 0`, `saveAutomationRule: 1`, `deleteAutomationRule: 1`,
  `runAutomationNow: 0`, `getSecurityStatus: 0`, `rotateSession: 0`),
  `index-dispatch.js` (dispatch entries + validators for the new ops),
  `db.js` merged BOTH migrations (Part 15 `record_id` AND the zip's
  `snoozed_until`/`dismissed_at`/`group_key` notification columns +
  operational indexes), plus `enterprise.js`, `notifications.js`,
  `records.js`, `submissions.js`, `tasks.js` hook lines.
- `app.js` rebuilt post-merge via `node build\build-app.js` (22 modules,
  10748 lines); rebuild is deterministic (round-trip SHA-256 stable) and the
  Part 15 `recordId` threading survives (verified in bundle: upload with
  `recordId` param at line ~498, recordId row display at ~4466).

## Regressions surfaced by the merge — FIXED (all 3 are zip bugs)

The zip was authored against the pre-Part-15 tree and its own AUTH_ARG_INDEX;
three defects survived to `main` and the suite caught all of them:

1. **`askDashboardAi` missing from `AUTH_ARG_INDEX` (index.js line 49).**
   The client's `ApiService.askDashboardAi(question, context)` (core.js:169
   → `apiCall_('askDashboardAi', ...)`) sends 2 args, but the dispatch maps
   `enterprise.askDashboardAi(A(args,0), A(args,1), A(args,2))` — token is arg
   0 (`askDashboardAi(token, question, context)`, enterprise.js:517). Without an
   AUTH_ARG_INDEX slot the server-side cookie injection never inserted the
   token, so every Dash AI question died with "Login required. Please log in
   again." Caught by `dispatch-client-args.test.js` (whole-suite replay of every
   `app.js` ApiService call against the dispatch). Fixed by adding
   `askDashboardAi: 0` next to `askLinkAi: 0`.
2. **`analytics.js:45` referenced an undefined variable.** The KPI object used
   `createdTasksInRange` but the code computes `createdInRange` (line 34), so
   `analytics.getAnalytics` threw `ReferenceError`. Fixed to `createdInRange`.
3. **`ops12.test.js` seeded no admin.** It booted a brand-new temp
   `DASH_DATA_DIR` and then did `SELECT email FROM users LIMIT 1` → `assert.ok`
   failed. Its sibling tests (`reconcile.test.js` etc.) seed an admin first.
   Fixed the test to `seedAdmin()` (INSERT OR IGNORE `a@x.com` ADMIN + session)
   in both tests, and switched the tmp dir to `fs.mkdtempSync(os.tmpdir())`
   instead of a hardcoded `/tmp` path (cross-platform).

Full suite after fixes: **398 tests / 398 pass / 0 fail** (~35 s).

## Commits

- `33113bf` feat: merge targets 8-12 — Workspace 2.0, analytics/automation/
  security modules (merge of zip `a24a454` onto Part 15 `43d87f1`, includes the
  three zip-bug fixes above). Pushed to `origin/main`
  (`43d87f1..33113bf`).

## Stray files tracked

- `VS tools.code-workspace` and `dash-site-presentation-mode-big-pickle.md`
  were added at the user's request as `b6ab97a` (no secrets; the markdown is
  the presentation-mode feature spec, the workspace file points at the repo).

## Render deploy failure — ROOT-CAUSED & FIXED

User reported the last 5 Render deploys failed. Render API
(`GET /v1/services/srv-d9uqprijobas73bh8ie0/deploys`) confirmed status
`update_failed` for `b6ab97a`, `6041e64`, `33113bf`, `43d87f1` (auto), and
`43d87f1` (manual); the last `live` deploy was `a1b6451`. (The Render dashboard
list rendered these as "Deployed"; the API status is authoritative.)

**Root cause:** `schema.sql` created `CREATE UNIQUE INDEX idx_records_record_id
ON records(record_id)` while `db.js` only adds `records.record_id` *after*
`db.exec(schema)`. On Render the ephemeral disk restores an **older** DB from
the KV bridge (data-sync) whose `records` table predates Part 15 — and
`CREATE TABLE IF NOT EXISTS` never alters an existing table — so boot threw
`no such column: record_id`, the health check never passed, and the deploy was
marked `update_failed` and rolled back. Local tests and
`check-db-migrations.cjs` only ever booted a **fresh** DB, so they missed it.

**Fix (`37500c8`):**
- `src/server/schema.sql` — dropped the premature `idx_records_record_id`
  creation (db.js owns it, after the migration).
- `src/server/db.js` — the child-table re-anchor now `ALTER TABLE ... ADD COLUMN
  record_id` for `tasks`/`documents`/`record_changes` when an old DB lacks it,
  before the `UPDATE ... record_id` runs.
- `scripts/check-db-migrations.cjs` — new **legacy upgrade** phase: strips every
  migrated column (`record_id`, `source`, `displayed`, `read_at`, `keep`,
  notification lifecycle cols) and reboots, reproducing the failure; also adds
  the Part 15 columns/indexes to its expectations.

**Verification:** legacy-DB boot sim now passes (records stamped, children
re-anchored to the parent UUID); `check-db-migrations.cjs` 3/3 phases OK;
server suite 398/398. Re-deploy `dep-danmqcm8bjmc73amk6kg` → status `live`;
`https://dash-site-2wkg.onrender.com/api/health` → HTTP 200 with
`dataSync.enabled:true` and the migrated DB (815104 bytes).

## Cleanup

- Temporary worktree `C:\Users\vikph\AppData\Local\Temp\opencode\zip-wt`
  removed (`git worktree remove --force`), branch `import-8-12` deleted
  (`was a24a454`).

## Pending Tasks

- **Nothing runtime pending.** Both user-supplied zips plus the local Part 15
  work are on the repo line to line, the full server suite is green, and Render
  (`37500c8`) is live again.
- Note: `push deploy` for docs-only commits is normal; the failure was purely
  the legacy-DB migration crash fixed above.