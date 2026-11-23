# Agent Integration

## Requirements

### Requirement: REQ-426 — The guards name the next requirement as the change's tasks order it

The guard's denial (REQ-421, REQ-422) and the session context (REQ-420) SHALL name as the next requirement of an open change the first requirement, not yet Implemented, that an unchecked line of the change's `tasks.md` names, in the file's order; requirements no unchecked line names SHALL follow in the order the deltas declare them. Without a `tasks.md`, the deltas' order SHALL apply. The denial SHALL say that a test, new or modified in the working tree, naming any requirement of the change unlocks the file.

> Session 2026-11-08, agentkit `module-map-v2`: `tasks.md` put REQ-320 next; the denial said "write the test for REQ-311 first".

#### Scenario: SCN-426a — The next requirement by the tasks

- GIVEN an open change `module-map-v2` whose delta declares REQ-311, REQ-312, REQ-313, REQ-319 and REQ-320, REQ-313 and REQ-319 Implemented, and whose `tasks.md` has "REQ-313" and "REQ-319" checked and then, unchecked, "REQ-320", "REQ-312", "REQ-311"
- WHEN the agent tries to write `src/core/map/scan.ts` with no test in the working tree naming a requirement of the change
- THEN the edit is denied with "write the test for REQ-320 first" and "a test that names any requirement of `module-map-v2`", and the session context says the next requirement is REQ-320

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-426.feature kind=functional status=Implemented -->

### Requirement: REQ-427 — With every requirement applied, the guard names none

When every requirement of every open change is Implemented (or later), the guard's denial SHALL name no requirement: it SHALL say that the change is ready for its reviewer and `specgate archive <change-id>` once they agree, or `specgate propose <change-id>` for new work.

#### Scenario: SCN-427a — Nothing left to apply

- GIVEN an open change `module-map` whose requirements are all Implemented
- WHEN the agent tries to write `src/core/map/scan.ts`
- THEN the edit is denied with "every requirement of `module-map` is applied" and the two commands, and no REQ id

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-427.feature kind=functional status=Implemented -->

### Requirement: REQ-549 — The loop installs as Agent Skills

The system SHALL, with `specgate agents init --format skills [--tool <name>]`, write one folder per step of the loop that `agents init` writes as commands (`specgate-explore`, `specgate-propose`, `specgate-apply`, `specgate-check`, `specgate-archive`, …), each with a `SKILL.md` whose front matter has the `name` of its folder and a `description` naming when to use it, into `.agents/skills/` and, for each tool named with `--tool` or, with none named, each tool whose folder the project has, its own skill folder (`.claude/skills/`, `.cursor/skills/`, `.gemini/skills/`); and SHALL leave a folder untouched when its `SKILL.md` was changed by hand, reporting `skill_kept`.

#### Scenario: SCN-549a — Skills for Cursor

- GIVEN a specgate project
- WHEN a tool runs `specgate agents init --format skills --tool cursor`
- THEN `.agents/skills/specgate-apply/SKILL.md` and `.cursor/skills/specgate-apply/SKILL.md` exist, each with `name: specgate-apply` in its front matter

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-549.feature kind=functional status=Implemented -->

### Requirement: REQ-550 — The package carries the plugin manifests

The system SHALL keep, in the plugin folder `packages/claude-plugin` the marketplace entry points at, an Agent Plugins `plugin.json` and a Tessl `.tessl-plugin/plugin.json` next to the Claude Code manifest, and a `skills/` folder with the loop's skills, each manifest with the package's `version`, its author and its repository, all generated from `package.json`; each manifest SHALL be valid against its own format: the Agent Plugins one carries the 1.0.0 `$schema`, the name `specgate` and no key that schema does not define, its skills found in `skills/`, and the Tessl one names the plugin `rsaglobaltech/specgate` and points `skills` at `./skills/` and `mcpServers` at a `.mcp.json` whose server states its `type`; `npm run plugin:sync` SHALL regenerate them; and the test suite SHALL fail, naming each file, while the committed plugin differs from what the generator renders or a manifest breaks its format's rules.

#### Scenario: SCN-550a — A version bumped in one place

- GIVEN the repository with `package.json` at a new version and the manifests at the old one
- WHEN a maintainer runs the test suite, then `npm run plugin:sync`
- THEN the suite fails naming each manifest that differs, and the sync writes the three manifests at the new version

#### Scenario: SCN-550b — A manifest a registry would refuse

- GIVEN the Agent Plugins manifest with a `skills` key, or the Tessl manifest named `specgate`
- WHEN a maintainer runs the test suite
- THEN it fails naming the manifest and the rule: a key the Agent Plugins schema does not define, or a Tessl name without its workspace

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-550.feature kind=functional status=Implemented -->

### Requirement: REQ-520 — agent ask proposes a plan and writes nothing

The system SHALL, with `specgate agent ask "<request>" [--plan] [--json]`, run the project's agent — `--agent <cmd>`, else the agent of `--profile <name>` in `.harness/profiles.yaml`, else `agent:` or `agent_profile:` in `harness.config.yaml` — in a scratch copy of the project's tracked and untracked files outside the working tree, handing it the request on standard input or as `{prompt_file}`; and SHALL answer `plan` with its `id`, the `request`, `files` — each with its `path`, its `change` (`modify`, `add` or `delete`), `why` and its unified `diff` — the `then` commands to run once it is applied, the files the agent `read`, and `usage` with the `input` and `output` tokens and, when the agent reports it, the `cost`; no file of the working tree SHALL change.

#### Scenario: SCN-520a — An agent proposes a line in spec.md

- GIVEN a git project whose `harness.config.yaml` sets `agent:` to a script that adds a line to `spec.md`, says why and that `specgate validate` follows, and prints its usage as Claude Code does
- WHEN a tool runs `specgate agent ask "allow cancelling up to 24 h before shipping" --plan --json`
- THEN it exits 0; `plan.files` is `spec.md`, `modify`, with the agent's reason and a diff that adds the line; `plan.then` is `specgate validate`; `plan.usage` has the tokens and the cost; and `spec.md` in the project is unchanged

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-520.feature kind=functional status=Implemented -->

### Requirement: REQ-521 — Mentions in the request become the agent's context

The system SHALL resolve each `@REQ-NNN` mention in the request, and each `--req <REQ>`, to the requirement's section — from `spec.md`, a capability spec or an open change's delta — and its feature file, and give both to the agent; SHALL resolve each `@path` mention, and each `--file <path>`, that names a file of the project, to that file for the agent to read first; SHALL list those files under `plan.read` with the ones the agent reports it read; and SHALL warn `mention_unresolved` for a mention that names neither.

#### Scenario: SCN-521a — A requirement, a file and a mention of nothing

- GIVEN the project of SCN-520a, where REQ-001 has a section in `spec.md` and a feature file, and `docs/notes.md` exists
- WHEN a tool runs `specgate agent ask "cancel up to 24 h before shipping @REQ-001 @docs/notes.md @REQ-999" --json`
- THEN the prompt the agent received holds REQ-001's section and names `docs/notes.md`; `plan.read` lists `spec.md`, REQ-001's feature file and `docs/notes.md`; and `status` has `mention_unresolved` for `@REQ-999`

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-521.feature kind=functional status=Implemented -->

### Requirement: REQ-522 — A plan is kept in the git folder until it is applied or discarded

The system SHALL keep each plan that changes a file in the repository's git folder, under `specgate/plans/<id>/`, with the base commit, the hash of each file it touches as the file was when the agent started — null for one that did not exist — and the content each file would get; `specgate agent plans --json` SHALL list the open plans, each with its `id`, `request`, `created`, `files` and whether it is `stale`; `specgate agent discard <id> --json` SHALL remove one; and an id no open plan has SHALL be refused with `plan_not_found` and the fix `specgate agent plans`.

#### Scenario: SCN-522a — Listed, then discarded

- GIVEN the plan SCN-520a proposed
- WHEN a tool runs `specgate agent plans --json`, `specgate agent discard <id> --json`, then both again
- THEN the first lists the plan with `spec.md` and `stale` false, and its folder is under the git folder's `specgate/plans/`; the discard answers its id; then the list is empty and the second discard is refused with `plan_not_found`

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-522.feature kind=functional status=Implemented -->

### Requirement: REQ-523 — In spec mode the agent may change only the specification

The system SHALL, in mode `spec` — the default, and the only mode — keep in a plan only the agent's edits to `spec.md`, `docs/specs/**` and `features/**`; SHALL report each other file the agent changed as the warning `edit_refused` naming it, never under `files`; and SHALL refuse `--mode` with any other value as `agent_mode_unknown`, before the agent runs.

#### Scenario: SCN-523a — The agent also edits the code

- GIVEN a project whose agent adds a line to `spec.md`, writes a feature file under `features/`, and changes `src/app.js`
- WHEN a tool runs `specgate agent ask "…" --json`, then `specgate agent ask "…" --mode code --json`
- THEN the first plan's `files` are `spec.md` and the feature file, and `status` has `edit_refused` for `src/app.js`; the second is refused with `agent_mode_unknown` and the agent did not run

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-523.feature kind=functional status=Implemented -->

### Requirement: REQ-524 — apply writes exactly the plan, and only on the base it was made on

The system SHALL, with `specgate agent apply <id> --json`, first check that every file the plan touches still has the hash it had when the agent started, and when one does not, refuse with `plan_stale` naming the file and its fix, writing nothing; otherwise it SHALL write each file's planned content and remove each file the plan deletes — never staging, committing or pushing anything — remove the plan, and answer `applied` with the `id` and what was `written`, each with its `path` and `change`.

#### Scenario: SCN-524a — Applied, then stale

- GIVEN two plans of SCN-520a's agent on the same project
- WHEN a tool runs `specgate agent apply <first> --json`, then `specgate agent apply <second> --json`
- THEN the first writes `spec.md` with the agent's line, the plan is gone, and git has nothing staged and no new commit; the second is refused with `plan_stale` naming `spec.md`, and `spec.md` keeps what the first wrote

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-524.feature kind=functional status=Implemented -->

### Requirement: REQ-525 — apply runs the plan's checks and says what they found

The system SHALL, after writing a plan, run each of its `then` commands that is a specgate check — `validate`, `status`, `matrix`, `questions`, `check`, `draft --check`, `change validate` or `change show` — in the project with `--json`, and answer under `applied.then` each `command`, its `exit` and its `findings`; any other command SHALL not run, and SHALL be reported as the warning `then_refused` when the plan is made.

#### Scenario: SCN-525a — validate runs, a shell command does not

- GIVEN an agent that asks for `specgate validate` and `rm -rf src` after its edit
- WHEN a tool runs `specgate agent ask "…" --json`, then `specgate agent apply <id> --json`
- THEN the plan's `then` is `specgate validate` alone and its `status` has `then_refused` naming `rm -rf src`; `applied.then` has `specgate validate` with its exit and findings, and `src` is still there

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-525.feature kind=functional status=Implemented -->

### Requirement: REQ-526 — No agent, a failing agent and an empty plan are answers

The system SHALL refuse `agent ask` with no agent configured as `agent_not_set`, with the fix `specgate agents init --tool claude`; SHALL answer an agent that exits with an error, or runs past `--timeout <seconds>` (900 by default), with `agent_failed` and the tail of what it wrote to standard error, keeping no plan; and SHALL answer an agent that changes nothing with exit 0, a plan with `id` null and no `files`, and the finding `plan_empty`, which says nothing would change.

#### Scenario: SCN-526a — Not set, failing, and nothing to change

- GIVEN a git project with no agent configured
- WHEN a tool runs `specgate agent ask "…" --json`, then with `--agent` a script that writes "rate limited" to standard error and exits 1, then with `--agent` a script that changes nothing
- THEN the first is refused with `agent_not_set` and the fix `specgate agents init --tool claude`; the second with `agent_failed` whose message holds "rate limited", and no plan is kept; the third exits 0 with `plan.id` null, `plan.files` empty and `plan_empty`

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-526.feature kind=functional status=Implemented -->

### Requirement: REQ-527 — The agent's plans through the API

The system SHALL export from `@rsaglobaltech/specgate/api` `agentAsk(dir, request, options)`, `agentApply(dir, id)`, `agentDiscard(dir, id)` and `agentPlans(dir)`, typed in `types/api.d.ts`, each answering what its command prints with `--json` and rejecting a refusal with its `code` and `fix`; `API_VERSION` SHALL stay `1.0.0`.

#### Scenario: SCN-527a — Ask, list and apply in-process

- GIVEN the project of SCN-520a
- WHEN a Node program calls `agentAsk(dir, "…")`, `agentPlans(dir)`, then `agentApply(dir, id)`, and `agentDiscard(dir, "nope")`
- THEN the plan, the list and the applied answer have the shapes the commands print, `spec.md` holds the agent's line, and the discard rejects with the code `plan_not_found` and the fix `specgate agent plans`

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-527.feature kind=functional status=Implemented -->

### Requirement: REQ-420 — A new session starts knowing the project is spec-driven

The Claude Code plugin SHALL register a `SessionStart` hook that, in a folder with `spec.md` and a `specgate` CLI it can run, adds to the agent's context: that the project is spec-driven and its contract is `spec.md`, `features/` and `docs/specs/`; each open change with its requirements still to apply; the next of them and the command that closes it (`specgate apply REQ-NNN`, after its test); and the loop's rules — the test before the code, naming the requirement; `specgate apply` to close it; never archive without the reviewer. The text SHALL stay under 2,000 characters. Without `spec.md`, or on any error, the hook SHALL add nothing and exit 0. It SHALL read the changes from `docs/specs/changes/` itself, so a session starts as fast with or without the CLI.

> Amended 2026-11-07, while implementing, before any code: `specgate status`'s `nextCommand` is project-wide — in agentkit it named REQ-136 while `module-map` was the open change — so the hook names the open change's next requirement instead.

#### Scenario: SCN-420a — Status in a fresh session

- GIVEN a spec-driven project with the open change `module-map` whose next requirement is REQ-312
- WHEN the developer starts a new Claude Code session there with the plugin installed
- THEN the agent's context holds "spec-driven", `module-map`, "REQ-312" and "write the test first"; in a folder without `spec.md` it holds nothing from specgate

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-420.feature kind=functional status=Implemented -->

### Requirement: REQ-421 — An edit to source code waits for a test that names the requirement

The Claude Code plugin SHALL register a `PreToolUse` hook on the tools that write files (`Write`, `Edit`, `MultiEdit`, `NotebookEdit`). For a file that is neither a test (as `specgate check` recognises tests), nor under `spec.md`, `features/`, `docs/`, nor a configuration or Markdown file, it SHALL deny the edit when no change is open, or when no test file that is new or modified in the working tree names a requirement of an open change. The denial SHALL say which of the two is missing and the next command (`specgate propose <change-id>`, or "write the test for REQ-NNN first"). Edits SHALL be allowed when the project sets `agent_guard: off`, when `SPECGATE_GUARD=off`, outside a spec-driven project, or on any error.

> Session 2026-11-07: the agent ran `propose` and `change validate`, then wrote the implementation before a test named the requirement. The `Stop` gate came after the code.

#### Scenario: SCN-421a — Code before its test is refused

- GIVEN a spec-driven project with the open change `module-map` (REQ-311…REQ-318) and no test in the working tree naming any of them
- WHEN the agent tries to write `src/core/map/scan.ts`
- THEN the edit is denied with "write the test for REQ-311 first"; once `test/module-map.test.ts` naming REQ-311 is in the working tree, the same edit is allowed; an edit to `test/module-map.test.ts` itself is never denied

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-421.feature kind=functional status=Implemented -->

### Requirement: REQ-422 — OpenCode gets the same three guards

`specgate agents init --tool opencode-plugin` SHALL write an OpenCode plugin that gives OpenCode REQ-420's context (through `experimental.chat.system.transform`), REQ-421's guard (throwing from `tool.execute.before` for `write`, `edit` and `patch`, with the same message), and the gate: when the session goes idle with the gate red, it SHALL send the findings back to the session once per user message, as the Claude Code `Stop` hook does. It SHALL do nothing outside a spec-driven project.

#### Scenario: SCN-422a — OpenCode refuses code before its test

- GIVEN the project of REQ-421's scenario with the OpenCode plugin installed
- WHEN OpenCode's agent calls `write` on `src/core/map/scan.ts`
- THEN the tool call fails with "write the test for REQ-311 first", and a new session's system prompt names `module-map` and REQ-311

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-422.feature kind=functional status=Implemented -->

### Requirement: REQ-423 — Installed once per user, quiet where there are no specs

`specgate agents install --global` SHALL install the guards for every project of the user: for Claude Code by printing the two commands that add this repository's marketplace and install the `specgate` plugin from it (the repository SHALL ship `.claude-plugin/marketplace.json` naming `packages/claude-plugin`), and for OpenCode by writing the plugin into OpenCode's global plugin folder. `--tool claude-plugin` or `--tool opencode-plugin` SHALL limit it to one tool. Running it again SHALL change nothing; a project without `spec.md` SHALL see no context, no denial and no gate from them.

#### Scenario: SCN-423a — One install, every repository

- GIVEN a developer with two repositories, one spec-driven and one without `spec.md`
- WHEN the developer runs `specgate agents install --global` and starts OpenCode in each
- THEN the developer sees the plugin in OpenCode's global plugin folder, the guards working in the spec-driven repository and nothing from specgate in the other; a second run reports nothing changed

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-423.feature kind=functional status=Implemented -->

### Requirement: REQ-424 — The guards run on Windows

Every hook and plugin script SHALL start the `specgate` CLI without a shell and in a way that works on Windows, where `npx` and npm-installed commands are `.cmd` files, and SHALL compare paths after resolving them (`/var` and `/private/var` on macOS, drive letters and back slashes on Windows). CI SHALL run the guards' tests on Windows, macOS and Linux.

> Today's `scripts/plugin/gate-hook.ts` spawns `npx` with no shell; on Windows that fails with ENOENT and the hook, by design, allows the stop — the gate is silently off.

#### Scenario: SCN-424a — The gate on Windows

- GIVEN a spec-driven project with a failing gate on Windows
- WHEN the agent tries to end its session
- THEN the stop is blocked with the gate's findings, as on macOS and Linux

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-424.feature kind=functional status=Implemented -->

### Requirement: REQ-425 — The plugin's version is the CLI's

`specgate agents init --tool claude-plugin` SHALL write the CLI's own version into `plugin.json`, and a test SHALL fail when `packages/claude-plugin/.claude-plugin/plugin.json` and `package.json` disagree, so a release cannot ship a plugin that names another version.

#### Scenario: SCN-425a — A stale plugin manifest fails the build

- GIVEN `package.json` at 0.28.0 and the shipped plugin manifest at 0.19.1
- WHEN the maintainer runs `npm test`
- THEN a test fails naming both versions and `specgate agents init --tool claude-plugin` as the fix

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-425.feature kind=functional status=Implemented -->

### Requirement: REQ-664 — A plan applied hunk by hunk

The system SHALL, on `specgate agent apply <plan-id> --hunk <path>#<n>…`, write only the hunks named — numbered from 1 in the order of each file's diff, a new or removed file being its one hunk —, each file from what it holds now with those hunks applied and the others left out, a file whose every hunk is named written byte for byte as the plan holds it, and a file with none untouched; it SHALL refuse with `hunk_not_found` a hunk the plan does not have, writing nothing, and answer under `applied.hunks` the hunks written.

> Studio (agent-panel, 2026-11-22): the agent's diff accepted or rejected hunk by hunk, as in an IDE.

#### Scenario: SCN-664a — The first of two hunks applied

- GIVEN a plan that changes spec.md's first line and adds a line at its end
- WHEN the Developer runs `specgate agent apply <id> --hunk spec.md#1`
- THEN spec.md's first line is changed, its last line is not added, and `applied.hunks` is `["spec.md#1"]`

#### Scenario: SCN-664b — A hunk the plan does not have

- GIVEN the same plan
- WHEN the Developer runs `specgate agent apply <id> --hunk spec.md#3`
- THEN it is refused with `hunk_not_found` and nothing is written

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-664.feature kind=functional status=Implemented -->

### Requirement: REQ-665 — An applied plan taken back

The system SHALL keep, when a plan is applied, what each file it wrote held before, and SHALL, on `specgate agent revert <plan-id>`, put every file back as it was — a file the plan made removed, one it removed made again — when each still holds what the plan wrote; it SHALL refuse with `revert_stale`, writing nothing, when one changed since, and with `revert_not_found` when the plan was never applied here.

#### Scenario: SCN-665a — Applied, then taken back

- GIVEN a plan applied to spec.md
- WHEN the Developer runs `specgate agent revert <id>`
- THEN spec.md is as before the plan, and `reverted.files` names spec.md

#### Scenario: SCN-665b — Changed since it was applied

- GIVEN a plan applied to spec.md, then spec.md edited
- WHEN the Developer runs `specgate agent revert <id>`
- THEN it is refused with `revert_stale` naming spec.md, and spec.md keeps the edit

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-665.feature artifact='scripts/lib/agent-plan.ts, scripts/agent/cli.ts' actor=Developer kind=functional -->

### Requirement: REQ-596 — The project's agent, not Claude for every project

The system SHALL know Codex as an agent Build runs, with the command `codex exec -s workspace-write - < {prompt_file}`; SHALL, when it sets `agent:` itself (adoption, `agents init` without `--tool`), choose the agent whose folder or instructions the project carries (`.codex/` for Codex; `.claude/` or `CLAUDE.md` for Claude Code) when that agent is installed, else the first installed; and SHALL set Codex on `agents init --tool codex`, never over an `agent:` a person set.

#### Scenario: SCN-596a — A Codex project, with Claude installed too

- GIVEN a project with `.codex/`, and both Codex and Claude Code installed
- WHEN the agent is chosen
- THEN Codex is chosen

#### Scenario: SCN-596b — Codex named

- GIVEN a project with no `agent:`
- WHEN the person runs `specgate agents init --tool codex`
- THEN `harness.config.yaml` says `agent: codex exec -s workspace-write - < {prompt_file}`

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-596.feature kind=functional status=Implemented -->

### Requirement: REQ-597 — Codex gets specgate's steps

The system SHALL, on `agents init --tool codex` or in a project carrying `.codex/`, write specgate's steps as skills in `.agents/skills/`, where Codex reads them, keeping a skill changed by hand unless `--force`; and SHALL not write them for a tool that does not read them.

#### Scenario: SCN-597a — The steps in Codex

- GIVEN a project set up for Codex
- WHEN the person runs `specgate agents init --tool codex`
- THEN `.agents/skills/` holds specgate-draft, specgate-apply and specgate-check, each with its SKILL.md

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-597.feature kind=functional status=Implemented -->

### Requirement: REQ-598 — What to tell your agent, from the project

The system SHALL print, on `specgate status --prompt` (`start`), `--prompt draft` and `--prompt build`, in English, what a person gives an agent to work on the project — read AGENTS.md, the next step `specgate status` names, the brief's modules left to draft, how the installed agents call specgate's steps, and the rules the agent never breaks — and SHALL give it as data with `--json`.

#### Scenario: SCN-598a — The prompt for a Codex project

- GIVEN a project set up for Codex whose next step is `specgate apply REQ-000`
- WHEN the person runs `specgate status --prompt`
- THEN it prints that this project uses specgate, to read AGENTS.md, the next step, Codex's `$specgate-draft`, and the rules

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-598.feature kind=functional status=Implemented -->
