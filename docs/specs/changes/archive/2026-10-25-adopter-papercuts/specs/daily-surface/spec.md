# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-178 — Three papercuts on a first project

The system SHALL not warn B9_actor_unnamed about the only declared actor of a brief written in the first person, and with several actors SHALL say in the fix that the author is to be named; `specgate harness init` SHALL keep an existing `.harness/prompt-prefix.md` that differs from the generated one, saying it was kept, unless `--force` is given; and `specgate validate` without a directory SHALL exit 2 naming `specgate validate .` with the flags it was given.

#### Scenario: SCN-178a — A first-person brief with one actor

- GIVEN a brief with the one actor Fahrschüler, written "Soy hispanohablante… Quiero una web personal…"
- WHEN the brief is checked
- THEN no B9_actor_unnamed warning is given, and with a second actor Prüfer both are warned with a fix that names the first person

#### Scenario: SCN-178b — An edited prompt prefix survives harness init

- GIVEN a project where `harness init` ran and `.harness/prompt-prefix.md` was then edited
- WHEN the developer runs `specgate harness init --project-dir .`
- THEN it exits 0, the prefix is unchanged, and the output says it was kept; with `--force` it is replaced

#### Scenario: SCN-178c — Validate without a directory

- GIVEN any folder
- WHEN the developer runs `specgate validate --strict`
- THEN it exits 2 and stderr names `specgate validate . --strict`

<!-- specgate:trace status=Implemented test=tests/unit/adopter-papercuts.test.ts actor=Developer kind=functional -->
