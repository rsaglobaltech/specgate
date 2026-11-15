# Design: rc10-contract

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/workspace.ts` — `storyContext` lists each contracts requirement's citations as `depends=… api=…` lines with the operation's method and path.
- `scripts/lib/story-part.ts` — `contractCitationWarnings`: `layer_api_unresolved`, and `layer_no_operation_cited` as an error once the operation is known.
- `scripts/lib/change-review.ts` — `approvalBlockers` carries each rule's fix and target, and the errors of `contractCitationWarnings`; `approveChange` joins the fixes.
- `scripts/change/instructions.ts` — the layered specs rule on `Source:`.
- `scripts/cli/commands/harness/RunCommand.ts` — one retry after an empty attempt; `contractNotMet` before `done`.
- `packages/core/src/domain/ApiContract.ts` — `routeInPieces`; `scripts/lib/contracts.ts` — `conformanceWarnings(…, pieces)`.

## Mechanisms

- AC-1 — for a contracts sub-change, `memberCitations` of its repository, qualified with the repository's name, each resolved by `citedOperation` for its label. The rule after the list says to copy them as listed.
- AC-2 — a qualified `api=` of a shared contracts repository that `citedOperation` does not resolve is `layer_api_unresolved`: an error, listing that repository's operations as `api=` lines, while the repository has a contract; a warning before. `layer_no_operation_cited` is an error when the contracts' requirement cites operations. `approvalBlockers` adds the errors, so `change approve` refuses; `change validate` reports them once.
- AC-3 — `LAYERED_DELTA_RULES` names `Source:` with an example. A blocker keeps its diagnostic's `fix` and `target`; `approve_blocked`'s fix is each `<target>: <fix>`.
- AC-4 — `agentWroteThisRun` is set by any attempt that wrote. An empty attempt after it, with attempts left, is retried once with a prompt saying it wrote nothing; without it, the run stops as REQ-264 says.
- AC-5 — after a green gate, before `done`: the requirement's qualified `api=` citations, resolved through `workspaceMemberDirs`, go to `conformanceWarnings` with `pieces`; a path found neither whole nor in pieces fails the attempt (`gate` at `contract operation`) with the operation in the next prompt. In pieces: every literal segment of the path in a quoted string of one source file.

## Decisions

- An error for the gate, where rc.9 kept a warning: the warning was there in runs 7 and 8 and nothing changed. The search in pieces answers the reason rc.9 gave — a route mounted in two strings.
- Only qualified citations in the gate: the contracts repository cites its own operations unqualified and serves none.
- One retry, not the attempts left: REQ-264 holds for an agent that never wrote.
