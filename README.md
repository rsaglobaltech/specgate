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

> **The npm package is scoped; the binary is not.** `spec-gate` already claims the
> unscoped name ([ADR-0024](docs/specs/adr/0024-the-tool-is-renamed-the-format-is-not.md)). You type `specgate`; `csda` still works too.

```bash
npm i -g @rsaglobaltech/specgate   # or prefix every command with npx @rsaglobaltech/specgate@latest

cd your-repo                       # or an empty directory
specgate init                      # adopts the code that is there, touching none of it;
                                   # scaffolds a new project where there is none
specgate ci init                   # the gate as a CI job — GitHub, GitLab, Azure or Jenkins,
                                   # detected from the repository
specgate check                     # the gate, locally
```

Requires **Node.js ≥ 22** — or none at all with the Docker image:

```bash
docker run --rm -v "$PWD:/workspace" ghcr.io/rsaglobaltech/specgate check
```

→ [Getting started](docs/getting-started.md) · [Your team's first pull request](docs/first-pr.md) · [Quickstart for joiners](docs/quickstart.md)

## 🔁 The daily loop — five commands

```bash
specgate status                                    # what is open, and the next command to run
specgate new "Customers download invoices as PDF"  # requirement + scenario, in one step
# rewrite the scenario's <placeholders>, then write a test that mentions REQ-007:
#   // REQ-007 — a paid invoice downloads as a PDF
specgate done REQ-007                              # runs the gate for it, then marks it Implemented
specgate check                                     # the whole gate — the same one CI runs
```

That is all most of a team ever types. **Mentioning `REQ-NNN` in a test is the
link** — there is nothing else to declare. The traceability matrix is
generated from `spec.md`, the scenario tags and your tests; nobody edits it,
and CI fails when the committed copy is out of date. `done` writes nothing
while the gate fails, so a requirement it closes is one CI will not reopen.

Everything else — packs, changes, the harness, ALM sync — is in `specgate --help --all`.

## 🪜 Adopt one level at a time

Each level is useful on its own and never requires the ones above it.

| Level | You get | Commands | Cost |
| --- | --- | --- | --- |
| **L1** | Traceable specs in your repo | `init`, `new`, `done` | ~1 hour |
| **L2** | A PR gate enforcing spec and test coverage | `check`, `ci init` | ~1 hour |
| **L3** | Versioned, reusable domain requirements | `specops add / sync / diff` | ~1 day |
| **L4** | Agent-driven delivery, one requirement at a time | `agents init`, `harness run` | ~1 week |

## 🛠️ What it does

**A gate that does not lie.** `specgate check` fails when a delivered
requirement has no scenario, template steps, no test that mentions it, or
points at a file that is gone. A Draft owes nothing yet: green on day one,
stricter with every delivery. Given a test command, it runs your suite too.
→ [Writing specs](docs/writing-specs.md) · [Validating](docs/validating.md) · [Command reference](docs/commands.md)

**Reviews that read intent.** The reviewer reads the requirement, its
scenario and the test that names it — the gate has already proved the
mechanical part. A spec that already shipped changes through a reviewable
delta: only what moves, never a copy. Archiving merges it into the spec tree
and writes the feature files, so a merged proposal cannot quietly become
undone work.
→ [Your team's first pull request](docs/first-pr.md) · [Reviewing changes](docs/reviewing-changes.md)

**From a client's brief.** Keep the brief in the repository and draft one
module at a time as a change. `specgate draft --check` holds the draft to ten
rules: a scenario per requirement and per surface each actor uses, measured
non-functional requirements, a source for every cited law, every value either
in the brief or listed as an assumption, every open question blocking what it
blocks. Specs can be written in Spanish (`DADO / CUANDO / ENTONCES`).
→ [From a client brief](docs/from-a-brief.md)

**Already on OpenSpec?** Keep it. `specgate verify` reads `openspec/` in place
and fails while an archived change claims a scenario no test names — so
"done" means proved. As a GitHub Action and an MCP tool too.
→ [Already on OpenSpec](docs/openspec.md)

**Your agent works the same loop.** `specgate agents init` gives Claude Code,
Cursor, Copilot, Windsurf, Aider, Gemini, Cline, Codex or Antigravity the five
steps as slash commands (`/specgate:new`, `/specgate:done`, …) from one
definition. Every daily command speaks JSON with stable codes and a `fix` on
each. The MCP server ships in the package: `specgate mcp install --client claude`.
→ [Agents](docs/agents.md) · [The agent contract](docs/specs/agent-contract.md) · [Automation and MCP](docs/automation.md)

**Domain knowledge as a dependency.** A pack is a versioned, schema-validated
domain model. Install it, pin it, upgrade it deliberately — and review the
upgrade as intent with `specops diff --as-change`, not as a file diff.
→ [Domain packs](docs/domain-packs.md) · [Supply chain](docs/supply-chain.md)

**Unattended delivery.** `specgate harness run` drives plan → agent → verify →
done for every pending requirement, each in its own git worktree; it never
merges. The agent is any shell command with `{prompt_file}` — no runtime or SDK.
It does not spend attempts where retrying cannot help (quota, a failure in the
spec, an open question), stops an agent that runs out of time, and gates on
the build as well as the tests.
`specgate alm sync` keeps Jira, Azure Boards or GitHub Issues in step.
→ [The harness](docs/harness.md) · [Jira, Azure Boards and GitHub Issues](docs/alm.md)

**Tested as you install it.** Every release runs an end-to-end suite over every
command, against the packed tarball, on Linux, macOS and Windows — and every
release since 0.14 came out of building real products with it, from a client's
brief to a running application, with each defect found logged and fixed.

## 🆚 How it compares

| Capability | **this** | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | [spec-kit](https://github.com/github/spec-kit) | [Cursor rules](https://docs.cursor.com/context/rules-for-ai) | README only |
| --- | :-: | :-: | :-: | :-: | :-: |
| Change lifecycle | ✅ | ✅ | ❌ | ❌ | ❌ |
| Versioned domain packs | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| Traceability matrix + CI gate | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| Agent JSON contract | ✅ | ✅ | ❌ | ❌ | ❌ |
| Draft checklist from a brief | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| Proves OpenSpec's "done" against tests | ✅ `verify` | ❌ | ❌ | ❌ | ❌ |
| Vendor-neutral | ✅ | ✅ | ✅ | ❌ | ✅ |
| Smaller surface to learn | ⚠️ five daily commands | ✅ | ✅ | ✅ | ✅ |

OpenSpec is the closest tool and the honest comparison: if you want the change
loop without versioned packs or an enforced matrix, theirs is the better fit.
→ [Full matrix, trade-offs and migration paths](docs/comparisons.md)

## 📚 Documentation

- [Getting started](docs/getting-started.md) · [Your team's first pull request](docs/first-pr.md) · [Command reference](docs/commands.md)
- [From a client brief](docs/from-a-brief.md) · [Already on OpenSpec](docs/openspec.md) · [The harness](docs/harness.md)
- [How-to guides](docs/how-to.md) · [Tutorial](docs/tutorial.md) · [Supply chain](docs/supply-chain.md) · [Architecture](docs/specs/architecture.md)
- [Case study](docs/case-studies/case-1.md) · [ADRs](docs/specs/adr/README.md) · [Docs site](https://rsaglobaltech.github.io/specgate/) · [Spec coverage report](https://rsaglobaltech.github.io/specgate/report.html)

## 🧰 Companion tools

[Language server](packages/lsp-spec-driven) · [VS Code extension](packages/vscode-spec-driven) ·
[Maven](packages/maven-plugin) and [Gradle](packages/gradle-plugin) plugins for builds
without Node · Docker image `ghcr.io/rsaglobaltech/specgate`

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Good first contributions:
new module templates, validator rules, additional domain packs.
[MAINTAINERS.md](MAINTAINERS.md) says who owns what;
[SECURITY.md](SECURITY.md) is how to report a vulnerability privately.

## 📄 License

MIT © RSA Global Tech
