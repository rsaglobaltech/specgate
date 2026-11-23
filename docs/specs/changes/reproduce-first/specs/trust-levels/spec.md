# Delta — trust-levels

## ADDED Requirements

### Requirement: REQ-681 — A reported bug opens a change that must reproduce it

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-681.feature actor=Developer kind=functional -->

The system SHALL, on `specgate reproduce <change-id> --capability <c> --title "<what is broken>" [--ticket <KEY>]`, open a bug change as `specgate propose <change-id> --kind bug --capability <c>` does — lowering the module's trust level when the project declares one — whose delta holds one requirement titled from `--title`, its trace saying `repro=required`, and whose discover names the ticket and the routes where the map reaches the module; and SHALL say that its scenario is to be written as the app should behave, then run red with `specgate reproduce run <REQ>`.

> Phase 2 of the trust curve: a bug is fixed only once it has been seen failing.

#### Scenario: SCN-681a — A bug in catalogo

- GIVEN a project with `trust: { catalogo: 4 }`, and the map reaching catalogo at `/products/:id`
- WHEN the Developer runs `specgate reproduce fix-precio --capability catalogo --title "The price shows without its discount" --ticket KAN-21`
- THEN the change fix-precio is a bug change, its requirement is titled "The price shows without its discount" with `repro=required`, its discover names KAN-21 and `/products/:id`, and catalogo is at level 3

### Requirement: REQ-682 — The bug's scenario is seen red before it is fixed

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-682.feature actor=Developer kind=functional -->

The system SHALL, on `specgate reproduce run <REQ>`, run the requirement's scenarios through `bdd_cmd` with `{tags}` as `@<REQ>`; when they fail, keep `.specgate/evidence/<REQ>/red.json` with the command, its exit code and the date, and `red.log` with its output; when they pass, refuse with `repro_not_red` and keep nothing, since a scenario that passes on today's code does not show the bug; and with no `bdd_cmd`, refuse with `repro_no_runner`.

#### Scenario: SCN-682a — Red, kept

- GIVEN REQ-090 of a bug change, and a `bdd_cmd` that fails for `@REQ-090`
- WHEN the Developer runs `specgate reproduce run REQ-090`
- THEN `.specgate/evidence/REQ-090/red.json` names the command with a non-zero exit code, and the output says the bug is reproduced

#### Scenario: SCN-682b — Green, refused

- GIVEN REQ-090 of a bug change, and a `bdd_cmd` that passes for `@REQ-090`
- WHEN the Developer runs `specgate reproduce run REQ-090`
- THEN it refuses with `repro_not_red`, and no `red.json` is written

### Requirement: REQ-683 — A bug is delivered only after its red

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-683.feature actor=Developer kind=functional -->

The system SHALL, on `specgate apply <REQ>` for a requirement whose trace says `repro=required`, refuse with `apply_not_reproduced` — its fix `specgate reproduce run <REQ>` — unless `.specgate/evidence/<REQ>/red.json` exists; and, once it delivers the requirement, SHALL write into its `evidence.json` the red run beside the green one.

#### Scenario: SCN-683a — Never seen red

- GIVEN REQ-090 with `repro=required` and no `red.json`
- WHEN the Developer runs `specgate apply REQ-090`
- THEN apply refuses with `apply_not_reproduced`, whose fix is `specgate reproduce run REQ-090`, and REQ-090 is not Implemented

#### Scenario: SCN-683b — Red, then green

- GIVEN REQ-090 with `repro=required`, its `red.json` kept, and its scenarios now passing
- WHEN the Developer runs `specgate apply REQ-090`
- THEN REQ-090 is Implemented, and its `evidence.json` holds the red run and the green one
