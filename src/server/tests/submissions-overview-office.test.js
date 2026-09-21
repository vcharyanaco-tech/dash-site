// Regression: the dashboard card popup ("Update by …") reads the office off
// getSubmissionOverview_().displayed — that array must carry the submitter's
// office (not just the email) so the client can render "Update by Admin"
// instead of the raw email.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'subs-overview-' + Date.now());
process.env.DASH_DATA_DIR = TMP;
fs.mkdirSync(TMP, { recursive: true });

const { db } = require('../db');
const submissions = require('../submissions');

test('getSubmissionOverview_ displayed entries include the submitter office', function () {
  db.exec("DELETE FROM users; DELETE FROM submissions;");
  db.prepare(
    "INSERT INTO users (email, role, salt, password_hash, must_change, username, office) VALUES ('vcharyanaco@gmail.com','ADMIN','s','h',0,'co_admin','Admin')"
  ).run();
  const now = Date.now();
  db.prepare(
    "INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed) VALUES ('s1', 4, '', 'vcharyanaco@gmail.com', 'progress report', ?, ?, 1)"
  ).run(now, now);
  db.prepare(
    "INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed) VALUES ('s2', 5, '', 'other@example.com', 'meeting done', ?, ?, 1)"
  ).run(now, now);

  const overview = submissions.getSubmissionOverview_();
  const displayed = overview.displayed;
  assert.strictEqual(displayed.length, 2);

  const mine = displayed.find(function (s) { return s.cardRow === 4; });
  assert.strictEqual(mine.email, 'vcharyanaco@gmail.com');
  assert.strictEqual(mine.office, 'Admin', 'office resolved from the matching user row');

  const other = displayed.find(function (s) { return s.cardRow === 5; });
  assert.strictEqual(other.office, '', 'unknown submitter falls back to empty office');
});

test('getSubmissionOverview_ displayed entries carry id + per-user flags when a user is supplied', function () {
  db.prepare(
    "INSERT INTO submissions (id, card_row, card_id, email, text, created_at, updated_at, displayed) VALUES ('s3', 6, 'card-6', 'other@example.com', 'inline manage', ?, ?, 1)"
  ).run(Date.now(), Date.now());

  // A non-owner editor: can lock and can edit any unlocked submission.
  const overview = submissions.getSubmissionOverview_({ email: 'editor@example.com', role: 'EDITOR' });
  const entry = overview.displayed.find(function (s) { return s.id === 's3'; });
  assert.ok(entry, 'displayed entry carries the submission id');
  assert.strictEqual(entry.cardRow, 6);
  assert.strictEqual(entry.editable, true, 'editor edits any unlocked submission');
  assert.strictEqual(entry.canLock, true, 'editor can lock an unlocked submission');
  assert.strictEqual(entry.canUnlock, false, 'not unlocked yet');
  assert.strictEqual(entry.displayed, true);
  assert.strictEqual(entry.isOwner, false);
});
