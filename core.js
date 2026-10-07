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
  const api={stamp,day,dateLabel,shortDate,minutes,elapsed,parseDeadline,rollover};
  root.TimeCore=api;
  if(typeof module!=='undefined') module.exports=api;
})(globalThis);
