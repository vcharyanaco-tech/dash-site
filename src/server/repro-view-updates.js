require('./tests/test-bootstrap.js');
const auth = require('./auth');
const records = require('./records');
const submissions = require('./submissions');

const r = auth.login('vcharyanaco@gmail.com', process.env.DASH_BOOTSTRAP_ADMIN_PASSWORD);
console.log('login success:', !!r.success);
if (!r.success) { console.log(JSON.stringify(r)); process.exit(0); }

const data = records.getAppData(r.token);
const row5 = data.items.find(i => Number(i.row) === 5);
if (!row5) { console.log('no row 5'); process.exit(0); }
const subCount = (data.submissionCounts || {})[row5.row] || 0;
const updatesCount = data.displayedSubmissions.filter(s => Number(s.cardRow) === Number(row5.row)).length;
console.log('Record #2 (row5): subCount=' + subCount + ' updatesCount=' + updatesCount);
console.log('  buttons:', subCount > 0 ? (updatesCount > 0 ? 'Show/Hide toggle' : 'View updates button') : 'nothing');

const subs = submissions.getSubmissions(r.token, 5);
console.log('getSubmissions(5): ' + subs.length);
subs.forEach(s => console.log('   -', s.email, '| displayed:', s.displayed, '| editable(delete visible):', s.editable));