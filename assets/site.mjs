export const $ = id => document.getElementById(id);
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
export async function getJSON(url, timeout = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
export function normalizeNotes(value) {
  if (!Array.isArray(value)) throw new Error('Invalid notes index');
  const seen = new Set();
  return value.filter(note => {
    if (!note || note.draft || typeof note.slug !== 'string' || !/^[\w-]+$/.test(note.slug) ||
        typeof note.title !== 'string' || !note.title.trim() ||
        typeof note.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(note.date) || seen.has(note.slug)) return false;
    seen.add(note.slug); return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}
export const loadNotes = async () => normalizeNotes(await getJSON('/notes/index.json'));
export function noteRow(note, shortDate = false) {
  const li = element('li'), link = element('a');
  link.href = '/note?p=' + encodeURIComponent(note.slug);
  const date = element('time', 'm', (shortDate ? note.date.slice(5) : note.date).replaceAll('-', '.'));
  date.dateTime = note.date;
  link.append(element('span', 't', note.title), element('span', 'd', note.summary || ''), date);
  li.append(link); return li;
}
export function showError(container, message, retry) {
  const box = element('div', 'load-error');
  box.append(element('p', '', message));
  const button = element('button', 'text-button', '重新加载');
  button.type = 'button'; button.addEventListener('click', retry);
  box.append(button); container.replaceChildren(box);
}
export function initPage() {
  if ($('y')) $('y').textContent = new Date().getFullYear();
}
