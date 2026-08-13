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
  sector TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  entry_date TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  responsibility TEXT NOT NULL DEFAULT '',
  review_date TEXT NOT NULL DEFAULT '',
  -- JSON: { sector:{url,text}, description:{url,text}, action:{url,text} }
  links TEXT NOT NULL DEFAULT '{}',
  -- background colour of the review-date "cell" (#ffffff/#ffab00/#c8e6c9)
  review_bg TEXT NOT NULL DEFAULT '#ffffff',
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
  username TEXT NOT NULL DEFAULT ''
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
  displayed INTEGER NOT NULL DEFAULT 0
);

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
  read_at INTEGER
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
  uploaded_at INTEGER
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

CREATE INDEX IF NOT EXISTS idx_records_row ON records(row);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_submissions_card_row ON submissions(card_row);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(email);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_documents_record_row ON documents(record_row);
