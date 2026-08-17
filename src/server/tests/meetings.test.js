// Meeting library: saved recordings + minutes are listed, downloaded as
// editable files, and deletable. Also covers the Groq-first minutes provider.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'meetings-'));
process.env.DASH_DATA_DIR = TMP;
process.env.DASH_IMPORT_SKIP = '1';

const { db } = require('../db');
const enterprise = require('../enterprise');

function setup() {
  db.prepare("INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, '', 0, 'admin')").run();
  db.prepare("INSERT OR IGNORE INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, " + (Date.now() + 3600000) + ")").run();
}

test('meeting library: list, download, delete saved files', function () {
  setup();
  const dir = path.join(TMP, 'meetings');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Test meeting_2026-08-15_1200.md'), '# Test meeting\n\n## Summary\nhello');
  fs.writeFileSync(path.join(dir, 'Test meeting_2026-08-15_1200.mp3'), Buffer.from('fakeaudio'));

  // list groups notes vs audio, newest first, with friendly titles
  const list = enterprise.listMeetingFiles('tok');
  assert.strictEqual(list.success, true);
  assert.strictEqual(list.total, 2);
  assert.strictEqual(list.notes.length, 1);
  assert.strictEqual(list.audio.length, 1);
  assert.strictEqual(list.notes[0].title, 'Test meeting');
  assert.strictEqual(list.audio[0].title, 'Test meeting');

  // download returns the editable markdown as base64
  const dl = enterprise.getMeetingFile('tok', 'Test meeting_2026-08-15_1200.md');
  assert.strictEqual(dl.success, true);
  assert.strictEqual(dl.mimeType, 'text/markdown');
  assert.strictEqual(Buffer.from(dl.base64, 'base64').toString(), '# Test meeting\n\n## Summary\nhello');

  // path traversal is rejected
  const bad = enterprise.getMeetingFile('tok', '../dashboard.db');
  assert.strictEqual(bad.success, false);
  assert.strictEqual(enterprise.deleteMeetingFile('tok', '../dashboard.db').success, false);

  // delete removes from the server
  const del = enterprise.deleteMeetingFile('tok', 'Test meeting_2026-08-15_1200.mp3');
  assert.strictEqual(del.success, true);
  const after = enterprise.listMeetingFiles('tok');
  assert.strictEqual(after.total, 1);
  assert.strictEqual(after.audio.length, 0);

  // unknown file is reported cleanly
  assert.strictEqual(enterprise.getMeetingFile('tok', 'nope.mp3').success, false);
});

test('generateAiText_ accepts a provider override (groq first, graceful failure without key)', async function () {
  const r = await enterprise.generateAiText_('Say hi', '', { provider: 'groq', model: 'llama-3.3-70b-versatile' });
  assert.ok(r && typeof r === 'object');
  assert.strictEqual(typeof r.success, 'boolean');
  // Without a Groq key the primary provider fails and the Kilo free fallback
  // may kick in — either way it must not throw.
});

test('ask AI history persists per record: save, reload, cap, clear', function () {
  setup();
  // Unknown row is rejected; history must be an array.
  assert.strictEqual(enterprise.saveAskLinkHistory('tok', 0, []).success, false);
  assert.strictEqual(enterprise.saveAskLinkHistory('tok', 1, 'nope').success, false);

  // Save two Q&As, reload as a map, verify order (newest last).
  let r = enterprise.saveAskLinkHistory('tok', 1, [
    { question: 'What is this?', answer: 'A record' },
    { question: 'Next?', answer: 'Another answer' }
  ]);
  assert.strictEqual(r.success, true);
  const all = enterprise.getAllAskLinkHistory('tok');
  assert.strictEqual(all.success, true);
  assert.deepStrictEqual(all.history['1'], [
    { question: 'What is this?', answer: 'A record' },
    { question: 'Next?', answer: 'Another answer' }
  ]);

  // Over-length answers/questions are truncated; empty questions dropped.
  r = enterprise.saveAskLinkHistory('tok', 2, [{ question: '', answer: 'x' }, { question: 'q', answer: 'y'.repeat(25000) }]);
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.history.length, 1);
  assert.strictEqual(r.history[0].answer.length, 20000);

  // Cap at ASK_LINK_HISTORY_MAX (10) entries per row.
  const many = [];
  for (let i = 0; i < 15; i++) many.push({ question: 'q' + i, answer: 'a' + i });
  r = enterprise.saveAskLinkHistory('tok', 3, many);
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.history.length, 10);
  assert.strictEqual(r.history[9].question, 'q14');

  // Clearing writes an empty array (server copy gone on next load).
  enterprise.saveAskLinkHistory('tok', 1, []);
  assert.deepStrictEqual(enterprise.getAllAskLinkHistory('tok').history['1'], []);

  // Editor-gated: a non-editor token is rejected.
  db.prepare("INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES ('v@x.com', 'VIEWER', 'salt', 'x', 0, '', 0, 'viewer')").run();
  db.prepare("INSERT OR IGNORE INTO sessions (token, email, created_at, expires_at) VALUES ('vtok', 'v@x.com', 0, " + (Date.now() + 3600000) + ")").run();
  assert.throws(function () { enterprise.getAllAskLinkHistory('vtok'); }, /Editor permission required/);
  assert.throws(function () { enterprise.saveAskLinkHistory('vtok', 1, []); }, /Editor permission required/);
});

test('askLinkAi validates input before ever calling the AI provider', async function () {
  setup();
  // Empty/whitespace question is rejected without hitting the network.
  let r = await enterprise.askLinkAi('tok', 1, '   ');
  assert.strictEqual(r.success, false);
  assert.match(r.message, /question/i);
  // Over-long question is rejected.
  r = await enterprise.askLinkAi('tok', 1, 'x'.repeat(1001));
  assert.strictEqual(r.success, false);
  assert.match(r.message, /too long/i);
  // Unknown record is reported cleanly.
  r = await enterprise.askLinkAi('tok', 99999, 'Summarize this record');
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.message, 'Record not found.');
});
