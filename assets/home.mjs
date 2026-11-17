import { $, element, getJSON, loadNotes, noteRow, initPage } from './site.mjs';
initPage();

// Static name remains readable without JavaScript. Animation runs only for a fine pointer.
const name = $('name');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
if (!motion.matches && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const letters = [...name.textContent].map(text => {
    const span = element('span', '', text); span.setAttribute('aria-hidden', 'true'); return span;
  });
  name.replaceChildren(...letters);
  let frame = 0, pointer = null, boxes = [], weight = letters.map(() => 200);
  const measure = () => { boxes = letters.map(node => node.getBoundingClientRect()); };
  measure();
  function tick() {
    let moving = false;
    letters.forEach((node, i) => {
      const box = boxes[i];
      const distance = pointer ? Math.hypot(pointer.x - box.left - box.width / 2, pointer.y - box.top - box.height / 2) : Infinity;
      const target = 200 + Math.max(0, 1 - distance / 180) * 400;
      const delta = target - weight[i];
      if (Math.abs(delta) > 1) { weight[i] += delta * .18; moving = true; }
      else weight[i] = target;
      node.style.fontVariationSettings = `"wght" ${Math.round(weight[i])}`;
    });
    frame = moving ? requestAnimationFrame(tick) : 0;
  }
  const kick = () => { if (motion.matches) return; if (!frame) frame = requestAnimationFrame(tick); };
  name.addEventListener('pointerenter', measure);
  name.addEventListener('pointermove', event => { pointer = {x: event.clientX, y: event.clientY}; kick(); }, {passive: true});
  name.addEventListener('pointerleave', () => { pointer = null; kick(); });
  motion.addEventListener?.('change', () => { if (motion.matches) { cancelAnimationFrame(frame); frame = 0; letters.forEach(node => node.style.fontVariationSettings = '"wght" 200'); } });
}

async function notes() {
  const list = $('notes'); list.setAttribute('aria-busy', 'true'); $('notes-state').replaceChildren();
  try {
    const entries = await loadNotes();
    list.replaceChildren(...entries.slice(0, 5).map(note => noteRow(note)));
    if (!entries.length) list.append(element('li', 'list-state', '还没有公开笔记。'));
    $('more').hidden = entries.length <= 5;
    if (entries.length > 5) $('more').firstElementChild.textContent = `全部笔记（共 ${entries.length} 篇）→`;
  } catch {
    list.replaceChildren(element('li', 'list-state', '笔记暂时未能加载。'));
    const retry = element('button', 'text-button', '重新加载笔记'); retry.type = 'button';
    retry.addEventListener('click', notes); $('notes-state').append(retry);
  } finally { list.setAttribute('aria-busy', 'false'); }
}
notes();

const rows = [...document.querySelectorAll('.q')];
let fetching = false, lastSuccess = null, refreshTimer;
const time = date => date.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai'});
function drawSpark(svg, history) {
  const values = Array.isArray(history) ? history.filter(value => typeof value === 'number' && Number.isFinite(value)).slice(-120) : [];
  svg.replaceChildren();
  if (values.length < 2) return;
  const min = Math.min(...values), span = Math.max(...values) - min || 1;
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', values.map((value, i) => `${(i / (values.length - 1) * 120).toFixed(1)},${(30 - (value - min) / span * 28).toFixed(1)}`).join(' '));
  svg.append(line);
}
async function quotes() {
  if (fetching || document.hidden) return;
  fetching = true; $('quotes-retry').disabled = true;
  try {
    const data = await getJSON('/api/quotes');
    const valid = rows.filter(row => {
      const quote = data?.[row.dataset.k];
      return quote && ['string', 'number'].includes(typeof quote.price) && String(quote.price).trim() && Number.isFinite(Number(quote.change)) && quote.change != null && quote.change !== '';
    });
    if (!valid.length) throw new Error('No quotes');
    rows.forEach(row => {
      row.classList.remove('up', 'down');
      if (!valid.includes(row)) {
        row.querySelector('.p').textContent = '—'; row.querySelector('.c').textContent = '暂缺';
        row.querySelector('.spark').replaceChildren(); return;
      }
      const quote = data[row.dataset.k], change = Number(quote.change);
      row.querySelector('.p').textContent = String(quote.price);
      row.querySelector('.c').textContent = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
      if (change) row.classList.add(change > 0 ? 'up' : 'down');
      drawSpark(row.querySelector('.spark'), quote.history);
    });
    lastSuccess = new Date();
    $('qnote').textContent = `北京时间 ${time(lastSuccess)} 拉取 · ${valid.length}/4 个标的可用。行情可能延迟，涨跌幅按数据源口径。`;
    $('quotes-retry').hidden = valid.length === rows.length;
  } catch {
    $('qnote').textContent = lastSuccess ? `刷新失败，当前保留北京时间 ${time(lastSuccess)} 拉取的数据，可能已过期。` : '行情暂时无法加载，可点击重试。';
    $('quotes-retry').hidden = false;
  } finally {
    fetching = false; $('quotes-retry').disabled = false;
    clearTimeout(refreshTimer);
    if (!document.hidden) refreshTimer = setTimeout(quotes, 60000);
  }
}
$('quotes-retry').addEventListener('click', quotes);
document.addEventListener('visibilitychange', () => { clearTimeout(refreshTimer); if (!document.hidden) quotes(); });
quotes();
