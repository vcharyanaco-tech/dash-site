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
  db.prepare("INSERT INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, '', 0, 'admin')").run();
  db.prepare("INSERT INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, " + (Date.now() + 3600000) + ")").run();
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
