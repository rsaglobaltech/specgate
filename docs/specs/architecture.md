<!-- specgate:allow-placeholders — this file documents the {{VAR}} template syntax. -->
# 🏛️ Architecture — the full spec-driven delivery flow

This page is the **single source of truth** for how the tool, the domain
pack and an implementation project fit together, and where in that picture
the harness, opencode/Claude, and the human reviewer live.

> Companion docs: [`tutorial.md`](../tutorial.md) is the step-by-step
> walkthrough; [Build the first requirement](../start/scratch-3-build.md)
> covers wiring the project with its first scenario; [`harness.md`](./harness.md),
> [`specops.md`](./specops.md) and
> [`domain-pack-format.md`](./domain-pack-format.md) drill into individual
> subsystems.

---

## 1. The three repos

```text
                                          ┌──────────────────────────────────┐
                                          │   specgate (TOOL)  │
                                          │   npm package · CLI binary       │
                                          │   commands: init, specops,       │
                                          │   pack, plan, done, validate,    │
                                          │   harness                        │
                                          └─────────────┬────────────────────┘
                                                        │ uses
       ┌─────────────────────────────────┐              │              ┌────────────────────────────────────┐
       │  DOMAIN PACK REPO               │              │              │  IMPLEMENTATION PROJECT REPO       │
       │  parking-management-specops/    │              │              │  smart-parking-spring/             │
       │                                 │              │              │                                    │
       │  pack.yaml                      │              │              │  spec.md           ◄─ rendered     │
       │  templates/                     │              │              │  AI_RULES.md       ◄─ rendered     │
       │    AI_RULES.md.tpl              │              │              │  features/**/*.feature ◄─ rendered │
       │    spec.md.tpl                  │   specgate       │   specgate       │  docs/specs/                       │
       │    features/**/*.feature.tpl    ├──pack lint──►│◄─specops add │  pom.xml | build.gradle | …        │
       │                                 │   --graph    │   --pack-repo│  src/main, src/test                │
       │  git tags: v0.1.0, v0.2.0 …     │   --strict   │   --version  │  .specops.lock  ── points back     │
       │                                 │   pack infer │   --var …    │  .specops/baseline/  (merge base)  │
       │  AUTHORED by domain experts     │              │              │  .specops/harness-prompts/ (audit) │
       │  Stack-agnostic                 │              │  specgate        │  harness.config.yaml               │
       │                                 │              │  specops sync│                                    │
       │                                 │              │  --pack-vers │  IMPLEMENTED by humans + agents    │
       │                                 │              │              │  ONE per stack (Spring / Quarkus / │
       └─────────────────────────────────┘              │              │   Micronaut / Node / Quarkus / …)  │
                                                        │              │                                    │
                                                        │              │  Iteration loop:                   │
                                                        │              │  ┌──────────────────────────────┐  │
                                                        │              │  │  specgate harness run --req REQ  │  │
                                                        │              │  │                              │  │
                                                        │              │  │  ┌────────────────────────┐  │  │
                                                        │              │  │  │ git worktree           │  │  │
                                                        │              │  │  │ harness/REQ-NNN        │  │  │
                                                        │              │  │  │                        │  │  │
                                                        │              │  │  │  prompt = prefix +     │  │  │
                                                        │              │  │  │   facts + Gherkin +    │  │  │
                                                        │              │  │  │   AI_RULES + DoD       │  │  │
                                                        │              │  │  │                        │  │  │
                                                        │              │  │  │      ▼                 │  │  │
                                                        │              │  │  │  opencode / claude /   │  │  │
                                                        │              │  │  │  aider / stub agent    │  │  │
                                                        │              │  │  │      │ writes code     │  │  │
                                                        │              │  │  │      ▼                 │  │  │
                                                        │              │  │  │  src/, test/           │  │  │
                                                        │              │  │  │      │                 │  │  │
                                                        │              │  │  │      ▼ GATE            │  │  │
                                                        │              │  │  │  validate --strict-tdd │  │  │
                                                        │              │  │  │  + test_cmd            │  │  │
                                                        │              │  │  │      │                 │  │  │
                                                        │              │  │  │  green: done + commit  │  │  │
                                                        │              │  │  │  red:   retry w/ fail  │  │  │
                                                        │              │  │  └────────────────────────┘  │  │
                                                        │              │  └──────────────────────────────┘  │
                                                        │              │                                    │
                                                        │              │  Human reviews harness/REQ-*       │
                                                        │              │  branches and merges to main.      │
                                                        │              └────────────────────────────────────┘
                                                        │
                                                        ▼
                                          ┌──────────────────────────────────┐
                                          │  Companion tools                 │
                                          │  - vscode-spec-driven extension  │
                                          │     · pack.yaml schema squigglies│
                                          │     · dangling-ref autocomplete  │
                                          │     · "Show Pack Graph" webview  │
                                          │  - mcp-spec-driven server        │
                                          │     · plan / done / lint_pack    │
                                          │       as MCP tools for Claude    │
                                          │       Desktop, Cursor, opencode  │
                                          └──────────────────────────────────┘
```

Three lifecycles, three responsibilities.

| Piece              | Changes when…                                            | Owner            |
| ------------------ | -------------------------------------------------------- | ---------------- |
| **Tool**           | the CLI gains features / fixes                           | tool maintainers |
| **Pack**           | the domain evolves (new requirements, scenarios, events) | domain experts   |
| **Implementation** | features are built / bugs are fixed                      | the product team |

---

## 2. Per-project chronology

Read top-to-bottom — every step is a real command somebody runs.

```text
Day 1 (human)            ┌──► specgate init  (scaffold from project.yaml)
                         │
Day 1 (human)            ├──► specgate specops add  (pulls pack, renders specs)
                         │
Day 1 (human + AI)       ├──► Bootstrap prompt → opencode / Claude
                         │     PHASE 1: build files, BDD wired, hex skeleton,
                         │     first bounded context green
                         │
                         ├──► git commit "phase 1 complete"
                         │
Day N (AI via harness)   ├──► specgate harness prompt REQ-001   (preview)
                         ├──► specgate harness run    --req REQ-001
                         │       └─ worktree, prompt(prefix+facts+Gherkin+AI_RULES),
                         │          agent writes code, gate, done, commit on
                         │          harness/REQ-001
                         │
                         ├──► human reviews + merges harness/REQ-001
                         │
                         ├──► specgate harness run --req REQ-002
                         │   …
                         │
Pack v0.2.0 ships        ├──► specgate specops diff --pack-version v0.2.0
                         ├──► specgate specops sync --pack-version v0.2.0
                         │   …
                         └──► continues
```

The line `Bootstrap prompt → opencode / Claude` is the **only**
freeform-AI step. Everything that follows is the harness driving the same
loop, deterministically, one requirement at a time.

---

## 3. Responsibility layers

| Layer                                   | Who                                           | Cadence                             | Output                                              |
| --------------------------------------- | --------------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| **Pack authoring**                      | domain expert + tech lead                     | once, then per new business feature | `pack.yaml` versioned, git-tagged                   |
| **Project bootstrap (Phase 1)**         | human + AI via the bootstrap prompt           | once per _(project, stack)_         | build manifest + hex skeleton + first context green |
| **Per-REQ implementation (Phase 2..N)** | AI agent via the harness                      | iterative, one REQ per worktree     | branch `harness/REQ-NNN` with code + test           |
| **Review & merge**                      | human                                         | iterative                           | `main` advances with verified code                  |
| **Pack version bumps**                  | pack maintainer publishes; each project syncs | when a new tag ships                | `specops sync` three-way-merges the delta           |

> **The harness never operates on a pack repo, only on implementation
> projects.** Pack authoring is a separate flow (`pack init` / `pack lint`
> / `pack lint --graph` / `pack infer`) run inside the pack repo.

---

## 4. What the harness prompt actually contains

Every per-REQ prompt the harness hands the agent is assembled in this
order — top to bottom — by [`scripts/harness/prompt.ts`](../../scripts/harness/prompt.ts):

```text
┌────────────────────────────────────────────────────────────────────┐
│  promptPrefix          (from harness.config.yaml: prompt_prefix or │
│                         prompt_prefix_file — your universal Role / │
│                         Active Project Boundary / Execution Policy)│
├────────────────────────────────────────────────────────────────────┤
│  ---                                                                │
├────────────────────────────────────────────────────────────────────┤
│  # Implement REQ-NNN                                                │
│  ## Requirement facts                                               │
│    feature_file · test_artifact · technical_artifact · status …    │
│  ## Suggested approach        (hint from `specgate plan`)              │
│  ## Gherkin scenario          (inlined from features/…feature)     │
│  ## Project rules             (AI_RULES.md inlined verbatim)       │
│  ## Definition of done                                              │
│    - write the test first                                           │
│    - then the production code                                       │
│    - DO NOT modify spec.md / AI_RULES.md / features/**.feature      │
│    - DO NOT edit docs/specs/traceability.md (harness handles it)    │
│    - validate --strict-tdd + the project test command must pass    │
│  ## Previous attempt failed   (only on retries, with the gate log)  │
└────────────────────────────────────────────────────────────────────┘
```

`specgate harness prompt REQ-NNN` prints exactly that text to stdout — no git,
no agent invocation, no gate. Use it to inspect what an agent receives.
Every prompt the harness actually sends during `harness run` is also
mirrored to `.specops/harness-prompts/REQ-NNN-<timestamp>-attempt-N.md`
for audit.

---

## 5. Multi-stack: one pack, many implementations

The pack/implementation split lets you ship the **same domain spec** in
multiple stacks without duplicating requirements or scenarios:

```text
parking-management-specops@v0.1.0      ◄── one spec, stack-agnostic
        ├──► smart-parking-spring/      (STACK=Spring Boot, JUnit+Cucumber)
        ├──► smart-parking-quarkus/     (STACK=Quarkus,     JUnit+Cucumber)
        └──► smart-parking-micronaut/   (STACK=Micronaut,   JUnit+Cucumber)
```

Each implementation is its own repo, with its own `specgate init` (different
`STACK`), its own `specgate specops add` (same pack + version + domain vars),
its own bootstrap prompt run, and its own harness loop. The pack's
`spec.md`, `features/**` and traceability matrix are **identical** across
all three; `AI_RULES.md` differs because its `{{STACK}}` substitution does.

**For this to work cleanly, packs must be stack-neutral.** No Java/Spring
code in `spec.md.tpl` or `features/**.feature.tpl`. Only the
`AI_RULES.md.tpl` is allowed to reference `{{STACK}}` / `{{TESTING}}`.
`pack lint --strict` catches scenario-quality issues that would otherwise
manifest as stack-specific debt later.

Useful patterns:

- Reference implementations across frameworks for tech-lead comparisons.
- Migration POCs (run two stacks side by side, retire one).
- Educational material ("same problem, three stacks").

---

## 6. Boundaries the architecture enforces

- **The pack is read-only from the project's perspective.** `specops add`
  / `sync` only ever _read_ the pack. The pack's git history is the audit
  trail for domain decisions.
- **The implementation project is the only thing the harness writes to.**
  Worktrees live under `$TMPDIR`, but branches and commits land in the
  project's own git repo.
- **`spec.md`, `AI_RULES.md`, `features/**`** are the agent's
source of truth — explicitly **immutable** for the agent. The harness
prompt says so; `specops sync` is the only legitimate path to change
  them (and even then, three-way merges preserve local edits).
- **`docs/specs/traceability.md`** is the matrix; `specgate done` owns it.
  Agents must not hand-edit it.
- **`.specops.lock`** records which pack and version the project consumes
  and the `--var` values used. Commit it.
- **`.specops/baseline/`** is the merge base for `specops sync`. Commit it.
- **`.specops/harness-prompts/`** is the audit log for what was sent to
  the agent on each attempt. Commit or gitignore — your call.
