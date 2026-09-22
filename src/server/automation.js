'use strict';
const { db, cacheGetTTL, cachePut } = require('./db');
const auth = require('./auth');
const notifications = require('./notifications');
const { uuid_ } = require('./helpers');

const KEY='automation_rules_v1';
function loadRules_(){ const row=db.prepare('SELECT value FROM settings WHERE key=?').get(KEY); if(!row)return[]; try{return JSON.parse(row.value)||[];}catch(e){return[];} }
function saveRules_(rules){ db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(KEY,JSON.stringify(rules)); }
function cleanRule_(r){
  r=r||{}; const trigger=String(r.trigger||'').toUpperCase(); const action=String(r.action||'').toUpperCase();
  const allowedT=['SUBMISSION_CREATED','TASK_OVERDUE','REVIEW_DUE','MORNING_BRIEFING','REVIEW_COMPLETED','TASK_COMPLETED'];
  const allowedA=['NOTIFY_SELF','NOTIFY_STAFF','CREATE_TASK'];
  if(allowedT.indexOf(trigger)<0||allowedA.indexOf(action)<0) throw new Error('Unsupported automation trigger or action.');
  return {id:String(r.id||uuid_()),name:String(r.name||'Untitled rule').trim().slice(0,120)||'Untitled rule',enabled:r.enabled!==false,trigger,action,config:r.config&&typeof r.config==='object'?r.config:{},createdAt:Number(r.createdAt)||Date.now(),updatedAt:Date.now()};
}
function listRules(token){auth.requireLogin(token);return{rules:loadRules_()};}
function saveRule(rule,token){auth.requireEditor(token);const clean=cleanRule_(rule);const rules=loadRules_();const i=rules.findIndex(x=>x.id===clean.id);if(i>=0)rules[i]=clean;else rules.push(clean);saveRules_(rules);return{rule:clean,rules};}
function deleteRule(id,token){auth.requireEditor(token);const rules=loadRules_().filter(x=>x.id!==String(id));saveRules_(rules);return{rules};}
function evaluate_(trigger,payload){
  const rules=loadRules_().filter(r=>r.enabled&&r.trigger===String(trigger).toUpperCase()); if(!rules.length)return{matched:0,actions:0};
  let actions=0;
  rules.forEach(r=>{
    const cfg=r.config||{}; const email=String(payload&&payload.email||'').toLowerCase();
    try{
      if(r.action==='NOTIFY_SELF'&&email){notifications.appendNotification_(email,'system',String(cfg.title||r.name),String(cfg.body||payload.message||''),String(cfg.link||''),{priority:Number(cfg.priority)||0,dedupeKey:'auto:'+r.id+':'+String(payload.key||payload.id||Date.now()),dedupeTtlSeconds:Number(cfg.dedupeTtlSeconds)||21600,recordRow:Number(payload.recordRow)||0});actions++;}
      else if(r.action==='NOTIFY_STAFF'){notifications.notifyStaff_( 'system', String(cfg.title||r.name), String(cfg.body||payload.message||''), String(cfg.link||''), email,{priority:Number(cfg.priority)||0,recordRow:Number(payload.recordRow)||0,dedupeKey:'auto:'+r.id+':'+String(payload.key||payload.id||Date.now()),dedupeTtlSeconds:Number(cfg.dedupeTtlSeconds)||21600});actions++;}
      else if(r.action==='CREATE_TASK'){
        // Idempotency: runScheduled fires every ~60s, so an overdue/due
        // trigger would re-create the task on every tick. Dedupe per rule +
        // payload key within the TTL (mirrors the notification dedupe).
        const dedupeKey='auto_task_'+r.id+':'+String(payload.key||payload.id||'any')+':'+String(cfg.assignee||email||'').toLowerCase();
        if(cacheGetTTL(dedupeKey))return;
        cachePut(dedupeKey,'1',Number(cfg.dedupeTtlSeconds)||21600);
        const taskId=uuid_(); const now=Date.now(); const assignee=String(cfg.assignee||email||'').toLowerCase();
        const dueDays=Math.max(0,Math.min(365,Number(cfg.dueDays)||1));
        db.prepare('INSERT INTO tasks (id,record_row,record_id,title,description,assignee,status,priority,due_date,created_by,created_at,updated_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(taskId,Number(payload.recordRow)||0,String(payload.recordId||''),String(cfg.taskTitle||r.name),String(cfg.taskDescription||payload.message||''),assignee,'OPEN',String(cfg.priority||'MEDIUM').toUpperCase(),Date.now()+dueDays*86400000,'automation',now,now,null);
        if(assignee) notifications.appendNotification_(assignee,'user','Automated task created',String(cfg.taskTitle||r.name),'',{priority:Number(cfg.priorityValue)||0,recordRow:Number(payload.recordRow)||0,groupKey:'automation:'+r.id});
        actions++;
      }
    }catch(err){console.error('Automation rule '+r.id+' failed: '+err.message);}
  });
  return{matched:rules.length,actions};
}
function runScheduled(){
  const now=new Date(); const key=now.toISOString().slice(0,10);
  const last=db.prepare('SELECT value FROM settings WHERE key=?').get('automation_last_day');
  const result={morning:0,overdue:0,review:0};
  if(now.getHours()>=8&&(!last||last.value!==key)){
    const r=evaluate_('MORNING_BRIEFING',{key:'morning:'+key,message:'Your Dash morning briefing is ready. Open My Day to review today\'s workload.'});result.morning=r.actions;
    db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('automation_last_day',key);
  }
  const dueTasks=db.prepare("SELECT id,title,assignee,record_row FROM tasks WHERE status NOT IN ('DONE','CANCELLED') AND due_date IS NOT NULL AND due_date>0 AND due_date<?").all(Date.now());
  dueTasks.forEach(t=>{const r=evaluate_('TASK_OVERDUE',{id:t.id,key:'task:'+t.id+':overdue',email:t.assignee,recordRow:t.record_row,message:'Task overdue: '+t.title});result.overdue+=r.actions;});
  const reviews=db.prepare('SELECT row,id FROM records WHERE review_date IS NOT NULL AND review_date<>\'\'').all();
  const today=new Date();today.setHours(0,0,0,0);const tomorrow=today.getTime()+86400000;
  reviews.forEach(x=>{const rec=db.prepare('SELECT review_date FROM records WHERE row=?').get(x.row);const t=rec&&rec.review_date?new Date(rec.review_date).getTime():0;if(t>=today.getTime()&&t<tomorrow){const r=evaluate_('REVIEW_DUE',{key:'review:'+x.row+':'+key,recordRow:x.row,message:'Review due today for record #'+x.id});result.review+=r.actions;}});
  return result;
}
module.exports={listRules,saveRule,deleteRule,evaluate_,runScheduled};
