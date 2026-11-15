// Start page: profile intro, search, filters, sorting and the project grid.

import { h, set, icon, fmtDate, fmtNum, coverEl, catBadge, SOURCE } from '../ui.js';
import { state, isAdmin, visibleProjects, catOf, imgSrc, tagCounts } from '../store.js';
import { openEditor } from './editor.js';

export const SORTS = {
  updated: ['Recently updated', (a, b) => when(b) - when(a)],
  created: ['Newest first', (a, b) => time(b.created) - time(a.created)],
  name: ['Name A–Z', (a, b) => a.title.localeCompare(b.title)],
  stars: ['Most stars', (a, b) => ((b.stats && b.stats.stars) || 0) - ((a.stats && a.stats.stars) || 0)],
  size: ['Largest', (a, b) => ((b.stats && b.stats.size) || 0) - ((a.stats && a.stats.size) || 0)],
};
const time = (s) => { const t = Date.parse(s); return isNaN(t) ? 0 : t; };
const when = (p) => time(p.updated) || time(p.created);

// Filter state survives navigating to a project and back.
const ui = { q: '', cat: '', tags: new Set(), sort: '' };

export function renderHome(root) {
  const d = state.data;
  if (!ui.sort || !SORTS[ui.sort]) ui.sort = SORTS[d.settings.sort] ? d.settings.sort : 'updated';
  if (ui.cat && !d.categories.some((c) => c.id === ui.cat)) ui.cat = '';
  const all = visibleProjects();

  const gridBox = h('div');
  const catRow = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by category' });
  const tagRow = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by tag' });

  function drawFilters() {
    set(catRow, 
      h('button', { class: 'chip', 'aria-pressed': String(!ui.cat), onclick: () => { ui.cat = ''; draw(); } }, 'All', h('span', { class: 'count' }, all.length)),
      d.categories.map((c) => {
        const n = all.filter((p) => p.category === c.id).length;
        return n || isAdmin() ? h('button', {
          class: 'chip', style: { '--cat': c.color }, 'aria-pressed': String(ui.cat === c.id),
          onclick: () => { ui.cat = ui.cat === c.id ? '' : c.id; draw(); },
        }, h('span', { class: 'dot' }), c.name, h('span', { class: 'count' }, n)) : null;
      }));
    const used = tagCounts().filter(([t, n]) => n > 0 && all.some((p) => p.tags.includes(t)));
    set(tagRow, used.slice(0, 24).map(([t]) => h('button', {
      class: 'chip', 'aria-pressed': String(ui.tags.has(t)),
      onclick: () => { ui.tags.has(t) ? ui.tags.delete(t) : ui.tags.add(t); draw(); },
    }, '#' + t)));
    tagRow.hidden = !used.length;
  }

  function drawGrid() {
    const q = ui.q.trim().toLowerCase();
    let list = all.filter((p) =>
      (!ui.cat || p.category === ui.cat) &&
      [...ui.tags].every((t) => p.tags.includes(t)) &&
      (!q || [p.title, p.summary, p.description, p.tags.join(' '), (catOf(p) || {}).name || ''].join(' ').toLowerCase().includes(q)));
    const cmp = SORTS[ui.sort][1];
    list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || cmp(a, b));

    const filtered = list.length !== all.length;
    set(gridBox, 
      h('div', { class: 'result-meta' }, filtered ? `${list.length} of ${all.length} projects` : `${all.length} project${all.length === 1 ? '' : 's'}`,
        filtered && h('button', { class: 'btn ghost sm', style: { 'margin-left': '8px' }, onclick: () => { ui.q = ''; ui.cat = ''; ui.tags.clear(); search.value = ''; draw(); } }, 'Clear filters')),
      list.length
        ? h('div', { class: 'grid' }, list.map(card))
        : h('div', { class: 'empty' }, all.length ? 'Nothing matches these filters.' : 'No projects yet.',
          isAdmin() && !all.length && h('div', { style: { 'margin-top': '14px' } }, h('button', { class: 'btn primary', onclick: () => openEditor() }, icon('plus'), 'Add your first project'))));
  }
  const draw = () => { drawFilters(); drawGrid(); };

  const search = h('input', {
    type: 'search', placeholder: 'Search projects', 'aria-label': 'Search projects', value: ui.q,
    oninput: (e) => { ui.q = e.target.value; drawGrid(); },
  });
  const sort = h('select', { class: 'sort', 'aria-label': 'Sort by', value: ui.sort, onchange: (e) => { ui.sort = e.target.value; drawGrid(); } },
    Object.entries(SORTS).map(([k, v]) => h('option', { value: k }, v[0])));

  const p = d.profile;
  const gh = all.filter((x) => x.source === 'github').length;
  const games = all.filter((x) => x.source === 'itch').length;
  set(root, 
    h('section', { class: 'hero' },
      h('h1', {}, p.title),
      p.tagline && h('p', { class: 'tagline' }, p.tagline),
      (p.github || p.itch) && h('div', { class: 'hero-links' },
        p.github && h('a', { class: 'btn sm', href: 'https://github.com/' + encodeURIComponent(p.github), target: '_blank', rel: 'noopener' }, icon('code', 16), 'GitHub'),
        p.itch && h('a', { class: 'btn sm', href: p.itch, target: '_blank', rel: 'noopener' }, icon('play', 16), 'itch.io')),
      h('div', { class: 'hero-stats' },
        h('span', {}, h('b', {}, all.length), ' projects'),
        gh ? h('span', {}, h('b', {}, gh), ' on GitHub') : null,
        games ? h('span', {}, h('b', {}, games), ' on itch.io') : null,
        h('span', {}, h('b', {}, d.categories.length), ' categories'))),
    h('section', { class: 'toolbar', 'aria-label': 'Filters' },
      h('div', { class: 'toolbar-top' }, h('div', { class: 'search' }, h('span', { class: 'ico' }, icon('search')), search), sort),
      catRow, tagRow),
    gridBox);
  draw();
}

function card(p) {
  const cat = catOf(p);
  const s = p.stats;
  return h('a', { class: 'card', href: '#/p/' + encodeURIComponent(p.id), style: { '--cat': cat ? cat.color : 'var(--border)' } },
    p.hidden && h('span', { class: 'badge-hidden' }, 'Hidden'),
    coverEl(p, cat, imgSrc(p.cover)),
    h('div', { class: 'card-body' },
      h('div', { class: 'card-top' }, catBadge(cat) || h('span'),
        p.featured && h('span', { class: 'muted', title: 'Pinned', 'aria-label': 'Pinned' }, icon('pin', 16))),
      h('h3', {}, p.title),
      p.summary && h('p', { class: 'summary' }, p.summary),
      p.tags.length ? h('div', { class: 'tags' }, p.tags.slice(0, 4).map((t) => h('span', { class: 'tag' }, '#' + t))) : null,
      h('div', { class: 'card-foot' },
        (p.updated || p.created) && h('span', { class: 'it' }, icon('cal', 14), fmtDate(p.updated || p.created)),
        h('span', { class: 'it' }, SOURCE[p.source] || 'Project'),
        s && s.stars ? h('span', { class: 'it' }, icon('star', 14), fmtNum(s.stars)) : null,
        s && s.language ? h('span', { class: 'it' }, s.language) : null)));
}
