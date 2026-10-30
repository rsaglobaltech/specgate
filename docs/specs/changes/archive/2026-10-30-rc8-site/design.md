# Design: rc8-site

> Owner: architect — how it is built: modules, mechanisms, channels.

## Modules

- `scripts/docs/build-site.ts` — `buildSite(outDir, opts)`, `versionPicker`, `--channel` and `--versions`.
- `docs/assets/docs.css`, `docs/assets/docs.js` — the picker's look and closing.
- `docs/whats-new-1.0.md` and `scripts/docs/nav.ts` — the page of new features, in the sidebar.
- `.github/workflows/pages.yml` — builds the candidate's line into `next/` (on `main`, in its own pull request).

## Mechanisms

- AC-1 — `buildSite(outDir, { channel, versions })`: with `versions.stable` and `versions.next`, the shell's
  `top__version` is a `<details>` listing both; the stable entry links to the stable root's `docs.html`, the
  candidate's to `next/whats-new-1.0.html`, each relative to the page; the current one has
  `aria-current`. The landing page's hand-written badge is replaced on the way through `copyVerbatim`.
  Without both versions the badge is the plain `<span>` it was.
- AC-2 — `channel: "next"` adds a banner over each page's content linking to the stable docs, and the edit
  link names `next/1.0`.
- AC-3 — a test reads every `## [1.0.0-rc.N]` heading of CHANGELOG.md and asks the page for `1.0.0-rc.N`.

## Decisions

- Two builds into one site, not two sites: GitHub Pages serves one site per repository, deployed from `main`
  only; `main`'s workflow checks out `next/1.0` and builds it under `next/` with that line's own generator.
- `<details>`, not a scripted menu: it opens without JavaScript; the script only closes it on a click outside.
