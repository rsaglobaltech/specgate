# Delta — trust-levels

## ADDED Requirements

### Requirement: REQ-670 — Each module declares how far an agent may go in it

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-670.feature actor=Developer kind=functional -->

The system SHALL read `trust:` in `.specgate/gate.yaml` as a map from a capability to a level — 1 observed, 2 confined, 3 verified, 4 unattended, 5 triage — a capability the map does not name being at 1 once the map exists; SHALL fail the gate with `trust_invalid` for a level outside 1–5 and `trust_unknown_capability` for a name that is no capability, each with its fix; and SHALL neither report nor enforce anything in a project with no `trust:`.

> The trust curve: watch locally, controlled changes, independent verification, unattended runs, error triage, merging alone — earned per area, with evidence. Level 6, merging alone, waits for a later change.

#### Scenario: SCN-670a — A level out of range

- GIVEN a project whose gate.yaml has `trust: { pedidos: 6 }`
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `trust_invalid` naming pedidos and 6, whose fix says the levels are 1 to 5

#### Scenario: SCN-670b — No trust declared

- GIVEN a project whose gate.yaml has no `trust:`
- WHEN the Developer runs `specgate check`
- THEN no finding names trust, and the gate passes as it did

### Requirement: REQ-671 — The harness does in a module only what its level allows

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-671.feature actor=Developer kind=functional -->

The system SHALL, on `specgate harness run` in a project with `trust:`, before cutting any worktree, skip each requirement its capability's level does not allow — level 1 never; level 2 only a requirement named with `--req` and with a concurrency of 1; level 3 every pending requirement, one at a time; level 4 at any concurrency; and the requirements of a change opened with `--kind bug` only at level 5 — reporting each skipped requirement with `trust_level`, its capability's level and the level it needs; and SHALL refuse `--chain` with `harness_trust_chain`, merging alone being a level no capability can declare yet.

#### Scenario: SCN-671a — An observed module is left to a person

- GIVEN a project with `trust: { pagos: 1, catalogo: 3 }` and REQ-040 of pagos and REQ-050 of catalogo pending
- WHEN the Developer runs `specgate harness run`
- THEN REQ-050 runs, and REQ-040 is skipped with `trust_level`, level 1 and needing 3

#### Scenario: SCN-671b — A confined module runs one named requirement

- GIVEN a project with `trust: { pagos: 2 }` and REQ-040 and REQ-041 of pagos pending
- WHEN the Developer runs `specgate harness run --req REQ-040`
- THEN only REQ-040 runs; and `specgate harness run --concurrency 2` skips both, needing 4

#### Scenario: SCN-671c — No merging alone

- GIVEN a project with `trust: { catalogo: 5 }`
- WHEN the Developer runs `specgate harness run --chain`
- THEN the harness refuses with `harness_trust_chain` before any worktree

### Requirement: REQ-672 — A level rises only through a change a person approved

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-672.feature actor=Developer kind=functional -->

The system SHALL keep `.specgate/trust-ledger.jsonl`, one line per level change with the capability, the level it went from and to, the reason — `declared`, `promotion`, `leak` or `lowered` — the change that carried it and the date; SHALL record a capability's first declared level as `declared` and a level lowered by hand as `lowered` on the next `check`; SHALL, on `specgate trust promote <capability>`, open the change `trust-<capability>-<level>` with the evidence in its Discover, and, once its layers are approved, append its `promotion` line and write the new level; and SHALL fail the gate with `trust_raised_unapproved` when a capability's level in gate.yaml is above its last ledger line.

#### Scenario: SCN-672a — Raised by hand

- GIVEN a project whose ledger's last line for catalogo is level 3
- WHEN the Developer writes `catalogo: 4` in gate.yaml and runs `specgate check`
- THEN the gate fails with `trust_raised_unapproved` for catalogo, whose fix is `specgate trust promote catalogo`

#### Scenario: SCN-672b — Promoted by an approved change

- GIVEN catalogo at level 3 and `specgate trust promote catalogo` run
- WHEN a person approves the change trust-catalogo-4's three layers
- THEN gate.yaml says `catalogo: 4`, the ledger ends with a `promotion` line from 3 to 4 naming trust-catalogo-4, and `specgate check` passes

### Requirement: REQ-673 — A bug in a module lowers its level at once

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-673.feature actor=Developer kind=functional -->

The system SHALL, on `specgate propose <change-id> --kind bug --capability <capability>` in a project with `trust:`, write the capability's level one lower in gate.yaml, never below 1, and append a `leak` line naming the change, in the same command and with no approval; and SHALL say so in its output.

#### Scenario: SCN-673a — A bug escaped from catalogo

- GIVEN a project with `trust: { catalogo: 4 }`
- WHEN the Developer runs `specgate propose fix-precio --kind bug --capability catalogo`
- THEN gate.yaml says `catalogo: 3`, the ledger ends with a `leak` line from 4 to 3 naming fix-precio, and the output says catalogo went down to 3

### Requirement: REQ-674 — How much each module has earned

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-674.feature actor=Developer kind=functional -->

The system SHALL, on `specgate trust`, show for each capability its level and its name, its applied requirements, its green streak — the requirements applied and harness attempts passed since its last leak, with no failed attempt — its leaks, and, when the streak reaches `trust.promote_after` in gate.yaml (10 by default) and its level is below 5, that it is ready, with the command that proposes the promotion; and SHALL give the same as JSON with `--json`.

#### Scenario: SCN-674a — Ready for a promotion

- GIVEN catalogo at level 3 with 10 requirements applied since its last leak and no failed attempt
- WHEN the Developer runs `specgate trust --json`
- THEN catalogo has `level` 3, `name` "verified", `streak` 10 and `ready` true, with `next` "specgate trust promote catalogo"

#### Scenario: SCN-674b — A leak resets the streak

- GIVEN catalogo with a streak of 7 and then a bug change proposed for it
- WHEN the Developer runs `specgate trust`
- THEN catalogo shows a streak of 0 and one leak, and is not ready
