# Command reference

Every command, grouped by when you reach for it. `specgate --help` shows the eight
of the daily loop; `specgate --help --all` shows this whole surface, and
`specgate config set profile full` makes that the default.

Each command takes `--json`. See [the agent contract](specs/agent-contract.md).

---

## Starting

| Command | What it does |
| --- | --- |
| `specgate init` | **Start here.** In a repository that already has code, adopts it in place — the same as `adopt`, touching no code. Anywhere else, scaffolds a new project (interactive wizard when no `--config`). `--new` forces a scaffold; `--yes`, `--config`, `--out` and `--multi-stack` always scaffold. Running it twice is not an error. |
| `specgate init --from-pack <repo>@<tag> --pack <id>` | Scaffold **and** install a pinned domain pack in one step. An unpinned reference is refused. |
| `specgate init --multi-stack <a,b,c>` | Scaffold one sibling project per stack under a single root, sharing one `spec.md` and one `features/` tree. Each stack keeps its own `AI_RULES.md` and traceability matrix — the files that implement and prove a requirement differ per stack. Registers them in `specops.config.yaml`. |
| `specgate adopt` | Install SDD on an existing repository. Never overwrites a file, never touches source. |
| `specgate onboard` | Read an existing repository and propose the capabilities its layout implies, with the evidence for each. Writes nothing. |

## Every day

| Command | What it does |
| --- | --- |
| `specgate status` | Where the project stands: totals by state, orphan features, locked pack versions, and the one command to run next. |
| `specgate plan` | Requirements that still need a test, code or a status change. |
| `specgate new "<title>"` | **Add a requirement in one step**: a draft `## REQ-NNN` in `spec.md`, a tagged scenario of `<placeholders>` under `features/`, and its matrix row linked to it. `--feature <path>` appends to an existing file. |
| `specgate req add \| link \| done \| list` | Manage matrix rows without hand-editing the ten-column table. |
| `specgate req rm <REQ>` | Remove a requirement's matrix row(s) and its prose in `spec.md`. `--dry-run` previews; `--force` is required past `Draft`, because removing a delivered requirement deletes the record that it shipped. Reports any feature file left unreferenced, and says what it did **not** touch. |
| `specgate done <REQ>` | Mark a requirement Implemented. Runs the gate first (`validate --strict`, as `check` does) and refuses to write on failure; `--no-check` skips it. `Draft`, `Approved` and `Deprecated` are written without it unless `--check` is given. `--test-cmd "<cmd>"` (or `test_cmd:` in `harness.config.yaml`) also runs the project's tests and requires them to pass. Without one, `done` says it checked the specification and not the code. |
| `specgate check [dir] [--test-cmd "<cmd>"]` | **The gate before a PR**: `validate --strict`, then the project's tests (`--test-cmd`, or `test_cmd:` in `harness.config.yaml`). Without a test command it passes and says it checked the specification, not the code. |
| `specgate matrix [--check \| --migrate]` | Generate `traceability.md` from `spec.md`, scenario tags and tests instead of maintaining it. `--migrate` switches a hand-kept matrix over, only if the result is identical row for row. See [A matrix nobody edits](writing-specs.md#a-matrix-nobody-edits). |
| `specgate fix` | Apply the repairs `validate` suggests. `--dry-run` previews. |
| `specgate validate [--strict] [--against-lock]` | The gate. Structure, traceability and Gherkin always; `--strict` adds TDD, links, scenarios, requirements and coverage — what CI should run (`check` is this plus your tests). The individual `--strict-*` flags still work. |
| `specgate validate . --strict-coverage` | Fails when a scenario in a declared feature file is named by no test artifact. A name match, so it is opt-in — it does not run your suite. |

## Changing a spec that already shipped

| Command | What it does |
| --- | --- |
| `specgate change new <id> [--lite\|--full] [--schema <name>]` | Open a change. Reserves a `REQ` range so two changes in flight never collide. |
| `specgate change new <id> --from-value-drift <REQ-ID>:<value_id>` | Seed the change from a value `specgate report` found diverging — the delta arrives written. |
| `specgate change status` | Which artefact to write next, in dependency order. |
| `specgate change instructions <artifact>` | The template, the rules the validator enforces, the project's stack, and what writing it unblocks. |
| `specgate change author <id>` | Have an agent write one artefact, confined to the change directory and gated by `change validate`. |
| `specgate change validate` | Check the deltas. Runs inside `specgate validate` too. |
| `specgate change archive <id>` | Merge the delta into the specs, write the matrix rows, materialise the feature files. `--dry-run` first. |

→ [Reviewing changes](reviewing-changes.md)

## Domain packs

| Command | What it does |
| --- | --- |
| `specgate pack init \| lint \| infer \| bundle` | Scaffold (`--type backend\|frontend\|mobile\|contracts`), lint (`--strict`, `--graph`, `--json`), infer from a `.feature`, or export as a git bundle for air-gapped use. Lint runs the installer's own validation, so passing means installable. |
| `specgate specops add \| remove` | Install or drop a pack. Writes `.specops.lock`. |
| `specgate specops sync` | Re-render locked packs, three-way merging your edits. |
| `specgate specops diff [--as-change]` | Preview a version bump — as files, or as a reviewable change proposal. |
| `specgate specops contribute --change <id>` | Send a local change back upstream to the pack. Never pushes. |
| `specgate expand` | Low-level pack render. `specops add` is the ergonomic path. |

→ [Domain packs](domain-packs.md)

## Automation and CI

| Command | What it does |
| --- | --- |
| `specgate harness init` | Scaffold `harness.config.yaml` and `.harness/prompt-prefix.md`. Detects the gate from your build files; leaves the agent unset on purpose. |
| `specgate harness run` | The plan → agent → verify → done loop, one git worktree per requirement. Never merges. |
| `specgate harness prompt <REQ>` | Print the prompt the harness would hand an agent, before paying for tokens. |
| `specgate ci init` | Generate the spec gate for GitHub, GitLab, Azure or Jenkins. |
| `specgate verify [--run] [--since <ref>] [--record] [--ids] [--format github]` | **For teams on OpenSpec.** Reads `openspec/` in place and fails while an archived change claims a scenario no test names. `--since` gates only new claims; `--record` pins each verified scenario's text, so a later edit must be verified again. Action: `rsaglobaltech/specgate/actions/verify`. |
| `specgate alm sync` | Sync requirements with Jira or Azure Boards — create, close, report drift. |
| `specgate alm status` | The requirement ↔ issue mapping, without touching the network. |
| `specgate alm link <REQ> <issue>` | Adopt an issue that already exists into the mapping. |
| `specgate report` | Spec-coverage dashboard as a self-contained HTML file. Includes declared-value drift when the project annotates any. |
| `specgate doctor` | Diagnose the project and the environment. Every finding ships a fix. |

→ [Automation](automation.md) · [The harness](harness.md) · [Jira and Azure Boards](alm.md)

## Agents

| Command | What it does |
| --- | --- |
| `specgate agents init [--tool <names>]` | Slash commands and instruction files for Claude Code, Cursor, Copilot, Windsurf, Aider, Gemini, Cline, Codex and Antigravity. |
| `specgate update` | Refresh those generated files after a CLI upgrade, three-way merging your edits. Conflicts are reported, never resolved silently. |

→ [Agents](agents.md)

## Customising

| Command | What it does |
| --- | --- |
| `specgate config set profile core\|full` | How much of this surface `--help` shows. |
| `specgate config set language es\|pt` | Language for generated prose. `SHALL` and `GIVEN`/`WHEN`/`THEN` never translate. |
| `specgate config init` | Write a starter `project.yaml`. |
| `specgate schema which \| init \| fork \| validate` | Inspect or fork the artefact graph a change follows. Ships `spec-driven` and `bdd-first`. |
| `specgate completion bash\|zsh\|fish [--install]` | Shell completion. |
| `specgate studio [--port <n>] [--json]` | Serve a local, read-only HTML view of the spec tree. |

---

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success, including advisory warnings |
| `1` | Failure, or a gate that found something |
| `2` | Usage error — unknown flag, missing argument |
| `3` | A required script is missing (a broken installation) |

→ [The agent contract](specs/agent-contract.md) for the JSON envelope and the
full diagnostic code catalogue.
