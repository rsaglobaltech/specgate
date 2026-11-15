# Proposal: studio-redesign

## Intent

The studio works again (`studio-unblock`), but it is still one 86 KB template
string of hand-written ES5: every refresh redraws the whole page, views have
no URL, the live view is a second app at `/live`, and feedback is a line of
text. It does not look like Specgate, and it is hard to keep correct. A design
for the new studio was approved on 2026-11-08 (canvas: Inicio, Preguntas,
Cambios, Construir, En vivo, Estados), in the identity of the Specgate site.

## Scope

In scope:

- One app, rebuilt from typed source with Preact, bundled at build time into
  a static asset Specgate serves — no runtime dependency for anyone who
  installs Specgate.
- A sidebar of sections — Home, Brief, Changes (drafts and review), Questions,
  Build, Live, Report, Settings (project, agent, quality) — each with its own
  URL; Back, Forward and links work.
- The live view inside the app: the run's stages, its log as it streams,
  its queue, time and cost, the agent's questions answered in place, stop.
- Loading and failure states: a skeleton on first load, a button busy while
  its request runs, notices that say what happened, the connection's state,
  a section that fails on its own.
- Specgate's identity (the site's colours and type), light and dark — the
  system's by default, a switch to choose — Spanish and English, keyboard and
  screen-reader use, reduced motion.
- Browser tests on Windows, macOS and Linux in CI.

Out of scope:

- The CLI features the studio does not offer yet (archive, propose from an
  idea or a ticket, check, config, adopting an existing repository): phase 2,
  added afterwards on this design.
- Changing what any endpoint reads or writes: the `/api/*` contract stays.

## Approach

`studio/src/` holds the app (Preact, TSX); esbuild bundles it into
`dist/studio/app.js` and `app.css` during `npm run build`; studio's root serves
a small HTML shell that loads them with the page token. `/live` and `/overview`
redirect into the app. The old page stays until the new one passes the same
tests, then goes.
