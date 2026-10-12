# ADR-0023 — Checking content: a gate where it is decidable, a report where it is not

## Status

Accepted — 2026-08-26

## Context

Every check `specgate validate` performed until now read the paperwork, not the
work. Structure, traceability coverage, legal statuses, Gherkin parseability
and — under `--strict-tdd` — three rules over the matrix. All of them answer
"are these documents internally consistent?". None answers "does the code do
what the spec says?".

That gap has a name in this repository. The whole `H` series in
`mejoras/plan-cierre-enterprise.md` §12.11 is one defect repeated — *the gate
approves what it did not check* — and H1 was described as "the negation of the
product". So crossing from paperwork to content is not a feature decision; it
is the decision this project has been circling for a month.

The crossing raises a question the paperwork checks never had to answer. A
structural rule is decidable: a matrix row either has a Scenario ID or it does
not. A content rule usually is not. Three shapes turned up while building
`--strict-requirements`, `--strict-links` and the declared-value comparison,
and they do not want the same answer:

1. **Decidable, and failing is always a defect.** Gherkin that a real parser
   sees as zero steps is never intentional.
2. **Decidable, but failing is sometimes legitimate.** A `Draft` row naming
   the file a requirement is *going to* land in declares a path that does not
   exist yet. That is planning, not drift.
3. **Not decidable at all without asserting a grammar we do not parse.**
   Whether `15m` and `900000` are the same timeout. Whether "the system" in a
   requirement is a subject or part of a response clause.

The third shape is where the temptation lives, and it is the one that has cost
this repository the most. H13 was exactly this: `schemas/pack.schema.json`
declared as "the single authority" by ADR-0020 while nothing validated against
it. A check that claims more authority than it exercises is worse than no
check, because people stop looking.

## Decision

**Three rules, applied to every content check from here on.**

**1. A content check is a gate only when failing it is always a defect.**
Otherwise it is opt-in, or it is not a gate at all.

**2. Every content gate ships opt-in and off by default.** `--strict-tdd`,
`--strict-scenarios`, `--strict-requirements` and `--strict-links` are all
additive flags. A project that turns one on has decided its repository is
clean for that rule. The alternative — on by default, with an escape hatch —
fires on honest work during adoption and gets switched off permanently, which
is how a gate becomes decoration.

This was measured, not assumed. `--strict-links` was first written
unconditional, on the reasoning that a path that does not exist has no
legitimate reading. `tests/unit/validate-strict-tdd.test.ts` disproved it
immediately, and the same reasoning already existed in the codebase:
`declared_artifact_untouched` in `DeclaredArtifacts` is a warning, not a
certainty, for the same reason.

**3. Where the rule is not decidable, ship a report, not a gate — and say so
in the flag's absence.** Declared-value drift (`specgate:trace value_<id>=…`
against `specgate:value <id>=…`) is **not** `--strict-values`. It is a section of
`specgate report` and three additive fields in `--record` history. It classifies
into `matched` / `diverging` / `spec_only` / `code_only` and never decides
pass or fail.

The first design of that feature *was* a binary gate, modelled on the two
flags beside it. It was rejected for two reasons, both about scale rather than
correctness:

- **The cost of annotating grows with the number of checkable facts; coverage
  does not.** Every fact needs its pair of annotations written by hand. A
  large project accumulates hundreds of pairs, and the more there are, the
  likelier someone updates one side and forgets the other — which the check
  catches, but only for what somebody annotated on both sides first.
- **The more complex the system, the smaller the fraction of requirements that
  reduce to a scalar.** A timeout or a retry limit fits. A business rule with
  branches does not.

A hard gate over a partial, hand-maintained annotation set would mostly measure
who remembered to annotate. As a report, partial coverage is honest: it shows
what it knows about and stays silent about the rest — the same shape as
`orphanFeatures`, which does not fail a build either.

**4. No check asserts a grammar it does not parse.** `--strict-requirements`
does not validate EARS. It checks the two things a regex can assert honestly:
that an obligation keyword (RFC 2119) is present, and that a requirement
opening with `IF` resolves with `THEN`. The other four EARS shapes have no
second keyword to be missing. Declared-value comparison is exact string
equality: `15m` and `900000` are different strings, and interpreting units
would be the H13 mistake with a stopwatch.

**5. A finding a user cannot act on is half a feature.** Value drift ships with
its resolution path: `specgate change new <id> --from-value-drift REQ-ID:value_id`
seeds a `## MODIFIED Requirements` delta with the structured `value_<id>`
rewritten to the code's value — and the prose left alone under an explicit
`TODO:`, because rewriting a human's sentence is guessing how it should sound.
The other two routes needed no new command and got none.

## Consequences

- The gate can now fail for reasons that are about content, and every such
  reason is opt-in. Adoption cost stays at zero for existing projects: nothing
  that passed `validate` before fails it now.
- **`specgate validate` has four opt-in gates, not one.** They are documented
  together in [validating.md](../../validating.md), and the user-facing
  command tables list all four. `--strict-scenarios` shipped in 0.7.0 and was
  documented nowhere for three days — a gate users cannot find is a gate that
  does not exist for them, and that is the same defect as H13 pointed at the
  documentation instead of the schema.
- Declared-value coverage is now a measurable number over time
  (`valuesTotal`, `valuesMatched`, `valuesDiverging` in the report history), so
  a later decision to promote it to a gate can be argued from data rather than
  from taste.
- **This ADR does not claim verification.** Nothing here proves code matches a
  spec. It checks more than paperwork and less than behaviour, and the risk
  named in `PLAN_PREDICTABLE_CODE_EVOLUTION.md` §10 stands: the word
  "verification" must not grow faster than what the gate actually checks.

## Alternatives considered

**`--strict-values` as a binary gate.** Rejected above. Reversible: the report
is the data a future gate would need, so promoting it later costs a flag, not
a redesign.

**All content checks on by default, with opt-out.** Rejected. Every existing
project would fail its next `validate` on rows it wrote deliberately, and the
predictable response is to pin the old version or drop the flag forever.

**Parse the code with an AST to infer values rather than annotate them.**
Rejected for this step. It buys accuracy at the cost of a parser per language
and a per-language definition of "the same value", which is the dependency the
plan explicitly costed and refused. Annotation is language-agnostic and
honest about being manual.

**Full EARS grammar validation.** Rejected: no regex parses it reliably, and
this repository has already paid once for a check that claimed authority it did
not exercise (H13, ADR-0020).
