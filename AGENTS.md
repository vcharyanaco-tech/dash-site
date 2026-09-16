# Agent Startup Routine (MANDATORY — run at the start of EVERY session)

1. **Sync with remote**
   - Run `git fetch origin`.
   - Check `git status`; if local is behind, `git pull origin main --ff-only`.
   - Report any untracked/stray files (e.g. temp CSVs) — never commit them unasked.

2. **Check for pending tasks / interrupted progress**
   - Read the most recent `SESSION_EXPORT_*.md` (by date) and extract its
     `## Pending Tasks` / `## Suggested next steps` sections.
   - Grep recent session exports and `dash-site-improvement-prompt.md` for
     "interrupted", "deferred", "in progress", "NOT automated".
   - Summarize what was last done, what was interrupted, and what is queued.

3. **Report before acting**
   - Present the sync result + pending-task summary to the user.
   - Ask which pending task to resume (or whether to start new work) before
     making code changes. Do not auto-start work without confirmation.

4. **Cadence during the session**
   - After each significant unit of work, commit with a concise message
     matching repo style (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
   - Push to `origin/main` when the user asks, or when a work unit reaches a
     stable checkpoint and the previous convention was to push each unit.
   - Update the current `SESSION_EXPORT_*.md` (What was done / Files changed /
     Commits / Pending Tasks) before ending the session.

## Repo conventions
- Stack: plain JS frontend (`app.html` + `src/app/*.js` + `assets/styles.css`),
  Node/Express backend in `src/server` (SQLite via better-sqlite3, SSE + cookie
  sessions), `src/worker` Cloudflare Worker sidecar.
- Every session progress is captured in `SESSION_EXPORT_YYYY-MM-DD.md`.
- Verification: `src/server/tests` via `node src/server/tests/run-tests.cjs`;
  `node --check` on touched JS.