// Data loading, editing state and publishing.
// Modes: 'view' (visitors, read-only), 'local' (localhost, edits kept as a browser draft),
// 'remote' (token + repo configured, edits are committed to the GitHub repository).

import { getToken, getFile, putFile, toB64 } from './github.js';
import { uid } from './ui.js';

const DATA_PATH = 'data/data.json';
export const state = { data: null, sha: null, dirty: false, images: {} };
export const isLocal = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { localStorage.setItem(k, v); },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

export function getRepo() {
  let saved = {};
  try { saved = JSON.parse(ls.get('ma_repo') || '{}'); } catch {}
  let owner = '', repo = '';
  if (location.hostname.endsWith('.github.io')) {
    owner = location.hostname.split('.')[0];
    repo = location.pathname.split('/').filter(Boolean)[0] || location.hostname;
  }
  return { owner: saved.owner || owner, repo: saved.repo || repo, branch: saved.branch || 'main' };
}
export function setAccess({ owner, repo, branch, token }) {
  ls.set('ma_repo', JSON.stringify({ owner, repo, branch: branch || 'main' }));
  if (token) ls.set('ma_token', token);
}
export function signOut() { ls.del('ma_token'); }

export function mode() {
  const r = getRepo();
  if (getToken() && r.owner && r.repo) return 'remote';
  return isLocal ? 'local' : 'view';
}
export const isAdmin = () => mode() !== 'view';

// ---------- change notifications ----------
const subs = new Set();
export const onChange = (fn) => subs.add(fn);
const emit = (rerender) => subs.forEach((fn) => fn({ rerender }));

/** Call after mutating state.data. */
export function touch(rerender = true) {
  if (mode() === 'local') {
    try { ls.set('ma_draft', JSON.stringify(state.data)); }
    catch { emit(rerender); throw new Error('The browser draft is full (images are large). Export a backup or publish to GitHub.'); }
  } else {
    state.dirty = true;
  }
  emit(rerender);
}

// ---------- load ----------
function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  d.version = 1;
  d.profile = { title: 'My Projects', headline: 'Things I have made.', tagline: '', github: '', itch: '', ...(d.profile || {}) };
  d.settings = { sort: 'updated', ...(d.settings || {}) };
  d.categories = Array.isArray(d.categories) ? d.categories : [];
  d.tags = Array.isArray(d.tags) ? d.tags : [];
  d.projects = (Array.isArray(d.projects) ? d.projects : []).map((p) => ({
    id: uid(), title: 'Untitled', source: 'other', repo: '', url: '', category: '', tags: [], summary: '', description: '',
    cover: '', screenshots: [], created: '', updated: '', featured: false, hidden: false, facts: [], links: [], itchId: '', stats: null, ...p,
  }));
  return d;
}

export async function load() {
  state.dirty = false;
  const m = mode();
  if (m === 'remote') {
    try {
      const f = await getFile(getRepo(), DATA_PATH);
      state.data = normalize(JSON.parse(f.text));
      state.sha = f.sha;
      return;
    } catch (e) {
      if (e.status !== 404) console.warn('Could not read data through the API, using the published file.', e);
    }
  }
  if (m === 'local' && ls.get('ma_draft')) {
    try { state.data = normalize(JSON.parse(ls.get('ma_draft'))); return; } catch {}
  }
  const res = await fetch(DATA_PATH, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Could not load ' + DATA_PATH);
  state.data = normalize(await res.json());
}

export function hasDraft() { return !!ls.get('ma_draft'); }
export function discardDraft() { ls.del('ma_draft'); }
export function replaceData(d) { state.data = normalize(d); touch(); }

// ---------- publish ----------
const isDataUrl = (s) => typeof s === 'string' && s.startsWith('data:');

async function upload(dataUrl, id) {
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) throw new Error('Unsupported image format.');
  const path = `assets/shots/${id}-${Date.now().toString(36)}${uid()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  await putFile(getRepo(), path, m[2], null, 'Add image for ' + id);
  state.images[path] = dataUrl; // show it right away, before Pages has redeployed
  return path;
}

export async function publish(message = 'Update projects') {
  const repo = getRepo();
  for (const p of state.data.projects) {
    if (isDataUrl(p.cover)) p.cover = await upload(p.cover, p.id);
    for (let i = 0; i < p.screenshots.length; i++) {
      if (isDataUrl(p.screenshots[i])) p.screenshots[i] = await upload(p.screenshots[i], p.id);
    }
  }
  if (!state.sha) {
    try { state.sha = (await getFile(repo, DATA_PATH)).sha; } catch (e) { if (e.status !== 404) throw e; }
  }
  const out = await putFile(repo, DATA_PATH, toB64(JSON.stringify(state.data, null, 2) + '\n'), state.sha, message);
  state.sha = out.content.sha;
  state.dirty = false;
  emit(false);
}

// ---------- selectors ----------
export const imgSrc = (path) => (path ? state.images[path] || path : '');
export const catOf = (p) => state.data.categories.find((c) => c.id === p.category) || null;
export const visibleProjects = () => state.data.projects.filter((p) => isAdmin() || !p.hidden);
export function tagCounts() {
  const m = new Map(state.data.tags.map((t) => [t, 0]));
  for (const p of state.data.projects) for (const t of p.tags) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
