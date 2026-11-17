export async function onRequest(context) {
  if (!['GET','HEAD'].includes(context.request.method)) return new Response('Method not allowed',{status:405});
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : context.params.path;
  const routes = {status:'/api/status',addresses:'/addresses.txt',getADDAPI:'/api/getADDAPI'};
  if (!Object.hasOwn(routes,path)) return new Response('Not found',{status:404});
  try {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),12000);
    let upstream;
    try { upstream = await fetch('https://freckle-arid-parrot.abasthan.app'+routes[path],{signal:controller.signal,redirect:'error',headers:{'User-Agent':'EdgeLens dashboard relay'}}); } finally { clearTimeout(timer); }
    const type = path==='addresses'?'text/plain; charset=utf-8':'application/json; charset=utf-8';
    return new Response(context.request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch (err) { return new Response(JSON.stringify({error:'检测实例暂不可达或正在唤醒，请稍后刷新。',reason:String(err.message).slice(0,180)}),{status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}}); }
}
