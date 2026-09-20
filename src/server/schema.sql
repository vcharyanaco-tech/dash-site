-- ============================================================
-- India Post Dashboard — Node port
-- schema.sql
-- SQLite schema mirroring the GAS hidden sheets.
-- ============================================================

-- Dashboard records (mirrors the 'Sheet1' data sheet). Each row keeps a
-- stable physical 'row' number so the client's row-keyed API calls keep
-- working exactly as they did against the spreadsheet. row is contiguous:
-- the display id always equals (row - START_ROW + 1).
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  row INTEGER NOT NULL UNIQUE,
  -- Stable record identity (Part 15). Survives the physical-row renumbering
  -- that happens when sheet rows are deleted/pruned below a record, so child
  -- tables (tasks, documents, record_changes) can stay anchored to the record
  -- through rows even if a future renumber sweep misses one of them. The
  -- physical `row` column is kept as the legacy_sheet_row for the client's
  -- row-keyed display contract and the spreadsheet linkage.
  record_id TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  entry_date TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  last_meeting_instructions TEXT NOT NULL DEFAULT '',
  responsibility TEXT NOT NULL DEFAULT '',
  review_date TEXT NOT NULL DEFAULT '',
  -- JSON: { sector:{url,text}, description:{url,text}, action:{url,text} }
  links TEXT NOT NULL DEFAULT '{}',
  -- background colour of the review-date "cell" (#ffffff/#ffab00/#c8e6c9)
  review_bg TEXT NOT NULL DEFAULT '#ffffff',
  -- origin of this row: 'sheet' (imported/pulled) or 'app' (created in the
  -- dashboard). Rows created in the dashboard are never overwritten or pruned
  -- by a sheet pull.
  source TEXT NOT NULL DEFAULT 'sheet',
  -- whether this record is shown on the dashboard (1) or hidden (0). Editors
  -- and admins tick records they want to display; viewers only ever see
  -- records with displayed = 1.
  displayed INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

-- Users (mirrors the hidden 'Users' sheet).
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'VIEWER',
  salt TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  must_change INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER,
  reset_token TEXT NOT NULL DEFAULT '',
  reset_expires INTEGER,
  group_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  office TEXT NOT NULL DEFAULT '',
  preferences TEXT NOT NULL DEFAULT '',
  reset_requested TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  divisional_dashboard_url TEXT NOT NULL DEFAULT ''
);

-- Submissions (mirrors the hidden 'Submissions' sheet).
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  card_row INTEGER NOT NULL DEFAULT 0,
  card_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  created_at INTEGER,
  updated_at INTEGER,
  locked_by TEXT NOT NULL DEFAULT '',
  locked_at INTEGER,
  displayed INTEGER NOT NULL DEFAULT 0,
  -- when the admin last read this submission (0 = not read yet). The
  -- submission-badge on the card flashes while any update is unread.
  read_at INTEGER NOT NULL DEFAULT 0
);

-- Files attached directly to submissions. Kept separate from record documents
-- so submission attachments follow the update rather than the parent record.
CREATE TABLE IF NOT EXISTS submission_attachments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  file_key TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL DEFAULT '',
  uploaded_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission ON submission_attachments(submission_id);

-- Last-meeting-instruction entries. One record may carry several dated
-- instruction entries authored by an admin/editor (the "submit update"-style
-- field). records.last_meeting_instructions mirrors the joined entry text so
-- cards, presentation slides and print keep working off the plain column.
CREATE TABLE IF NOT EXISTS instruction_entries (
  id TEXT PRIMARY KEY,
  card_row INTEGER NOT NULL DEFAULT 0,
  card_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  created_at INTEGER,
  updated_at INTEGER
);

-- Files attached directly to instruction entries. Kept separate so entry
-- attachments follow the entry rather than the parent record.
CREATE TABLE IF NOT EXISTS instruction_attachments (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  file_key TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL DEFAULT '',
  uploaded_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_instruction_entries_card_row ON instruction_entries(card_row);
CREATE INDEX IF NOT EXISTS idx_instruction_attachments_entry ON instruction_attachments(entry_id);

-- Tasks (mirrors the hidden 'Tasks' sheet).
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  record_row INTEGER NOT NULL DEFAULT 0,
  record_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  assignee TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  due_date INTEGER,
  created_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER,
  updated_at INTEGER,
  completed_at INTEGER
);

-- Notifications (mirrors the hidden 'Notifications' sheet).
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  created_at INTEGER,
  read_at INTEGER,
  priority INTEGER NOT NULL DEFAULT 0,
  record_row INTEGER NOT NULL DEFAULT 0
);


-- Audit log (mirrors the 'Audit Log' sheet).
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER,
  user TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  record_id TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT ''
);

-- Archived audit rows (moved out of `audit` after 90 days by the daily
-- internal job; replaces the GAS 'Audit Archive' sheet).
CREATE TABLE IF NOT EXISTS audit_archive (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER,
  user TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  record_id TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT ''
);

-- Documents (mirrors the hidden 'Documents' sheet). File bytes live on disk
-- under data/uploads/<file_key>; file_key is a UUID used by GET /files/:key.
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  record_row INTEGER NOT NULL DEFAULT 0,
  record_id TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  file_key TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL DEFAULT '',
  uploaded_at INTEGER,
  keep INTEGER NOT NULL DEFAULT 0
);

-- Sessions (CacheService replacement).
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER,
  expires_at INTEGER
);

-- Login throttling (CacheService replacement).
CREATE TABLE IF NOT EXISTS login_attempts (
  identifier TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);

-- Settings / Script Properties replacement.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- AI insights cache (replaces the Worker KV cache).
CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL DEFAULT '',
  created_at INTEGER
);

-- Dedupe keys for reminders/notifications (CacheService replacement).
CREATE TABLE IF NOT EXISTS dedupe (
  key TEXT PRIMARY KEY,
  created_at INTEGER
);

-- Ask-AI Q&A history for the linked-file panels: one row per record, JSON
-- array of { question, answer } (newest last). Survives page reloads so a
-- user's questions are not lost when the in-memory appState cache clears.
CREATE TABLE IF NOT EXISTS ask_ai_history (
  record_row INTEGER PRIMARY KEY,
  history TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_records_row ON records(row);
-- idx_records_record_id is created by db.js AFTER its migration adds the
-- records.record_id column, so booting against an older restored database
-- (which lacks the column) cannot fail here. Do not move it back into this
-- schema: CREATE TABLE IF NOT EXISTS never adds columns to existing tables.
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_submissions_card_row ON submissions(card_row);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(email);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_documents_record_row ON documents(record_row);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username != '';
-- idx_users_dashboard_url is created by db.js AFTER its migration adds the
-- users.divisional_dashboard_url column (same rule as idx_records_record_id:
-- CREATE TABLE IF NOT EXISTS never adds columns to existing restored tables).

-- Record change history: stores a JSON diff for every update so admins can
-- see exactly what changed on each edit. One row per update event.
CREATE TABLE IF NOT EXISTS record_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_row INTEGER NOT NULL,
  record_id TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT '',
  changed_at INTEGER,
  diff TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_record_changes_row ON record_changes(record_row);
