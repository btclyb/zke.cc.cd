export async function onRequest(context) {
  if (!['GET','HEAD'].includes(context.request.method)) return new Response('Method not allowed',{status:405});
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : context.params.path;
  const routes = {status:'/api/status',addresses:'/addresses.txt',getADDAPI:'/api/getADDAPI'};
  if(!Object.hasOwn(routes,path)) return new Response('Not found',{status:404});
  try {
    const upstream = await fetch('https://freckle-arid-parrot.abasthan.app'+routes[path],{signal:AbortSignal.timeout(12000),redirect:'error',headers:{'User-Agent':'EdgeLens-Dashboard/1.0'}});
    const type = upstream.headers.get('Content-Type')||'';
    if (!type.includes(path==='addresses'?'text/plain':'application/json')) throw new Error('Unexpected response');
    return new Response(context.request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch { return new Response(JSON.stringify({error:'检测实例暂不可达或正在唤醒，请稍后刷新。'}),{status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}}); }
}