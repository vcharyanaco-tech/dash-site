# Session Export — 2026-08-21

## Summary
Major feature additions: real-time updates, security hardening (CSP nonces, rate limiting), UX improvements (keyboard shortcuts, CSV import, mobile responsive), and session management. 9 features implemented, 108/109 tests passing.

## Commit
| Hash | Message |
|------|---------|
| `9796ecc` | feat: add real-time SSE, rate limiting, CSP nonces, keyboard shortcuts, CSV import, mobile responsive |

## Features Implemented

### 1. Sliding Window Rate Limiter (rate-limiter.js)
- Per-IP sliding window: 120 POST/min
- Returns 429 with `Retry-After` header
- Automatic cleanup every 5 minutes
- Disable with `RATE_LIMIT_DISABLED=1` env var

### 2. Server-Sent Events for Real-Time Updates (events.js)
- `GET /api/events` — SSE streaming endpoint
- Broadcasts `dataChanged` on record/submission/task mutations
- Broadcasts `userLoggedIn` on login
- 30s heartbeat to keep connections alive
- Auto-cleanup of disconnected clients

### 3. Session Token Auto-Refresh
- New `refreshSession` dispatch endpoint (auth.js, db.js)
- Client-side `sessionRefreshTick()` runs every 30 minutes
- Silently extends server-side session by 6 hours
- Logs out on failure (expired/invalid session)

### 4. CSP with Per-Request Nonces (csp.js)
- Generates fresh nonce per HTTP request via `crypto.randomBytes`
- Injected into `Content-Security-Policy` header
- Supports `unsafe-hashes` for onclick handlers (legacy compatibility)
- Much more secure than blanket `unsafe-inline`

### 5. Drag-and-Drop CSV Import (settings.js)
- Drop zone in Settings tab (editors+ only)
- Parses CSV with header row detection
- Expected columns: sector, description, entry_date, action, responsibility, review_date
- Server-side `adminImportCsv` endpoint with row-by-row validation
- File input fallback for click-to-browse

### 6. Keyboard Shortcuts (realtime.js)
- `Ctrl+K` — Open search / command palette
- `Ctrl+N` — New record (editor+)
- `Ctrl+R` — Refresh dashboard
- `Ctrl+E` — Toggle card/table view
- `Ctrl+1-6` — Switch tabs (1=Dashboard, 2=Analytics, 3=Audit, 4=Reports, 5=Tasks, 6=Settings)
- `Ctrl+/` — Show keyboard shortcut help
- `?` — Show help (when not in input)
- `Escape` — Close dialogs and panels

### 7. SSE Real-Time Connection (realtime.js)
- Connects to `GET /api/events` via EventSource
- Auto-reconnects on disconnect with exponential backoff (2s → 60s max)
- Triggers `autoRefreshTick()` on `dataChanged` events
- Disconnects on logout

### 8. Mobile Responsive CSS
- Enhanced 760px breakpoint in styles.css
- 2-column KPI grid on mobile
- Single-column dashboard cards
- Scrollable tables with `-webkit-overflow-scrolling: touch`
- Full-screen modals on small screens
- Auth screen adjustments
- Sidebar backdrop for mobile overlay

### 9. Realtime Module Integration
- `realtime.js` added to module load order in entry.js
- `initRealtime()` called after login in loadApp()
- `teardownRealtime()` called on logout
- CSS for drop-zone drag-over state and shortcuts modal

## Files Created
- `src/server/rate-limiter.js` — per-IP sliding window rate limiter
- `src/server/events.js` — SSE broadcast system
- `src/server/csp.js` — nonce-based CSP middleware
- `src/app/realtime.js` — SSE client, session refresh, keyboard shortcuts

## Files Modified
- `src/server/index.js` — integrated rate limiter, CSP middleware, SSE route, broadcast on mutations
- `src/server/index-dispatch.js` — added refreshSession, adminImportCsv endpoints
- `src/server/auth.js` — added refreshSession(), adminImportCsv() functions
- `src/server/db.js` — added refreshSession_() for session extension
- `src/app/core.js` — added refreshSession, adminImportCsv API methods
- `src/app/session.js` — wired initRealtime(), teardownRealtime() into login/logout flow
- `src/app/settings.js` — CSV import drop zone UI and file handler
- `src/app/entry.js` — added realtime.js to module load order
- `assets/styles.css` — enhanced mobile responsive CSS, drop zone styles
- `app.html` — added CSV import card HTML in Settings section

## Test Results
**108/109 tests pass** (1 pre-existing failure: duplicate email in test setup)

## Deployment
- **GitHub**: Pushed to `main` branch (commit `9796ecc`)
- **Render**: `autoDeploy: true` triggers Docker build on push to main
- **GitHub Pages**: `.github/workflows/pages.yml` deploys frontend on push to main

## Server Running
- Port: 8787 (overriding `PORT=0` env var with `PORT=8787`)
- Rate limiting: enabled
- SSE endpoint: `GET /api/events`
- CSP: nonce-based per-request
