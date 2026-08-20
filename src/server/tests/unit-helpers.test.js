/**
 * ============================================================
 * India Post Dashboard — Node port
 * tests/unit-helpers.test.js
 * Unit tests for pure helper functions (no DB, no network).
 * Run: node --test tests/unit-helpers.test.js
 * ============================================================
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Set up a temp DB dir so helpers/config can load without crashing
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-helpers-'));
process.env.DASH_DATA_DIR = TMP;
process.env.DASH_IMPORT_SKIP = '1';

const {
  sha256Hex_,
  hashPassword_,
  hashPasswordLegacy_,
  isLegacyHash_,
  isScryptHash_,
  generateSalt_,
  uuid_,
  isValidEmail_,
  isValidUsername_,
  validatePassword_,
  emailList_,
  primaryEmail_,
  emailsMatch_,
  isValidEmailList_,
  escHtml_,
  looksLikeUrl_,
  normalizeUrl_,
  buildSummaryFromItems,
  buildSectorReportFromSummary,
  buildFlaggedItemsFromItems,
  buildMonthlyTrendFromItems,
  buildAnalytics_,
  parseCsvLine_,
  parseCsv_,
  formatDate_,
  today_,
  daysUntilDate_,
  parseDisplayDate_,
  addDays_,
  htmlToText_,
  isSafeLinkUrl_
} = require('../helpers');

const { getReportTemplates } = require('../helpers');

/* ============================================================
 * Password hashing
 * ============================================================ */

test('hashPassword_ returns scrypt-prefixed hash', function () {
  const salt = generateSalt_();
  const hash = hashPassword_('password123', salt);
  assert.ok(isScryptHash_(hash), 'should be scrypt format');
  assert.ok(hash.startsWith('scrypt$'), 'should start with scrypt$');
  assert.strictEqual(hash.length, 'scrypt$'.length + 128); // 64 bytes = 128 hex chars
});

test('hashPassword_ is deterministic (same input => same output)', function () {
  const salt = 'fixed-salt-for-determinism-test';
  const h1 = hashPassword_('test', salt);
  const h2 = hashPassword_('test', salt);
  assert.strictEqual(h1, h2);
});

test('hashPassword_ produces different hashes for different passwords', function () {
  const salt = generateSalt_();
  assert.notStrictEqual(hashPassword_('a', salt), hashPassword_('b', salt));
});

test('hashPasswordLegacy_ produces 64-char hex', function () {
  const hash = hashPasswordLegacy_('test', 'salt');
  assert.ok(isLegacyHash_(hash));
  assert.strictEqual(hash.length, 64);
});

test('isLegacyHash_ and isScryptHash_ are mutually exclusive', function () {
  const legacy = hashPasswordLegacy_('p', 's');
  const modern = hashPassword_('p', 's');
  assert.ok(isLegacyHash_(legacy));
  assert.ok(!isLegacyHash_(modern));
  assert.ok(isScryptHash_(modern));
  assert.ok(!isScryptHash_(legacy));
});

/* ============================================================
 * UUID / Salt
 * ============================================================ */

test('uuid_ returns 32-char hex string', function () {
  const id = uuid_();
  assert.strictEqual(id.length, 32);
  assert.ok(/^[0-9a-f]+$/.test(id));
});

test('generateSalt_ returns unique values', function () {
  const s1 = generateSalt_();
  const s2 = generateSalt_();
  assert.notStrictEqual(s1, s2);
});

/* ============================================================
 * Email helpers
 * ============================================================ */

test('isValidEmail_ accepts valid addresses', function () {
  assert.ok(isValidEmail_('user@example.com'));
  assert.ok(isValidEmail_('a.b+c@d.co'));
  assert.ok(!isValidEmail_(''));
  assert.ok(!isValidEmail_('not-an-email'));
  assert.ok(!isValidEmail_('@no-local.com'));
  assert.ok(!isValidEmail_('no-at-sign.com'));
});

test('isValidUsername_ accepts valid usernames', function () {
  assert.ok(isValidUsername_('admin'));
  assert.ok(isValidUsername_('user.name'));
  assert.ok(isValidUsername_('co_admin'));
  assert.ok(isValidUsername_('test-user'));
  assert.ok(!isValidUsername_('ab')); // too short
  assert.ok(!isValidUsername_('')); // empty
  assert.ok(!isValidUsername_('user name')); // space
  assert.ok(!isValidUsername_('user@name')); // @
});

test('validatePassword_ rejects short passwords', function () {
  assert.ok(validatePassword_('short'));
  assert.ok(!validatePassword_('longenough'));
  assert.ok(!validatePassword_('8charsok'));
  assert.ok(validatePassword_(''));
  assert.ok(validatePassword_(null));
});

test('emailList_ splits and trims', function () {
  const list = emailList_(' a@x.com , B@y.com ');
  assert.deepStrictEqual(list, ['a@x.com', 'b@y.com']);
});

test('primaryEmail_ returns first email', function () {
  assert.strictEqual(primaryEmail_('a@x.com,b@y.com'), 'a@x.com');
  assert.strictEqual(primaryEmail_(''), '');
});

test('emailsMatch_ is case-insensitive', function () {
  assert.ok(emailsMatch_('User@Example.com', 'user@example.com'));
  assert.ok(!emailsMatch_('a@x.com', 'b@x.com'));
});

test('isValidEmailList_ validates all entries', function () {
  assert.ok(isValidEmailList_('a@x.com,b@y.com'));
  assert.ok(!isValidEmailList_('a@x.com,bad'));
  assert.ok(!isValidEmailList_(''));
});

/* ============================================================
 * HTML / URL helpers
 * ============================================================ */

test('escHtml_ escapes special characters', function () {
  assert.strictEqual(escHtml_('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.strictEqual(escHtml_("it's a test"), 'it&#39;s a test');
  assert.strictEqual(escHtml_('a & b'), 'a &amp; b');
});

test('looksLikeUrl_ detects URLs', function () {
  assert.ok(looksLikeUrl_('https://example.com'));
  assert.ok(looksLikeUrl_('www.example.com'));
  assert.ok(looksLikeUrl_('mailto:user@example.com'));
  assert.ok(!looksLikeUrl_('just text'));
  assert.ok(!looksLikeUrl_(''));
});

test('normalizeUrl_ adds https:// to www. URLs', function () {
  assert.strictEqual(normalizeUrl_('www.example.com'), 'https://www.example.com');
  assert.strictEqual(normalizeUrl_('https://example.com'), 'https://example.com');
  assert.strictEqual(normalizeUrl_(''), '');
});

test('isSafeLinkUrl_ blocks private IPs', function () {
  assert.ok(!isSafeLinkUrl_('http://localhost/api'));
  assert.ok(!isSafeLinkUrl_('http://127.0.0.1/secret'));
  assert.ok(!isSafeLinkUrl_('http://10.0.0.1/internal'));
  assert.ok(!isSafeLinkUrl_('http://192.168.1.1/admin'));
  assert.ok(!isSafeLinkUrl_('http://169.254.169.254/metadata'));
  assert.ok(isSafeLinkUrl_('https://example.com'));
});

test('htmlToText_ strips tags', function () {
  assert.strictEqual(htmlToText_('<b>hello</b> <i>world</i>'), 'hello world');
  assert.strictEqual(htmlToText_('no tags'), 'no tags');
});

/* ============================================================
 * Summary / Analytics builders
 * ============================================================ */

const sampleItems = [
  { sector: 'HR', flagged: true, reviewStatus: 'due', entryDate: '15.01.2026', responsibility: 'Office A', row: 4 },
  { sector: 'HR', flagged: false, reviewStatus: '', entryDate: '20.02.2026', responsibility: 'Office A', row: 5 },
  { sector: 'Finance', flagged: false, reviewStatus: 'done', entryDate: '10.03.2026', responsibility: 'Office B', row: 6 },
  { sector: 'IT', flagged: true, reviewStatus: 'due', entryDate: '05.08.2026', responsibility: 'Office C', row: 7 }
];

test('buildSummaryFromItems computes correct totals', function () {
  const summary = buildSummaryFromItems(sampleItems);
  assert.strictEqual(summary.total, 4);
  assert.strictEqual(summary.flagged, 2);
  assert.strictEqual(summary.normal, 2);
  assert.strictEqual(summary.sectors['HR'], 2);
  assert.strictEqual(summary.sectors['Finance'], 1);
  assert.strictEqual(summary.sectors['IT'], 1);
});

test('buildSummaryFromItems handles empty input', function () {
  const summary = buildSummaryFromItems([]);
  assert.strictEqual(summary.total, 0);
  assert.strictEqual(summary.flagged, 0);
  assert.deepStrictEqual(summary.sectors, {});
});

test('buildSectorReportFromSummary returns sorted sectors', function () {
  const summary = buildSummaryFromItems(sampleItems);
  const report = buildSectorReportFromSummary(summary);
  assert.strictEqual(report.length, 3);
  assert.strictEqual(report[0].sector, 'Finance');
  assert.strictEqual(report[1].sector, 'HR');
  assert.strictEqual(report[2].sector, 'IT');
});

test('buildFlaggedItemsFromItems returns only flagged', function () {
  const flagged = buildFlaggedItemsFromItems(sampleItems);
  assert.strictEqual(flagged.length, 2);
  assert.ok(flagged.every(function (i) { return i.flagged; }));
});

test('buildMonthlyTrendFromItems slices first 7 chars as key', function () {
  // Note: this function slices the first 7 chars of entryDate as the key.
  // For dd.MM.yyyy format the keys are like '15.01.2' (not 'yyyy-MM').
  // The buildAnalytics_ function does proper month extraction.
  const trend = buildMonthlyTrendFromItems(sampleItems);
  assert.strictEqual(trend['15.01.2'], 1); // 15.01.2026
  assert.strictEqual(trend['20.02.2'], 1); // 20.02.2026
  assert.strictEqual(trend['10.03.2'], 1); // 10.03.2026
  assert.strictEqual(trend['05.08.2'], 1); // 05.08.2026
  assert.strictEqual(Object.keys(trend).length, 4);
});

test('buildAnalytics_ computes sectors, offices, trend', function () {
  const analytics = buildAnalytics_(sampleItems);
  assert.strictEqual(analytics.total, 4);
  assert.strictEqual(analytics.flagged, 2);
  assert.strictEqual(analytics.normal, 2);
  assert.ok(analytics.sectors.length >= 3);
  assert.ok(analytics.offices.length >= 3);
  assert.ok(Array.isArray(analytics.trend));
});

test('buildAnalytics_ handles empty input', function () {
  const analytics = buildAnalytics_([]);
  assert.strictEqual(analytics.total, 0);
  assert.deepStrictEqual(analytics.sectors, []);
});

/* ============================================================
 * CSV parsing
 * ============================================================ */

test('parseCsvLine_ handles quoted fields', function () {
  const row = parseCsvLine_('"hello, world",simple,"with ""quotes"""');
  assert.deepStrictEqual(row, ['hello, world', 'simple', 'with "quotes"']);
});

test('parseCsvLine_ handles unquoted fields', function () {
  const row = parseCsvLine_('a,b,c');
  assert.deepStrictEqual(row, ['a', 'b', 'c']);
});

test('parseCsv_ parses multi-line CSV', function () {
  const csv = 'a,b,c\n1,2,3\n4,5,6';
  const rows = parseCsv_(csv);
  assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(rows[0], ['a', 'b', 'c']);
  assert.deepStrictEqual(rows[1], ['1', '2', '3']);
});

test('parseCsv_ handles CRLF', function () {
  const csv = 'a,b\r\n1,2';
  const rows = parseCsv_(csv);
  assert.strictEqual(rows.length, 2);
});

/* ============================================================
 * Date helpers
 * ============================================================ */

test('formatDate_ formats dd.MM.yyyy', function () {
  const d = new Date(2026, 0, 15, 10, 30, 0); // Jan 15 2026
  const result = formatDate_(d, 'dd.MM.yyyy');
  assert.strictEqual(result, '15.01.2026');
});

test('formatDate_ handles empty/null', function () {
  assert.strictEqual(formatDate_(null), '');
  assert.strictEqual(formatDate_(undefined), '');
  assert.strictEqual(formatDate_(''), '');
});

test('today_ returns a formatted date string', function () {
  const t = today_();
  assert.ok(/^\d{2}\.\d{2}\.\d{4}$/.test(t));
});

test('parseDisplayDate_ parses dd.MM.yyyy', function () {
  const d = parseDisplayDate_('15.01.2026');
  assert.ok(d instanceof Date);
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 0); // January
  assert.strictEqual(d.getDate(), 15);
});

test('parseDisplayDate_ returns null for invalid input', function () {
  assert.strictEqual(parseDisplayDate_('invalid'), null);
  assert.strictEqual(parseDisplayDate_(''), null);
  assert.strictEqual(parseDisplayDate_(null), null);
});

/* ============================================================
 * Report templates
 * ============================================================ */

/* ============================================================
 * Report templates
 * ============================================================ */

test('getReportTemplates returns at least 3 templates', function () {
  const templates = getReportTemplates();
  assert.ok(templates.length >= 3);
  assert.ok(templates.every(function (t) { return t.key && t.label; }));
});


