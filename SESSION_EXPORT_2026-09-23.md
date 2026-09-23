# Session Export — 2026-09-23

## Context

Follow-up on the live palette/global-search regression (`1bd82f6`, v1.2.2)
after the user reported it "still persists", plus a new request: search boxes
must never be treated as autofill targets by any browser.

## What was done

### Verified the palette fix is actually live (root-cause: stale bundle, not code)
- Fetched the live bundle `https://dashboardharyana.site/app.js` cleanly
  (521831 bytes) and compared against a fresh `node build/build-app.js` output
  after LF-normalizing local (Windows CRLF) — **whitespace-normalized equal and
  byte-identical** (518617/518617 after LF conversion).
- Live bundle confirmed: no `_origFilterCommands` (wrapper gone),
  `filterCommandsDebounced_` is a real debounce wrapper wired to the palette
  `oninput`.
- Conclusion: the deployed code is correct. Any residual "search error" the
  user sees is the **old v1.2.1 PWA bundle** still being served by the previous
  cache-first service worker until the network-first `sw.js` (skipWaiting +
  clients.claim) activates. Needs one navigation/reload; no code change needed.
- `sw.js` (network-first for `/app.html`, `/app.js`, `/assets/styles.css`) is
  already correct — nothing to fix there.

### Autofill hardening (this session's only code change)
Browsers/password managers ignore `autocomplete="off"` on search boxes, so every
search input now also gets `autocorrect="off" autocapitalize="off"
spellcheck="false" data-lpignore="true"` and an **empty `name=""`** to defeat
Chrome/FF/Edge autofill heuristics and LastPass:
- `app.html` topbar `#searchInput` (line 100)
- `app.html` palette `#commandInput` (line 1393)
- `app.html` `#fathomSearchInput` + `#meetingsSearchInput`
- `src/app/workspace.js` `#globalSearchInput` (modal, rendered at runtime)

Rebuilt `app.js` (22 modules, 11804 lines) and normalized to LF to match the
live artifact byte-for-byte.

## Commits
- `b9aeca4` "chore: harden search inputs against browser autofill" — pushed to
  `origin/main` (Pages auto-deploys).

## Verification
- `src/server`: `node run-tests.cjs` → **512 pass / 0 fail**, exit 0
  (coverage report ≥ 83/64/86).
- `node --check src/app/workspace.js` clean.
- Rebuilt `app.js` LF-normalized == live bundle byte-for-byte.

## Pending tasks / suggested next steps
- Confirm with the user: do a hard reload (or reopen the tab) so the new
  network-first SW takes control; the palette/global-search fix is already live
  server-side.
- If the user still sees an error after a clean reload, capture the exact toast
  text + browser console stack to isolate a further cause.
- Unchanged from 09-22: wire `CLOUDFLARE_API_TOKEN` into repo secrets to
  activate the worker deploy job; untracked strays
  (`VS tools.code-workspace`, `dash-site-presentation-mode-big-pickle.md`) are
  never to be committed.