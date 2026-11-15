// Small DOM helpers, icons, dialogs, toasts and formatters shared by all views.

import { wipe } from './fx.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val); }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, kids);
  if (value !== undefined) el.value = value;
  return el;
}

/** Replace an element's children; arrays are flattened and null/false skipped. */
export function set(el, ...kids) { el.replaceChildren(); append(el, kids); }

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.500 20.2l1-6.200L3 9.600l6.200-.9z"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.500 6.500l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.500-4.500L4 8M4 4v4h4M4 13a8 8 0 0 0 14.500 4.500L20 16M20 20v-4h-4"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
  play: '<path d="M7 4.500v15l12-7.500z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  pin: '<path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z"/>',
};

export function icon(name, size = 18) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}

// ---------- formatting ----------
const dFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dtFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const valid = (d) => d instanceof Date && !isNaN(d);
export const fmtDate = (s) => { const d = new Date(s); return s && valid(d) ? dFmt.format(d) : ''; };
export const fmtDateTime = (s) => { const d = new Date(s); return s && valid(d) ? dtFmt.format(d) : ''; };
export const fmtNum = (n) => n == null ? '–' : n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : n.toLocaleString('en-US');
export function fmtSize(kb) {
  if (kb == null) return '–';
  if (kb < 1024) return kb + ' KB';
  if (kb < 1024 * 1024) return (kb / 1024).toFixed(1) + ' MB';
  return (kb / 1024 / 1024).toFixed(2) + ' GB';
}
export const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 40) || 'item';
export const uid = () => Math.random().toString(36).slice(2, 8);

// Plain text -> paragraphs with clickable links (no HTML is ever interpreted).
export function prose(text) {
  const box = h('div', { class: 'prose' });
  for (const para of String(text || '').split(/\n\s*\n/)) {
    if (!para.trim()) continue;
    const p = h('p');
    para.split(/(https?:\/\/[^\s]+)/g).forEach((part, i) => {
      if (i % 2) p.append(h('a', { href: part, target: '_blank', rel: 'noopener', style: { color: 'var(--accent)' } }, part));
      else part.split('\n').forEach((line, j) => { if (j) p.append(h('br')); p.append(line); });
    });
    box.append(p);
  }
  return box;
}

// ---------- theme ----------
export function effectiveTheme() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
export function getThemePref() { return document.documentElement.dataset.theme || 'system'; }
export function setTheme(v) {
  if (v === 'system') { delete document.documentElement.dataset.theme; try { localStorage.removeItem('ma_theme'); } catch {} }
  else { document.documentElement.dataset.theme = v; try { localStorage.setItem('ma_theme', v); } catch {} }
  window.dispatchEvent(new Event('themechange'));
}

// ---------- toasts ----------
export function toast(msg, isErr = false) {
  const t = h('div', { class: 'toast' + (isErr ? ' err' : ''), role: isErr ? 'alert' : 'status' }, msg);
  document.getElementById('toasts').append(t);
  wipe(t, { color: 'var(--accent)', dur: 380 });
  setTimeout(() => t.remove(), isErr ? 7000 : 3500);
}

// ---------- dialogs ----------
export function modal({ title, body, foot, wide, onClose }) {
  const d = h('dialog', { class: 'modal' + (wide ? ' wide' : '') },
    h('div', { class: 'modal-head' },
      h('h2', {}, title),
      h('button', { class: 'btn ghost sm icon', 'aria-label': 'Close', onclick: () => d.close() }, icon('x'))),
    h('div', { class: 'modal-body' }, body),
    foot && h('div', { class: 'modal-foot' }, foot));
  d.addEventListener('close', () => { d.remove(); onClose && onClose(); });
  document.body.append(d);
  d.showModal();
  wipe(d, { color: 'var(--accent)', dur: 420 });
  return d;
}

export function confirmDialog(message, okLabel = 'Delete', danger = true) {
  return new Promise((resolve) => {
    let ok = false;
    const d = modal({
      title: 'Are you sure?',
      body: h('p', {}, message),
      foot: [
        h('button', { class: 'btn', onclick: () => d.close() }, 'Cancel'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { ok = true; d.close(); } }, okLabel),
      ],
      onClose: () => resolve(ok),
    });
  });
}

export function lightbox(srcs, start = 0) {
  let i = start;
  const img = h('img', { src: srcs[i], alt: 'Screenshot ' + (i + 1) });
  const go = (n) => { i = (i + n + srcs.length) % srcs.length; img.src = srcs[i]; img.alt = 'Screenshot ' + (i + 1); };
  const d = h('dialog', { class: 'lightbox' },
    h('div', { class: 'lb-box', onclick: (e) => { if (e.target === e.currentTarget) d.close(); } },
      img,
      h('button', { class: 'btn icon', 'aria-label': 'Close', onclick: () => d.close() }, icon('x')),
      srcs.length > 1 && h('button', { class: 'btn icon nav prev', 'aria-label': 'Previous', onclick: () => go(-1) }, icon('back')),
      srcs.length > 1 && h('button', { class: 'btn icon nav next', 'aria-label': 'Next', onclick: () => go(1) }, icon('next'))));
  d.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  let x0 = null;
  d.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  d.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); x0 = null; });
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
}

// ---------- hover tooltip for elements with data-tip ----------
let tipEl;
function showTip(target, x, y) {
  if (!tipEl) { tipEl = h('div', { class: 'tip', role: 'tooltip' }); document.body.append(tipEl); }
  tipEl.textContent = target.dataset.tip;
  tipEl.classList.add('on');
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = Math.max(6, Math.min(innerWidth - r.width - 6, x - r.width / 2)) + 'px';
  tipEl.style.top = Math.max(6, y - r.height - 12) + 'px';
}
document.addEventListener('pointermove', (e) => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (t) showTip(t, e.clientX, e.clientY); else if (tipEl) tipEl.classList.remove('on');
});
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (t) showTip(t, e.clientX, e.clientY); else if (tipEl) tipEl.classList.remove('on');
});

// ---------- shared project bits ----------
const NEUTRAL = '#c9c9c3';
/** Relative luminance (0..1) of a #rrggbb color. */
export function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 0.6;
  const [r, g, b] = [0, 2, 4].map((i) => { const v = parseInt(m[1].slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const PALETTE = ['#ff4f1a', '#6f93ff', '#2fc98a', '#f0bf00', '#b9a7ff', '#f5a3d7', '#3fbfff', '#ff8f70'];
function hue(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  if (!d) return 0;
  const k = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (k * 60 + 360) % 360;
}
/** The palette color furthest around the hue wheel from `hex`: blue gets yellow, orange gets sky blue. */
export function partner(hex) {
  const h0 = hue(hex);
  let best = PALETTE[0], bestGap = 1e9;
  for (const p of PALETTE) {
    const dist = Math.abs(((hue(p) - h0 + 540) % 360) - 180); // 180 = directly opposite
    if (dist < 30) continue; // too close to the original to read as a change
    if (180 - dist < bestGap) { bestGap = 180 - dist; best = p; }
  }
  return best;
}
/** Module colors for a category: fill, readable ink on it, a color that shows on a black screen, and the hover color. */
export function modColors(cat) {
  const c = cat ? cat.color : NEUTRAL;
  const l = lum(c);
  return { '--c': c, '--t': l > 0.2 ? '#101010' : '#ffffff', '--pc': l < 0.06 ? '#f2f2ee' : c, '--hv': partner(c) };
}
/** The black "screen" of a module: the cover image, or a line pattern in the category color. */
export function screenEl(project, src, label) {
  let hash = 0;
  for (const ch of project.id || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return h('div', { class: 'scr' },
    src ? h('img', { src, alt: '', loading: 'lazy' }) : h('span', { class: 'pt pt' + (hash % 4) }),
    label && h('span', { class: 'lb' }, label),
    project.hidden && h('span', { class: 'lb r' }, 'Hidden'));
}
export const fmtShort = (s) => { const d = new Date(s); return s && !isNaN(d) ? [d.getDate(), d.getMonth() + 1, d.getFullYear() % 100].map((n) => String(n).padStart(2, '0')).join('.') : ''; };
export const SOURCE = { github: 'GitHub', itch: 'itch.io', other: 'Project' };
