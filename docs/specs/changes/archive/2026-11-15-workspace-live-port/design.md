# Design: workspace-live-port

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`StudioCommand` (routes), `studio-shell.ts`, the studio app (`WorkspaceLive`,
`useLive`, `liveBase`); `live-page.ts`, `workspace-live-page.ts` and
`studio-app-page.ts` removed.

## Mechanisms

- AC-1 — `/live` in a workspace serves the app with `specgate-workspace`; Live
  renders `WorkspaceLive` from `/live/stream`.
- AC-2 — `/live/repo/<name>/` serves the app with `specgate-live-base`, the
  member's role and no token; Live reads under that prefix and links back.
- AC-3 — `/live.json`, `/live/stream`, `/live/repo/<name>/*` answer as before.

## Channels

The live JSON and stream, unchanged.

## Decisions

One studio: the pages of the 0.x live view are gone (ADR-0043's live view, in the app).
