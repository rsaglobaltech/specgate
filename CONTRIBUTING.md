<!-- specgate:allow-placeholders — this file documents the {{VAR}} template syntax. -->

# Contributing to `specgate`

Thank you for investing your time in this project.

---

## Table of contents

1. [Development setup](#1-development-setup)
2. [Running tests](#2-running-tests)
3. [ADR policy](#3-adr-policy)
4. [Pull request checklist](#4-pull-request-checklist)
5. [Coding standards](#5-coding-standards)
6. [Commit message format](#6-commit-message-format)
7. [Releasing](#7-releasing)

---

## 1. Development setup

```bash
git clone https://github.com/rsaglobaltech/specgate.git
cd specgate
npm install
npm run build
```

**Prerequisites:** Node.js ≥ 22. Nothing else — the CLI has zero runtime
dependencies. The tests run against the compiled output in `dist/`, so
`npm run build` (or any `npm test`, which builds first) has to happen before
you can invoke `bin/specgate.js`.

Optional, only if you touch those areas: a JDK 17+ and Gradle for the Maven and
Gradle plugins, and `vhs` for the demo recordings.

---

## 2. Running tests

| Command | What it runs |
|---|---|
| `npm test` | E2E integration tests (`tests/cli.test.ts`) |
| `npm run test:unit` | Unit tests (`tests/unit/`) |
| `npm run test:coverage` | The unit suite under `c8`, with the thresholds enforced |
| `npm run test:bdd` | Cucumber scenarios (`features/`) |
| `npm run test:snapshot` | Determinism of generated output |
| `npm run test:vscode-unit` | VS Code extension (no VS Code runtime needed) |
| `npm run test:mcp-unit` | MCP server |
| `npm run test:lsp-unit` | Language server |
| `npm run test:registry-unit` | Pack registry generator |
| `npm run test:all` | All of the above in sequence |
| `npm run verify` | typecheck · ESLint · Prettier · tests · `npm pack` dry run |

`npm run verify` is what CI's lint job runs. All tests must be **green on your
branch** before opening a PR.

### Which branch to target

**Open every pull request against `develop`, never against `main`.**

`main` is the branch releases are cut from and the one an evaluator looks at
first, so it does not get to be red — not even briefly. `develop` is where
changes meet each other and where a merge that breaks something neither side
broke alone shows up.

When `develop` is green, it is merged into `main` as a single fast-forward and
the release is cut from there. CI runs on pushes to both branches, so "green on
`develop`" is a claim something checked rather than an assumption.

---

## 3. ADR policy

Every PR that introduces a **non-trivial design decision** must include an
Architecture Decision Record (ADR).

### What counts as non-trivial?

- Choosing a new dependency or replacing an existing one
- Changing a default behaviour that affects users
- Adding a new command or subcommand
- Altering the `pack.yaml` schema format
- Changing the template rendering engine or file layout
- Deprecating or removing a public API / flag

### How to write an ADR

1. Copy the template below into `docs/specs/adr/NNNN-short-title.md`
   where `NNNN` is the next sequential number.
2. Fill in all sections (Context, Decision, Consequences, Alternatives).
3. Set `Status: Proposed` in the PR; change to `Accepted` when merged.
4. Reference the ADR from the PR description.

```markdown
# ADR-NNNN: Short Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR-XXXX
**Depends on / Supersedes:** (link if applicable)

## Context
Why does this decision need to be made now?

## Decision
What exactly are we doing?

## Consequences
Positive and negative effects of this decision.

## Alternatives considered
What else was evaluated and why it was rejected.
```

### ADR index

All ADRs live in [`docs/specs/adr/`](docs/specs/adr/).
The index is maintained in [`docs/specs/adr/README.md`](docs/specs/adr/README.md).

---

## 4. Pull request checklist

Before requesting a review, confirm:

- [ ] `npm run test:all` passes locally
- [ ] `npm run lint && npm run format:check` passes
- [ ] New behaviour is covered by at least one test (unit, BDD, or E2E)
- [ ] If this is a design decision, an ADR is included (see §3)
- [ ] Tasks closed by this PR are ticked in [`mejoras/plan-cierre-enterprise.md`](mejoras/plan-cierre-enterprise.md), citing the task ID in the commit
- [ ] Public CLI flags / commands are documented in `README.md` and `--help`
- [ ] No `TODO` placeholders remain in committed files

### Required checks

These checks must be green before a pull request can merge into `develop`, and
green again on `develop` before it reaches `main`:

| Check | What it guards |
| --- | --- |
| `Lint and format` | typecheck, ESLint, Prettier, ShellCheck, and the agent-contract staleness check |
| `Test (<os> / Node <version>)`, six jobs | the full suite — unit, BDD, E2E — across ubuntu, macos and windows on Node 22 and 24: the floor `package.json` declares and the current LTS. Windows is where path handling breaks first |
| `Maven plugin` · `Gradle plugin` | the Java surface, which the Node suite never touches |
| `Package` | `npm pack` produces a usable tarball |
| `npm audit` · `CodeQL` · `SBOM and licences` | a devDependency runs on CI with a publish token in scope, and a licence outside the allow-list is a build failure |

An approving review is **not** required, and that is a deliberate consequence of
having one maintainer rather than a statement that review does not matter — see
[MAINTAINERS.md](MAINTAINERS.md#how-merging-works-here).

---

## 5. Coding standards

- **Language:** TypeScript compiled to CommonJS (`"type": "commonjs"`, `module: commonjs`). Both `export` and `module.exports` appear in `scripts/` — the newer files use ESM syntax, which `tsc` downlevels, and imports that cross into an older `module.exports` file use `require()`. Match the file you are editing.
- **Style:** ESLint + Prettier enforce the rules automatically — run `npm run lint:fix` and `npm run format`.
- **No comments that describe *what* the code does.** Only add a comment when the *why* is non-obvious (invariant, workaround, hidden constraint).
- **No unused variables.** The `no-unused-vars` rule is set to `error`.
- **Shell scripts.** ADR-0008 removed every shell script from the CLI itself; the only ones left are the demo recording helpers under `scripts/demo/`. ShellCheck runs in the lint job at `--severity=warning` over every tracked `*.sh`.
- **Templates** live in `templates/` and use `{{VARIABLE}}` interpolation. Never add logic to templates.

---

## 6. Commit message format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`

Scope examples: `init`, `validate`, `expand`, `pack`, `vscode`, `ci`, `schema`

Breaking changes must include `!` after the scope and a `BREAKING CHANGE:` footer:

```
feat(init)!: flip default engine to Node.js

BREAKING CHANGE: --engine=shell now emits a deprecation warning.
```

---

## 7. Releasing

Releases are automated via GitHub Actions (`publish-npm.yml`). To cut a release:

1. Update `version` in `package.json` (follow SemVer).
2. Update `CHANGELOG.md` with the release notes.
3. Open a PR targeting `main` with the version bump.
4. After merge, tag `vX.Y.Z` on `main` — the publish workflow fires automatically.

**Pre-release versions** (`0.x.x-beta.N`) are published from a feature branch by
running the `publish-github-packages.yml` workflow manually (`workflow_dispatch`)
with `dist_tag: beta`.

Full detail — what gets published where, the tag convention, and the checks to
run before tagging — is in [`docs/release-process.md`](docs/release-process.md).
