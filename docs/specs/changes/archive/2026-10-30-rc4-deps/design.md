# Design: rc4-deps

> Owner: architect

## Modules

- AC-1, AC-2 — `checkLayers` in `packages/core/src/domain/ChangeLayers.ts` gets the change's delta text
  (`LayerFiles.deltas`); every `depends=<repo>:REQ-NNN` and every `api=<file>#<operation>` design.md names
  that no `specgate:trace` of the delta carries is a warning, `layer_design_dependency_untraced`, naming the
  unqualified `REQ-NNN` on the same design line when there is one. Placeholders (`REQ-NNN`, `<file>`) are not
  references. `ValidateChangeUseCase` reads the deltas before the layer rules.
- AC-3 — `storyContext` in `scripts/lib/workspace.ts`, which both the harness (REQ-344) and `change author`
  (REQ-366) append: for the member whose role is `contracts`, it asks for the OpenAPI/AsyncAPI file under
  `contracts/` and for `api=contracts/<file>#<operationId>` on each requirement; for the others, to cite the
  contracts member's requirements with `depends=` and its operations with `api=` once the file exists.

## Mechanisms

A warning, like the other layer rules: a design may discuss a dependency it then rejects.
