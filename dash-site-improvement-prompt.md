DASH-SITE — COMPREHENSIVE IMPROVEMENT PROMPT
===============================================

Project:
India Post Dashboard / dash-site
Repository:
vcharyanaco-tech/dash-site
Default branch:
main

Purpose:
Use this document as a master implementation brief for improving the existing Dash-site project. The goal is NOT to rebuild the application from scratch. Preserve the existing functionality and architecture where practical, while making the product faster, cleaner, safer, more coherent, easier to use, and more maintainable.

IMPORTANT OPERATING RULES
--------------------------
1. First inspect the ENTIRE repository before making architectural decisions.
2. Treat the existing implementation as production software. Do not blindly replace working functionality.
3. Identify current behavior, dependencies, API contracts, data formats, deployment assumptions, and legacy compatibility requirements before modifying them.
4. Prefer incremental, testable changes over a wholesale rewrite.
5. Preserve the current India Post / enterprise context and visual identity.
6. Do not remove features merely to simplify the UI. Instead, reorganize and progressively disclose them.
7. Before changing database schema or API contracts, identify all frontend/backend/Worker consumers.
8. Maintain backward compatibility during migrations whenever reasonably possible.
9. Add tests for security-sensitive and data-sensitive changes.
10. After each major change, run/build/test the application and report regressions.
11. Do not expose secrets, passwords, tokens, or private configuration in source control.
12. If a suggestion conflicts with an existing deliberate design constraint, explain the conflict and propose the safest migration path.
13. Measured defect or confirmed user need beats documented opinion. If repository evidence contradicts any statement in this document, evidence wins.
14. The per-change checklist in "Definition of Shippable" (Part 24) applies to EVERY change, including small ones, before it may be committed.

============================================================
PART 0 — MEASURABLE TARGETS / EXIT CRITERIA (PRELIMINARY)
============================================================

These budgets are provisional. Until the Phase 0 baseline (Part 24) produces real
numbers, treat them as forcing functions for explicit decisions — not sacred
numbers. Calibrate each against measured values.

Load / performance (warm start; mid-range Android / slow 4G unless noted):
- TTI < 2000ms
- LCP < 2500ms desktop / < 4000ms slow 4G
- First-load JS shipped <= 200KB gzipped (initial-render needs only)
- First dashboard API payload <= 100KB gzipped — only data for the visible view
- No single API response > 1MB without pagination or date windowing
- p95 backend API latency < 300ms (AI calls excluded)
- Initial-load network request count lower than the Phase 0 baseline

Quality / security gates:
- Any change keeps all existing features working (verify; do not assume)
- Lighthouse mobile: performance >= 85, accessibility >= 90
- Zero secrets/tokens/passwords: scripts/secret-scan.cjs green and wired into CI
- All P0/P1 authorization test scenarios (Part 18) green

CURRENT ARCHITECTURE OBSERVED
-----------------------------
The repository appears to be a mature internal operations platform containing:

Frontend:
- Vanilla HTML/CSS/JavaScript
- SPA-style dashboard
- Responsive UI
- Dark mode
- PWA/service worker
- Offline behavior/queue
- Search/filtering
- Records
- Tasks
- Submissions
- Documents
- Notifications
- Reports/analytics
- Audit functionality
- AI functionality
- Meeting/transcription-related functionality
- Fathom-related integration
- Internationalization

Backend:
- Node.js / Express
- SQLite / better-sqlite3
- Session authentication
- Role-based permissions
- Users/groups
- Records
- Tasks
- Submissions
- Notifications
- Documents
- Audit and audit archive
- Record-change history
- AI cache
- Sessions
- Login throttling
- Settings
- Deduplication

Infrastructure:
- Cloudflare Worker
- Static frontend delivery
- Node backend routing
- Rate limiting
- Security headers
- Scheduled keep-alive behavior
- GitHub-hosted source/static delivery
- PWA caching

DATABASE AREAS OBSERVED
-----------------------
The schema includes:
- records
- users
- submissions
- tasks
- notifications
- audit
- audit_archive
- documents
- sessions
- login_attempts
- settings
- ai_cache
- dedupe
- ask_ai_history
- record_changes

The records table currently preserves a physical "row" concept from the former spreadsheet/GAS system. Treat this as a migration/legacy compatibility concern rather than automatically removing it.

REPOSITORY FACTS ALREADY CONFIRMED (do not re-build these)
---------------------------------------------------------
- `scripts/secret-scan.cjs` already exists — the CI item is "wire it in", not "build one".
- Browser-storage auth token confirmed (`setAuthToken`/`getAuthToken` in app.js) and
  `BOOTSTRAP_ADMIN_PASSWORD` confirmed in src/server/auth.js — Part 1 P0 items are real defects.
- RPC-style dispatcher confirmed (`apiCall_('login', ...)` pattern) — resource-oriented API
  migration is a demoted, evidence-gated backlog item (Phase 5).

============================================================
PART 1 — SECURITY HARDENING
============================================================

A. REMOVE DEFAULT ADMIN CREDENTIALS FROM SOURCE
-----------------------------------------------
There is currently a default admin password defined in configuration/source code.

This must be eliminated.

Desired direction:
- Move bootstrap credentials to deployment secrets/environment variables, OR
- implement a one-time first-run admin setup flow.
- After first successful bootstrap, disable bootstrap credentials.
- Never commit a real/default password to Git.
- Search the entire repository for:
  - passwords
  - API keys
  - tokens
  - secrets
  - private keys
  - hard-coded credentials
  - webhook secrets

Wire the existing `scripts/secret-scan.cjs` into CI so obvious credentials fail the pipeline.

B. REVIEW AUTHENTICATION TOKEN STORAGE
---------------------------------------
The frontend currently has a named browser-storage auth-token mechanism.

Investigate moving authentication toward:
- Secure
- HttpOnly
- SameSite
- appropriate expiration
cookies.

Goals:
- reduce XSS token theft risk
- centralize session handling
- preserve session expiration
- preserve logout/revocation
- preserve role enforcement

If migration is disruptive, implement a staged transition.

C. AUTHORIZATION AUDIT
----------------------
Audit every backend dispatcher/API operation.

For every operation determine:
1. Is authentication required?
2. Which roles can call it?
3. Are object-level permissions required?
4. Can a viewer modify data indirectly?
5. Can a user access another user's documents/tasks/submissions?
6. Can IDs/row numbers be manipulated to access unauthorized records?
7. Can exports expose information beyond the user's role?
8. Are admin-only operations protected server-side rather than merely hidden in the UI?

Never rely on UI hiding for authorization.

D. INPUT VALIDATION
-------------------
Audit all inputs:
- record IDs
- row IDs
- email addresses
- URLs
- file names
- MIME types
- file sizes
- text fields
- task fields
- dates
- report parameters
- AI prompts
- meeting inputs

Use explicit validation and safe normalization.

E. FILE UPLOAD SECURITY
-----------------------
Review:
- MIME validation
- extension validation
- maximum size
- filename sanitization
- path traversal
- storage isolation
- download authorization
- content-disposition headers
- executable file handling
- malicious document concerns

File keys should never allow arbitrary filesystem paths.

F. RATE LIMITING
----------------
The Worker already has per-IP limits.

Review whether:
- login endpoints need stricter limits
- password reset needs strict limits
- AI endpoints need user/account quotas in addition to IP quotas
- authenticated abuse should be limited by account
- rate-limit storage should work across multiple Worker isolates if stronger guarantees are required

Do not remove existing protections without a replacement.

============================================================
PART 2 — PERFORMANCE
============================================================

A. MEASURE BEFORE OPTIMIZING
----------------------------
Create a baseline for:
- first contentful paint
- largest contentful paint
- time to interactive
- JS download size
- JS parse/execute time
- CSS size
- initial API payload size
- initial API latency
- SQLite query latency
- dashboard render time
- memory usage
- network request count

Test:
- desktop
- mid-range Android
- slow 4G
- cold start
- warm start
- offline/poor network

B. REDUCE INITIAL DATA LOAD
---------------------------
The application appears to have a broad application data API.

Investigate whether initial loading fetches too much:
- records
- analytics
- tasks
- notifications
- submissions
- preferences
- reports
- secondary metadata
- AI-related data

Move toward progressive loading.

Recommended sequence:
1. Render application shell.
2. Render critical dashboard metrics.
3. Load visible/current records.
4. Load tasks/notifications.
5. Load analytics.
6. Load secondary/admin data on demand.

Do not make users wait for unrelated modules before seeing the dashboard.

C. CODE SPLITTING / MODULEIZATION
---------------------------------

STATUS: DEMOTED — architecture backlog (Phase 5). Start only if a measured problem
cannot be solved within the current architecture. Do not modularize for its own sake.

The frontend has accumulated a large amount of logic.

Do NOT rewrite blindly.

Instead:
- split code into logical ES modules
- separate state
- API services
- UI components
- views
- utilities
- feature modules
- authentication
- notifications
- PWA/offline logic

Suggested conceptual structure:

app/
  core/
  state/
  services/
  components/
  views/
  features/
  utils/

Potential feature modules:
- records
- tasks
- submissions
- documents
- notifications
- reports
- audit
- users
- AI
- meetings

Use a build process to generate optimized production bundles if appropriate.

D. NETWORK REQUEST OPTIMIZATION
-------------------------------
Audit:
- duplicate API calls
- sequential calls that could be parallel
- requests triggered multiple times by render cycles
- redundant polling
- excessive refreshes
- oversized JSON responses

Introduce:
- request deduplication
- caching for safe read-only data
- background refresh
- pagination
- incremental loading
- optimistic UI where safe

E. SQLITE PERFORMANCE
---------------------
Profile real queries.

Use:
- EXPLAIN QUERY PLAN
- appropriate indexes
- prepared statements
- pagination
- bounded result sets

Audit queries for:
- records
- tasks
- notifications
- submissions
- audit logs
- documents
- reports
- AI history

Do not add indexes blindly; measure write/read tradeoffs.

F. DATABASE PAYLOAD DESIGN
--------------------------
Avoid returning huge datasets where only a small subset is visible.

Use:
- pagination
- date windows
- server-side filters
- summaries/counts
- selective fields

============================================================
PART 3 — PWA / OFFLINE / UPDATE EXPERIENCE
============================================================

The current service worker uses network-first behavior for core application files to prevent stale deployments.

Preserve this intent.

STATUS: update-UX block in Phase 2; offline sync visibility in Phase 4 (gated).

Improve it with:
- cached shell for instant startup
- background update
- version detection
- "New version available — Update" UI
- safe service-worker activation
- offline status indicator
- clear offline/online transitions

Ensure:
- API responses are not accidentally served stale
- mutations queued offline are visibly represented
- failed queued mutations can be retried
- conflicts are understandable
- users cannot accidentally believe an offline mutation has permanently synced

Consider an offline activity center:
- queued
- syncing
- synced
- failed
- conflict

============================================================
PART 4 — INFORMATION ARCHITECTURE / UX
============================================================

CORE DESIGN PRINCIPLE
---------------------
The dashboard should answer:

"What do I need to do now?"

rather than:

"What features does the application have?"

Do not remove existing features. Reorganize them.

Suggested navigation:

OVERVIEW
- Dashboard
- My Day / My Work
- My Tasks

WORK
- Records
- Submissions
- Tasks
- Documents

INSIGHTS
- Reports
- Analytics
- AI / Copilot

ADMIN
- Users
- Audit
- Settings

Use role-based visibility.

============================================================
PART 5 — "MY DAY" DASHBOARD
============================================================

Create a user-centric daily summary.

STATUS: Phase 3 — in scope. Ship regardless of other phases.

Example:

TODAY
- 3 reviews due
- 2 tasks overdue
- 4 new submissions
- 1 approval waiting
- 2 notifications

Then a priority list:
- overdue items
- due today
- approvals
- unread submissions
- important notifications

Every item should have a direct action:
- Open record
- Complete task
- Review submission
- Approve
- View document

The dashboard should feel like an operational assistant.

============================================================
PART 6 — GLOBAL SEARCH / COMMAND PALETTE
============================================================

Upgrade global search into a command/search palette.

STATUS: Phase 4 (gated) — start only if a confirmed user need or Phase 3 feedback justifies it.

Trigger:
- search icon
- Ctrl/Cmd + K on desktop
- suitable mobile interaction

Search across:
- records
- tasks
- users
- submissions
- documents

Also expose actions:
- Create record
- Create task
- Open reports
- Generate report
- Navigate to settings

Include:
- recent items
- keyboard navigation
- clear categories
- fast result rendering

Avoid requiring users to know where a feature lives.

============================================================
PART 7 — RECORD EXPERIENCE
============================================================

Introduce a record detail drawer/panel where appropriate.

STATUS: Phase 3 — in scope.

A record should expose in one context:
- title/description
- status
- entry date
- review date
- responsibility
- links
- documents
- submissions
- tasks
- history
- AI insights

Actions:
- Edit
- Create task
- Add submission
- Attach document
- Mark review done
- Ask AI

Keep users in context instead of constantly navigating away.

============================================================
PART 8 — TASK MANAGEMENT
============================================================

Tasks already have:
- assignee
- status
- priority
- due date
- creator
- completion timestamps
- record relationship

Build this into a stronger workflow system.

STATUS: Phase 4 (gated) — only the pieces users actually ask for (overdue highlighting, My Tasks). Kanban/calendar/dependencies are optional; do not build speculatively.

Views:
1. My Tasks
2. All Tasks
3. Kanban
4. Calendar/timeline if useful

Kanban columns can be:
- Open
- In Progress
- Waiting
- Done

Add:
- overdue highlighting
- due today
- due this week
- delegation
- task activity/history
- reminders
- optional recurring tasks
- optional dependencies

Do not over-engineer if users don't need these features.

============================================================
PART 9 — NOTIFICATIONS
============================================================

Make notifications actionable.

STATUS: Phase 3 — in scope.

Bad:
"Review reminder"

Better:
"Review due tomorrow — Directorate A"
[Open record]

Notifications should link directly to the relevant object.

Support:
- unread/read
- grouping
- priority
- action buttons
- push notifications
- notification history
- notification preferences

Avoid notification spam.

============================================================
PART 10 — AI / COPILOT
============================================================

The project already contains several AI-related capabilities.

Unify them into a contextual "Dashboard Copilot" concept.

STATUS: Phase 4 (gated) — consolidation, quotas, and permission-aware retrieval first; the Copilot product concept only if justified.

Potential capabilities:
- What needs my attention today?
- Summarize this record.
- Summarize recent submissions.
- Explain changes since last review.
- Identify overdue work.
- Prepare a weekly report.
- Draft meeting minutes.
- Create tasks from meeting notes.
- Analyze linked documents.
- Answer questions about a record.

Important:
- AI output must be clearly labeled as AI-generated.
- Do not let AI silently mutate important records.
- Require confirmation for consequential actions.
- Log important AI-triggered actions.
- Apply user authorization to AI data access.
- Avoid exposing data to AI that the user could not otherwise access.
- Add quotas/rate limits.
- Cache expensive/repeatable analyses where safe.

The AI should reduce work, not become another menu full of buttons.

============================================================
PART 11 — VISUAL / LOOK AND FEEL
============================================================

Do NOT turn this into a flashy consumer SaaS product.

Target:
"Modern enterprise operations platform with India Post identity."

Characteristics:
- restrained
- professional
- highly readable
- information-dense
- clear hierarchy
- excellent accessibility
- subtle motion
- minimal decoration

Preserve the India Post red/blue identity where appropriate.

Improve:
- typography hierarchy
- spacing consistency
- card density
- status indicators
- button hierarchy
- empty states
- loading states
- error states
- hover/focus states

Avoid:
- excessive rounded cards
- excessive shadows
- excessive gradients
- unnecessary animation
- visual clutter

Prefer:
- 8–12px radii where appropriate
- subtle borders
- restrained shadows
- consistent spacing tokens
- strong typography hierarchy

============================================================
PART 12 — ACCESSIBILITY
============================================================

Audit WCAG-oriented basics:
- keyboard navigation
- focus visibility
- semantic HTML
- labels
- form errors
- contrast
- screen reader names
- dialog focus trapping
- Escape behavior
- reduced motion
- color-independent status indicators

Do not use color alone to communicate:
- overdue
- completed
- priority
- errors
- permissions

============================================================
PART 13 — MOBILE EXPERIENCE
============================================================

Treat mobile as a first-class product.

STATUS: Phase 4 (gated). Do not let mobile work block Phase 3 UX items; a Phase 3 feature on a responsive page beats a full mobile redesign.

Do not simply collapse the desktop layout.

Consider:
- compact top bar
- bottom navigation
- large touch targets
- swipe-friendly cards/drawers where useful
- mobile record drawer
- mobile task views
- simplified filters
- sticky action bar

Potential mobile navigation:

Home | Tasks | + | Notifications | More

Do usability testing at phone widths.

============================================================
PART 14 — API ARCHITECTURE
============================================================

The current RPC/dispatcher model may be retained for compatibility.

STATUS: DEMOTED — architecture backlog (Phase 5). Do not migrate without measured justification or a concrete consumer need.

However, gradually move toward resource-oriented APIs where practical.

Examples:

GET    /api/records
POST   /api/records
PATCH  /api/records/:id
DELETE /api/records/:id

GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/:id

GET    /api/notifications

Benefits:
- easier caching
- better debugging
- clearer authorization
- easier testing
- easier future mobile apps
- better observability

Do this incrementally.
Do NOT break existing clients without a migration plan.

============================================================
PART 15 — LEGACY SPREADSHEET ROW MODEL
============================================================

The records schema retains a physical spreadsheet row concept.

Do not immediately remove it.

STATUS: DEMOTED — architecture backlog (Phase 5). Keep the row field until a consumer actually stops depending on it.

Instead consider:
- stable internal record UUID/ID
- legacy_sheet_row field for compatibility
- migrate application logic away from physical row semantics
- eventually remove row dependence when safe

Goal:
the domain model should represent business records, not spreadsheet mechanics.

============================================================
PART 16 — CLOUDflare WORKER / INFRASTRUCTURE
============================================================

The Worker currently handles:
- routing
- CORS/security headers
- rate limiting
- API forwarding
- static routing
- enterprise routes
- scheduled keep-alive behavior

Keep genuinely edge-specific responsibilities at the Worker.

Avoid putting business logic into the Worker unless there is a strong reason.

Prefer:
Cloudflare
  -> static frontend

Cloudflare
  -> API
      -> Node
          -> SQLite

Review:
- CORS
- security headers
- rate limits
- cold starts
- Worker memory behavior
- failure handling
- origin timeouts
- retry behavior

Do not introduce infinite retry loops.

============================================================
PART 17 — OBSERVABILITY / SYSTEM HEALTH
============================================================

Build a small admin System Health view.

Display:
- backend status
- database status
- Worker status if detectable
- last backup
- backup age
- database size
- uptime
- memory
- recent errors
- API latency
- AI status
- notification status

The existing health endpoint is a useful foundation.

Also add structured logs where practical.

Metrics worth tracking:
- request count
- error rate
- p95 latency
- cold starts
- database errors
- backup failures
- AI failures
- notification failures
- authentication failures
- rate-limit events

============================================================
PART 18 — TESTING
============================================================

Expand automated tests.

Security tests:
- unauthorized access
- role bypass
- object-level authorization
- expired session
- invalid session
- login throttling
- password reset
- file access

API tests:
- CRUD
- validation
- pagination
- filtering
- permissions

Database tests:
- migrations
- constraints
- indexes/query behavior
- backup/restore

Frontend tests:
- login
- dashboard rendering
- record editing
- task creation
- notification interactions
- offline queue
- permission-based UI

End-to-end:
- viewer workflow
- editor workflow
- admin workflow

============================================================
PART 19 — CI/CD
============================================================

Create a production checklist in CI.

Before deploy:
- syntax/build check
- tests
- security scan
- secret scan
- dependency audit
- migration validation
- frontend bundle size check
- optional Lighthouse/performance budget

Set sensible thresholds, but don't make CI so brittle that normal development becomes painful.

============================================================
PART 20 — DEVELOPMENT ARCHITECTURE
============================================================

The project should become easier to maintain without requiring a framework migration.

STATUS: DEMOTED — architecture backlog (Phase 5). The structures below are examples, not mandates; do not mechanically create folders.

Recommended conceptual frontend structure:

src/
  app/
    bootstrap
    state
    router
  components/
    buttons
    dialogs
    tables
    drawers
    notifications
  features/
    records
    tasks
    submissions
    documents
    reports
    audit
    users
    ai
  services/
    api
    auth
    notifications
    offline
  utils/

Backend:

src/server/
  routes/
  services/
  repositories/
  middleware/
  auth/
  jobs/
  db/

Do not mechanically create folders. Move code when it improves ownership and testability.

============================================================
PART 21 — VISUAL DESIGN SYSTEM
============================================================

Create/maintain a single source of truth for:
- colors
- typography
- spacing
- radius
- shadows
- z-index
- transitions
- breakpoints
- form states

Define semantic tokens:
--color-bg
--color-surface
--color-text
--color-muted
--color-primary
--color-danger
--color-warning
--color-success
--color-info

Ensure dark mode uses semantic tokens rather than scattered overrides.

============================================================
PART 22 — EXECUTION PLAN (evidence-gated; the only source of order)
============================================================

Single rule: a phase does not start until the previous phase's gates pass, and no
phase starts on the strength of this document alone.

PHASE 0 — BASELINE & INSPECTION (mandatory, first)
Goal: produce Part 24 deliverables (architecture map, current-state findings, risk
list, performance baseline, UX findings); wire the existing scripts/secret-scan.cjs
into CI; confirm or refute every assumption in this document.
Gate: baseline reviewed; Part 0 targets calibrated against real numbers; at least one
p95 latency, one Lighthouse run, and one bundle-size measurement recorded.

PHASE 1 — P0 SECURITY (immediate)
- Remove BOOTSTRAP_ADMIN_PASSWORD -> env var / one-time first-run setup (Part 1A).
- Auth-cookie migration assessment + staged plan (Part 1B).
- Authorization audit with tests for every role and object-level check (Part 1C).
- Input validation + file upload/access audit (Part 1D/E).
Deliverables: security and authz test suite green; secret scan green; migration plan written.
Gate: all P0 authz tests green; no authorization relies on UI hiding.

PHASE 2 — MEASURED PERFORMANCE (only what the baseline justifies)
- Close the gap between Phase 0 numbers and Part 0 targets (initial payload, loading
  order, request dedup, query/index work, PWA update UX).
Hard stop: if the baseline already meets targets, do not refactor for its own sake.

PHASE 3 — HIGH-YIELD UX (independent of Phase 2 results)
- My Day dashboard (Part 5), record detail drawer (Part 7), actionable
  notifications (Part 9), PWA "new version available" cue (Part 3).

PHASE 4 — GATED PRODUCT WORK (start only on evidence or confirmed user need)
- Command palette (Part 6), task views incl. Kanban (Part 8), offline sync
  visibility (Part 3), AI consolidation / Copilot (Part 10), accessibility and mobile
  fill-in (Parts 12-13).
- Each item is independent; kill any item that does not pay for itself.

PHASE 5 — ARCHITECTURE BACKLOG (explicitly demoted; NOT a commitment)
- Moduleization (Part 2C), resource-oriented API migration (Part 14), spreadsheet-row
  decoupling (Part 15), folder restructuring (Part 20).
- Start ONLY if a measured problem cannot be solved inside the current architecture,
  or a concrete user need requires it. Weigh each as a token; none is automatic.

PRIORITY WEIGHTS (reference only — the phase ordering above wins)
- P0 / immediate     = Phase 1 items
- P1 / high          = Phase 3 items + Phase 2 items backed by baseline evidence
- P2 / medium        = Phase 4 items
- P3 / longer term   = Phase 5 items

============================================================
PART 24 — HOW TO IMPLEMENT THIS
============================================================

Before coding:
1. Inspect every major directory/file.
2. Build a dependency map.
3. Identify all entry points.
4. Identify frontend/backend contracts.
5. Identify deployment configuration.
6. Identify tests.
7. Identify unused/dead code.
8. Identify duplicated logic.
9. Identify security-sensitive code.
10. Establish baseline performance.

Then produce:
A. Architecture map
B. Current-state findings
C. Risk list
D. Performance findings
E. UX findings
F. Feature opportunities
G. Refactoring plan
H. Implementation plan
I. Test plan

Then implement in small stages.

DEFINITION OF SHIPPABLE — applies to EVERY change, including small ones, before it
may be committed. For every change provide:
- files changed
- why changed
- behavior changed
- migration impact
- tests run
- performance impact
- rollback considerations

After each change: run the build/tests/lint, re-check the deploy surface, and report
regressions (if any). A change is "done" only when verified.

============================================================
PART 25 — IMPORTANT PRODUCT PRINCIPLE
============================================================

Do NOT turn the dashboard into a feature showcase.

The desired experience is:

LOGIN
  ↓
"What needs my attention?"
  ↓
Priority items
  ↓
One-click action
  ↓
Contextual record/task/submission
  ↓
Complete work
  ↓
System updates notifications/audit/history
  ↓
Return to next priority

The product should feel like an operational command center, not a collection of disconnected admin pages.

============================================================
FINAL INSTRUCTION TO THE IMPLEMENTING AI
============================================================

Act as a senior full-stack engineer, product designer, UX researcher, security engineer, and performance engineer working on the existing Dash-site repository.

Do NOT blindly follow this document if repository evidence contradicts an assumption. Inspect the code first.

Do NOT rebuild from scratch unless a specific component is demonstrably beyond repair.

Prioritize:
1. Security
2. Reliability
3. Performance
4. Usability
5. Accessibility
6. Maintainability
7. Feature expansion

Preserve working behavior.

When proposing changes, distinguish:
- confirmed repository facts
- measured problems
- inferred risks
- design recommendations

Do not claim an improvement is complete unless it has actually been implemented and tested.

The end state should be a fast, polished, secure, mobile-friendly, enterprise-grade India Post operations dashboard that retains the current capabilities while making them dramatically easier to discover and use.
