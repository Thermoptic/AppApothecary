// Add / edit / delete a project in a dialog.

import { h, set, icon, modal, confirmDialog, toast, slug, uid } from '../ui.js';
import { state, touch, imgSrc, tagCounts } from '../store.js';
import { parseRepo, getRepoInfo, fetchStats, fetchReadme, repoFields } from '../github.js';

// Downscale in the browser so uploads stay small.
async function fileToDataUrl(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const webp = c.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.88);
}

const pairsToText = (arr, a, b) => arr.map((x) => `${x[a]} | ${x[b]}`).join('\n');
const textToPairs = (text, a, b) => text.split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((x) => x[0] && x[1]).map((x) => ({ [a]: x[0], [b]: x.slice(1).join('|') }));
const safeUrl = (u) => /^https?:\/\//i.test(u);

export function openEditor(project) {
  const isNew = !project;
  const d = state.data;
  const p = project || { source: 'github', category: d.categories[0] ? d.categories[0].id : '', tags: [], screenshots: [], facts: [], links: [] };
  let cover = p.cover || '';
  let shots = [...p.screenshots];
  let stats = p.stats || null;

  const f = {
    title: h('input', { value: p.title || '', required: true, maxlength: 80 }),
    source: h('select', { value: p.source }, h('option', { value: 'github' }, 'GitHub'), h('option', { value: 'itch' }, 'itch.io'), h('option', { value: 'other' }, 'Other')),
    repo: h('input', { value: p.repo || '', placeholder: 'owner/name or repository URL' }),
    url: h('input', { type: 'url', value: p.url || '', placeholder: 'https://' }),
    category: h('select', { value: p.category || '' }, h('option', { value: '' }, 'No category'), d.categories.map((c) => h('option', { value: c.id }, c.name))),
    tags: h('input', { value: p.tags.join(', '), placeholder: 'comma, separated' }),
    summary: h('textarea', { maxlength: 220, style: { 'min-height': '72px' } }, p.summary || ''),
    description: h('textarea', { style: { 'min-height': '140px' } }, p.description || ''),
    readme: h('textarea', { style: { 'min-height': '140px', 'font-family': 'ui-monospace, Consolas, monospace', 'font-size': '.85rem' } }, p.readme || ''),
    created: h('input', { type: 'date', value: (p.created || '').slice(0, 10) }),
    updated: h('input', { type: 'date', value: (p.updated || new Date().toISOString()).slice(0, 10) }),
    facts: h('textarea', { placeholder: 'Platform | Windows, Web\nEngine | Godot', style: { 'min-height': '80px' } }, pairsToText(p.facts, 'label', 'value')),
    links: h('textarea', { placeholder: 'Live demo | https://example.com', style: { 'min-height': '64px' } }, pairsToText(p.links, 'label', 'url')),
    itchId: h('input', { value: p.itchId || '', inputmode: 'numeric', placeholder: 'e.g. 1234567' }),
    featured: h('input', { type: 'checkbox', checked: p.featured }),
    hidden: h('input', { type: 'checkbox', checked: p.hidden }),
  };
  const field = (label, input, hint) => h('label', { class: 'field' }, label, input, hint && h('span', { class: 'hint' }, hint));

  // --- GitHub fetch ---
  const fetchBtn = h('button', { type: 'button', class: 'btn', onclick: async () => {
    const full = parseRepo(f.repo.value || f.url.value);
    if (!full) return toast('Enter the repository as owner/name.', true);
    fetchBtn.disabled = true;
    try {
      const info = await getRepoInfo(full);
      const r = repoFields(info);
      f.repo.value = r.repo; f.url.value = f.url.value || r.url;
      if (!f.title.value) f.title.value = r.title;
      if (!f.summary.value) f.summary.value = r.summary.slice(0, 220);
      if (!f.tags.value) f.tags.value = r.tags.join(', ');
      f.created.value = r.created; f.updated.value = r.updated;
      stats = await fetchStats(full, info);
      const rd = await fetchReadme(full);
      if (rd) f.readme.value = rd;
      toast('Fetched details and statistics from GitHub.');
    } catch (e) { toast(e.message, true); }
    fetchBtn.disabled = false;
  } }, icon('sync', 16), 'Fetch');
  const repoRow = h('div', {}, field('GitHub repository', h('div', { class: 'row' }, f.repo, fetchBtn), 'Fetch fills in name, dates, tags and statistics.'));
  const itchRow = h('div', {}, field('itch.io game ID (optional)', f.itchId, 'Shows the itch.io widget. Paste the number, or the whole embed code or link (itch.io/embed/123456). The game must be published as Public on itch.io, otherwise the widget stays empty.'));
  const syncSource = () => { repoRow.hidden = f.source.value !== 'github'; itchRow.hidden = f.source.value !== 'itch'; };
  f.source.addEventListener('change', syncSource); syncSource();

  // --- tag suggestions ---
  const known = tagCounts().map((t) => t[0]).slice(0, 14);
  const suggest = h('div', { class: 'tags' }, known.map((t) => h('button', { type: 'button', class: 'tag', style: { border: 0, cursor: 'pointer', 'min-height': '28px' }, onclick: () => {
    const cur = f.tags.value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!cur.includes(t)) { cur.push(t); f.tags.value = cur.join(', '); }
  } }, '+ ' + t)));

  // --- images ---
  const coverBox = h('div', { class: 'thumbs' });
  const shotsBox = h('div', { class: 'thumbs' });
  const thumb = (src, onRemove) => h('div', { class: 'thumb' }, h('img', { src: imgSrc(src), alt: '' }),
    h('button', { type: 'button', 'aria-label': 'Remove image', onclick: onRemove }, '×'));
  const drawImages = () => {
    set(coverBox, cover ? thumb(cover, () => { cover = ''; drawImages(); }) : h('span', { class: 'muted small' }, 'No cover. A colored placeholder is shown.'));
    set(shotsBox, shots.map((s, i) => thumb(s, () => { shots.splice(i, 1); drawImages(); })));
  };
  const pick = (multiple, onFiles) => h('input', { type: 'file', accept: 'image/*', multiple, onchange: async (e) => {
    try { for (const file of e.target.files) onFiles(await fileToDataUrl(file)); }
    catch { toast('Could not read that image.', true); }
    e.target.value = ''; drawImages();
  } });
  drawImages();

  const form = h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); save(); } },
    field('Name', f.title),
    h('div', { class: 'grid2' }, field('Source', f.source), field('Category', f.category)),
    repoRow, itchRow,
    field('Link', f.url),
    field('Short description', f.summary, 'Shown on the card. Max 220 characters.'),
    field('Tags', f.tags), known.length ? suggest : null,
    field('About', f.description, 'Longer text for the project page. Blank lines make paragraphs.'),
    field('Readme', f.readme, 'Markdown, usually the repository readme. Shown on the project page.'),
    h('div', { class: 'grid2' }, field('Created', f.created), field('Last updated', f.updated)),
    h('div', { class: 'field' }, h('span', { class: 'small', style: { 'font-weight': 550 } }, 'Cover image'), coverBox, pick(false, (u) => { cover = u; })),
    h('div', { class: 'field' }, h('span', { class: 'small', style: { 'font-weight': 550 } }, 'Screenshots'), shotsBox, pick(true, (u) => shots.push(u))),
    field('Facts', f.facts, 'One per line as "Label | Value". Shown as tiles on the project page.'),
    field('Extra links', f.links, 'One per line as "Label | https://…".'),
    h('label', { class: 'row' }, f.featured, 'Pin to the top of the list'),
    h('label', { class: 'row' }, f.hidden, 'Hide from visitors'));

  function save() {
    if (!form.reportValidity()) return;
    const url = f.url.value.trim();
    if (url && !safeUrl(url)) return toast('The link must start with http:// or https://', true);
    const next = {
      title: f.title.value.trim(), source: f.source.value, url, category: f.category.value,
      repo: f.source.value === 'github' ? parseRepo(f.repo.value) : '',
      tags: [...new Set(f.tags.value.split(',').map((s) => s.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))],
      summary: f.summary.value.trim(), description: f.description.value.trim(), readme: f.readme.value.trim(),
      created: f.created.value, updated: f.updated.value, cover, screenshots: shots,
      facts: textToPairs(f.facts.value, 'label', 'value'),
      links: textToPairs(f.links.value, 'label', 'url').filter((l) => safeUrl(l.url)),
      itchId: ((/embed\/(\d+)/.exec(f.itchId.value) || /^\s*(\d+)\s*$/.exec(f.itchId.value) || [])[1]) || '', featured: f.featured.checked, hidden: f.hidden.checked,
      stats: f.source.value === 'github' ? stats : null,
    };
    for (const t of next.tags) if (!d.tags.includes(t)) d.tags.push(t);
    let id;
    if (isNew) {
      id = slug(next.title);
      while (d.projects.some((x) => x.id === id)) id = slug(next.title) + '-' + uid();
      d.projects.push({ id, ...next });
    } else { id = p.id; Object.assign(p, next); }
    dlg.close();
    try { touch(); toast(isNew ? 'Project added.' : 'Project saved.'); } catch (e) { toast(e.message, true); }
    if (isNew) location.hash = '#/p/' + encodeURIComponent(id);
  }

  async function remove() {
    if (!(await confirmDialog(`Delete "${p.title}"? This cannot be undone once you publish.`))) return;
    d.projects.splice(d.projects.indexOf(p), 1);
    dlg.close();
    try { touch(false); } catch (e) { toast(e.message, true); }
    toast('Project deleted.');
    if (location.hash === '#/') window.dispatchEvent(new Event('hashchange')); else location.hash = '#/';
  }

  const dlg = modal({
    title: isNew ? 'Add project' : 'Edit project', wide: true, body: form,
    foot: [
      !isNew && h('button', { class: 'btn danger left', onclick: remove }, icon('trash', 16), 'Delete'),
      h('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: save }, isNew ? 'Add project' : 'Save'),
    ],
  });
}
