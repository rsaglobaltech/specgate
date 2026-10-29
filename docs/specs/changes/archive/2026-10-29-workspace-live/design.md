# Design: workspace-live

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/workspace-live.ts` — the workspace live model, folded from each
  member's own live model (`readLive`, ADR-0037) and harness ledger
  (`.harness/runs/*.json`), and from the workspace's stories (ADR-0041).
- `scripts/lib/workspace-live-page.ts` — the page, streamed like `/live`.
- `StudioCommand` — in a workspace repository, `/live`, `/live.json` and
  `/live/stream` serve the workspace.
- `WorkspaceCommand` — `workspace live` and `workspace harness run --story`.

## Mechanisms

- AC-1 — per member, `readLive(member)`: its queue, and the most recently
  updated requirement still running is the one in flight, with its `running`
  gate step (REQ-274) and its last agent step (`kind`, `target`).
- AC-2 — per story sub-change: `archived` or `missing` from the member's change
  folders (REQ-297); an open sub-change is `building` when a requirement of its
  delta has live events, else `open`. A requirement of the delta whose
  `depends=` names `repo:REQ-NNN` not delivered there makes the part
  `blockedBy` that id.
- AC-3 — money: the agent's reported cost (`usage` events, REQ-182); minutes:
  the ledger's `durationMs`. A repository sums all of its own; a story sums the
  requirements of its sub-changes.
- AC-4 — `workspace harness run --story <id>`: each member's base is judged as
  `harness run` judges its own (REQ-175, `baselineProblem`), the sub-change's
  requirements being the run; one red base refuses the story and starts
  nothing. Then one `harness run --req …` per member, in parallel, each its own
  process, its output kept in `.specgate/workspace-runs/<story>/<repo>.log`;
  the arguments after `--` go to every member; `--dry-run` prints the commands.
- AC-5 — `workspace live --json`, and the studio's `/live.json` in a workspace.

## Channels

Files only: each member's `.harness/events/` and `.harness/runs/` and change
folders, the workspace's `docs/stories/`. The view writes no member.

## Decisions

Extends ADR-0041 (the workspace) and ADR-0037 (the live view): the workspace
view is a fold of the members' own views, never a second record.
