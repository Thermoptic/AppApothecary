// Entry point: loads data, draws the header and routes between views.

import { h, set, icon, toast, effectiveTheme, setTheme, confirmDialog } from './ui.js';
import { state, load, onChange, mode, isAdmin, publish, visibleProjects } from './store.js';
import { destroyCharts } from './charts.js';
import { initFx, pageSweep, coverSweep } from './fx.js';
import { renderHome, getCategory, setCategory } from './views/home.js';
import { runRefresh } from './refresh.js';
import { renderProject } from './views/project.js';
import { renderSettings } from './views/settings.js';
import { openEditor } from './views/editor.js';

const main = document.getElementById('main');
const header = document.getElementById('header');
const footer = document.getElementById('footer');
let savebar = null;
let lastRoute = '';

function chrome() {
  const m = mode();
  const dark = effectiveTheme() === 'dark';
  const onHome = (location.hash.replace(/^#/, '') || '/') === '/';
  const vis = state.data ? visibleProjects() : [];
  const cats = state.data ? state.data.categories.filter((c) => isAdmin() || vis.some((p) => p.category === c.id)) : [];
  const tab = (id, label, n) => h('a', {
    href: '#/', class: onHome && getCategory() === id ? 'on' : null,
    onclick: (e) => { e.preventDefault(); setCategory(id); if (onHome) route(); else location.hash = '#/'; },
  }, label, h('small', {}, String(n).padStart(2, '0')));
  const refresh = h('button', { class: 'btn primary upd', onclick: (e) => runRefresh(e.currentTarget) }, 'Refresh');
  set(header, h('div', { class: 'header-inner' },
    h('a', { class: 'brand', href: '#/' }, h('i', { class: 'reg' }), h('span', {}, state.data ? state.data.profile.title : '')),
    m !== 'view' && h('span', { class: 'lb mode' }, m === 'remote' ? 'Editing' : 'Local draft'),
    state.data && h('nav', { class: 'nav', 'aria-label': 'Categories' }, tab('', 'All', vis.length), cats.map((c) => tab(c.id, c.name, vis.filter((p) => p.category === c.id).length))),
    h('span', { class: 'spacer' }),
    h('button', { class: 'hbtn', 'aria-label': dark ? 'Switch to light theme' : 'Switch to dark theme', onclick: () => coverSweep(() => setTheme(dark ? 'light' : 'dark')) }, icon(dark ? 'sun' : 'moon', 16)),
    h('a', { class: 'hbtn', href: '#/settings', 'aria-label': 'Settings' }, icon('gear', 16)),
    isAdmin() && state.data && h('button', { class: 'btn', onclick: () => openEditor() }, '+ Add'),
    state.data && refresh));

  const gh = vis.filter((p) => p.source === 'github').length;
  const itch = vis.filter((p) => p.source === 'itch').length;
  const idle = m === 'remote' ? 'Editing live' : m === 'local' ? 'Local draft' : 'Up to date';
  set(footer,
    h('span', { class: 'st' }, h('i'), h('span', { id: 'status', 'data-idle': idle }, idle)),
    h('span', {}, `${vis.length} project${vis.length === 1 ? '' : 's'}`),
    gh ? h('span', {}, gh + ' on GitHub') : null,
    itch ? h('span', {}, itch + ' on itch.io') : null,
    h('span', { class: 'sp' }),
    h('span', {}, '© ' + new Date().getFullYear() + ' ' + (state.data ? state.data.profile.title : '')),
    h('a', { href: '#/settings' }, isAdmin() ? 'Settings' : 'Owner sign-in'));
  // Unpublished changes bar (only when editing against GitHub).
  if (state.dirty && m === 'remote') {
    if (!savebar) {
      const btn = h('button', { class: 'btn primary', onclick: async () => {
        btn.disabled = true; btn.textContent = 'Publishing…';
        try { await publish(); toast('Published. Visitors see it in about a minute.'); }
        catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Publish'; }
      } }, 'Publish');
      savebar = h('div', { class: 'savebar fixed', role: 'region', 'aria-label': 'Unpublished changes' },
        h('span', {}, 'Unpublished changes'),
        h('span', { class: 'row' },
          h('button', { class: 'btn ghost', style: { color: 'inherit' }, onclick: async () => {
            if (await confirmDialog('Discard all unpublished changes?', 'Discard')) boot();
          } }, 'Discard'), btn));
      document.body.append(savebar);
    }
  } else if (savebar) { savebar.remove(); savebar = null; }
}

function route() {
  if (!state.data) return;
  destroyCharts();
  const hash = location.hash.replace(/^#/, '') || '/';
  let title;
  const m = hash.match(/^\/p\/(.+)$/);
  if (m) title = renderProject(main, decodeURIComponent(m[1]));
  else if (hash === '/settings') title = renderSettings(main);
  else renderHome(main);
  document.title = (title ? title + ' · ' : '') + state.data.profile.title;
  chrome();
  if (hash !== lastRoute) { window.scrollTo(0, 0); lastRoute = hash; pageSweep(); }
}

async function boot() {
  try { await load(); }
  catch (e) { set(main, h('div', { class: 'empty' }, 'Could not load the project data. ' + e.message)); return; }
  chrome(); route();
}

window.addEventListener('hashchange', route);
window.addEventListener('themechange', () => { chrome(); route(); });
window.addEventListener('ma-reload', boot);
window.addEventListener('ma-chrome', () => chrome());
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
onChange(({ rerender }) => { chrome(); if (rerender) route(); });
initFx();
boot();
