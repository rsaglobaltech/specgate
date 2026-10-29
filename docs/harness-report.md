# What the harness has cost

`specgate harness report` tells you whether running requirements through
[the harness](harness.md) is paying off: how often the agent's first attempt
passes the gate, and how much time each delivered requirement costs.

**You need:** at least one `specgate harness run` in this project. Each run
records itself in `.harness/runs/<timestamp>.json`, and the report reads those
files. It never runs an agent, git or the network.

```bash
specgate harness report            # every recorded run
specgate harness report --last 5   # the five most recent runs
specgate harness report --json     # the same summary, for a script
```

A report over two runs looks like this:

```
  ◆ specgate · harness report   2 run(s)

  ████████████░░░░░░░░  3 of 5 requirements passed

    requirements attempted    5
    passed                    3
    failed                    1
    blocked                   1

    first attempt worked      67%  (2 of 3 passes)
    cost per delivered REQ    9m 40s  wall-clock, failed attempts included

  Where attempts ended ───────────────────────────────────
       3  gate rejected the work [gate]
       3  passed [pass]
       1  agent timed out [agent-timeout]

  Spent every attempt, delivered nothing ─────────────────
    REQ-004      15m 0s  3 attempt(s)

  Runs over time ─────────────────────────────────────────
    ██  2026-10-14 → 2026-10-16

  failures that were real   —  nothing recorded can tell a real failure from a gate that was
                              wrong — mark one: specgate harness report
                              --mark-false-failure REQ-NNN --reason "..."

  Slowest ────────────────────────────────────────────────
    REQ-004      15m 0s  3 attempt(s), fail
    REQ-002       7m 0s  2 attempt(s), pass
    REQ-003       4m 0s  1 attempt(s), pass
    REQ-001       3m 0s  1 attempt(s), pass
```

## The two numbers that matter

- **First attempt worked** says whether retries are buying anything. A low
  rate means the agent keeps making the same mistake; a different agent per
  attempt may help ([A different agent per attempt](agent-setup.md#a-different-agent-per-attempt)).
- **Cost per delivered requirement** divides all the time spent, including
  attempts that failed, by the requirements that actually passed. That is what
  delivery costs.

The cost is wall-clock time, not tokens: an agent is any shell command, and
only the agent knows what it spent. If a profile declares a
`cost_per_run_hint`, the report adds an estimated spend and labels it
*declared by profile, not measured*.

## Was the gate wrong?

A rejected attempt looks the same whether the work was bad or the gate was.
Only a person can tell, so the report shows "failures that were real" as
unknown until someone records a false failure:

```bash
specgate harness report --mark-false-failure REQ-004 --reason "the test relied on the local time zone"
```

The marks are kept in `.harness/false-failures.jsonl`.

## Where the gap was

A requirement that needed rework fell into one of two gaps:

| Gap | What happened | What to strengthen |
| --- | --- | --- |
| **spec → implementation** | The spec was clear and the code diverged | The validation: the check that caught it |
| **intent → spec** | The spec missed part of the use case | The elicitation: the module's questions, asked earlier |

The report suggests one for each requirement from what it recorded. A
rejection the agent fixed on a later attempt reads as spec → implementation,
naming the stage that rejected it (`pmd`, `test command`). A requirement that
changed after review reads as intent → spec: a question that blocked it was
answered, a review note names it, a change modifies it, or the gate failed on
the specification itself. When both apply, intent → spec wins.

A person's word wins over any suggestion:

```bash
specgate harness report --classify REQ-010 --gap intent-spec --reason "the brief never said a truck can carry two drivers"
```

The section shows each gap's share of the requirements in the ledger, per
module when there is more than one, and what to strengthen: the stage that
caught most spec → implementation gaps, and the module with most intent →
spec gaps. Classifications are kept in `.harness/gaps.jsonl`; `--json` carries
the section as `gaps`, and the studio's report shows both shares.

## The records stay on your machine

`.harness/runs/` contains its own `.gitignore` that ignores every file in the
folder, so git never sees the records. There are two reasons. The harness
refuses to start on a working tree with uncommitted changes, so records git
could see would make the second run refuse to start. And a file every run
rewrites would be a merge conflict on every branch.

The agent command is never recorded, because it can carry an API key.

## The quality of what was delivered

When [quality checks](quality.md) run, each passing requirement's run record
keeps them — stage, verdict, findings, and the diff coverage and mutation
score of the lines it changed — and the report adds a section with the means
and how often each check ran. `--json` carries it as `quality`.

## Next

- [The harness](harness.md)
- [Choosing and wiring your agent](agent-setup.md)
