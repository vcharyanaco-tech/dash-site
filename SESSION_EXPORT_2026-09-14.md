# Session Export — 2026-09-14

## What was done

### 1. Fixed delete/renumber sync bug (submissions detaching from records)

**Problem**: When a record was deleted, `dataRenumber_()` only renumbered the
`records` table. Child rows pointing at a record's sheet row
(`submissions.card_row`, `tasks.record_row`, `documents.record_row`,
`record_changes.record_row`, `ask_ai_history.record_row`) were never remapped,
so updates/tasks/documents silently attached to the *wrong* record after rows
shifted downward.

**Fix** (`src/server/records.js`):
- `dataRenumber_()` now builds an old→new mapping from every row that actually
  moves, then remaps all five referencing child tables in ascending order
  (safe because every shift is downward, so each target slot is already
  vacated before use).
- `deleteRecord_()` cascade-deletes the deleted record's own child rows first,
  so they can never be remapped onto a successor record during renumbering.

**Verification**: ad-hoc server test confirmed — after deleting a middle
record, submissions attached to rows on either side stayed with the correct
records, the deleted record's submissions were removed, and IDs stayed
sequential with no gaps.

### 2. Display-by-ticking toggle for records (EDITOR + ADMIN, viewer unchanged)

Feature request: tick which records display on the dashboard; assign the
toggle to editor role along with admin; viewer experience unchanged.

**Server**:
- `schema.sql`: new `records.displayed INTEGER NOT NULL DEFAULT 1` column.
- `db.js`: migration via `PRAGMA table_info(records)` + `ALTER TABLE
  records ADD COLUMN displayed INTEGER NOT NULL DEFAULT 1` (backward
  compatible — all existing records stay visible).
- `config.js`: new audit actions `ACTIONS.RECORD_DISPLAY` /
  `ACTIONS.RECORD_HIDE`.
- `records.js`:
  - `rowToRowSpec_()` / `buildItemFromRowSpec_()` now carry `displayed`.
  - `setRecordDisplay_(row, displayed, token)` (runs under the record lock,
    requires editor+ via `auth.requireEditor`, logs audit, bumps data
    generation) + public `setRecordDisplay()` exported.
  - `scopeItemsForUser_()`: VIEWER role now filters to `displayed !== false`
    only; editors/admins get the full list (including hidden) so they can
    manage display.
- `index-dispatch.js`: `setRecordDisplay` dispatch entry.
- `index.js`: added `setRecordDisplay` to the `dataFns` SSE broadcast list.

**Client**:
- `core.js`: `appState.dashShowHidden`, `ApiService.setRecordDisplay(row,
  displayed)`.
- `dashboard.js`:
  - `toggleRecordDisplay(row, displayed)` — editor+; optimistically re-renders
    from the server payload.
  - Display checkbox on each card title (`buildCardHtml`) and each table row
    ID cell (`buildTableRowHtml`); hidden cards/rows are dimmed via
    `card-hidden` / `row-hidden` classes.
  - `applyFilters()` hides non-displayed records unless `dashShowHidden` and
    user is an editor.
  - `handleDashShowHiddenChange()` — "Show hidden" checkbox in filters row.
- `session.js`: toggles the "Show hidden" control visibility by role in
  `renderProfile`.
- `app.html`: new `showHiddenWrap` / `dashShowHidden` control in the filters
  row; bumped `assets/styles.css?v=2026.09.14b`.
- `assets/styles.css`: `.display-toggle`, `.card-hidden`, `.row-hidden`,
  `.filters-show-hidden` styles.

**Verification**: dedicated tests confirmed admin hide/show round-trips,
viewer sees hidden record count drop after hide (23 → 22) and return after
re-show, and editor/admin still see all records.

## Test Results
- `smoke.test.js` 14/14 pass, `multilink.test.js` 2/2 pass.
- `sync-push`, `sync-prune`, `dispatch-client-args` 15/15 pass.
- Existing known pre-existing failure remains untouched:
  `new-endpoints.test.js:150` — `sendWeeklyReport: requires admin auth`
  (duplicate-user error in test setup), unrelated to this session.
- All modified JS files pass `node --check`.

## Files Changed
- `src/server/records.js` — sync fix + setRecordDisplay + viewer scoping
- `src/server/schema.sql` — `records.displayed` column
- `src/server/db.js` — ALTER TABLE migration
- `src/server/config.js` — RECORD_DISPLAY / RECORD_HIDE audit actions
- `src/server/index-dispatch.js` — setRecordDisplay dispatch
- `src/server/index.js` — dataFns SSE broadcast list
- `src/app/core.js` — appState + ApiService.setRecordDisplay
- `src/app/dashboard.js` — toggle UI, filter, show-hidden handler
- `src/app/session.js` — role-gated show-hidden control
- `app.html` — filters-row control + CSS cache-buster bump
- `assets/styles.css` — toggle/hidden styles

## Commits
1. `c4775e0` — fix: cascade-delete + remap child rows on record delete to keep submissions in sync
2. `ae3d1ad` — feat: editors/admins tick which records display on dashboard (viewers stay unchanged)

## Deployment
- Both commits pushed to `origin/main`.
- GitHub Pages (`pages.yml`, serving repo root) auto-deploys `app.html`,
  `src/app/*.js`, `assets/styles.css` — no bundle rebuild required.
- Render backend auto-deploys `src/server` changes (migration runs on boot).

---

## Pending Tasks

1. **Edit-window / auto-refresh disappearance bug** (deferred mid-way)
   - Symptom: "Entire modal closes" when auto-refresh (or a data-change SSE)
     repaints the dashboard while the Edit modal is open.
   - Suspected root cause: `autoRefreshTick()` in `src/app/utils.js` checks
     `document.body.classList.contains('modal-open')` only at fetch *start*;
     the completion callback calls `renderDashboard(true)` with no modal guard,
     and `openSubmissionsModal()` bypasses `openDialog()`. `refreshData()`
     (dashboard.js:663) also has no modal guard.
   - Plan: check modal state at fetch completion too (skip render while a
     modal is open), add guards in `refreshData()` / `flushPendingAutoRefresh`,
     and route `openSubmissionsModal` through `openDialog` so `.modal-open` is
     maintained globally.

2. **`tests/new-endpoints.test.js:150` pre-existing failure**
   - `sendWeeklyReport: requires admin auth` — duplicate-user error in test
     setup (`adminAddUser: A user with that email already exists.`). Known,
     do not chase unless asked.

3. **Live verification of this session's deploys**
   - Confirm on the live dashboard that (a) deleting a middle record keeps all
     updates attached to the correct records, and (b) an editor/admin can tick
     a record's "Display" checkbox, viewers stop seeing unticked records, and
     "Show hidden" reveals them dimmed.

4. **No other pending tasks** — all previously queued display-toggle work is
   complete and shipped in this session.