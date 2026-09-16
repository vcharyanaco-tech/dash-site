/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/documents.test.js
 * Phase 1E: file-upload edge cases — MIME allowlist, size cap,
 * name sanitization, base64 validation, resolveDocumentFile key
 * integrity. DASH_MAX_UPLOAD_BYTES is set to 1024 so the
 * size-limit rejection is exercised with a tiny payload.
 * Run: npm test  (node --test tests/)
 * ============================================================
 */

process.env.DASH_MAX_UPLOAD_BYTES = '1024';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const documents = require('../documents');
const { db } = require('../db');

let port;
let token;
let cookie = '';
const createdDocs = [];

before(async function () {
  await new Promise(function (resolve) {
    server.listen(0, function () {
      port = server.address().port;
      resolve();
    });
  });
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: 'login', args: ['vcharyanaco@gmail.com', password] })
  });
  const res = await resp.json();
  assert.strictEqual(res.result.success, true);
  token = res.result.token;
  cookie = (resp.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie.startsWith('dash_session='));
});

after(function () {
  server.close();
  for (const id of createdDocs) {
    try { documents.deleteDocument(id, token); } catch (err) {}
  }
});

async function postRaw(fn, args, useCookie) {
  const headers = { 'Content-Type': 'text/plain' };
  if (useCookie && cookie) headers.Cookie = cookie;
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ function: fn, args: args || [] })
  });
  return resp.json();
}

async function post(fn, args, useCookie) {
  const body = await postRaw(fn, args, useCookie);
  if (body.error) throw new Error(fn + ': ' + body.error);
  return body.result;
}

function b64(s) { return Buffer.from(String(s)).toString('base64'); }

function trackUpload(doc) {
  if (doc && doc.id) createdDocs.push(doc.id);
  return doc;
}

// ------------------------------------------------------------------
// Happy path + cookie injection (no token in args)
// ------------------------------------------------------------------

test('uploadDocument via cookie: upload, list, GET /files, delete', async function () {
  const uploaded = trackUpload(await post(
    'uploadDocument', [4, '', 'uploads-1e.txt', b64('Hello from 1E'), 'text/plain'], true));
  assert.ok(uploaded.driveFileId);

  const list = await post('getRecordDocuments', [4], true);
  const mine = list.find(function (d) { return d.id === uploaded.id; });
  assert.ok(mine);
  assert.strictEqual(mine.fileName, 'uploads-1e.txt');

  const resp = await fetch('http://127.0.0.1:' + port + '/api/files/' + uploaded.driveFileId, {
    headers: { Cookie: cookie }
  });
  assert.strictEqual(resp.status, 200);
  assert.strictEqual(await resp.text(), 'Hello from 1E');

  await post('deleteDocument', [uploaded.id], true);
  createdDocs.splice(createdDocs.indexOf(uploaded.id), 1);
  const afterList = await post('getRecordDocuments', [4], true);
  assert.ok(!afterList.some(function (d) { return d.id === uploaded.id; }));
});

// ------------------------------------------------------------------
// MIME allowlist
// ------------------------------------------------------------------

const allowedMimes = [
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png'
];

for (const mime of allowedMimes) {
  test('uploadDocument accepts allowed MIME: ' + mime, async function () {
    const doc = trackUpload(await post(
      'uploadDocument', [4, '', 'mime.bin', b64('x'), mime], true));
    assert.ok(doc.driveFileId);
  });
}

test('uploadDocument rejects unsupported MIME type', async function () {
  const body = await postRaw('uploadDocument', [4, '', 'x.exe', b64('MZ'), 'application/x-msdownload'], true);
  assert.ok(body.error);
  assert.match(body.error, /Unsupported document type/i);
});

test('uploadDocument accept MIME case-insensitively and trims whitespace', async function () {
  const doc = trackUpload(await post(
    'uploadDocument', [4, '', 'mime-case.txt', b64('y'), '  TEXT/PLAIN  '], true));
  assert.ok(doc.driveFileId);
});

// ------------------------------------------------------------------
// File-name sanitization
// ------------------------------------------------------------------

test('uploadDocument sanitizes illegal filename characters', async function () {
  const doc = trackUpload(await post(
    'uploadDocument', [4, '', 'a/b\\c:d*e?f"g<h>i|j.txt', b64('z'), 'text/plain'], true));
  const list = await post('getRecordDocuments', [4], true);
  const mine = list.find(function (d) { return d.id === doc.id; });
  assert.ok(mine);
  assert.ok(!/[\\/:*?"<>|]/.test(mine.fileName), 'no illegal chars: ' + mine.fileName);
});

test('uploadDocument truncates over-long filenames to 200 chars', async function () {
  const longName = new Array(260).join('n') + '.txt';
  const doc = trackUpload(await post(
    'uploadDocument', [4, '', longName, b64('w'), 'text/plain'], true));
  const list = await post('getRecordDocuments', [4], true);
  const mine = list.find(function (d) { return d.id === doc.id; });
  assert.ok(mine);
  assert.ok(mine.fileName.length <= 200);
});

test('uploadDocument falls back to "document" for empty filename', async function () {
  const doc = trackUpload(await post(
    'uploadDocument', [4, '', '   ', b64('v'), 'text/plain'], true));
  const list = await post('getRecordDocuments', [4], true);
  const mine = list.find(function (d) { return d.id === doc.id; });
  assert.strictEqual(mine.fileName, 'document');
});

// ------------------------------------------------------------------
// Base64 content validation
// ------------------------------------------------------------------

test('uploadDocument rejects invalid base64 characters', async function () {
  const body = await postRaw('uploadDocument', [4, '', 'bad.txt', 'not!@base64', 'text/plain'], true);
  assert.ok(body.error);
  assert.match(body.error, /Invalid file content/i);
});

test('uploadDocument rejects base64 whose length mod 4 is 1', async function () {
  const body = await postRaw('uploadDocument', [4, '', 'bad.txt', 'AAAAA', 'text/plain'], true);
  assert.ok(body.error);
  assert.match(body.error, /Invalid file content/i);
});

test('uploadDocument rejects empty content', async function () {
  const body = await postRaw('uploadDocument', [4, '', 'empty.txt', '', 'text/plain'], true);
  assert.ok(body.error);
  assert.match(body.error, /Invalid file content|Empty file content/i);
});

test('uploadDocument rejects whitespace-only content', async function () {
  const body = await postRaw('uploadDocument', [4, '', 'ws.txt', '   ', 'text/plain'], true);
  assert.ok(body.error);
  assert.match(body.error, /Invalid file content/i);
});

test('uploadDocument rejects base64 that decodes to empty bytes', async function () {
  const body = await postRaw('uploadDocument', [4, '', 'empty2.txt', '==', 'text/plain'], true);
  assert.ok(body.error);
  assert.match(body.error, /Empty file content/i);
});

// ------------------------------------------------------------------
// Size cap (1 KiB in this test process)
// ------------------------------------------------------------------

test('uploadDocument rejects content over the size cap', async function () {
  const big = b64(new Array(2100).join('1'));
  const body = await postRaw('uploadDocument', [4, '', 'big.txt', big, 'text/plain'], true);
  assert.ok(body.error);
  assert.match(body.error, /exceeds the .* limit/i);
});

// ------------------------------------------------------------------
// Auth: anonymous / garbage token
// ------------------------------------------------------------------

test('uploadDocument rejects anonymous dispatch calls', async function () {
  const body = await postRaw('uploadDocument', [4, '', 'anon.txt', b64('a'), 'text/plain', '']);
  assert.ok(body.error);
  assert.match(body.error, /login required|please log in/i);
});

test('deleteDocument rejects an invalid token', async function () {
  const body = await postRaw('deleteDocument', ['nonexistent', 'garbage-token']);
  assert.ok(body.error);
  assert.match(body.error, /login required|please log in/i);
});

// ------------------------------------------------------------------
// Record existence
// ------------------------------------------------------------------

test('uploadDocument rejects an unknown record row', async function () {
  const body = await postRaw('uploadDocument', [999999, '', 'norec.txt', b64('a'), 'text/plain'], true);
  assert.ok(body.error);
  assert.match(body.error, /Record not found/i);
});

// ------------------------------------------------------------------
// resolveDocumentFile / GET /files key integrity
// ------------------------------------------------------------------

test('GET /files/:key returns 404 for a bad key', async function () {
  const resp = await fetch('http://127.0.0.1:' + port + '/api/files/not-a-real-key', {
    headers: cookie ? { Cookie: cookie } : {}
  });
  assert.strictEqual(resp.status, 404);
});

test('resolveDocumentFile returns null for keys not in the DB', async function () {
  const good = await post('uploadDocument', [4, '', 'resolve.txt', b64('abc'), 'text/plain'], true);
  trackUpload(good);
  assert.strictEqual(documents.resolveDocumentFile('aaaa'), null);
  // Valid uploaded key resolves to a file path (token required).
  const found = documents.resolveDocumentFile(good.driveFileId, token);
  assert.ok(found && found.path);
});

test('resolveDocumentFile rejects an invalid token even for a valid key', async function () {
  const good = await post('uploadDocument', [4, '', 'resolve-auth.txt', b64('x'), 'text/plain'], true);
  trackUpload(good);
  assert.throws(function () {
    documents.resolveDocumentFile(good.driveFileId, 'garbage-token');
  }, /login required|please log in/i);
});

test('resolveDocumentFile returns null when the DB row has a non-hex key', async function () {
  const now = Date.now();
  db.prepare(
    "INSERT INTO documents (id, record_row, record_id, file_name, file_key, mime_type, size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run('1e-badkey-id', 4, '', 'badkey.txt', '....not-hex....', 'text/plain', 1, 'vcharyanaco@gmail.com', now);
  assert.strictEqual(documents.resolveDocumentFile('....not-hex....', token), null);
  db.prepare('DELETE FROM documents WHERE id = ?').run('1e-badkey-id');
});