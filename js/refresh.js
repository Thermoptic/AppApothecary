// The REFRESH button: look for new GitHub repositories and refresh statistics.
// The owner saves the result (Publish); a visitor only sees it until the page is reloaded.

import { syncFromGitHub } from './sync.js';
import { state, isAdmin, touch, mode } from './store.js';
import { toast } from './ui.js';

const names = (list) => list.slice(0, 3).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '');

export async function runRefresh(btn) {
  const owner = isAdmin();
  const statusEl = () => document.getElementById('status');
  const idle = statusEl() ? statusEl().dataset.idle : '';
  btn.disabled = true; btn.classList.add('spin');
  try {
    const res = await syncFromGitHub(state.data, { refresh: owner, onProgress: (t) => { if (statusEl()) statusEl().textContent = t; } });
    if (res.limited) toast(owner ? 'GitHub rate limit reached. Sign in with your token under Settings for a higher limit, or try again later.' : 'GitHub is limiting requests right now. Try again in a while.', true);
    if (res.added.length || res.refreshed.length) {
      if (owner) touch(); else window.dispatchEvent(new Event('hashchange')); // redraw the list
      toast([res.added.length && `Added ${names(res.added)}.`, owner && res.refreshed.length && `Refreshed ${res.refreshed.length} project${res.refreshed.length === 1 ? '' : 's'}.`, owner && mode() === 'remote' && 'Press Publish to save it.', !owner && 'Shown for this visit only.'].filter(Boolean).join(' '));
    } else if (!res.limited) toast(res.failed ? 'Could not reach GitHub for some projects. Try again.' : owner ? 'Everything is up to date.' : 'No new repositories found.', !!res.failed);
  } catch (e) { toast(e.message, true); }
  btn.disabled = false; btn.classList.remove('spin');
  if (statusEl()) statusEl().textContent = idle;
}
