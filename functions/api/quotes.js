// Cloudflare Pages Function: 同源代理行情 API，避免浏览器跨域(CORS)问题
export async function onRequestGet() {
  const r = await fetch('https://api.zke.cc.cd', { cf: { cacheTtl: 60, cacheEverything: true } });
  return new Response(r.body, {
    status: r.status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' }
  });
}
