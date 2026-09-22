# Session Export — 2026-09-22

## Objective status

All 23 codebase improvement items are now **done except #13** (explicitly
excluded — plaintext-password emails + mailer TLS; deprecated client-side mail
path). Batches:

- A `918c50d`, B `f254cc3`, C `339355e` (prior sessions)
- D `5af149b` "feat: batch-d trusted field-html sanitization (server + client)"
  (9 files, +447/−12; full suite 484/484)
- **E `af712bf` (this session)** "feat: batch-e P3 polish (version stamping,
  i18n chrome, dialog-free UX, table multi-select, jsdom contract suites, CI
  gate + worker deploy)" — 29 files, +1726/−136.

Final state: full suite **510/510 pass, 0 fail** (also verified with the CI
coverage gate enabled, exit 0), bundle size 129.9 KB raw / 24.4 KB gzip OK,
secret scan (207 files) OK, DB migrations OK, `node --check` clean on every
touched file, app.js round-trip byte-exact (22 modules, 11802 lines).

## What was done

### #19 — computed colspan (dashboard/ai)
- `src/app/dashboard.js`: new `visibleDashColumnCount()` (counts visible
  `th[data-col]` via `appState.dashboardPrefs.columns`, fallback 8, min 1).
  The three hardcoded `colspan=8` sinks (AI-insight row, AI-link row, "No
  records found.") now use the computed count.
- `src/app/ai.js`: `toggleRowAi`/`toggleRowLink` stamp `colspan` from
  `visibleDashColumnCount()`.
- `applyColumnVisibility` now **skips full-width `ai-insight-tr` /
  `ai-link-tr` panel rows** so hiding column 0 can no longer collapse an open
  AI/link panel (latent bug found while wiring the new `sel` column).

### #21 — version stamping
- `src/scripts/bump-version.ps1` now stamps `APP_BUILD` using plain
  `String.Replace` (the earlier inline PowerShell `Regex.Replace` treated `$1`
  followed by digits as backreference `$12`, corrupting `core.js`' build line;
  restored via `git checkout`). Lesson: always run the script, never inline.
- Ran `bump-version.ps1 1.2.1` → `APP_VERSION='1.2.1'`, `APP_BUILD='2026.09.22'`
  (app.js + src/app/core.js), `SW_VERSION='2026.09.22-161146-v1.2.1'` (sw.js);
  also stamped into `src/server/config.js`, `app.html`, `index.html`,
  `src/app/entry.js`.

### #22 — i18n dynamic text coverage (coverage branch, abstraction kept)
- `app.html`: `data-i18n` on all sidebar nav items + section labels + sidebar
  credit + dashboard title; new **Language card** in Settings (before
  `sheetSyncCard`) with a `toggleLanguage()` button.
- New dict keys in client `src/i18n.js` and mirrored into
  `src/server/i18n-server.js` (en + hi incl. Devanagari intact).
- New `tests/i18n-contract.test.js` — 7/7 (key coverage client+server, no
  client/server drift, Devanagari intact, toggleLanguage wired in app.js).
- Note: earlier `???????` console output was only Select-String terminal
  encoding — the files contain real Devanagari; do NOT "fix" them.

### #23 — UX
- **a. prompt/confirm cleanup:** added `#promptModal` (Enter submits) to
  app.html; `showPrompt`/`runPromptDialog`/`cancelPromptDialog` in `ai.js`
  (supports `options.type = 'password'`); `init.js` Escape + backdrop-click
  handle it; all 7 native call sites rewritten (`dashboard.js`
  `insertLastMeetingLink`, `submissions.js` `insertSubmissionLink`,
  `meetings.js` `deleteMeetingFile`, `settings.js` `pushAllToSheet` +
  `resetUserPassword`, `workspace.js` `addDashRulePrompt` + `deleteDashRule`).
  No native `prompt()`/`confirm()` remain except names in comments.
- **b. PWA icons:** `manifest.json` gains `"id": "/app.html"` and icon
  `"purpose": "any maskable"`. Fixed an accidental UTF-8 BOM the edit tool
  introduced into manifest.json so `JSON.parse` works again.
- **c. Multi-select (dashboard records table):** `th[data-col="sel"]` +
  `#dashSelAll` header checkbox + `#dashBatchBar` (count + Mark review
  done / Mark review not done / Delete) + "Select" entry in the column modal;
  `dashboard.js` `selectedDashRows_`, `toggleDashSelectAll`, `dashRowSelect`,
  `selectedDashRowsArray_`, `updateDashBatchBar` (called at end of
  `renderDashboardTable`), `clearDashSelection`, `dashBatchReview(status)`,
  `dashBatchDelete()`; styles in `assets/styles.css`
  (`.dash-sel-col`, `.dash-row-check`, `.dash-batch-bar`).

### #17 — Tier-A happy-path tests
- New `tests/tier-a-happy-path.test.js` — 7/7 over the HTTP surface:
  divisional dashboard, notification digest/list/mark-all-read, task
  create/list/delete, instruction entries CRUD, audit listing, report
  templates + weekly report, documents + i18n dictionaries.

### #18 — jsdom client behavior contract tests
- Added `jsdom@^30.1.1` to `src/server` devDependencies (no root
  package.json; package-lock updated; `npm install` pruned 70 stale packages,
  server deps verified intact).
- New `tests/client-behavior-contract.test.js` — 5/5: renders real app.html in
  jsdom, extracts dashboard functions verbatim from app.js, and drives
  computed colspan, column visibility (incl. panel-row preservation), batch-bar
  visibility/count, select-all, and innerHTML sanitization against the live
  DOM.

### #20 — CI
- `.github/workflows/ci.yml`: removed the **dead glob** `src/scripts/*.cjs`
  from the server syntax-check step (that dir only holds `.ps1`/`.bat`).
- Coverage gate: `run-tests.cjs` now appends
  `--test-coverage-lines=80 --test-coverage-branches=60
  --test-coverage-functions=80` **when `CI=1`** (measured now: 83.6 / 64.2 /
  86.7) — a drop below the floor red-lights CI. (Note: `--test-coverage-statements`
  is not a valid Node 24 flag; omitted.)
- New `.github/workflows/deploy-worker.yml`: deploys the `dashv1-proxy` Worker
  via `wrangler-action@v3` on main push, **guarded on
  `secrets.CLOUDFLARE_API_TOKEN != ''`** so it is a no-op until the secret is
  configured.
- "Lint" = the repo's existing `node --check` gates (no ESLint configured).

## Files changed (commits D `5af149b` / E `af712bf`)
- Batch E: `.github/workflows/ci.yml`, `.github/workflows/deploy-worker.yml`,
  `app.html`, `app.js`, `assets/styles.css`, `index.html`, `manifest.json`,
  `sw.js`, `src/app/{ai,core,dashboard,entry,init,meetings,settings,
  submissions,workspace}.js`, `src/i18n.js`, `src/scripts/bump-version.ps1`,
  `src/server/config.js`, `src/server/i18n-server.js`, `src/server/package.json`,
  `src/server/package-lock.json`, `src/server/run-tests.cjs`,
  `src/server/tests/{frontend-contract,client-behavior-contract,i18n-contract,
  pwa-contract,tier-a-happy-path}.test.js`.
- Tests wired/verified: `frontend-xss-hardening.test.js` (12/12),
  `frontend-contract.test.js` (+2 tests: no native prompt/confirm;
  editor multi-select in app.js), `pwa-contract.test.js` (5/5 after BOM fix),
  `unit-helpers.test.js` (41/41).

## Pending tasks / suggested next steps
- **Optional follow-ups (NOT queued for this objective):** bump the client
  test-node to `happy-dom` unless jsdom stays preferred; consider relaxing the
  sse-coalesce "exactly 1 dataChanged" assert to `>= 1` if CI ever flakes;
  wire `CLOUDFLARE_API_TOKEN` into repo secrets to activate the new worker
  deploy; delete the now-stale `Usage & RFQ` presentation deck strays
  (`VS tools.code-workspace`, `dash-site-presentation-mode-big-pickle.md`) if
  no longer needed. The two strays remain untracked (never to be committed).
- Full objective is complete; nothing from the 23-item list remains except the
  excluded #13.

## Session state for the next agent
- **Strays:** `VS tools.code-workspace`, `dash-site-presentation-mode-big-pickle.md`
  untracked — never stage/commit.
- Rebuild chain: edit `src/app/*.js`/`src/i18n.js` → `node build/build-app.js`
  → `node build/split-app.js` (must be byte-exact). `app.js` is currently in
  sync with the sources.
- Version is now **1.2.1**; `bump-version.ps1` is safe to re-run (String.Replace).
- Working tree is clean after `af712bf`; **not pushed** — awaiting the user's
  go-ahead before `git push origin main`.