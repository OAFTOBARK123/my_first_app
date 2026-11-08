// 以版本整体缓存；不读写用户 localStorage。更新由页面确认，不强制刷新表单。
const CACHE='shishi-static-v1.1.0';
const ASSETS=['./','./index.html','./style.css?v=1.1.0','./core.js?v=1.1.0','./app.js?v=1.1.0','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.location.href),{cache:'reload'})))));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('shishi-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    if(event.request.mode==='navigate')return (await cache.match('./index.html'))||fetch(event.request);
    return (await cache.match(event.request))||fetch(event.request);
  }));
});
