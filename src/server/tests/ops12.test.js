const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'dash-ops12-'));
process.env.DASH_DATA_DIR=TMP;
const { db } = require('../db');

function seedAdmin() {
  db.prepare("INSERT OR IGNORE INTO users (email, role, salt, password_hash, must_change, username) VALUES ('a@x.com', 'ADMIN', 'salt', 'x', 0, 'admin')").run();
  db.prepare("INSERT OR IGNORE INTO sessions (token, email, created_at, expires_at) VALUES ('tok', 'a@x.com', 0, ?)").run(Date.now() + 3600000);
}

test('ops12 modules load and analytics returns expected shape', async()=>{
  seedAdmin();
  const analytics=require('../analytics');
  const db=require('../db').db;
  const admin=db.prepare('SELECT email FROM users LIMIT 1').get();
  assert.ok(admin);
  // create a temporary session for whichever seeded user exists
  const token=require('../db').createSession_(admin.email);
  const result=analytics.getAnalytics({days:7},token);
  assert.ok(result.kpis);
  assert.ok(Array.isArray(result.trends));
});

test('automation rules reject invalid trigger/action',()=>{
  seedAdmin();
  const automation=require('../automation');
  assert.throws(()=>automation.saveRule({name:'bad',trigger:'NOPE',action:'NOTIFY_SELF'},'bad-token'),/Login|required/i);
});
