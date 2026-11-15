// Charts for the project page. Chart.js draws bars and the donut; the heatmap is plain DOM.

import { h, fmtNum } from './ui.js';

const live = [];
export function destroyCharts() { while (live.length) live.pop().destroy(); }

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SERIES = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7'];

function make(canvas, config) {
  if (!window.Chart) { canvas.replaceWith(h('p', { class: 'note' }, 'Charts could not be loaded.')); return; }
  const C = window.Chart;
  C.defaults.font.family = css('--f-sans');
  C.defaults.font.size = 11;
  C.defaults.color = css('--muted');
  live.push(new C(canvas, config));
}

const tooltip = () => ({
  backgroundColor: css('--text'), titleColor: css('--bg'), bodyColor: css('--bg'),
  padding: 8, cornerRadius: 8, displayColors: false,
});

function barConfig(labels, values, unit, tickEvery, color) {
  return {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: color || css('--bar'), borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 36, categoryPercentage: 0.82, barPercentage: 0.9 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: (c) => fmtNum(c.parsed.y) + ' ' + unit } } },
      scales: {
        x: { grid: { display: false }, border: { color: css('--muted') }, ticks: { autoSkip: !tickEvery, maxRotation: 0, callback(v, i) { return !tickEvery || i % tickEvery === 0 ? this.getLabelForValue(v) : ''; } } },
        y: { beginAtZero: true, grid: { color: css('--grid') }, border: { display: false }, ticks: { precision: 0, maxTicksLimit: 5 } },
      },
    },
  };
}

/** Commits per week; the last bar is the week of `endIso`. */
export function weeklyChart(weeks, endIso, color) {
  const end = new Date(endIso || Date.now());
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const labels = weeks.map((_, i) => fmt.format(new Date(end.getTime() - (weeks.length - 1 - i) * 7 * 864e5)));
  const canvas = h('canvas', { role: 'img', 'aria-label': 'Bar chart of commits per week over the last year' });
  const box = h('div', { class: 'chart-box' }, canvas);
  queueMicrotask(() => make(canvas, barConfig(labels, weeks, 'commits', 8, color)));
  return box;
}

export function releasesChart(releases, color) {
  const canvas = h('canvas', { role: 'img', 'aria-label': 'Bar chart of downloads per release' });
  const box = h('div', { class: 'chart-box' }, canvas);
  queueMicrotask(() => make(canvas, barConfig(releases.map((r) => r.name), releases.map((r) => r.downloads), 'downloads', 0, color)));
  return box;
}

/** Language share as a donut with a labelled legend (values in text, color is never alone). */
export function languagesChart(languages) {
  let rows = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, r) => s + r[1], 0) || 1;
  if (rows.length > 7) {
    const rest = rows.slice(6).reduce((s, r) => s + r[1], 0);
    rows = [...rows.slice(0, 6), ['Other', rest]];
  }
  const colors = rows.map((r, i) => (r[0] === 'Other' ? css('--c8') : css(SERIES[i])));
  const canvas = h('canvas', { role: 'img', 'aria-label': 'Donut chart of languages' });
  const legend = h('ul', { class: 'legend' }, rows.map((r, i) => h('li', {},
    h('span', { class: 'sw', style: { background: colors[i] } }), r[0],
    h('span', { class: 'pct' }, (r[1] / total * 100).toFixed(1) + '%'))));
  queueMicrotask(() => make(canvas, {
    type: 'doughnut',
    data: { labels: rows.map((r) => r[0]), datasets: [{ data: rows.map((r) => r[1]), backgroundColor: colors, borderColor: css('--surface'), borderWidth: 2, hoverOffset: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '66%', animation: { duration: 400 },
      plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: (c) => (c.parsed / total * 100).toFixed(1) + '% of code' } } },
    },
  }));
  return h('div', { class: 'donut-wrap' }, h('div', { class: 'chart-box' }, canvas), legend);
}

/** Commits by weekday and hour, Monday first. `punch` is [[day(0=Sun), hour, count], ...]. */
export function heatmap(punch) {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const grid = new Map(punch.map(([d, hr, c]) => [d * 24 + hr, c]));
  const max = Math.max(1, ...punch.map((p) => p[2]));
  const el = h('div', { class: 'heat', role: 'img', 'aria-label': 'Heatmap of commits by weekday and hour' });
  el.append(h('span'));
  for (let hr = 0; hr < 24; hr++) el.append(h('span', { class: 'hl' }, hr % 6 === 0 ? String(hr).padStart(2, '0') : ''));
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    el.append(h('span', {}, DAYS[d]));
    for (let hr = 0; hr < 24; hr++) {
      const c = grid.get(d * 24 + hr) || 0;
      el.append(h('span', {
        class: 'cell', style: { '--v': c ? (0.18 + 0.82 * c / max).toFixed(2) : '0' },
        'data-tip': `${DAYS[d]} ${String(hr).padStart(2, '0')}:00 · ${c} commit${c === 1 ? '' : 's'}`,
      }));
    }
  }
  return el;
}
