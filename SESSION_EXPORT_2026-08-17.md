# Session export — 2026-08-17 (Ask-AI bar on linked-file preview panels)

## Context / goal
Resumed mid-task in the **dash-site** repo (`vcharyanaco-tech/dash-site`):
add an **Ask-AI bar** to the "Linked file preview" panels so editors can
type a question about a record + its linked file and get an answer from the
configured AI provider (Groq by default). The feature was already written in
the working tree from the previous session; this session verified it,
committed it, and pushed.

## What changed (commit `1224d5f`, pushed to origin/main)
- **Client (both the live web app `app.js` and the Apps Script bundle
  `src/gas/script.html`):**
  - `ApiService.askLinkAi(row, question)`.
  - `appState.linkAskQa` — per-row `{ question, answer }` cache so answers
    survive background refreshes.
  - `linkAskHtml_(row)` renders the ask bar (input + Ask button) above the
    linked-file table; `askLinkAi(elm)` runs the call, shows a loading
    state, renders the question/answer box below the bar, and handles
    errors via the existing `handleServerFailure` + toast pattern.
  - Editor-gated client-side (`appState.isEditor`), matching the other AI
    insight buttons.
- **Server (both GAS `src/gas/EnterpriseService.gs` and Node
  `src/server/enterprise.js`):** `askLinkAi(token, row, question)` —
  editor-gated, `aiEnabled_` check, question trim + 1000-char limit,
  record lookup via `findItemByRow_`, fetches the linked file content
  (sheets table text or page text, `isSafeLinkUrl_` SSRF guard,
  `ENTERPRISE_AI_LINK_MAX_CHARS` cap), builds the prompt from record
  fields + link content, calls `generateAiText_(prompt,
  ENTERPRISE_AI_ASK_SYSTEM_PROMPT)`, echoes `row`/`id` on success.
- **Config:** `ENTERPRISE_AI_ASK_SYSTEM_PROMPT` added to
  `src/server/config.js` (+ exported) and as a constant in
  `EnterpriseService.gs`.
- **Dispatch:** `askLinkAi` route added to `src/server/index-dispatch.js`.
- **Styles:** `.card-ai-ask*` rules in `assets/styles.css` and the GAS
  `src/gas/styles.html` (input, button bar, result box with accent left
  bar, question/answer typography, loading + error states).
- **Tests:** `src/server/tests/meetings.test.js` — `askLinkAi` input
  validation test (blank question, over-long question, unknown record)
  without hitting the network; `setup()` switched to `INSERT OR IGNORE`
  so tests stay idempotent.

## Validation
- `node --check` clean on: `app.js`, `src/server/enterprise.js`,
  `src/server/config.js`, `src/server/index-dispatch.js`,
  `src/server/tests/meetings.test.js`, `EnterpriseService.gs`
  (copied to `.tmp.js`), and the inline JS extracted from
  `src/gas/script.html`.
- `npm test` in `src/server` → **32/32 pass** (was 31; new test passes).
- Helpers referenced by the new code (`escAttr`, `showToast`,
  `handleServerFailure`, `findItemByRow_`, `firstLinkUrl_`,
  `generateAiText_`, `aiEnabled_`, `requireEditor_`, `isSafeLinkUrl_`,
  `isSheetsLink_`, `fetchLinkTable_`, `fetchLinkText_`) all verified
  present in both the GAS and Node sides.

## Follow-up: clear-answer affordance + question history (commit `a61bf48`)
- `appState.linkAskQa` is now a per-row **history array** `[{question, answer}]`
  (newest last) instead of a single `{question, answer}`.
- `linkAskResultHtml_(row)` renders just the result box: latest Q&A on top
  with a ✕ **clear button** (`clearLinkAsk` — client-side only, deletes the
  row's cached history, no server call), and older Q&As collapsed under a
  `Previous questions (N)` `<details>` toggle (`linkAskHistoryHtml_`).
- `askLinkAi` success now pushes into the history; re-asking the same
  question moves it to the top instead of duplicating; history capped at
  10 entries per row. `linkAskHtml_` delegates to `linkAskResultHtml_`.
- New styles: `.card-ai-ask-result-head`, `.card-ai-ask-clear` (ghost ✕,
  danger on hover), `.card-ai-ask-history` (+ `summary`, `-item`) in both
  `assets/styles.css` and `src/gas/styles.html`.
- Verified: `node --check` clean on app.js + extracted script.html JS;
  `npm test` 32/32 pass; client ask-block and CSS block byte-identical
  across the web + GAS bundles. Pushed to `origin/main`.

## Bugfix: "Session expired" when opening Meeting Notes (commit `e2e5d63`)
- **Reported:** opening the Meeting Notes modal immediately showed
  "Session expired. Please log in again." and logged the user out.
- **Root cause:** client/server argument-order mismatch on the three
  meeting-file API calls in `app.js` — `listMeetingFiles`,
  `getMeetingFile`, `deleteMeetingFile` sent `({}, token)` /
  `({name}, token)` (payload first, token last), but the Node dispatch
  reads the token as `args[0]` (`enterprise.listMeetingFiles(A(args,0))`).
  The server got `{}` as the auth token, `requireAdmin({})` threw
  "Login required…", and the client's `handleServerFailure` matched that
  as an auth error → forced logout + "Session expired" toast.
- **Fix:** client now sends the token first — `('listMeetingFiles',
  getAuthToken())`, `('getMeetingFile', getAuthToken(), name)`, same for
  delete — matching the server contract (like `getCardAiInsight`/
  `askLinkAi` already did). The GAS bundle doesn't carry these three
  calls (saved-files list is Node-only), so only `app.js` changed.
- **Verified end-to-end:** dispatch with old args `[{}, 'tok']` throws
  "Login required"; with new args `['tok']` / `['tok', name]` returns
  `success: true` (list total + markdown download). `node --check` clean;
  `npm test` 32/32 pass. Pushed to `origin/main`.

## Arg-order lock test (commit `b27ca18`)
- New `src/server/tests/dispatch-args.test.js` replays every ApiService
  call **exactly as app.js sends it** (token position included) through
  `index-dispatch` and fails if the auth token lands in the wrong slot
  (the bug class that made Meeting Notes throw "Login required" and log
  the user out).
- `CLIENT_CALLS` table mirrors the ApiService block in app.js (39 entries),
  with a comment to keep it in sync. The meeting-file trio
  (`listMeetingFiles`/`getMeetingFile`/`deleteMeetingFile`) is asserted
  strictly: list/get/delete succeed with `[token]` / `[token, name]`, and
  the old buggy `({}, token)` / `({name}, token)` shapes are asserted to
  still fail auth (`assert.throws`).
- Negative check: reverting to the old shape throws "Login required" —
  the test catches the regression. Full suite: 34/34 pass.

## Arg-order audit — all-clear + auto-test (commit `a62711b`)
- Ran a full audit of every client call: parsed the REAL `ApiService`
  block from app.js (75 entries), evaluated each call's args with a
  param-value map (token position included), replayed through
  `index-dispatch`. **Result: 75/75 authenticate correctly — no other
  token-position mismatches exist.** (Earlier audit runs falsely
  flagged everything: replaying the block in order hits `logout`, which
  deletes the session — re-created the session per call to model a
  freshly logged-in user.)
- Replaced the hand-maintained table in `dispatch-args.test.js` with
  `dispatch-client-args.test.js`: it parses app.js at test time, so it
  can't drift — new client calls are audited automatically, and any
  call whose token position diverges from the dispatch fails the suite.
  Kept the strict meeting-file trio assertions (list/get/delete +
  old-shape `assert.throws`). Async endpoints are awaited so late
  rejections can't escape; `adminSyncFromSheet`/`adminPreviewSyncFromSheet`
  skipped (covered by sync tests). Full suite: 34/34.

## Feature batch (commits `9a5287e`, `db3b171`, `31f10b6`, `ada8ec4`)
1. **KPI tile respects review filter** — when a review-status filter is
   active, the Review due KPI counts due records within the filtered set
   (subtitle "Within current filter") instead of the global count.
2. **Ask-AI history persisted server-side** — new `ask_ai_history` table
   + `getAllAskLinkHistory`/`saveAskLinkHistory` (editor-gated). Client
   loads the full map into `appState.linkAskQa` after login and saves on
   every ask/clear, so Q&As survive page reloads. Server mirrors the
   newest-10 cap and truncates oversized fields. New test covers
   save/reload/cap/clear + viewer rejection. (`ASK_LINK_HISTORY_MAX` in
   config.)
3. **CI test gate** — `.github/workflows/ci.yml` runs `npm test`
   (src/server) + `node --check` across app.js / worker / server sources
   on push to main and PRs, so a breaking change can't auto-deploy
   silently.
4. **Removed stale `src/gas/` bundle** — deprecated mirror, never pushed
   from this repo (live Apps Script lives in dashv1). 28 files deleted;
   README source table + MIGRATION Phase 5 note updated (soak itself
   remains pending-owner-call).

## Email direction (owner decision: KEEP)
- dash-site's Node server owns all email via `src/server/mailer.js`
  (SMTP via nodemailer when `SMTP_*` set, HTTP relay via Worker
  `/api/send-email`, local outbox fallback). Email features kept and
  untouched: password-reset-request notice to admins (Auth.js),
  `adminEmailAllUsers`, task assign/completion emails (tasks.js),
  review-date reminder emails (records.js), report PDF emails
  (`emailReport`). The removed GAS bundle was the only `MailApp`-based
  copy; the Node mailer is unaffected.

## Where things stand
- Commits `1224d5f` … `ada8ec4` pushed to `origin/main`. Working tree clean.
- Render/Railway auto-deploy picks up the push; the Apps Script bundle is
  in the same commit (deployed on next `clasp push` if the GAS side is
  still the live backend — see AGENTS.md deploy notes).

## Suggested next steps
1. Browser-test the Ask-AI bar (light + dark mode): type a question on a
   record with a linked file, confirm the answer box appears above the
   table and survives a background refresh.
2. Consider a "clear answer" affordance or question history in
   `appState.linkAskQa` (currently one answer per row, replaced on re-ask).
