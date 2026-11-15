// Sweep animations with a 1-bit ordered-dither edge.
// A "shutter" covers an element in one flat color and slides off to the right in chunky steps;
// its trailing edge is a Bayer-dithered gradient, so the reveal is pure on/off pixels, never a soft fade.

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];

/** A 128x32 strip of 4px cells going from solid to empty (or the reverse), dithered 1-bit. */
function strip(solidOnRight) {
  const cell = 4, cols = 32, rows = 8;
  const c = document.createElement('canvas');
  c.width = cols * cell; c.height = rows * cell;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  for (let x = 0; x < cols; x++) {
    const density = solidOnRight ? x / (cols - 1) : 1 - x / (cols - 1);
    for (let y = 0; y < rows; y++) {
      if (density > (BAYER[y][x % 8] + 0.5) / 64) g.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  return `url(${c.toDataURL('image/png')})`;
}

export function initFx() {
  try {
    const s = document.documentElement.style;
    s.setProperty('--dith', strip(false));   // solid -> empty
    s.setProperty('--dithR', strip(true));   // empty -> solid
  } catch { /* no canvas: sweeps fall back to a hard edge */ }
}

function el(tag, cls) { const e = document.createElement(tag); e.className = cls; return e; }

function shutter(cls, color, delay, dur, edgeFirst) {
  const s = el('span', 'fx-shut ' + cls);
  s.setAttribute('aria-hidden', 'true');
  s.style.color = color;
  s.style.setProperty('--d', delay + 'ms');
  s.style.setProperty('--dur', dur + 'ms');
  const blade = el('span', 'fx-blade');
  const edge = el('i', 'fx-edge'), solid = el('i', 'fx-solid');
  blade.append(...(edgeFirst ? [edge, solid] : [solid, edge]));
  s.append(blade);
  return { s, blade };
}

/** Cover `target` in `color`, then sweep the cover off to the right. */
export function wipe(target, { color = 'currentColor', delay = 0, dur = 520 } = {}) {
  if (!target || still()) return;
  if (getComputedStyle(target).position === 'static') target.classList.add('fx-host');
  const { s, blade } = shutter('', color, delay, dur, true);
  const done = () => s.remove();
  blade.addEventListener('animationend', done);
  setTimeout(done, delay + dur + 400);
  target.append(s);
}

/** Wipe each element the first time it scrolls into view, staggered when several arrive together. */
export function wipeOnView(targets, opts = {}) {
  targets = [...targets].filter(Boolean);
  if (!targets.length || still() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    let i = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      wipe(e.target, { ...opts, delay: (opts.delay || 0) + Math.min(i++, 8) * 70 });
    }
  }, { threshold: 0.12 });
  targets.forEach((t) => io.observe(t));
}

/** Full-window sweep that uncovers a freshly drawn page. */
export function pageSweep() {
  if (still()) return;
  const { s, blade } = shutter('page big', 'var(--lcd-bg)', 0, 560, true);
  const done = () => s.remove();
  blade.addEventListener('animationend', done);
  setTimeout(done, 1100);
  document.body.append(s);
}

/** Sweep a cover across the whole window, run `change` behind it, then sweep it away. */
export function coverSweep(change) {
  if (still()) return change();
  const { s, blade } = shutter('page big cover', 'var(--lcd-bg)', 0, 420, false);
  let ran = false;
  const go = () => { if (ran) return; ran = true; change(); s.remove(); pageSweep(); };
  blade.addEventListener('animationend', go);
  setTimeout(go, 800);
  document.body.append(s);
}
