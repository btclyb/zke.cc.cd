const allowedTags = new Set('P BR HR H1 H2 H3 H4 H5 H6 UL OL LI BLOCKQUOTE PRE CODE EM STRONG DEL S A IMG TABLE THEAD TBODY TR TH TD SUP SUB KBD DETAILS SUMMARY'.split(' '));
const blockedTags = new Set('SCRIPT STYLE IFRAME OBJECT EMBED SVG MATH FORM INPUT BUTTON TEXTAREA SELECT OPTION LINK META BASE TEMPLATE NOSCRIPT'.split(' '));
export function safeURL(raw, image = false) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw, location.href);
    return (image ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:']).includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
// Build fresh, allowlisted nodes; raw Markdown HTML never enters the live document.
export function safeMarkdown(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const clean = document.createDocumentFragment();
  function copy(source, parent) {
    if (source.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(source.textContent)); return; }
    if (source.nodeType !== Node.ELEMENT_NODE || blockedTags.has(source.tagName)) return;
    if (!allowedTags.has(source.tagName)) { for (const child of source.childNodes) copy(child, parent); return; }
    const node = document.createElement(source.tagName.toLowerCase());
    if (source.hasAttribute('title')) node.title = source.getAttribute('title');
    if (source.tagName === 'A') {
      const href = safeURL(source.getAttribute('href') || '');
      if (href) {
        node.href = href;
        if (new URL(href).origin !== location.origin && !href.startsWith('mailto:')) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
      }
    }
    if (source.tagName === 'IMG') {
      const src = safeURL(source.getAttribute('src') || '', true);
      if (!src) return;
      node.src = src; node.alt = source.getAttribute('alt') || '';
      node.loading = 'lazy'; node.decoding = 'async'; node.referrerPolicy = 'no-referrer';
    }
    if (source.tagName === 'OL' && /^\d{1,6}$/.test(source.getAttribute('start') || '')) node.start = Number(source.getAttribute('start'));
    for (const child of source.childNodes) copy(child, node);
    parent.append(node);
  }
  for (const child of parsed.body.childNodes) copy(child, clean);
  return clean;
}
