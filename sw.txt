const CACHE="mission-maison-pwa-v4";
const CORE=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];

const INPUT_FIX=`<script id="mission-keyboard-focus-fix">
(()=>{
  if(window.__missionKeyboardFocusFix)return;
  window.__missionKeyboardFocusFix=true;

  const originalRender=window.render;
  const originalPullCloud=window.pullCloud;
  if(typeof originalRender!=="function")return;

  let allowUserRenderUntil=0;
  const editingField=()=>{
    const el=document.activeElement;
    return !!el&&((el.matches&&el.matches("input,textarea,select"))||el.isContentEditable);
  };

  document.addEventListener("pointerdown",e=>{
    if(e.target&&e.target.closest&&e.target.closest("button"))allowUserRenderUntil=Date.now()+1200;
  },true);
  document.addEventListener("keydown",e=>{
    if(e.key==="Enter")allowUserRenderUntil=Date.now()+1200;
  },true);

  window.render=function(...args){
    if(editingField()&&Date.now()>allowUserRenderUntil)return;
    return originalRender.apply(this,args);
  };

  if(typeof originalPullCloud==="function"){
    window.pullCloud=function(...args){
      if(editingField())return Promise.resolve();
      return originalPullCloud.apply(this,args);
    };
  }
})();
<\/script>`;

async function patchHtmlResponse(resp){
  if(!resp)return resp;
  const fallback=resp.clone();
  try{
    const type=resp.headers.get("content-type")||"";
    if(!type.includes("text/html"))return resp;
    let html=await resp.text();
    if(!html.includes("mission-keyboard-focus-fix")){
      html=html.replace("</body>",INPUT_FIX+"\n</body>");
    }
    const headers=new Headers(resp.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("etag");
    return new Response(html,{status:resp.status,statusText:resp.statusText,headers});
  }catch(e){
    return fallback;
  }
}

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET") return;

  if(req.mode==="navigate"){
    event.respondWith(
      fetch(req).then(async resp=>{
        const patched=await patchHtmlResponse(resp);
        const copy=patched.clone();
        caches.open(CACHE).then(c=>c.put("./index.html",copy));
        return patched;
      }).catch(async()=>patchHtmlResponse(await caches.match("./index.html")))
    );
    return;
  }

  const url=new URL(req.url);
  if(url.origin===self.location.origin){
    event.respondWith(
      caches.match(req).then(cached=>{
        const fresh=fetch(req).then(resp=>{
          if(resp.ok) caches.open(CACHE).then(c=>c.put(req,resp.clone()));
          return resp;
        }).catch(()=>cached);
        return cached || fresh;
      })
    );
  }
});
