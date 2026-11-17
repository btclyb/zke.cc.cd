// Same-origin relay: fail clearly instead of forwarding HTML or hanging indefinitely.
export async function onRequestGet() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  const headers = {'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff'};
  try {
    const response = await fetch('https://api.zke.cc.cd', {
      signal: controller.signal,
      redirect: 'manual',
      cf: {cacheTtl: 60, cacheEverything: true}
    });
    if (!response.ok) throw new Error('Upstream unavailable');
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response');
    const quotes = {};
    for (const key of ['btc', 'spy', 'nvda', 'gold']) {
      const item = data[key];
      if (!item || !['string', 'number'].includes(typeof item.price) || !String(item.price).trim() ||
          item.change == null || item.change === '' || !Number.isFinite(Number(item.change))) continue;
      quotes[key] = {
        price: String(item.price).slice(0, 64), change: Number(item.change),
        history: Array.isArray(item.history) ? item.history.filter(value => typeof value === 'number' && Number.isFinite(value)).slice(-120) : []
      };
    }
    if (!Object.keys(quotes).length) throw new Error('No usable quotes');
    return new Response(JSON.stringify(quotes), {headers: {...headers, 'cache-control': 'public, max-age=60'}});
  } catch {
    return new Response(JSON.stringify({error: '行情服务暂时不可用，请稍后重试。'}), {
      status: 503, headers: {...headers, 'cache-control': 'no-store', 'retry-after': '60'}
    });
  } finally { clearTimeout(timer); }
}
