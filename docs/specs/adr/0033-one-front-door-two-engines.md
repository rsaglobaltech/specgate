# ADR-0033 — One front door, two engines: Specgate drives forja

## Status

Accepted — 2026-10-12.

## Context

[forja](https://rsaglobaltech.github.io/forja/) generates hexagonal projects:
a Next.js + Expo monorepo in TypeScript, or a Spring Boot or Quarkus API with a
Next.js web app. Since its phase 3 it already reaches into Specgate:
`forja add usecase` runs `specgate new` and names the requirement in the test,
and a generated project adopts Specgate on install.

To a user they are already one product. The landing page draws them as one
DevOps loop (plan, code and test with Specgate; build with forja). The C4 model
we want spans both: the context comes from the brief, the containers and
components from the generated code. And the feedback that the tooling is hard to
use names the cost: two CLIs, two sites, two first commands.

Merging them into one package would cost what Specgate stands on:

- **Zero runtime dependencies.** forja carries ejs, ts-morph, memfs, prettier
  and clack, and a few megabytes of templates.
- **A stable gate.** forja's templates follow Next, Expo, Spring and Quarkus,
  which move every few months; each bump would become a Specgate release.
- **Any stack, any repository.** Most adoptions are existing codebases (FinCore,
  Lixi). forja only ever helps on day one, and only on its stacks.

## Decision

**Specgate is the one command a user learns. forja stays a separate package
that Specgate calls, and that still works on its own.**

1. **`specgate init` in an empty folder offers to generate the project with
   forja**, through `npx @rsaglobaltech/forja@<pinned> init`, and adopts the
   result. It is fetched only when chosen, so Specgate keeps zero runtime
   dependencies. Specgate's own skeleton stays for stacks forja does not cover.
   In a folder with code, `init` adopts it, as today.
2. **`specgate add usecase|entity|port` delegates to `forja add`** when the
   project has a `forja.config.json`, and says what it would need otherwise. No
   generator logic moves into Specgate.
3. **forja's checks reach the gate through `arch_cmd`** ([ADR-0028](0028-architecture-conformance-is-part-of-the-gate.md)),
   not through new coupling: a generated project sets `arch_cmd` to its
   architecture check (ArchUnit on Java, `forja doctor --arch` on Node), so
   `specgate check`, `done` and the harness gate run it.
4. **One site.** forja's documentation becomes the "Start a new project"
   section of Specgate's site; forja's own site points there.
5. **The C4 model is split by who knows each level.** forja writes and keeps
   the containers and components (`docs/architecture/workspace.dsl`, Structurizr
   DSL), because it knows the generated structure and changes it with `add`.
   Specgate owns the system context, drafted from the brief's actors and
   surfaces, and checks that the diagram and the requirements agree.
6. **The loop closes through the requirement.** Deploy and observability arrive
   as forja recipes; what production reveals comes back with `specgate new`, so
   Monitor leads to Plan.

## Consequences

- A new user runs one command, `npx @rsaglobaltech/specgate init`, whether the
  folder is empty or not.
- Specgate pins the forja version it calls and moves the pin in its own
  releases; forja releases on its own cadence.
- `forja` remains a documented command for people who only want the generator.
- Specgate's tests for `init` and `add` cover the delegation with a fake forja,
  and a release check runs the real one on an empty folder.
- The plan, with one box per step, is `mejoras/plan-specgate-forja-unificado.md`.

## Alternatives considered

- **Merge forja into Specgate.** One package, at the cost of zero dependencies,
  a stable release cadence and a small install for brownfield users.
- **Keep them apart.** No work, and the friction the feedback names stays.
- **forja drives Specgate.** forja cannot adopt an existing repository, which is
  most of Specgate's users; the front door has to be the tool that works
  everywhere.
