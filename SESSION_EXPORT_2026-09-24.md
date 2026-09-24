# Session Export — 2026-09-24

## Objective status

1. Fix the reported **"search bar is not working in dashboard"** on the live site
   (`dashboardharyana.site`). Root-caused, fixed, regression-guarded and pushed.
2. Fix the reported **"sidebar is not accessible / hidden under an overlay on
   mobile"**. Root-caused and pushed.

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

### A. Global search modal input (from earlier today)

- `src/app/workspace.js`: in `initWorkspaceFeatures()`, bind an `input` listener
  on `#globalSearchInput` so every keystroke re-runs `renderGlobalSearch_(value)`
  (guarded with `__dashSearchBound` for idempotency).
- Rebuilt the bundle: `node build/build-app.js` (22 modules, 11809 lines) —
  `node build/split-app.js` round-trip **byte-exact**.
- `src/server/tests/frontend-contract.test.js`: added guard
  `global search modal input repaints results on typing` asserting the bundle
  binds `gsi.addEventListener('input'` and re-runs `renderGlobalSearch_(gsi.value)`.

### B. Mobile sidebar hidden under the backdrop

- **Root cause:** at `≤760px`, the `@media (max-width: 760px)` block
  (`assets/styles.css:3399`) overrode `.sidebar-backdrop` to
  `z-index: var(--z-backdrop)` = **90** — *above* the drawer's
  `--z-sidebar` = **40**. On phones the dark backdrop covered the sidebar,
  and every tap hit the backdrop (closing the drawer), making nav unusable.
  Contradicts the documented intent (`SESSION_EXPORT_2026-09-16.md`:
  "mobile backdrop 35 — below `--z-sidebar`").
- **Fix:** set the backdrop to `calc(var(--z-sidebar) - 1)` = 39 in both the
  base rule (`styles.css:3306`, was a literal `35`) and the ≤760px media
  query. Backdrop now sits between topbar (30) and drawer (40).
- Source edit only — no bundle rebuild needed (CSS is served directly by
  Pages/`sw.js` network-first).

## Verification

- `node --check` clean on touched JS (`workspace.js`, `app.js`, test file).
- Full suite `src/server/run-tests.cjs`: **514/514 pass, 0 fail** (incl. new guard).
- Bundle round-trip byte-exact (build → split).
- `git diff` reviewed; sidebar backdrop z-index confirmed 39 < drawer 40.

## Commits

- `7af335f` rebased from local prior session (Dash AI ask-contract regression
  guard; was 1 commit ahead of `origin/main`; replayed cleanly onto `98bc134`).
- `<fix-commit>` (now `2a4cff9`) `fix: wire global search modal input to repaint results (dead search bar)`.
- `b19e187` `fix: keep mobile sidebar backdrop below the drawer (was z-index 90, covering nav)`
  — pushed; Pages auto-deploys.

## Notes / housekeeping

- Local `node_modules` was missing `jsdom` (declared in devDependencies);
  `npm install` in `src/server` restores the `client-behavior-contract` suite
  (lockfile/package.json unchanged — jsdom was already pinned in the lock).
- Stray `.git-merge-dash-ai-pin.js` left untracked (per repo convention).

## Pending tasks

- None from either fix. Live site auto-deploys via GitHub Pages on push to `main`;
  verify after deploy with `node scripts/live-check.cjs`.
- Mobile sidebar fix needs a clean reload so the network-first `sw.js` serves the
  updated `assets/styles.css`.
- Optional (existing backlog): set `CLOUDFLARE_API_TOKEN` repo secret to activate
  the worker deploy; delete stale `VS tools.code-workspace` / presentation deck
  strays if no longer needed.