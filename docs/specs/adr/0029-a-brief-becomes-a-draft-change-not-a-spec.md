# ADR-0029 — A brief becomes a draft change, not a spec

## Status

Accepted — 2026-10-08

## Context

Specgate checks a specification hard and builds from it well. Measured on the
Golden State Reinforcing pilot — a real field app built from a one-page brief
with six domain packs:

- the harness passed **74 of 76** requirement runs on their first attempt;
  the other two failed on Specgate defects, since fixed, not on the code;
- the gate, the derived matrix and `done` kept every status honest.

Getting from the brief to that specification was the slow, error-prone part,
and nothing in the tool helped:

- writing 46 requirements, 31 use cases and their scenarios by hand took most
  of a day;
- **16 of 46 requirements shipped with no scenario**, and `pack lint` said
  nothing;
- **no scenario asked for an HTTP route or a screen**, so the app reached
  "48/48 done" with 59 use cases and nothing a user could touch. Specgate
  verified exactly what was specified; what was specified was incomplete.

None of these were failures of judgement about the domain. They were omissions
a checklist catches — and the checklist lived only in the author's head.

The team that asked for this works from briefs ("fichas") like that one, from
Jira epics, and sometimes from BPMN. They want a first draft, not a finished
spec: something to review and correct instead of a blank page.

Two constraints hold from earlier records:

- **SDD stays human-owned.** A specification is the contract an agent is
  judged against (the harness's write scope, ADR-0026's promises). An agent that
  writes the contract *and* the code grades its own homework.
- **A check is a gate only where it is decidable** (ADR-0023). "Is this the
  right requirement?" is not decidable; "does every requirement have a
  scenario?" is.

## Decision

**`specgate draft` turns a brief into a proposed change. An agent writes the
draft; a deterministic checklist decides whether the draft is complete enough
to review; a person decides what it becomes.**

1. **A draft is a change, never a spec.** `specgate draft --from brief.md`
   opens a change (`change new`, so the `REQ` range is reserved) and has an
   agent write its artefacts inside the change directory, exactly as
   `change author` already does. Nothing reaches `spec.md`, a capability spec
   or `features/` until a person runs `change archive`. A project that installs
   packs gets the same draft as a pack fragment (`--as-pack`) instead.

2. **The checklist is the contract, and it is code.** The draft is validated
   by rules that decide, without judgement, what the pilot showed is forgotten:

   | Rule | A draft fails when |
   |---|---|
   | D1 | a requirement has no scenario |
   | D2 | a requirement has no `kind` (`functional`, `non-functional`, `business-rule`) |
   | D3 | a use case a person drives has no scenario on each surface the brief declares (`api`, `mobile`, `web`) |
   | D4 | a non-functional requirement states no number with a unit |
   | D5 | a business rule that cites a law, standard or contract names no source |
   | D6 | a scenario uses a value that is not in the brief and is not listed as an assumption |
   | D7 | an open question is not attached to the requirements it blocks |
   | D8 | the draft holds more requirements than the review limit (default 25) |

   D6 and D7 are what make a draft safe to review: an invented value cannot
   pass for a fact, and a question cannot hide in prose.

3. **Doubt is a status, not a guess.** Every question the agent cannot answer
   from the brief goes to `questions.md` and marks the requirements it blocks
   `Needs Clarification`. The harness already refuses those (readiness), so an
   unresolved question cannot be built around.

4. **The agent is the one the project already has.** The draft uses the
   project's agent profile (`.harness/profiles.yaml`), confined and gated like
   `change author`. With no agent configured, `draft` writes the prompt and
   the checklist to a file, for any chat assistant, and validates whatever
   comes back. Specgate does not call a model API itself.

5. **One module per draft.** A brief with six modules is six drafts, each
   reviewed on its own. D8 enforces it: a draft nobody can review in one
   sitting is approved without being read.

6. **The checklist is not only for drafts.** D1–D5 run against hand-written
   specs too, as a report in `status` and `plan` (ADR-0023: a
   report on existing projects, so adopting a release never turns a green
   project red), and as a gate inside a draft.

7. **It is measured before it is built out.** The pilot left a reference: the
   Golden State brief and the reviewed packs v0.2.0 built from it. A prototype
   is run on that brief and compared with the reference before the command
   ships (the specification states the protocol and the bar).

## Consequences

- The specification step gets the same discipline as the build step: a
  machine-checked contract and a human decision, with the agent in between.
- Reviewing a draft is reading a diff of a change — `change` already shows
  deltas, so no new review surface is needed.
- `assumptions.md` and `questions.md` become part of a change. `change
  archive` refuses while a question is open or an assumption is unconfirmed.
- The quality of a draft is bounded by the brief. A brief that says nothing
  about payroll exports gets questions, not requirements — which is the
  intended outcome.
- A new top-level command, outside the daily five; the daily loop does not
  grow.

## Alternatives considered

- **Call a model API from Specgate.** A second agent integration to maintain,
  keys to manage, and a different behaviour from the harness. The project's
  agent is already configured and already confined.
- **A questionnaire instead of an agent.** Deterministic, and it would have
  caught D1–D3 — but it does not read a brief, and the blank page is what the
  team asked to remove.
- **Write straight into `spec.md`.** Fastest, and it removes the human
  decision the method depends on.
- **Draft the whole product at once.** One draft for six modules is a draft
  nobody reviews; D8 exists because of it.
- **Only a checklist, no draft.** Worth shipping on its own (decision 6), but
  it leaves the blank page in place.

## References

- [Drafting from a brief — specification](../draft-from-brief.md)
- [Golden State pilot — evaluation](../../../mejoras/golden-app-evaluation.md)
- ADR-0015 — Change lifecycle; ADR-0016 — Delta spec format;
  ADR-0022 — Patterns are optional;
  ADR-0023 — Gate where decidable; ADR-0026 — The default gate is the strong
  gate; ADR-0027 — Use cases are a layer
