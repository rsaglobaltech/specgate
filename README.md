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
cd your-repo                                  # or an empty directory
npx @rsaglobaltech/specgate@latest init      # adopts code that is there, touching none of it;
                                              # scaffolds a new project where there is none
npx @rsaglobaltech/specgate@latest check     # the gate
```

Requires **Node.js ≥ 22** — or none at all with the Docker image:

```bash
docker run --rm -v "$PWD:/workspace" ghcr.io/rsaglobaltech/specgate validate . --strict
```

→ [Getting started](docs/getting-started.md) · [Quickstart for joiners](docs/quickstart.md)

## 🪜 Adopt one level at a time

Each level is useful on its own and never requires the ones above it.

| Level | You get | Commands | Cost |
| --- | --- | --- | --- |
| **L1** | Traceable specs in your repo | `init`, `new` | ~1 hour |
| **L2** | A PR gate enforcing spec and test coverage | `check`, `ci init` | ~1 hour |
| **L3** | Versioned, reusable domain requirements | `specops add / sync / diff` | ~1 day |
| **L4** | Agent-driven delivery, one requirement at a time | `agents init`, `harness run` | ~1 week |

## 🛠️ What it does

**A daily loop, not a one-shot scaffolder.** `specgate status` lists what is left
and the next command; `specgate new` adds a requirement with its scenario and row;
`specgate check` is the gate before a PR; `specgate done` closes a requirement.
Nobody hand-edits the matrix.
→ [Quickstart](docs/quickstart.md) · [Command reference](docs/commands.md)

**Specs that are checked.** `specgate validate` fails the build when a requirement
has no scenario, no test, or no row in the traceability matrix. `--strict` — the
gate — also fails one past Draft without a test, or linked to a missing file.
→ [Writing specs](docs/writing-specs.md) · [Validating](docs/validating.md)

**Changes you review as intent.** Modify a spec that already shipped through a
reviewable delta — only what moves, never a copy. Archiving merges it into the
spec tree, writes the matrix rows and materialises the feature files, so a
merged proposal cannot quietly become undone work.
→ [Reviewing changes](docs/reviewing-changes.md)

**Domain knowledge as a dependency.** A pack is a versioned, schema-validated
domain model. Install it, pin it, upgrade it deliberately — and review the
upgrade as intent with `specops diff --as-change`, not as a file diff.
→ [Domain packs](docs/domain-packs.md)

**An agent surface that is a contract.** Twelve commands speak JSON with stable
diagnostic codes and a `fix` on each — every command of the daily loop, and a
test asserts it. `specgate agents init` wires the loop into eight agent tools from
one definition.
→ [Agents](docs/agents.md) · [The agent contract](docs/specs/agent-contract.md)

**Unattended delivery.** `specgate harness run` drives plan → agent → verify → done
for every pending requirement, each in its own git worktree. It never merges.
`specgate ci init` generates the gate for GitHub, GitLab, Azure or Jenkins, and
`specgate alm sync` keeps Jira or Azure Boards in step.

**Any agent CLI.** No agent runtime, no SDK dependency: the agent is any shell
command containing `{prompt_file}` — `claude -p < {prompt_file}`, `aider --yes
--message-file {prompt_file}`, or `my-wrapper.sh {prompt_file}` for anything
else. Commit your team's commands in `.harness/profiles.yaml` and pick one by
name.
→ [Automation](docs/automation.md) · [The harness](docs/harness.md) · [Jira and Azure Boards](docs/alm.md)

**It stays current.** `specgate update` refreshes the generated agent files after an
upgrade, three-way merging your edits rather than clobbering them. `specgate doctor`
reports what has drifted, with a fix per finding.
→ [Command reference](docs/commands.md)

## 🆚 How it compares

| Capability | **this** | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | [spec-kit](https://github.com/github/spec-kit) | [Cursor rules](https://docs.cursor.com/context/rules-for-ai) | README only |
| --- | :-: | :-: | :-: | :-: | :-: |
| Change lifecycle | ✅ | ✅ | ❌ | ❌ | ❌ |
| Versioned domain packs | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| Traceability matrix + CI gate | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| Agent JSON contract | ✅ | ✅ | ❌ | ❌ | ❌ |
| Vendor-neutral | ✅ | ✅ | ✅ | ❌ | ✅ |
| Smaller surface to learn | ⚠️ five daily verbs | ✅ | ✅ | ✅ | ✅ |

OpenSpec is the closest tool and the honest comparison: if you want the change
loop without versioned packs or an enforced matrix, theirs is the better fit.
→ [Full matrix, trade-offs and migration paths](docs/comparisons.md)

## 📚 Documentation

- [Command reference](docs/commands.md) — every command, grouped by when you reach for it
- [How-to guides](docs/how-to.md) — by task and by adoption level
- [Tutorial](docs/tutorial.md) — long-form, on a real public pack
- [Supply chain](docs/supply-chain.md) — pack pinning, digests, signing, air-gapped installs, SBOM
- [Architecture](docs/specs/architecture.md) — three repos, three lifecycles
- [Bootstrap prompt](docs/bootstrap-prompt.md) — the one freeform-AI step
- [Case study](docs/case-studies/case-1.md) · [ADRs](docs/specs/adr/README.md) · [Docs site](https://rsaglobaltech.github.io/specgate/) · [Spec coverage report](https://rsaglobaltech.github.io/specgate/report.html)

## 🧰 Companion tools

**MCP server** ([`mcp-spec-driven`](packages/mcp-spec-driven)) · **Language
server** ([`lsp-spec-driven`](packages/lsp-spec-driven)) · **VS Code extension**
([`vscode-spec-driven`](packages/vscode-spec-driven)) · **Maven and Gradle
plugins** for teams that do not want Node on the build agent.

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Good first contributions:
new module templates, validator rules, additional domain packs.
[MAINTAINERS.md](MAINTAINERS.md) says who owns what;
[SECURITY.md](SECURITY.md) is how to report a vulnerability privately.

## 📄 License

MIT © RSA Global Tech
