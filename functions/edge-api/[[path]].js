export async function onRequest(context) {
 if(!['GET','HEAD'].includes(context.request.method))return new Response('Method not allowed',{status:405});
 const path=Array.isArray(context.params.path)?context.params.path.join('/'):context.params.path;
 const routes={status:'/api/status',addresses:'/addresses.txt',getADDAPI:'/api/getADDAPI'};
 if(!Object.hasOwn(routes,path))return new Response('Not found',{status:404});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try {
  const r=await fetch('https://freckle-arid-parrot.abasthan.app'+routes[path],{signal:controller.signal,redirect:'manual'});
  if(r.status>=300&&r.status<400)throw Error('Unexpected redirect');
  return new Response(context.request.method==='HEAD'?null:r.body,{status:r.status,headers:{'Content-Type':path==='addresses'?'text/plain; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response(path==='addresses'?'':JSON.stringify({success:false,data:[],error:'检测实例暂不可达或正在唤醒'}),{status:503,headers:{'Content-Type':path==='addresses'?'text/plain; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store'}})}finally{clearTimeout(timer)}
}