# My Projects

A personal showcase for everything you have built: GitHub projects, itch.io games and anything else. Static site, no build step, made for GitHub Pages.

## Preview locally

No installs needed on Windows:

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:5173/. On localhost you can edit freely; changes are kept as a draft in that browser only (Settings → Backup → Export to save them as a file).

## Publish on GitHub Pages

1. Create a repository on GitHub and upload every file in this folder (keep the folder structure, including `.nojekyll`).
2. In the repository: Settings → Pages → Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Your site is at `https://<username>.github.io/<repository>/`.

## Edit the live site

1. Open the site → gear icon → **Owner access**.
2. Create a fine-grained token at https://github.com/settings/personal-access-tokens/new with access to *only this repository* and the permission **Contents: Read and write**.
3. Paste it and press Sign in. The token is stored only in that browser. Never commit it.

After that you get Add / Edit / Delete buttons. Changes collect in an "Unpublished changes" bar; **Publish** commits them to `data/data.json` (and images to `assets/shots/`). Visitors see the update after about a minute.

## GitHub statistics

Settings → Profile: enter your GitHub username. Settings → GitHub: **Import repositories**, then **Sync statistics** whenever you want fresh numbers. Statistics are cached in `data.json`, so visitors never hit GitHub's rate limit.

itch.io has no public API usable from a browser, so games are added by hand (link, images, facts). Add the numeric game ID to show the itch.io widget.

## Files

- `index.html`, `css/styles.css` – page shell and design (light/dark)
- `js/app.js` – routing and header
- `js/store.js` – loading, drafts, publishing
- `js/github.js` – GitHub API
- `js/views/` – start page, project page, editor, settings
- `data/data.json` – all content (ships with four samples you can delete)
