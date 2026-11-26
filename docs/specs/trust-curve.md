# The trust curve — plan

How Specgate earns an agent the right to work alone, area by area. Sources: Lauren Tan on
running GrokBot's agents (the trust curve), and a summary of it built on three mechanisms —
feedback loops, agent evals and guardrails. Decision: [ADR-0046](adr/0046-trust-levels-per-module.md).
Worked locally until polished; one change per phase, each through the gate.

| Mechanism | Today | Phase |
|---|---|---|
| Feedback loop: the agent checks its own work with tests | `apply` runs tests, architecture and scenarios | — |
| Feedback loop: the agent uses the app as a person would | Playwright scenarios, written in advance | 1 |
| Feedback loop: a map of where each feature lives | The matrix, use cases, `brief model` | 1 |
| Feedback loop: a reported bug reproduced before it is fixed | — | 2 |
| Evals: errors become instructions | Studio review notes (REQ-339) | 4 |
| Evals: agents examining agents, skills measured | — | 5 |
| Evals: good code, not only correct code | `review_profile`, `arch_cmd` | 5 |
| Guardrails: what the agent cannot skip | Principles `forbid=`/`run=`, `protected_paths` | 4 |
| Trust earned per area, raised by a person, lowered by a bug | — | 0, 3 |

## Phase 0 — the model (change `trust-levels`, REQ-670..674)

A level per capability in `.specgate/gate.yaml` (1 observed, 2 confined, 3 verified,
4 unattended, 5 triage); the harness obeys it; a rise only through an approved change, recorded
in `.specgate/trust-ledger.jsonl`; a bug change lowers it at once; `specgate trust` shows the
evidence. Level 6, merging alone into the main branch, waits: with `trust:`, `--chain` works only
on a branch of your own, and a person merges that branch (REQ-694).

## Phase 1 — verify with evidence (S) → 1.6

- `specgate map --json`: per requirement, its use case, the screen or route where it is reached,
  its feature, its code and its test.
- **The agent opens the app and navigates it with the map**: a browser tool handed to the agent
  (Playwright MCP or the project's own runner), starting from the map's route for the
  requirement, to explore beyond the written scenarios and to reach a reported bug.
- `apply` keeps the evidence of each delivery — scenario results, Playwright screenshots and
  traces — in `specgate/applied/<REQ>/`.

## Phase 2 — reproduce before fixing (M) → 1.6

- `specgate reproduce <ticket>`: the bug enters as a scenario that must fail first, reached
  through the map and the browser of phase 1.
- `apply` requires having seen it red, then green.
- The bug is linked to its capability: the leak that lowers its level (REQ-673).

## Phase 3 — levels in the gate and the harness (M) → 1.7

- The harness reads the capability's level and does only what it allows; evidence from phases 1
  and 2 feeds `specgate trust`.
- The studio shows each module's level in Topo.

## Phase 4 — from error to barrier (M) → 1.7

- `specgate learn` reads the studio's review notes (REQ-339) and repeated red attempts, and
  proposes an instruction; when it keeps being skipped, a principle `forbid=` or `run=`. Each
  enters as a change a person approves.
- Studio: "Turn into a rule" on a review note.

## Phase 5 — skills examined (L) → 1.8

- `specgate eval <skill>`: fixed tasks from a corpus, N agents in parallel with the skill.
- **Scored on two axes**: correct — the gate passes — and good — a reviewer agent with the
  project's `review_profile`, plus `arch_cmd` and the quality checks (ADR-0040): readability,
  boundaries kept, duplication, size.
- A history per skill version: whether it improves, regresses or contradicts another skill.
- Its results feed promotions.

## Later

Level 6 — merging alone (`--chain`) — where a capability has earned it, once levels 1–5 have
been used on real projects.
