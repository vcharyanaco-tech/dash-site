const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Isolated DB dir per run
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'multilink-'));
process.env.DASH_DATA_DIR = DATA_DIR;
process.env.DASH_IMPORT_DIR = path.join(__dirname, '..', '..', 'data', 'export');
process.env.DASH_IMPORT_SKIP = '1';

const { db } = require('../db');
const records = require('../records');

function setup() {
  const auth = require('../auth');
  db.prepare("INSERT INTO users (email, role, salt, password_hash, must_change, created_by, created_at, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, '', 0, 'admin')").run();
  const session = db.prepare("INSERT INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, " + (Date.now() + 3600000) + ")").run();
}

test('multi-link record: links array round-trips and renders stacked', async () => {
  setup();
  const token = 'tok';
  // add with two links on action
  const added = await records.addItem({
    sector: 'Test', description: 'Multi-link record',
    entryDate: '01.08.2026', action: 'Do things', responsibility: 'All', reviewDate: '10.08.2026',
    links: { action: [ { text: 'Link one', url: 'https://example.com/1' }, { text: 'Link two', url: 'https://example.com/2' } ] }
  }, token);
  const mine = added.items.filter(i => String(i.description) === 'Multi-link record');
  assert.strictEqual(mine.length, 1);
  const item = mine[0];
  // item carries full link list
  assert.ok(Array.isArray(item.links.action));
  assert.strictEqual(item.links.action.length, 2);
  assert.strictEqual(item.links.action[0].url, 'https://example.com/1');
  assert.strictEqual(item.links.action[1].url, 'https://example.com/2');
  // legacy first-link fields still populated
  assert.strictEqual(item.linkUrls.action, 'https://example.com/1');
  assert.strictEqual(item.linkTexts.action, 'Link one');
  // actionHtml renders both anchors with a blank line between
  const html = item.actionHtml;
  assert.ok(html.includes('example.com/1'), 'first link anchor present');
  assert.ok(html.includes('example.com/2'), 'second link anchor present');
  assert.ok(html.includes('<br><br>'), 'blank line separator present');
  // stored JSON is array form
  const row = db.prepare('SELECT links FROM records WHERE row = ?').get(item.row);
  const stored = JSON.parse(row.links);
  assert.ok(Array.isArray(stored.action));
  assert.strictEqual(stored.action.length, 2);
  // cleanup
  records.deleteItem(item.row, token);
});

test('multi-link record: legacy single-object links still accepted', async () => {
  const token = 'tok';
  const added = await records.addItem({
    sector: 'Legacy', description: 'Single link record',
    entryDate: '01.08.2026', action: 'Do', responsibility: 'All', reviewDate: '10.08.2026',
    links: { action: { text: 'Old link', url: 'https://example.com/old' } }
  }, token);
  const mine = added.items.filter(i => String(i.description) === 'Single link record');
  assert.strictEqual(mine.length, 1);
  const item = mine[0];
  assert.ok(Array.isArray(item.links.action));
  assert.strictEqual(item.links.action.length, 1);
  assert.strictEqual(item.linkUrls.action, 'https://example.com/old');
  records.deleteItem(item.row, token);
});
