const SOURCE='https://raw.githubusercontent.com/LancelotRar/best-cf-ips/main/best-cf-ip-scanned-top20.txt';
const CIDRS=['173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','141.101.64.0/18','108.162.192.0/18','190.93.240.0/20','188.114.96.0/20','197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/13','104.24.0.0/14','172.64.0.0/13','131.0.72.0/22'];
let cached=null,loadedAt=0,pending=null;
function num(ip){return ip.split('.').reduce((a,n)=>(a*256+Number(n))>>>0,0)}
export function parseTelecom(text,now=Date.now()){
 const stamp=text.match(/^#.*scanned at (\d{4}-\d\d-\d\d \d\d:\d\d)/m)?.[1];
 if(!stamp)throw Error('上游没有可识别的更新时间');
 const sourceAt=new Date(stamp.replace(' ','T')+':00+08:00').toISOString();
 const age=now-Date.parse(sourceAt);
 if(age < -300000 || age > 86400000)throw Error('电信源已过期或时间异常，暂不输出地址');
 const rows=[],seen=new Set();
 for(const line of text.split(/\r?\n/)){
  const m=line.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})#([^\r\n]{1,80})$/);
  if(!m)continue;
  const ip=m[1],port=Number(m[2]);
  if(ip.split('.').some(n=>Number(n)>255)||![443,2053,2083,2087,2096,8443].includes(port))continue;
  if(!CIDRS.some(c=>{const [base,bits]=c.split('/');return num(ip) >>> (32-Number(bits)) === num(base) >>> (32-Number(bits))}))continue;
  const k=ip+':'+port;if(seen.has(k))continue;seen.add(k);
  rows.push({ip,port,remark:m[3],rank:rows.length+1});
 }
 if(!rows.length)throw Error('电信源未包含有效的 Cloudflare 地址');
 return {success:true,source:'LancelotRar/best-cf-ips · 电信通用优选',sourceUrl:SOURCE,sourceAt,checkedAt:new Date(now).toISOString(),region:'电信通用；未经广东线路实测验证',rows:rows.slice(0,20),data:rows.slice(0,20).map(x=>x.ip+':'+x.port+'#电信通用-'+x.remark)};
}
async function telecom(){
 if(cached&&Date.now()-loadedAt<600000&&Date.now()-Date.parse(cached.sourceAt)<86400000)return cached;
 if(pending)return pending;
 pending=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch(SOURCE,{signal:controller.signal,redirect:'manual',headers:{'User-Agent':'EdgeLens telecom source reader'}});if(r.status!==200)throw Error('电信源暂不可达');const text=await r.text();if(text.length>32768)throw Error('电信源内容异常');const result=parseTelecom(text);cached=result;loadedAt=Date.now();return result;}finally{clearTimeout(timer)}})();
 try{return await pending}finally{pending=null}
}
export async function onRequest(context){
 if(!['GET','HEAD'].includes(context.request.method))return new Response('Method not allowed',{status:405});
 const path=Array.isArray(context.params.path)?context.params.path.join('/'):context.params.path;
 const jsonHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(['addresses','getADDAPI','telecom'].includes(path)){
  try{const info=await telecom();const body=path==='addresses'?info.data.join('\n'):JSON.stringify(info);
   return new Response(context.request.method==='HEAD'?null:body,{headers:{...jsonHeaders,'Content-Type':path==='addresses'?'text/plain; charset=utf-8':jsonHeaders['Content-Type']}});
  }catch(e){return new Response(path==='addresses'?'':JSON.stringify({success:false,data:[],error:e.message}),{status:503,headers:jsonHeaders})}
 }
 if(path!=='status')return new Response('Not found',{status:404});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch('https://freckle-arid-parrot.abasthan.app/api/status',{signal:controller.signal,redirect:'manual'});if(r.status>=300&&r.status<400)throw Error('redirect');return new Response(context.request.method==='HEAD'?null:r.body,{status:r.status,headers:jsonHeaders})}
 catch{return new Response(JSON.stringify({error:'服务器检测暂不可达或正在唤醒'}),{status:503,headers:jsonHeaders})}finally{clearTimeout(timer)}
}