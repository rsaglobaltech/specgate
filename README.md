<div align="center">

# ⬡ Specgate

**Specs as executable contracts — requirements, scenarios and traceability that CI enforces.**

[![CI](https://github.com/rsaglobaltech/specgate/actions/workflows/ci.yml/badge.svg)](https://github.com/rsaglobaltech/specgate/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40rsaglobaltech%2Fspecgate?logo=npm&label=npm)](https://www.npmjs.com/package/@rsaglobaltech/specgate)
[![Docker](https://img.shields.io/badge/ghcr.io-specgate-2496ed?logo=docker&logoColor=white)](https://github.com/rsaglobaltech/specgate/pkgs/container/specgate)
[![Docs](https://img.shields.io/badge/docs-github_pages-0e8078)](https://rsaglobaltech.github.io/specgate/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#-license)

</div>

Specgate keeps what your product must do in the repository, as numbered
requirements with Gherkin scenarios, next to the code and the tests that prove
them. A test that mentions a requirement's id (`REQ-007`) is the link, and the
traceability matrix is generated from those mentions. The gate, `specgate check`,
fails a pull request when a delivered requirement has no scenario or no test
that names it, or when your test suite fails.

## ⚡ Install

You need **Node.js 22 or later**; 24 is the one to use (the current LTS). On 22, take 22.23.4 or later: it carries the October 2026 security fixes.

```bash
npm install --save-dev @rsaglobaltech/specgate   # in a project with a package.json
npx specgate --help
```

Without installing it (an empty folder, a Java or Python project), prefix each
command with `npx @rsaglobaltech/specgate@latest` instead of `npx specgate`.
With Docker and no Node.js: `docker run --rm -v "$PWD:/workspace" ghcr.io/rsaglobaltech/specgate check`.

Then run `init` once:

- **In a repository that has code** (`package.json`, `pom.xml`, `go.mod`, …),
  `specgate init` adopts it in place: it adds `spec.md`, `features/` and
  `docs/specs/`, and changes no source file.
- **In an empty folder**, `npx @rsaglobaltech/specgate@latest init` scaffolds a
  new specification project. A wizard asks for the project's name, type, stack
  and test toolchain, then creates it in a new sub-folder named after the
  project, for example `./my-spec-driven-app/`. `--yes` takes every default
  without asking. It writes the specification files, not application code.

Step by step, with every output shown: [Getting started](docs/getting-started.md).

## 🔁 The lifecycle — four verbs

```bash
specgate propose add-pdf-invoices   # open a change: a proposal, a delta to write, REQ ids reserved
# write REQ-007 and its scenario in the delta, a test that mentions REQ-007, then the code
specgate apply REQ-007              # refused until a test names it and the gate passes; then Implemented
specgate status                     # what is left, and the next command to run
specgate archive add-pdf-invoices   # once every requirement in it is Implemented
```

`specgate check` runs the same gate before a pull request and in CI;
`specgate ci init` writes the CI job for GitHub, GitLab, Azure or Jenkins.
You archive a change on its branch, before the pull request, so the spec and
the code reach review together.

## 📥 Where work comes from

Every piece of work enters the same lifecycle. Pick the entry that matches what
you have:

| You have | Run | Guide |
| --- | --- | --- |
| One behaviour to add or change | `specgate propose <change-id>` | [Propose one change](docs/start/existing-2-specify.md) |
| A client brief, or a plan for a new product | `specgate propose --from-brief` | [From a client brief](docs/from-a-brief.md) |
| A Jira story with acceptance criteria | `specgate propose --from-ticket <KEY>` | [From a Jira ticket](docs/from-a-ticket.md) |

## 🛠️ What it does

- **A gate that does not lie.** `check` fails when a delivered requirement has
  no scenario, no test that names it, or points at a missing file. A `Draft`
  owes nothing yet, so the gate is green on day one.
  → [Validating](docs/validating.md)
- **Reviews that read intent.** A change is a delta: only what moves. The
  reviewer reads the requirement, its scenario and its test.
  → [Your team's first pull request](docs/first-pr.md)
- **Drafts held to their source.** A draft from a brief or a ticket is checked
  against that text: every value it uses must come from the source or be listed
  as an assumption. → [From a client brief](docs/from-a-brief.md)
- **Your agent works the same loop.** `specgate agents init` installs the loop
  as slash commands for Claude Code, Cursor, Copilot and other agent tools; an
  MCP server ships in the package. → [Agent tools](docs/agents.md)
- **Unattended delivery.** `specgate harness run` hands each pending requirement
  to your coding agent in its own git worktree and keeps only what passes the
  gate. → [The harness](docs/harness.md)
- **Quality, not only tests.** Coverage and mutation of the lines a change adds,
  SpotBugs, PMD, Semgrep, secrets, dependencies, SonarQube and Conventional
  Commits — each in Docker, no account, only new findings fail.
  → [Quality and security checks](docs/quality.md)
- **Without the commands.** `specgate studio` is the whole path as an app: from
  an empty folder to the report of what was built. → [The studio](docs/studio.md)
- **Domain knowledge as a dependency.** Versioned domain packs install
  requirements a team has already proved. → [Domain packs](docs/domain-packs.md)
- **Already on OpenSpec?** `specgate verify` checks what OpenSpec calls done
  against your tests. → [Already on OpenSpec](docs/openspec.md)

## 🆚 How it compares

Specgate does each of the things below. What the closest alternatives cover:

| Capability                    | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | [spec-kit](https://github.com/github/spec-kit) | [Cursor rules](https://docs.cursor.com/context/rules-for-ai) |
| ----------------------------- | :------------------------------------------------: | :--------------------------------------------: | :----------------------------------------------------------: |
| Change lifecycle              |                         ✅                         |                       ❌                       |                              ❌                              |
| Traceability matrix + CI gate |                         ❌                         |                       ⚠️                       |                              ❌                              |
| Draft checked against a brief |                         ❌                         |                       ⚠️                       |                              ❌                              |
| Work from Jira tickets        |                         ❌                         |                       ❌                       |                              ❌                              |
| Versioned domain packs        |                         ❌                         |                       ⚠️                       |                              ❌                              |
| Vendor-neutral                |                         ✅                         |                       ✅                       |                              ❌                              |

OpenSpec is the closest tool: if you want the change loop without an enforced
gate, it fits better. → [Full comparison](docs/comparisons.md)

## 📚 Documentation

- [Getting started](docs/getting-started.md) — install, pick your path, the four verbs
- [From a Jira ticket](docs/from-a-ticket.md) · [From a client brief](docs/from-a-brief.md)
- [Concepts](docs/concepts.md) — the ideas and vocabulary behind every command
- [Commands](docs/commands.md) — every command and flag
- [FAQ](docs/faq.md) · [Troubleshooting](docs/troubleshooting.md) · [Docs site](https://rsaglobaltech.github.io/specgate/)

## 🧰 Companion tools

[Language server](packages/lsp-spec-driven) · [VS Code extension](packages/vscode-spec-driven) · [Maven](packages/maven-plugin) and
[Gradle](packages/gradle-plugin) plugins for builds without Node · Docker image `ghcr.io/rsaglobaltech/specgate`

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) · [MAINTAINERS.md](MAINTAINERS.md) ·
[SECURITY.md](SECURITY.md) for private reports.

## 📄 License

MIT © RSA Global Tech
