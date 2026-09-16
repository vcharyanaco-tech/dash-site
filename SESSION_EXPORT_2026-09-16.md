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

## Verification
- `src/server`: `npm test` → 121/121 pass, 0 fail (~20s).
- `node --check` on all three touched server files → clean.
- Lighthouse + p95 + bundle measurements in baseline doc.
- Secret scan green.

## Commits
1. (this session) `fix:` phase-0 P0: API-error handler dropped responses (fn scoping);
   make test suite deterministic (--test-concurrency=1); smoke-test cookie auth; docs.

## Deployment
- Server change (`src/server/index.js`, run-tests.cjs) → Render auto-deploys.
- `run-tests.cjs`/`smoke.test.js` are CI-only (no prod impact).

## Pending Tasks
1. **Session export / commit review** — confirm and push.
2. **Ask owner to continue in order → Phase 1 — P0 Security:**
   - 1C **fix `requireViewer()` no-op** (auth.js) → `getAuditEntries` /
     `getRecordHistory` unauthenticated via dispatch — top confirmed gap.
   - New `tests/authz.test.js` covering every dispatch op (no-token, viewer,
     editor/admin matrix, object-level checks).
   - 1D extend VALIDATORS to all dispatch ops; 1E file-upload test coverage.
   - 1B auth-cookie migration assessment (kill vestigial browser-token path).
3. Phase 2 (measured perf): ship app.js monolith as prod load path, re-measure on
   live DB/payloads, re-run Lighthouse with 4G throttle.
4. Phase 3+ only after Phase 1/2 gates pass.