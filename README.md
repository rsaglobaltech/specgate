<div align="center">

# ⬡ Specgate

**Specs as executable contracts — requirements, scenarios and traceability that CI enforces.**

[![CI](https://github.com/rsaglobaltech/specgate/actions/workflows/ci.yml/badge.svg)](https://github.com/rsaglobaltech/specgate/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40rsaglobaltech%2Fspecgate?logo=npm&label=npm)](https://www.npmjs.com/package/@rsaglobaltech/specgate)
[![Docker](https://img.shields.io/badge/ghcr.io-specgate-2496ed?logo=docker&logoColor=white)](https://github.com/rsaglobaltech/specgate/pkgs/container/specgate)
[![Docs](https://img.shields.io/badge/docs-github_pages-0e8078)](https://rsaglobaltech.github.io/specgate/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#-license)

</div>

> Stop coding before requirements are operationally clear. Every requirement
> maps to a scenario, a domain artefact, an implementation and a test — and the
> gate fails when one is missing.

---

## ⚡ Start

```bash
npm i -g @rsaglobaltech/specgate   # or prefix every command with npx @rsaglobaltech/specgate@latest

cd your-repo                       # or an empty directory
specgate init                      # adopts the code that is there, touching none of it;
                                   # scaffolds a new project where there is none
specgate ci init                   # the gate as a CI job — GitHub, GitLab, Azure or Jenkins,
                                   # detected from the repository
specgate check                     # the gate, locally
```

Requires **Node.js ≥ 22** — or none with Docker: `docker run --rm -v "$PWD:/workspace" ghcr.io/rsaglobaltech/specgate check`.
The package is scoped, the binary is not ([ADR-0024](docs/specs/adr/0024-the-tool-is-renamed-the-format-is-not.md)).

→ [Getting started](docs/getting-started.md) · [Your team's first pull request](docs/first-pr.md) · [Quickstart for joiners](docs/quickstart.md)

## 🔁 The daily loop — four verbs

```bash
specgate propose add-pdf-invoices   # a change: proposal, tasks, a delta to write, REQ ids reserved
# write REQ-007 and its scenario in the delta, a test that mentions REQ-007, the code
specgate apply                      # the next requirement through the gate: Implemented when green
specgate status                     # what is open, and the next command to run
specgate archive add-pdf-invoices   # once every requirement in it is Implemented
```

`specgate check` is the same gate for CI ([ADR-0035](docs/specs/adr/0035-four-verbs-one-lifecycle.md)).
**A change is archived when its code is done**: while it is open its
requirements already count — `status` lists them, `apply` and `check` judge the
project as it will be after archive — and `archive` refuses one still pending.
`apply` refuses a requirement no test names and writes nothing while the gate
fails. **Mentioning `REQ-NNN` in a test is the link**; the matrix is generated.
From a plan: `specgate propose --from-brief`. Old names (`draft`, `done`…) keep
working; everything else is in `specgate --help --all`.

## 🪜 Adopt one level at a time

Each level is useful on its own and never requires the ones above it.

| Level  | You get                                          | Commands                     | Cost    |
| ------ | ------------------------------------------------ | ---------------------------- | ------- |
| **L1** | Traceable specs in your repo                     | `init`, `propose`, `apply`, `archive` | ~1 hour |
| **L2** | A PR gate enforcing spec and test coverage       | `check`, `ci init`           | ~1 hour |
| **L3** | Versioned, reusable domain requirements          | `specops add / sync / diff`  | ~1 day  |
| **L4** | Agent-driven delivery, one requirement at a time | `agents init`, `harness run` | ~1 week |

## 🛠️ What it does

**A gate that does not lie.** `specgate check` fails when a delivered
requirement has no scenario, template steps, no test that mentions it, or
points at a file that is gone. A Draft owes nothing yet: green on day one,
stricter with every delivery. Given a test command, it runs your suite too.
→ [Writing specs](docs/writing-specs.md) · [Validating](docs/validating.md) · [Command reference](docs/commands.md)

**Reviews that read intent.** The reviewer reads the requirement, its
scenario and the test that names it — the gate has already proved the
mechanical part. A change is a reviewable delta: only what moves, never a
copy. It is archived — merged into the spec tree, with its feature files —
only once every requirement in it passed the gate, in the same pull request.
→ [Your team's first pull request](docs/first-pr.md) · [Reviewing changes](docs/reviewing-changes.md)

**From a brief, or from OpenSpec.** Save your plan as `docs/brief.md`, run
`specgate propose --from-brief`: module by module, it briefs your agent and holds
the draft to eleven rules — scenarios per actor and surface, sourced laws, every
value in the brief or listed as an assumption, open questions that block, ids each
actor can reach. Teams on OpenSpec keep it: `specgate verify` fails while
a change claims a scenario no test names.
→ [A new project, step by step](docs/new-project.md) · [From a client brief](docs/from-a-brief.md) · [Already on OpenSpec](docs/openspec.md)

**Your agent works the same loop.** `specgate agents init` gives Claude Code, Cursor,
Copilot, Windsurf, Aider, Gemini, Cline, Codex or Antigravity the loop as slash commands
(`/specgate:propose`, `/specgate:apply`, …) from one definition. Every daily command speaks
JSON with stable codes and a `fix` on each. MCP ships in the package: `specgate mcp install --client claude`.
→ [Agents](docs/agents.md) · [The agent contract](docs/specs/agent-contract.md) · [Automation and MCP](docs/automation.md)

**Domain knowledge as a dependency.** A pack is a versioned, schema-validated
domain model. Install it, pin it, upgrade it deliberately — and review the
upgrade as intent with `specops diff --as-change`, not as a file diff.
→ [Domain packs: 7 proven in the pilots, 11 starter examples](docs/domain-packs.md) · [Supply chain](docs/supply-chain.md)

**Unattended delivery.** `specgate harness run` drives plan → agent → verify →
apply for every pending requirement, each in its own git worktree; it merges only
with `--chain`, only what passed the gate. The agent is any shell command with
`{prompt_file}`; `specgate studio` shows it at work, at `/live`. `specgate alm sync`
keeps Jira, Azure Boards or GitHub Issues in step.
→ [The harness](docs/harness.md) · [Jira, Azure Boards and GitHub Issues](docs/alm.md)

**Tested as you install it.** Every release runs an end-to-end suite over every
command, against the packed tarball, on Linux, macOS and Windows; releases
since 0.14 come from building real products with it, from brief to running app.

## 🆚 How it compares

| Capability                             |        **this**        | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | [spec-kit](https://github.com/github/spec-kit) | [Cursor rules](https://docs.cursor.com/context/rules-for-ai) | README only |
| -------------------------------------- | :--------------------: | :------------------------------------------------: | :--------------------------------------------: | :----------------------------------------------------------: | :---------: |
| Change lifecycle                       |           ✅           |                         ✅                         |                       ❌                       |                              ❌                              |     ❌      |
| Versioned domain packs                 |           ✅           |                         ❌                         |                       ⚠️                       |                              ❌                              |     ❌      |
| Traceability matrix + CI gate          |           ✅           |                         ❌                         |                       ⚠️                       |                              ❌                              |     ❌      |
| Agent JSON contract                    |           ✅           |                         ✅                         |                       ❌                       |                              ❌                              |     ❌      |
| Draft checklist from a brief           |           ✅           |                         ❌                         |                       ⚠️                       |                              ❌                              |     ❌      |
| Proves OpenSpec's "done" against tests |      ✅ `verify`       |                         ❌                         |                       ❌                       |                              ❌                              |     ❌      |
| Vendor-neutral                         |           ✅           |                         ✅                         |                       ✅                       |                              ❌                              |     ✅      |
| Commands to learn before the first PR  | ✅ 6 (31 more, opt-in) |                         ✅                         |                       ✅                       |                              ✅                              |     ✅      |

OpenSpec is the closest tool: if you want the change loop without packs or an enforced matrix, it fits better.
→ [Full matrix, trade-offs and migration paths](docs/comparisons.md)

## 📚 Documentation

- [Getting started](docs/getting-started.md) · [Your team's first pull request](docs/first-pr.md) · [Command reference](docs/commands.md)
- [How-to guides](docs/how-to.md) · [Tutorial](docs/tutorial.md) · [Supply chain](docs/supply-chain.md) · [Architecture](docs/specs/architecture.md)
- [Case study](docs/case-studies/case-1.md) · [ADRs](docs/specs/adr/README.md) · [Docs site](https://rsaglobaltech.github.io/specgate/) · [Spec coverage report](https://rsaglobaltech.github.io/specgate/report.html)

## 🧰 Companion tools

[Language server](packages/lsp-spec-driven) · [VS Code extension](packages/vscode-spec-driven) · [Maven](packages/maven-plugin) and
[Gradle](packages/gradle-plugin) plugins for builds without Node · Docker image `ghcr.io/rsaglobaltech/specgate`

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) (good first: templates, validator rules,
domain packs) · [MAINTAINERS.md](MAINTAINERS.md) · [SECURITY.md](SECURITY.md) for private reports.

## 📄 License

MIT © RSA Global Tech
