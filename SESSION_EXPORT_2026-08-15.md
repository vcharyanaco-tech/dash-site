# Session export — 2026-08-15 (tables & windows polish, stale-cache fixes)

## Context / goal
Resumed from the 2026-08-14 export. This session was a frontend polish pass
plus two genuine root-cause fixes for "changes not showing up" issues. All
work is in the **dash-site** repo (`vcharyanaco-tech/dash-site`, Render +
Cloudflare worker). Backend untouched except tests.

## 1. Root cause: stale bundle served forever (cache-first service worker)
- **Symptom:** user saw old UI (corrupted timestamps, mojibake arrows) long
  after fixes shipped.
- **Root cause:** `sw.js` was **cache-first for everything** and its version
  (`2026.08.09b`) had never been bumped since Aug 9 — browsers served the
  Aug-9 bundle from cache no matter what. Also `/api/*` responses were being
  cached.
- **Fix:** bumped SW version, switched the app bundle (app.html/app.js/styles.css)
  to **network-first** (cache only as offline fallback), never cache `/api/*`.

## 2. Root cause: Cloudflare edge ignored `?v=` and served stale CSS/JS
- The worker's GitHub Pages fetcher cached responses **ignoring query
  strings**, so `?v=` busting never worked — stale CSS/JS lingered up to an
  hour after every deploy. This is why earlier fixes "didn't work".
- **Fix:** app bundle now ships `Cache-Control: no-store` from the worker
  (edge can never long-cache it); service worker handles offline. Also purged
  via Cloudflare Development Mode during rollout. `?v=` bumped to 2026.08.15a.

## 3. Drag-resizable windows everywhere
- Every modal (`.modal-card`) got a corner grip → drag-resize, size remembered
  per dialog in localStorage, restored in `openDialog`.
- The inline analyze/AI panels got a grip too; size persisted per record in
  the panel state (survives the 60s auto-refresh re-render).
- Link-preview modal's stage is now flex so it grows with the card.

## 4. Table polish (Excel "Format as Table → Medium" look, India Post red)
- Records / Audit / Users / Activity / Tasks tables + the analyze-link table:
  saturated red header (#DA291C) with bold white text, banded rows, red-tinted
  row rules, dark-mode variants.
- Column widths **resizable by drag** (no min/max limit), text **wraps** on
  resize, body font bumped to 14px.
- Records table window: taller default + drag handle to resize height
  (remembered).
- Actions column pinned sticky-right (frozen-pane style).
- Analyze-link table: header frozen on vertical scroll; **Division (2nd)
  column** frozen on horizontal scroll (moved from 1st col which is a serial
  number). Panel drag now also grows the inner table wrap and the surrounding
  records-table window (was clipped at 78vh / a fraction of the screen).

## 5. Persistence & bug fixes
- "Analyze link" output + AI insight panels now **persistent** across the 60s
  auto-refresh / page changes / re-renders; re-opening renders from cache
  (no repeated API/Groq calls); collapse state remembered.
- **Submission-revert bug:** root cause = stale-response race — a background
  refresh that started BEFORE a submission mutation could land after it and
  overwrite the fresh state. Fixed with a sequence counter: stale payloads are
  discarded and a fresh fetch runs 2s later.
- Timestamp format fixes (`dd.MM.yyyy HH:mm`) incl. Settings → User activity →
  Last seen; fixed double-encoded mojibake in styles.css sort arrows.

## 6. Backend / ops (from previous session context, still live)
- Per-IP rate limiting on the worker (60 POST/min, 240 GET/min, 600 total),
  verified with a 62-request burst → clean 429s.
- Email chain verified end-to-end (worker SMTP relay + full password-reset
  flow).
- GAS mirror (`src/gas/`) marked deprecated (README + file banners).
- 30-day retention for meeting recordings + uploads, with a **Keep** button
  per attachment to exempt documents from the sweep. `retentionDays: 30` live.

## Where things stand
- Latest commit: `228e53b` (freeze 2nd column, panel limits, expand table
  window). Repo clean, pushed. All 31 server tests pass.
- Verify-after-deploy ritual: `clasp` not used here; push → Render rebuilds →
  raw-GitHub CDN propagates in a couple of minutes → check served bundle
  contains the new markers (grep for the feature string in the served
  app.js/styles.css). `no-store` means users get the new bundle on next reload.

## Suggested next steps
1. Verify the frozen Division column + panel resize live in a browser.
2. Confirm email actually arrives in inboxes (one live notification test).
3. Consider the earlier suggestion list: WhatsApp reminders (Meta token +
   template + cron) and a retention exemption for specific records if needed.
