// Entry point: loads data, draws the header and routes between views.

import { h, set, icon, toast, effectiveTheme, setTheme, confirmDialog } from './ui.js';
import { state, load, onChange, mode, isAdmin, publish } from './store.js';
import { destroyCharts } from './charts.js';
import { renderHome } from './views/home.js';
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
  set(header, h('div', { class: 'header-inner' },
    h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark' }, h('i'), h('i'), h('i'), h('i')), h('span', {}, state.data ? state.data.profile.title : '')),
    m !== 'view' && h('span', { class: 'pill-admin' }, m === 'remote' ? 'Editing' : 'Local draft'),
    h('span', { class: 'spacer' }),
    isAdmin() && state.data && h('button', { class: 'btn primary sm', onclick: () => openEditor() }, icon('plus', 16), 'Add'),
    h('button', { class: 'btn ghost icon', 'aria-label': dark ? 'Switch to light theme' : 'Switch to dark theme', onclick: () => setTheme(dark ? 'light' : 'dark') }, icon(dark ? 'sun' : 'moon')),
    h('a', { class: 'btn ghost icon', href: '#/settings', 'aria-label': 'Settings' }, icon('gear'))));

  set(footer, 
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
  if (hash !== lastRoute) { window.scrollTo(0, 0); lastRoute = hash; }
}

async function boot() {
  try { await load(); }
  catch (e) { set(main, h('div', { class: 'empty' }, 'Could not load the project data. ' + e.message)); return; }
  chrome(); route();
}

window.addEventListener('hashchange', route);
window.addEventListener('themechange', () => { chrome(); route(); });
window.addEventListener('ma-reload', boot);
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
onChange(({ rerender }) => { chrome(); if (rerender) route(); });
boot();
