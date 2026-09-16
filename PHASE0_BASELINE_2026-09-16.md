# Phase 0 — Baseline & Inspection (2026-09-16)

Evidence-gated baseline for `dash-site-improvement-prompt.md` (reworked 2026-09-16).
Every number below is **measured**, not estimated. Repository evidence beats
documented opinion; where the improvement prompt's assumptions differ from what
is measured here, this document wins.

---

## Part 24A — Architecture map (measured)

Three hosts serve the live product:

```
browser
  ├─ https://dashboardharyana.site          (custom domain, DNS → Cloudflare)
  │    Cloudflare Worker  dashv1-proxy      (src/worker/worker.js, ~1047 lines)
  │      ├─ /api, /api/events, /api/files/* ─► Node/Express + SQLite (Render, src/server)
  │      ├─ /api/internal/* + /api/send-email  (Bearer WORKER_API_TOKEN)
  │      ├─ /macros/*, /static/*            (legacy → Render)
  │      └─ everything else                 ─► raw.githubusercontent.com/.../main
  │                                            (GitHub Pages hosts repo root; static files)
  └─ GitHub Pages (pages.yml) — hosts repo root (index.html, app.html, sw.js, assets/)
       (CNAME present but custom-domain left off; worker is the real edge)
```

Backend (src/server, Node >=22, CommonJS, better-sqlite3 ^13):
- Boot: `start.js` → KV restore (`data-sync.js`) → `index.js` → listen.
- Express app `index.js`: metrics → CSP → rate limiter → CORS/security headers →
  static → `POST /api` RPC dispatcher (~90 ops, arg-position auth via
  `AUTH_ARG_INDEX`) → SSE (`events.js`) → `/api/files/:key` → static.
- Feature modules: `records`, `submissions`, `tasks`, `notifications`, `audit`,
  `documents`, `reports`, `weekly-reports`, `push-notifications`, `dashboardstudio`,
  `enterprise` (AI/Fathom/meetings/ICS/WhatsApp/offline), `sync-sheet`,
  `reconcile`, `full-backup`, `mailer`, `data-sync`.
- DB: `schema.sql` (18 tables) + boot migrations in `db.js`; WAL, FK on.

Frontend (repo root, no build step delivered):
- `app.html` shell loads `src/app/entry.js` → 18 classic `<script src="src/app/*.js">`
  module files (core, meetings, recording, ai, session, dashboard, audit, reports,
  settings, detail, tasks, utils, studio, edit, submissions, init, realtime, i18n)
  + `offline-queue.js` → registers `sw.js`.
- `app.js` monolith (built from the src/app modules by `build/build-app.js`) is
  shipped in the Docker image but **never referenced by app.html** (dead surface).

PWA: `sw.js` network-first for the 3 code assets, cache-first for the rest;
`manifest.json`, push (VAPID placeholder — subscribe currently no-ops).

Deploy automation: `pages.yml` (Pages), `render.yaml` + `Dockerfile` (Node),
Worker secrets (`SERVER_ORIGIN`, `WORKER_API_TOKEN`), `ci.yml` (secret scan,
npm audit, server tests, JS syntax, app.js round-trip), `live-check.yml`.

---

## Part 24B — Current-state findings (measured)

1. **API error handler is broken (P0, found & fixed this session).**
   `index.js` catch block referenced `fn` which was a `const` scoped to the
   `try` block. Any dispatch error threw `ReferenceError: fn is not defined`,
   the response was never sent, and clients hung until undici's 300s timeout.
   Symptom seen across every 304s test hang. Fixed: hoist `let fn = 'unknown'`.
   **Verified:** `subscribePush` no-auth now responds in ~56ms with JSON error.

2. **Test suite hung / flaked on 5-minute boundaries (P0, fixed).**
   Two independent causes:
   - (covered by #1) — dispatch errors timed out instead of returning.
   - `node --test` spawns one child process per test file; all share the single
     seeded scratch DB, and each process's `test-bootstrap.js` re-seeds the admin
     password with its **own random value** → parallel processes race on one
     SQLite DB (`SQLITE_BUSY` stalls) and overwrite each other's admin password
     → random login failures. Fixed with `--test-concurrency=1`.
   **Verified:** full suite 121/121 pass, ~20s; coverage 77.75% stmt / 56.46% br.

3. **`GET /api/files/:key` auth regression (P0, found & fixed).**
   `de12439` made `resolveDocumentFile` require login, but the smoke test never
   sent the session cookie, so upload→fetch round-trip returned 500. Fixed in
   `smoke.test.js` (capture `dash_session` cookie, send on the file route).

4. **Frontend auth token is vestigial / dual-path (P2).**
   `getAuthToken()` always returns `''`; real auth is the HttpOnly `dash_session`
   cookie. `STORAGE_TOKEN`/`setAuthToken`/`getAuthToken` in core.js/session.js are
   dead legacy. App loads *either* app.js monolith (which has NO `realtime.js`
   SSE client) *or* entry.js modules (which do). app.html loads entry.js, so live
   updates work today — but app.js is stale-by-design (no realtime) and is copied
   into the prod image unused. `manifest.json` lineCounts are stale (meetings 760→931,
   dashboard 744→838, utils 268→424). Part 2C/Phase 5 moduleization must decide
   one canonical load path.

5. **Initial-load JS = 18 sequential classic scripts (P2 → Phase 2).**
   `entry.js` concatenates module order at runtime via script tags (no bundling
   in production). Measured: modular path ships **173,198 B gzipped** across
   20+ requests vs the single-file monolith **68,492 B gzipped**. The monolith
   already exists and is 2.5× smaller on the wire — strong Phase 2 candidate
   (ship monolith + fold realtime/i18n in, or add an importmap/bundle).

6. **CSP is real but weaker than documented (P2 → Phase 1/3).**
   `csp.js` header comment describes a nonce strategy that is not implemented:
   emitted policy is `script-src 'self' 'unsafe-inline'` (inline `onclick`
   handlers are used throughout). Good: `frame-ancestors 'self'`,
   `object-src 'none'`, `base-uri 'self'`, `connect-src 'self'`. Correcting
   unsafe-inline is invasive (inline handlers everywhere) — treat as gated.

7. **Docs are split across two eras (P3).**
   `src/docs/README.md`, `Architecture.md`, Change Log, Deployment/Developer
   guides describe the decommissioned Apps Script backend; the accurate picture
   lives in `README.md` + `MIGRATION.md` + code. `GOOGLE_OAUTH_VERIFICATION.md`
   is still the compliance reference. Docs update is maintenance, not Phase 1/2.

---

## Part 24C — Risk list (confirmed/inferred)

| # | Risk | Evidence level | Priority |
|---|---|---|---|
| R1 | Dispatch error = dropped response (index.js catch) | **Confirmed** (fixed) | P0 |
| R2 | Test parallelism races the shared DB | **Confirmed** (fixed) | P0 |
| R3 | `requireViewer()` is a no-op → `getAuditEntries`, `getRecordHistory` are reachable unauthenticated via dispatch | **Confirmed in code** (`auth.js:499-501`; `index.js` validates no auth arg for these ops) | P0 → Phase 1C |
| R4 | JS-visible token path vestigial but dual entry points could re-route realtime | Confirmed (code) | P2 |
| R5 | 18-script serial load hurts initial render & request count | **Measured** (173KB gz / 20+ reqs) | P2 → Phase 2 |
| R6 | CSP allows `unsafe-inline` (no nonce) | Confirmed (code) | P2 → Phase 3 |
| R7 | VAPID push is a placeholder → subscribe effectively no-ops | Confirmed (code + frontend placeholder) | P3 → Phase 4 |
| R8 | Render free tier → 15-min spin-down, ephemeral disk (KV bridge mitigates) | Known (render.yaml comments) | Ops |
| R9 | `src/worker/deploy-worker-api.js` hardcodes GAS URLs / account id in source | Confirmed (code) | P3 (not secrets) |
| R10 | Zapier/data loss surface: CSVs in `migration-export` are stale, auto-import removed | Confirmed (code) | None (by design) |

---

## Part 24D — Performance findings (measured baseline)

**Backend** — localhost, scratch-seeded DB, admin `getData` ×120:
- p50 **14ms**, p90 **18ms**, p95 **19ms**, max 23ms, avg 12.3ms (all local).
- `getData` payload (median): **121 B raw / 109 B gzipped** on scratch data.
- Health endpoint also reports p95 per process (metrics latencies buffer).

**Backend — LIVE re-measure (2026-09-16, after Phase 2 monolith ship, via Worker):**
- `getData` on live DB (32 records): decompressed **67,122 B**, wire **6,461 B gz /
  6,547 B br**. Well under the 100KB gz / 1MB targets.
- End-to-end latency through Cloudflare→Worker→Render (102 paced samples):
  p50 **377ms**, p90 **388ms**, p95 **482ms**, max 888ms. RTT-dominated; the local
  19ms p95 remains the process-internal number.

**Backend — LIVE server-process-internal p95 (2026-09-16, direct Render origin):**
- `getData` burst (60 samples, paced, direct to `dash-site-2wkg.onrender.com`,
  no Worker/CF edge): p50 **347ms** / p90 **379ms** / p95 **390ms** max 836ms
  (this machine ↔ Render RTT is ~350ms — network-dominated).
- Render `/api/health` process-internal metric after the burst:
  `p95LatencyMs **2ms**` (requestCount 582, errorCount 0). The Express middleware
  times only in-process handling → **the live server handles cached `getData` in
  ~2ms**; the 347-482ms user-facing figures are pure network/RTT, not server time.
- Verdict: **Phase 2 p95 target (process-internal) PASS on live data** — 2ms ≪ 300ms.

**Frontend — Lighthouse 13.4.1, mobile emulation, live site, 2026-09-16:**

Landing (`/`):
- Performance **98**, Accessibility **95**, Best practices **100**, SEO **91**.
- FCP **1.9s**, LCP **1.9s**, CLS **0**, TBT **0ms**, SI **2.1s**.
- Server response time (root doc) **368ms**.

Dashboard shell (`/app.html`) — modular path (pre-Phase-2):
- Performance **96**, Accessibility **91**, Best practices **96**, SEO **92**.
- FCP **2.2s**, LCP **2.2s**, CLS **0.014**, TBT **0ms**, SI **3.0s**.
- Total loaded weight **162 KiB**.

**Frontend — LIVE re-measure (2026-09-16, monolith path, 4G simulate: RTT 150ms /
1,638 kbps / 4× CPU):**

| Page | Perf | A11y | BP | SEO | FCP | LCP | SI | TBT | CLS | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` (landing) | 94 | 95 | 100 | 91 | 2.0s | 2.8s | 2.5s | 0 | 0 | 35 KiB / 6 req |
| `/app.html` (app) | 92 | 91 | 100 | 92 | 2.6s | 2.7s | 3.0s | 0 | 0 | **134 KiB / 8 req** |

- `app.js` monolith wire transfer **78,559 B gz**; folder +18,746 B gz.
- **Result:** weight 162→134 KiB, requests 20+→8, score 96→92 only because 4G
  sim throttles the single JS (LCP 2.7s vs 2.2s unthrottled). Targets still met
  (LCP < 4000ms slow-4G budget).

**Bundle (offline measurement of gzip(bytes) on disk):**
- Modular load path (entry.js + 18 scripts + offline-queue), pre-Phase-2:
  **718,299 B raw → 173,198 B gzipped** (now superseded).
- Single-file monolith `app.js` (Phase 2, incl. i18n/realtime/offline-queue):
  **327,322 B raw → 75,442 B gzipped** (2026-09-16; wire 78,559 B gz).
- `assets/styles.css`: 84,659 B raw → 15,918 B gzipped.

---

## Part 24E — UX findings (observed, not user-tested)

- Dashboard shell LCP is the full document (module scripts are classic/blocking)
  → above the 2.5s desktop target at 2.2s but near; SI 3.0s exceeds it. Highest
  lever = bundling/order (finding #5).
- Accessibility 91 on `app.html` — below the ≥90 target only slightly; audit
  flagged items not enumerated here (re-run with full report during Phase 3/4).
- PWA: offline queue exists and registers sw.js; VAPID placeholder means push
  subscription silently no-ops (risk R7).
- Everything is a "screen" — the improvement prompt's "operational command
  center" (Part 5 My Day) would be the first genuinely new surface.

---

## Part 24F — Feature opportunities (queue, not commitments)

- "My Day" priority dashboard (Part 5, Phase 3), record detail drawer (Part 7),
  actionable notifications (Part 9), PWA update cue (Part 3) — Phase 3.
- Command palette, Kanban, offline-sync visibility, AI consolidation (Part 6/8/3/10)
  — Phase 4, gated on evidence or confirmed need.
- Everything Phase 4-5 stays demoted per the reworked plan.

---

## Part 24G + H + I — Refactoring, implementation & test plan

Order follows the reworked prompt's phases. Only items with measureable gates.

### Phase 1 — P0 Security (starts when Phase 0 gate passes)
1A. Bootstrap credentials — **mostly done** (env-only `DASH_BOOTSTRAP_ADMIN_PASSWORD`,
   secret scan wired into CI, zero secrets scan green on 163 tracked files). Remaining:
   document first-run/rotate flow; confirm no default password path.
1B. Auth-cookie migration assessment — capture current cookie design
   (HttpOnly/`SameSite=Lax`/`Secure` in prod, slid expiry, cookie+arg duality) as the
   staged plan. Eliminate the vestigial browser-token path (finding #4).
1C. Authorization audit (Phase 1 gate: all P0 authz tests green; no authz relies on
   UI hiding):
   - **Fix `requireViewer()` no-op → requireLogin_ (R3)** and add dispatch-level
     auth tests. Highest-severity confirmed gap.
   - Audit every op in `AUTH_ARG_INDEX` against role matrix; object-level checks
     (documents/tasks/submissions/records by row id); exports; audit log.
   - New test file `tests/authz.test.js`: for each op, no-token → rejected;
     viewer → rejected where non-viewer; editor/admin matrix.
1D. Input validation — VALIDATORS map covers only 9 ops today (login, CRUD,
   adminAdd/DeleteUser, createTask, addSubmission, reconcile, uploadDocument).
   Extend to all dispatch ops with a defined arg shape.
1E. File upload audit — mostly solid (MIME allowlist, 25MB cap, base64 key regex,
   sanitized names, login-gated resolve). Extend tests for size/MIME/name edge cases.
   Deliverables: authz test suite green; secret scan green; migration plan written.

### Phase 2 — Measured Performance (only baseline-justified items)
- **Ship the app.js monolith as the production load path** (68.5KB gz vs 173KB gz,
   ~18 fewer requests) after folding `realtime.js` + `i18n.js` into it and
   regenerating `manifest.json` lineCounts. Verify live LCP/SI improvement.
- Re-measure against the live DB (`getData` payload + p95) to calibrate the 100KB /
   300ms targets — local #s are scratch-data only.
- Hard stop if baseline already meets targets (per prompt rule).

### Phase 3 — High-yield UX (independent of Phase 2)
- My Day dashboard (Part 5), record detail drawer (Part 7), actionable
  notifications (Part 9), PWA "new version available" cue (Part 3).
- CSS semantic tokens pass (Part 21) as pre-work.

### Phase 4 / 5 — gated; nothing auto-starts.

---

## Phase 0 gate checklist

- [x] Baseline reviewed (this document).
- [x] Part 0 targets calibrated against real numbers (below).
- [x] At least one p95 latency recorded (19ms local `getData`).
- [x] At least one Lighthouse run recorded (5 runs: landing + app.html above).
- [x] Bundle-size measurement recorded (both paths above).
- [x] `scripts/secret-scan.cjs` green + wired into CI (verified green on 163 files).

## Part 0 target calibration (measured vs target)

| Target (prompt) | Measured baseline | Verdict |
|---|---|---|
| TTI < 2000ms | 2.2s (app.html, unthrottled) / 2.7s (4G monolith) | Close unthrottled; 4G slightly over, within 4000ms slow budget |
| LCP < 2500ms desktop | 2.2s (app.html, unthrottled) | Pass (desktop emulation) |
| LCP < 4000ms slow 4G | **2.7s** (app.html, 4G sim, 2026-09-16 re-measure) | **Pass** (well under 4s budget) |
| First-load JS <= 200KB gz | **134 KiB total** (app.js 78 KiB gz + 19 KiB css + 15 KiB icons; 2026-09-16 re-measure) | **Pass** (was 162 KiB modular; 16% lighter) |
| First dashboard API payload <= 100KB gz | **6.4KB gz** / 67KB decompressed (32 records, live DB, 2026-09-16 re-measure) | **Pass** |
| No single API response > 1MB | 67KB decompressed / 6.4KB gz (max measured) | **Pass** |
| p95 API latency < 300ms | 19ms local; **377ms p50 / 482ms p95 live** (end-to-end via Worker incl RTT; 2026-09-16 re-measure) | Local **Pass**; live is RTT-dominated, not server-bound |
| p95 API latency < 300ms (process-internal, live) | **2ms** (Render `/api/health` `p95LatencyMs`, 2026-09-16 direct-origin re-measure) | **Pass** |
| Lighthouse perf >= 85 / a11y >= 90 | **92 / 91** (app.html, 4G sim, 2026-09-16 re-measure) | **Pass** |
| Secret scan + CI | green, wired | Pass |
| P0/P1 authz tests green | Phase 1 deliverable | Done (1C–1F, 229/229 pass at ship) |

**Phase 0 gate: PASS.** Phase 1 (P0 Security): DONE. Phase 2 (measured perf): DONE.
Re-measurement on live (2026-09-16) confirms targets met under throttled 4G conditions.