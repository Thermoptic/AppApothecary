// Project page (Regal): title block with a plate, then ruled sections for details and statistics.

import { h, set, icon, fmtDate, fmtDateTime, fmtNum, fmtSize, modColors, prose, lightbox, toast, SOURCE } from '../ui.js';
import { state, isAdmin, catOf, imgSrc, touch } from '../store.js';
import { fetchStats, fetchReadme } from '../github.js';
import { renderMarkdown, firstReadmeImage } from '../md.js';
import { weeklyChart, releasesChart, languagesChart, heatmap } from '../charts.js';
import { openEditor } from './editor.js';
import { unitNumbers } from './home.js';
import { wipe, wipeOnView } from '../fx.js';

const tile = (k, v, sub, small) => h('div', { class: 'tile' },
  h('div', { class: 'k' }, k), h('div', { class: 'v' + (small ? ' sm' : '') }, v), sub && h('div', { class: 's' }, sub));
const panel = (title, sub, body, wide) => h('div', { class: 'panel' + (wide ? ' wide' : '') }, h('h3', {}, title), h('div', { class: 'sub' }, sub), body);
const sec = (label, aside, body) => h('section', { class: 'sec' },
  h('div', { class: 'sec-label' }, label, aside && h('small', {}, aside)), h('div', { class: 'sec-body' }, body));
const timeOf = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };

export function renderProject(root, id) {
  const p = state.data.projects.find((x) => x.id === id);
  const back = h('a', { class: 'backrow', href: '#/' }, icon('back', 16), 'All projects');
  if (!p || (p.hidden && !isAdmin())) {
    set(root, back, h('div', { class: 'empty' }, 'This project does not exist.'));
    return 'Not found';
  }
  const cat = catOf(p);
  const colors = modColors(cat);
  const s = p.stats;
  const shots = p.screenshots.map(imgSrc);
  const primary = { github: 'View on GitHub', itch: 'Play on itch.io', other: 'Open' }[p.source] || 'Open';
  const cover = imgSrc(p.cover) || firstReadmeImage(p.readme, { repo: p.repo, branch: (p.stats && p.stats.branch) || 'main' });

  async function refresh(btn) {
    btn.disabled = true;
    try { p.stats = await fetchStats(p.repo); p.updated = (p.stats.pushed || p.updated || '').slice(0, 10); p.readme = (await fetchReadme(p.repo)) || p.readme; touch(); toast('Statistics and readme updated.'); }
    catch (e) { toast(e.message, true); btn.disabled = false; }
  }

  const plate = cover
    ? h('div', { class: 'plate', style: colors }, h('img', { src: cover, alt: `${p.title} cover` }))
    : h('div', { class: 'plate', style: colors }, h('span', { class: 'ph' }));

  set(root,
    back,
    h('section', { class: 'p-top' },
      h('div', { class: 'p-info', style: colors },
        h('div', { class: 'crumb' }, h('i', { class: 'd' }), h('b', {}, cat ? cat.name : 'Project'), SOURCE[p.source] || 'Project',
          p.updated && '· Updated ' + fmtDate(p.updated), p.hidden && h('span', { class: 'tag' }, 'Hidden')),
        h('h1', {}, p.title),
        p.summary && h('p', { class: 'sum' }, p.summary),
        p.tags.length ? h('div', { class: 'tags' }, p.tags.map((t) => h('span', { class: 'tag' }, '#' + t))) : null,
        h('div', { class: 'actions' },
          p.url && h('a', { class: 'btn primary', href: p.url, target: '_blank', rel: 'noopener' }, primary, icon('ext', 15)),
          p.links.map((l) => h('a', { class: 'btn', href: l.url, target: '_blank', rel: 'noopener' }, l.label || l.url, icon('ext', 15))),
          isAdmin() && h('button', { class: 'btn', onclick: () => openEditor(p) }, icon('edit', 15), 'Edit'),
          isAdmin() && p.source === 'github' && p.repo && h('button', { class: 'btn', onclick: (e) => refresh(e.currentTarget) }, icon('sync', 15), 'Refresh stats'))),
      plate),

    p.description && sec('About', null, prose(p.description)),

    shots.length ? sec('Screenshots', String(shots.length) + (shots.length === 1 ? ' image' : ' images'),
      h('div', { class: 'shots' }, shots.map((src, i) => h('button', { class: 'shot', 'aria-label': 'Open screenshot ' + (i + 1), onclick: () => lightbox(shots, i) },
        h('img', { src, alt: `${p.title} screenshot ${i + 1}`, loading: 'lazy' }))))) : null,

    p.source === 'itch' && /^\d+$/.test(p.itchId || '') ? sec('Get it', null,
      h('iframe', { class: 'embed', src: `https://itch.io/embed/${p.itchId}`, title: p.title + ' on itch.io', loading: 'lazy' })) : null,

    p.readme ? readmeSection(p) : null,

    sec('Details', null, [
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
      p.url && h('p', { class: 'urlrow' }, 'URL ', h('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.url)),
    ]),

    s ? statsSection(s) : null);

  wipe(root.querySelector('.plate'), { color: 'var(--accent)', delay: 200, dur: 620 });
  wipeOnView(root.querySelectorAll('.tile'), { color: 'var(--accent)', dur: 420 });
  wipeOnView(root.querySelectorAll('.panel'), { color: 'var(--accent)', dur: 620 });
  wipeOnView(root.querySelectorAll('.shot'), { color: 'var(--accent)' });
  return p.title;
}

/** The README, rendered from Markdown. Tall ones are folded behind a button. */
function readmeSection(p) {
  const base = { repo: p.repo, branch: (p.stats && p.stats.branch) || 'main' };
  const wrap = h('div', { class: 'md-wrap', id: 'readme-' + p.id }, renderMarkdown(p.readme, base));
  const more = h('button', { class: 'btn sm', hidden: true, 'aria-expanded': 'false', 'aria-controls': 'readme-' + p.id }, 'Show full readme');
  more.addEventListener('click', () => {
    const open = wrap.classList.toggle('clamp') === false;
    more.textContent = open ? 'Show less' : 'Show full readme';
    more.setAttribute('aria-expanded', String(open));
    if (!open) wrap.scrollIntoView({ block: 'start' });
  });
  requestAnimationFrame(() => { if (wrap.scrollHeight > 640) { wrap.classList.add('clamp'); more.hidden = false; } });
  return sec('Readme', p.repo ? 'README.md from ' + p.repo : null, [wrap, more]);
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
      h('span', { class: 'cnt' }, fmtNum(c.commits)))))) : null,
    s.weeks.length && total ? panel('Commit activity', `${fmtNum(total)} commits in the last year, per week`, weeklyChart(s.weeks, s.syncedAt), true) : null,
    s.punch.length ? panel('When the work happens', 'Commits by weekday and hour', heatmap(s.punch), true) : null,
    withDl.length ? panel('Downloads per release', 'Release assets downloaded from GitHub', releasesChart(s.releases), true) : null,
  ].filter(Boolean);
  if (!panels.length) return null;
  return sec('Statistics', 'From GitHub, synced ' + fmtDateTime(s.syncedAt), h('div', { class: 'charts' }, panels));
}
