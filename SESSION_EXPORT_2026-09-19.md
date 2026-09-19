# Session Export — 2026-09-19

Continuation of the 2026-09-18 session (the 09-18 export is a stale snapshot:
`78fb810` shipped Part 10 quota + a partial Part 12 pass, but the export lists
both parts as pending). This session closes the user-confirmed three-item
queue: **finish Part 12 Accessibility**, **Part 10 AI/Copilot**, and
**re-anchor the unattached Phase-4 backlog item**.

Repo state at start: `origin/main` == `78fb810`, working tree otherwise clean.
Stray untracked files in the repo root (`VS tools.code-workspace`,
`dash-site-presentation-mode-big-pickle.md`) were reported and left uncommitted.

---

## Part 12 — Accessibility (unit 2) — SHIPPED

Prompt gate: PART 12 (dash-site-improvement-prompt.md ~line 723), WCAG 2.1 AA
pass. Continued the 09-18 partial pass (`:focus-visible` + color-independent
status glyphs) with the modal/keyboard/labeling gaps found by the on-disk audit.

**Files changed (7 modules + HTML + CSS + rebuilt bundle):**

- `src/app/core.js` (+50) — dialog a11y:
  - `dialogReturnFocus_` map + `getDialogFocusable_()` (visible-focusable
    filter) + `topOpenDialog_()`.
  - `openDialog()` remembers `document.activeElement` and focuses the **first**
    visible focusable (was: first raw `input,textarea,…,button,[tabindex]`).
  - `closeDialog()` restores focus to the opener when still in the DOM.
  - Document-level capture-phase `keydown` **focus trap** (WCAG 2.1.2 / 2.4.3):
    Tab/Shift+Tab wrap inside the top-most open `.modal-backdrop`, and pull
    focus back in if it has escaped the dialog.
- `src/app/session.js` (+37/-12):
  - Notification center now flows through `openDialog`/`closeDialog`
    (previously hand-toggled `.hidden` + `modal-open`, bypassing focus mgmt).
  - `setFieldInvalid()` now emits `aria-invalid="true"` + `aria-describedby`
    pointing at a generated `err-<id>-<rand>` id, and clears both on valid.
  - `notif-unread-tag` "Unread" text tag added to both the panel
    (`renderNotifications`) and the center (`notifCenterItemHtml_`) so unread
    state is not conveyed by background tint alone (WCAG 1.4.1).
- `src/app/init.js` (+25/-2):
  - `'notifCenterModal'` added to the Escape-close dialog list.
  - Dashboard `th[data-dash-sort]` and audit `th[data-sort]` get `tabindex="0"`
    + `title="Sort by …"` + Enter/Space keydown activation. **Deliberately no
    `role="button"`** — it would strip the implicit `columnheader` role that
    `aria-sort` depends on; the header stays a sortable column that is keyboard
    operable.
  - Brand logos: `.brand-mark` gets `role="img"` and its inner data-URI `<img>`
    gets `alt=""` (the wrapper carries the accessible name) — removes the
    invalid label-on-div pattern.
- `src/app/utils.js` (+36/-4) — multi-select listbox semantics:
  - Options: `role="option" tabindex="0" aria-selected`, synced on change.
  - Trigger: `aria-expanded` toggled; opening focuses the first option.
  - Dropdown keydown: ArrowUp/Down move focus, Enter/Space toggle, Escape
    closes and returns focus to the trigger.
  - Chip remove buttons: `aria-label="Remove <label>"` (was bare "Remove").
- `src/app/dashboard.js` (+1/-1) — per-row display checkbox gets
  `aria-label="Show this record to viewers"` (label wrapped a checkbox with no
  text).
- `src/app/edit.js` (+2/-2) — dynamic link-row inputs get `aria-label`s.
- `src/app/tasks.js` (+1/-1) — Overdue `button` with dead `onclick="void 0"`
  (focusable no-op) replaced with a non-focusable `<span class="badge">`; the
  `title` tooltip is retained.
- `app.html` (+16/-16): skip link `#main-content` → `#mainContent` (target
  actually exists now); `aria-label`s on `settingsFathomApiKey`,
  `meetingNotesTitleInput`, `meetingNotesFile`, `fathomSearchInput`,
  `fathomApiKeyInput`, `meetingsSearchInput`, `commandInput`; `role="alert"` on
  `loginMessage` / `forgotMessage`; both multi-select triggers
  (`aria-label`/`aria-haspopup`/`aria-expanded`) + dropdowns
  (`role="listbox" aria-multiselectable`); both submenu-parent divs get
  Enter/Space `onkeydown` → `toggleSubmenu(this)`.
- `assets/styles.css` (+31): `.notif-unread-tag`, `.ms-option:focus-visible`,
  `.dp-cell.dp-selected` bold + underline (date-picker selected day no longer
  color-only).

## Part 10 — AI / Copilot (unit 2) — SHIPPED

Prompt gate: PART 10 (~line 643), Phase 4. Scope per prompt = "consolidate
Ask-AI + quota/rate-limits + permission-aware retrieval FIRST". The 09-18
commit added `ai-quota.js` keyed on the session **token**; two on-disk defects
were fixed, plus the AI-labeling requirement:

- `src/server/ai-quota.js` (rewritten, +43/-13):
  - Keyed on **email**, not the session token — the daily budget previously
    reset on every logout/login and was per-session rather than per-user.
  - **Two-phase**: `checkAskQuota_(email)` is read-only (returns
    `{ok, email, day}`) and `commitAskQuota_(email)` records one used question.
    Previously the check incremented immediately, so failed/disabled AI calls
    burned quota.
- `src/server/enterprise.js` (+6/-2): `askLinkAi()` now takes the user from
  `auth.requireEditor(token)` (behavior unchanged: throws for non-editor) and
  passes `user.email` to the quota; `commitAskQuota_(user.email)` is called
  only inside the existing `result.success === true` branch.
- `src/app/ai.js` (+8/-4): `ai-generated-tag` ("AI-generated", with
  *"verify before acting"* tooltip) added to all four render paths
  (`cardAiPanelHtml_`, `aiPanelHtmlFromCache_`, `cardLinkPanelHtml_`,
  `linkPanelHtmlFromCache_`) and prefixed to the rendered Ask answer;
  `aria-live="polite"` on the AI insight bodies + Ask result so async output is
  announced; Ask input gets an `aria-label`.
- `assets/styles.css`: `.card-ai-head` switched to `justify-content:flex-start`
  with `> .btn { margin-left:auto }` so the new tag sits next to the title while
  the Collapse button stays right-aligned; `.ai-generated-tag` token-based pill.

Permission-aware retrieval: audited, **no gap**. `askLinkAi` /
`getLinkContentAiInsight` / `loadCardAi` all resolve rows through
`findItemByRow_` and the dashboard list is already scoped by
`scopeItemsForUser_` (non-editors never receive hidden records); the endpoints
remain editor-gated. No new retrieval surface was added.

## Item 3 — Unattached Phase-4 backlog item — RE-ANCHORED, nothing to build

Re-read the Phase-4 list (`dash-site-improvement-prompt.md` ~line 1069) against
the tree; the previously-unattached line is fully accounted for:

| Phase-4 item | State |
| --- | --- |
| Part 6 command palette | Shipped (palette + Part 12 mobile trigger `36ccf7a`) |
| Part 8 task views (overdue, My Tasks) | Shipped `5c20e8a`; Kanban/calendar/deps are prompt-optional and **must not** be built speculatively |
| Part 3 offline sync visibility | Shipped (Part 3b offline activity center `a445a46`) |
| Part 10 AI/Copilot | Consumed this session (quota hardening + labeling) |
| Parts 12/13 accessibility + mobile | Part 13 shipped `a38a8c1`; Part 12 continuing (this session) |

The only residual candidate is **Kanban**, which the prompt explicitly gates to
opt-in ("do not build speculatively"), so no speculative build was started. The
backlog item is closed as resolved rather than deferred.

## Part 12 — Accessibility (unit 3: contrast + reduced motion) — SHIPPED

On-disk audit of the colour tokens found four text-on-surface pairs below the
WCAG AA 4.5:1 threshold for normal text; `prefers-reduced-motion` was already
handled globally (`styles.css:3389`). Fixed at the token level so every
consumer benefits:

| Token | Before | After | Worst pair |
| --- | --- | --- | --- |
| `--muted` | `#667085` | `#5d6a7e` | on `--surface-3` 4.47 → 4.93 |
| `--success` | `#15803d` | `#14713a` | on `--success-soft` 4.46 → 5.41 |
| `--brand-gold` | `#c9861f` | `#94610c` (light) / `#d9a441` (dark override) | footer org name 3.04 → 4.84 |
| `.footer-version` / `.badge[data-tone="primary"]` text | `--primary` | `--primary-hover` | on tinted pill 3.60 / 4.26 → 4.68 / 5.54 |

Dark-theme `--muted`/`--success` are separate overrides and were already ≥5.7:1.

## Part 17 — Observability / System Health — SHIPPED

The prompt asked for an admin System Health view (backend/db/Worker/backup/
uptime/memory/errors/latency/AI/notification status + structured counters).
Only `GET /api/health` (liveness) and a config-only `getEnterpriseHealth`
existed — there was **no aggregated admin view**.

- **`src/server/system-health.js` (new, admin-gated aggregation layer):**
  - `getSystemHealth_()` composes process/uptime/memory, SQLite ping + DB size,
    KV-backup bridge status (last backup + age + budget left), Worker URL/token
    flags, AI enabled/key flags, notification unread + last-generated, request
    metrics, failure counters and a bounded recent-error ring.
  - In-memory counters: `apiErrors`, `authFailures`, `rateLimitEvents`,
    `aiFailures`; `recentErrors` ring buffer (50). Every subsection degrades to
    `{ error }` rather than throwing.
  - `setMetricsProvider_()` lets `index.js` inject the request/p95 snapshot
    without a circular require.
- **Wiring:** `index.js` records API failures (`recordApiError_`, classifying
  authN/authZ refusals separately) and registers the metrics provider;
  `rate-limiter.js` counts 429s; `enterprise.js` `generateAiText_` counts AI
  failures. New `getSystemHealth` op added to the dispatch with
  `auth.requireAdmin(...)`, to `AUTH_ARG_INDEX` (slot 0) and to `VALIDATORS`.
- **Frontend:** `ApiService.getSystemHealth()`, an admin-only **System health**
  card in Settings (`#systemHealthCard`, full-width), colour-independent
  OK/Error pills + text, counters strip, and a recent-errors list. Auto-loads on
  entering Settings, manual Refresh button, `aria-live` container.
- **Test:** `src/server/tests/system-health.test.js` — admin snapshot shape,
  viewer rejected (`permission`), missing-token rejected.

## Verification

- `node build/build-app.js` → "Reassembled app.js (21 modules, 9958 lines)";
  `node --check app.js` exit 0.
- Server suite (`node src/server/run-tests.cjs`) → **exit 0**, 372 tests /
  372 pass / 0 fail (4 new System Health tests).
- `node --check` on every touched server file; contrast ratios computed per
  WCAG relative-luminance formula.

## Commits

- `08f36b3` feat: Part 12 a11y (dialog focus trap/restore, keyboard sortable
  headers, multi-select listbox keys, ARIA names/errors/unread tags) + Part 10
  Ask-AI quota keyed on email with two-phase commit + AI-generated labels.
- (this unit) `feat: Part 17 admin System Health view (metrics/counters/recent
  errors + backup/AI/Worker/notification status) + Part 12 contrast token
  sweep + reduced-motion confirmation`.
- Session export (docs) pushed with each unit.

## Pending Tasks

- **Part 19 — CI/CD:** add migration validation + frontend bundle-size check to
  `.github/workflows/ci.yml` (secret-scan, npm audit, tests, syntax and
  module round-trip already run).
- **Part 4 — Information Architecture:** group the flat sidebar into
  Overview / Work / Insights / Admin with role-based visibility.
- **Part 18 — Testing:** frontend + end-to-end viewer/editor/admin workflow
  tests (server side is at 372 tests).
- **Part 16 — Worker review:** cold-start/memory/origin-timeout/retry review
  has no recorded completion.
- **Phase-4 Kanban** remains opt-in only; requires an explicit user ask.
- Notification panel/center `<li>` rows left mouse-only on purpose (focusing the
  whole row would nest interactive controls); inner action buttons are
  keyboard-reachable.
