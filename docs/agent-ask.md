# Ask your agent, see the plan, then apply it

`specgate agent ask` hands a request about the specification to your agent and
answers with a **plan**: the files it would change, each with why and its diff,
the specgate checks to run afterwards, what it read and the tokens it used.
Nothing is written to your project until you apply the plan. This is what
specgate-studio's agent panel runs; it works the same from a terminal.

**You need:** a project in git, and an agent configured — `agent:` in
`harness.config.yaml`, which `specgate agents init --tool claude` writes, or
`--agent "<command>"` on the command line.

## Ask

```bash
specgate agent ask "allow cancelling up to 24 h before shipping @REQ-031"
```

```text
  [ PLAN · nothing written yet ]

    M spec.md  — States the cancellation window.
    + features/orders/cancel.feature  — The scenario for it.

  Then: specgate validate
  Read: spec.md, features/orders/REQ-031.feature
  Tokens: 1200 in · 340 out · $0.0123

  ➜  specgate agent apply 20261112-085017-4bc1
     or: specgate agent discard 20261112-085017-4bc1
```

- The agent runs on a **scratch copy** of the project — its tracked and
  untracked files, not the ignored ones — in a temporary folder. It cannot
  reach your working tree.
- `@REQ-031` gives the agent the requirement's section, from `spec.md`, a
  capability spec or an open change's delta, and its feature file. `@path`
  names a file for it to read first. `--req <REQ>` and `--file <path>` do the
  same. A mention that names nothing is the warning `mention_unresolved`.
- The agent gets the request on standard input, or as `{prompt_file}` when its
  command names it. It may leave `.specgate-ask.json` at the copy's root with a
  reason per file (`why`), the checks to run (`then`) and what it read
  (`read`); the prompt tells it how.
- Tokens come from the agent's own report: `claude -p --output-format json`
  gives them, with the cost. An agent that reports none leaves them null.
- `--agent "<cmd>"` or `--profile <name>` picks the agent; otherwise the one
  in `harness.config.yaml` (`agent:` or `agent_profile:`). `--timeout
  <seconds>` bounds it, 900 by default.

### Only the specification

A plan changes `spec.md`, `docs/specs/**` and `features/**` — nothing else.
A change the agent made to any other file is left out of the plan and reported
as the warning `edit_refused`. There is no `--mode code`: code is built test
first through `specgate harness run`, behind the gate, and a plan does not
replace that. `--mode` with any value but `spec` is refused
(`agent_mode_unknown`).

## Apply, or discard

```bash
specgate agent apply 20261112-085017-4bc1
specgate agent discard 20261112-085017-4bc1
specgate agent plans
```

`apply` first checks that every file of the plan is still as it was when the
agent started. If you or anything else changed one since, it writes nothing and
refuses with `plan_stale`, naming the file: discard the plan and ask again.
Otherwise it writes the planned content byte for byte — line endings included
— and runs the plan's `then` checks, answering each one's exit and findings.
It never stages, commits or pushes: review with `git diff`, then commit.

Only specgate's checks run after a plan: `validate`, `status`, `matrix`,
`questions`, `check`, `draft --check` and `change validate` / `change show`.
Anything else the agent asks for — `rm -rf src` — is reported as `then_refused`
when the plan is made, and never runs.

## Where plans are kept

In the repository's git folder, under `specgate/plans/<id>/`: `plan.json` with
the request, the files and their diffs, the base commit and the SHA-256 of each
file as the agent found it (null for a file that did not exist), and the
content each file would get. Nothing shows in `git status`. An applied or
discarded plan is removed. `agent plans` marks a plan `stale` when one of its
files changed since.

## When it says no

| Code                 | Why                                                       | Fix                                       |
| -------------------- | --------------------------------------------------------- | ----------------------------------------- |
| `agent_not_set`      | No `--agent`, `--profile` or `agent:` in the config.      | `specgate agents init --tool claude`      |
| `agent_failed`       | The agent exited with an error or ran past `--timeout`.   | The message ends with its standard error. |
| `agent_needs_git`    | The project is not in a git repository.                   | `git init`, then commit.                  |
| `plan_empty`         | The agent changed nothing: an answer, not an error.       | Ask with more detail, or mention a REQ.   |
| `plan_stale`         | A file of the plan changed since the agent started.       | `specgate agent discard <id>`, ask again. |
| `plan_not_found`     | No open plan has that id.                                 | `specgate agent plans`                    |

## From a tool

Every command takes `--json`. From Node, the API answers the same documents:

```ts
import { agentAsk, agentApply, agentDiscard, agentPlans } from "@rsaglobaltech/specgate/api";

const { plan } = await agentAsk(dir, "allow cancelling up to 24 h before shipping @REQ-031");
for (const f of plan.files) console.log(f.change, f.path, f.why);
if (plan.id) await agentApply(dir, plan.id);
```

- `agent ask --json`: `{ plan: { id, request, mode, created, files: [{ path, change, why, diff }], then, read, usage: { input, output, cost? } }, status }`; `id` is null for an empty plan.
- `agent apply --json`: `{ applied: { id, written: [{ path, change }], then: [{ command, exit, findings }] }, status }`.
- `agent discard --json`: `{ discarded: { id }, status }`.
- `agent plans --json`: `{ plans: [{ id, request, created, files: [{ path, change }], stale }], status }`.

A refusal rejects with its `code` and `fix`, as in [Automation](automation.md).
