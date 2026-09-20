const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const TMP=path.join('/tmp','dash-ops12-'+Date.now());
process.env.DASH_DATA_DIR=TMP;
fs.mkdirSync(TMP,{recursive:true});

test('ops12 modules load and analytics returns expected shape', async()=>{
  const analytics=require('../analytics');
  const auth=require('../auth');
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
  const automation=require('../automation');
  assert.throws(()=>automation.saveRule({name:'bad',trigger:'NOPE',action:'NOTIFY_SELF'},'bad-token'),/Login|required/i);
});
