# Design: studio-layers

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`studio/src/sections/Changes.tsx` (the Layers card), `scripts/lib/studio-app.ts`
(`drafts`), `scripts/lib/change-review.ts` (`approveChange`), `StudioCommand`.

## Mechanisms

- AC-1 — `/api/drafts` carries each layer's owner, approvals and quorum; the
  card lists the written ones.
- AC-2 — `mine` is computed for the viewer; Approve posts `{ change, layer }`;
  `approveLayers` refuses a person without the role.
- AC-3 — the viewer is `{ name: user, email }` from the proxy's headers in team
  mode, passed to `drafts` and `approveChange`; git's identity otherwise.

## Channels

`POST /api/approve` with an optional `layer`.

## Decisions

ADR-0045's roles decide; the team's reader/editor/admin decides who may write
at all (REQ-553).
