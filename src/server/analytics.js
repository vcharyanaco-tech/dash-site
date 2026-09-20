'use strict';

const { db } = require('./db');
const auth = require('./auth');

function dayStart(ts) { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function monthStart(ts) { const d = new Date(ts); d.setDate(1); d.setHours(0,0,0,0); return d.getTime(); }
function isoDay(ts) { return new Date(ts).toISOString().slice(0,10); }
function safeDate(s) { const t = s ? new Date(s).getTime() : 0; return Number.isFinite(t) ? t : 0; }

function getAnalytics(range, token) {
  auth.requireLogin(token);
  range = range || {};
  const days = Math.max(7, Math.min(366, Number(range.days) || 30));
  const now = Date.now();
  const from = now - days * 86400000;
  const records = db.prepare('SELECT row,id,sector,entry_date,review_date,created_at,updated_at FROM records').all();
  const tasks = db.prepare('SELECT id,status,priority,due_date,created_at,completed_at,updated_at,assignee FROM tasks').all();
  const submissions = db.prepare('SELECT id,card_row,created_at,updated_at FROM submissions').all();
  const notifications = db.prepare('SELECT id,type,priority,created_at,read_at FROM notifications WHERE created_at >= ?').all(from);

  const daily = {};
  for (let i=0;i<days;i++) { const t=dayStart(now-i*86400000); daily[isoDay(t)]={date:isoDay(t),records:0,submissions:0,tasksCompleted:0,notifications:0}; }
  records.forEach(r=>{ const t=safeDate(r.created_at); if(t>=from){const k=isoDay(t); if(daily[k])daily[k].records++;} });
  submissions.forEach(s=>{ const t=safeDate(s.created_at); if(t>=from){const k=isoDay(t); if(daily[k])daily[k].submissions++;} });
  tasks.forEach(t=>{ const x=safeDate(t.completed_at); if(x>=from){const k=isoDay(x); if(daily[k])daily[k].tasksCompleted++;} });
  notifications.forEach(n=>{ const k=isoDay(Number(n.created_at)); if(daily[k])daily[k].notifications++; });

  const dueReviews=records.filter(r=>{const t=safeDate(r.review_date);return t>0&&t<=now;}).length;
  const overdueTasks=tasks.filter(t=>t.status!=='DONE'&&t.status!=='CANCELLED'&&Number(t.due_date||0)>0&&Number(t.due_date)<=now).length;
  const completed=tasks.filter(t=>t.status==='DONE').length;
  const open=tasks.filter(t=>t.status!=='DONE'&&t.status!=='CANCELLED').length;
  const completedInRange=tasks.filter(t=>t.status==='DONE'&&Number(t.completed_at||0)>=from).length;
  const createdInRange=tasks.filter(t=>Number(t.created_at||0)>=from).length;
  const turnaround=tasks.filter(t=>t.status==='DONE'&&t.created_at&&t.completed_at).map(t=>Number(t.completed_at)-Number(t.created_at));
  const avgTurnaroundMs=turnaround.length?Math.round(turnaround.reduce((a,b)=>a+b,0)/turnaround.length):0;
  const unreadNotifications=notifications.filter(n=>!n.read_at).length;
  const highPriorityNotifications=notifications.filter(n=>Number(n.priority)>=1&&!n.read_at).length;
  const sectors={}; records.forEach(r=>{const k=String(r.sector||'Unassigned').trim()||'Unassigned';sectors[k]=(sectors[k]||0)+1;});
  const priority={}; tasks.forEach(t=>{const k=String(t.priority||'MEDIUM').toUpperCase();priority[k]=(priority[k]||0)+1;});
  const assignees={}; tasks.filter(t=>t.status!=='DONE'&&t.status!=='CANCELLED').forEach(t=>{const k=String(t.assignee||'Unassigned').trim()||'Unassigned';assignees[k]=(assignees[k]||0)+1;});

  return {
    range:{days,from,to:now},
    kpis:{records:records.length,reviewsDue:dueReviews,overdueTasks,openTasks:open,completedTasks:completed,completedInRange,createdTasksInRange,avgTaskTurnaroundHours:Math.round(avgTurnaroundMs/3600000*10)/10,submissionsInRange:submissions.filter(s=>Number(s.created_at||0)>=from).length,unreadNotifications,highPriorityUnread:highPriorityNotifications},
    trends:Object.keys(daily).sort().map(k=>daily[k]),
    breakdowns:{sectors,taskPriority:priority,openTasksByAssignee:assignees},
    generatedAt:now
  };
}

module.exports={getAnalytics};
