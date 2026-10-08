# ADR-0030 — Specgate verifies OpenSpec specs it did not write

## Status

Accepted — 2026-10-08

## Context

Spec-driven development has a market, and Specgate is not where most of it
is. GitHub Spec Kit and OpenSpec each own a large share of the teams writing
specs for coding agents. Both are good at producing a specification and a
task list. Neither checks that what its task list calls done is proved:

| Tool | Where "done" is said | What stands behind it |
|---|---|---|
| Spec Kit | `- [X] T012 [US1] …` in `specs/<feature>/tasks.md` | Nothing required. Its own task template marks tests *"OPTIONAL — only if tests requested"*. |
| OpenSpec | `- [x] 1.1 …` in a change's `tasks.md`; the change archived into `openspec/specs/` | Requirements and scenarios are named; nothing links a scenario to a test. |

(Formats read from the tools' own templates and from public repositories that
use them, October 2026; the specification pins the sources.)

OpenSpec does ship an optional `/opsx:verify` workflow (1.14). It is an agent
skill: a model searches the codebase for keywords related to each requirement
and assesses whether an implementation "likely exists", before archiving, and
its report is declared advisory. That helps an agent finish a change; it is
not a deterministic check, it does not link a scenario to a test, and nothing
runs it after the change is archived. Specgate's check is the complement: the
same answer every time, in CI, on every pull request, including the ones that
quietly break a scenario archived months ago.

In each, "done" is a ticked box. A ticked box is exactly the claim Specgate
was built to refuse without evidence — the status-is-a-promise rule
(ADR-0026) — and the Golden State pilot showed what that refusal is worth: it
caught "99/99 done" with 52 scenarios untested, a gap a box-ticking workflow
reports as finished.

Two ways to bring that to those teams were open: ask them to move their specs
to Specgate's format, or meet them where their specs are. The first is a
migration nobody asked for, and it competes with tools that have a hundred
times the adoption. The second is a product nobody else offers.

## Decision

**Specgate reads OpenSpec specifications in place and gates their claims of
done the way it gates its own. It never writes to OpenSpec's files.** OpenSpec
is the one format supported, by decision: of the tools above it is the most
actively maintained and the closest to Specgate's own model — requirements,
scenarios, delta changes, an archive (ADR-0016) — so the check means the same
thing on both sides. Spec Kit has the larger audience; it is out of scope, not
ruled out.

1. **`specgate verify`** reads `openspec/` read-only and maps it onto
   Specgate's model: requirement, scenario, and claim of done. Nothing is
   converted and nothing is written outside `.specgate/`. A team keeps
   OpenSpec; Specgate is the gate in front of the merge.

2. **Every scenario gets a stable id from OpenSpec's own names** —
   `openspec:<capability>/<requirement>/<scenario>` — and a test is linked to it
   **by naming it**, the rule Specgate already uses for `REQ`/`SCN`.

3. **A claim of done owes a test for every scenario it covers.** An archived
   change owes the current scenarios of every requirement it added or
   modified. With `--run`, the test command must pass too. A scenario whose
   text changed after it was verified must be verified again.

4. **Adoption never turns a project red on day one** (ADR-0023). `--since
   <git-ref>` gates only claims made after the ref; everything older is a
   report. A project raises the bar when it chooses to.

5. **It is proved before it is offered.** It ships only after a pilot in which
   defects are planted on purpose — changes archived without tests, failing
   tests, scenarios edited after verification — and `verify` finds all of them
   with no false alarm on the honest work. OpenSpec's format is pinned in
   fixtures and re-read on a schedule, because it releases weekly.

## Consequences

- Specgate's position becomes "write your spec with OpenSpec; Specgate
  guarantees what it calls done is done". The daily loop of an OpenSpec team
  does not change; one check is added to their PRs.
- One reader to maintain against a format Specgate does not control. The
  scheduled re-read turns a format change into a failing job, not a silent
  skip — an unparseable file is an error, never zero scenarios.
- `verify` reuses the gate, the link-by-mention rule and the agent contract;
  the new code is the reader and the claim rules.
- Naming a scenario in a test is a convention OpenSpec teams do not have yet.
  `verify --ids` prints the names to copy, and the check reports which
  scenarios are unnamed.
- What it cannot say stays stated: a test that names a scenario and passes is
  evidence the scenario was exercised, not proof it was asserted correctly.

## Alternatives considered

- **Import into Specgate's format.** A one-way migration, a second source of
  truth, and a reason not to adopt.
- **A plugin for OpenSpec.** Its release cycle, its decision about what a
  plugin may block. A CI check is the one place every team already accepts
  being blocked.
- **Only Specgate's own format.** Keeps the codebase smaller and the product
  invisible.
- **Spec Kit and Kiro readers too.** Spec Kit has the largest audience and
  Kiro's tasks already reference criteria. Both left out by decision of the
  team this was designed for, to do one format well; the reader interface
  (`ForeignSpec`) does not preclude adding them.

## References

- [Verifying other tools' specs — specification](../verify-foreign-specs.md)
- ADR-0016 — Delta spec format; ADR-0023 — Gate where decidable, report where
  not; ADR-0026 — The default gate is the strong gate; ADR-0029 — Drafting
  from a brief
