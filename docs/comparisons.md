# Comparison: `specgate` vs. alternatives

This document positions `specgate` honestly against the tools
teams commonly evaluate when adopting Spec-Driven Development or AI-assisted
scaffolding: **OpenSpec**, GitHub `spec-kit`, Cursor rules, Aider conventions,
and plain `README.md` files.

OpenSpec is the closest comparison and the one worth reading first — it is the
best current exponent of the change-lifecycle idea, and several things in this
tool exist because of it.

> **Bias disclosure.** This is written by the maintainers of
> `specgate`. Where we lose, we say so. We have asked the
> maintainers of each compared tool for review; their feedback (if received)
> is referenced in footnotes.

---

## 1. At-a-glance matrix

| Capability | `specgate` | **OpenSpec** | GitHub `spec-kit` | Cursor `.cursorrules` | Aider `CONVENTIONS.md` | Plain `README.md` |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **Generates an initial repo structure** | ✅ | ⚠️ minimal | ✅ | ❌ | ❌ | ❌ |
| **Ships with a domain pack format** | ✅ (YAML+schema) | ❌ | ⚠️ ad-hoc | ❌ | ❌ | ❌ |
| **DDD-lite artefacts (aggregates, contexts, events)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Gherkin scenario stubs** | ✅ | ⚠️ prose scenarios | ⚠️ via templates | ❌ | ❌ | ❌ |
| **Traceability matrix** | ✅ rich + legacy | ❌ | ⚠️ basic | ❌ | ❌ | ❌ |
| **`validate` CI gate** | ✅ shipped GHA | ✅ | ⚠️ external | ❌ | ❌ | ❌ |
| **JSON Schema for the DSL** | ✅ draft 2020-12 | n/a (plain markdown) | ❌ | ❌ | ❌ | n/a |
| **VS Code extension** | ⚠️ built, not on the Marketplace | ❌ | ❌ | n/a (own editor) | ❌ | ❌ |
| **MCP server** | ✅ shipped | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Language server (LSP)** | ✅ shipped | ❌ | ❌ | n/a (own editor) | ❌ | ❌ |
| **Change lifecycle (propose → review → archive)** | ✅ shipped | ✅ **their idea first** | ❌ | ❌ | ❌ | ❌ |
| **Versioned, installable packs (`specops`)** | ✅ shipped | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cross-platform CLI (Windows/Linux/macOS)** | ✅ Node | ✅ Node | ⚠️ Bash-heavy | ✅ | ✅ | ✅ |
| **Locked-in to one AI vendor** | ❌ | ❌ | ❌ | ✅ Cursor | ❌ | ❌ |
| **Discoverable pack registry** | ⚠️ generator ships, not yet hosted | n/a | ❌ | ❌ | ❌ | n/a |
| **Zero-install (just docs)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Agent JSON contract, documented and tested** | ✅ generated from source | ✅ hand-written | ❌ | ❌ | ❌ | ❌ |
| **Slash commands for agent tools** | ✅ 8 tools | ✅ | ❌ | n/a | ❌ | ❌ |
| **Configurable artefact graph** | ✅ `specgate schema` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Multi-repo spec sharing** | ✅ private packs | ⚠️ Stores | ❌ | ❌ | ❌ | ❌ |
| **Time to first value** | ✅ **< 1s CLI, measured**[^ttfv] | ✅ minutes | ✅ minutes | ✅ instant | ✅ instant | ✅ instant |

✅ supported · ⚠️ partial / via workaround · ❌ not supported · 🚧 in progress

[^ttfv]: Measured 2026-08-26 on a fresh two-file Java repo:
    `adopt` + first `validate .` — 0.23s combined, green on the first try.
    That is the CLI's own overhead, not a claim about how fast a person
    orients themselves; this row used to say "⚠️ minutes" as an unmeasured
    self-rating, and turning it into a number was overdue. The honest
    limitation: the columns for OpenSpec and `spec-kit` are not independently
    timed here, so this is our own number next to their own stated claims, not
    an apples-to-apples benchmark. What the CLI *cannot* make instant, in any
    of the compared tools: writing the first real Gherkin scenario and test is
    human time regardless of tooling.

---

## 2. When each tool wins

### `specgate` wins when…

- Your team needs **explicit traceability** between requirements, scenarios,
  and code (regulated industries, audited deliveries).
- You want a **DDD-lite domain model** in machine-readable form so AI agents
  and humans share the same vocabulary.
- You operate **multiple environments** (dev/feature/prod) and want generated
  Docker / devcontainer / `.env` scaffolding aligned with the domain.
- You want a **portable, vendor-neutral** workflow that works with Claude,
  Cursor, Aider, Copilot, or no agent at all.

### OpenSpec wins when…

- You want the **change lifecycle and nothing else**. OpenSpec is smaller, and
  smaller is a feature: fewer concepts to teach, less to get wrong.
- Your specs are **prose, not a domain model**. If aggregates, commands and
  events would be ceremony for your team, our DDD-lite artefacts are cost
  without benefit.
- You want **plain markdown with no schema**. Our `pack.yaml` buys reuse and
  validation; it also buys a format to learn.
- You are **starting today and want the shortest path** to a working loop.

We took the delta format, the `ADDED`/`MODIFIED`/`REMOVED` grammar and the
idea of an audited agent contract from their design. Where we differ is
deliberate: they optimise for the change loop, we add versioned domain packs
(`specops`) and a traceability matrix that CI enforces. If you do not need
those two things, their smaller surface is the better tool.

> Their contract documents a set of known inconsistencies — snake_case in one
> command family and camelCase in another. We had the advantage of reading that
> before writing ours, and picked one. We are not cleverer; we were later.

### GitHub `spec-kit` wins when…

- You're already deep in the GitHub ecosystem and want first-party tooling
  with deeper repo integration (issues, PRs, projects).
- You only need lightweight templates without DDD vocabulary.
- You prefer Microsoft/GitHub to govern the spec format directly.

> `spec-kit` is fast-moving; some gaps above will close. Recheck quarterly.

### Cursor `.cursorrules` wins when…

- Cursor is your **only** AI coding tool and your team has standardised on it.
- You want rules that bias the model's behaviour without changing the repo
  layout or tests.

> Locks you into Cursor; not portable to other agents or to plain
> command-line workflows.

### Aider `CONVENTIONS.md` wins when…

- You work primarily from the terminal with Aider and want a single,
  human-readable file the agent reads on every prompt.
- Your team is small (1–3 engineers) and the overhead of formal traceability
  isn't justified.

> No structural enforcement — conventions drift over time without CI gates.

### Plain `README.md` wins when…

- The project is a **prototype or research spike** that may not survive the
  quarter.
- You're solo and the cost of any tooling exceeds the cost of forgetting.

> Fine for week-1. Doesn't scale past week-12.

---

## 3. When `specgate` loses

These are the honest trade-offs. We'd rather you choose a different tool than
adopt ours and regret it.

| Scenario | What hurts | Recommendation |
|---|---|---|
| **Solo developer, 1-week throwaway** | Setup overhead exceeds the project lifespan | Use a `README.md` + Gherkin in a single file |
| **Cursor-only team, no portability concern** | Our CLI duplicates what `.cursorrules` already does for them | Stick with Cursor rules |
| **Already on GitHub `spec-kit` for 6+ months** | Switching cost > marginal feature gap | Wait for `spec-kit` to add DDD/JSON-Schema; we'll re-publish this page |
| **Front-end-only project with no domain logic** | DDD vocabulary feels heavy | Use `--type frontend` (lighter) but consider plain templates |
| **Highly conservative shop, no Node.js allowed** | We require Node ≥ 22 at runtime | Run the published Docker image, or the Maven / Gradle plugin, which launch the CLI for you |
| **You hate YAML** | Pack format is YAML | We won't ship JSON/TOML packs in 0.x; revisit in 1.0 |

---

## 4. Migration paths

### From OpenSpec → `specgate`

The delta format is deliberately the same, so the specs come across as-is.

1. `specgate init` in the repo — it adopts it and never overwrites an existing file.
2. Move `openspec/changes/<id>/` to `docs/specs/changes/<id>/` and add a
   `change.yaml` (`specgate change new <id>` writes one to copy).
3. Move `openspec/specs/<capability>/spec.md` to
   `docs/specs/capabilities/<capability>/spec.md`.
4. `specgate change validate` — the `ADDED`/`MODIFIED`/`REMOVED` grammar is
   compatible; what it will flag is missing RFC-2119 keywords and scenario
   steps that are prose rather than `- GIVEN` bullets.
5. Optionally add `<!-- csda:trace uc=… cmd=… -->` comments where you want
   requirements to reach the traceability matrix. Without them a requirement
   still archives, with `-` in those columns.

**Do not migrate** if what you valued was the smaller surface. Steps 4 and 5
are the tax for the matrix and the CI gate; if you do not want those, you do
not want this tool.

### From `spec-kit` → `specgate`

1. Run `npx @rsaglobaltech/specgate init --config your.config --out ./next`.
2. Copy your existing `spec-kit` artefacts into the generated `docs/specs/`.
3. Run `validate` — it will tell you what's missing in the traceability matrix.
4. Keep `spec-kit` running for 1 release cycle as a parallel checker.

### From `.cursorrules` → `specgate`

1. Generate a project with `specgate init`.
2. Move your Cursor rules into `AGENTS.md` and `AI_RULES.md` (we generate both).
3. Reference the generated traceability matrix from your rules so Cursor
   reads them on every prompt.

### From plain `README.md` → `specgate`

1. Generate a project as above.
2. Copy the existing README into `docs/specs/glossary.md`.
3. Run `pack init` to scaffold a domain pack from your existing module list.

---

## 5. Questions worth asking before you choose

1. **Will my team use this in 12 months?** — Tools that require discipline die.
   Tools that have a CI gate survive.
2. **Does my AI agent of choice exist in 12 months?** — Vendor lock-in is
   expensive when the vendor pivots or shuts down.
3. **Do I care about audit trails?** — If yes, traceability matrix and
   schema-validated specs are non-negotiable.
4. **Do I need cross-team consistency?** — If yes, a versioned pack format
   beats prose conventions.
5. **What's the cost of being wrong?** — All four alternatives are reversible
   in <1 day; choose the one that lets you experiment cheapest.

---

## 6. References

- [Case Study 1: Smart Parking brownfield adoption](case-studies/case-1.md)
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) (last reviewed 2026-08) — the benchmark that shaped this tool's change lifecycle; the full analysis is in [`mejoras/openspec-benchmark-plan.md`](../mejoras/openspec-benchmark-plan.md)
- [GitHub spec-kit](https://github.com/github/spec-kit) (last reviewed 2026-05)
- [Cursor `.cursorrules` documentation](https://docs.cursor.com/context/rules-for-ai)
- [Aider CONVENTIONS.md guide](https://aider.chat/docs/usage/conventions.html)

Our own column was last verified against the shipped CLI on **2026-08-16**,
and the "Time to first value" row re-measured on **2026-08-26** (see the footnote).
OpenSpec was reviewed **2026-08**; the other columns **2026-05**.
Pull requests with corrections are welcome — see
[CONTRIBUTING.md](../CONTRIBUTING.md).
