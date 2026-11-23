# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-520 — agent ask proposes a plan and writes nothing

The system SHALL, with `specgate agent ask "<request>" [--plan] [--json]`, run the project's agent — `--agent <cmd>`, else the agent of `--profile <name>` in `.harness/profiles.yaml`, else `agent:` or `agent_profile:` in `harness.config.yaml` — in a scratch copy of the project's tracked and untracked files outside the working tree, handing it the request on standard input or as `{prompt_file}`; and SHALL answer `plan` with its `id`, the `request`, `files` — each with its `path`, its `change` (`modify`, `add` or `delete`), `why` and its unified `diff` — the `then` commands to run once it is applied, the files the agent `read`, and `usage` with the `input` and `output` tokens and, when the agent reports it, the `cost`; no file of the working tree SHALL change.

#### Scenario: SCN-520a — An agent proposes a line in spec.md

- GIVEN a git project whose `harness.config.yaml` sets `agent:` to a script that adds a line to `spec.md`, says why and that `specgate validate` follows, and prints its usage as Claude Code does
- WHEN a tool runs `specgate agent ask "allow cancelling up to 24 h before shipping" --plan --json`
- THEN it exits 0; `plan.files` is `spec.md`, `modify`, with the agent's reason and a diff that adds the line; `plan.then` is `specgate validate`; `plan.usage` has the tokens and the cost; and `spec.md` in the project is unchanged

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-521 — Mentions in the request become the agent's context

The system SHALL resolve each `@REQ-NNN` mention in the request, and each `--req <REQ>`, to the requirement's section — from `spec.md`, a capability spec or an open change's delta — and its feature file, and give both to the agent; SHALL resolve each `@path` mention, and each `--file <path>`, that names a file of the project, to that file for the agent to read first; SHALL list those files under `plan.read` with the ones the agent reports it read; and SHALL warn `mention_unresolved` for a mention that names neither.

#### Scenario: SCN-521a — A requirement, a file and a mention of nothing

- GIVEN the project of SCN-520a, where REQ-001 has a section in `spec.md` and a feature file, and `docs/notes.md` exists
- WHEN a tool runs `specgate agent ask "cancel up to 24 h before shipping @REQ-001 @docs/notes.md @REQ-999" --json`
- THEN the prompt the agent received holds REQ-001's section and names `docs/notes.md`; `plan.read` lists `spec.md`, REQ-001's feature file and `docs/notes.md`; and `status` has `mention_unresolved` for `@REQ-999`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-522 — A plan is kept in the git folder until it is applied or discarded

The system SHALL keep each plan that changes a file in the repository's git folder, under `specgate/plans/<id>/`, with the base commit, the hash of each file it touches as the file was when the agent started — null for one that did not exist — and the content each file would get; `specgate agent plans --json` SHALL list the open plans, each with its `id`, `request`, `created`, `files` and whether it is `stale`; `specgate agent discard <id> --json` SHALL remove one; and an id no open plan has SHALL be refused with `plan_not_found` and the fix `specgate agent plans`.

#### Scenario: SCN-522a — Listed, then discarded

- GIVEN the plan SCN-520a proposed
- WHEN a tool runs `specgate agent plans --json`, `specgate agent discard <id> --json`, then both again
- THEN the first lists the plan with `spec.md` and `stale` false, and its folder is under the git folder's `specgate/plans/`; the discard answers its id; then the list is empty and the second discard is refused with `plan_not_found`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-523 — In spec mode the agent may change only the specification

The system SHALL, in mode `spec` — the default, and the only mode — keep in a plan only the agent's edits to `spec.md`, `docs/specs/**` and `features/**`; SHALL report each other file the agent changed as the warning `edit_refused` naming it, never under `files`; and SHALL refuse `--mode` with any other value as `agent_mode_unknown`, before the agent runs.

#### Scenario: SCN-523a — The agent also edits the code

- GIVEN a project whose agent adds a line to `spec.md`, writes a feature file under `features/`, and changes `src/app.js`
- WHEN a tool runs `specgate agent ask "…" --json`, then `specgate agent ask "…" --mode code --json`
- THEN the first plan's `files` are `spec.md` and the feature file, and `status` has `edit_refused` for `src/app.js`; the second is refused with `agent_mode_unknown` and the agent did not run

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-524 — apply writes exactly the plan, and only on the base it was made on

The system SHALL, with `specgate agent apply <id> --json`, first check that every file the plan touches still has the hash it had when the agent started, and when one does not, refuse with `plan_stale` naming the file and its fix, writing nothing; otherwise it SHALL write each file's planned content and remove each file the plan deletes — never staging, committing or pushing anything — remove the plan, and answer `applied` with the `id` and what was `written`, each with its `path` and `change`.

#### Scenario: SCN-524a — Applied, then stale

- GIVEN two plans of SCN-520a's agent on the same project
- WHEN a tool runs `specgate agent apply <first> --json`, then `specgate agent apply <second> --json`
- THEN the first writes `spec.md` with the agent's line, the plan is gone, and git has nothing staged and no new commit; the second is refused with `plan_stale` naming `spec.md`, and `spec.md` keeps what the first wrote

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-525 — apply runs the plan's checks and says what they found

The system SHALL, after writing a plan, run each of its `then` commands that is a specgate check — `validate`, `status`, `matrix`, `questions`, `check`, `draft --check`, `change validate` or `change show` — in the project with `--json`, and answer under `applied.then` each `command`, its `exit` and its `findings`; any other command SHALL not run, and SHALL be reported as the warning `then_refused` when the plan is made.

#### Scenario: SCN-525a — validate runs, a shell command does not

- GIVEN an agent that asks for `specgate validate` and `rm -rf src` after its edit
- WHEN a tool runs `specgate agent ask "…" --json`, then `specgate agent apply <id> --json`
- THEN the plan's `then` is `specgate validate` alone and its `status` has `then_refused` naming `rm -rf src`; `applied.then` has `specgate validate` with its exit and findings, and `src` is still there

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-526 — No agent, a failing agent and an empty plan are answers

The system SHALL refuse `agent ask` with no agent configured as `agent_not_set`, with the fix `specgate agents init --tool claude`; SHALL answer an agent that exits with an error, or runs past `--timeout <seconds>` (900 by default), with `agent_failed` and the tail of what it wrote to standard error, keeping no plan; and SHALL answer an agent that changes nothing with exit 0, a plan with `id` null and no `files`, and the finding `plan_empty`, which says nothing would change.

#### Scenario: SCN-526a — Not set, failing, and nothing to change

- GIVEN a git project with no agent configured
- WHEN a tool runs `specgate agent ask "…" --json`, then with `--agent` a script that writes "rate limited" to standard error and exits 1, then with `--agent` a script that changes nothing
- THEN the first is refused with `agent_not_set` and the fix `specgate agents init --tool claude`; the second with `agent_failed` whose message holds "rate limited", and no plan is kept; the third exits 0 with `plan.id` null, `plan.files` empty and `plan_empty`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-527 — The agent's plans through the API

The system SHALL export from `@rsaglobaltech/specgate/api` `agentAsk(dir, request, options)`, `agentApply(dir, id)`, `agentDiscard(dir, id)` and `agentPlans(dir)`, typed in `types/api.d.ts`, each answering what its command prints with `--json` and rejecting a refusal with its `code` and `fix`; `API_VERSION` SHALL stay `1.0.0`.

#### Scenario: SCN-527a — Ask, list and apply in-process

- GIVEN the project of SCN-520a
- WHEN a Node program calls `agentAsk(dir, "…")`, `agentPlans(dir)`, then `agentApply(dir, id)`, and `agentDiscard(dir, "nope")`
- THEN the plan, the list and the applied answer have the shapes the commands print, `spec.md` holds the agent's line, and the discard rejects with the code `plan_not_found` and the fix `specgate agent plans`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
