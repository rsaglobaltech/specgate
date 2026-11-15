# Design: rc9-contract

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/domain/ApiContract.ts` — `parseApiRef` reads a repository qualifier; `operationSource`, `operationRoute`, `routePattern`.
- `scripts/lib/contracts.ts` — `memberCitations`, `citedOperation`, `operationsSection`, `conformanceWarnings`; `apiReferenceProblems` leaves a qualified reference to the workspace; `contractReport` adds the conformance warnings.
- `scripts/lib/workspace.ts` — `checkWorkspace` → `contractCitations`; the story context and "Across repositories" ask for `api=<contracts>:contracts/<file>#<operationId>`.
- `scripts/lib/story-part.ts` — `layer_no_operation_cited` in `contractCitationWarnings`; `workspaceMemberDirs`.
- `scripts/harness/prompt.ts` — the operations section of the prompt; `WorkspaceCommand` passes `SPECGATE_WORKSPACE`.
- `scripts/change/instructions.ts` — the design rule names the qualified form.

## Mechanisms

- AC-1 — `api=<repo>:<file>#<operationId>`: a name and a colon before the file, as a qualified id. A member's `validate` skips it; `workspace check` resolves it in that member's contracts (`citedOperation`): `workspace_api_unresolved`, an error for a delivered requirement and a warning otherwise; `workspace_unknown_repo` for a name the workspace lacks. Citations are read from the specs and from the deltas of open changes, where a story's part stays until it is archived.
- AC-2 — in `contractCitationWarnings`, a requirement whose `depends=` names a shared contracts repository's requirement and whose trace has no `api=` gets `layer_no_operation_cited`, listing that requirement's own `api=` citations, qualified.
- AC-3 — `buildPrompt` appends "The operations this requirement serves or calls": for each `api=` of the requirement, the method and path and the operation's lines from the contract (`operationSource`), with the rule that the provider serves and the consumer calls exactly that path. A qualified reference finds the workspace from `SPECGATE_WORKSPACE`, set by `workspace harness run`, or from a `story.json` of an open change.
- AC-4 — `conformanceWarnings`: for each delivered requirement citing an OpenAPI operation, `routePattern(path)` — each `{param}` matching `{x}`, `:x`, `[x]`, `<x>`, `${…}` or `*`, anything before the path — is searched in the repository's source files, tests, `contracts/`, `docs/` and `features/` excluded. None matching is `contract_operation_not_found`, a warning in `workspace check` and `contract check`.

## Channels

- `SPECGATE_WORKSPACE`, from `workspace harness run` to each member's harness.

## Decisions

- A warning for conformance, not an error: a route mounted in two pieces (`/vehicles` + `/:id/tachograph`) is not found by a text search, and a false failure would block a correct delivery.
- The method is named but not matched: frameworks write it in too many places to find it reliably beside the path.
