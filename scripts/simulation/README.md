# Simulated adoption (`GATE-G6`)

Agents adopting the tool cold, in unfamiliar repositories, to produce the kind
of defect the earlier pilots produced — H14 through H17 were all found by
somebody typing the first command without the author's map.

**Read [ADR-0025](../../docs/specs/adr/0025-simulated-adoption-is-not-external-adoption.md)
first.** It says what this proves and, more importantly, what it does not: this
closes `GATE-G6`, never `GATE-G3`, and does not move 1.0.

## The isolation is the experiment

An agent with this repository checked out reads the answer instead of
discovering it, and the run is worthless. `setup.sh` builds a sandbox that has:

| Present                                                                             | Absent                                         |
| ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| `npx @rsaglobaltech/specgate@latest` from the public registry                       | Any checkout of this repository                |
| The published documentation, fetched at `https://rsaglobaltech.github.io/specgate/` | `examples/`, `mejoras/`, the source, the tests |
| One unfamiliar repository, at a pinned commit, with its test command                | Any context from the session that set this up  |
| `BRIEF.md` — the whole of what the agent is told                                    | Anything else                                  |

`BRIEF.md` is committed. If a run turns out to have had more than this, the run
is void and the assessment says so — an isolation nobody checked is a claim, not
a control.

## The brief frames a sceptic, not an adopter

An agent asked to adopt will adopt. The brief casts a **sceptical engineer with
a deadline**, and gives explicit permission to conclude the tool is not worth it
and say why. That exit is what makes a "yes" mean anything.

## Running one

```bash
scripts/simulation/setup.sh acme-logistics https://github.com/some/repo <commit>
# then, from inside the sandbox, with an agent that has no other context:
#   <your agent> "$(cat BRIEF.md)"
scripts/simulation/collect.sh acme-logistics
```

`collect.sh` lifts the evidence out: the shell history, every CLI transcript, and
the `.harness/runs/*.json` ledger — which git-ignores itself by design, because
those are local measurements rather than shared history, so publishing them
means copying them out rather than committing them in place.

## What comes back

One `mejoras/sim-<company>-assessment.md` per company, in the shape
`lixi-pilot-assessment.md` and `lakebase-pilot-assessment.md` already use: pinned
commit, a provenance oath, a verdict, pasted transcripts **including the ones
that make the tool look bad**, a friction table with `L<n>` ids, and an update
rule.

Every defect is reproduced from this repository, with a failing test, before it
is filed. A finding that does not reproduce is an anecdote.

## The step that is not delegated

`harness report` leaves `realFailureRate` at `null` until somebody marks a
failure as the gate's fault rather than the agent's, because _"guessing 100%
would be the most flattering possible lie about our own gate"_. A maintainer
adjudicates, by hand, into `.harness/false-failures.jsonl`. An agent adjudicating
its own run is the gate approving its own work.
