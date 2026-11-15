// Project page: cover, description, screenshots, statistics and charts.

import { h, set, icon, fmtDate, fmtDateTime, fmtNum, fmtSize, coverEl, catBadge, prose, lightbox, toast, SOURCE } from '../ui.js';
import { state, isAdmin, catOf, imgSrc, touch } from '../store.js';
import { fetchStats } from '../github.js';
import { weeklyChart, releasesChart, languagesChart, heatmap } from '../charts.js';
import { openEditor } from './editor.js';

const tile = (k, v, sub, small) => h('div', { class: 'tile' },
  h('div', { class: 'k' }, k), h('div', { class: 'v' + (small ? ' sm' : '') }, v), sub && h('div', { class: 's' }, sub));
const panel = (title, sub, body, wide) => h('div', { class: 'panel' + (wide ? ' wide' : '') }, h('h3', {}, title), h('div', { class: 'sub' }, sub), body);
const timeOf = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };

export function renderProject(root, id) {
  const p = state.data.projects.find((x) => x.id === id);
  if (!p || (p.hidden && !isAdmin())) {
    set(root, h('a', { class: 'back', href: '#/' }, icon('back', 16), 'All projects'), h('div', { class: 'empty' }, 'This project does not exist.'));
    return 'Not found';
  }
  const cat = catOf(p);
  const s = p.stats;
  const shots = p.screenshots.map(imgSrc);
  const primary = { github: ['View on GitHub', 'code'], itch: ['Play on itch.io', 'play'], other: ['Open', 'ext'] }[p.source] || ['Open', 'ext'];

  async function refresh(btn) {
    btn.disabled = true;
    try { p.stats = await fetchStats(p.repo); p.updated = (p.stats.pushed || p.updated || '').slice(0, 10); touch(); toast('Statistics updated.'); }
    catch (e) { toast(e.message, true); btn.disabled = false; }
  }

  set(root, 
    h('a', { class: 'back', href: '#/' }, icon('back', 16), 'All projects'),
    h('div', { class: 'p-hero', style: { '--cat': cat ? cat.color : '#8d9199' } }, coverEl(p, cat, imgSrc(p.cover))),
    h('header', { class: 'p-head' },
      h('div', { class: 'meta' }, catBadge(cat), h('span', {}, SOURCE[p.source] || 'Project'),
        p.updated && h('span', {}, 'Updated ' + fmtDate(p.updated)), p.hidden && h('span', { class: 'tag' }, 'Hidden')),
      h('h1', {}, p.title),
      p.summary && h('p', { class: 'muted', style: { 'font-size': '1.1rem', 'max-width': '65ch' } }, p.summary),
      p.tags.length ? h('div', { class: 'tags' }, p.tags.map((t) => h('span', { class: 'tag' }, '#' + t))) : null,
      h('div', { class: 'p-actions' },
        p.url && h('a', { class: 'btn primary', href: p.url, target: '_blank', rel: 'noopener' }, icon(primary[1], 16), primary[0]),
        p.links.map((l) => h('a', { class: 'btn', href: l.url, target: '_blank', rel: 'noopener' }, icon('link', 16), l.label || l.url)),
        isAdmin() && h('button', { class: 'btn', onclick: () => openEditor(p) }, icon('edit', 16), 'Edit'),
        isAdmin() && p.source === 'github' && p.repo && h('button', { class: 'btn', onclick: (e) => refresh(e.currentTarget) }, icon('sync', 16), 'Refresh stats'))),

    p.description && h('section', { class: 'section' }, h('h2', {}, 'About'), prose(p.description)),

    shots.length ? h('section', { class: 'section' }, h('h2', {}, 'Screenshots'),
      h('div', { class: 'shots' }, shots.map((src, i) => h('button', { class: 'shot', 'aria-label': 'Open screenshot ' + (i + 1), onclick: () => lightbox(shots, i) },
        h('img', { src, alt: `${p.title} screenshot ${i + 1}`, loading: 'lazy' }))))) : null,

    p.source === 'itch' && /^\d+$/.test(p.itchId || '') ? h('section', { class: 'section' }, h('h2', {}, 'Get it'),
      h('iframe', { class: 'embed', src: `https://itch.io/embed/${p.itchId}`, title: p.title + ' on itch.io', loading: 'lazy' })) : null,

    h('section', { class: 'section' }, h('h2', {}, 'Details'),
      h('div', { class: 'tiles' },
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
      p.url && h('p', { class: 'small muted', style: { 'overflow-wrap': 'anywhere' } }, 'URL: ', h('a', { href: p.url, target: '_blank', rel: 'noopener', style: { color: 'var(--accent)' } }, p.url))),

    s ? statsSection(s) : null);
  return p.title;
}

function statsSection(s) {
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
      h('span', { class: 'muted small' }, fmtNum(c.commits)))))) : null,
    s.weeks.length && total ? panel('Commit activity', `${fmtNum(total)} commits in the last year, per week`, weeklyChart(s.weeks, s.syncedAt), true) : null,
    s.punch.length ? panel('When the work happens', 'Commits by weekday and hour', heatmap(s.punch), true) : null,
    withDl.length ? panel('Downloads per release', 'Release assets downloaded from GitHub', releasesChart(s.releases), true) : null,
  ].filter(Boolean);
  if (!panels.length) return null;
  return h('section', { class: 'section' }, h('h2', {}, 'Statistics'), h('div', { class: 'charts' }, panels),
    h('p', { class: 'synced' }, 'From GitHub, synced ' + fmtDateTime(s.syncedAt)));
}
