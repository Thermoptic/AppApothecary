// The look of the site: a color palette, a terminal font, a base size and the giant smiley behind the text.
// The owner's choice is stored in data.json (settings.look) and is the default for everyone.
// Anyone can try another look for themselves; that is kept in this browser only.

export const PALETTES = [
  { id: 'Lime Sheet', paper: '#EAF3CF', ink: '#0C3D2C', accent: '#C9F76F', edge: '#0C3D2C', on: '#0C3D2C', smile: '#C9F76F' },
  { id: 'Marking Sheet', paper: '#EBEAE5', ink: '#C8271F', accent: '#C8271F', on: '#EBEAE5', smile: '#F7E993' },
  { id: 'Grått och lime', paper: '#DCDDE2', ink: '#111116', accent: '#D5FA4B', on: '#111116', smile: '#E2F987' },
  { id: 'Kräm och orange', paper: '#F2EFE6', ink: '#1B1B1B', accent: '#FF5A1F', on: '#1B1B1B', smile: '#FFD6C0' },
  { id: 'Kobolt', paper: '#E4E7EC', ink: '#1D3BD4', accent: '#1D3BD4', on: '#E4E7EC', smile: '#F8DDB8' },
  { id: 'Natt och lime', paper: '#0D0F0C', ink: '#C8F26A', accent: '#C8F26A', on: '#0D0F0C', smile: '#2B381F' },
  { id: 'Mörkt rött', paper: '#171513', ink: '#FF6254', accent: '#FF6254', on: '#171513', smile: '#3E2823' },
];
export const FONTS = [
  { id: 'DM Mono', note: 'Lugn och jämn', q: 'DM+Mono:wght@400;500' },
  { id: 'JetBrains Mono', note: 'Tydlig och modern, gjord för kod', q: 'JetBrains+Mono:wght@400;500;700;800' },
  { id: 'IBM Plex Mono', note: 'Lite varmare, med seriffer', q: 'IBM+Plex+Mono:wght@400;500' },
  { id: 'Space Mono', note: 'Geometrisk och lekfull', q: 'Space+Mono:wght@400;700' },
  { id: 'VT323', note: 'Pixelfont som en gammal skärm (höj storleken)', q: 'VT323' },
];
export const DEFAULT_LOOK = { palette: 'Lime Sheet', font: 'JetBrains Mono', size: 15.5, smile: { on: true, x: 84, y: 46, size: 92 } };
export const BASE_SIZE = 13; // the size the stylesheet was drawn for; --k scales every text size from it

const LS = 'ma_look';

// ---------- color math ----------
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** t = 0 gives a, t = 1 gives b. */
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v * (1 - t) + y[i] * t)); };
export const lum = (h) => { const c = rgb(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgba = (h, a) => `rgba(${rgb(h).join(', ')}, ${a})`;
export const paletteOf = (id) => PALETTES.find((p) => p.id === id) || PALETTES.find((p) => p.id === DEFAULT_LOOK.palette);
export const isDarkPalette = (p) => lum(p.paper) < 0.2;

function tokens(p) {
  const dark = isDarkPalette(p);
  const tint = (t) => mix(p.ink, p.paper, t);
  return {
    '--bg': p.paper,
    '--surface': mix(p.paper, '#ffffff', dark ? 0.05 : 0.5),
    '--surface-2': mix(p.paper, p.ink, 0.12),
    '--text': p.ink, '--muted': tint(0.24), '--rule': rgba(p.ink, 0.42), '--grid': rgba(p.ink, 0.12),
    '--gl': rgba(p.ink, dark ? 0.055 : 0.07),
    '--accent': p.accent, '--edge': p.edge || p.accent, '--on-accent': p.on, '--bar': p.ink, '--dot': mix(p.paper, p.ink, 0.18), '--smile': p.smile,
    '--danger': dark ? '#FF8A7E' : '#A32D2D',
    '--c1': p.ink, '--c2': tint(0.4), '--c3': tint(0.65), '--c4': mix(p.ink, dark ? '#ffffff' : '#000000', 0.35),
    '--c5': tint(0.82), '--c6': p.accent !== p.ink ? p.accent : tint(0.25), '--c7': tint(0.5), '--c8': tint(0.9),
  };
}

// ---------- reading and writing the look ----------
const clone = (o) => JSON.parse(JSON.stringify(o));
function merge(...parts) {
  const out = clone(DEFAULT_LOOK);
  for (const p of parts) {
    if (!p || typeof p !== 'object') continue;
    if (typeof p.palette === 'string') out.palette = p.palette;
    if (typeof p.font === 'string') out.font = p.font;
    if (typeof p.size === 'number' && p.size >= 8 && p.size <= 28) out.size = p.size;
    if (p.smile && typeof p.smile === 'object') {
      for (const k of ['x', 'y', 'size']) if (typeof p.smile[k] === 'number') out.smile[k] = p.smile[k];
      if (typeof p.smile.on === 'boolean') out.smile.on = p.smile.on;
    }
  }
  if (!PALETTES.some((x) => x.id === out.palette)) out.palette = DEFAULT_LOOK.palette;
  if (!FONTS.some((x) => x.id === out.font)) out.font = DEFAULT_LOOK.font;
  return out;
}
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
let siteData = null;
export const siteLook = () => merge(siteData && siteData.settings && siteData.settings.look);
export const hasLocal = () => !!readLocal();
export const currentLook = () => merge(siteData && siteData.settings && siteData.settings.look, readLocal());
export const setSiteData = (d) => { siteData = d; };

export function loadFont(id) {
  const f = FONTS.find((x) => x.id === id);
  if (!f || document.querySelector(`link[data-font="${f.id}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.dataset.font = f.id; l.href = `https://fonts.googleapis.com/css2?family=${f.q}&display=swap`;
  document.head.append(l);
}

/** Paint a look onto the page: color tokens, font, text scale and the smiley. */
export function applyLook(look = currentLook()) {
  const p = paletteOf(look.palette), root = document.documentElement;
  for (const [k, v] of Object.entries(tokens(p))) root.style.setProperty(k, v);
  const stack = `"${look.font}", ui-monospace, "Cascadia Mono", Consolas, monospace`;
  root.style.setProperty('--f-sans', stack); root.style.setProperty('--f-head', stack);
  root.style.setProperty('--k', String(look.size / BASE_SIZE));
  root.style.colorScheme = isDarkPalette(p) ? 'dark' : 'light';
  loadFont(look.font);
  const sm = document.getElementById('smile');
  if (sm) { sm.hidden = !look.smile.on; sm.style.left = look.smile.x + 'vw'; sm.style.top = look.smile.y + 'vh'; sm.style.width = look.smile.size + 'vw'; }
}

/** Remember a change for this browser only, and show it. */
export function setLocal(patch, silent = false) {
  const cur = readLocal() || {};
  const next = { ...cur, ...patch, smile: { ...(cur.smile || {}), ...(patch.smile || {}) } };
  try { localStorage.setItem(LS, JSON.stringify(next)); } catch { /* storage blocked: the change still shows until reload */ }
  applyLook(merge(siteData && siteData.settings && siteData.settings.look, next));
  if (!silent) window.dispatchEvent(new Event('ma-look'));
}
export function clearLocal() {
  try { localStorage.removeItem(LS); } catch { /* ignore */ }
  applyLook(); window.dispatchEvent(new Event('ma-look'));
}

// ---------- the header's light/dark button ----------
const DARK_FALLBACK = 'Natt och lime';
export const isDark = () => isDarkPalette(paletteOf(currentLook().palette));
/** Flip between the chosen palette and a dark one, remembering where you came from. */
export function toggleDark() {
  const cur = currentLook();
  if (isDarkPalette(paletteOf(cur.palette))) {
    let back = null; try { back = localStorage.getItem('ma_light_palette'); } catch { /* ignore */ }
    const target = paletteOf(back && !isDarkPalette(paletteOf(back)) ? back : siteLook().palette);
    setLocal({ palette: isDarkPalette(target) ? 'Marking Sheet' : target.id });
  } else {
    try { localStorage.setItem('ma_light_palette', cur.palette); } catch { /* ignore */ }
    setLocal({ palette: DARK_FALLBACK });
  }
}
