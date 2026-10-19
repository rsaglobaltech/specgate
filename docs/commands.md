# Command reference

Every command, grouped by when you reach for it. `specgate --help` shows the six
of the daily loop — `init`; `propose`, `apply`, `status`, `archive`; `check`
([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)); `specgate --help --all`
shows this whole surface, and `specgate config set profile full` makes that the
default.

Each command takes `--json`. See [the agent contract](specs/agent-contract.md).

---

## Starting

| Command | What it does |
| --- | --- |
| `specgate init` | **Start here.** In a repository that already has code, adopts it in place — the same as `adopt`, touching no code. Anywhere else, scaffolds a new project (interactive wizard when no `--config`). `--new` forces a scaffold; `--yes`, `--config`, `--out` and `--multi-stack` always scaffold. Running it twice is not an error. |
| `specgate init --forja [<name> <flags…>]` | **Generate a whole application** with [forja](https://rsaglobaltech.github.io/forja/) — a Next.js + Expo monorepo in TypeScript, or a Spring Boot / Quarkus API with a web app — which adopts Specgate as it installs ([ADR-0033](specs/adr/0033-one-front-door-two-engines.md)). Everything after `--forja` goes to `forja init`. In a terminal, plain `init` in an empty folder asks first. forja is fetched with `npx` at a pinned major; `SPECGATE_FORJA_CMD` points at another one. |
| `specgate init --from-pack <repo>@<tag> --pack <id>` | Scaffold **and** install a pinned domain pack in one step. An unpinned reference is refused. |
| `specgate init --multi-stack <a,b,c>` | Scaffold one sibling project per stack under a single root, sharing one `spec.md` and one `features/` tree. Each stack keeps its own `AGENTS.md` and traceability matrix — the files that implement and prove a requirement differ per stack. Registers them in `specops.config.yaml`. |
| `specgate adopt` | Install SDD on an existing repository. Never overwrites a file, never touches source. |
| `specgate onboard` | Read an existing repository and propose the capabilities its layout implies, with the evidence for each. Writes nothing. |
| `specgate onboard --tour` | **Learn the loop on your own code**: `propose`, a requirement and its test, `status`, `apply`, `archive` and `check`, run on a temporary copy of the repository (or a sample project), each step narrated with what it proved. The repository is not touched. |
| `specgate explore ["<question>"] [--agent "<cmd>"]` | **Think before a change exists**: a brief of the requirements by state, the open changes and the open questions, for you or your agent. Writes nothing; with `--agent`, anything the agent writes is undone and named. |
| `specgate draft` | **Starting from a plan.** Reads `docs/brief.md` (or `--brief <file>`). With no brief, says what one is; with no front matter, explains each field with an example; with a wrong one, says what to fix. Then lists the modules its front matter names, says where each stands — not started, drafting, ready to review, archived — and the one command to run next. |
| `specgate draft --new-brief` | No plan yet: writes `docs/brief.md` to fill in — the four fields with an example each, and six short sections. Never overwrites a brief. |
| `specgate draft --agent "<cmd>"` | Your agent proposes the brief's four fields from your text, following `docs/specs/BRIEF-SETUP.md`. It may write only the top of the brief; if your text below changes, the brief is put back. Then you review. |
| `specgate draft <module>` | The first time, opens `draft-<module>`: a change linked to the brief, with `DRAFTING.md` — the prompt for your agent, with the reserved ids, each actor's surfaces and the formats the checklist reads. Every time after, runs the checklist on it and says what is next. `--reserve <n>` (default 10). |
| `specgate draft <module> --agent "<cmd>"` | Hand the draft to your agent — the prompt on standard input, or in a file if the command contains `{prompt_file}` — undo whatever it writes outside the draft, then check it. Needs git. |

## Every day

| Command | What it does |
| --- | --- |
| `specgate propose <id> [--capability <name>]` | **Open a change** — what `change new` does, with a delta to write for the capability (named after the change unless `--capability` says) and a reserved `REQ` range. `--from-brief [<module>]` is `draft`: the next module of `docs/brief.md`, or that module's draft. |
| `specgate apply [<REQ> …]` | **Deliver a requirement**: the one named, or the next one `status` names. Refused while no test names it (`apply_no_test`, with the fix); then the gate — `validate --strict` for it, `arch_cmd`, the project's tests — and Implemented when green, nothing written when red. A requirement of an open change is judged as it will be after archive and its status is written in the change's delta. `done` is its old name. |
| `specgate archive <id>` | **Close a change** once every requirement it adds or modifies is Implemented — merge the delta into the specs, the matrix rows, the feature files. Refused while one is pending (`archive_requirements_pending`, with `specgate apply REQ-…` as the fix); `--force` never skips that. `change archive` is its old name. |
| `specgate status` | Where the project stands: totals by state, what is ready to close, what is to do — open changes' requirements included, each with its change — what waits for an answer (with the question that blocks it), orphan features, locked pack versions, and the one command to run next. |
| `specgate plan` | Requirements that still need a test, code or a status change. |
| `specgate add usecase\|entity\|port <module/Name>` | In a project forja generated: the class where the architecture expects it, its test and its wiring, by running `forja add`. `add usecase` also creates the requirement and names it in the test; `--req REQ-007` names an existing one. Outside a forja project it says to use `new`. |
| `specgate new "<title>"` | **Add a requirement in one step**: a draft `## REQ-NNN` in `spec.md`, a tagged scenario of `<placeholders>` under `features/`, and its matrix row linked to it. `--feature <path>` appends to an existing file. |
| `specgate req add \| link \| done \| list` | Manage matrix rows without hand-editing the ten-column table. |
| `specgate pet` | **Gato, the cat that keeps the gate**: the project's health as a pet — fed by closed requirements, sick on a red `check`, worried by open questions. A small version sits at the foot of `status` on a terminal; `specgate config set pet off` hides it. |
| `specgate req rm <REQ>` | Remove a requirement's matrix row(s) and its prose in `spec.md`. `--dry-run` previews; `--force` is required past `Draft`, because removing a delivered requirement deletes the record that it shipped. Reports any feature file left unreferenced, and says what it did **not** touch. |
| `specgate done <REQ> [<REQ> …]` | Same as `apply`. Mark requirements Implemented — several at once check each on its own and run the project's tests once. Runs the gate first (`validate --strict`, as `check` does) and refuses to write on failure — also when the requirement waits for an answer (`Needs Clarification`); `--no-check` skips it. `Draft`, `Approved` and `Deprecated` are written without it unless `--check` is given. `--test-cmd "<cmd>"` (or `test_cmd:` in `harness.config.yaml`) also runs the project's tests and requires them to pass. Without one, `done` says it checked the specification and not the code. |
| `specgate check [dir] [--test-cmd "<cmd>"] [--base <branch>]` | **The gate before a PR**: `validate --strict`, then the architecture check (`arch_cmd:` in `harness.config.yaml`, when set), then the project's tests (`--test-cmd`, or `test_cmd:` in `harness.config.yaml`). Without a test command it passes and says it checked the specification, not the code. It also compares requirement ids with the base branch (`--base`, `SPECGATE_BASE`, or origin's default): the same id with another title there fails as `id_taken_on_base`, before the merge; without git or a base it says the comparison was skipped. |
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
| `specgate change archive <id>` | Same as `archive`: once every requirement in the change is Implemented, merge the delta into the specs, write the matrix rows, materialise the feature files. `--dry-run` first. |
| `specgate draft --check <id> [--brief <file>]` | The checklist on any change (what `draft <module>` runs on its own draft). Is a draft change complete enough to review? Every requirement has a scenario and a kind, each actor's surfaces (API, screen) have a scenario, non-functional requirements are measured, cited laws name a source, every value is in the brief or listed in `assumptions.md`, every open question blocks something, every scenario passes the harness gate's scenario rules. [ADR-0029](specs/adr/0029-a-brief-becomes-a-draft-change-not-a-spec.md) |

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
| `specgate ci init` | Generate the CI job — the gate and the project's tests — for GitHub, GitLab, Azure or Jenkins. |
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
| `specgate config set test_cmd "<cmd>"` | The tests `check` and `done` run. Written as `test_cmd:` in `harness.config.yaml`; no harness needed. |
| `specgate config set arch_cmd "<cmd>"` | Your architecture check — ArchUnit, dependency-cruiser, import-linter… — run by `check`, `done` and the harness gate between validation and the tests ([ADR-0028](specs/adr/0028-architecture-conformance-is-part-of-the-gate.md)). A failure in the harness goes back to the agent. |
| `specgate config init` | Write a starter `project.yaml`. |
| `specgate schema which \| init \| fork \| validate` | Inspect or fork the artefact graph a change follows. Ships `spec-driven` and `bdd-first`. |
| `specgate completion bash\|zsh\|fish [--install]` | Shell completion. |
| `specgate studio [--port <n>] [--host <addr>] [--json]` | Serve a local, read-only HTML view of the spec tree, and at `/live` the harness at work — each requirement's attempt, phase, files, tests and steps, updated as they happen. Bound to 127.0.0.1 and refusing other host names unless `--host` says otherwise ([ADR-0037](specs/adr/0037-see-the-harness-work.md)). |
| `<agent> \| specgate harness events --from claude` | Turn Claude Code's `--output-format stream-json` into harness events for the live view, at the end of the agent's pipe. No file contents, tool output or secrets are written. |

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
