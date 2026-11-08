/* 与界面分离的北京时间及跨天逻辑，便于以后扩展和验证。 */
(function (root) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const stamp = ms => formatter.format(new Date(ms));
  const day = ms => stamp(ms).slice(0,10);
  const dateLabel = key => {const [y,m,d]=key.split('-').map(Number);return `${y}年${m}月${d}日`;};
  const shortDate = key => {const [,m,d]=key.split('-').map(Number);return `${m}月${d}日`;};
  const minutes = (start,end) => Math.floor(Math.max(0,end-start)/60000);
  const elapsed = ms => {const sec=Math.floor(Math.max(0,ms)/1000);return [Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,'0')).join(':');};
  // 日期选择器给出无时区字符串，必须显式加 +08:00，不能按设备时区解析。
  const parseDeadline = value => Date.parse(value+':00+08:00');
  function rollover(state, now=Date.now()) {
    const today=day(now);
    if(state.lastDay>=today) return false;
    state.todos=state.todos.filter(t=>!t.done).map(t=>({...t,carriedFrom:t.carriedFrom||t.createdDay||state.lastDay}));
    state.lastDay=today;
    return true;
  }
  const POMODORO_MS=25*60*1000;
  // 只补充新字段，不改原存储键和原有数据版本；旧记录、计时、草稿原样保留。
  function migrate(state) {
    if(state.version!==1||!Array.isArray(state.records)||!Array.isArray(state.todos)||!Array.isArray(state.deadlines)||!/^\d{4}-\d{2}-\d{2}$/.test(state.lastDay))throw Error('数据格式异常');
    for(const key of ['pomodoroRecords','habits']) {
      if(state[key]===undefined)state[key]=[];
      if(!Array.isArray(state[key]))throw Error('新增数据格式异常');
    }
    if(state.pomodoro===undefined)state.pomodoro=null;
    if(state.pomodoroPending===undefined)state.pomodoroPending=null;
    return state;
  }
  // 使用日期序号比较相邻日，避免设备时区、月份长度、跨年和夏令时的影响。
  const dayNumber=key=>Math.floor(Date.parse(key+'T00:00:00+08:00')/86400000);
  function habitStats(habit,today=day(Date.now())) {
    const dates=[...new Set(habit.checkedDays||[])].filter(d=>d<=today).sort();
    const runs=[];
    for(const d of dates){const run=runs[runs.length-1];if(run&&dayNumber(d)-dayNumber(run.end)===1){run.end=d;run.count++;}else runs.push({start:d,end:d,count:1});}
    const latest=runs[runs.length-1];
    const active=latest&&dayNumber(today)-dayNumber(latest.end)<=1;
    const previous=active?runs[runs.length-2]:latest;
    return {current:active?latest.count:0,previous:previous?.count||0,done:dates.includes(today),lastDate:latest?.end||null};
  }
  function toggleHabit(habit,today=day(Date.now())) {
    const dates=new Set(habit.checkedDays||[]);
    if(dates.has(today))dates.delete(today);else dates.add(today);
    habit.checkedDays=[...dates].sort();
    return habitStats(habit,today);
  }
  // 以固定截止时间结算；关闭一天后回来也只生成一条准确的 25 分钟记录。
  function finishPomodoro(state,now=Date.now()) {
    if(!state.pomodoro||state.pomodoroPending||now<state.pomodoro.end)return false;
    state.pomodoroPending={start:state.pomodoro.start,end:state.pomodoro.end,content:'',amount:'',reflection:''};
    state.pomodoro=null;
    return true;
  }
  const api={stamp,day,dateLabel,shortDate,minutes,elapsed,parseDeadline,rollover,migrate,habitStats,toggleHabit,finishPomodoro,POMODORO_MS};
  root.TimeCore=api;
  if(typeof module!=='undefined') module.exports=api;
})(globalThis);
