# Session Export — 2026-09-21

Continuation of the 2026-09-20 session. Today delivered a single feature:
records that show submission updates inline on the card (the Show/Hide updates
toggle / `displayed=1` case, e.g. record #2) now expose the **same management
actions the submissions modal already offers** — Edit, Lock/Unlock, Delete, and
the Display-on-card/Hide toggle — rendered as inline buttons on each shown
update block, for editors/admins.

Repo state at start: `origin/main` == `0bbe137` is this session's own commit
(base `9c118d6`, the "editors can delete any submission" feature). Working tree
otherwise clean modulo the two established strays
(`VS tools.code-workspace`, `dash-site-presentation-mode-big-pickle.md`, now
tracked as `b6ab97a`) plus an untracked left-over repro script
(`src/server/repro-view-updates.js`, kept as-is).

---

## feat: inline Edit/Lock/Delete/Display actions on shown submission updates

Committed and pushed as `0bbe137` (6 files, +124/−11 across
`app.js`, `src/app/dashboard.js`, `src/app/submissions.js`,
`src/server/records.js`, `src/server/submissions.js`,
`src/server/tests/submissions-overview-office.test.js`).

### Why

On records whose updates are shown on the card (the toggle case), the listed
updates previously had no management options unless the user opened the
submissions modal — even though editors/admins could manage the same updates
from the modal. The request: give those inline update blocks parity with the
modal (Edit, Lock, Display on card / Hide, Delete).

### Server (`src/server/submissions.js`, `src/server/records.js`)

- `getSubmissionOverview_()` now takes an optional `user` argument. When a user
  is supplied, each entry in the `displayed` array is built through the existing
  `visibleSubmission_()` helper, so it carries the submission `id` plus the
  per-user permission flags (`editable`, `canLock`, `canUnlock`, `locked`,
  `isOwner`, `displayed`, plus `cardRow`, `cardId`, `email`, `office`, `text`,
  `createdAt`).
- **No-user callers keep the old minimal shape** (`{cardRow, email, office,
  text, createdAt}`) — headless tests / legacy callers are unaffected; the
  existing `submissions-overview-office.test.js` passes unchanged.
- Call sites that now pass the caller:
  - `records.js` `getAppData` → `getSubmissionOverview_(user)` (the caller was
    already resolved for item scoping).
  - `submissions.js` `markAllSubmissionsRead` → `getSubmissionOverview_(admin)`.
- `visibleSubmission_` only needs `user.email` + `user.role`, and
  `auth.requireLogin` returns exactly `{email, role}` — so no auth-shape changes
  were needed.

### Client (`src/app/dashboard.js`, `src/app/submissions.js`)

- `rowUpdatesHtml_` (the inline update block used on both the card and record
  detail) now appends `<div class="submission-actions">…</div>` with buttons
  from the new `submissionInlineActionsHtml_(s)` when the user is an editor and
  the entry carries an id:
  - **Edit** — when `s.editable`: `editCardSubmission(cardRow, cardId, id)`.
  - **Unlock / Lock** — `s.canUnlock ? Unlock : s.canLock ? Lock` →
    `unlockSubmission` / `lockSubmission`.
  - **Delete** — always for editors → `deleteSubmission` (editor rights were
    already shipped in `9c118d6`).
  - **Display on card / Hide from card** — admins only →
    `toggleDisplaySubmission`, labelled by `s.displayed`.
  - Every button carries `event.stopPropagation()` so clicking an action doesn't
    open the record detail or flash the card.
- `editCardSubmission(row, cardId, id)` opens the submissions modal for the row
  and sets `appState.pendingInlineEditId`; `openSubmissionsModal` resets it, and
  `loadSubmissions` runs `editSubmission(pendingId)` after the list has loaded
  (so the modal opens already in edit mode, pre-filled). Ordering matters —
  `pendingInlineEditId` is set *after* `openSubmissionsModal` because that
  function clears it.
- `lockSubmission` / `unlockSubmission` now call `renderDashboard(true)` after
  success so the inline Lock↔Unlock button label refreshes immediately (Delete
  and Display already refreshed via `refreshData`).
- `app.js` rebuilt via `node build/build-app.js` (22 modules, 11268 lines);
  round-trip byte-identical via `split-app.js`.

### Server permission rules (unchanged semantics, verified)

- `canEditSubmission_`: ADMIN → always; EDITOR → `!locked || locker !== ADMIN`;
  other roles → owner when not locked. So editors can edit/lock any unlocked
  submission, incl. ones they don't own.
- `toggleSubmissionDisplay` → admin-only; delete → editor (from `9c118d6`).

### Tests

- New regression test in `submissions-overview-office.test.js`:
  "getSubmissionOverview_ displayed entries carry id + per-user flags when a
  user is supplied" — seeds a displayed submission and asserts, for an
  EDITOR caller: `editable === true` (non-owner editor edits any unlocked
  submission), `canLock === true`, `canUnlock === false`, `displayed === true`,
  `isOwner === false`, and that the entry carries the submission `id`.
- Relevant files green: `submissions-overview-office` (2/2),
  `delete-renumber`, `frontend-contract` (10/10 across the three).
- `smoke.test.js` (14/14) passed after removing a leftover
  `markallviewer@example.com` test user from the dev DB (pollution from an
  earlier aborted run — the failure was flagged as the whole file's "adminAddUser
  already exists" chain, pre-existing and unrelated to this change).
- Full suite: **422 tests, 263 pass, 159 fail**. The 159 failing tests are
  pre-existing and unrelated — a clean-baseline comparison (`git stash push` →
  stale baseline run: 421 tests, 262 pass, 159 fail → `stash pop`) proved the
  exact same 159 failures exist without this change. They are caused by the
  in-memory per-process rate limiter (`rate-limiter.js`, `MAX_POST_PER_MIN=120`)
  tripping when the whole suite shares one process (`validators.test.js` reports
  "Too many requests. Please try again in 59 seconds."). Not a regression.

### Local end-to-end verification (headless Chrome via CDP)

A throwaway harness (`verify-inline-actions.cjs`, since removed) copied the dev
DB to a temp dir, reset the admin password hash, inserted a `displayed=1`
submission on row 5, and booted the server with `DASH_DATA_DIR` + `PORT=8787`
(localhost is the only trusted local origin; 127.0.0.1 → 403). Confirmed:

- `getAppData` payload carries the entry with `id`, `editable: true`,
  `canLock: true`, `displayed: true`.
- Row 5 card shows the "Hide updates (3)" toggle, one `.submission-display`
  block, and inline **Edit / Lock / Delete / Hide from card** buttons, each with
  the correct `stopPropagation()` onclick.
- Clicking inline **Edit** opens the submissions modal already in edit mode:
  `editingId` set, button reads "Save changes", text field pre-filled.
- The record **detail dialog** shows the same update block + inline actions.

Scripting notes that cost time: (1) a session established by the login form is a
prerequisite — `ApiService.login()` alone leaves the dashboard empty; the
harness had to invoke the app's own `loadApp()` bootstrap; (2) a global
find/replace of `PASS` clobbered both the log string and a const name mid-edit;
(3) the test assertion must match on `b.text`, not the whole button object.

## Cleanup

- Removed scratch files: `verify-inline-actions.cjs`, `run-tests.cjs`,
  `summary-tests.cjs`, `clean-test-users.cjs`, and the stale
  `markallviewer@example.com` / `flashviewer@example.com` test users from the
  dev DB.
- `src/server/repro-view-updates.js` (untracked leftover) intentionally left
  alone.

## Phase 13 §7 (2026-09-22) — frontend DOM/URL hardening + Worker proxy-error sanitization

Shipped as `b57b60d` ("feat: Phase 13 S7 - frontend DOM/URL hardening + Worker
proxy-error sanitization"), pushed to `origin/main`. Safety gate: 451 tests
pass / 0 fail (441 baseline + 10 new), secret scan OK (200 files), bundle size
OK (498.0 KB raw / 550 KB budget), `node --check` clean.

### What changed

- **HIGH-2 (click-XSS via autolink)** — `core.js`: new `linkableHref(value)`
  scheme allowlist (`https:`, `http:`, `mailto:`, `tel:` + bare `www.` and
  domain-style hosts, which get an `https://` prefix). `renderLinkableText`
  now renders scriptable schemes (previously `javascript:alert(1)//.com`
  became a working `href` via the `.tld` heuristic) as inert escaped text.
  This one helper covers Reports preview cells, dashboard table action cells,
  and Audit rows.
- **HIGH-1 (stored, trigger-free)** — `myday.js`: My Day item `subtitle`
  (record `description`/`action`, truncated) is now `escapeHtml`'d in
  `myDayItemHtml_` instead of raw into `innerHTML` (an `<img onerror=…>`
  payload executed for any logged-in user opening My Day).
- **Raw link-url sinks gated** through `linkableHref`: record detail links
  (`detail.js`), report print links (`reports.js`), Fathom meeting URL
  (`meetings.js`), divisional dashboard links (`settings.js`) — unsafe
  schemes render as plain text instead of a clickable `href`.
- **`ai.js`**: `openLinkPreview` gates the URL at entry (blocks `window.open`
  fallback, preview iframe src, and the modal "open in new tab" href);
  `wireEmbeddedLinkPreview` now `preventDefault`s clicks on any non-http(s) /
  non-mailto / non-tel scheme so scriptable-scheme anchor navigation can't
  execute.
- **Worker**: last-resort proxy-500 no longer echoes the upstream exception
  message to clients (`'Proxy error: upstream request failed'`; detail stays
  in `console.error`) — mirrors the S6 `sanitizeApiError_` decision.
- Tests: `src/server/tests/frontend-xss-hardening.test.js` (10 tests) extracts
  `escapeHtml`/`escAttr`/`linkableHref`/`renderLinkableText` from the rebuilt
  bundle with a string-/regex-/template-aware brace balancer and VM-executes
  the payload + allowlist behavior, plus static contracts on every sink.
  `frontend-contract.test.js` window.open needle updated for the gated `safe`.
- `app.js` rebuilt from `src/app/*` via `node build/build-app.js` (22 modules,
  11310 lines).

### Intentionally changed behavior (call out to users if noticed)

- `ftp://` URLs in record text no longer render as links (were already
  excluded server-side by `absUrl_`'s `https?:|mailto:|tel:` allowlist).
- Non-scheme domain-lookalike text without `www.` (e.g. `example.com`) now
  linkifies to `https://…` instead of a broken relative href.
- Clicks on a stored `javascript:`/`data:`/etc. anchor are now blocked
  (preventDefault) instead of executing.

### Carried-forward open LOW items (from §6, still open)

1. Static-deny middleware could shrink to an asset-extension whitelist.
2. Attachment safe-inline MIME list could narrow to images+pdf (product call).
3. `sendReviewDeadlinePushNotifications` / `getAuditEntries` viewer exposure →
   admin/editor-only decision (needs `authz.test.js` updates).
4. `getDataForUser` caches nothing; optional per-viewer cache TTL later.
5. Worker synthetic headers banner-removal line (`routeBannerRemoval_`) and
   the `script-src 'unsafe-inline'` legacy directive in the Worker CSP are
   low-risk leftovers; could be revisited in a later slice.

## Phase 3 Part 5-increment (2026-09-22) — My Day cold-boot data-ready guard

Shipped as `68ab970` ("feat: Phase 13 Part 5 - My Day cold-boot data-ready
guard"), pushed to `origin/main`; HEAD in sync. Gates: **461 pass / 0 fail**
(11 test files, incl. new `myday-guard.test.js`), secret scan OK (202 files),
bundle size OK. `app.js` rebuilt (22 modules, 11344 lines) via
`node build/build-app.js`; `node build/split-app.js` round-trip verified
**byte-identical** (22/22).

### What changed

My Day renders reviews/submissions/overdue-work counts from
records reviews/submissions from `appState.items`, which starts empty and is
only filled after the first getAppData resolves; `appState.lastUpdated`
stays `''` on a cold boot). A user can land on My Day via the `goto-myday`
command, a PWA shortcut, or a deep link **before** that first refresh lands
— painting the summary then would show a false **"All clear"** that hides
overdue work.

- `renderMyDay()`: after loading own tasks + notifications, bails to a
  `waitForMyDayData_(panel)` hold **if `!appState.lastUpdated`** instead of
  painting from an empty `items[]`. The hold renders a quiet "Preparing your
  day…" spinner state — never a timer, never a guessed count.
- `waitForMyDayData_()`: **one-shot** — subscribes `EventBus.on('DataRefreshed',
  retry)`, and on the first signal runs `EventBus.off('DataRefreshed', retry)`
  then re-enters `renderMyDay()`. It detaches itself so a later refresh that is
  also in flight never hot-replaces My Day underneath the user; re-renders the
  moment the first data lands so the guard cannot deadlock (no polling).
- Records fed from `appState.items` (`buildMyDayData_`), reviews tracked via
  `.reviewStatus === 'due'` + `.reviewDate`, submissions/unreads from the
  records array — never the narrower own-tasks list, so My Day under-counts
  nothing for records other users maintain.
- Failure path preserved: the original "Could not load your day" / "Please try
  again later" empty state is untouched (no regression; the guard is *before*
  the paint, not a replacement of it).

### Files

`src/app/myday.js` (+guard in `renderMyDay` + `waitForMyDayData_`), `app.js`
(rebuilt bundle), `src/server/tests/myday-guard.test.js` (new, 5 tests:
cold-boot guard keyed on `!appState.lastUpdated`, one-shot DataRefreshed
on/off symmetry, records-are-the-source contract, reviews re-render contract,
'still shows' badge + load-failure empty state survive).

## Phase 3 Part 3 (2026-09-22) — PWA "new version available" cue (verify-only)

No code shipped this unit — the PWA cue is **already live on `main`** (verified
in the shipped bundle + HTML, not just git history):

- `sw.js` posts `SKIP_WAITING` + exposes `SW_VERSION`; the app's
  `refreshWithCacheBurst()` listens on the SW `updatefound` event, posts
  `{type:'SKIP_WAITING'}` to the controller, and on `controllerchange` the app
  shows `showUpdateBanner()` ("A new version of the dashboard is available.")
  with a dismiss + reload path (`updateBanner` element confirmed present in
  `assets/app-native.html`; bundle round-trip checksum-verified during Part 5).
- Echo of `9c1184d6` decision (bundle applies on cue, not on reload).

## Phase 3 Part 21 (2026-09-22) — CSS semantic token pass

Shipped as `2571863` ("feat: Phase 3 Part 21 - CSS semantic token pass"),
pushed to `origin/main`. Gates: 457 pass / 0 fail (451 + 6 new
`css-tokens.test.js`), secret scan OK (201 files), bundle-size OK
(styles.css 125.5 KB / 160 KB).

- Closed the referenced-but-undefined token gaps: `--accent-soft` (light
  `#e7f0f8`, dark `rgba(144, 202, 249, .16)`), `--radius-full` (kanban count
  badge was rendering square because the token didn't exist), `--scrollbar`,
  and the `--color-accent-soft` canonical alias.
- Realigned every `var(--token, #fallback)` to the canonical `:root` value —
  the drifted warm-blue `#2563eb` / reds / greens / grays no longer bleed
  through scoped & print contexts.
- On-screen literals → tokens: `.brand-mark`, `.preview-stage`, `.splash-mark`
  → `var(--surface)`; `.bottom-nav-fab-inner` → `var(--color-on-solid)`.
- Print blocks remain intentionally literal (paper-white), and the token test
  exempts them.
- New durable gate `src/server/tests/css-tokens.test.js` (6 tests): no
  undefined `var()` references anywhere, Part 21 tokens defined in `:root` +
  dark override, every hex fallback matches its `:root` default, drift hexes
  absent, no literal on-screen surface colors outside print, kanban badge
  radius. Passing now, and it catches any future token drift/reintroduction.

## Pending Tasks

- **S7 shipped** (`b57b60d`). **Part 21 shipped** (`2571863`).
- **Phase 3 UX queue — ALL SHIPPED (verified 2026-09-22, not just git-log):**
  1) CSS semantic tokens (Part 21) → `2571863`. 2) My Day dashboard (Part 5)
  → `68ab970` (this session). 3) record detail drawer (Part 7) → already on
  `main`. 4) actionable notifications (Part 9) → already on `main`.
  5) PWA "new version available" cue (Part 3) → **live**: `showUpdateBanner` /
  `hideUpdateBanner` / `applyUpdate` + `refreshWithCacheBurst`, wired to the
  `#updateBanner` element in `app.html`; SW posts SKIP_WAITING → controllerchange
  auto-reload. Nothing in the 1→5 order remains pending.
- Carried S6 LOWs (static-deny whitelist, attachment MIME narrowing,
  `getAuditEntries`/push-notification viewer exposure, `getDataForUser` cache
  TTL, worker `script-src 'unsafe-inline'` legacy) remain deferred; none
  runtime pending.
- Dev-DB note: `src/server/repro-view-updates.js` and this export stay
  untracked.
- **Carried S6 LOWs** (see list above) remain deferred; none are runtime
  pending.
- Dev-DB note: `src/server/repro-view-updates.js` and this export stay
  untracked.
## Dash AI "No answer returned." â€” contract-drift bug, fixed (2026-09-23)

**Symptom** (user report): every successful Dash AI answer rendered
`No answer returned.`

**Root cause â€” client/server contract drift, not an AI outage:**
- Server (`src/server/enterprise.js`) stamps the answer as **`insights`** on
  every success path: `callOpenAiChat_ @325` -> `{ success: true, insights: text }`
  @350; `callKilo_ @353` -> same @380; `callGemini_ @383` -> same @405;
  `runAiProvider_ @408` returns the provider result through unchanged.
- Client (`src/app/workspace.js:137`) read only `r.text || r.answer` on the
  ask path â€” neither field is ever stamped, so the success branch always fell
  through to the literal `'No answer returned.'` fallback, every provider.

**Fix â€” additive, no provider/work-path changes:**
- `workspace.js:137` ask fallback now reads `r.text || r.answer || r.insights`
  (client finally reads the field the server actually stamps; keeps both legacy
  fallbacks so nothing that already worked changes behavior).
- Rebuilt bundle `app.js` via `build/build-app.js`; `build/split-app.js`
  round-trip byte-exact (22 modules reproduced).

**Verification (re-run on the rebuilt bundle, not carried forward):**
- Full suite: **461 pass / 0 fail** (exit 0).
- `node --check` clean on `workspace.js` and rebuilt `app.js`.
- Secret scan: 203 files, 0 findings.
- Bundle size: `app.js` 499.4 KB raw / 116.8 KB gzip (limits 550/150): OK;
  `styles.css` 125.5 KB raw / 24.2 KB gzip (limits 160/45): OK.
- `git fetch` confirmed push landed: HEAD == origin/main == **ec98110**.
- Working tree: only the two intentional untracked strays remain (this export +
  `src/server/repro-view-updates.js`).

Committed as `ec98110`: fix Dash AI "No answer returned." â€” client contract
drift (server stamps r.insights; client now reads it, keeping text/answer
fallbacks). Pushed; origin/main in sync.

