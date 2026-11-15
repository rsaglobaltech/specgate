# Drive the harness from a tool

An editor or a dashboard — specgate-studio's Build and Live views — starts
`specgate harness run` and follows it without reading prose: the run's JSON,
its stream, the stop command and the API. This page is that contract. For what
the harness does, see [The harness](harness.md).

## Stop after the requirement in progress

```bash
specgate harness stop --after-current
```

The run finishes the requirement it is on and starts no other. The rest are
reported as not attempted, and `--format json` says why under `stopped`
(`by`: `request`). Nothing is killed: the run reads the request between
requirements, the same way on every platform. With no run working in the
project, nothing is requested and the answer says so (`harness_not_running`).

## Build with uncommitted files

The harness refuses a working tree that is not clean. With `--allow-dirty` it
runs anyway: every branch is cut from the last commit, and your uncommitted and
untracked files stay as they are, here, outside the run. The JSON lists them
under `dirty.leftOut`. Not with `--chain`, which merges into this working copy.

## Stream it as JSON

```bash
specgate harness run --format jsonl
```

Stdout carries one JSON object per line and nothing else; progress prose goes
to stderr. The first line is `run-start`, the last is always `run-end`, a
refused run's too. Every line has `type` and `t` (epoch seconds), and `req` and
`attempt` when it is about a requirement:

| `type`                                 | When                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `run-start`                            | Before the first requirement: `queue`, `base`, `concurrency`, `maxAttempts`, `dirty`.               |
| `attempt`                              | An attempt starts (`state`: `start`) or ends (`end`, with `result` and the `stage` it failed at).   |
| `prompt`                               | The prompt an agent step was given: `role`, `chars`, `lines`.                                       |
| `agent-start`, `agent-end`             | Around each agent step; `agent-end` has `exit`, `timedOut` and `ms`.                                |
| `output`                               | What the agent writes, as it writes it: `stream` (`stdout`, `stderr`) and `text`, 4000 characters at most a line. |
| `gate-start`, `gate`                   | Each gate stage, and its `result`, `ms` and test counts.                                            |
| `step`, `message`, `agent`, `usage`    | What the agent's adapter reports: tool calls, its words, its model, tokens and cost (`final`).      |
| `question`                             | The agent asked: `text`, and `id`, `change` and `file` once it is in the project.                    |
| `merge`                                | `--chain` merged the requirement's branch.                                                          |
| `result`                               | A requirement's result, as in `--format json`. A later one for the same `req` replaces it.          |
| `run-end`                              | Last: `report`, the document `--format json` prints, or `null` and `status` when the run was refused. |

The types are `HarnessStreamEvent` and `HarnessRunReport` in
`@rsaglobaltech/specgate/api`. The events files keep what they always held;
`output`, `agent-start`, `agent-end`, `result` and the run's own lines are on
the stream only. With `--concurrency` above 1 each worker's lines reach the
stream whole.

## A question while it runs

When the agent runs `specgate ask`, the harness writes the question into the
project and commits it at once, and a `question` event with its id follows.
The requirement ends as `question`, its result's `waitingForAnswer` naming the
question and the command that answers it. The run does not wait for the
answer: an answer is an assumption to review before the specification says it,
and the gate must judge the scenario that says it. Once it is reviewed, run the
requirement again with `specgate harness run --req <REQ>`.

## Next

- [The harness](harness.md)
- [What the harness has cost](harness-report.md): the estimates in `plan --json`
- [Automation](automation.md): the API, `@rsaglobaltech/specgate/api`
