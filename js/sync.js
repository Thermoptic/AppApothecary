// "Update from GitHub": adds repositories that are not in the list yet and refreshes the
// statistics and readme of the ones that changed. Repositories the owner deleted are skipped.

import { listRepos, fetchStats, fetchReadme, repoFields } from './github.js';
import { slug, uid } from './ui.js';

const DAY = 864e5;

function guessCategory(r, data) {
  const has = (id) => data.categories.some((c) => c.id === id);
  const game = /game/i.test(r.language || '') || (r.topics || []).some((t) => /^(game|gamedev|gamemaker)/.test(t));
  if (game && has('games')) return 'games';
  return has('other') ? 'other' : '';
}

function projectFromRepo(r, stats, readme, data) {
  const f = repoFields(r);
  let id = slug(f.title);
  while (data.projects.some((x) => x.id === id)) id = slug(f.title) + '-' + uid();
  const tags = [...f.tags, ...(r.fork ? ['fork'] : [])];
  tags.forEach((t) => { if (!data.tags.includes(t)) data.tags.push(t); });
  return {
    id, source: 'github', repo: f.repo, url: f.url, title: f.title, category: guessCategory(r, data), tags,
    summary: f.summary.slice(0, 220), description: '', readme, readmeEdited: false, cover: '', screenshots: [],
    created: f.created, updated: f.updated, featured: false, hidden: false, facts: [], itchId: '', stats,
    links: f.homepage && /^https?:/.test(f.homepage) ? [{ label: 'Website', url: f.homepage }] : [],
  };
}

/** Has the repository changed since its statistics were fetched? */
function stale(p, r) {
  const s = p.stats;
  if (!s || !s.syncedAt) return true;
  return s.pushed !== r.pushed_at || s.stars !== r.stargazers_count || s.forks !== r.forks_count
    || s.issues !== r.open_issues_count || Date.now() - Date.parse(s.syncedAt) > 7 * DAY;
}

/**
 * Mutates `data`. Returns { added: [titles], refreshed: [titles], failed: n, limited: bool }.
 * `onProgress(text)` is called with short status messages.
 */
export async function syncFromGitHub(data, { onProgress = () => {}, refresh = true } = {}) {
  const user = data.profile.github;
  if (!user) throw new Error('Add your GitHub username under Settings → Profile first.');
  onProgress('Reading your repositories…');
  const repos = await listRepos(user);
  const ignored = new Set((data.settings.ignored || []).map((s) => s.toLowerCase()));
  const known = new Map(data.projects.filter((p) => p.repo).map((p) => [p.repo.toLowerCase(), p]));
  const out = { added: [], refreshed: [], failed: 0, limited: false };

  const todo = [];
  for (const r of repos) {
    const key = r.full_name.toLowerCase();
    if (known.has(key)) { if (refresh && stale(known.get(key), r)) todo.push({ r, p: known.get(key) }); }
    else if (!ignored.has(key) && !r.archived) todo.push({ r, p: null });
  }

  for (const { r, p } of todo) {
    onProgress(`${p ? 'Updating' : 'Adding'} ${r.name}…`);
    try {
      const stats = await fetchStats(r.full_name, r);
      if (p) {
        const changed = !p.stats || p.stats.pushed !== stats.pushed;
        p.stats = stats;
        if (stats.pushed) p.updated = stats.pushed.slice(0, 10);
        if (changed && !p.readmeEdited) p.readme = (await fetchReadme(r.full_name)) || p.readme;
        out.refreshed.push(p.title);
      } else {
        const project = projectFromRepo(r, stats, await fetchReadme(r.full_name), data);
        data.projects.push(project);
        out.added.push(project.title);
      }
    } catch (e) {
      out.failed++;
      if (/rate limit/i.test(e.message)) { out.limited = true; break; }
    }
  }
  return out;
}
