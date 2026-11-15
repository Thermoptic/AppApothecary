// Thin GitHub REST client: file commits for saving, and repository statistics.

const API = 'https://api.github.com';
export const getToken = () => { try { return localStorage.getItem('ma_token') || ''; } catch { return ''; } };

export async function gh(path, opts = {}) {
  const token = opts.anon ? '' : getToken();
  const headers = { Accept: opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const method = opts.method || 'GET';
  const res = await fetch(API + path, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' });
  // A token limited to one repo can be refused for other public repos: retry reads anonymously.
  if (!res.ok && token && method === 'GET' && !opts.strict && [401, 403, 404].includes(res.status)) {
    return gh(path, { ...opts, anon: true });
  }
  let json = null;
  if (res.status !== 204) { try { json = opts.raw && res.ok ? await res.text() : await res.json(); } catch { json = null; } }
  if (!res.ok && !opts.soft) {
    const err = new Error(friendly(res, json));
    err.status = res.status;
    throw err;
  }
  return { res, json };
}

function friendly(res, json) {
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') return 'GitHub rate limit reached. Try again later, or sign in with a token for a higher limit.';
  if (res.status === 401) return 'GitHub rejected the token. Check that it is valid and not expired.';
  if (res.status === 404) return 'Not found on GitHub (or the token has no access).';
  if (res.status === 409) return 'The data was changed somewhere else. Reload the page and try again.';
  return (json && json.message) || 'GitHub request failed (' + res.status + ')';
}

// ---------- base64 helpers (UTF-8 safe) ----------
export function toB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function fromB64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// ---------- repository files ----------
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

export async function getFile(repo, path) {
  const url = `/repos/${repo.owner}/${repo.repo}/contents/${enc(path)}?ref=${encodeURIComponent(repo.branch)}`;
  const { json } = await gh(url, { strict: true });
  if (json.content) return { text: fromB64(json.content), sha: json.sha };
  // Files over 1 MB come back without inline content.
  const blob = await gh(`/repos/${repo.owner}/${repo.repo}/git/blobs/${json.sha}`, { strict: true });
  return { text: fromB64(blob.json.content), sha: json.sha };
}

export async function putFile(repo, path, contentB64, sha, message) {
  const body = { message, content: contentB64, branch: repo.branch };
  if (sha) body.sha = sha;
  const { json } = await gh(`/repos/${repo.owner}/${repo.repo}/contents/${enc(path)}`, { method: 'PUT', body });
  return json;
}

export async function checkAccess(repo) {
  const { json } = await gh(`/repos/${repo.owner}/${repo.repo}`, { strict: true });
  return !!(json.permissions && json.permissions.push);
}

// ---------- repositories and statistics ----------
export function parseRepo(input) {
  const m = String(input || '').trim().replace(/\.git$/, '').match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)\/?$/);
  return m ? m[1] + '/' + m[2] : '';
}

export async function listRepos(user) {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const { json } = await gh(`/users/${encodeURIComponent(user)}/repos?per_page=100&type=owner&sort=pushed&page=${page}`);
    all.push(...json);
    if (json.length < 100) break;
  }
  return all;
}

export const getRepoInfo = async (full) => (await gh('/repos/' + full)).json;

// The /stats endpoints answer 202 while GitHub computes them; poll a few times.
async function stat(path) {
  for (let i = 0; i < 4; i++) {
    const { res, json } = await gh(path, { soft: true });
    if (res.status === 200) return json;
    if (res.status !== 202) return null;
    await new Promise((r) => setTimeout(r, 1800));
  }
  return null;
}

async function commitCount(full) {
  const { res, json } = await gh(`/repos/${full}/commits?per_page=1`, { soft: true });
  if (!res.ok) return 0;
  const m = (res.headers.get('link') || '').match(/[?&]page=(\d+)>;\s*rel="last"/);
  return m ? +m[1] : (Array.isArray(json) ? json.length : 0);
}

export async function fetchStats(full, info) {
  const soft = async (p) => { const r = await gh(p, { soft: true }); return r.res.ok ? r.json : null; };
  const [repo, languages, weeks, punch, contributors, releases, commits] = await Promise.all([
    info || getRepoInfo(full),
    soft(`/repos/${full}/languages`),
    stat(`/repos/${full}/stats/commit_activity`),
    stat(`/repos/${full}/stats/punch_card`),
    soft(`/repos/${full}/contributors?per_page=8`),
    soft(`/repos/${full}/releases?per_page=30`),
    commitCount(full),
  ]);
  return {
    stars: repo.stargazers_count, forks: repo.forks_count, watchers: repo.subscribers_count ?? repo.watchers_count,
    issues: repo.open_issues_count, size: repo.size,
    license: repo.license ? (repo.license.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : repo.license.name) : '',
    branch: repo.default_branch, language: repo.language || '',
    created: repo.created_at, pushed: repo.pushed_at, commits,
    languages: languages || {},
    weeks: Array.isArray(weeks) ? weeks.map((w) => w.total) : [],
    punch: Array.isArray(punch) ? punch.filter((p) => p[2] > 0) : [],
    releases: Array.isArray(releases) ? releases.filter((r) => !r.draft).map((r) => ({
      name: r.tag_name || r.name, date: (r.published_at || '').slice(0, 10),
      downloads: (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0),
    })).reverse().slice(-12) : [],
    contributors: Array.isArray(contributors) ? contributors.map((c) => ({ login: c.login, commits: c.contributions, avatar: c.avatar_url, url: c.html_url })) : [],
    syncedAt: new Date().toISOString(),
  };
}

/** The repository's README as Markdown text ('' if it has none). Long ones are cut at a paragraph. */
export async function fetchReadme(full, cap = 30000) {
  const { res, json } = await gh(`/repos/${full}/readme`, { soft: true, raw: true });
  if (!res.ok || typeof json !== 'string') return '';
  let text = json.replace(/\r\n?/g, '\n').replace(/^﻿/, '').trim();
  if (text.length > cap) {
    let cut = text.lastIndexOf('\n\n', cap);
    if (cut < cap / 2) cut = cap;
    text = text.slice(0, cut).trimEnd() + '\n\n*The rest of this readme is on GitHub.*';
  }
  return text;
}

// Fields a project takes from its repository (used by import and by the editor's fetch button).
export function repoFields(repo) {
  return {
    title: repo.name, repo: repo.full_name, url: repo.html_url, summary: repo.description || '',
    created: (repo.created_at || '').slice(0, 10), updated: (repo.pushed_at || '').slice(0, 10),
    tags: (repo.topics || []).slice(0, 6), homepage: repo.homepage || '',
  };
}
