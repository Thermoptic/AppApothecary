// A small, safe Markdown renderer for repository READMEs.
// It builds DOM nodes with textContent only (no innerHTML), allows only http(s) links and images,
// and resolves relative paths against the repository on GitHub.

import { h } from './ui.js';

const LI = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Turn the common HTML in READMEs into Markdown, one line at a time. */
function prepLine(line) {
  if (!line.includes('<')) return line;
  return line
    .replace(/<!--.*?-->/g, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const src = /\bsrc=["']([^"']+)["']/i.exec(tag);
      const alt = /\balt=["']([^"']*)["']/i.exec(tag);
      return src ? `![${alt ? alt[1] : ''}](${src[1]})` : '';
    })
    .replace(/<a\b[^>]*?href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/gi, (_, n, t) => '#'.repeat(+n) + ' ' + t)
    .replace(/<br\s*\/?>/gi, '  ')
    .replace(/<\/?(a|p|div|span|center|details|summary|b|i|em|strong|picture|source|table|thead|tbody|tr|td|th|ul|ol|li|kbd|sup|sub|u|small|font|hr|h[1-6])\b[^>]*>/gi, '');
}

function resolve(url, kind, base) {
  url = url.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#') || url.startsWith('//')) return null;
  if (!base || !base.repo) return null;
  const path = url.replace(/^\.?\//, '');
  return kind === 'img'
    ? `https://raw.githubusercontent.com/${base.repo}/${base.branch}/${path}`
    : `https://github.com/${base.repo}/blob/${base.branch}/${path}`;
}

const INLINE = /(`+)([\s\S]*?[^`])\1(?!`)|!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)|\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)|\*\*([^*]+?)\*\*|\*([^*\s][^*]*?)\*|(https?:\/\/[^\s<>)\]]+)/g;

function inline(text, base) {
  const out = [];
  let last = 0, m;
  const re = new RegExp(INLINE.source, 'g'); // its own state: inline() calls itself for nested text
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) out.push(h('code', {}, m[2].trim()));
    else if (m[4] !== undefined) {
      const src = resolve(m[4], 'img', base);
      out.push(src ? h('img', { src, alt: m[3], loading: 'lazy' }) : m[3]);
    } else if (m[6] !== undefined) {
      const href = resolve(m[6], 'link', base);
      const kids = inline(m[5], base);
      out.push(href ? h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, kids) : kids);
    } else if (m[7] !== undefined) out.push(h('strong', {}, inline(m[7], base)));
    else if (m[8] !== undefined) out.push(h('em', {}, inline(m[8], base)));
    else if (m[9] !== undefined) {
      const url = m[9].replace(/[.,;:!?]+$/, '');
      out.push(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, url));
      last = m.index + url.length; re.lastIndex = last; continue;
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function list(lines, i, base) {
  const first = LI.exec(lines[i]);
  const indent = first[1].length;
  const ul = h(/\d/.test(first[2]) ? 'ol' : 'ul');
  let lastLi = null;
  while (i < lines.length) {
    if (!lines[i].trim()) { // a blank line inside a list: keep going only if the list resumes
      let j = i; while (j < lines.length && !lines[j].trim()) j++;
      const nx = j < lines.length && LI.exec(lines[j]);
      if (nx && nx[1].length >= indent) { i = j; continue; }
      break;
    }
    const m = LI.exec(lines[i]);
    if (!m || m[1].length < indent) break;
    if (m[1].length > indent && lastLi) { const [sub, ni] = list(lines, i, base); lastLi.append(sub); i = ni; continue; }
    lastLi = h('li', {}, inline(m[3], base));
    ul.append(lastLi); i++;
    while (i < lines.length && lines[i].trim() && !LI.test(lines[i]) && /^\s{2,}\S/.test(lines[i])) { lastLi.append(' ', inline(lines[i].trim(), base)); i++; }
  }
  return [ul, i];
}

const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function renderMarkdown(src, base) {
  const out = h('div', { class: 'md' });
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const fence = /^\s*(```+|~~~+)\s*([\w+#.-]*)/.exec(raw);
    if (fence) { // fenced code
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1].slice(0, 3))) body.push(lines[i++]);
      i++;
      out.append(h('pre', {}, h('code', {}, body.join('\n'))));
      continue;
    }
    const line = prepLine(raw);
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) {
      out.append(h('h' + Math.min(6, m[1].length + 2), { class: 'md-h' + m[1].length }, inline(m[2], base)));
      i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.append(h('hr')); i++; continue; }
    if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      const inner = renderMarkdown(quote.join('\n'), base);
      out.append(h('blockquote', {}, [...inner.childNodes]));
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(prepLine(lines[i++])));
      out.append(h('div', { class: 'md-table' }, h('table', {},
        h('thead', {}, h('tr', {}, head.map((c) => h('th', {}, inline(c, base))))),
        h('tbody', {}, rows.map((r) => h('tr', {}, head.map((_, k) => h('td', {}, inline(r[k] || '', base)))))))));
      continue;
    }
    if (LI.test(line)) {
      const prepared = [];
      let j = i;
      while (j < lines.length && (lines[j].trim() === '' || LI.test(prepLine(lines[j])) || /^\s{2,}\S/.test(lines[j]))) { prepared.push(prepLine(lines[j])); j++; if (!lines[j - 1].trim() && j < lines.length && !LI.test(prepLine(lines[j])) && !/^\s{2,}\S/.test(lines[j])) break; }
      const [el] = list(prepared, 0, base);
      out.append(el);
      i = j; continue;
    }
    // paragraph: gather lines until a blank line or the start of another block
    const para = [line];
    i++;
    while (i < lines.length) {
      const nx = prepLine(lines[i]);
      if (!nx.trim() || /^(#{1,6}\s|\s*>|\s*(```|~~~))/.test(nx) || LI.test(nx) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(nx)) break;
      para.push(nx); i++;
    }
    const kids = [];
    para.forEach((l, k) => { if (k) kids.push(/ {2,}$/.test(para[k - 1]) ? h('br') : ' '); kids.push(inline(l.trim(), base)); });
    out.append(h('p', {}, kids));
  }
  return out;
}
