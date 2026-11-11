# Proposal: harness-control

## Intent

specgate-studio drives `specgate harness run` from its Build and Live views,
and may only read `--json`, the API (`@rsaglobaltech/specgate/api`) or
documented files — never prose. Building it on 0.33.2 found five gaps:

1. `harness run` refuses any uncommitted file, so a person with a note open
   cannot build at all.
2. Stopping after the requirement in progress exists only as an internal file
   the old studio writes (REQ-209): no command, no API, and the run's JSON
   does not say it stopped because it was asked to.
3. `plan --json` has no cost hints and `harness report --json` only project
   averages: Build cannot say what a requirement will take before it starts.
4. A question the agent asks gets its id only when the whole run ends, so it
   cannot be answered while the run goes on.
5. Progress exists only in `.harness/events/<REQ>.jsonl` and stderr is prose:
   there is no stream to read the run from.

## Scope

In scope:

- `harness run --allow-dirty`: branches from the last commit, the uncommitted
  files left as they are, and `dirty.leftOut` in the JSON (REQ-490).
- `specgate harness stop --after-current [--json]`, `harnessStop(dir)` in the
  API, and `stopped` in the run's JSON (REQ-491, REQ-492).
- `estimates` in `plan --json`: time, and cost when a profile declares a price,
  each with its basis (REQ-493).
- A question recorded and committed as soon as the agent asks it, with an
  event carrying its id; the requirement ends waiting for the answer, and its
  result says which question (REQ-494, REQ-495).
- `harness run --format jsonl`: one JSON event per line on stdout, also from
  parallel workers, documented in `types/api.d.ts` and `docs/harness-control.md`
  (REQ-496, REQ-497).

Out of scope:

- Waiting within the run for the answer and resuming the requirement. An
  answer becomes an assumption a person reviews before the specification says
  it (REQ-188); building on it first would let the gate judge a scenario that
  does not say what was answered, and the waiting run would hold its lock, its
  worktree and, with `--chain`, the working copy. Once answered and reviewed,
  `harness run --req <REQ>` runs it again.
- Stopping a requirement in the middle: `stop --after-current` never signals a
  process, so nothing platform-specific is killed.
- Changing what `.harness/events/<REQ>.jsonl` holds: the stream adds its own
  events (`output`, `agent-start`…) on stdout only.
- A measured token cost: the harness still cannot see an agent's tokens; the
  stream forwards the adapter's `usage` events, and the estimate prices only
  what profiles declare.

## Approach

`--allow-dirty` only lifts the clean-tree check: worktrees were already cut
from a commit, so the change is to list what `git status` shows and say it.
The stop command writes the stop file REQ-209 already reads, only when a run
holds the lock. Estimates are a pure function in core over the run ledger, the
scenario steps of each requirement and the profiles' cost hints. The question
and the stream both live in `deadline-runner`, the small process that already
runs beside every agent step while the harness waits on it: it tails the
requirement's events file, records a question the moment `ask` writes it, and
— when the run streams — forwards each event and the agent's output on an
extra file descriptor that is the run's stdout (or, for a worker, a pipe the
parent reads line by line, so parallel lines never interleave).
