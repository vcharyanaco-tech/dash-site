/* ============================================================
 * Dash Workspace 2.0 — Global Search, Attention Center,
 * Executive Snapshot, Dash AI and Mobile Operating Mode.
 * Client-side orchestration layer; reuses existing APIs/UI.
 * ============================================================ */

var WORKSPACE_SEARCH_GEN = 0;
var WORKSPACE_SEARCH_TIMER = null;
var WORKSPACE_SEARCH_CACHE = { tasks: null, users: null, submissions: null, documents: null };
var WORKSPACE_MOBILE_KEY = 'dash_mobile_mode_v1';

function workspaceEnsureUi_() {
  if (!getEl('globalSearchModal')) {
    var s = document.createElement('div');
    s.id = 'globalSearchModal';
    s.className = 'modal-backdrop hidden workspace-search-modal';
    s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
    s.innerHTML = '<div class="modal-card workspace-search-card">' +
      '<div class="workspace-search-head"><div><h3 class="text-subheading">Global Search</h3><p class="section-copy">Find records, tasks, meetings, submissions, people and documents.</p></div><button class="icon-btn" type="button" onclick="closeGlobalSearch()" aria-label="Close search">×</button></div>' +
      '<div class="workspace-search-input-wrap"><span aria-hidden="true">⌕</span><input id="globalSearchInput" class="input workspace-search-input" type="search" placeholder="Search anything in Dash…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" name="" aria-label="Search anything in Dash"><kbd>Ctrl /</kbd></div>' +
      '<div id="globalSearchFilters" class="workspace-search-filters"><button class="btn btn-ghost btn-small active" data-filter="all" onclick="setGlobalSearchFilter(\'all\')">All</button><button class="btn btn-ghost btn-small" data-filter="record" onclick="setGlobalSearchFilter(\'record\')">Records</button><button class="btn btn-ghost btn-small" data-filter="task" onclick="setGlobalSearchFilter(\'task\')">Tasks</button><button class="btn btn-ghost btn-small" data-filter="submission" onclick="setGlobalSearchFilter(\'submission\')">Submissions</button><button class="btn btn-ghost btn-small" data-filter="user" onclick="setGlobalSearchFilter(\'user\')">People</button><button class="btn btn-ghost btn-small" data-filter="document" onclick="setGlobalSearchFilter(\'document\')">Documents</button></div>' +
      '<div id="globalSearchResults" class="workspace-search-results"></div>' +
      '<div class="workspace-search-foot"><span>↑ ↓ navigate · Enter open · Esc close</span><button class="btn btn-ghost btn-small" type="button" onclick="clearGlobalSearch()">Clear</button></div>' +
      '</div>';
    document.body.appendChild(s);
  }
  if (!getEl('attentionModal')) {
    var a = document.createElement('div');
    a.id = 'attentionModal'; a.className = 'modal-backdrop hidden'; a.setAttribute('role','dialog'); a.setAttribute('aria-modal','true');
    a.innerHTML = '<div class="modal-card workspace-attention-card"><div class="modal-header"><div><h3 class="text-subheading">Attention Center</h3><p class="section-copy">Everything currently asking for action.</p></div><button class="icon-btn" type="button" onclick="closeAttentionCenter()" aria-label="Close">×</button></div><div id="attentionBody"></div></div>';
    document.body.appendChild(a);
  }
  if (!getEl('aiAssistantModal')) {
    var ai = document.createElement('div');
    ai.id = 'aiAssistantModal'; ai.className = 'modal-backdrop hidden'; ai.setAttribute('role','dialog'); ai.setAttribute('aria-modal','true');
    ai.innerHTML = '<div class="modal-card workspace-ai-card"><div class="modal-header"><div><h3 class="text-subheading">Dash AI</h3><p class="section-copy">Ask questions about your current dashboard context. AI answers should be verified before acting.</p></div><button class="icon-btn" type="button" onclick="closeDashAi()" aria-label="Close">×</button></div><div class="workspace-ai-suggestions"><button class="btn btn-ghost btn-small" onclick="askDashAiPreset(\'What needs my attention today?\')">What needs my attention?</button><button class="btn btn-ghost btn-small" onclick="askDashAiPreset(\'Summarize the current dashboard workload.\')">Summarize workload</button><button class="btn btn-ghost btn-small" onclick="askDashAiPreset(\'What review risks should I look at first?\')">Review risks</button></div><div id="dashAiMessages" class="workspace-ai-messages"></div><div class="workspace-ai-input"><textarea id="dashAiInput" rows="2" maxlength="1000" placeholder="Ask Dash AI…" aria-label="Ask Dash AI"></textarea><button class="btn btn-primary" type="button" onclick="askDashAi()">Ask</button></div><div class="workspace-ai-note">AI-generated · do not treat as an authoritative record.</div></div>';
    document.body.appendChild(ai);
  }
}

function handleWorkspaceSearchInput_(value) { openGlobalSearch(value); var i=getEl('globalSearchInput'); if(i){i.value=String(value||''); renderGlobalSearch_(String(value||''));} }

function openGlobalSearch(initial) {
  workspaceEnsureUi_();
  openDialog('globalSearchModal');
  var input = getEl('globalSearchInput');
  if (input) { input.value = String(initial || ''); input.focus(); if (input.value) input.select(); }
  if (!initial) renderGlobalSearch_(''); else runGlobalSearch_(String(initial));
}
function closeGlobalSearch() { closeDialog('globalSearchModal'); }
function clearGlobalSearch() { var i=getEl('globalSearchInput'); if(i){i.value='';i.focus();} renderGlobalSearch_(''); }

var WORKSPACE_SEARCH_FILTER = 'all';
function setGlobalSearchFilter(filter) {
  WORKSPACE_SEARCH_FILTER = filter || 'all';
  document.querySelectorAll('#globalSearchFilters [data-filter]').forEach(function(b){b.classList.toggle('active', b.getAttribute('data-filter')===WORKSPACE_SEARCH_FILTER);});
  var i=getEl('globalSearchInput'); renderGlobalSearch_(i ? i.value : '');
}
function workspaceSearchText_(x) { return [x.id,x.row,x.title,x.name,x.username,x.email,x.sector,x.description,x.action,x.responsibility,x.status,x.type,x.filename,x.name].filter(Boolean).join(' '); }
function workspaceSearchMatch_(q, text) { if (!q) return true; return fuzzyMatch_(q.toLowerCase(), String(text||'').toLowerCase()); }
function workspaceHighlight_(text, q) { var s=escapeHtml(String(text||'')); if(!q) return s; var safe=String(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); try{return s.replace(new RegExp('('+safe+')','ig'),'<mark>$1</mark>');}catch(e){return s;} }

function renderGlobalSearch_(query) {
  var list=getEl('globalSearchResults'); if(!list) return;
  var q=String(query||'').trim();
  if(q.length<2){ list.innerHTML='<div class="workspace-search-empty"><strong>Search across Dash</strong><span>Try a record number, sector, task title, person or document name.</span></div>'; return; }
  if(WORKSPACE_SEARCH_TIMER) clearTimeout(WORKSPACE_SEARCH_TIMER);
  var gen=++WORKSPACE_SEARCH_GEN;
  list.innerHTML='<div class="workspace-search-loading"><span class="spinner"></span> Searching…</div>';
  WORKSPACE_SEARCH_TIMER=setTimeout(function(){runGlobalSearch_(q,gen);},140);
}
function workspaceFetch_(key, fn) { if(WORKSPACE_SEARCH_CACHE[key]) return Promise.resolve(WORKSPACE_SEARCH_CACHE[key]); return fn().then(function(v){WORKSPACE_SEARCH_CACHE[key]=v||[];return WORKSPACE_SEARCH_CACHE[key];}).catch(function(){return [];}); }
function runGlobalSearch_(query, expectedGen) {
  var q=String(query||'').trim(); if(q.length<2){renderGlobalSearch_(q);return;}
  var gen=expectedGen || ++WORKSPACE_SEARCH_GEN;
  Promise.all([
    Promise.resolve(appState.items||[]),
    workspaceFetch_('tasks',function(){return ApiService.getMyTasks();}),
    workspaceFetch_('users',function(){return ApiService.getAssignableUsers();}),
    workspaceFetch_('submissions',function(){return ApiService.getSubmissions();}),
    workspaceFetch_('documents',function(){return ApiService.getDocuments();})
  ]).then(function(all){ if(gen!==WORKSPACE_SEARCH_GEN)return; var types=[
    {type:'record',label:'Records',items:all[0],map:function(x){return {key:'record-'+x.row,title:'Record #'+x.id+' — '+(x.sector||''),meta:x.description||x.action||'',open:function(){closeGlobalSearch();openRecordDetail(x.row);}};}},
    {type:'task',label:'Tasks',items:all[1],map:function(x){return {key:'task-'+(x.id||x.row),title:x.title||'Task',meta:(x.status||'')+(x.dueDate?' · '+formatDate(x.dueDate):''),open:function(){closeGlobalSearch();openTab('tasks');}};}},
    {type:'submission',label:'Submissions',items:all[3],map:function(x){return {key:'submission-'+(x.id||x.row||x.cardRow),title:'Submission '+(x.id||x.row||''),meta:x.subject||x.title||x.description||'',open:function(){closeGlobalSearch();openSubmissionsModal(x.cardRow||x.row,x.id||'');}};}},
    {type:'user',label:'People',items:all[2],map:function(x){return {key:'user-'+(x.email||x.username),title:x.name||x.username||x.email||'User',meta:x.email||x.username||'',open:function(){closeGlobalSearch();showToast('User: '+(x.email||x.username||x.name),'info');}};}},
    {type:'document',label:'Documents',items:all[4],map:function(x){return {key:'document-'+(x.id||x.name||x.filename),title:x.name||x.filename||'Document',meta:x.mimeType||x.type||'',open:function(){closeGlobalSearch(); if(x.url)openLinkPreview(x.url,x.name||x.filename||'Document'); else showToast('Document found but no preview link is available.','info');}};}}
  ];
  var html='', results=[]; types.forEach(function(t){ if(WORKSPACE_SEARCH_FILTER!=='all'&&WORKSPACE_SEARCH_FILTER!==t.type)return; var matches=(t.items||[]).filter(function(x){return workspaceSearchMatch_(q,workspaceSearchText_(x));}).slice(0,8).map(t.map); if(!matches.length)return; html+='<div class="workspace-search-group"><div class="workspace-search-group-title">'+t.label+' <span>'+matches.length+'</span></div>'; matches.forEach(function(r){var idx=results.length;results.push(r);html+='<button class="workspace-search-result" type="button" data-search-index="'+idx+'"><span><strong>'+workspaceHighlight_(r.title,q)+'</strong><small>'+workspaceHighlight_(r.meta,q)+'</small></span><kbd>Enter</kbd></button>';});html+='</div>';});
  if(!html)html='<div class="workspace-search-empty"><strong>No matches</strong><span>Try a broader search or another category.</span></div>';
  list.innerHTML=html; list.querySelectorAll('[data-search-index]').forEach(function(b){b.addEventListener('click',function(){var r=results[Number(b.getAttribute('data-search-index'))];if(r)r.open();});});
  });
}

function openAttentionCenter() {
  workspaceEnsureUi_(); openDialog('attentionModal'); renderAttentionCenter_();
}
function closeAttentionCenter(){closeDialog('attentionModal');}
function renderAttentionCenter_(){
  var body=getEl('attentionBody'); if(!body)return;
  var items=appState.items||[], now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  var reviews=items.filter(function(i){return i.reviewStatus==='due';}).map(function(i){var d=parseDateFieldValue(i.reviewDate);var overdue=!d||d.getTime()<today;return {kind:'review',rank:overdue?100:70,title:'#'+i.id+' — '+(i.sector||'Review'),meta:overdue?'Overdue review':'Review due',open:function(){closeAttentionCenter();openRecordDetail(i.row);}};});
  var tasks=(appState.tasks||[]).filter(function(t){return t.status!=='DONE'&&t.status!=='CANCELLED';}).map(function(t){var due=t.dueDate?new Date(t.dueDate).getTime():Infinity;var overdue=due<today;return {kind:'task',rank:overdue?95:60,title:t.title||'Task',meta:overdue?'Overdue task':(t.dueDate?'Due '+formatDate(t.dueDate):'Open task'),open:function(){closeAttentionCenter();openTab('tasks');}};});
  var notifs=((appState.notifications||{}).recent||[]).filter(function(n){return !n.readAt;}).map(function(n){return {kind:'notification',rank:Number(n.priority)>=1?90:50,title:n.title||'Notification',meta:n.body||'',open:function(){closeAttentionCenter();openNotification(n.id,n.type);}};});
  var subs=Object.keys(appState.submissionFlash||{}).filter(function(k){return appState.submissionFlash[k];}).map(function(k){var row=Number(k),item=items.find(function(i){return Number(i.row)===row;});return item?{kind:'submission',rank:55,title:(item.sector||'Submission')+' — #'+item.id,meta:'Unread submission',open:function(){closeAttentionCenter();openSubmissionsModal(row,item.id);}}:null;}).filter(Boolean);
  var all=reviews.concat(tasks,notifs,subs).sort(function(a,b){return b.rank-a.rank;}).slice(0,20);
  var html='<div class="workspace-attention-summary"><strong>'+all.length+'</strong><span>items currently needing attention</span><button class="btn btn-ghost btn-small" onclick="renderAttentionCenter_()">Refresh</button></div>';
  if(!all.length)html+='<div class="workspace-search-empty"><strong>All clear</strong><span>No urgent reviews, open tasks, unread notifications or unread submissions were found.</span></div>';
  else html+='<div class="workspace-attention-list">'+all.map(function(x){return '<button class="workspace-attention-item" type="button"><span class="workspace-attention-dot '+x.kind+'"></span><span><strong>'+escapeHtml(x.title)+'</strong><small>'+escapeHtml(x.meta)+'</small></span><span>›</span></button>';}).join('')+'</div>';
  body.innerHTML=html; body.querySelectorAll('.workspace-attention-item').forEach(function(b,i){b.addEventListener('click',function(){all[i].open();});});
}

function renderExecutiveSnapshot(){
  var host=getEl('analyticsExecutiveSnapshot'); if(!host)return;
  var s=appState.summary||{}, items=appState.items||[], notifications=(appState.notifications||{}).unread||0;
  var due=items.filter(function(i){return i.reviewStatus==='due';}).length;
  var flagged=items.filter(function(i){return i.flagged;}).length;
  var trend=(appState.analytics&&appState.analytics.trend)||[]; var month=trend.length?trend[trend.length-1].value:0;
  var score=Math.max(0,Math.min(100,Math.round(((Number(s.total||0)-due)/Math.max(1,Number(s.total||0)))*100)));
  host.innerHTML='<div class="workspace-exec-head"><div><div class="workspace-exec-kicker">EXECUTIVE SNAPSHOT</div><h3>Operational pulse</h3><p>High-level view of workload, review exposure and attention signals.</p></div><div class="workspace-exec-actions"><button class="btn btn-secondary btn-small" onclick="openAttentionCenter()">Attention</button><button class="btn btn-primary btn-small" onclick="openDashAi()">Ask Dash AI</button></div></div><div class="workspace-exec-grid">'+
    [['Records',s.total||0,'Current records'],['Review due',due,'Needs review'],['Flagged',flagged,'Marked for attention'],['Unread',notifications,'Notifications'],['New this month',month,'Recent intake']].map(function(c){return '<div class="workspace-exec-kpi"><span>'+escapeHtml(String(c[0]))+'</span><strong>'+Number(c[1]||0).toLocaleString()+'</strong><small>'+escapeHtml(c[2])+'</small></div>';}).join('')+
    '</div><div class="workspace-exec-health"><div><span>Operational health</span><strong>'+score+'%</strong></div><div class="workspace-exec-track"><span style="width:'+score+'%"></span></div></div>';
}

function openDashAi(){ workspaceEnsureUi_(); openDialog('aiAssistantModal'); var input=getEl('dashAiInput'); if(input)input.focus(); if(!getEl('dashAiMessages').children.length) addDashAiMessage_('assistant','I can summarize the current dashboard, surface risks, or help you decide what to look at next.'); }
function closeDashAi(){closeDialog('aiAssistantModal');}
function askDashAiPreset(q){var i=getEl('dashAiInput');if(i)i.value=q;askDashAi();}
function addDashAiMessage_(role,text){var box=getEl('dashAiMessages');if(!box)return;var d=document.createElement('div');d.className='workspace-ai-message '+role;d.innerHTML='<span class="workspace-ai-role">'+(role==='assistant'?'Dash AI':'You')+'</span><div>'+escapeHtml(text)+'</div>';box.appendChild(d);box.scrollTop=box.scrollHeight;}
function buildDashAiContext_(){
  var items=(appState.items||[]).slice(0,120).map(function(i){return '#'+i.id+' | '+(i.sector||'')+' | '+(i.description||'').slice(0,180)+' | review '+(i.reviewDate||'')+' | '+(i.reviewStatus||'');}).join('\n');
  var s=appState.summary||{}; return 'Summary: total='+Number(s.total||0)+', reviewDue='+Number(s.flagged||0)+', normal='+Number(s.normal||0)+'.\nRecords:\n'+items;
}
function askDashAi(){
  var input=getEl('dashAiInput'); if(!input)return; var q=input.value.trim(); if(!q)return;
  addDashAiMessage_('user',q); input.value=''; var box=getEl('dashAiMessages'); var loading=document.createElement('div');loading.className='workspace-ai-message assistant workspace-ai-loading';loading.textContent='Thinking…';box.appendChild(loading);box.scrollTop=box.scrollHeight;
  if(!ApiService.askDashboardAi){loading.textContent='Dash AI is not available in this build.';return;}
  ApiService.askDashboardAi(q,buildDashAiContext_()).then(function(r){loading.remove();addDashAiMessage_('assistant',r&&r.success?r.text||r.answer||r.insights||'No answer returned.':(r&&r.message)||'AI could not answer right now.');}).catch(function(e){loading.remove();addDashAiMessage_('assistant','AI request failed: '+(e&&e.message?e.message:'Please try again.'));});
}

function toggleMobileOperatingMode(force){
  var next=typeof force==='boolean'?force:!document.body.classList.contains('mobile-operating-mode');
  document.body.classList.toggle('mobile-operating-mode',next); try{localStorage.setItem(WORKSPACE_MOBILE_KEY,next?'1':'0');}catch(e){}
  showToast(next?'Mobile operating mode enabled':'Mobile operating mode disabled','info');
}
function isMobileOperatingMode(){return document.body.classList.contains('mobile-operating-mode');}

function initWorkspaceFeatures(){
  workspaceEnsureUi_();
  if (typeof COMMAND_ACTIONS !== 'undefined') {
    var extras = [
      { key:'global-search', label:'Global Search', subtitle:'Search records, tasks, people and documents', shortcut:'Ctrl /', action:function(){closeCommandPalette();openGlobalSearch();} },
      { key:'attention-center', label:'Open Attention Center', subtitle:'See everything currently asking for action', shortcut:'', action:function(){closeCommandPalette();openAttentionCenter();} },
      { key:'executive-snapshot', label:'Executive Snapshot', subtitle:'Open the operational analytics view', shortcut:'', action:function(){closeCommandPalette();openTab('analytics');} },
      { key:'dash-ai', label:'Ask Dash AI', subtitle:'Ask a question about current dashboard context', shortcut:'', action:function(){closeCommandPalette();openDashAi();} },
      { key:'mobile-mode', label:'Toggle Mobile Operating Mode', subtitle:'Compact touch-first workspace layout', shortcut:'', action:function(){closeCommandPalette();toggleMobileOperatingMode();} }
    ];
    extras.forEach(function(x){ if(!COMMAND_ACTIONS.some(function(a){return a.key===x.key;})) COMMAND_ACTIONS.unshift(x); });
  }
  try{if(localStorage.getItem(WORKSPACE_MOBILE_KEY)==='1')document.body.classList.add('mobile-operating-mode');}catch(e){}
  var top=getEl('searchInput'); if(top){top.addEventListener('focus',function(){openGlobalSearch(top.value);});top.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();openGlobalSearch(top.value);}});}
  var aiBtn=document.createElement('button');aiBtn.className='icon-btn workspace-top-action';aiBtn.type='button';aiBtn.title='Ask Dash AI';aiBtn.setAttribute('aria-label','Ask Dash AI');aiBtn.innerHTML='✦';aiBtn.onclick=openDashAi;var actions=document.querySelector('.topbar-actions');if(actions)actions.insertBefore(aiBtn,actions.firstChild);
  var attBtn=document.createElement('button');attBtn.className='icon-btn workspace-top-action';attBtn.type='button';attBtn.title='Attention Center';attBtn.setAttribute('aria-label','Attention Center');attBtn.innerHTML='!';attBtn.onclick=openAttentionCenter;if(actions)actions.insertBefore(attBtn,actions.firstChild);
  document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='/'){e.preventDefault();openGlobalSearch();}if(e.key==='?'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){openCommandPalette('?');}});
  var list=getEl('globalSearchResults');
  document.addEventListener('keydown',function(e){var modal=getEl('globalSearchModal');if(!modal||modal.classList.contains('hidden'))return;if(e.key==='Escape'){closeGlobalSearch();return;}if(e.key==='Enter'&&document.activeElement===getEl('globalSearchInput')){var first=list&&list.querySelector('[data-search-index="0"]');if(first)first.click();}});
  if(typeof renderExecutiveSnapshot==='function')setTimeout(renderExecutiveSnapshot,300);
}

/* Hook dashboard analytics without replacing its implementation. */
var _workspaceOriginalRenderAnalytics = null;
function installWorkspaceAnalyticsHook(){
  if(_workspaceOriginalRenderAnalytics||typeof renderAnalytics!=='function')return;
  _workspaceOriginalRenderAnalytics=renderAnalytics;
  renderAnalytics=function(){_workspaceOriginalRenderAnalytics();renderExecutiveSnapshot();};
}

/* ============================================================
 * Dash Workspace 3.0 — Targets 8–12
 * Smart Attention, Analytics 2.0, Automation Engine and Reliability/Security.
 * ============================================================ */
var DASHOPS_ANALYTICS_CACHE = null;
var DASHOPS_ANALYTICS_GEN = 0;
var DASHOPS_RULES = [];

function dashOpsEnsureUi_() {
  if (getEl('dashOpsAnalyticsModal')) return;
  var a=document.createElement('div'); a.id='dashOpsAnalyticsModal'; a.className='modal-backdrop hidden';
  a.innerHTML='<div class="modal-card workspace-ops-card"><div class="modal-header"><div><h3 class="text-subheading">Analytics 2.0</h3><p class="section-copy">Workload, completion, submissions and review trends.</p></div><button class="icon-btn" onclick="closeDialog(\'dashOpsAnalyticsModal\')">×</button></div><div class="workspace-ops-toolbar"><button class="btn btn-ghost btn-small" onclick="loadDashOpsAnalytics(7)">7 days</button><button class="btn btn-ghost btn-small" onclick="loadDashOpsAnalytics(30)">30 days</button><button class="btn btn-ghost btn-small" onclick="loadDashOpsAnalytics(90)">90 days</button><button class="btn btn-secondary btn-small" onclick="exportDashOpsAnalytics()">Export CSV</button></div><div id="dashOpsAnalyticsBody" class="workspace-ops-body"><div class="workspace-search-empty">Loading analytics…</div></div></div>';
  document.body.appendChild(a);
  var r=document.createElement('div'); r.id='dashOpsAutomationModal'; r.className='modal-backdrop hidden';
  r.innerHTML='<div class="modal-card workspace-ops-card"><div class="modal-header"><div><h3 class="text-subheading">Automation Engine</h3><p class="section-copy">IF → THEN rules with safe, notification-first actions.</p></div><button class="icon-btn" onclick="closeDialog(\'dashOpsAutomationModal\')">×</button></div><div id="dashOpsAutomationBody" class="workspace-ops-body"></div></div>';
  document.body.appendChild(r);
  var s=document.createElement('div'); s.id='dashOpsSecurityModal'; s.className='modal-backdrop hidden';
  s.innerHTML='<div class="modal-card workspace-ops-card"><div class="modal-header"><div><h3 class="text-subheading">Reliability & Security</h3><p class="section-copy">Session, database and offline-operation status.</p></div><button class="icon-btn" onclick="closeDialog(\'dashOpsSecurityModal\')">×</button></div><div id="dashOpsSecurityBody" class="workspace-ops-body"></div></div>';
  document.body.appendChild(s);
}
function openDashOpsAnalytics(){dashOpsEnsureUi_();openDialog('dashOpsAnalyticsModal');loadDashOpsAnalytics(30);}
function loadDashOpsAnalytics(days){
  var gen=++DASHOPS_ANALYTICS_GEN, host=getEl('dashOpsAnalyticsBody'); if(host)host.innerHTML='<div class="workspace-search-empty">Loading analytics…</div>';
  return ApiService.getAnalytics({days:days}).then(function(d){if(gen!==DASHOPS_ANALYTICS_GEN)return;DASHOPS_ANALYTICS_CACHE=d;renderDashOpsAnalytics_(d);}).catch(function(e){if(host)host.innerHTML='<div class="workspace-search-empty">Analytics unavailable: '+escapeHtml(e.message||String(e))+'</div>';});
}
function renderDashOpsAnalytics_(d){
  var h=getEl('dashOpsAnalyticsBody'); if(!h)return; var k=d.kpis||{},tr=d.trends||[];
  var max=Math.max.apply(null,tr.map(function(x){return Math.max(x.records||0,x.submissions||0,x.tasksCompleted||0);}).concat([1]));
  h.innerHTML='<div class="workspace-exec-grid">'+[['Records',k.records],['Reviews due',k.reviewsDue],['Overdue tasks',k.overdueTasks],['Open tasks',k.openTasks],['Submissions',k.submissionsInRange],['Task turnaround',String(k.avgTaskTurnaroundHours||0)+'h']].map(function(x){return '<div class="workspace-exec-kpi"><span>'+escapeHtml(x[0])+'</span><strong>'+escapeHtml(String(x[1]||0))+'</strong><small>Current window</small></div>';}).join('')+'</div><div class="workspace-trend-list">'+tr.map(function(x){var total=(x.records||0)+(x.submissions||0)+(x.tasksCompleted||0);return '<div class="workspace-trend-row"><span>'+escapeHtml(x.date)+'</span><div class="workspace-trend-bar"><i style="width:'+Math.round((total/max)*100)+'%"></i></div><small>'+total+'</small></div>';}).join('')+'</div>';
}
function exportDashOpsAnalytics(){
  if(!DASHOPS_ANALYTICS_CACHE){showToast('Load analytics first.','warning');return;}
  var rows=[['Date','Records','Submissions','Tasks completed','Notifications']].concat((DASHOPS_ANALYTICS_CACHE.trends||[]).map(function(x){return[x.date,x.records,x.submissions,x.tasksCompleted,x.notifications];}));
  var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='dash-analytics-'+Date.now()+'.csv';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
}
function openDashAutomation(){dashOpsEnsureUi_();openDialog('dashOpsAutomationModal');loadDashAutomation();}
function loadDashAutomation(){return ApiService.listAutomationRules().then(function(r){DASHOPS_RULES=r.rules||[];renderDashAutomation_();});}
function renderDashAutomation_(){var h=getEl('dashOpsAutomationBody');if(!h)return;var rows=DASHOPS_RULES.map(function(r){return '<div class="workspace-rule-row"><div><strong>'+escapeHtml(r.name)+'</strong><small>IF '+escapeHtml(r.trigger)+' → '+escapeHtml(r.action)+'</small></div><label><input type="checkbox" '+(r.enabled?'checked':'')+' onchange="toggleDashRule(\''+escAttr(r.id)+'\',this.checked)"> Enabled</label><button class="btn btn-ghost btn-small" onclick="deleteDashRule(\''+escAttr(r.id)+'\')">Delete</button></div>';}).join('');
h.innerHTML='<div class="workspace-ops-toolbar"><button class="btn btn-primary btn-small" onclick="addDashRulePrompt()">Add rule</button><button class="btn btn-secondary btn-small" onclick="runDashAutomationNow()">Run scheduler now</button></div>'+(rows||'<div class="workspace-search-empty">No automation rules yet.</div>');}
function addDashRulePrompt(){
  showPrompt({ title: 'Rule name', message: 'Rule name:', value: 'Morning briefing' }).then(function (name) {
    if (!name) return;
    showPrompt({ title: 'Trigger', message: 'Trigger: SUBMISSION_CREATED, TASK_OVERDUE, REVIEW_DUE, MORNING_BRIEFING, REVIEW_COMPLETED', value: 'TASK_OVERDUE' }).then(function (trigger) {
      if (!trigger) return;
      showPrompt({ title: 'Action', message: 'Action: NOTIFY_SELF or NOTIFY_STAFF', value: 'NOTIFY_SELF' }).then(function (action) {
        if (!action) return;
        ApiService.saveAutomationRule({ name: name, trigger: trigger, action: action, enabled: true, config: { title: name, body: 'Dash automation: ' + name } }).then(loadDashAutomation).catch(function (e) { showToast(e.message || String(e), 'error'); });
      });
    });
  });
}
function toggleDashRule(id,on){var r=DASHOPS_RULES.find(function(x){return x.id===id;});if(!r)return;r.enabled=!!on;ApiService.saveAutomationRule(r).then(loadDashAutomation);}
function deleteDashRule(id){
  showConfirm({ title: 'Delete rule', message: 'Delete this automation rule?', okLabel: 'Delete', danger: true }).then(function (ok) {
    if (!ok) return;
    ApiService.deleteAutomationRule(id).then(loadDashAutomation);
  });
}
function runDashAutomationNow(){ApiService.runAutomationNow().then(function(r){showToast('Automation checked: '+JSON.stringify(r),'success');}).catch(function(e){showToast(e.message||String(e),'error');});}
function openDashSecurity(){dashOpsEnsureUi_();openDialog('dashOpsSecurityModal');var h=getEl('dashOpsSecurityBody');h.innerHTML='<div class="workspace-search-empty">Loading security status…</div>';ApiService.getSecurityStatus().then(function(s){h.innerHTML='<div class="workspace-exec-grid">'+[['Signed-in user',s.admin],['Active sessions',s.sessions],['Users',s.users],['Audit rows',s.auditRows]].map(function(x){return '<div class="workspace-exec-kpi"><span>'+escapeHtml(x[0])+'</span><strong>'+escapeHtml(String(x[1]))+'</strong></div>';}).join('')+'</div><div class="workspace-ops-toolbar"><button class="btn btn-secondary btn-small" onclick="rotateDashSession()">Rotate session</button><span class="section-copy">API writes require trusted origins; sessions are server-side.</span></div>';}).catch(function(e){h.innerHTML='<div class="workspace-search-empty">'+escapeHtml(e.message||String(e))+'</div>';});}
function rotateDashSession(){ApiService.rotateSession().then(function(){showToast('Session rotated.','success');}).catch(function(e){showToast(e.message||String(e),'error');});}
function initDashOpsFeatures(){
  dashOpsEnsureUi_();
  var actions=document.querySelector('.topbar-actions'); if(!actions)return;
  if(!getEl('dashAnalyticsBtn')){var b=document.createElement('button');b.id='dashAnalyticsBtn';b.className='icon-btn workspace-top-action';b.title='Analytics 2.0';b.innerHTML='▥';b.onclick=openDashOpsAnalytics;actions.appendChild(b);}
  if(appState.isAdmin&&!getEl('dashAutomationBtn')){var a=document.createElement('button');a.id='dashAutomationBtn';a.className='icon-btn workspace-top-action';a.title='Automation Engine';a.innerHTML='⚙';a.onclick=openDashAutomation;actions.appendChild(a);var s=document.createElement('button');s.id='dashSecurityBtn';s.className='icon-btn workspace-top-action';s.title='Reliability & Security';s.innerHTML='✓';s.onclick=openDashSecurity;actions.appendChild(s);}
}
