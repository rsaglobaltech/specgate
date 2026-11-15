# Proposal: init-ready-for-ci

## Intent

A project made by `specgate init` should be checked by CI from its first push,
as fully as specgate can check it, and the person who owns it decides what to
take out. Today:

- `init` writes `.github/workflows/specs.yml`, which only runs `specgate
  validate .` on Ubuntu with `@rsaglobaltech/specgate@latest` — not
  reproducible, and it never runs the project's tests or architecture check.
- `specgate ci init` already writes a far better gate (`spec-gate.yml`: the
  stack's setup, `specgate check`, the pack drift check, the plan artifact, a
  pinned version, for GitHub, GitLab, Azure and Jenkins) — but `init` only
  suggests it. Whoever runs it ends with two workflows that overlap.
- Scaffolding specgate-studio (a Tauri desktop app) showed three more gaps:
  the README names files the `layered` and `minimal` profiles do not write; the
  `.env.*`, docker-compose, devcontainer and `runtime-environments.md` scaffold
  assumes a containerised service; and there is no project type for a desktop
  app.

## Scope

In scope:

- `init` and `adopt` install the full gate for the provider they detect
  (GitHub when none), not `specs.yml`; `--no-ci` leaves it out.
- The gate validates more by default: the three operating systems, the ids
  against the base branch, the quality checks when configured — each step
  explaining in the YAML what it checks and how to remove it.
- It is green on a new project: what is not configured yet is said, not failed.
- `ci init --minimal`, `ci status`, and replacing an old `specs.yml` only
  after showing the difference.
- The README lists only what the profile writes; the container scaffold only
  for a project that runs as a service; a `desktop` project type.

Out of scope:

- Changing what `specgate check` itself checks.
- CI providers beyond the four `ci init` knows.

## Approach

`init` calls the same renderer `ci init` uses (`CiToolchain`, `templates/ci/`),
so there is one gate template per provider. The GitHub template gains the OS
matrix, `fetch-depth: 0` with `--base`, and the quality step, each behind a
comment block. A step whose command is not configured prints why and exits 0.
`ci status` reads the workflow back and lists each known step as present or
missing. The README template is rendered from the profile's file list; the
container files move to the service project types; `desktop` gets its stack
rules and a local-app `runtime-environments.md`.
