// Start page: the module wall. Head row, category cells, search + tags, then one module per project.

import { h, set, icon, fmtShort, fmtNum, fmtSize, screenEl, modColors, SOURCE } from '../ui.js';
import { state, isAdmin, visibleProjects, catOf, imgSrc, tagCounts } from '../store.js';
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

// Filter state survives navigating to a project and back.
const ui = { q: '', cat: '', tags: new Set(), sort: '' };
let shown = null; // ids on the wall after the last draw, so only newcomers sweep in

export function renderHome(root) {
  const d = state.data;
  if (!ui.sort || !SORTS[ui.sort]) ui.sort = SORTS[d.settings.sort] ? d.settings.sort : 'updated';
  if (ui.cat && !d.categories.some((c) => c.id === ui.cat)) ui.cat = '';
  const all = visibleProjects();
  const numbers = unitNumbers();

  const wallBox = h('div');
  shown = null;
  const catRow = h('div', { class: 'cells', role: 'group', 'aria-label': 'Filter by category' });
  const tagCells = h('div', { style: { display: 'contents' } });

  function drawFilters() {
    set(catRow,
      h('button', { class: 'cell-btn', 'aria-pressed': String(!ui.cat), onclick: () => { ui.cat = ''; draw(); } }, 'All', h('span', { class: 'n' }, pad3(all.length))),
      d.categories.map((c) => {
        const n = all.filter((p) => p.category === c.id).length;
        return n || isAdmin() ? h('button', {
          class: 'cell-btn', style: { '--c': c.color }, 'aria-pressed': String(ui.cat === c.id),
          onclick: () => { ui.cat = ui.cat === c.id ? '' : c.id; draw(); },
        }, h('i'), c.name, h('span', { class: 'n' }, pad3(n))) : null;
      }));
    const used = tagCounts().filter(([t, n]) => n > 0 && all.some((p) => p.tags.includes(t)));
    set(tagCells, used.slice(0, 24).map(([t]) => h('button', {
      class: 'cell-btn', 'aria-pressed': String(ui.tags.has(t)),
      onclick: () => { ui.tags.has(t) ? ui.tags.delete(t) : ui.tags.add(t); draw(); },
    }, '#' + t)));
  }

  function drawWall() {
    const q = ui.q.trim().toLowerCase();
    const list = all.filter((p) =>
      (!ui.cat || p.category === ui.cat) &&
      [...ui.tags].every((t) => p.tags.includes(t)) &&
      (!q || [p.title, p.summary, p.description, p.tags.join(' '), (catOf(p) || {}).name || ''].join(' ').toLowerCase().includes(q)));
    const cmp = SORTS[ui.sort][1];
    list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || cmp(a, b));

    const filtered = list.length !== all.length;
    set(wallBox,
      filtered && h('div', { class: 'result-meta lb' }, `Showing ${pad3(list.length)} of ${pad3(all.length)}`,
        h('button', { onclick: () => { ui.q = ''; ui.cat = ''; ui.tags.clear(); search.value = ''; draw(); } }, 'Clear filters')),
      list.length
        ? h('div', { class: 'flush wall' }, list.map((p) => module(p, numbers.get(p.id))))
        : h('div', { class: 'empty' }, all.length ? 'Nothing matches these filters.' : 'No projects yet.',
          isAdmin() && !all.length && h('div', { style: { 'margin-top': '14px' } }, h('button', { class: 'btn primary', onclick: () => openEditor() }, icon('plus'), 'Add your first project'))));
    sweepIn();
  }
  const sweepIn = () => {
    const first = !shown; let i = 0;
    const now = new Set();
    wallBox.querySelectorAll('.mod').forEach((m) => {
      now.add(m.dataset.id);
      if (first || !shown.has(m.dataset.id)) wipe(m, { color: 'var(--t)', delay: (first ? 260 : 0) + Math.min(i++, 11) * 60 });
    });
    shown = now;
  };
  const draw = () => { drawFilters(); drawWall(); };

  const search = h('input', {
    type: 'search', placeholder: 'SEARCH PROJECTS', 'aria-label': 'Search projects', value: ui.q,
    oninput: (e) => { ui.q = e.target.value; drawWall(); },
  });
  const sort = h('select', { class: 'bigsel', 'aria-label': 'Sort by', value: ui.sort, onchange: (e) => { ui.sort = e.target.value; drawWall(); } },
    Object.entries(SORTS).map(([k, v]) => h('option', { value: k }, v[0])));

  const p = d.profile;
  const gh = all.filter((x) => x.source === 'github').length;
  const itch = all.filter((x) => x.source === 'itch').length;
  set(root,
    h('section', { class: 'flush wall-head' },
      h('div', {},
        h('h1', {}, p.title),
        p.tagline && h('p', { class: 'tagline' }, p.tagline),
        (p.github || p.itch) && h('div', { class: 'links' },
          p.github && h('a', { class: 'btn sm', href: 'https://github.com/' + encodeURIComponent(p.github), target: '_blank', rel: 'noopener' }, 'GitHub', icon('ext', 14)),
          p.itch && h('a', { class: 'btn sm', href: p.itch, target: '_blank', rel: 'noopener' }, 'itch.io', icon('ext', 14)))),
      h('div', {}, h('span', { class: 'lb' }, 'Sort'), sort),
      h('div', {}, h('span', { class: 'lb' }, 'Units'), h('span', { class: 'big' }, pad3(all.length)),
        h('span', { class: 'lb muted' }, [gh && gh + ' GitHub', itch && itch + ' itch.io'].filter(Boolean).join(' · ') || 'On the wall'))),
    catRow,
    h('div', { class: 'cells', role: 'group', 'aria-label': 'Search and tags' },
      h('div', { class: 'search' }, h('span', { class: 'ico' }, icon('search', 16)), search), tagCells),
    wallBox);
  draw();
}

function specOf(p) {
  const s = p.stats;
  if (s) return [['stars', fmtNum(s.stars)], ['commits', fmtNum(s.commits)]];
  if (p.facts.length) return p.facts.slice(0, 2).map((f) => [f.label, f.value]);
  return [['src', SOURCE[p.source] || 'Project']];
}

function module(p, n) {
  const cat = catOf(p);
  return h('a', { class: 'mod', href: '#/p/' + encodeURIComponent(p.id), style: modColors(cat), 'aria-label': p.title, 'data-id': p.id },
    screenEl(p, imgSrc(p.cover), cat ? cat.name : ''),
    h('div', { class: 'nrow' }, h('div', { class: 'num' }, n), h('span', { class: 'lb' }, SOURCE[p.source] || 'Project')),
    h('div', { class: 'info' },
      h('b', {}, p.title),
      p.summary && h('p', {}, p.summary),
      h('div', { class: 'spec' }, specOf(p).map(([k, v]) => [h('span', {}, k), h('b', {}, v)]))),
    h('div', { class: 'foot' },
      h('div', { class: 'keys', title: p.featured ? 'Pinned' : null }, h('i', { class: p.featured ? 'k' : null }), h('i')),
      h('span', { class: 'lb' }, fmtShort(p.updated || p.created))));
}
