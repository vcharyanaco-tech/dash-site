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

## Link preview — only first click previewed, rest opened a new tab (FIXED)

**Symptom:** in Presentation Mode the first hyperlink previewed in the modal;
every later click opened a real browser tab.

**Root cause:** the modal has a single `#previewFrame`. Presentation Mode's
`closeLinkPreview()` parks the live frame in a hidden `.pres-warm-frame` holder
and clears its id (`src/app/ai.js`), and `exitPresentationMode()` then deletes
all warm holders (`src/app/presentation.js:126-128`) — so `#previewStage` is
legitimately frame-less afterwards. The next `openLinkPreview()` did
`if (!frame) { window.open(url, '_blank'); return; }`, so it escaped to a new
tab instead of reopening the modal.

**Fix (`src/app/ai.js`):** added `ensurePreviewFrame_(stage)`; `openLinkPreview`
now only falls back to a new tab when `#previewStage` itself is missing,
otherwise it rebuilds a default `#previewFrame` and still adopts warm/cached
frames first (warm buffering unchanged). Rebuilt `app.js`
(`node build/build-app.js`, round-trip verified, bundle size OK) and added a
regression contract test in `src/server/tests/frontend-contract.test.js`.

**Verification:** `node --check app.js` + `src/app/ai.js` OK; secret-scan OK;
bundle-size OK; app.js round-trip OK; server suite 399/399.

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

## v1.2.0 -- "updated instructions section" + divisional dashboards + submission attachments

Shipped as commit `24d212f` (base `1b16e1a`), applied from the user's
`dash-site-main-updated-v1.2.0.zip` (that zip WAS the previously-ambiguous
"updated instructions section"; it also carries the two other features below).

Features:

1. **Last meeting instructions** (`records.last_meeting_instructions`, `TEXT NOT NULL
   DEFAULT ''`) -- per-record guidance shown in the record detail view; editable
   by admins/editors.
2. **Divisional dashboards** (`users.divisional_dashboard_url`, `TEXT NOT NULL
   DEFAULT ''`) -- per-user dashboard link for `do_`/`rms_` users; prompt modal
   on sign-in + edit capability in Settings.
3. **Submission attachments** (`submission_attachments` table) -- up to 1 MB
   base64 attachment per submission, stored under `data/uploads` keyed by uuid,
   served via `GET /api/files/:key` (meta `isSubmissionAttachment`); add/edit/delete
   wired through client + server (`addSubmission`, `updateSubmission` gained the
   new `attachment` arg).
4. **Viewer gating of `toggleCardUpdates`** (viewers blocked unless presentation
   allowViewer); `askDashboardAi` now requireLogin instead of requireEditor.
5. **Tooling**: APP_VERSION 1.2.0, new `src/scripts/bump-version.ps1`,
   `deploy-all.ps1` updates.

Integration fixes (beyond the zip):

- **Deploy-blocking regression**: zip's `schema.sql` created
  `idx_users_dashboard_url` on a column that only arrives via the db.js
  migration (which runs after schema.sql) -- the same crash class that broke
  the last several deploys on restored legacy DBs. Removed the index from
  `schema.sql`; db.js creates it right after its `ALTER TABLE ... ADD COLUMN
  divisional_dashboard_url` (IF NOT EXISTS keeps fresh DBs correct). Prior
  `idx_records_record_id` fix intact.
- **AUTH_ARG_INDEX gaps**: the three new endpoints shipped validators but no
  token-index entries. Added `getMyDivisionalDashboard: 0`,
  `setMyDivisionalDashboard: 1`, `getDivisionalDashboardLinks: 0` -- without
  them the cookie-injection middleware leaves the token slot empty and the
  dispatch-client-args replay test fails.
- **Stale app.js in the zip**: rebuilt the canonical bundle from modules
  (zip's app.js predates the attachment/divisional client code). Rebuild
  round-trip verified byte-identical.
- **Tests**: updated `smoke.test.js` (addSubmission payloads gain the `null`
  attachment slot) and `validators.test.js` (updateSubmission 4-arg shape).
  `check-db-migrations.cjs` now asserts 16 tables / 15 migrated columns /
  4 indexes (incl. `submission_attachments`, the two new columns,
  `idx_users_dashboard_url`); legacy-strip phase drops `idx_users_dashboard_url`
  before `DROP COLUMN divisional_dashboard_url` (SQLite forbids dropping an
  indexed column).

Verification: `node --check` on 20 files, secret-scan, bundle-size, app.js
round-trip all OK; migration check 3/3 phases OK (fresh, idempotent, legacy
upgrade); full server suite 399/399. Deployed: Render auto-deploy
`24d212f` live, `/api/health` HTTP 200 with sqlite ok, errorCount 0, DB
migrated (815 KB -> 831 KB). GitHub Pages/Worker auto-deploys the client
bundle.

**"Updated instructions section" (the prompt the user chased earlier) is this
feature: the per-record `last_meeting_instructions` editor in the record detail
view. On main and live.**

## v1.2.0 follow-up -- instructions editor + presentation changes (were NOT shipped)

The zip's prebuilt `app.js` was internally inconsistent with its `src/app/*`
modules: the bundle had the Last Meeting Instructions UI + presentation
changes, while the modules (which the canonical rebuild regenerates from) had
the divisional/attachment client code. Rebuilding from the modules silently
DROPPED the instructions feature + presentation change while the zip's app.js
"looked stale" because it lacked the divisional/attachment APIs. Result: the
"updated instructions section" was committed but never rendered client-side,
and presentation slides were unchanged.

Root-cause lesson: the zip was cut from two different trees; neither the
bundle nor the modules was a superset. Compare BOTH directions before deciding
a bundle is stale.

Fixed at `f9e8c3f` by porting the missing behavior back into the modules:
- `dashboardColumnKey_`: maps "Last Meeting Instructions" label; card fields
  now carry `card-field-last-meeting-instructions` between Action and the
  bottom row.
- New `openLastMeetingInstructions` / `closeLastMeetingInstructions` /
  `saveLastMeetingInstructions` (uses `#lastMeetingInstructionsModal` +
  `ApiService.updateItem` carrying the field; app.html markup came from zip).
- Editors get a pencil quick-action on cards (`svgIcon('edit')` added -- the
  zip bundle reused the edit icon that didn't exist, falling back to `info`).
- Edit modal wired: `#editLastMeetingInstructions` reset/populate/save.
- Presentation mode is now meeting-focused -- slides show only Action and
  Last Meeting Instructions (`presentationSlideHtml_` builds from
  `groups.action.concat(groups.instructions || [])`).
- Print report adds the Last Meeting Instructions column (block layout per
  record when submissions are included) + `.record-print-block` page-break
  rule. Table view intentionally unchanged (zip did not add the column).
- app.js rebuilt; round-trip byte-identical; suite 399/399, secret-scan + 
  bundle-size OK.
## Deep re-analysis of all four zips + two UX fixes (7e63485, pushed bd5dd4..7e63485)

User asked to re-analyze ALL previous zips (dash-site-main 08:43, -presentation-mode-updated 08:50, -targets-8-12-final 10:15, -main-updated-v1.2.0 11:48) to confirm nothing else was left unimplemented (the instructions incident showed the repo silently dropped bundle-only output). Method used, per zip, in `C:\Users\vikph\AppData\Local\Temp\opencode\zips\norm`:

- **Name-level inventory** of every built `app.js`: function names, const-functions, ApiService `apiCall_` names, `getEl` ids. Result: **no function/API/id in any zip is missing from the repo bundle** � the repo is a strict superset at name level (541 fns vs 481�533; 112 API vs 96�109; 239 ids vs 211�232).
- **Full hunk-by-hunk body review** of the two closest ancestors: z3-targets812?repo (38 hunks) and z4-v120?repo (19 hunks). Every zip-side behavior was already a subset; the only genuine repo-lacks-zip gap was the `printCard` bordered wrapper.
- **Pairwise chain** z1?z2 (z2 rewrote the presentation link-warming engine: previewCache LRU cap 6, MAX_RETRIES 2 / RETRY_BASE_MS 900 / TIMEOUT_MS 8000 state machine, generation tokens, closeLinkPreview park-in-holder), z2?z3, z3?z4. Verified the repo's `ai.js`/`presentation.js` carry the full v120 engine (file-level: repo == v120 for every client file except the six intentionally ported).
- **File-level tree diff**: no file from any zip is missing from the repo (workspace.js, analytics.js, automation.js, security.js, bump-version.ps1, etc. all present). v120 vs repo differ set = exactly the intentional port files (core/dashboard/edit/presentation/reports/session, index.js, schema.sql, tests, check-db-migrations, SESSION_EXPORT).
- Conclusion: v1.2.0 features (instructions editor, divisional prompt + dismiss, submission attachments, presentation meeting-focused) were fully shipped; nothing further was unimplemented.

Two user-reported fixes shipped in the same commit:

1. **Fullscreen presentation: link preview popup invisible (rendered behind the fullscreen overlay).** Root cause: the browser top layer hides *everything outside the fullscreen element* (`#presentationOverlay`); `#previewModal` is body-level, so it can't be seen regardless of z-index (modal 1500 vs overlay 1499 already put the modal above in the normal case � the non-fullscreen case always worked). Fix: parked open modals into the fullscreen element while active and restored them on exit.
   - `core.js`: `parkModalForFullscreen_(modal)` / `restoreModalFromFullscreen_(modal)` (stash home node in `__modalHome`); `openDialog` parks automatically; a document `fullscreenchange` listener parks all open backdrops on fullscreen enter and restores on exit. This generalises to the confirm dialog used by Mark-as-Completed while fullscreen, and any future fullscreen modal.
   - `presentation.js`: `exitPresentationMode` restores parked modals to the document before the overlay is hidden.
2. **"Edit last meeting instructions" must sit in the field's top-right corner**, not as a bottom-row quick action. Moved the pencil into `cardFieldHtml_`: instruction fields rendered for editors get the button (`class="icon-btn card-field-edit-btn"`), the field gets `card-field-with-edit` (`position: relative; padding-right: 42px`) and the button is absolutely placed top-right (26px, 14px svg). Removed the `card-quick-action` footer button and replaced its CSS block. Applies to dashboard cards, record-detail fields and presentation slides (still editor-gated; the save path already re-checks `isEditor`).
3. **Restored the v120 `printCard` fidelity gap** found during analysis: single-record print wraps the fields table in a bordered `.record-print-block` (border/radius/padding + `.record-print-block .fields-table { margin: 0 }`), matching the bundle the user shipped.

Verification: modules syntax-checked; `node build/build-app.js` rebuilt app.js (22 modules); `node build/split-app.js` round-trip byte-exact; `npm test` green (399 tests, exit 0); `scripts/secret-scan.cjs` passed (193 files); `scripts/check-bundle-size.cjs` OK (app.js 481.1 KB raw / 112.4 KB gzip). Committed as `7e63485` "fix: fullscreen preview modal + in-field instructions edit button + print block restore" (6 files, +117/-17) and pushed to origin/main.

## Last Meeting Instructions field upgrade + hide Submit update + print-link toggle (single feature commit)

User requested (clarified through Q&A): (1) shift every admin-authored, currently-on-card (displayed=1) submission into that record's `last_meeting_instructions` field and **delete** the original submission rows + attachments; (2) give the Last Meeting Instructions field the **full Submit-update feature set** (dated entries with timestamp + office, optional attachments, modal list, edit/delete) — manageable by admins/editors only; (3) **hide the Submit update button for editors and admins everywhere** (viewers only); (4) print view option: print a record **with the hyperlink data table or without it**.

Server:
- `schema.sql`: new `instruction_entries` (+ `card_row` index) and `instruction_attachments` tables mirroring submissions/submission_attachments.
- `db.js`: guarded one-time boot migration `MIGRATION_ADMIN_UPDATES_SHIFTED` (settings flag, exactly-once on the KV-restored prod DB). For each record: existing column text is preserved as the oldest entry, every ADMIN-role displayed submission is converted into an instruction entry (created_at preserved), then the submission + its attachment files/rows are deleted; the column is recomputed as the joined entry text newest-first. Viewer submissions untouched.
- New `instruction-entries.js`: `get/add/update/deleteInstructionEntry` (all requireEditor). Each mutation writes `records.last_meeting_instructions` = entries joined newest-first (empty set clears the column — entries are now the source of truth), logs audit, requests a KV backup. Attachment files land in `uploads/` like submissions.
- Wiring: `index-dispatch.js` (4 dispatch entries), `index.js` (`AUTH_ARG_INDEX` 1/4/3/1, `VALIDATORS`, `dataFns` SSE broadcast), `documents.js` `resolveDocumentFile` now resolves `instruction_attachments` too (downloaded via `/api/files/<key>?download=1`), `records.js` cascade-delete + row renumber `refs`, `reconcile.js` `CHILDREN`.

Client:
- `dashboard.js`: rewrite of the instructions section — `openLastMeetingInstructions` now opens a full modal (list + compose), with `renderLastMeetingEntries`, add/update/delete entry, `insertLastMeetingLink` (link insert), `handleLastMeetingAttachmentChange` (1 MB cap), resolving office display; mutations `refreshData()` (deferred while the modal is open, flush on close).
- `app.html`: `#lastMeetingInstructionsModal` rebuilt as a submissions-style modal (`#lastMeetingEntriesList`, `#lastMeetingInstructionsText`, `#lastMeetingAttachment` + name, submit/cancel buttons, count); removed the old textarea-only `#editLastMeetingInstructions` from the edit modal.
- `edit.js`: dropped `lastMeetingInstructions` from the edit modal reset/populate/save (field now maintained purely by entries).
- Submit update gated to viewers only: `dashboard.js` card button (~459) and table-row Update (~645) render only when `!appState.isEditor`; `detail.js` gives viewers a Submit update action (editors/admin no longer get it).
- `reports.js`: new `printLinksHtml_` (Field / Link text / URL table from `item.links`, legacy `linkUrls`/`linkTexts` fallback) included in `printCard` and per-record `printReport` blocks; `buildPrintPage` gains an "Include hyperlink data" toolbar checkbox (default on) toggling a `body.no-links` class.
- `core.js` ApiService: `getInstructionEntries`, `addInstructionEntry`, `updateInstructionEntry`, `deleteInstructionEntry`.

Tests: new `tests/instruction-entries.test.js` (authz viewer rejected, add/aggregate newest-first/clear, update, attachment round-trip via `resolveDocumentFile` + disk cleanup, delete authz) and `tests/instruction-migration.test.js` (child-process boot migration reproduction: admin displayed submissions shifted + deleted, viewer submission kept, column newest-first, run-once flag). `delete-renumber.test.js` extended to verify instruction entries cascade-delete and follow renumbered rows.

Verification: `node src/server/run-tests.cjs` green — **406 tests, 0 fail** (incl. the app.js arg-order contract test auditing the 4 new ApiService calls against `AUTH_ARG_INDEX`); `node build/build-app.js` rebuilt app.js (22 modules, 11201 lines); `node build/split-app.js` byte-exact round-trip; secret-scan passed; bundle-size OK (app.js 491.1 KB raw / 114.8 KB gzip). Committed + pushed after Render redeploy verified.

## fix: Show/Hide updates toggle restored + counter for editors/admin (after 252f657)

Bug report: the counter badge lived inside `.submit-update-wrap`, which became empty for editors/admin after hiding Submit update, so staff lost both the badge and — for records with zero *displayed* updates (e.g. records whose admin updates were shifted into instructions) — the Show/Hide updates toggle itself. Only Submit update was meant to go away.

Fix (dashboard.js + detail.js): for editors/admin the toggle now renders whenever any submissions exist (`subCount > 0`) instead of requiring displayed ones, and its label carries the count — "Show updates (3)" / "Hide updates (3)" — with the unread `.submission-badge.flash` still pinned top-right when flashing. Toggle wrapped in `.submit-update-wrap` so the absolute badge positions correctly inside the button. Viewers unchanged (Submit update + counter badge). Dropped now-dead `updatesCount`/`detailUpdatesCount` locals. app.js rebuilt (22 modules, 11195 lines), split byte-exact, 406/406 tests, secret-scan + bundle-size OK.

## fix: dead Show/Hide toggle + read-sensitive counter badges (after a93a528)

Second bug report on the same footer: (1) the Show/Hide updates button "does nothing"; (2) the counter badges are no longer read-sensitive. Root causes found:
- The button was gated on `subCount > 0` (total submissions) but it toggles the on-card update blocks, which only exist for *displayed* submissions (`updatesCount`). Post-migration many records have submissions yet zero displayed update blocks, so the button flipped state with no target visible.
- `toggleCardUpdates` used `el.textContent` when re-labelling, which DESTROYED the `.submission-badge` span placed inside the button on the first click — so the counter/flash vanished (read-sensitivity lost) and (in the earlier round) the label text clobbering made things look stale.

Fix:
- dashboard.js `toggleCardUpdates`: re-label via `innerHTML` that keeps a `.submission-badge` with the live count; badge now pinned inside the button (wrapped in `.submit-update-wrap`) exactly like the original Submit-update badge (flashes while unread, stops on read, count always shown) — so the counter reflects read state again.
- `buildCardHtml`: toggle only rendered when there is something to show/hide (`updatesCount > 0`) so it always works; when a record has submissions but none displayed, editors/admins get a "View updates" button that opens the submissions modal — the counter button is never dead. Badge (count, flash class) shown on both. `updatesCount` local restored.
- detail.js: same split — toggle when the dialog has displayed update blocks (`detailUpdatesCount > 0`), otherwise "View updates (N)" opening the submissions modal.

Verification: app.js rebuilt (22 modules, 11209 lines), `split-app.js` byte-exact, 406/406 tests, secret-scan + bundle-size OK. Committed + pushed after Render redeploy verified.

## feat: editors (admin+editor) can delete any update/submission (after d74584d)

Request: each update in the submissions modal should have a Delete option for admins AND editors (was admin-only).

- `src/server/submissions.js` `deleteSubmission`: auth gate relaxed `auth.requireAdmin` -> `auth.requireEditor` (audit + return list now use the editor context).
- `src/app/submissions.js`: Delete button in `renderSubmissionCard` and the `deleteSubmission()` client guard changed `isAdmin` -> `isEditor` (viewers still see no delete).
- `src/docs/Architecture.md`: deleteSubmission documented as admin/editor only.
- `authz.test.js`: +2 tests — viewer rejected (Editor permission required), editor add+delete round-trip succeeds.

Verification: app.js rebuilt (22 modules), split byte-exact, 408/408 tests, secret-scan + bundle-size OK. Committed + pushed after Render redeploy verified.
