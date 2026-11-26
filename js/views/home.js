// Start page (Marking Sheet): a sheet header, a toolbar, then every project as a tall row
// with a picture on the left, text and facts in the middle and links underneath.

import { h, set, icon, fmtShort, fmtNum, fmtSize, SOURCE } from '../ui.js';
import { state, isAdmin, visibleProjects, catOf, tagCounts, imgSrc } from '../store.js';
import { firstReadmeImage } from '../md.js';
import { openEditor } from './editor.js';
import { wipe } from '../fx.js';

export const SORTS = {
  updated: ['Recently updated', (a, b) => when(b) - when(a)],
  created: ['Newest first', (a, b) => time(b.created) - time(a.created)],
  name: ['Name A–Z', (a, b) => a.title.localeCompare(b.title)],
  stars: ['Most stars', (a, b) => ((b.stats && b.stats.stars) || 0) - ((a.stats && a.stats.stars) || 0)],
  size: ['Largest', (a, b) => ((b.stats && b.stats.size) || 0) - ((a.stats && a.stats.size) || 0)],
};
const time = (s) => { const t = Date.parse(s); return isNaN(t) ? 0 : t; };
const when = (p) => time(p.updated) || time(p.created);
const pad3 = (n) => String(n).padStart(3, '0');

/** Each project's unit number: 1 is the oldest. Stable under filtering and sorting. */
export function unitNumbers() {
  const sorted = [...state.data.projects].sort((a, b) => (time(a.created) || when(a)) - (time(b.created) || when(b)));
  return new Map(sorted.map((p, i) => [p.id, i + 1]));
}

// Filter state survives navigating to a project and back. The header tabs set the category.
const ui = { q: '', cat: '', tags: new Set(), sort: '' };
let shown = null; // ids listed after the last draw, so only newcomers sweep in
export const getCategory = () => ui.cat;
export const setCategory = (id) => { ui.cat = id || ''; };

export function renderHome(root) {
  const d = state.data;
  if (!ui.sort || !SORTS[ui.sort]) ui.sort = SORTS[d.settings.sort] ? d.settings.sort : 'updated';
  if (ui.cat && !d.categories.some((c) => c.id === ui.cat)) ui.cat = '';
  const all = visibleProjects();
  const numbers = unitNumbers();
  const sortKeys = Object.keys(SORTS);
  shown = null;

  const list = h('div', { class: 'items' });
  const resultBox = h('div');
  const tagRow = h('div', { class: 'tagrow', role: 'group', 'aria-label': 'Filter by tag' });

  function current() {
    const q = ui.q.trim().toLowerCase();
    const out = all.filter((p) =>
      (!ui.cat || p.category === ui.cat) &&
      [...ui.tags].every((t) => p.tags.includes(t)) &&
      (!q || [p.title, p.summary, p.description, p.tags.join(' '), (catOf(p) || {}).name || ''].join(' ').toLowerCase().includes(q)));
    const cmp = SORTS[ui.sort][1];
    return out.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || cmp(a, b));
  }

  function drawTags() {
    const used = tagCounts().filter(([t, k]) => k > 0 && all.some((p) => p.tags.includes(t)));
    set(tagRow, used.slice(0, 24).map(([t]) => h('button', {
      class: 'tagbtn', 'aria-pressed': String(ui.tags.has(t)),
      onclick: () => { ui.tags.has(t) ? ui.tags.delete(t) : ui.tags.add(t); draw(); },
    }, '#' + t)));
    tagRow.hidden = !used.length;
  }

  function drawList() {
    const items = current();
    const filtered = items.length !== all.length;
    set(resultBox, filtered && h('div', { class: 'result-meta' }, `Showing ${items.length} of ${all.length}`,
      h('button', { onclick: () => { ui.q = ''; ui.cat = ''; ui.tags.clear(); search.value = ''; draw(); window.dispatchEvent(new Event('ma-chrome')); } }, 'Clear filters')));
    set(list, items.length
      ? items.map((p) => item(p, numbers.get(p.id)))
      : h('div', { class: 'empty' }, all.length ? 'Nothing matches these filters.' : 'No projects yet.',
        isAdmin() && !all.length && h('div', { style: { 'margin-top': '14px' } }, h('button', { class: 'btn primary', onclick: () => openEditor() }, icon('plus', 14), 'Add your first project'))));
    const first = !shown; let i = 0;
    const now = new Set();
    list.querySelectorAll('.item').forEach((el) => {
      now.add(el.dataset.id);
      if (first || !shown.has(el.dataset.id)) wipe(el, { color: 'var(--accent)', delay: (first ? 240 : 0) + Math.min(i++, 10) * 55, dur: 460 });
    });
    shown = now;
  }
  const draw = () => { drawTags(); drawList(); };

  const search = h('input', {
    type: 'search', placeholder: 'Search projects', 'aria-label': 'Search projects', value: ui.q,
    oninput: (e) => { ui.q = e.target.value; drawList(); },
  });
  const sortBtn = h('button', { class: 'tbtn', title: 'Click to change the order' });
  const paintSort = () => { sortBtn.textContent = 'Sort: ' + SORTS[ui.sort][0] + ' ↓'; };
  sortBtn.addEventListener('click', () => { ui.sort = sortKeys[(sortKeys.indexOf(ui.sort) + 1) % sortKeys.length]; paintSort(); drawList(); });
  paintSort();
  const randomBtn = h('button', {
    class: 'tbtn', title: 'Open a random project',
    onclick: () => { const pool = current(); const pick = pool[Math.floor(Math.random() * pool.length)]; if (pick) location.hash = '#/p/' + encodeURIComponent(pick.id); },
  }, 'Random ↗');

  // ---- the sheet header ----
  const p = d.profile;
  const gh = all.filter((x) => x.source === 'github').length;
  const itch = all.filter((x) => x.source === 'itch').length;
  const synced = Math.max(0, ...all.map((x) => (x.stats && Date.parse(x.stats.syncedAt)) || 0));
  const refRow = (k, v, ok = 'OK') => h('div', { class: 'r' }, h('span', {}, k), h('span', {}, v), h('span', {}, ok));

  set(root,
    h('div', { class: 'sheet-top' }, h('i', { class: 'reg' }), h('span'), h('i', { class: 'reg' })),
    h('section', { class: 'sheet' },
      h('div', { class: 'refcard' },
        refRow('Ref', `${p.title} · marking sheet`),
        refRow('Name', p.github || p.title),
        refRow('Items', `${all.length} projects · ${gh} GitHub · ${itch} itch`),
        refRow('Sync', synced ? fmtShort(new Date(synced).toISOString()) : '—'),
        h('div', { class: 'barcode' }),
        h('div', { class: 'f' }, h('span', {}, 'Printed 100%'), h('span', {}, '*' + (p.github || 'sheet').toUpperCase() + '*'))),
      h('div', { class: 'intro' },
        h('h1', {}, p.headline || 'Things I have made.'),
        p.tagline && h('p', {}, p.tagline),
        (p.github || p.itch) && h('div', { class: 'links' },
          p.github && h('a', { class: 'btn sm', href: 'https://github.com/' + encodeURIComponent(p.github), target: '_blank', rel: 'noopener' }, 'GitHub ↗'),
          p.itch && h('a', { class: 'btn sm', href: p.itch, target: '_blank', rel: 'noopener' }, 'itch.io ↗')))),
    h('div', { class: 'toolbar' }, h('div', { class: 'search' }, h('span', { class: 'ico' }, icon('search', 15)), search), sortBtn, randomBtn, tagRow),
    resultBox,
    list);
  draw();
}

// ---------- one row ----------
const flag = (p) => (p.source === 'itch' ? 'ITCH' : p.tags.includes('fork') ? 'FORK' : 'OK');
const safe = (u) => /^https?:\/\//i.test(u || '');

function linksFor(p) {
  const out = [];
  const s = p.stats;
  if (p.source === 'github' && safe(p.url)) {
    const base = p.url.replace(/\/$/, '');
    out.push({ label: 'GitHub', url: base });
    if (s && s.releases && s.releases.length) out.push({ label: 'Releases', url: base + '/releases', note: s.releases.length });
    if (s && s.issues > 0) out.push({ label: 'Issues', url: base + '/issues', note: s.issues });
  } else if (safe(p.url)) out.push({ label: p.source === 'itch' ? 'itch.io' : 'Open', url: p.url });
  for (const l of p.links) if (safe(l.url)) out.push({ label: l.label || 'Link', url: l.url });
  return out;
}

function metaOf(p) {
  const cat = catOf(p);
  const s = p.stats;
  const m = [cat && cat.name, SOURCE[p.source] || 'Project'];
  if (s) {
    if (s.language) m.push(s.language);
    if (s.license) m.push(s.license);
    if (s.stars) m.push('★ ' + fmtNum(s.stars));
    if (s.commits) m.push(fmtNum(s.commits) + ' commits');
    if (s.size) m.push(fmtSize(s.size));
  } else p.facts.slice(0, 3).forEach((f) => m.push(f.value));
  p.tags.forEach((t) => m.push('#' + t));
  return m.filter(Boolean);
}

/** The picture: the cover, else the first real image in the readme (tinted in the ink), else a placeholder. */
function picEl(p) {
  const a = h('a', { class: 'pic', href: '#/p/' + encodeURIComponent(p.id), 'aria-label': p.title });
  const placeholder = () => h('span', { class: 'ph' }); // a plain box with a diagonal line
  const src = imgSrc(p.cover) || firstReadmeImage(p.readme, { repo: p.repo, branch: (p.stats && p.stats.branch) || 'main' });
  if (!src) { a.append(placeholder()); return a; }
  a.classList.add('has-img');
  const img = h('img', { src, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => { a.classList.remove('has-img'); img.replaceWith(placeholder()); }); // a broken link falls back to the placeholder
  a.append(img);
  return a;
}

function item(p, n) {
  const links = linksFor(p);
  return h('article', { class: 'item', 'data-id': p.id },
    picEl(p),
    h('div', { class: 'body' },
      h('div', { class: 'top' },
        h('span', { class: 'n' }, pad3(n)),
        h('a', { class: 'ttl', href: '#/p/' + encodeURIComponent(p.id) }, p.title),
        p.hidden && h('em', { class: 'hid' }, 'Hidden')),
      p.summary && h('p', { class: 'sum' }, p.summary),
      h('div', { class: 'meta' }, metaOf(p).map((t) => h('span', {}, t))),
      links.length ? h('div', { class: 'links' }, links.map((l) => h('a', { class: 'lk', href: l.url, target: '_blank', rel: 'noopener' },
        h('i'), h('span', {}, l.label), l.note ? h('small', {}, l.note) : null, h('span', { class: 'ar' }, '↗')))) : null),
    h('div', { class: 'rt' }, h('span', {}, fmtShort(p.updated || p.created)), h('span', { class: 'fl' }, flag(p))),
    h('i', { class: 'stamp' }, 'OK'));
}
