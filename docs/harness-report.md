# What the harness has cost

```bash
specgate harness report            # everything recorded
specgate harness report --last 5   # the five most recent runs
```

Every run writes `.harness/runs/<timestamp>.json`, and the report reads them:

```
  📈 harness report  (12 run(s))

    requirements attempted    31
    passed                    24
    failed                     5
    blocked                    2

    first attempt worked      67%  (16 of 24 passes)
    cost per delivered REQ    4m 12s  wall-clock, failed attempts included
```

**Two numbers, chosen because they decide things.** "First attempt worked" says
whether the retry ladder is buying anything or spending three times as much on
the same mistake. "Cost per delivered requirement" divides _all_ the time —
including the attempts that failed — by the requirements that actually landed,
because that is what delivery costs.

Wall-clock, not tokens: an agent is any shell command, and only the agent knows
what it spent. Recording a number the harness cannot observe would be worse
than recording none.

**The ledger is local.** `.harness/runs/` ignores itself, for two reasons: the
harness refuses to start on a dirty tree, so a ledger git could see would mean
the first run makes the second one refuse; and a file every run rewrites is a
merge conflict waiting to happen. The agent command is never recorded — it is
the kind of string that carries an API key.

---

## Next

- [The harness](harness.md)
- [Command reference](commands.md)
