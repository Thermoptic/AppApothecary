// Start page (Regal): category and tag filters on the left, the project list in the middle,
// a sort knob and a random-project button on the right.

import { h, set, icon, fmtDate, fmtNum, modColors, toast, SOURCE } from '../ui.js';
import { state, isAdmin, visibleProjects, catOf, tagCounts, mode, touch, imgSrc } from '../store.js';
import { firstReadmeImage } from '../md.js';
import { syncFromGitHub } from '../sync.js';
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
let shown = null; // ids listed after the last draw, so only newcomers sweep in

export function renderHome(root) {
  const d = state.data;
  if (!ui.sort || !SORTS[ui.sort]) ui.sort = SORTS[d.settings.sort] ? d.settings.sort : 'updated';
  if (ui.cat && !d.categories.some((c) => c.id === ui.cat)) ui.cat = '';
  const all = visibleProjects();
  const numbers = unitNumbers();
  const sortKeys = Object.keys(SORTS);
  const n = sortKeys.length;
  shown = null;

  const list = h('div', { class: 'r-list' });
  const catBox = h('div', { class: 'opts', role: 'group', 'aria-label': 'Filter by category' });
  const tagBox = h('div', { class: 'tagopts', role: 'group', 'aria-label': 'Filter by tag' });
  const tagWrap = h('div', {}, h('div', { class: 'lb' }, 'Tag'), tagBox);

  const opt = (id, label, count, color) => h('button', {
    class: 'opt', style: { '--c': color }, 'aria-pressed': String(ui.cat === id),
    onclick: () => { ui.cat = ui.cat === id ? '' : id; draw(); },
  }, h('i'), label, h('small', {}, count));

  function drawFilters() {
    set(catBox,
      opt('', 'All', all.length, 'var(--accent)'),
      d.categories.map((c) => {
        const count = all.filter((p) => p.category === c.id).length;
        return count || isAdmin() ? opt(c.id, c.name, count, c.color) : null;
      }));
    const used = tagCounts().filter(([t, k]) => k > 0 && all.some((p) => p.tags.includes(t)));
    set(tagBox, used.slice(0, 24).map(([t]) => h('button', {
      class: 'tagbtn', 'aria-pressed': String(ui.tags.has(t)),
      onclick: () => { ui.tags.has(t) ? ui.tags.delete(t) : ui.tags.add(t); draw(); },
    }, '#' + t)));
    tagWrap.hidden = !used.length;
  }

  function current() {
    const q = ui.q.trim().toLowerCase();
    const out = all.filter((p) =>
      (!ui.cat || p.category === ui.cat) &&
      [...ui.tags].every((t) => p.tags.includes(t)) &&
      (!q || [p.title, p.summary, p.description, p.tags.join(' '), (catOf(p) || {}).name || ''].join(' ').toLowerCase().includes(q)));
    const cmp = SORTS[ui.sort][1];
    return out.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || cmp(a, b));
  }

  function drawList() {
    const items = current();
    const filtered = items.length !== all.length;
    set(list,
      filtered && h('div', { class: 'result-meta' }, `Showing ${items.length} of ${all.length}`,
        h('button', { onclick: () => { ui.q = ''; ui.cat = ''; ui.tags.clear(); search.value = ''; draw(); } }, 'Clear filters')),
      items.length
        ? h('div', { class: 'rows' }, items.map((p) => row(p, numbers.get(p.id))))
        : h('div', { class: 'empty' }, all.length ? 'Nothing matches these filters.' : 'No projects yet.',
          isAdmin() && !all.length && h('div', { style: { 'margin-top': '14px' } }, h('button', { class: 'btn primary', onclick: () => openEditor() }, icon('plus'), 'Add your first project'))));
    const first = !shown; let i = 0;
    const now = new Set();
    list.querySelectorAll('.prj').forEach((el) => {
      now.add(el.dataset.id);
      if (first || !shown.has(el.dataset.id)) wipe(el, { color: 'var(--accent)', delay: (first ? 240 : 0) + Math.min(i++, 10) * 55, dur: 460 });
    });
    shown = now;
  }
  const draw = () => { drawFilters(); drawList(); };

  const search = h('input', {
    type: 'search', placeholder: 'Search projects', 'aria-label': 'Search projects', value: ui.q,
    oninput: (e) => { ui.q = e.target.value; drawList(); },
  });

  // ---- the knob ----
  const knob = h('div', { class: 'knob', role: 'slider', tabindex: '0', 'aria-label': 'Sort order', 'aria-valuemin': '0', 'aria-valuemax': String(n - 1) });
  const read = h('div', { class: 'k-read', 'aria-hidden': 'true' });
  const ticks = h('div', { class: 'ticks', 'aria-hidden': 'true' }, sortKeys.map(() => h('i')));
  function paint() {
    const i = sortKeys.indexOf(ui.sort);
    knob.style.setProperty('--a', String(i / (n - 1)));
    knob.setAttribute('aria-valuenow', String(i));
    knob.setAttribute('aria-valuetext', SORTS[ui.sort][0]);
    read.textContent = SORTS[ui.sort][0];
    [...ticks.children].forEach((t, k) => t.classList.toggle('on', k === i));
  }
  function setIndex(i) {
    i = Math.max(0, Math.min(n - 1, i));
    if (sortKeys[i] === ui.sort) return;
    ui.sort = sortKeys[i]; paint(); drawList();
  }
  const step = () => { ui.sort = sortKeys[(sortKeys.indexOf(ui.sort) + 1) % n]; paint(); drawList(); };
  let drag = null;
  knob.addEventListener('pointerdown', (e) => { knob.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: false }; });
  knob.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
    if (!drag.moved) return;
    const r = knob.getBoundingClientRect();
    let ang = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI; // 0 = up, clockwise
    if (ang > 135) ang = 135; else if (ang < -135) ang = -135;
    setIndex(Math.round((ang + 135) / 270 * (n - 1)));
  });
  knob.addEventListener('pointerup', () => { if (drag && !drag.moved) step(); drag = null; });
  knob.addEventListener('pointercancel', () => { drag = null; });
  knob.addEventListener('keydown', (e) => {
    const i = sortKeys.indexOf(ui.sort);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setIndex(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setIndex(i - 1);
    else if (e.key === 'Home') setIndex(0);
    else if (e.key === 'End') setIndex(n - 1);
    else if (e.key === 'Enter' || e.key === ' ') step();
    else return;
    e.preventDefault();
  });
  const go = h('button', {
    class: 'go', 'aria-label': 'Open a random project', title: 'Random project',
    onclick: () => { const pool = current(); const pick = pool[Math.floor(Math.random() * pool.length)]; if (pick) location.hash = '#/p/' + encodeURIComponent(pick.id); },
  }, icon('play', 22));

  const p = d.profile;
  const gh = all.filter((x) => x.source === 'github').length;
  const itch = all.filter((x) => x.source === 'itch').length;
  const m = mode();

  // ---- "Update from GitHub" (owner only) ----
  const statusEl = h('span', { class: 'st', role: 'status' }, m === 'remote' ? 'Editing live' : m === 'local' ? 'Local draft' : 'Up to date');
  const idle = statusEl.textContent;
  const updBtn = h('button', { class: 'btn sm upd', onclick: runUpdate }, 'REFRESH');
  async function runUpdate() {
    const owner = isAdmin(); // the owner saves the result; a visitor only sees it until the page is reloaded
    updBtn.disabled = true; updBtn.classList.add('spin');
    try {
      const res = await syncFromGitHub(state.data, { refresh: owner, onProgress: (t) => { statusEl.textContent = t; } });
      const names = (list) => list.slice(0, 3).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '');
      if (res.limited) toast(owner ? 'GitHub rate limit reached. Sign in with your token under Settings for a higher limit, or try again later.' : 'GitHub is limiting requests right now. Try again in a while.', true);
      if (res.added.length || res.refreshed.length) {
        if (owner) touch(); else window.dispatchEvent(new Event('hashchange')); // redraw the list
        toast([res.added.length && `Added ${names(res.added)}.`, owner && res.refreshed.length && `Refreshed ${res.refreshed.length} project${res.refreshed.length === 1 ? '' : 's'}.`, owner && mode() === 'remote' && 'Press Publish to save it.', !owner && 'Shown for this visit only.'].filter(Boolean).join(' '));
      } else if (!res.limited) toast(res.failed ? 'Could not reach GitHub for some projects. Try again.' : owner ? 'Everything is up to date.' : 'No new repositories found.', !!res.failed);
    } catch (e) { toast(e.message, true); }
    updBtn.disabled = false; updBtn.classList.remove('spin'); statusEl.textContent = idle;
  }

  set(root,
    h('div', { class: 'r-body' },
      h('aside', { class: 'r-side' }, h('div', {}, h('div', { class: 'lb' }, 'Category'), catBox), tagWrap),
      h('section', { class: 'r-head' },
        h('h1', {}, p.headline || 'Things I have made.'),
        p.tagline && h('p', { class: 'sub' }, p.tagline),
        (p.github || p.itch) && h('div', { class: 'links' },
          p.github && h('a', { class: 'btn sm', href: 'https://github.com/' + encodeURIComponent(p.github), target: '_blank', rel: 'noopener' }, 'GitHub', icon('ext', 14)),
          p.itch && h('a', { class: 'btn sm', href: p.itch, target: '_blank', rel: 'noopener' }, 'itch.io', icon('ext', 14))),
        h('div', { class: 'search' }, h('span', { class: 'ico' }, icon('search', 18)), search)),
      list,
      h('aside', { class: 'r-knob' }, h('div', { class: 'lb' }, 'Sort'), knob, ticks, read, go)),
    h('div', { class: 'r-foot' }, h('i'),
      statusEl,
      h('span', {}, `${all.length} project${all.length === 1 ? '' : 's'}`),
      gh ? h('span', {}, gh + ' on GitHub') : null,
      itch ? h('span', {}, itch + ' on itch.io') : null,
      updBtn));
  paint();
  draw();
}

/** A round picture for the list: the cover, else the first picture in the readme, else one of the UI patterns. */
function ball(p) {
  const el = h('span', { class: 'ball' });
  const pattern = () => {
    let hash = 0;
    for (const ch of p.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0; // the same project always gets the same pattern
    return h('span', { class: 'pt pt' + (hash % 4) });
  };
  const src = imgSrc(p.cover) || firstReadmeImage(p.readme, { repo: p.repo, branch: (p.stats && p.stats.branch) || 'main' });
  if (!src) { el.append(pattern()); return el; }
  const img = h('img', { src, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.replaceWith(pattern())); // a broken link falls back to the pattern
  el.append(img);
  return el;
}

function row(p, n) {
  const cat = catOf(p);
  const s = p.stats;
  const meta = [cat && cat.name, SOURCE[p.source] || 'Project', s && s.language].filter(Boolean).join(' · ');
  return h('a', { class: 'prj', href: '#/p/' + encodeURIComponent(p.id), style: modColors(cat), 'data-id': p.id },
    h('span', { class: 'n' }, pad3(n)),
    ball(p),
    h('span', { class: 't' },
      h('b', {}, p.title, p.hidden && h('em', { class: 'hid' }, 'Hidden')),
      p.summary && h('span', { class: 'sub' }, p.summary),
      h('span', { class: 'sub meta' }, meta)),
    h('span', { class: 'y' }, fmtDate(p.updated || p.created), s && s.stars ? h('span', {}, '★ ' + fmtNum(s.stars)) : null));
}
