'use strict';
const crypto=require('crypto');
const {db}=require('./db');
const auth=require('./auth');
function hash(v){return crypto.createHash('sha256').update(String(v)).digest('hex');}
function getSecurityStatus(token){const user=auth.requireAdmin(token);const sessions=db.prepare('SELECT COUNT(*) n FROM sessions WHERE expires_at>?').get(Date.now());const users=db.prepare('SELECT COUNT(*) n FROM users').get();const audit=db.prepare('SELECT COUNT(*) n FROM audit').get();return{admin:user.email,sessions:Number(sessions.n),users:Number(users.n),auditRows:Number(audit.n),dbPath:process.env.DASH_DATA_DIR?'custom':'default',generatedAt:Date.now()};}
function rotateSession(token){
  const user=auth.requireLogin(token);
  const dbmod=require('./db');
  const fresh=dbmod.createSession_(user.email);
  dbmod.destroySession_(token);
  try { require('./audit').logAudit_('ROTATE_SESSION','','Session rotated',user.email); } catch(e){}
  return{token:fresh,success:true,user:{email:user.email,role:user.role}};
}
module.exports={getSecurityStatus,rotateSession,hash};
