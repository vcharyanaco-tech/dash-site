/**
 * ============================================================
 * India Post Dashboard — Node port
 * seed.js
 * Idempotent bootstrap: default settings, bootstrap admin user,
 * and a small set of demo records when the records table is empty.
 * ============================================================
 */

const { db, seedDefaultSettings, getAppSettings } = require('./db');
const auth = require('./auth');
const { CONFIG, ADMIN_USERS } = require('./config');

seedDefaultSettings();
auth.ensureBootstrapAdmin();

const count = db.prepare('SELECT COUNT(*) AS c FROM records').get().c;

function nextRow() {
  const last = db.prepare('SELECT MAX(row) AS m FROM records').get().m || 0;
  return Math.max(CONFIG.SHEET.START_ROW, Number(last) + 1);
}

if (count === 0) {
  const demo = [
    {
      sector: 'Mail Operations',
      description: 'Streamline sorting and dispatch of speed-post mail.',
      entryDate: '01.08.2026',
      action: 'Review dispatch schedule with divisional heads',
      responsibility: 'do_gurugram',
      reviewDate: '12.08.2026'
    },
    {
      sector: 'Finance',
      description: 'Reconcile counter cash receipts for Q2.',
      entryDate: '02.08.2026',
      action: 'Verify daily cash collection against ledger',
      responsibility: 'RMS Haryana',
      reviewDate: '15.08.2026'
    },
    {
      sector: 'Logistics',
      description: 'Optimise last-mile delivery routes in rural blocks.',
      entryDate: '03.08.2026',
      action: 'Map delivery points and propose route changes',
      responsibility: 'all postal divisional heads',
      reviewDate: '18.08.2026'
    }
  ];
  const stmt = db.prepare(
    'INSERT INTO records (row, sector, description, entry_date, action, responsibility, review_date, links, review_bg, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  demo.forEach(function (d) {
    const row = nextRow();
    stmt.run(
      row,
      d.sector,
      d.description,
      d.entryDate,
      d.action,
      d.responsibility,
      d.reviewDate,
      '{}',
      CONFIG.COLORS.NORMAL,
      Date.now(),
      Date.now()
    );
  });
  console.log('Seeded ' + demo.length + ' demo records.');
} else {
  console.log('Records table already has ' + count + ' row(s); skipped demo seeding.');
}

console.log('Settings: ' + JSON.stringify(getAppSettings()));
console.log('Bootstrap admin: ' + ADMIN_USERS[0]);
console.log('Seed complete.');
