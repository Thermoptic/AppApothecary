// Project page: a full-width slab in the category color, then details and LCD-style statistics.

import { h, set, icon, fmtDate, fmtDateTime, fmtNum, fmtSize, screenEl, modColors, prose, lightbox, toast, SOURCE } from '../ui.js';
import { state, isAdmin, catOf, imgSrc, touch } from '../store.js';
import { fetchStats } from '../github.js';
import { weeklyChart, releasesChart, languagesChart, heatmap } from '../charts.js';
import { openEditor } from './editor.js';
import { unitNumbers } from './home.js';
import { wipe, wipeOnView } from '../fx.js';

const tile = (k, v, sub, small) => h('div', { class: 'tile' },
  h('div', { class: 'k' }, k), h('div', { class: 'v' + (small ? ' sm' : '') }, v), sub && h('div', { class: 's' }, sub));
const panel = (title, sub, body, wide) => h('div', { class: 'panel' + (wide ? ' wide' : '') }, h('h3', {}, title), h('div', { class: 'sub' }, sub), body);
const secHead = (title, right) => h('div', { class: 'sec-h lb' }, h('span', {}, title), right && h('span', {}, right));
const timeOf = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };

export function renderProject(root, id) {
  const p = state.data.projects.find((x) => x.id === id);
  const back = h('a', { class: 'backrow lb', href: '#/' }, icon('back', 14), 'All projects');
  if (!p || (p.hidden && !isAdmin())) {
    set(root, back, h('div', { class: 'empty' }, 'This project does not exist.'));
    return 'Not found';
  }
  const cat = catOf(p);
  const colors = modColors(cat);
  const s = p.stats;
  const shots = p.screenshots.map(imgSrc);
  const primary = { github: 'View on GitHub', itch: 'Play on itch.io', other: 'Open' }[p.source] || 'Open';

  async function refresh(btn) {
    btn.disabled = true;
    try { p.stats = await fetchStats(p.repo); p.updated = (p.stats.pushed || p.updated || '').slice(0, 10); touch(); toast('Statistics updated.'); }
    catch (e) { toast(e.message, true); btn.disabled = false; }
  }

  set(root,
    back,
    h('section', { class: 'p-slab', style: colors },
      h('div', { class: 'n' }, h('span', { class: 'lb' }, (cat ? cat.name : 'Project') + ':'), h('div', { class: 'num' }, unitNumbers().get(p.id))),
      h('div', { class: 'mid' },
        h('div', {}, h('h1', {}, p.title), p.summary && h('p', { class: 'sum' }, p.summary)),
        h('div', { class: 'tags' }, h('span', { class: 'tag' }, SOURCE[p.source] || 'Project'), p.hidden && h('span', { class: 'tag' }, 'Hidden'), p.tags.map((t) => h('span', { class: 'tag' }, '#' + t)))),
      h('div', { class: 'shot-cell' }, screenEl({ ...p, hidden: false }, imgSrc(p.cover), ''))),
    h('div', { class: 'actions' },
      p.url && h('a', { class: 'btn primary', href: p.url, target: '_blank', rel: 'noopener' }, primary, icon('ext', 15)),
      p.links.map((l) => h('a', { class: 'btn', href: l.url, target: '_blank', rel: 'noopener' }, l.label || l.url, icon('ext', 15))),
      isAdmin() && h('button', { class: 'btn', onclick: () => openEditor(p) }, icon('edit', 15), 'Edit'),
      isAdmin() && p.source === 'github' && p.repo && h('button', { class: 'btn', onclick: (e) => refresh(e.currentTarget) }, icon('sync', 15), 'Refresh stats')),

    p.description && [secHead('About'), h('div', { class: 'sec-body' }, prose(p.description))],

    shots.length ? [secHead('Screenshots', String(shots.length).padStart(2, '0')),
      h('div', { class: 'flush shots' }, shots.map((src, i) => h('button', { class: 'shot', 'aria-label': 'Open screenshot ' + (i + 1), onclick: () => lightbox(shots, i) },
        h('img', { src, alt: `${p.title} screenshot ${i + 1}`, loading: 'lazy' }))))] : null,

    p.source === 'itch' && /^\d+$/.test(p.itchId || '') ? [secHead('Get it'), h('div', { class: 'sec-body' },
      h('iframe', { class: 'embed', src: `https://itch.io/embed/${p.itchId}`, title: p.title + ' on itch.io', loading: 'lazy' }))] : null,

    secHead('Details'),
    h('div', { class: 'flush tiles' },
      s && [
        tile('Stars', fmtNum(s.stars)), tile('Forks', fmtNum(s.forks)), tile('Watchers', fmtNum(s.watchers)),
        tile('Open issues', fmtNum(s.issues)), tile('Commits', fmtNum(s.commits)), tile('Size', fmtSize(s.size)),
        s.language && tile('Main language', s.language, null, true),
        s.license && tile('License', s.license, null, true),
        s.releases.length ? tile('Releases', s.releases.length, 'Latest ' + s.releases[s.releases.length - 1].name) : null,
        s.releases.some((r) => r.downloads) ? tile('Downloads', fmtNum(s.releases.reduce((a, r) => a + r.downloads, 0))) : null,
      ],
      (s ? s.created : p.created) && tile('Created', fmtDate(s ? s.created : p.created), s ? timeOf(s.created) : null, true),
      s && s.pushed ? tile('Last push', fmtDate(s.pushed), timeOf(s.pushed), true)
        : p.updated && tile('Updated', fmtDate(p.updated), null, true),
      p.facts.map((f) => tile(f.label, f.value, null, true))),
    p.url && h('div', { class: 'urlrow lb' }, 'URL ', h('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.url)),

    s ? statsSection(s, colors['--pc']) : null);
  wipe(root.querySelector('.p-slab'), { color: 'var(--t)', delay: 240, dur: 620 });
  wipeOnView(root.querySelectorAll('.sec-h'), { color: 'var(--accent)' });
  wipeOnView(root.querySelectorAll('.tile'), { color: 'var(--text)', dur: 420 });
  wipeOnView(root.querySelectorAll('.panel'), { color: colors['--pc'], dur: 620 });
  wipeOnView(root.querySelectorAll('.shot'), { color: colors['--pc'] });
  return p.title;
}

function statsSection(s, color) {
  const total = s.weeks.reduce((a, b) => a + b, 0);
  const langs = Object.keys(s.languages).length;
  const maxC = Math.max(1, ...s.contributors.map((c) => c.commits));
  const withDl = s.releases.filter((r) => r.downloads > 0);
  const panels = [
    langs ? panel('Languages', 'Share of code by bytes', languagesChart(s.languages)) : null,
    s.contributors.length ? panel('Contributors', 'By number of commits', h('ul', { class: 'contrib' }, s.contributors.map((c) => h('li', {},
      c.avatar ? h('img', { src: c.avatar + (c.avatar.includes('?') ? '&' : '?') + 's=64', alt: '', loading: 'lazy' }) : h('span', { class: 'av' }),
      h('div', {}, c.url ? h('a', { href: c.url, target: '_blank', rel: 'noopener' }, c.login) : c.login,
        h('div', { class: 'bar-track' }, h('i', { style: { width: (c.commits / maxC * 100).toFixed(1) + '%' } }))),
      h('span', { class: 'cnt' }, fmtNum(c.commits)))))) : null,
    s.weeks.length && total ? panel('Commit activity', `${fmtNum(total)} commits in the last year, per week`, weeklyChart(s.weeks, s.syncedAt, color), true) : null,
    s.punch.length ? panel('When the work happens', 'Commits by weekday and hour', heatmap(s.punch), true) : null,
    withDl.length ? panel('Downloads per release', 'Release assets downloaded from GitHub', releasesChart(s.releases, color), true) : null,
  ].filter(Boolean);
  if (!panels.length) return null;
  return [secHead('Statistics', 'GitHub · synced ' + fmtDateTime(s.syncedAt)),
    h('div', { class: 'flush charts', style: { '--hc': color } }, panels)];
}
