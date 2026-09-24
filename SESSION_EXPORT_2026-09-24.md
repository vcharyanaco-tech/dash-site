# Session Export — 2026-09-24

## Objective status

Fix the reported **"search bar is not working in dashboard"** on the live site
(`dashboardharyana.site`). Root-caused, fixed, regression-guarded and pushed.

## Diagnosis

The v1.2.2 workspace redesign repurposed the topbar `#searchInput` into a
launcher for the **Global Search** modal:

- `initWorkspaceFeatures()` (`src/app/workspace.js`) binds a `focus` handler on
  `#searchInput` that immediately calls `openGlobalSearch()` and moves focus to
  the modal's `#globalSearchInput`.
- But **nothing ever listened for `input` on `#globalSearchInput`** — the only
  two `input` listeners in the bundle were a dialog field and the topbar
  handler in `src/app/init.js`, whose dashboard-filter path
  (`appState.searchQuery` → `renderDashboard()`) is bypassed while
  `handleWorkspaceSearchInput_` is defined (it is).
- Net effect: focusing the search bar opens the modal, focus lands on the modal
  input, and **typing did nothing** — results never repainted (`renderGlobalSearch_`
  was reachable only from the topbar Enter/input path, not from the modal field).

## What was done

- `src/app/workspace.js`: in `initWorkspaceFeatures()`, bind an `input` listener
  on `#globalSearchInput` so every keystroke re-runs `renderGlobalSearch_(value)`
  (guarded with `__dashSearchBound` for idempotency).
- Rebuilt the bundle: `node build/build-app.js` (22 modules, 11809 lines) —
  `node build/split-app.js` round-trip **byte-exact**.
- `src/server/tests/frontend-contract.test.js`: added guard
  `global search modal input repaints results on typing` asserting the bundle
  binds `gsi.addEventListener('input'` and re-runs `renderGlobalSearch_(gsi.value)`.

## Verification

- `node --check` clean on touched JS (`workspace.js`, `app.js`, test file).
- Full suite `src/server/run-tests.cjs`: **514/514 pass, 0 fail** (incl. new guard).
- Bundle round-trip byte-exact (build → split).

## Commits

- `7af335f` rebased from local prior session (Dash AI ask-contract regression
  guard; was 1 commit ahead of `origin/main`; replayed cleanly onto `98bc134`).
- `<fix-commit>` `fix: wire global search modal input to repaint results (dead search bar)`.

## Notes / housekeeping

- Local `node_modules` was missing `jsdom` (declared in devDependencies);
  `npm install` in `src/server` restores the `client-behavior-contract` suite
  (lockfile/package.json unchanged — jsdom was already pinned in the lock).
- Stray `.git-merge-dash-ai-pin.js` left untracked (per repo convention).

## Pending tasks

- None from this fix. Live site auto-deploys via GitHub Pages on push to `main`;
  verify after deploy with `node scripts/live-check.cjs`.
- Optional (existing backlog): set `CLOUDFLARE_API_TOKEN` repo secret to activate
  the worker deploy; delete stale `VS tools.code-workspace` / presentation deck
  strays if no longer needed.