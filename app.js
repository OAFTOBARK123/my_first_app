/* 所有业务数据集中存入一个 localStorage 键；每次修改成功落盘后才更新界面。 */
const C=TimeCore, KEY='shishi.time-manager.v1';
const $=selector=>document.querySelector(selector);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=()=>C.migrate({version:1,lastDay:C.day(Date.now()),timer:null,pending:null,records:[],deadlines:[],todos:[]});
let state=fresh(),page='timer',editing=null,toastTimer,storageBlocked=false;
try {const raw=localStorage.getItem(KEY);if(raw)state=C.migrate(JSON.parse(raw));}
catch(e){storageBlocked=true;state=fresh();$('#storage-error').hidden=false;$('#storage-error').textContent='无法读取本机数据，已停止写入以保护原数据。请确认浏览器允许网站存储；不要清除浏览器数据。';}
function commit(next){if(storageBlocked)return false;try{localStorage.setItem(KEY,JSON.stringify(next));state=next;$('#storage-error').hidden=true;return true;}catch(e){$('#storage-error').hidden=false;$('#storage-error').textContent='保存失败：浏览器存储不可用或空间不足。请保留当前页面，释放空间后重试。';return false;}}
const clone=()=>JSON.parse(JSON.stringify(state));
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2300);}
const icons={timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6M12 2v3"/>',deadline:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-8 3v3l2 1"/>',todos:'<rect x="5" y="4" width="15" height="17" rx="3"/><path d="m8 12 2 2 5-5M9 3h7"/>',records:'<path d="M6 3h10l3 3v15H6zM9 9h7M9 13h7M9 17h4"/>',study:'<path d="M3 5c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2zM12 7v14"/>'};
icons.pomodoro=icons.timer;icons.pomodoroRecords=icons.records;icons.habits='<path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="10"/>';
const names={timer:'计时',pomodoro:'番茄钟',deadline:'Deadline',todos:'日待办',records:'工作记录',pomodoroRecords:'25min记录',habits:'执行力',study:'学习进度'};
$('#navigation').innerHTML=Object.entries(names).map(([id,name])=>`<button data-page="${id}" aria-label="${name}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg>${name}</button>`).join('');
$('#navigation').addEventListener('click',event=>{const b=event.target.closest('[data-page]');if(!b)return;page=b.dataset.page;render();window.scrollTo(0,0);});
function heading(title,subtitle){return `<h1>${title}</h1><p class="subtitle">${subtitle}</p>`;}
function empty(title,note,icon='◷'){return `<div class="empty"><div class="empty-icon" aria-hidden="true">${icon}</div><h2>${title}</h2><p>${note}</p></div>`;}
function render(){
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});
  if(page==='timer'){
    const today=state.records.filter(r=>C.day(r.start)===C.day(Date.now()));
    $('#main').innerHTML=`<div class="eyebrow">FOCUS / 专注当下</div>${heading('把时间留给重要的事','一次专注，一份积累。')}<section class="timer-panel" aria-label="计时器"><div class="status">${state.timer?'正在专注':state.pending?'本次计时已结束':'准备好，就开始吧'}</div><div class="clock" id="elapsed">00:00:00</div><button id="timer-button" class="timer-button ${state.timer?'running':state.pending?'pending':''}"><span class="symbol" aria-hidden="true">${state.timer?'■':'▷'}</span><span>${state.timer?'结束计时':'开始计时'}</span></button><p class="timer-note">${state.timer?'开始于 '+C.stamp(state.timer.start):state.pending?'本次记录等待保存':'按下按钮，进入你的专注时间'}</p></section><div class="stats"><div class="stat"><span>今日专注</span><strong>${Math.floor(today.reduce((sum,r)=>sum+r.end-r.start,0)/60000)} <small>分钟</small></strong></div><div class="stat"><span>今日记录</span><strong>${today.length} <small>次</small></strong></div></div><p class="footnote">北京时间 · 数据保存在当前浏览器</p>`;
    $('#timer-button').onclick=timerClick;
  }else if(page==='pomodoro'){
    renderPomodoro();
  }else if(page==='habits'){
    renderHabits();
  }else if(page==='deadline'){
    $('#main').innerHTML=heading('Deadline','把截止时间记下来，让每一步都有安排。')+(state.deadlines.length?`<div class="list">${[...state.deadlines].sort((a,b)=>a.due-b.due).map(t=>`<article class="task"><label class="check-wrap"><input type="checkbox" data-complete="${t.id}" aria-label="完成并移除 ${escapeHTML(t.name)}"></label><div class="task-body"><div class="task-title">${escapeHTML(t.name)} · ${C.stamp(t.due).slice(0,16)}</div><div class="task-meta">${t.due<Date.now()?'已过截止时间':'北京时间'}</div></div><button class="edit" data-edit="${t.id}">编辑</button></article>`).join('')}</div>`:empty('还没有截止任务','点击右下角 +，添加一个 Deadline。','▦'))+'<button class="fab" id="add" aria-label="添加截止任务">+</button>';
    $('#add').onclick=()=>openEditor('deadline');
  }else if(page==='todos'){
    $('#main').innerHTML=heading('日待办清单','给今天一个明确的小目标。')+(state.todos.length?`<div class="list">${state.todos.map(t=>`<article class="task ${t.done?'done':''}"><label class="check-wrap"><input type="checkbox" data-complete="${t.id}" ${t.done?'checked':''} aria-label="完成 ${escapeHTML(t.name)}"></label><div class="task-body">${t.carriedFrom?`<span class="badge">${C.shortDate(t.carriedFrom)}未完成的任务</span>`:''}<div class="task-title">${t.carriedFrom?C.shortDate(t.carriedFrom)+'未完成的任务':escapeHTML(t.name)}</div>${t.carriedFrom?`<div class="task-meta">原任务：${escapeHTML(t.name)}</div>`:''}<div class="task-meta">${escapeHTML(t.slot)}</div></div><button class="edit" data-edit="${t.id}">编辑</button></article>`).join('')}</div>`:empty('今天，从一件小事开始','点击右下角 +，写下任务和计划时段。','☑'))+'<p class="footnote">北京时间 0:00 清理已完成任务，保留未完成任务</p><button class="fab" id="add" aria-label="添加日待办">+</button>';
    $('#add').onclick=()=>openEditor('todos');
  }else if(page==='records'||page==='pomodoroRecords'){
    const collection=page==='records'?state.records:state.pomodoroRecords;
    let previous='';
    const records=[...collection].sort((a,b)=>b.start-a.start).map(r=>{const day=C.day(r.start);const group=previous!==day?`<h2 class="group-heading">${C.dateLabel(day)}</h2>`:'';previous=day;return `${group}<details class="record"><summary>${C.minutes(r.start,r.end)}分钟的${escapeHTML(r.content)}</summary><div class="readonly">开始：${C.stamp(r.start).slice(0,16)}\n结束：${C.stamp(r.end).slice(0,16)}\n总时长：${C.minutes(r.start,r.end)}分钟（不足一分钟按 0 分钟显示）</div><p><label>工作量</label>${escapeHTML(r.amount)}</p><p><label>反思</label>${escapeHTML(r.reflection)||'未填写'}</p><button class="edit" data-edit="${r.id}">编辑记录</button></details>`;}).join('');
    $('#main').innerHTML=heading(page==='records'?'工作记录':'25min记录',`${collection.length} 次专注，每一份努力都有迹可循。`)+(records||empty('第一份记录，等待开始',page==='records'?'完成一次计时并保存，就会出现在这里。':'完成一次番茄钟并保存，就会出现在这里。','▤'));
  }else $('#main').innerHTML=heading('学习进度跟踪','保持好奇，慢慢积累。')+empty('学习进度跟踪（功能开发中）','这里将记录你的学习旅程。','▱');
  tickClock();
}
function timerClick(){
  if(state.pending){openEditor('session');return;}
  const next=clone();
  if(next.timer){next.pending={start:next.timer.start,end:Math.max(Date.now(),next.timer.start),content:'',amount:'',reflection:''};next.timer=null;if(commit(next)){render();openEditor('session');}}
  else {next.timer={start:Date.now()};if(commit(next))render();}
}
function field(name,label,value='',multiline=false,type='text'){return `<label for="field-${name}">${label}</label>${multiline?`<textarea id="field-${name}" name="${name}" maxlength="10000">${escapeHTML(value)}</textarea>`:`<input id="field-${name}" name="${name}" type="${type}" value="${escapeHTML(value)}" required ${type==='text'?'maxlength="500"':''}>`}`;}
// 两类专注草稿独立保存；如果已有弹窗，番茄钟结束后排队，避免覆盖正在编辑的内容。
const draftKey=kind=>kind==='session'?'pending':kind==='pomodoroSession'?'pomodoroPending':null;
function showPending(){
  if($('#editor').open)return;
  if(state.pending)openEditor('session');
  else if(state.pomodoroPending)openEditor('pomodoroSession');
}
function openEditor(kind,id){
  const collection=kind==='deadline'?'deadlines':kind==='todos'?'todos':kind==='habits'?'habits':kind==='pomodoroRecords'?'pomodoroRecords':'records';
  const draft=draftKey(kind);
  const value=draft?state[draft]:state[collection].find(t=>t.id===id)||{};
  if(!value)return;
  editing={kind,id,collection};$('#form-error').textContent='';
  const isRecord=['session','pomodoroSession','records','pomodoroRecords'].includes(kind);
  $('#modal-title').textContent=kind==='session'?'保存这段专注':kind==='pomodoroSession'?'25分钟完成，记录一下':kind==='records'?'编辑工作记录':kind==='pomodoroRecords'?'编辑25min记录':(id?'编辑':'添加')+(kind==='deadline'?' Deadline':kind==='habits'?'执行事项':'日待办');
  $('#fields').innerHTML=isRecord?`<div class="readonly">${C.stamp(value.start)} →\n${C.stamp(value.end)}\n持续 ${C.minutes(value.start,value.end)} 分钟</div>`+field('content','工作内容 · 必填',value.content)+field('amount','工作量 · 必填',value.amount)+(kind==='pomodoroSession'?'':field('reflection','反思 · 选填',value.reflection,true)):kind==='deadline'?field('name','任务名 · 必填',value.name)+field('due','截止日期与时间 · 北京时间',value.due?C.stamp(value.due).slice(0,16).replace(' ','T'):'',false,'datetime-local'):kind==='habits'?field('name','每天要执行的事情 · 必填',value.name):field('name','任务名 · 必填',value.name)+field('slot','答应在哪个时间段完成 · 必填',value.slot);
  if(!$('#editor').open)$('#editor').showModal();
}
function closeEditor(discard=true){
  const draft=draftKey(editing?.kind);
  if(draft&&discard){const next=clone();next[draft]=null;if(!commit(next))return;}
  $('#editor').close();editing=null;render();
  showPending();
}
$('.cancel').onclick=()=>closeEditor();$('.close').onclick=()=>closeEditor();
$('#editor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
// 刷新后恢复两种计时的表单；普通编辑不会被后台完成事件替换。
$('#editor-form').addEventListener('input',()=>{
  const draft=draftKey(editing?.kind);if(!draft)return;
  const next=clone();if(!next[draft])return;
  for(const k of ['content','amount','reflection']){const input=$(`[name="${k}"]`);if(input)next[draft][k]=input.value;}
  commit(next);
});
$('#editor-form').onsubmit=e=>{
  e.preventDefault();if(!editing)return;
  rollover();
  const values=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,v.trim()]));
  const {kind,id,collection}=editing;
  if(Object.entries(values).some(([k,v])=>k!=='reflection'&&!v)){$('#form-error').textContent='请填写所有必填项，不能只输入空格。';return;}
  const next=clone();
  const draft=draftKey(kind);
  if(draft){if(!next[draft])return;next[kind==='session'?'records':'pomodoroRecords'].push({...next[draft],...values,id:uid()});next[draft]=null;}
  else{
    if(kind==='deadline'){values.due=C.parseDeadline(values.due);if(!Number.isFinite(values.due)){$('#form-error').textContent='请选择有效的截止日期和时间。';return;}}
    if(id){const index=next[collection].findIndex(t=>t.id===id);if(index===-1){$('#form-error').textContent='这项任务已经被移除，请取消后重新添加。';return;}next[collection][index]={...next[collection][index],...values};}
    else next[collection].push({id:uid(),...values,...(kind==='todos'?{createdDay:C.day(Date.now()),done:false,carriedFrom:null}:kind==='habits'?{createdDay:C.day(Date.now()),checkedDays:[]}:{})});
  }
  if(commit(next)){closeEditor(false);notify('已保存');}
};
$('#main').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit)openEditor(page,edit.dataset.edit);});
$('#main').addEventListener('change',e=>{
  const input=e.target.closest('[data-complete]');if(!input)return;
  // 先记住用户动作；跨天刷新列表可能会移除原 DOM 节点。
  const id=input.dataset.complete,checked=input.checked;
  rollover();const next=clone();
  if(page==='habits'){
    const habit=next.habits.find(t=>t.id===id);if(!habit)return;
    const stats=C.toggleHabit(habit);
    if(stats.current>=21)next.habits=next.habits.filter(t=>t.id!==id);
    if(commit(next)){const expanded=[...document.querySelectorAll('.habit-details[open]')].map(d=>d.dataset.habit);renderHabits();for(const d of document.querySelectorAll('.habit-details'))d.open=expanded.includes(d.dataset.habit);if(stats.current>=21)notify('已连续坚持21天，执行事项已完成并移除');}
    else input.checked=!checked;
    return;
  }
  if(page==='deadline')next.deadlines=next.deadlines.filter(t=>t.id!==id);
  else{const t=next.todos.find(t=>t.id===id);if(t)t.done=checked;}
  if(commit(next)){if(page==='deadline'){render();notify('任务已完成并移除');}else{const current=document.querySelector(`[data-complete="${id}"]`);if(current){current.checked=checked;current.closest('.task').classList.toggle('done',checked);}}}else input.checked=!checked;
});
function rollover(){const next=clone();if(C.rollover(next)&&commit(next)){render();return true;}return false;}
function renderPomodoro(){
  const running=state.pomodoro;
  $('#main').innerHTML=heading('番茄钟','专注25分钟，完成一件事。')+`<section class="timer-panel" aria-label="番茄钟"><div class="status">${running?'正在专注':state.pomodoroPending?'25分钟已完成，等待保存':'准备开始25分钟专注'}</div><div class="clock" id="countdown">25:00</div><button id="pomodoro-button" class="timer-button ${running?'running':''}"><span class="symbol" aria-hidden="true">${running?'■':'▷'}</span><span>${running?'结束番茄钟':'开始番茄钟'}</span></button><p class="timer-note">${running?'再次点击会结束并重置本次倒计时':state.pomodoroPending?'请保存或取消本次记录，再开始下一次':'满25分钟后，填写工作内容和工作量'}</p></section><p class="footnote">北京时间 · 完成记录保存在「25min记录」</p>`;
  $('#pomodoro-button').onclick=()=>{
    processTime();
    if(state.pomodoroPending){showPending();return;}
    const next=clone();
    if(next.pomodoro)next.pomodoro=null;
    else {const now=Date.now();next.pomodoro={start:now,end:now+C.POMODORO_MS};}
    if(commit(next))render();
  };
}
function renderHabits(){
  const today=C.day(Date.now());
  $('#main').innerHTML=heading('执行力','每天一次，连续坚持21天。')+(state.habits.length?`<div class="list">${state.habits.map(h=>{
    const stats=C.habitStats(h,today);
    return `<article class="habit-card"><div class="habit-row"><details class="habit-details" data-habit="${escapeHTML(h.id)}"><summary><span class="task-title">${escapeHTML(h.name)}</span><span class="task-meta">连续 ${stats.current} / 21 天 · ${stats.done?'今日已执行':'今日待执行'}</span></summary><div class="habit-data"><p>目前已经坚持天数：<strong>${stats.current}天</strong></p><p>上次坚持天数：<strong>${stats.previous}天</strong></p><p>最近执行日期：${stats.lastDate?C.dateLabel(stats.lastDate):'尚未执行'}</p><button class="edit" data-edit="${escapeHTML(h.id)}">编辑执行内容</button></div></details><label class="check-wrap"><input type="checkbox" data-complete="${escapeHTML(h.id)}" ${stats.done?'checked':''} aria-label="今日执行 ${escapeHTML(h.name)}"></label></div></article>`;
  }).join('')}</div>`:empty('从一件想坚持的事开始','点击右下角 +，写下每天要执行的事情。','✓'))+'<p class="footnote">按北京时间每天计一次，可取消当天打卡。<br>漏过一整天会中断；连续第21天打卡后自动移除。</p><button class="fab" id="add" aria-label="添加执行事项">+</button>';
  $('#add').onclick=()=>openEditor('habits');
}
function tickClock(){
  const now=Date.now();$('#today').innerHTML=C.dateLabel(C.day(now))+'<br>北京时间 '+C.stamp(now).slice(11,16);
  if($('#elapsed'))$('#elapsed').textContent=C.elapsed(state.timer?now-state.timer.start:state.pending?state.pending.end-state.pending.start:0);
  if($('#countdown')){const seconds=state.pomodoro?Math.max(0,Math.ceil((state.pomodoro.end-now)/1000)):state.pomodoroPending?0:1500;$('#countdown').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
}
function processTime(){
  rollover();
  const next=clone();if(C.finishPomodoro(next)&&commit(next))render();
  showPending();tickClock();
}
// 锁屏/后台无法保证弹窗即时显示；回到前台按真实截止时间补做结算。
if(!storageBlocked)commit(state);
render();processTime();
setInterval(processTime,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)processTime();});
window.addEventListener('pageshow',processTime);
window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{if(!e.newValue)return;state=C.migrate(JSON.parse(e.newValue));$('#editor').close();editing=null;processTime();render();}catch{notify('其他窗口的数据更新未能读取，请重新打开页面。');}});
// 显式提示更新，不强制刷新正在填写的表单；缓存更新不接触 localStorage。
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
    const offer=()=>{const bar=$('#update-banner');bar.hidden=false;$('#update-button').onclick=()=>{if($('#editor').open){notify('请先保存或取消当前表单，再更新');return;}sessionStorage.setItem('shishi-reload-on-update','1');reg.waiting?.postMessage({type:'SKIP_WAITING'});};};
    if(reg.waiting)offer();
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});
    reg.update().catch(()=>{});
  }).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(sessionStorage.getItem('shishi-reload-on-update')){sessionStorage.removeItem('shishi-reload-on-update');location.reload();}});
}
