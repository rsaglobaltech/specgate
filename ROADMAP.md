# Roadmap

Ideas kept for later. Each was an issue, closed as _not planned_ so the tracker holds only work in
progress; its discussion stays on the issue, and it is reopened when work on it starts.

In progress: [#493](https://github.com/rsaglobaltech/specgate/issues/493) (the rest of the brief) and [#546](https://github.com/rsaglobaltech/specgate/issues/546) (gate policy per branch,
waivers, annotations/SARIF). Locally: the trust curve ([docs/specs/trust-curve.md](docs/specs/trust-curve.md)).

## From a field run (2026-11-27)

Frictions a project reported after a full run, checked against 1.6.0, in the order they are taken.

1. **Small fixes (1.7.0: `--guide` adds to the public surface).**
   - The `draft` skill names guides that exist: `propose --from-brief --guide setup|cards` prints them
     (change `brief-guides`, REQ-796, REQ-797). The files were written only in some branches.
   - A trace value cut at a space (`actor=Adulto responsable` stored as `Adulto`) is reported, from one
     parser instead of three (`SpecParser`, `domain-docs`, `DomainView`).
   - A `> Brief: "…"` quote is checked against the brief: today nothing reads it back.
2. **List the plugin on agenticskills.io**, as one entry, with the npm CLI named as a prerequisite.
3. **A stricter gate (1.7.0).**
   - A requirement links to a test by `@REQ-NNN`, a test name or `test=`, not by any mention
     (`link: strict` in `gate.yaml`, the default in 2.0).
   - `check` warns while scenarios exist and `bdd` is not `required`: it already does
     (`bdd_not_set_up`, REQ-661; apply's note, REQ-735).
   - `apply` suggests `test_cmd_affected` when the whole suite took two minutes or more (change
     `slow-tests-hint`, REQ-802). `init` guessing `{files}` per runner was dropped: a wrong guess
     runs the whole suite while looking scoped.
4. **Evidence before and after (1.8.0, with an ADR).** Screenshots and video of the affected web scenarios
   on the base commit and on the change; a sequence or class diagram for a backend change; a summary for
   the pull request. Builds on `.specgate/evidence/`, which keeps only the after today.
5. **Later.** Vertical slices and an explicit stub state, so a fine-grained requirement needs no
   temporary 501; a semantic review of a requirement against its brief quote, as an agent check outside
   the deterministic gate; turning a written rule into a gate check. Risk per change is #504.

## Modelling

- [#545](https://github.com/rsaglobaltech/specgate/issues/545) Business processes in BPMN 2.0 — each activity a use case, each path a scenario.
- [#509](https://github.com/rsaglobaltech/specgate/issues/509) Link requirements and ADRs both ways (ISO 42010).

## Requirements and the gate

- [#503](https://github.com/rsaglobaltech/specgate/issues/503) Verification method and test level per requirement (ISO 29148, ISO 29119).
- [#504](https://github.com/rsaglobaltech/specgate/issues/504) Risk per requirement, and a gate whose rigour follows it (ISO 31000, ISO 29119).
- [#505](https://github.com/rsaglobaltech/specgate/issues/505) `specgate impact`: what a requirement change touches (ISO 12207).

## Interchange and compliance

- [#506](https://github.com/rsaglobaltech/specgate/issues/506) ReqIF export and import, to exchange requirements with DOORS, Polarion and Jama.
- [#507](https://github.com/rsaglobaltech/specgate/issues/507) Regulated profile: an audit evidence package (IEC 62304, ISO 26262, DO-178C).
- [#508](https://github.com/rsaglobaltech/specgate/issues/508) Supply chain: SBOM on releases, signed Docker image, OpenSSF Scorecard, stated SLSA level.
- [#510](https://github.com/rsaglobaltech/specgate/issues/510) Accessibility: the docs site and the studio against WCAG 2.2 AA.

## Tools and adoption

- [#536](https://github.com/rsaglobaltech/specgate/issues/536) StudioApp: a visual editor once the pack format is stable.
- [#534](https://github.com/rsaglobaltech/specgate/issues/534) Demo: Phase 1 with opencode running the bootstrap prompt live.
- [#100](https://github.com/rsaglobaltech/specgate/issues/100) GATE-G3 — an outside team adopts L1–L2 and reports back.
