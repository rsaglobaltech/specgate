# Design: rc9-live

> Owner: architect — how it is built: modules, mechanisms, channels.

## Modules

- `scripts/cli/commands/spec/StudioCommand.ts` — the routes under `/live/repo/<name>/`, and `projectLive`, the
  single project's live routes, shared by the studio's own project and each member.
- `scripts/lib/live-page.ts` — `livePage(name, token, context)`: a header naming the repository's role and a
  link back to the workspace.
- `scripts/lib/workspace-live-page.ts` — each repository's name links to its live view.

## Mechanisms

- AC-1 — `/live/repo/<name>` redirects to `/live/repo/<name>/`, which serves `livePage` of the member; the
  page asks for its data relatively (`live.json`, `live/stream`, `live/req/<id>.json`, `live/matrix.json`,
  the prompts), so under that prefix each is answered by `projectLive` with the member's folder
  (`ws.dirs[name]`): the same model (`readLive`) and the same stream (`liveSignature`, every 500 ms). The
  page is read-only: no token is given, so the studio refuses its writes.
- AC-2 — the workspace page's card title is a link to `/live/repo/<name>/`.
- AC-3 — an unknown name is a 404 listing the workspace's repositories; a member whose folder does not exist
  is a 404 saying so.

## Decisions

- The member's page is the single-project page itself, not a copy: what a repository's own studio shows and
  what the workspace shows of it cannot drift apart.
