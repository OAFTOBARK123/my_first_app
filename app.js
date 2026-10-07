/* 所有业务数据集中存入一个 localStorage 键；每次修改成功落盘后才更新界面。 */
const C=TimeCore, KEY='shishi.time-manager.v1';
const $=selector=>document.querySelector(selector);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fresh=()=>({version:1,lastDay:C.day(Date.now()),timer:null,pending:null,records:[],deadlines:[],todos:[]});
let state=fresh(),page='timer',editing=null,toastTimer,storageBlocked=false;
try {const raw=localStorage.getItem(KEY);if(raw){state=JSON.parse(raw);if(state.version!==1||!Array.isArray(state.records)||!Array.isArray(state.todos)||!Array.isArray(state.deadlines)||!/^\d{4}-\d{2}-\d{2}$/.test(state.lastDay))throw Error('数据格式异常');}}
catch(e){storageBlocked=true;state=fresh();$('#storage-error').hidden=false;$('#storage-error').textContent='无法读取本机数据，已停止写入以保护原数据。请确认浏览器允许网站存储；不要清除浏览器数据。';}
function commit(next){if(storageBlocked)return false;try{localStorage.setItem(KEY,JSON.stringify(next));state=next;$('#storage-error').hidden=true;return true;}catch(e){$('#storage-error').hidden=false;$('#storage-error').textContent='保存失败：浏览器存储不可用或空间不足。请保留当前页面，释放空间后重试。';return false;}}
const clone=()=>JSON.parse(JSON.stringify(state));
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2300);}
const icons={timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6M12 2v3"/>',deadline:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-8 3v3l2 1"/>',todos:'<rect x="5" y="4" width="15" height="17" rx="3"/><path d="m8 12 2 2 5-5M9 3h7"/>',records:'<path d="M6 3h10l3 3v15H6zM9 9h7M9 13h7M9 17h4"/>',study:'<path d="M3 5c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2zM12 7v14"/>'};
const names={timer:'计时',deadline:'Deadline',todos:'日待办',records:'工作记录',study:'学习进度'};
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
  }else if(page==='deadline'){
    $('#main').innerHTML=heading('Deadline','把截止时间记下来，让每一步都有安排。')+(state.deadlines.length?`<div class="list">${[...state.deadlines].sort((a,b)=>a.due-b.due).map(t=>`<article class="task"><label class="check-wrap"><input type="checkbox" data-complete="${t.id}" aria-label="完成并移除 ${escapeHTML(t.name)}"></label><div class="task-body"><div class="task-title">${escapeHTML(t.name)} · ${C.stamp(t.due).slice(0,16)}</div><div class="task-meta">${t.due<Date.now()?'已过截止时间':'北京时间'}</div></div><button class="edit" data-edit="${t.id}">编辑</button></article>`).join('')}</div>`:empty('还没有截止任务','点击右下角 +，添加一个 Deadline。','▦'))+'<button class="fab" id="add" aria-label="添加截止任务">+</button>';
    $('#add').onclick=()=>openEditor('deadline');
  }else if(page==='todos'){
    $('#main').innerHTML=heading('日待办清单','给今天一个明确的小目标。')+(state.todos.length?`<div class="list">${state.todos.map(t=>`<article class="task ${t.done?'done':''}"><label class="check-wrap"><input type="checkbox" data-complete="${t.id}" ${t.done?'checked':''} aria-label="完成 ${escapeHTML(t.name)}"></label><div class="task-body">${t.carriedFrom?`<span class="badge">${C.shortDate(t.carriedFrom)}未完成的任务</span>`:''}<div class="task-title">${t.carriedFrom?C.shortDate(t.carriedFrom)+'未完成的任务':escapeHTML(t.name)}</div>${t.carriedFrom?`<div class="task-meta">原任务：${escapeHTML(t.name)}</div>`:''}<div class="task-meta">${escapeHTML(t.slot)}</div></div><button class="edit" data-edit="${t.id}">编辑</button></article>`).join('')}</div>`:empty('今天，从一件小事开始','点击右下角 +，写下任务和计划时段。','☑'))+'<p class="footnote">北京时间 0:00 清理已完成任务，保留未完成任务</p><button class="fab" id="add" aria-label="添加日待办">+</button>';
    $('#add').onclick=()=>openEditor('todos');
  }else if(page==='records'){
    let previous='';
    const records=[...state.records].sort((a,b)=>b.start-a.start).map(r=>{const day=C.day(r.start);const group=previous!==day?`<h2 class="group-heading">${C.dateLabel(day)}</h2>`:'';previous=day;return `${group}<details class="record"><summary>${C.minutes(r.start,r.end)}分钟的${escapeHTML(r.content)}</summary><div class="readonly">开始：${C.stamp(r.start).slice(0,16)}\n结束：${C.stamp(r.end).slice(0,16)}\n总时长：${C.minutes(r.start,r.end)}分钟（不足一分钟按 0 分钟显示）</div><p><label>工作量</label>${escapeHTML(r.amount)}</p><p><label>反思</label>${escapeHTML(r.reflection)||'未填写'}</p><button class="edit" data-edit="${r.id}">编辑记录</button></details>`;}).join('');
    $('#main').innerHTML=heading('工作记录',`${state.records.length} 次专注，每一份努力都有迹可循。`)+(records||empty('第一份记录，等待开始','完成一次计时并保存，就会出现在这里。','▤'));
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
function openEditor(kind,id){
  const collection=kind==='deadline'?'deadlines':kind==='todos'?'todos':'records';
  const value=kind==='session'?state.pending:state[collection].find(t=>t.id===id)||{};
  if(!value)return;
  editing={kind,id,collection};$('#form-error').textContent='';
  $('#modal-title').textContent=kind==='session'?'保存这段专注':kind==='records'?'编辑工作记录':(id?'编辑':'添加')+(kind==='deadline'?' Deadline':'日待办');
  $('#fields').innerHTML=(kind==='session'||kind==='records')?`<div class="readonly">${C.stamp(value.start)} →\n${C.stamp(value.end)}\n持续 ${C.minutes(value.start,value.end)} 分钟</div>`+field('content','工作内容 · 必填',value.content)+field('amount','工作量 · 必填',value.amount)+field('reflection','反思 · 选填',value.reflection,true):kind==='deadline'?field('name','任务名 · 必填',value.name)+field('due','截止日期与时间 · 北京时间',value.due?C.stamp(value.due).slice(0,16).replace(' ','T'):'',false,'datetime-local'):field('name','任务名 · 必填',value.name)+field('slot','答应在哪个时间段完成 · 必填',value.slot);
  if(!$('#editor').open)$('#editor').showModal();
}
function closeEditor(discard=true){if(editing?.kind==='session'&&discard){const next=clone();next.pending=null;if(!commit(next))return;}$('#editor').close();editing=null;render();}
$('.cancel').onclick=()=>closeEditor();$('.close').onclick=()=>closeEditor();
$('#editor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
// 保存未提交的计时表单草稿，刷新后继续填写。
$('#editor-form').addEventListener('input',()=>{if(editing?.kind!=='session')return;const next=clone();if(!next.pending)return;for(const k of ['content','amount','reflection'])next.pending[k]=$(`[name="${k}"]`).value;commit(next);});
$('#editor-form').onsubmit=e=>{
  e.preventDefault();if(!editing)return;
  rollover();
  const values=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,v.trim()]));
  const {kind,id,collection}=editing;
  if(Object.entries(values).some(([k,v])=>k!=='reflection'&&!v)){$('#form-error').textContent='请填写所有必填项，不能只输入空格。';return;}
  const next=clone();
  if(kind==='session'){if(!next.pending)return;next.records.push({...next.pending,...values,id:uid()});next.pending=null;}
  else{
    if(kind==='deadline'){values.due=C.parseDeadline(values.due);if(!Number.isFinite(values.due)){$('#form-error').textContent='请选择有效的截止日期和时间。';return;}}
    if(id){const index=next[collection].findIndex(t=>t.id===id);if(index===-1){$('#form-error').textContent='这项任务已经被移除，请取消后重新添加。';return;}next[collection][index]={...next[collection][index],...values};}
    else next[collection].push({id:uid(),...values,...(kind==='todos'?{createdDay:C.day(Date.now()),done:false,carriedFrom:null}:{})});
  }
  if(commit(next)){closeEditor(false);notify('已保存');}
};
$('#main').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]');if(edit)openEditor(page,edit.dataset.edit);});
$('#main').addEventListener('change',e=>{const input=e.target.closest('[data-complete]');if(!input)return;rollover();const next=clone();if(page==='deadline')next.deadlines=next.deadlines.filter(t=>t.id!==input.dataset.complete);else{const t=next.todos.find(t=>t.id===input.dataset.complete);if(t)t.done=input.checked;}if(commit(next)){if(page==='deadline'){render();notify('任务已完成并移除');}else input.closest('.task').classList.toggle('done',input.checked);}else input.checked=!input.checked;});
function rollover(){const next=clone();if(C.rollover(next)&&commit(next)){render();return true;}return false;}
function tickClock(){const now=Date.now();$('#today').innerHTML=C.dateLabel(C.day(now))+'<br>北京时间 '+C.stamp(now).slice(11,16);if($('#elapsed'))$('#elapsed').textContent=C.elapsed(state.timer?now-state.timer.start:state.pending?state.pending.end-state.pending.start:0);}
// 后台定时器可能暂停；每次打开、回到前台和每秒都检查北京日期。
rollover();render();if(state.pending)openEditor('session');
setInterval(()=>{rollover();tickClock();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){rollover();tickClock();}});
window.addEventListener('pageshow',()=>{rollover();tickClock();});
window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{const updated=JSON.parse(e.newValue);if(updated?.version!==1)return;state=updated;$('#editor').close();editing=null;rollover();render();if(state.pending)openEditor('session');}catch{notify('其他窗口的数据更新未能读取，请重新打开页面。');}});
if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
