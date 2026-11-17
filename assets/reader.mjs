import { safeMarkdown } from './markdown.mjs';
import { $, element, loadNotes, showError, initPage } from './site.mjs';
initPage();
const slug = new URLSearchParams(location.search).get('p') || '';
function fail(title, message) {
  document.title = `${title} — Liu Yb`;
  $('title').textContent = title; $('meta').textContent = '';
  $('toc').hidden = true; $('neighbors').hidden = true;
  showError($('content'), message, load);
}
async function load() {
  $('content').setAttribute('aria-busy', 'true');
  if (!/^[\w-]+$/.test(slug)) {
    fail('链接不正确', '请返回全部笔记，选择要阅读的文章。'); $('content').setAttribute('aria-busy', 'false'); return;
  }
  try {
    const notes = await loadNotes(), index = notes.findIndex(note => note.slug === slug);
    if (index < 0) { fail('找不到这篇笔记', '这篇笔记尚未公开，或链接已经失效。'); return; }
    const info = notes[index], controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let markdown;
    try {
      const response = await fetch(`/notes/${slug}.md`, {signal: controller.signal, cache: 'no-cache'});
      if (!response.ok) throw new Error('Missing article');
      markdown = await response.text();
    } finally { clearTimeout(timer); }
    if (!window.marked?.parse) throw new Error('Markdown renderer unavailable');
    const body = markdown.replace(/^\uFEFF?\s*#\s+[^\n]*(?:\n|$)/, '');
    $('content').replaceChildren(safeMarkdown(window.marked.parse(body, {gfm: true, breaks: true})));
    document.title = `${info.title} — Liu Yb`; $('title').textContent = info.title;
    const minutes = Math.max(1, Math.ceil($('content').textContent.replace(/\s/g, '').length / 450));
    $('meta').textContent = `${info.date.replaceAll('-', '.')} · 约 ${minutes} 分钟阅读`;
    document.querySelector('meta[name="description"]').content = info.summary || info.title;
    const headings = [...$('content').querySelectorAll('h2, h3')];
    $('toc-links').replaceChildren();
    headings.forEach((heading, i) => {
      heading.id = `section-${i + 1}`;
      const link = element('a', heading.tagName === 'H3' ? 'toc-sub' : '', heading.textContent);
      link.href = '#' + heading.id; $('toc-links').append(link);
    });
    $('toc').hidden = headings.length < 2;
    $('neighbors').replaceChildren();
    for (const [note, label] of [[notes[index + 1], '上一篇'], [notes[index - 1], '下一篇']]) {
      if (!note) continue;
      const link = element('a'); link.href = '/note?p=' + encodeURIComponent(note.slug);
      link.append(element('span', 'note', label), element('span', '', note.title)); $('neighbors').append(link);
    }
    $('neighbors').hidden = !$('neighbors').childElementCount;
    updateProgress();
    if (/^#section-\d+$/.test(location.hash)) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch { fail('笔记暂时无法加载', '请检查网络后重试，也可以返回全部笔记。'); }
  finally { $('content').setAttribute('aria-busy', 'false'); }
}
let scheduled = false;
function updateProgress() {
  const content = $('content'), top = content.getBoundingClientRect().top + window.scrollY;
  const distance = content.offsetHeight - window.innerHeight;
  const ratio = distance > 0 ? (window.scrollY - top) / distance : (window.scrollY >= top ? 1 : 0);
  $('progress').style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  scheduled = false;
}
addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updateProgress); } }, {passive: true});
addEventListener('resize', updateProgress, {passive: true});
load();
