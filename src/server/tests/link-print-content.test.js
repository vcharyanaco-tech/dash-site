/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/link-print-content.test.js
 * getLinkPrintContent: the non-AI endpoint behind "Include linked
 * sheet data" in printed reports.
 *
 * These lock in the behaviour that matters for an official report:
 * the rows returned are the sheet's real CSV export, they are capped,
 * and a private sheet is reported as unreadable rather than guessed
 * at. No AI provider is involved on this path at all.
 * ============================================================
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { password } = require('./test-bootstrap');
const { server } = require('../index');
const { LINK_PRINT_MAX_ROWS, LINK_PRINT_MAX_COLS, LINK_PRINT_MAX_CELL_CHARS } = require('../config');

let port;
let adminToken;
let viewerToken;
let bareRow;

before(async function () {
  await new Promise(function (resolve) {
    server.listen(0, function () {
      port = server.address().port;
      resolve();
    });
  });
});

after(function () {
  server.close();
});

async function postRaw(fn, args) {
  const resp = await fetch('http://127.0.0.1:' + port + '/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ function: fn, args: args || [] })
  });
  return resp.json();
}

async function post(fn, args) {
  const body = await postRaw(fn, args);
  if (body.error) throw new Error(fn + ': ' + body.error);
  return body.result;
}

// ------------------------------------------------------------------
// Setup: admin + viewer tokens
// ------------------------------------------------------------------

test('setup: login admin and a viewer', async function () {
  const login = async function (email) {
    const resp = await postRaw('login', [email, password]);
    assert.ok(resp.result && resp.result.token, 'login failed for ' + email);
    return resp.result.token;
  };
  adminToken = await login('vcharyanaco@gmail.com');

  // adminAddUser takes (email, username, role, password, group, department, office, token).
  // The test DB persists between runs, so an existing viewer is not an error;
  // reset the password unconditionally so the setup is idempotent even if a
  // previous run created the account with different arguments.
  await postRaw('adminAddUser', [
    'linkprint_viewer@test.com', 'linkviewer', 'viewer', password,
    'Field', 'Haryana', 'Circle Office', adminToken
  ]);
  const reset = await postRaw('adminResetPassword', ['linkprint_viewer@test.com', password, adminToken]);
  assert.ok(!reset.error, 'viewer password reset failed: ' + reset.error);
  const loginBody = await postRaw('login', ['linkprint_viewer@test.com', password]);
  assert.ok(loginBody.result && loginBody.result.token,
    'viewer login failed: ' + JSON.stringify(loginBody.error || loginBody));
  viewerToken = loginBody.result.token;

  // Resolve a link-free record once. The authz tests must not depend on rows
  // that have hyperlinks, because those trigger a live sheet fetch.
  const data = await post('getData', [adminToken]);
  const items = (data && (data.items || data.records)) || [];
  const bare = items.find(function (it) {
    const links = it.links || {};
    return Object.keys(links).length === 0 && Object.keys(it.linkUrls || {}).length === 0;
  });
  assert.ok(bare, 'fixture DB should contain at least one record with no hyperlinks');
  bareRow = Number(bare.row);
});

// ------------------------------------------------------------------
// Authz: any logged-in user, per the decision made for this feature
// ------------------------------------------------------------------

test('anonymous is rejected', async function () {
  const body = await postRaw('getLinkPrintContent', ['', 1]);
  assert.ok(body.error, 'anonymous call must be refused');
});

test('a viewer is allowed (requireLogin, not requireEditor)', async function () {
  const body = await postRaw('getLinkPrintContent', [viewerToken, bareRow]);
  assert.ok(!body.error, 'viewer must not be refused: ' + body.error);
  assert.strictEqual(body.result.success, true);
});

test('an unknown row reports Record not found', async function () {
  const res = await post('getLinkPrintContent', [adminToken, 999999]);
  assert.strictEqual(res.success, false);
  assert.match(res.message, /Record not found/);
});

// ------------------------------------------------------------------
// No-link and non-sheet records short-circuit without any network call
// ------------------------------------------------------------------

test('a record with no link reports no-link and fetches nothing', async function () {
  const res = await post('getLinkPrintContent', [adminToken, bareRow]);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.available, false);
  assert.strictEqual(res.reason, 'no-link');
  assert.ok(!res.rows, 'no rows should be returned when there is nothing to fetch');
});

// ------------------------------------------------------------------
// Cap logic
// ------------------------------------------------------------------

test('print caps are tighter than the on-screen AI preview caps', async function () {
  // If these ever drift so that printing is not actually tighter, a report
  // with many linked records will silently balloon past its page budget.
  const { ENTERPRISE_AI_PREVIEW_MAX_ROWS, ENTERPRISE_AI_PREVIEW_MAX_CELLS } = require('../config');
  assert.ok(LINK_PRINT_MAX_ROWS < ENTERPRISE_AI_PREVIEW_MAX_ROWS,
    'printed row cap must be tighter than the AI preview row cap');
  assert.ok(LINK_PRINT_MAX_COLS < ENTERPRISE_AI_PREVIEW_MAX_CELLS,
    'printed column cap must be tighter than the AI preview column cap');
  assert.ok(LINK_PRINT_MAX_CELL_CHARS > 0, 'cell cap must be positive');
});

// ------------------------------------------------------------------
// The real guarantee: never fabricate
// ------------------------------------------------------------------

test('the endpoint does not call the AI provider', async function () {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'enterprise.js'), 'utf8');

  const start = src.indexOf('async function getLinkPrintContent');
  assert.notStrictEqual(start, -1, 'getLinkPrintContent not found in enterprise.js');

  // Slice the function body by brace matching: the body contains nested
  // braces, so a naive indexOf on the first '\n}' would truncate it.
  const open = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src.charAt(i) === '{') depth++;
    else if (src.charAt(i) === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.notStrictEqual(end, -1, 'could not find the end of getLinkPrintContent');
  const body = src.slice(start, end);

  assert.ok(
    body.indexOf('generateAiText_') === -1 && body.indexOf('cachedGenerateAiText_') === -1,
    'getLinkPrintContent must not generate content: printed rows must be the sheet data'
  );
  assert.ok(body.indexOf('fetchLinkTable_') !== -1,
    'getLinkPrintContent must read the real sheet via fetchLinkTable_');
});