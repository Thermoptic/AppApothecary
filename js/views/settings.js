// Settings: appearance and owner sign-in for everyone; profile, categories, tags,
// sorting, GitHub import and backup for the owner.

import { h, set, icon, modal, confirmDialog, toast, slug, uid, getThemePref, setTheme } from '../ui.js';
import { state, mode, isAdmin, isLocal, getRepo, setAccess, signOut, touch, load, tagCounts, hasDraft, discardDraft, replaceData } from '../store.js';
import { getToken, checkAccess, listRepos, fetchStats, fetchReadme, repoFields } from '../github.js';
import { SORTS } from './home.js';

const field = (label, input, hint) => h('label', { class: 'field' }, label, input, hint && h('span', { class: 'hint' }, hint));
const section = (title, sub, ...body) => h('section', { class: 'card-plain' }, h('div', {}, h('h2', {}, title), sub && h('p', { class: 'muted small', style: { 'margin-top': '4px' } }, sub)), body);
const safe = (fn) => { try { fn(); } catch (e) { toast(e.message, true); } };
const reload = () => window.dispatchEvent(new Event('ma-reload'));

export function renderSettings(root) {
  set(root, 
    h('h1', { class: 'page-title' }, 'Settings'),
    h('div', { class: 'settings' },
      appearance(), access(),
      isAdmin() ? [profile(), categories(), tags(), display(), github(), backup()] : null));
  return 'Settings';
}

function appearance() {
  return section('Appearance', 'Saved in this browser only.',
    field('Theme', h('select', { value: getThemePref(), onchange: (e) => setTheme(e.target.value) },
      h('option', { value: 'system' }, 'Follow system'), h('option', { value: 'light' }, 'Light'), h('option', { value: 'dark' }, 'Dark'))));
}

function access() {
  const m = mode();
  const r = getRepo();
  const owner = h('input', { value: r.owner, placeholder: 'your-username', autocapitalize: 'off', spellcheck: 'false' });
  const repo = h('input', { value: r.repo, placeholder: 'repository-name', autocapitalize: 'off', spellcheck: 'false' });
  const branch = h('input', { value: r.branch, autocapitalize: 'off', spellcheck: 'false' });
  const token = h('input', { type: 'password', placeholder: getToken() ? 'Token saved. Paste a new one to replace it' : 'github_pat_…', autocomplete: 'off' });
  const status = {
    remote: `Signed in. Changes are committed to ${r.owner}/${r.repo} (${r.branch}).`,
    local: 'Local preview. Edits are kept as a draft in this browser and are not published. Sign in below to publish to GitHub.',
    view: 'Read-only. If this is your site, sign in to edit it.',
  }[m];

  async function signIn(btn) {
    const cfg = { owner: owner.value.trim(), repo: repo.value.trim(), branch: branch.value.trim() || 'main', token: token.value.trim() };
    if (!cfg.token && !getToken()) return toast('Paste your GitHub token first.', true);
    btn.disabled = true;
    const before = { repo: getRepo(), token: getToken() };
    try {
      setAccess(cfg);
      if (cfg.owner && cfg.repo) {
        if (!(await checkAccess(getRepo()))) throw new Error('The token can read this repository but not write to it. Give it "Contents: Read and write".');
        toast('Signed in. You can now edit and publish.');
      } else toast('Token saved for GitHub lookups. Add owner and repository to publish.');
      reload();
    } catch (e) {
      setAccess({ ...before.repo, token: '' });
      if (before.token) setAccess({ ...before.repo, token: before.token }); else signOut();
      toast(e.message, true); btn.disabled = false;
    }
  }

  return section('Owner access', status,
    h('div', { class: 'grid2' }, field('GitHub owner', owner), field('Repository', repo)),
    h('div', { class: 'grid2' }, field('Branch', branch), field('Access token', token, 'Stored only in this browser.')),
    h('details', { class: 'small muted' }, h('summary', { style: { cursor: 'pointer' } }, 'How do I get a token?'),
      h('ol', { style: { 'padding-left': '20px', 'line-height': 1.7 } },
        h('li', {}, 'Open ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener', style: { 'text-decoration': 'underline' } }, 'GitHub → Fine-grained tokens'), '.'),
        h('li', {}, 'Repository access: "Only select repositories", then pick this site\'s repository.'),
        h('li', {}, 'Permissions → Repository → Contents: "Read and write".'),
        h('li', {}, 'Generate, copy the token and paste it here. Never share it or commit it.'))),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn primary', onclick: (e) => signIn(e.currentTarget) }, getToken() ? 'Update access' : 'Sign in'),
      getToken() && h('button', { class: 'btn', onclick: () => { signOut(); toast('Signed out on this device.'); reload(); } }, 'Sign out')));
}

function profile() {
  const p = state.data.profile;
  const bind = (key, attrs = {}) => h(attrs.area ? 'textarea' : 'input', { ...attrs, area: null, value: p[key] || '', onchange: (e) => { p[key] = e.target.value.trim(); safe(() => touch(false)); } });
  return section('Profile', 'Shown at the top of the start page.',
    field('Site title', bind('title', { maxlength: 60 })),
    field('Headline', bind('headline', { maxlength: 60, placeholder: 'Things I have made.' })),
    field('Intro text', bind('tagline', { area: true, maxlength: 300 })),
    h('div', { class: 'grid2' },
      field('GitHub username', bind('github', { autocapitalize: 'off', spellcheck: 'false' })),
      field('itch.io page', bind('itch', { type: 'url', placeholder: 'https://you.itch.io' }))));
}

function categories() {
  const d = state.data;
  const count = (id) => d.projects.filter((p) => p.category === id).length;
  const rows = d.categories.map((c, i) => h('div', { class: 'list-row' },
    h('input', { type: 'color', value: c.color, 'aria-label': 'Color for ' + c.name, onchange: (e) => { c.color = e.target.value; safe(() => touch(false)); } }),
    h('input', { value: c.name, 'aria-label': 'Category name', maxlength: 30, onchange: (e) => { c.name = e.target.value.trim() || c.name; safe(() => touch(false)); } }),
    h('span', { class: 'count' }, count(c.id) + ' used'),
    h('button', { class: 'btn ghost sm icon', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { d.categories.splice(i - 1, 0, d.categories.splice(i, 1)[0]); safe(touch); } }, '↑'),
    h('button', { class: 'btn ghost sm icon danger', 'aria-label': 'Delete ' + c.name, onclick: async () => {
      const n = count(c.id);
      if (n && !(await confirmDialog(`Delete "${c.name}"? ${n} project${n === 1 ? '' : 's'} will have no category.`))) return;
      d.projects.forEach((p) => { if (p.category === c.id) p.category = ''; });
      d.categories.splice(i, 1); safe(touch);
    } }, icon('trash', 16))));
  const PALETTE = ['#D5FA4B', '#4A4C57', '#70C10A', '#A5A6AA', '#F2F2F5', '#111116'];
  return section('Categories', 'Each category has its own color on cards and filters.',
    h('div', { class: 'list' }, rows.length ? rows : h('p', { class: 'muted small' }, 'No categories yet.')),
    h('div', {}, h('button', { class: 'btn', onclick: () => {
      d.categories.push({ id: 'cat-' + uid(), name: 'New category', color: PALETTE[d.categories.length % PALETTE.length] }); safe(touch);
    } }, icon('plus', 16), 'Add category')));
}

function tags() {
  const d = state.data;
  const rename = (from, to) => {
    to = to.trim().toLowerCase().replace(/^#/, '');
    if (!to || to === from) return;
    d.tags = [...new Set(d.tags.map((t) => (t === from ? to : t)))];
    d.projects.forEach((p) => { p.tags = [...new Set(p.tags.map((t) => (t === from ? to : t)))]; });
    safe(touch);
  };
  const rows = tagCounts().map(([t, n]) => h('div', { class: 'list-row' },
    h('input', { value: t, 'aria-label': 'Tag name', maxlength: 30, onchange: (e) => rename(t, e.target.value) }),
    h('span', { class: 'count' }, n + ' used'),
    h('button', { class: 'btn ghost sm icon danger', 'aria-label': 'Delete tag ' + t, onclick: async () => {
      if (n && !(await confirmDialog(`Remove the tag "${t}" from ${n} project${n === 1 ? '' : 's'}?`))) return;
      d.tags = d.tags.filter((x) => x !== t);
      d.projects.forEach((p) => { p.tags = p.tags.filter((x) => x !== t); });
      safe(touch);
    } }, icon('trash', 16))));
  const add = h('input', { placeholder: 'New tag', maxlength: 30 });
  const addTag = () => { const v = add.value.trim().toLowerCase().replace(/^#/, ''); if (v && !d.tags.includes(v)) { d.tags.push(v); safe(touch); } };
  add.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTag(); });
  return section('Tags', 'Rename a tag to an existing name to merge them.',
    h('div', { class: 'list' }, rows.length ? rows : h('p', { class: 'muted small' }, 'No tags yet.')),
    h('div', { class: 'list-row' }, add, h('button', { class: 'btn', onclick: addTag }, icon('plus', 16), 'Add')));
}

function display() {
  const s = state.data.settings;
  return section('Sorting', 'The order visitors see first. Pinned projects always come first.',
    field('Default sort order', h('select', { value: s.sort, onchange: (e) => { s.sort = e.target.value; safe(() => touch(false)); } },
      Object.entries(SORTS).map(([k, v]) => h('option', { value: k }, v[0])))));
}

function github() {
  const d = state.data;
  const linked = d.projects.filter((p) => p.source === 'github' && p.repo);
  const bar = h('i');
  const progress = h('div', { class: 'progress', hidden: true }, bar);
  const setP = (i, n) => { progress.hidden = false; bar.style.width = (i / n * 100) + '%'; };

  async function syncAll(btn) {
    btn.disabled = true; let failed = 0;
    for (let i = 0; i < linked.length; i++) {
      setP(i, linked.length);
      try { const p = linked[i]; p.stats = await fetchStats(p.repo); p.updated = (p.stats.pushed || p.updated || '').slice(0, 10); p.readme = (await fetchReadme(p.repo)) || p.readme; }
      catch (e) { failed++; if (/rate limit/i.test(e.message)) { toast(e.message, true); break; } }
    }
    safe(touch);
    toast(failed ? `Synced with ${failed} error${failed === 1 ? '' : 's'}.` : 'All statistics are up to date.', !!failed);
  }

  async function openImport(btn) {
    const user = d.profile.github;
    if (!user) return toast('Add your GitHub username under Profile first.', true);
    btn.disabled = true;
    let repos;
    try { repos = await listRepos(user); } catch (e) { btn.disabled = false; return toast(e.message, true); }
    btn.disabled = false;
    const have = new Set(d.projects.map((p) => (p.repo || '').toLowerCase()));
    const fresh = repos.filter((r) => !have.has(r.full_name.toLowerCase()));
    if (!fresh.length) return toast('Every public repository is already imported.');
    const boxes = fresh.map((r) => h('input', { type: 'checkbox', checked: !r.fork && !r.archived }));
    const cat = h('select', {}, h('option', { value: '' }, 'No category'), d.categories.map((c) => h('option', { value: c.id }, c.name)));
    const mbar = h('i'); const mprog = h('div', { class: 'progress', hidden: true }, mbar);
    const go = h('button', { class: 'btn primary', onclick: async () => {
      const picked = fresh.filter((_, i) => boxes[i].checked);
      if (!picked.length) return dlg.close();
      go.disabled = true; mprog.hidden = false;
      for (let i = 0; i < picked.length; i++) {
        mbar.style.width = (i / picked.length * 100) + '%';
        const r = picked[i]; const f = repoFields(r);
        let stats = null, readme = '';
        try { stats = await fetchStats(r.full_name, r); readme = await fetchReadme(r.full_name); } catch (e) { if (/rate limit/i.test(e.message)) toast(e.message, true); }
        let id = slug(f.title); while (d.projects.some((x) => x.id === id)) id = slug(f.title) + '-' + uid();
        d.projects.push({ id, source: 'github', category: cat.value, description: '', cover: '', screenshots: [], featured: false, hidden: false,
          facts: [], links: f.homepage && /^https?:/.test(f.homepage) ? [{ label: 'Website', url: f.homepage }] : [], itchId: '',
          title: f.title, repo: f.repo, url: f.url, summary: f.summary.slice(0, 220), created: f.created, updated: f.updated, tags: f.tags, stats, readme });
        f.tags.forEach((t) => { if (!d.tags.includes(t)) d.tags.push(t); });
      }
      dlg.close(); safe(touch); toast(`Imported ${picked.length} project${picked.length === 1 ? '' : 's'}.`);
    } }, 'Import selected');
    const dlg = modal({
      title: 'Import from GitHub', wide: true,
      body: [
        h('p', { class: 'muted small' }, `${fresh.length} public repositories of ${user} are not in your list yet.`),
        field('Put them in category', cat),
        h('div', { class: 'repo-list' }, fresh.map((r, i) => h('label', { class: 'repo-item' }, boxes[i],
          h('span', { class: 't' }, h('b', {}, r.name), h('span', { class: 'muted small' }, [r.language, r.fork && 'fork', r.archived && 'archived', '★ ' + r.stargazers_count].filter(Boolean).join(' · ')))))),
        mprog,
      ],
      foot: [h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'), go],
    });
  }

  return section('GitHub', getToken()
    ? 'Import your public repositories and refresh their cached statistics.'
    : 'Without a token GitHub only allows about 60 requests per hour, enough for roughly 8 repositories. Sign in above for a higher limit.',
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', onclick: (e) => openImport(e.currentTarget) }, icon('plus', 16), 'Import repositories'),
      h('button', { class: 'btn', disabled: !linked.length, onclick: (e) => syncAll(e.currentTarget) }, icon('sync', 16), `Sync statistics (${linked.length})`)),
    progress);
}

function backup() {
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let json;
    try { json = JSON.parse(await f.text()); if (!Array.isArray(json.projects)) throw 0; } catch { return toast('That is not a valid backup file.', true); }
    if (await confirmDialog(`Replace everything with this backup (${json.projects.length} projects)?`, 'Replace')) safe(() => { replaceData(json); toast('Backup loaded.'); });
  } });
  return section('Backup', 'Download everything as one JSON file, or restore from one.',
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', onclick: () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' })), download: 'data.json' });
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } }, 'Export data.json'),
      h('button', { class: 'btn', onclick: () => file.click() }, 'Import…'), file,
      isLocal && mode() === 'local' && hasDraft() && h('button', { class: 'btn danger', onclick: async () => {
        if (await confirmDialog('Throw away the local draft and go back to the published data?', 'Discard draft')) { discardDraft(); await load(); reload(); }
      } }, 'Discard local draft')));
}
