# Agents

Twelve commands speak JSON — `status`, `plan`, `validate`, `report`, `doctor`,
`fix`, `req list`, `change`, `schema which`, `onboard`, `update` and `done` —
and the loop can be driven entirely from Claude Code, Cursor, Copilot,
Windsurf, Aider, Gemini, Cline, Codex or Antigravity.

`pack lint` and `specops diff` do not yet, and will say so rather than printing
prose at a caller that asked for a document.

---

## Wire it in

```bash
specgate agents init                          # every tool below
specgate agents init --tool claude,cursor     # or pick
specgate agents init --dry-run                # list destinations, write nothing
```

This writes the six slash commands (`/specgate:explore`, `/specgate:propose`,
`/specgate:verify`, `/specgate:apply`, `/specgate:archive`, `/specgate:onboard`) and the
instruction file each tool reads — `.cursor/rules/specgate.mdc`,
`.github/copilot-instructions.md`, `CONVENTIONS.md`, `AGENTS.md` and so on.

Existing files are never overwritten without `--force`.

**Upgrading from 0.9 or earlier?** Those versions wrote the commands as
`/csda:*` (`.claude/commands/csda/`, `.cursor/rules/csda.mdc`, …). Run
`specgate update`: it moves each file to its `specgate` name and merges the new
text in, keeping your edits. If both names exist it touches neither and tells
you which to keep.

---

## Antigravity

Antigravity gets two files, because it reads both halves of what specgate offers:

```
.agents/rules/specgate.md        the workspace rulebook
.agents/mcp_config.json      a live MCP connection to the project's own specs
```

The MCP half is the one that matters. An instruction file is a snapshot that
starts drifting the moment it is written; the MCP server answers from the
current spec tree, so an agent asking what `REQ-014` requires gets today's
answer rather than the one that was true when the file was generated.

Three details taken from Antigravity's own documentation rather than assumed:

- the rules directory is `.agents/rules/` — plural. The older `.agent/rules`
  still works, which is exactly why the plural is written deliberately;
- `.agents/mcp_config.json` is discovered by the IDE *and* the CLI, in the same
  `mcpServers` shape Claude Code uses — so both hosts are pointed at one server
  definition, and a test asserts they never diverge;
- a rule file is capped at **12,000 characters**. The generated rulebook is
  around 700, and a test keeps it that way, because a file over the cap is
  truncated silently and a truncated rulebook is worse than none.

Antigravity's own `GEMINI.md` convention is already covered by the `gemini`
row. Some third-party guides say it also reads `AGENTS.md`; its documentation
does not, so nothing here depends on that.

---

## Why the generated files are thin

They do not restate the delta grammar. A markdown copy of the format is stale
the moment the format moves, and an agent following a stale copy fails in a way
that looks like the agent's fault.

Instead they call the engine:

```bash
specgate change instructions specs --json
```

which returns the template, the rules the validator actually enforces, the
project's declared stack, the reserved `REQ` range, and what writing that
artefact unblocks. `harness run` builds its prompt from the same call, so the
slash commands, the harness and the MCP server cannot disagree.

Each generated command says so out loud: *if this file and the engine disagree,
the engine is right*.

---

## The contract

```bash
specgate validate . --json 2>/dev/null | jq .
```

- One JSON document on stdout. Prose goes to stderr.
- Every document carries `status`: an array of diagnostics, each with a stable
  `code` and a `fix`.
- Branch on `code`, never on `message` — the message is prose and may be
  reworded.
- A failure carries the command's null-shape, so the document has the same keys
  whether the command succeeded or not.
- Exit codes: `0` success, `1` failure or gate finding, `2` usage error.

→ Full rules, the code catalogue and the exit-code table:
[`specs/agent-contract.md`](specs/agent-contract.md). It is generated from the
source, and CI fails when it drifts.

---

## Instructions for a stage, not just a file

`apply` and `archive` are stages rather than artefacts — they return the rules
for carrying out a step, with no template:

```bash
specgate change instructions apply --json
specgate change instructions archive --json
```

---

## Next

- [Reviewing changes](reviewing-changes.md) — the loop the agent drives
- [The agent contract](specs/agent-contract.md) — the full reference
- [The harness spec](specs/harness.md) — unattended delivery, one requirement per worktree
