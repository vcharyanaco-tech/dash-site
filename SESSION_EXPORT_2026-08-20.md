# Session Export — 2026-08-20

## Summary
Major security hardening, feature additions, and architecture improvements
for the India Post Dashboard. 8 commits pushed to `main`, all 72 tests passing,
both deployment pipelines (Render + GitHub Pages) triggered.

## Commits (newest first)

| Hash | Message |
|------|---------|
| `10d396c` | chore: add build scripts and modular source files for app.js |
| `3d883fe` | refactor: load app modules individually instead of monolithic app.js |
| `1befbaa` | fix: load i18n.js before app.js so Hindi localization works |
| `cfceac8` | test: add E2E tests for push notifications, weekly reports, and i18n |
| `7656363` | chore: rebuild app.js from modular source files |
| `a1da076` | fix: auto-migrate legacy password hashes to scrypt on login |
| `a1decc5` | feat: security hardening, i18n, push notifications, weekly reports, unit tests |

## Changes Implemented

### 1. Password Hashing Upgrade (auth.js, helpers.js)
- **Before**: Custom iterated SHA-256 (500 rounds)
- **After**: `crypto.scrypt` (N=16384, r=8, p=1) with `scrypt$` prefix
- Auto-migration: legacy hashes silently upgraded to scrypt on successful login
- `changePassword()` now awaits `runWithLock_()` (fixed fire-and-forget race condition)
- `resetRequested` set to `''` instead of `null` (NOT NULL constraint fix)

### 2. CORS Restriction (index.js)
- **Before**: `Access-Control-Allow-Origin: *`
- **After**: Only `dashboardharyana.site`, `www.dashboardharyana.site`, `vcharyanaco-tech.github.io`, and localhost

### 3. Content-Security-Policy (index.js)
- Added CSP headers to all Express responses: `default-src 'self'`, `frame-ancestors 'self'`, `object-src 'none'`
- Plus `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`

### 4. Rate Limiting (index.js)
- Sliding-window per-IP rate limiter (120 POST/min) on `/api` POST route
- Returns 429 with `Retry-After` header

### 5. Database Indexes (schema.sql, db.js)
- Added `idx_users_username` partial index for fast `findUserByUsername_()` lookups
- Migration runs on boot for existing databases

### 6. Input Validation Middleware (index.js)
- Validation layer for 10 high-risk API functions: `login`, `addItem`, `updateItem`, `adminAddUser`, `adminDeleteUser`, `createTask`, `addSubmission`, `uploadDocument`
- Catches malformed requests before dispatch

### 7. Unit Tests (tests/unit-helpers.test.js)
- 36 tests covering: password hashing, email validation, HTML escaping, URL safety, summary/analytics builders, CSV parsing, date formatting, report templates
- `--experimental-test-coverage` added to test script (81.75% line coverage)

### 8. Hindi Localization (src/i18n.js, src/server/i18n-server.js)
- Client-side i18n module with 100+ translation keys (EN + HI)
- `t(key)` function, `setLanguage()`, `applyTranslations()` for DOM-wide switching
- Language persisted in localStorage
- Server endpoint serves translation dictionaries
- `<script src="src/i18n.js">` added to app.html before app modules

### 9. Push Notifications (src/server/push-notifications.js, sw.js)
- Server module stores Web Push subscriptions in `push_subscriptions` table
- `subscribePush` / `unsubscribePush` / `sendReviewDeadlinePushNotifications` endpoints
- Service worker handlers: `push` event displays native notification, `notificationclick` focuses/opens tab
- Client-side `subscribeToPushNotifications()` / `unsubscribeFromPushNotifications()` in app.js
- Worker cron triggers daily at 08:05 IST

### 10. Weekly Automated Reports (src/server/weekly-reports.js)
- Generates 7-day activity digest: new records, logins, submissions, review status
- Emails all admin users with period, dashboard health, and activity counters
- Worker cron fires every Monday at 09:05 IST via `weekly-report` job

### 11. i18n Server Endpoint (src/server/i18n-server.js)
- Serves EN + HI translation dictionaries via `getTranslations` dispatch function

### 12. Worker Cron Extensions (src/worker/worker.js)
- Added `weekly-report` job (Monday 09:05 IST)
- Added `review-push-notifications` job (daily 08:05 IST)

### 13. app.js Modularization
- **build/split-app.js**: Splits app.js into 16 modules by section markers
- **build/build-app.js**: Reassembles modules back into app.js (byte-identical round-trip)
- **src/app/*.js**: 16 modular source files:

| Module | Lines | Content |
|--------|-------|---------|
| core.js | 478 | Constants, EventBus, ApiService, state, helpers |
| meetings.js | 760 | AI Meeting Notes, Fathom |
| recording.js | 242 | Live audio recording |
| ai.js | 620 | Per-record AI, link preview |
| session.js | 535 | Auth, theme, sidebar, notifications |
| dashboard.js | 744 | Filters, cards, table, analytics |
| audit.js | 301 | Audit log |
| reports.js | 362 | Reports, email |
| settings.js | 559 | Settings, user management |
| detail.js | 140 | Record detail dialog |
| tasks.js | 285 | Task management |
| utils.js | 268 | Date picker, clock, auto-refresh |
| studio.js | 199 | Dashboard Studio, Command Palette |
| edit.js | 385 | Edit modal, review badge |
| submissions.js | 243 | Submissions modal |
| init.js | 351 | About, offline, push, language toggle |

- app.html now loads 16 individual `<script>` tags instead of monolithic app.js

### 14. E2E Tests (tests/new-endpoints.test.js)
- 20 tests covering: push notification subscribe/unsubscribe, weekly reports, i18n translations, daily-jobs internal endpoint

## Test Results
**72/72 tests pass** (14 smoke + 2 dispatch-client-args + 36 unit + 20 new endpoints)

## Deployment
- **Render**: `autoDeploy: true` in render.yaml triggers Docker build on push to main
- **GitHub Pages**: `.github/workflows/pages.yml` deploys frontend on push to main
- Both pipelines triggered by the push

## Files Modified
- `app.js` — rebuilt from modules
- `app.html` — modular script tags, i18n.js loaded
- `sw.js` — push notification handlers
- `src/server/auth.js` — scrypt migration, changePassword fix
- `src/server/db.js` — username index migration
- `src/server/helpers.js` — scrypt hash functions
- `src/server/index.js` — CORS, CSP, rate limiting, validation, daily-jobs extensions
- `src/server/index-dispatch.js` — new endpoint registrations
- `src/server/package.json` — test coverage flag
- `src/server/schema.sql` — username index
- `src/worker/worker.js` — weekly report + push notification cron jobs

## Files Created
- `build/split-app.js` — app.js splitter
- `build/build-app.js` — app.js reassembler
- `src/app/*.js` — 16 module files + manifest.json
- `src/i18n.js` — client-side i18n module
- `src/server/i18n-server.js` — server translations endpoint
- `src/server/push-notifications.js` — Web Push module
- `src/server/weekly-reports.js` — automated weekly reports
- `src/server/tests/unit-helpers.test.js` — 36 unit tests
- `src/server/tests/new-endpoints.test.js` — 20 E2E tests
