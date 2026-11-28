# Design: uml-evidence

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

New `packages/core/src/domain/UmlModel.ts` and `packages/core/src/domain/UmlDiagrams.ts`; `scripts/lib/evidence-diagrams.ts` and `scripts/lib/evidence-page.ts`; their tests.

## Mechanisms

AC-1 — `umlTypesOf` reads a Java or TypeScript file into types: kind, package, parents, typed members with visibility, enum literals, annotations, and each method's body. Other languages keep the names `classesOf` reads. The slice is the types of the requirement's files, what they reference two steps out, the implementations of its interfaces and the types that hold one of its own as an attribute. `umlClassDiagram` draws it with Mermaid's neutral theme; a type not at the base is filled green, one whose members changed amber, and the page names them.

AC-2 — `endpointsOf` reads Spring's `@*Mapping` and JAX-RS's `@Path` with the class's base path and `@ResponseStatus`. `codeSequence` starts at the endpoint the WHEN names, or for a screen at the `/api/...` call the requirement's web code makes beside its id, and follows the calls each body makes on its attributes, parameters and locals: into a project type (an interface's only implementation), up to four levels; a collaborator from outside the project is drawn and not entered; records and enumerations are data, not lifelines.

AC-3 — with no endpoint found, `sequenceDiagram` from the steps, as before.

## Decisions

Mermaid, not PlantUML: GitHub renders it in the pull request, where the page is read. Static reading, not a run: the page must be the same every time it is written, and must not need the app running.
