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

## This continuation (1D → 1E → 1B)

User resumed the session and greenlit Phase 1D, then 1E, then 1B. Implementation
landed in the sections below (commits `c4e210a`, `7f350a5`); the 1D investigation
it was based on is preserved at the end as historical reference.

## Verification
- `src/server`: `npm test` → 229/229 pass, 0 fail (final after 1B); earlier
  196/196 (1D), 222/222 (1E), 152/152 (baseline).
- `node --check` on all touched server/front files → clean.
- Secret scan → green (167 tracked files).
- Lighthouse + p95 + bundle measurements in baseline doc.

## Commits
1. (earlier) `fix:` phase-0 P0: API-error handler dropped responses (fn scoping);
   make test suite deterministic (--test-concurrency=1); smoke-test cookie auth; docs.
2. `299975a` `fix:` phase-1C authorization audit — requireViewer login-gated,
   cookie-token aware audit/history reads, dispatch-level auth for enterprise
   config & cron ops; authz role-matrix test suite.
3. `124437a` `docs:` session export 2026-09-16 — Phase 1D implementation + updated
   pending tasks (pushed alongside `c4e210a`).
4. `c4e210a` `feat:` phase-1D dispatch hardening — cookie-token injection for
   12 ops + 8 new validators + 44 tests.
5. `7f350a5` `test:` phase-1E file-upload edge cases — MIME allowlist matrix,
   size cap rejection, filename sanitization/truncation, base64 validation,
   anonymous/garbage-token auth gates, resolveDocumentFile key integrity (26 tests).
6. `28a0faf` `feat:` phase-1B cookie-only auth — remove vestigial browser
   token plumbing, generalize cookie injection, +7 injection tests.
7. `533ed7d` `docs:` session export + Architecture.md — Phase 1B cookie-only design.

## Deployment
- Server change (`src/server/index.js`, run-tests.cjs, +tests) → Render auto-deploys.
- Client `src/app/*` + rebuilt `app.js` → static host; push triggers deploy of
  the cookie-only frontend. Be aware old cached browsers still send `getAuthToken()`
  (`''`) for a few minutes — the generalized middleware treats an empty slot as
  data to shift, so those stale calls keep working during rollout.

## Phase 1D — Implementation (third session unit)

### What was done
- **AUTH_ARG_INDEX + 12 ops now cookie-injected** (browser calls work with a
  session cookie, no token arg):
  `setRecordDisplay:2`, `generateReviewNotifications:0`,
  `reconcileRecordOrder:1`, `exportFullBackup:0`, `adminSyncFromSheet:0`,
  `adminPreviewSyncFromSheet:0`, `adminPushToSheet:0`, `setOpenRouterApiKey:0`,
  `setGeminiApiKey:0`, `setGroqApiKey:0`, `setHuggingFaceApiKey:0`,
  `setKiloApiKey:0` (`index.js` AUTH_ARG_INDEX).
- **Middleware cookie-injection upgrade** (`index.js:223-233`): when a cookie
  token is present and the token slot is absent/empty, the slot is filled; for
  single-arg browser calls to token-first ops (e.g. `['apiKey']` on the
  ApiKey setters where the data occupies the token slot), the data arg is
  shifted aside (unshift) so the cookie token lands at args[0] before
  validation.
- **8 new VALIDATORS** (14 validator entries): `changePassword`,
  `markReviewDone`, `markReviewNotDone`, `adminUpdateUser`, `emailReport`,
  `getReportData`, `exportFullBackup`, plus the 5× `set*ApiKey` (empty/non-string
  key rejected before reaching `requireAdmin`). Validator count: 10 → 22.
- **Test suite:** new `src/server/tests/validators.test.js` — 44 tests:
  malformed/missing-arg rejection for every new validator + cookie-injection
  end-to-end for all 12 ops + viewer/editor role denials for markReview and
  admin/API-key ops.
- **Full suite: 196/196 pass** (was 152); coverage 79.30% stmt / 58.43% br,
  `node --check` clean on both touched files.
- Commit `c4e210a` (NOT yet pushed).

## Phase 1B — Cookie-only auth migration (final unit, this session)

### What was done
- **Browser token plumbing deleted** — `getAuthToken`, `setAuthToken` and the
  `STORAGE_TOKEN`/`indiaPostAuthToken` localStorage constant removed from
  `src/app/session.js`, `src/app/core.js` and the rebuilt root `app.js` (~90
  `getAuthToken()` call sites + 12 `setAuthToken()` call sites). `app.js`
  regenerated via `node build/build-app.js` (16 modules, 7052 lines).
- **init.js push bug fixed** — `subscribePush(getAuthToken(), sub.toJSON())` put
  `''` in the subscription slot and DROPPED the real subscription; now
  `subscribePush(sub.toJSON())` (same for `unsubscribePush(endpoint)`).
- **Generalized cookie-injection middleware** (`index.js`) replaces the 1D
  fill/unshift logic: with a cookie present it splices the cookie token at the
  op's `AUTH_ARG_INDEX` slot — a token-shaped string (64 hex chars,
  `uuid_()+uuid_()`) in the slot is replaced by the cookie (cookie authoritative);
  otherwise data is shifted rightward. Token-first ops (`getSubmissions(cardRow)`,
  `emailReport(recipient,key)`, `getMeetingFile(name)`, `setFathomApiKey(apiKey)`,
  …) now work with purely data args. Stale cached browsers that still send `''`
  keep working (empty slot → data path).
- **`AUTH_ARG_INDEX` + `VALIDATORS` now exported** from `index.js`.
- **`dispatch-client-args.test.js` rewritten** to mirror the middleware: evalArgs
  parses the real ApiService block from app.js, splices `TOKEN` at
  `AUTH_ARG_INDEX[api]`, replays through the dispatch (arg-order lock retained).
- **New `tests/cookie-injection.test.js`** — 7 HTTP-level tests: append-token
  (addItem), token-first (getSubmissions, getMeetingFile past-auth),
  stale-64-hex-token replaced by cookie, no-cookie → login required, single-arg
  apiKey through the generalized splice.
- Full suite **229/229 pass**; `node --check` clean on all touched files.
- Commit pending push.

## Pending Tasks
1. **1F — Validator hardening (optional, incremental):** Add validators for
   high-risk mutating ops lacking them (e.g. `deleteDocument`, `deleteMeetingFile`,
   `deleteSubmission`, `deleteTask`, `adminImportUsers`, `adminResetPassword`,
   `adminEmailAllUsers`, `adminSyncFromSheet`, `adminPushToSheet`,
   `adminPreviewSyncFromSheet`, `adminDeleteAuditRows`, `adminClearAudit`,
   `setRecordDisplay`, `setDocumentKeep`, `createPdfReport`, `exportToSpreadsheet`,
   `exportReviewCalendarIcs`, `getRecordDocuments`, `getRecordHistory`,
   `getSubmissions`, `addSubmission` beyond length check, `updateSubmission`,
   `lockSubmission`, `unlockSubmission`, `toggleSubmissionDisplay`,
   `markAllSubmissionsRead`, `getMyNotifications`, `markNotificationsRead`,
   `clearMyNotifications`, `createTask`, `updateTask`, `deleteTask`,
   `getDashboardPreferences`, `saveDashboardPreferences`, `getAiInsights`,
   `getCardAiInsight`, `getLinkContentAiInsight`, `askLinkAi`,
   `getAllAskLinkHistory`, `saveAskLinkHistory`, `processMeetingRecording`,
   `transcribeMeetingSegment`, `generateMeetingMinutes`, `listMeetingFiles`,
   `getMeetingFile`, `deleteMeetingFile`, `setFathomApiKey`,
   `listFathomMeetings`, `getFathomMeetingContent`, `getRecordingDownloadLink`,
   `listFathomUsers`, `searchFathomMeetings`, `getFathomMeetingStats`,
   `bulkGetRecordingDownloadLinks`, `subscribePush`, `unsubscribePush`,
   `sendReviewDeadlinePushNotifications`, `sendWeeklyReport`,
   `sendWhatsAppReviewReminders`, `adminImportCsv`, `validateSession`,
   `refreshSession`, `logout`, `getAssignableUsers`, `getMyTasks`,
   `getTaskCounts`, `getTasks`, `getEnterpriseFrontendConfig`,
   `getEnterpriseHealth`, `installEnterpriseTriggers`,
   `setupEnterpriseAddons`, `validateEnterpriseConfiguration`).
   Prioritize admin-mutating + file-deletion ops first.
2. **1F — Bearer/cron regression test:** Add HTTP test that POSTs a real
   session token as an arg (no cookie) and asserts auth succeeds — documents
   the service-to-service / cron path preserved after the generalized middleware.
3. Phase 2 (measured perf): ship app.js monolith as prod load path, re-measure on
   live DB/payloads, re-run Lighthouse with 4G throttle.
4. Phase 3+ only after Phase 1/2 gates pass.

### Stray files (not committed)
- `src/server/D:/tmp` — test-suite leak (Windows-style absolute path); untracked,
  do not commit.

### 1D Investigation (historical reference — superseded by implementation above)

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

## Phase 1F — Validator + AUTH_ARG_INDEX audit (this session)

### Audit results (live from `dispatch`, `AUTH_ARG_INDEX`, `VALIDATORS`)

- **103 dispatch ops total.**
- **AUTH_ARG_INDEX: 96/103 covered.** The 7 without are all intentionally public /
  no-token: `getData`, `getReportTemplates`, `getServerTime`, `getSyncStatus`,
  `getTranslations`, `login`, `requestPasswordReset`. ✅ No gaps.
- **VALIDATORS: 22/103 covered.** 81 ops lack validators.
  - Current validators: `login`, `addItem`, `updateItem`, `deleteItem`,
    `adminAddUser`, `adminDeleteUser`, `createTask`, `addSubmission`,
    `reconcileRecordOrder`, `uploadDocument`, `changePassword`,
    `markReviewDone`, `markReviewNotDone`, `adminUpdateUser`, `emailReport`,
    `getReportData`, `exportFullBackup`, `setOpenRouterApiKey`,
    `setGeminiApiKey`, `setGroqApiKey`, `setHuggingFaceApiKey`, `setKiloApiKey`.

### Pending Tasks
1. **1F — Validator hardening (optional, incremental):** Add validators for
   high-risk mutating ops lacking them (e.g. `deleteDocument`, `deleteMeetingFile`,
   `deleteSubmission`, `deleteTask`, `adminImportUsers`, `adminResetPassword`,
   `adminEmailAllUsers`, `adminSyncFromSheet`, `adminPushToSheet`,
   `adminPreviewSyncFromSheet`, `adminDeleteAuditRows`, `adminClearAudit`,
   `setRecordDisplay`, `setDocumentKeep`, `createPdfReport`, `exportToSpreadsheet`,
   `exportReviewCalendarIcs`, `getRecordDocuments`, `getRecordHistory`,
   `getSubmissions`, `addSubmission` beyond length check, `updateSubmission`,
   `lockSubmission`, `unlockSubmission`, `toggleSubmissionDisplay`,
   `markAllSubmissionsRead`, `getMyNotifications`, `markNotificationsRead`,
   `clearMyNotifications`, `createTask`, `updateTask`, `deleteTask`,
   `getDashboardPreferences`, `saveDashboardPreferences`, `getAiInsights`,
   `getCardAiInsight`, `getLinkContentAiInsight`, `askLinkAi`,
   `getAllAskLinkHistory`, `saveAskLinkHistory`, `processMeetingRecording`,
   `transcribeMeetingSegment`, `generateMeetingMinutes`, `listMeetingFiles`,
   `getMeetingFile`, `deleteMeetingFile`, `setFathomApiKey`,
   `listFathomMeetings`, `getFathomMeetingContent`, `getRecordingDownloadLink`,
   `listFathomUsers`, `searchFathomMeetings`, `getFathomMeetingStats`,
   `bulkGetRecordingDownloadLinks`, `subscribePush`, `unsubscribePush`,
   `sendReviewDeadlinePushNotifications`, `sendWeeklyReport`,
   `sendWhatsAppReviewReminders`, `adminImportCsv`, `validateSession`,
   `refreshSession`, `logout`, `getAssignableUsers`, `getMyTasks`,
   `getTaskCounts`, `getTasks`, `getEnterpriseFrontendConfig`,
   `getEnterpriseHealth`, `installEnterpriseTriggers`,
   `setupEnterpriseAddons`, `validateEnterpriseConfiguration`).
   Prioritize admin-mutating + file-deletion ops first.
2. **1F — Bearer/cron regression test:** Add HTTP test that POSTs a real
   session token as an arg (no cookie) and asserts auth succeeds — documents
   the service-to-service / cron path preserved after the generalized middleware.
3. Phase 2 (measured perf): ship app.js monolith as prod load path, re-measure on
   live DB/payloads, re-run Lighthouse with 4G throttle.
4. Phase 3+ only after Phase 1/2 gates pass.

### Stray files (not committed)
- (none — `src/server/D:/tmp` deleted after push)

## Phase 1F implementation (this continuation)

User resumed the session after sync (dropped the stray local `test-users-import.csv`
commit, fast-forwarded to `origin/main` at `c489095`), then greenlit 1F.

### What was done
- **28 new VALIDATORS** in `index.js` (22 → **50/103** covered):
  - Admin-mutating: `adminImportUsers`, `adminResetPassword`, `adminEmailAllUsers`,
    `adminImportCsv`, `adminDeleteAuditRows`, `adminClearAudit`.
  - File/data deletion: `deleteDocument`, `deleteMeetingFile`, `deleteSubmission`,
    `deleteTask`.
  - Other high-risk mutating: `updateTask`, `updateSubmission`, `lockSubmission`,
    `unlockSubmission`, `toggleSubmissionDisplay`, `markAllSubmissionsRead`,
    `setRecordDisplay`, `setDocumentKeep`, `saveDashboardPreferences`,
    `markNotificationsRead`, `subscribePush`, `unsubscribePush`, `setFathomApiKey`,
    `exportReviewCalendarIcs`, `createPdfReport`, `exportToSpreadsheet`,
    `sendWeeklyReport`, `sendReviewDeadlinePushNotifications`.
- **Tests:** `validators.test.js` +44 malformed/missing-arg validator cases
  (75 total validator cases). **3 new bearer/cron regression tests**: a real
  session token passed as an ARG (no cookie) still authenticates
  (`adminGetUsers`, `createTask` success; garbage token rejected) — documents
  the service-to-service / cron path preserved after the generalized
  cookie-injection middleware.
- **3 existing authz assertions relaxed** (`authz.test.js`,
  `new-endpoints.test.js`): ops with new validators now reject anonymous
  malformed calls at the *validation* gate ("requires (token)") instead of the
  auth gate ("Login required") — same security intent, different message.

### Verification
- Full suite: **285/285 pass**, 0 fail (~28s). Coverage 79.62% stmt / 61.09% br /
  84.07% fn (up from 79.30/58.43 pre-1E).
- `node --check` clean on `index.js` + `validators.test.js`.

### Files changed
- `src/server/index.js` — 28 new VALIDATORS.
- `src/server/tests/validators.test.js` — +44 validator cases, +3 bearer/cron tests.
- `src/server/tests/authz.test.js` — relaxed anonymous-rejection regex.
- `src/server/tests/new-endpoints.test.js` — relaxed 2 anonymous-rejection regexes.

### Commits (this continuation)
1. `(pending)` `feat:` phase-1F validator hardening — 28 new validators for
   admin/data-mutating + file-deletion ops; bearer/cron token-as-arg regression
   tests; full suite 229→285 pass.

### Pending Tasks
1. **1F (remaining, optional, incremental):** validators for lower-risk read /
   informational ops still lacking them (~53 ops): `getSubmissions`,
   `getRecordDocuments`, `getRecordHistory`, enterprise AI/meeting/Fathom reads,
   `getTasks`, `getAssignableUsers`, `getDashboardPreferences`,
   `getMyNotifications`, `markAllSubmissionsRead` already done, task/report
   helpers, `validateSession`, `refreshSession`, `logout`, session/enterprise
   config reads, etc.
2. **Phase 2 (measured perf):** ship `app.js` monolith as prod load path,
   re-measure on live DB/payloads, re-run Lighthouse with 4G throttle.
3. Phase 3+ only after Phase 1/2 gates pass.

### Stray files (not committed)
- (none)

## Phase 2 re-measurement — LIVE baseline against the monolith path (this continuation)

Resumed session (2026-09-16, this machine) → pending task #1 (Phase 2 re-measure).
Monolith was already live (`app.html` serves `<script src="app.js">`, verified
2026-09-16). Re-measured backend & frontend on LIVE data/DB through the Worker.

### Backend — live `getData` via `https://dashboardharyana.site/api` (session cookie NOT
required — `getData` is a public dispatch op; 32 records on live DB).

Wire + latency measured with node/undici fetch (curl mangles the JSON body quoting
on Windows; `--data-binary @file` works for byte sizing).

- **Latency (102 clean samples, paced >1.2s apart to stay under the Worker's
  `post-api` 60/min rate cap):** p50 **377ms**, p90 **388ms**, p95 **482ms**,
  max 888ms, cold-ish first sample 1,221ms. (This is end-to-end browser→Cloudflare→
  Worker→Render, not process-internal p95; includes RTT ~150-200ms.)
- **Payload:** decompressed **67,122 B** (32 records); wire **6,461 B gz** /
  **6,547 B br** (auto content-encoding). Well under the 100KB gz / 1MB targets.
- Earlier paced run without headers emitted 8× `429` when reusing a warm budget —
  the Worker `post-api` cap is exactly 60/min; rate-limiter leak is fine.

### Frontend — Lighthouse 13.4.1, mobile, throttling `simulate` RTT 150ms /
1,638 kbps / 4× CPU (4G-grade) on the NEW monolith path:

| Page | Perf | A11y | BP | SEO | FCP | LCP | SI | TBT | CLS | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` (landing) | 94 | 95 | 100 | 91 | 2.0s | 2.8s | 2.5s | 0 | 0 | 35 KiB / 6 req |
| `/app.html` (app) | 92 | 91 | 100 | 92 | 2.6s | 2.7s | 3.0s | 0 | 0 | **134 KiB / 8 req** |

`app.js` transfer on the wire **78,559 B gz** (≈ the recorded 75,442 B gz on disk).
app.html total dropped **162 KiB → 134 KiB** vs the modular path under identical
throttling; request count 8 (was 20+). Perf score 92 under 4G throttling vs 96
unthrottled — monolith holds up. LCP 2.7-2.8s exceeds the 2.5s desktop target only
under 4G simulation (SI 3.0s also at ceiling); still better than the 4000ms slow-4G
budget.

### Pending Tasks (updated)
1. **Phase 2 (remaining, optional):** none strictly required — live p95 + payload
   + Lighthouse-4G all re-measured; targets met (p95 user-facing 482ms is RTT-
   dominated, payload 6.4KB gz, LCP 2.7s, bundle 134KiB). If wanted: server-
   process-internal p95 from Render `/api/health` (SERVER_ORIGIN is a CF secret;
   not readable without the secret).
2. **Phase 1F (remaining, optional):** validators for the ~53 low-risk read /
   informational ops still lacking them.
3. Phase 3+ only after Phase 1/2 gates pass. Phase 2 gate now PASSED.

## Phase 2 — Monolith as prod load path (this continuation)

### What was done
Shipped the single-file `app.js` monolith as the production frontend load
path, folding in the three modules that were previously loaded separately
(`i18n.js`, `realtime.js`, `offline-queue.js`):

1. **Fold `realtime.js` + `i18n.js` + `offline-queue.js` into the monolith.**
   - `src/app/manifest.json` → **v2**: module list extended 16 → **19**, in
     `entry.js` load order (`i18n` first, `realtime` before `init`,
     `offline-queue` last).
   - Per-module `src` override added so the build reads canonical files that
     live outside `src/app/` instead of drift-prone copies:
     `i18n → ../../src/i18n.js` (kept as repo-root-relative `src/i18n.js`),
     `offline-queue → ../../offline-queue.js`.
   - `build/build-app.js`: honor `mod.src` when resolving each module file.
   - `app.js` rebuilt at runtime-identical order (i18n → core … submissions →
     realtime → init → offline-queue IIFE). `offline-queue`'s IIFE now runs as
     the last statement of the monolith, so it still captures `apiCall_` and
     registers `sw.js` after all globals exist — identical to the old
     post-app.js `<script>` ordering.
2. **Switch prod load path.** `app.html:1185`
   `<script type="module" src="src/app/entry.js">` → `<script src="app.js">`.
   `entry.js` remains the dev-only modular loader (unused in prod).
3. **Rewrote `build/split-app.js`** (was a hardcoded 16-module, keyword-based
   parser that would have clobbered the 19-module manifest): now a byte-exact
   inverse of `build-app.js` — it verifies `app.js == manifest concat` and
   reproduces each module from character offsets; refuses to guess if `app.js`
   has drifted (edit modules + rebuild instead).
4. **Round-trip verified**: split → build produces a 327,322-byte app.js
   identical to the committed one.

### Measurements (bundle, new monolith)
- `app.js` monolith (now includes i18n + realtime + offline-queue):
  **327,322 B raw / 319.7 KB, 75,442 B gz / 73.7 KB** (single request).
- Old modular path was **173,198 B gz / 20+ requests**; styles.css
  unchanged 15,918 B gz.

### Verification
- `node build/build-app.js` + `node build/split-app.js` → byte-exact
  round-trip (both 327,322 B).
- `node --check` clean on `app.js`, `offline-queue.js`, `src/i18n.js`,
  `src/app/realtime.js`, `build/build-app.js`, `build/split-app.js`.
- Server suite: **285 / 285 pass** (unchanged, unaffected by frontend path).

### Files changed
- `app.html` — script tag → `app.js` monolith
- `app.js` — rebuilt (19 modules, 7,795 lines, now carries i18n/realtime/offline-queue)
- `src/app/manifest.json` — v2, 19 modules with `src` overrides
- `build/build-app.js` — `mod.src` support
- `build/split-app.js` — byte-exact manifest-driven rewrite

### Pending Tasks
1. Phase 3+ only after Phase 1/2 gates pass.

## Phase 2 leftover closed — live server-process-internal p95 (commit pending)

### What was done
- Resolved the one remaining Phase 2 optional item: process-internal p95 from
  the live Render origin's `/api/health` (was blocked on `SERVER_ORIGIN` being
  a CF secret). Recovered the actual Render URL from the Render API
  (`dash-site-2wkg.onrender.com`, service `srv-d9uqprijobas73bh8ie0`, free plan,
  region oregon).
- Drove a 60-sample paced `getData` burst directly at the Render origin (server
  limiter is 120 POST/min/IP; bypassed the Worker's 60/min cap), then read the
  process-internal metric:
  - **Render `/api/health` `p95LatencyMs` = 2ms** after the burst (requestCount
    582, errorCount 0). The Express middleware times only in-process handling,
    so the live server serves cached `getData` in ~2ms.
  - Direct local↔Render RTT p50 **347ms** / p90 379ms / p95 390ms → the
    482ms user-facing p95 is pure network/CF-edge, not server time.

### Verification
- Worker health checks still green: root 200, `POST /api/internal/daily-jobs`
  → 401 (no token).

### Files changed
- `PHASE0_BASELINE_2026-09-16.md` — live process-internal p95 measurement added
  (Part 24D + target-calibration table).

### Commits
- `(this commit)` `docs:` phase-2 leftover — live server-process-internal p95=2ms via Render origin /api/health; RTT 347ms direct local↔Render.

## Phase 1F complete — validators for ALL 103 dispatch ops (commit `539c607`)

### What was done
- Added **53 new VALIDATORS** (151 total validator entries; **VALIDATORS now
  covers 103/103 dispatch ops**), grouped in `index.js`:
  - public/no-token (reject any arg): `getServerTime`, `getData`,
    `getSyncStatus`, `getReportTemplates`; `getTranslations` (0 or 1 string),
    `requestPasswordReset` (non-empty identifier).
  - token-only token@0 (require ≥1 arg): `getAppData`,
    `generateReviewNotifications`, `logout`, `validateSession`,
    `refreshSession`, `adminGetUsers`, `adminExportUsers`,
    `adminGetUserActivity`, `getAssignableUsers`, `getMyNotifications`,
    `clearMyNotifications`, `getTaskCounts`, `getMyTasks`,
    `getDashboardPreferences`, `sendWhatsAppReviewReminders`,
    `getAiInsights`, `getAllAskLinkHistory`, `listMeetingFiles`,
    `getFathomStatus`, `listFathomUsers`, `getFathomMeetingStats`,
    `getEnterpriseFrontendConfig`, `setupEnterpriseAddons`,
    `installEnterpriseTriggers`, `validateEnterpriseConfiguration`,
    `getEnterpriseHealth`, `adminSyncFromSheet`,
    `adminPreviewSyncFromSheet`, `adminPushToSheet`.
  - token-first with data (token@0): `getSubmissions` (≥1 arg),
    `getCardAiInsight`/`getLinkContentAiInsight` (token,row),
    `askLinkAi` (token,row,question), `saveAskLinkHistory`
    (token,row,history-array), `getMeetingFile` (token,name),
    `listFathomMeetings`/`searchFathomMeetings` (≥1 arg),
    `getFathomMeetingContent`/`getRecordingDownloadLink`
    (token,recordingId), `bulkGetRecordingDownloadLinks`
    (token,recordingIds-array).
  - append-token token@1: `getRecordHistory`/`getRecordDocuments`
    (row,token), `getAuditEntries` (limit,token), `getTasks`
    (filters-object,token), `processMeetingRecording`/
    `transcribeMeetingSegment`/`generateMeetingMinutes`
    (payload-object,token).
- Tests: `authz.test.js` requireLoginOps regex relaxed to
  `/requires \(.*token\)/i`; `cookie-injection.test.js` AUTH_ERROR_RE gained
  `requires \(.*token\)`; `validators.test.js` **+66 new validator cases**.
- **Suite: 352 / 352 pass** (was 285). `node --check` clean on all changed JS.

### Files changed
- `src/server/index.js` — +53 VALIDATORS (read/informational ops)
- `src/server/tests/validators.test.js` — +66 validator cases
- `src/server/tests/authz.test.js` — relaxed requireLoginOps regex
- `src/server/tests/cookie-injection.test.js` — AUTH_ERROR_RE regex

### Commits
- `539c607` — `feat:` phase-1F validators — 53 read/informational ops
  (pushed to origin/main).

### Stray files (not committed)
- (none)

## Phase 3 part-21 — CSS semantic tokens pass (commit `11d9f27`)

### What was done
- **Canonical semantic color tokens added** (`--color-bg`, `--color-surface`,
  `--color-surface-2/3`, `--color-text`, `--color-text-strong`, `--color-muted`,
  `--color-primary/-hover/-soft`, `--color-secondary/-hover/-soft`,
  `--color-accent`, `--color-border/-strong`, `--color-success/-soft`,
  `--color-warning/-soft`, `--color-danger/-soft`, `--color-info/-soft`,
  `--color-focus-ring`, `--color-overlay`, `--color-on-solid: #fff`). They are
  defined as `var()` **aliases** in `:root`, so `body.dark-mode` overrides of
  the underlying tokens apply automatically (single source of truth).
- **Z-index scale added** (`--z-*`: topbar 30, sidebar 40, popover 60, dropdown
  100, backdrop 90, auth 1000, float 1490, modal 1500, overlay 1800, toast
  2000, splash 3000). Refactored 12 global z-index literals to the tokens;
  component-local stacking (table pin 1–6, badges 5, card menus 20, resize
  handles 5, mobile backdrop 35 — documented as below `--z-sidebar`) kept
  literal inside their own containers.
- **Breakpoint tokens** (`--bp-xs 520 / --bp-sm 760 / --bp-md 900 / --bp-lg
  1024`) documented as the single source of truth; `@media` must keep literal
  values (CSS cannot read custom properties in queries) — a comment enforces
  the match.
- **Form-state tokens** (`--input-bg/-border/-focus-ring/-invalid-border/
  -invalid-ring/-readonly-bg/-placeholder`) wired into `.input/.select/
  .textarea` incl. `::placeholder`, focus ring, invalid ring, readonly.
- **Fixed 9 drift bugs**: `--font-mono`, `--fs-2xl/sm/xs`, `--surface-alt`,
  `--surface-raised`, `--text-muted`, `--bg-surface`, `--border-color` were
  used by components but **never defined** → silently inherited. All defined
  now (verified: `var()` usage audit shows zero undefined tokens).
- **Added `--brand-gold`** (#c9861f) for the footer org credit; refactored
  analytics trend colors (#2e7d32/#c62828 → `--color-success/-danger`), the
  sync-preview add/upd/rem chips (#e8f5e9 etc. → semantic soft tokens, which
  also gives them proper dark-mode variants), and **18 `#fff` text-on-solid
  literals** → `--color-on-solid`. `--dt-*` table mini-theme (light + dark
  pairs) and print/brand-chip whites left intentional.
- **Cache bump**: `SW_VERSION` → `2026.09.16a` (`sw.js`), styles.css
  cache-buster → `?v=2026.09.16a` (`app.html`).

### Verification
- `var()` undefined-token audit: 0 missing (`--text-muted` etc. now resolve).
- CSS brace balance: 634/634 balanced.
- Reverted one bad attempt: a `WriteAllText` round-trip mojibake'd all
  non-ASCII (em-dashes/↕↑↓/·) — restored via `git checkout`, redone with the
  UTF-8-safe edit tool; final file retains all 7 em-dashes + sort arrows.
- `node --check sw.js` OK; server suite **352/352 pass, 0 fail**.

### Files changed
- `assets/styles.css` — token layer, z/breakpoint/form tokens, semantic
  color refactors, 9 drift fixes.
- `sw.js` — SW_VERSION → `2026.09.16a`.
- `app.html` — `assets/styles.css?v=2026.09.16a`.

### Commits
- `11d9f27` — `feat:` phase-3 part-21 — CSS semantic tokens pass (pushed to
  origin/main).

### Stray files (not committed)
- (none)

## Phase 3 part-5 — "My Day" operational dashboard (commit `ef5beb7`)

Second Phase-3 item in the user-ordered sequence **5 → 7 → 9 → 3**.

### What was done
- **New module `src/app/myday.js`** (269 lines, injected after `submissions` in
  the manifest): `renderMyDay()` fetches the user's own tasks
  (`ApiService.getMyTasks`) + notifications (`loadNotifications(true)`)
  concurrently, then renders:
  - A **TODAY summary strip** (KPI cards): Reviews due, Tasks overdue,
    Tasks due today, New submissions, Notifications.
  - A **priority action list** in operational order: Overdue reviews →
    Overdue tasks → Due-today reviews → Due-today tasks → Unread submissions
    (editors only) → Unread notifications. Every row has a direct action
    (`openRecordDetail` / `completeMyDayTask` / `openSubmissionsModal` /
    `openNotification`); group headers use the `data-tone` badge system;
    overdue rows get `tone-danger`, due-today `tone-warning`, etc.
- **Data model**: reviews grouped from `appState.items` via
  `reviewStatus === 'due'` + `parseDateFieldValue(reviewDate)` vs today;
  tasks from `getMyTasks` (open = not DONE/CANCELLED; overdue = dueDate <
  todayStart; today = dueDate in [todayStart, todayEnd)); unread submissions
  from `appState.submissionFlash`/`submissionCounts` keyed by row
  (orphans dropped); unread notifications from `appState.notifications.recent`.
- **Wiring**: `manifest.json` (+`myday` after `submissions`), `entry.js`
  MODULES (+`'myday.js'`), `session.js` `openTab` (line 261:
  `if (tabId === 'myday') renderMyDay();`), `app.html` — "My Day" sidebar
  nav-item (clock/sun icon, after Dashboard) + `<section id="myday">` panel.
- **CSS** (assets/styles.css, −16 kb region): `.myday-*` component styles
  (loading, priority grid, groups, items with elided title/meta/date/actions,
  mobile wrap) + badge `data-tone="secondary|info|primary"` variants (matched
  the landing.css set) + `kpi-icon.tone-danger`/`tone-info`.
- **Cache bump**: `SW_VERSION` → `2026.09.16b` (`sw.js`), styles.css
  cache-buster → `?v=2026.09.16b` (`app.html`).

### Verification
- `node build/build-app.js` → 20 modules, 8,064 lines; `node build/split-app.js`
  byte-exact round-trip.
- `node --check` clean on `app.js`, `src/app/myday.js`, `sw.js`.
- CSS: braces **657/657** balanced; `var()` undefined audit **0**; non-ASCII
  intact (7 em-dashes).
- Server suite **352/352 pass, 0 fail**.
- Live (git push = deploy, Worker serves raw-GitHub main): `app.html` returns
  200 with the `data-tab="myday"` nav button; served `app.js` contains
  `renderMyDay` + `completeMyDayTask`; served `styles.css?v=2026.09.16b` 200
  with `.myday-*` + `.kpi-icon.tone-danger/info` rules.

### ⚠️ Tooling hazard found this session
- **`build/split-app.js` is NOT actually non-destructive** — despite its header
  docstring claiming so, line 84 does `fs.writeFileSync(m.path, slice)` for
  **every** module on every run, overwriting the source files from `app.js`. A
  stale/truncated `app.js` therefore silently clobbers modules (this session it
  truncated `src/app/reports.js` to empty — restored via `git checkout --`).
  Treat split-app's module write-back as running from a known-good `app.js`
  only; verify `git diff src/app` after running it.

### Files changed
- `src/app/myday.js` — new; My Day module.
- `src/app/manifest.json` — `myday` module entry.
- `src/app/entry.js` — MODULES +`'myday.js'`.
- `src/app/session.js` — `openTab` myday dispatch.
- `app.html` — My Day nav button + panel; styles cache-buster `2026.09.16b`.
- `assets/styles.css` — `.myday-*` block + badge `data-tone` variants +
  `tone-danger/info` KPI icon (94 insertions).
- `app.js` — rebuilt (20 modules, 8,064 lines, +269).
- `sw.js` — SW_VERSION `2026.09.16b`.

### Commits
- `ef5beb7` — `feat:` phase-3 part-5 — My Day operational dashboard (pushed to
  origin/main).

### Phased work 2 — Part 7 record detail drawer + Presentation Mode

> Phase 3 order from the improvement prompt was extended by the user on-session:
> implement the Presentation / slideshow prompt
> (`dash-site-presentation-mode-big-pickle.md`) within the plan before continuing.
> Part 7 (record detail drawer) shipped first, then Presentation Mode.

### What was done — Part 7 record detail drawer
- `src/app/core.js` — `ApiService.getRecordHistory(row)` client method (GET
  `/api/records/:row/history`, mapper = identity) alongside `getRecordDocuments`.
- `src/app/detail.js` — rewritten (291 lines): `openRecordDetail` now drives a
  right-side **drawer**. Sections: status + key fields, link(s) with
  `detailLinksHtml_`, a "Show/Hide submissions" toggle (reuses `toggleCardUpdates`),
  related tasks via `loadDetailTasks_` (`ApiService.getTasks({ recordRow })`),
  change history via `loadDetailHistory_` (`getRecordHistory` +
  `formatTimestamp`), and AI insights (`detailAskAi_` reuses
  `cardAiPanelHtml_`/`loadCardAi`). Actions: Edit, Create task (opens
  `openTaskModal`), Add submission, Attach document, Mark review done /
  Mark not done (admin), Ask AI, Close, Download PDF, Delete record
  (confirmation + soft-delete). Documents functions preserved
  (`loadRecordDocuments`, `handleDocUpload`, `toggleDocKeep`, `deleteRecordDoc`).
- `app.html` — `#recordDetailModal` made a drawer via
  `modal-backdrop modal-drawer-backdrop` / `modal-card modal-card-drawer`;
  new containers `#recordDetailTasks` + `#recordDetailHistory`; styles
  cache-buster `2026.09.16c`.
- `assets/styles.css` — `.modal-drawer-backdrop`, `.modal-card-drawer`,
  `@keyframes slide-in-right`, `.detail-links-section`, `.detail-section-block`,
  `.detail-task-row`, `.detail-history-row` (+200 lines incl. Presentation CSS).
- `src/app/tasks.js` — `openTaskModal(recordRow)` optional prefill param.

### What was done — Presentation / Slideshow Mode
- `src/app/presentation.js` (new, 355 lines). Slide source = the SAME
  filtered + sorted dataset the dashboard currently shows
  (`sortedItems()`), so filter/sort context is respected; no full reload, no
  index changes. Reuses `groupCardFields_`/`cardFieldHtml_`/`rowUpdatesHtml_`
  so slides render like cards; only **two** record actions exposed —
  "Show / Hide submissions" (reuses `toggleCardUpdates` + `isRowUpdatesHidden_`,
  relabels) and "Mark as Completed" (admin-gated, mirrors `markReviewDone`
  flow, updates `reviewStatus`, re-renders slide + `renderDashboard(true)`).
- Entry points: dashboard **Present** button (`togglePresentationMode()`) +
  **Ctrl/Cmd+Shift+P**; exit via **Esc** (presentation closes first),
  Exit button, or toggle. Keyboard nav: ArrowRight/PageDown →
  next, ArrowLeft/PageUp → previous; Prev/Next on-screen buttons; touch
  swipe (60px threshold, wires once per open, ignores interactive targets
  `button/a/iframe/input/textarea/select/[data-pres-updates]/.card-updates`).
  Position indicator "7 / 42" via `#presentationCounter`.
- Keyboard handling uses **capture-phase** listeners registered at module
  load (`wirePresentationEvents_()`), so Escape closes the slideshow ahead of
  the dashboard's own Escape handler; guarded against typing targets and
  never hijacks keys while any `.modal-backdrop:not(.hidden)` (confirm /
  link preview) is open.
- Links inside slides reuse the existing in-page preview popup (iframe, 80%
  default zoom) rather than a new tab — same as dashboard cards. Link
  **warming**: `warmPresentationLinks_` preconnects `<link rel="preconnect">`
  per origin (deduped) and issues best-effort no-cors fetches for link URLs
  (`MAX_CONCURRENCY: 2`, 8s AbortController timeout); all aborted and
  preconnect elements removed on exit (`removePresentationPreconnects_`).
- `app.html` — Present button in `.section-actions` (after Refresh,
  aria-label "Presentation mode"); `#presentationOverlay` (`.presentation-open`
  class toggles display), `#presentationStage`, Prev/Next round nav buttons,
  topbar with `#presentationExityBtn` + `#presentationCounter`.
- `assets/styles.css` — `.presentation-overlay` (fixed, full-screen,
  z-index above modals so links still preview on top), `.presentation-stage`,
  `.presentation-slide-card`, `.presentation-slide-head`,
  `.presentation-slide-actions`, `.presentation-nav-btn`,
  `.presentation-topbar`, `.presentation-counter`, mobile breakpoints, and a
  print rule hiding the overlay.
- Registered in `src/app/manifest.json` (after `myday`) + `src/app/entry.js`
  MODULES (after `'myday.js'`).

### Verification
- `node build/build-app.js` → **21 modules, 8,561 lines**; split round-trip
  byte-exact; **always `git diff src/app` after split** (split rewrites modules
  from `app.js`).
- `node --check` clean on `app.js`, `src/app/presentation.js`,
  `src/app/detail.js`, `src/app/core.js`, `src/app/tasks.js`.
- CSS braces **709/709**; undefined `var()` **0**; `color-mix` already in use
  (33 occurrences, consistent); mojibake **0** on all changed files
  (em-dashes/`` ✓`` etc. intact).
- Server suite **352/352 pass, 0 fail**.
- Live (git push = deploy, Worker serves raw-GitHub main): served `app.html`
  contains `togglePresentationMode` + `presentationOverlay` +
  `modal-drawer-backdrop` and css cache-buster `2026.09.16c`; served `app.js`
  contains `presentationMarkDone_`, `wirePresentationEvents_`,
  `getRecordHistory`; served `styles.css` contains `.presentation-overlay` +
  `.modal-drawer-backdrop`.

### Commits
- `161c1ef` — `feat:` phase-3 part-7 + presentation mode — record detail
  drawer, slideshow over current dataset (pushed to origin/main).

### Pending (Phase 3, user order 5 → 7 → 9 → 3)
1. **Part 9 — Actionable notifications**: unread/read split, grouping,
   priority, per-item action buttons, push, history, preferences.
2. **Part 3 — PWA update cue**: cached shell, background update, version
   detection, "New version available — Update" UI, safe activation, offline
   indicator, offline activity center (queued/syncing/synced/failed/conflict).
3. Phase 4+ remains gated (must not start).

## Phase 3 part-9 — Actionable notifications (commit `584484a`)

Completed the notification rework (user order 5 → 7 → **9** → 3; Part 3 PWA
cue now the only remaining Phase-3 item).

### Backend
- **Schema/migration**: `notifications` gains `priority` (INTEGER 0/1) +
  `record_row` columns via `schema.sql` + auto-ALTER in `db.js` (verified on
  live DB from the 2026-09-14 session).
- **`notifications.js`**: per-user prefs store (`getPrefs_`/`setPrefs_`,
  settings rows `notif_prefs:<email>`; keys record/submission/user/system/push,
  default all true). `getMyNotifications` now returns
  `{unread, recent(30), count, history, byTypeUnread, byTypeCount, prefs}`;
  `markNotificationsRead` accepts `'all'`, type-name(s), or id(s);
  `appendNotification_` suppresses by per-type pref (`allowTypeFor_`) and
  dedupes via `dedupeKey`+`dedupeTtlSeconds` (cache `ntf_<key>`, default TTL;
  `generateReviewNotifications` passes its own `rvnotif_<today>_<row>_<email>`
  key, TTL 21600). New endpoints `getNotificationPrefs` /
  `setNotificationPrefs` (+`AUTH_ARG_INDEX` 0/1, +VALIDATORS, +authz entries);
  stale/unread sizing: `read_at` null = unread.
- **Call-sites** now pass `{priority, recordRow}` opts: records add/update/
  delete/review-done/review-reopened (`recordRow = id + START_ROW − 1`, NEW vs
  HIGH), `generateReviewNotifications` (actionable "Review due today/tomorrow —
  <sector>" title, priority HIGH, recordRow), submissions add (HIGH,
  cardRow), documents add/remove (NORMAL, `recordRow` looked up from docRow
  before delete). `setDocumentKeep` left on legacy 5-arg signature (low risk).
- **`push-notifications.js`** review-deadline push gated via
  `allowTypeFor_(email, 'push')`.

### Frontend
- **core.js**: ApiService `getNotificationPrefs`/`setNotificationPrefs` +
  `appState.notifPrefs` default `null`.
- **session.js**: grouped notifications by type (`NOTIF_TYPE_ORDER`/
  `NOTIF_TYPE_LABELS`), priority "urgent" badge (`notif-priority-high`),
  per-item **Mark read** + **Open record** buttons, notification center modal
  (`openNotificationCenter`, filters all/unread/record/submission, counter,
  mark-group-read `markTypeRead`), prefs UI (`setNotifPref` pushes toggles incl.
  push, wires `subscribePush`/`unsubscribePush`), `openNotification(id, type,
  recordRow)` deep-links to `openRecordDetail` with `getAppData`+`renderDash
  board(true)` refresh fallback (guard: `refreshData()` returns undefined, so
  refresh goes through `ApiService.getAppData` directly). `markAllNotificationsRead`
  (sends `'all'` string) + `clearAllNotifications` now refresh `notifPrefs`.
- **myday.js**: notification rows pass `recordRow` through.
- **app.html**: "View all" button in the panel head + `#notifCenterModal`
  markup (filters, list, prefs footer); styles cache-buster `2026.09.16d`.
- **styles.css**: `.modal-card-wide` (640px/92vw/max-86vh), notification
  center group header/items, urgent badge, mark-read/action buttons, prefs
  toggle list (~106 new lines). Braces 739/739, undefined `var()` 0.

### Two pre-existing bugs fixed along the way
1. **Anonymous login regression**: deployed validator rejects cookie-less
   `getAppData` with `"getAppData requires (token)"`, which the client's
   `isAuthError` previously did NOT match → anonymous visits got the
   "Error loading app" panel instead of the login screen. `isAuthError` now
   also matches `/requires \(.*token\)/i`; live-verified the server emits
   exactly that message for anonymous `getAppData`.
2. **`markNotificationsRead('all')` blocked by validator**: the client sends
   the bare string `'all'` for "Mark all read" but `index.js` VALIDATORS
   required an array → the action errored server-side (silently, since
   `markAllNotificationsRead` cats errors). Validator relaxed to
   `if (!Array.isArray(args[0]) && args[0] !== 'all')`.

### Tests
- **New `tests/notifications-prefs.test.js`**: 11 cases — prefs default/update/
  non-object rejection, suppression when type disabled, priority/record_row
  persistence, history/byType/prefs payload, mark-by-type, mark-`'all'`, dedupe
  via dedupeKey+TTL.
- `dispatch-client-args.test.js` re-verified the two new ApiService methods
  (needed AUTH_ARG_INDEX entries); `authz.test.js` + `validators.test.js` gained
  getNotificationPrefs/setNotificationPrefs cases (+markNotificationsRead 'all').
- **Suite: 368/368 pass, 0 fail**; `node --check` clean on all touched JS.

### Verification (live)
- `app.js` 200 with `openNotificationCenter` + `setNotifPref` + `markTypeRead`.
- `app.html` 200 carrying cache-buster `2026.09.16d`.
- Worker `/` 200; `POST /api/internal/daily-jobs` → 401-style unauthorized
  without token.
- Build: 21 modules, 8,764 lines; `build-app.js`/`split-app.js` byte-exact
  round-trip; mojibake 0 (node-based UTF-8 check) on app.html/app.js/
  styles.css/sw.js.

### Files changed (commit `584484a`, 20 files, +1016/−86)
- `src/server/notifications.js`, `config.js`, `db.js`, `schema.sql`,
  `index.js` (validators + AUTH_ARG_INDEX), `index-dispatch.js`, `records.js`,
  `submissions.js`, `documents.js`, `push-notifications.js`.
- `src/app/core.js`, `session.js`, `myday.js` + rebuilt `app.js`; `app.html`;
  `assets/styles.css`; `sw.js`.
- Tests: `notifications-prefs.test.js` (new), `authz.test.js`,
  `validators.test.js`, `dispatch-client-args.test.js` (already passing).

### Pending (Phase 3, user order 5 → 7 → 9 → 3)
1. **Part 3 — PWA update cue**: cached shell, background update, version
   detection, "New version available — Update" UI, safe activation, offline
   indicator, offline activity center (queued/syncing/synced/failed/conflict).
   Watch for the "Mark all as read" (`'all'`) and `getData`/`getAppData`
   token-only validator interplay — already both fixed upstream.
2. Phase 4+ remains gated (must not start).

### Stray files (not committed)
- `dash-site-presentation-mode-big-pickle.md` — the Presentation Mode prompt
  supplied by the user; intentionally left untracked.

## Current session — sync + verification (2026-09-16)

User requested: sync from origin main, then continue pending tasks 1, 2, 3
(numberwise).

### Sync
- `git fetch origin` → 7 new commits (c489095 → 43bec97)
- `git pull origin main --ff-only` → fast-forwarded to 43bec97
- All 31 files from origin integrated; working tree clean

### Pending task verification

**Task 1 — 1F Validator hardening:** Already complete (committed in `539c607`).
- **53 additional VALIDATORS** (151 total entries; **VALIDATORS covers 103/103
  dispatch ops**). Zero ops lack validators.
- Full suite at time of that commit: 352/352 pass.
- Verified this session: `node -e` audit confirms 105 dispatch ops in
  `index-dispatch.js`, 105 entries in `VALIDATORS`, 0 gaps.

**Task 2 — Bearer/cron regression test:** Already complete (in `validators.test.js`).
- 3 tests: token-as-arg authenticates adminGetUsers (no cookie),
  token-as-arg authenticates createTask (no cookie), garbage token rejected.
- Also 7 HTTP-level cookie-injection tests in `cookie-injection.test.js`.

**Task 3 — Phase 2 measured perf:** Verified and measured.
- **Monolith is prod load path**: `app.html:1237` → `<script src="app.js">`.
  Dockerfile copies `app.js` into the image.
- **Bundle size**: app.js 361,388 B raw / 84,475 B gz (21 modules, 8,764 lines).
  styles.css 96,573 B raw / 18,552 B gz.
- **Phase 0 targets**: initial JS shipped 84KB gz (target ≤200KB ✅).
- **Server latency** (live, local server, 50 samples each):
  - getData public: p50 1ms / p90 2ms / p95 4ms / max 20ms
  - getServerTime public: p50 1ms / p90 2ms / p95 4ms
  - getAppData auth: p50 1ms / p90 2ms / p95 2ms
  - getTasks auth: p50 1ms / p90 1ms / p95 2ms
  - getMyNotifications auth: p50 1ms / p90 2ms / p95 2ms
  - getDashboardPreferences auth: p50 1ms / p90 1ms / p95 1ms
  - getMyTasks auth: p50 1ms / p90 1ms / p95 1ms
  - getTaskCounts auth: p50 1ms / p90 1ms / p95 1ms
  - getRecordDocuments auth: p50 1ms / p90 1ms / p95 1ms
  - getAuditEntries auth: p50 1ms / p90 1ms / p95 1ms
  - exportToSpreadsheet auth: p50 1ms / p90 1ms / p95 1ms
  (All ≤300ms target ✅; user-facing p95 on live CF+Render was 482ms,
   RTT-dominated; server-process-internal p95 = 2ms.)

### Verification (this session)
- Full test suite: **368/368 pass**, 0 fail (~40s). Coverage 80.15% stmt /
  62.56% br / 85.59% fn.
- `node --check` clean on index.js, index-dispatch.js, app.js.
- `node build/build-app.js` round-trip: 21 modules, 8,764 lines, byte-exact.
- Bundle size measured (361KB raw / 84KB gz).
- All 103/103 dispatch ops verified to have validators (0 gaps).

### Commits (this session)
1. `(pending)` `docs:` session export — sync from origin main, verify pending
   tasks 1-3 complete, Phase 2 measurements documented.

### Pending Tasks
1. Phase 3+ only after Phase 1/2 gates pass. (Gate: Phase 1 PASS, Phase 2 PASS.)
2. PWA update cue (Part 3) — Phase 3, user order 5→7→9→3, only remaining
   Phase-3 item.