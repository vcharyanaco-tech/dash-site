# Session Export — 2026-09-16

## Context

Morning session (other machine) pushed: `de12439` (auth hardening,
env-only bootstrap password, security-cookie tests), `e5996ea` (improvement
prompt reworked into evidence-gated execution plan), `2d9aa7a` (merge-conflict
markers boot fix + module round-trip CI). This session: sync, then start the
reworked plan in order → **Phase 0 (Baseline & Inspection)**.

## What was done

### 1. Startup routine established (AGENTS.md)
`AGENTS.md` created (untracked, to be committed this session): mandatory
startup = git fetch/pull --ff-only, read latest `SESSION_EXPORT_*` for pending
tasks, report before acting, commit cadence + SESSION_EXPORT updates.

### 2. Phase 0 — full inspection (Part 24 items 1–9)
Three exploration agents mapped backend, frontend+worker, deploy/tooling/docs.
Architecture map + findings captured in `PHASE0_BASELINE_2026-09-16.md`.

### 3. Phase 0 measurements (gate evidence)
- Backend p95: local `getData` ×120 → p50 14ms / p90 18ms / p95 **19ms** max 23ms.
- `getData` payload: 121 B raw / 109 B gzipped (scratch DB; re-measure on live).
- Lighthouse 13.4.1 (mobile, live):
  - `/` : Perf 98 · A11y 95 · BP 100 · SEO 91; FCP 1.9s LCP 1.9s CLS 0 TBT 0 SI 2.1s.
  - `/app.html` : Perf 96 · A11y 91 · BP 96 · SEO 92; FCP 2.2s LCP 2.2s CLS 0.014
    TBT 0 SI 3.0s; 162 KiB total.
- Bundle: modular load path **173,198 B gz** (20+ reqs) vs single-file `app.js`
  monolith **68,492 B gz**. styles.css 15,918 B gz.
- Secret scan: green on 163 tracked files; CI-wired.

### 4. P0 bug found via tests → **test suite was hanging ~5 min per API error**
The dispatcher catch in `index.js` referenced `fn` (try-block `const`) →
`ReferenceError: fn is not defined` on ANY dispatch error → response never sent
→ undici 300s headers timeout per failing request (this is why npm test always
ended in 304s hangs at `subscribePush: requires auth`, etc.).
**Fix:** hoist `let fn = 'unknown'` above `try` (`index.js:203-207`).

### 5. Test-isolation fix (parallel DB race)
`node --test` forks one process per test file; all shared one seeded scratch DB
and each `test-bootstrap.js` re-seeded the admin password with its own random
value → cross-process SQLITE_BUSY stalls + login races.
**Fix:** `--test-concurrency=1` in `run-tests.cjs` (+ explanatory comment).

### 6. Auth regression in smoke test
`de12439` made `GET /api/files/:key` require login; smoke test never sent the
cookie → upload→GET returned 500. **Fix:** capture `dash_session` cookie at
login and send it on the file route in `smoke.test.js`.

### 7. Phase 0 gate → PASS
Full server suite now **121/121 pass, 0 fail, ~20s**; coverage 77.75% stmt /
56.46% br / 79.85% fn. Baseline doc written; Phase 1 (P0 Security) queued.

## Files Changed
- `AGENTS.md` — new; startup routine.
- `PHASE0_BASELINE_2026-09-16.md` — new; Part 24 deliverables A–I + gate checklist.
- `src/server/index.js` — hoisted `let fn` in POST /api catch (P0 hang fix).
- `src/server/run-tests.cjs` — `--test-concurrency=1` (deterministic suite).
- `src/server/tests/smoke.test.js` — cookie capture + send on `GET /api/files/:key`.

## Phase 1C — Authorization audit (second session unit)

### What was done
- **R3 fixed:** `requireViewer()` no-op → `auth.requireLogin_(token)` (`auth.js:499`).
  `getAuditEntries`/`getRecordHistory` now require a valid session.
- **Cookie-token wiring:** `getAuditEntries` + `getRecordHistory` added to
  `AUTH_ARG_INDEX` (token at index 1); dispatch forwards the token to
  `getAuditEntries(limit, token)`; client call updated (`app.js` + `src/app/core.js`)
  to send `getAuthToken()` so the replay test stays green.
- **Dispatch-level auth for previously-unauthenticated ops** (module `if (token)`
  guards preserved so the Bearer-gated cron path keeps working via direct calls):
  - `getAiInsights` (admin), `sendWeeklyReport` (admin),
    `sendReviewDeadlinePushNotifications` (login)
  - `setupEnterpriseAddons`, `installEnterpriseTriggers` (admin)
  - `validateEnterpriseConfiguration`, `getEnterpriseHealth`,
    `getEnterpriseFrontendConfig` (login) + added to `AUTH_ARG_INDEX` (token @0)
- **Tests:** new `src/server/tests/authz.test.js` — 31-test role matrix
  (anonymous → rejected for 8 login-gated ops; viewer/editor/admin expectations
  for AI, weekly report, enterprise setup, CRUD, audit admin ops, object-level
  guards). `new-endpoints.test.js` cron-mode test rewritten to assert anonymous
  public dispatch is now rejected. `smoke.test.js` `getAuditEntries` now passes token.
- Full suite: **152/152 pass**; secret scan green (167 tracked files).
- Commits: `299975a` (1C unit) + `301e45d` (session-export doc), both pushed.

## This continuation (1D investigation only)

User resumed the session, then paused before code changes. Everything in this
continuation is **investigation / findings only** — nothing committed beyond the
two pushed commits above. Full 1D findings in the "1D Investigation" section below.

## Verification
- `src/server`: `npm test` → 152/152 pass, 0 fail.
- `node --check` on touched server/front files → clean.
- Secret scan → green (167 tracked files).
- Lighthouse + p95 + bundle measurements in baseline doc.

## Commits
1. (earlier) `fix:` phase-0 P0: API-error handler dropped responses (fn scoping);
   make test suite deterministic (--test-concurrency=1); smoke-test cookie auth; docs.
2. `299975a` `fix:` phase-1C authorization audit — requireViewer login-gated,
   cookie-token aware audit/history reads, dispatch-level auth for enterprise
   config & cron ops; authz role-matrix test suite.

## Deployment
- Server change (`src/server/index.js`, run-tests.cjs) → Render auto-deploys.
- `run-tests.cjs`/`smoke.test.js` are CI-only (no prod impact).

## 1D Investigation (started, NO code changes yet — paused by user request)

Dispatching analysis (exact counts, run against `index-dispatch.js` / `index.js`):

- **103 dispatch ops total.** 10 have VALIDATORS today (login, addItem, updateItem,
  deleteItem, adminAddUser, adminDeleteUser, createTask, addSubmission,
  reconcileRecordOrder, uploadDocument) → **93 ops have no VALIDATOR**.
- **19 ops have no `AUTH_ARG_INDEX` entry** (cookie token is never injected):
  - Public / no-token (expected): getServerTime, getData, login, requestPasswordReset,
    getReportTemplates, getSyncStatus, getTranslations.
  - **Real coverage gaps (token slots never cookie-injected → browser cookie users
    would hit "Login required" on these):** setRecordDisplay (token @2),
    generateReviewNotifications (token @0), reconcileRecordOrder (token @1),
    exportFullBackup (token @0), adminSyncFromSheet (token @0),
    adminPreviewSyncFromSheet (token @0), adminPushToSheet (token @0),
    setOpenRouterApiKey / setGeminiApiKey / setGroqApiKey / setHuggingFaceApiKey /
    setKiloApiKey (token @0).
  - Note: 1C already added getAuditEntries/getRecordHistory/enterprise-config ops.
- `getAuthToken()` in clients (`session.js:4`) returns `''` always → cookie-only auth;
  1B should formalize this (kill the vestigial browser-token plumbing).
- 1E upload audit scope confirmed: MIME allowlist + 25MB cap + base64 key regex +
  sanitized names + login-gated resolve already at `documents.js`; needs edge-case
  test coverage only.

## Pending Tasks
1. **Session export / commit review** — confirm and push (current work saved above).
2. **Phase 1 — P0 Security (in progress, 1C done, 1D investigated):**
   - 1C ✅ authorization audit + authz.test.js (see above).
   - 1D (next): add VALIDATORS to high-value dispatch ops (markReviewDone/NotDone,
     changePassword, adminUpdateUser, emailReport, getReportData, emit
     validation-first where args are string/number-typed) + add missing
     `AUTH_ARG_INDEX` entries (setRecordDisplay, generateReviewNotifications,
     reconcileRecordOrder, exportFullBackup, admin*SyncFromSheet, adminPushToSheet,
     *ApiKey setters) so cookie-based browser calls work.
   - 1E file-upload test coverage (size/MIME/name edge cases, bad base64, wrong key).
   - 1B auth-cookie migration assessment (kill vestigial browser-token `getAuthToken()`
     path → document cookie-only design).
3. Phase 2 (measured perf): ship app.js monolith as prod load path, re-measure on
   live DB/payloads, re-run Lighthouse with 4G throttle.
4. Phase 3+ only after Phase 1/2 gates pass.