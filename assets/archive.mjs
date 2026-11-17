import { $, element, loadNotes, noteRow, showError, initPage } from './site.mjs';
initPage();
const params = new URLSearchParams(location.search);
$('search').value = (params.get('q') || '').slice(0, 200);
$('category').value = ['market', 'notes'].includes(params.get('type')) ? params.get('type') : 'all';
let entries = [];
function render() {
  const query = $('search').value.trim().toLocaleLowerCase(), category = $('category').value;
  const found = entries.filter(note => {
    const market = note.slug.startsWith('btc-analysis-');
    return (category === 'all' || (category === 'market' ? market : !market)) &&
      `${note.title} ${note.summary || ''} ${note.date}`.toLocaleLowerCase().includes(query);
  });
  $('count').textContent = `共 ${entries.length} 篇 · 显示 ${found.length} 篇`;
  const fragment = document.createDocumentFragment();
  let year = '', list;
  for (const note of found) {
    if (note.date.slice(0, 4) !== year) {
      year = note.date.slice(0, 4); fragment.append(element('h2', 'year', year));
      list = element('ul', 'rows'); fragment.append(list);
    }
    list.append(noteRow(note, true));
  }
  if (!found.length) fragment.append(element('p', 'list-state', entries.length ? '没有匹配的笔记，试试其他关键词或清除筛选。' : '还没有公开笔记。'));
  $('list').replaceChildren(fragment);
  const next = new URLSearchParams();
  if (query) next.set('q', $('search').value.trim());
  if (category !== 'all') next.set('type', category);
  history.replaceState(null, '', location.pathname + (next.toString() ? '?' + next : ''));
}
async function load() {
  $('list').setAttribute('aria-busy', 'true'); $('count').textContent = '正在加载笔记…';
  try { entries = await loadNotes(); render(); }
  catch { $('count').textContent = '笔记加载失败'; showError($('list'), '无法获取笔记列表，请检查网络后重试。', load); }
  finally { $('list').setAttribute('aria-busy', 'false'); }
}
$('filters').addEventListener('submit', event => event.preventDefault());
$('search').addEventListener('input', render);
$('category').addEventListener('change', render);
$('filters').addEventListener('reset', () => { setTimeout(render, 0); });
load();
