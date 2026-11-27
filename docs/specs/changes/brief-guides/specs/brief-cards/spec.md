# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-796 — The brief's guides are printed on request

<!-- specgate:trace actor=Developer kind=functional feature=features/brief-cards/REQ-796.feature -->

The system SHALL, when `specgate propose --from-brief --guide setup` runs, print the guide an agent follows to propose the brief's front matter, and when `--guide cards` runs, the guide to propose a section per module, naming the modules of the brief's front matter — writing no file, so the working tree stays as it was; SHALL refuse `--guide cards` with `draft_guide_no_modules` while the front matter lists no module; and SHALL refuse any other value as a usage error.

> Reported on 2026-11-27: the `draft` skill sent the agent to `docs/specs/BRIEF-CARDS.md`, which only `--agent` writes, and to `docs/specs/BRIEF-SETUP.md`, which is not written while the front matter has problems; the agent read Specgate's source to learn the format.

#### Scenario: SCN-796a — The cards guide

- GIVEN `docs/brief.md` whose front matter lists `courses` and `lessons`, and no `## Module:` section
- WHEN `specgate propose --from-brief --guide cards` runs
- THEN it prints the guide to propose the module sections, naming `courses` and `lessons`, and `docs/specs/BRIEF-CARDS.md` does not exist

#### Scenario: SCN-796b — The setup guide while the front matter has problems

- GIVEN `docs/brief.md` whose front matter lists no module
- WHEN `specgate propose --from-brief --guide setup` runs
- THEN it prints the guide to propose the front matter, and `docs/specs/BRIEF-SETUP.md` does not exist

#### Scenario: SCN-796c — No module to write cards for

- GIVEN `docs/brief.md` whose front matter lists no module
- WHEN `specgate propose --from-brief --guide cards --json` runs
- THEN it fails with `draft_guide_no_modules`, whose fix names `--guide setup`

### Requirement: REQ-797 — The draft skill sends the agent to a guide that exists

<!-- specgate:trace actor=Developer kind=functional feature=features/brief-cards/REQ-797.feature -->

The system SHALL, in the `draft` step every agent tool is given, send the agent to `specgate propose --from-brief --guide setup` when the front matter is missing or needs fixes, and to `--guide cards` when the brief has no `## Module:` section, instead of a file Specgate may not have written; and SHALL name the same command where `specgate propose --from-brief` reports those two states.

#### Scenario: SCN-797a — The step names the command

- GIVEN the `draft` step as `specgate agents init` writes it
- WHEN an agent reads it
- THEN it names `specgate propose --from-brief --guide setup` and `--guide cards`, and neither `docs/specs/BRIEF-SETUP.md` nor `docs/specs/BRIEF-CARDS.md`

#### Scenario: SCN-797b — The overview names the cards guide

- GIVEN `docs/brief.md` with a complete front matter listing `courses` and `lessons`, and no `## Module:` section
- WHEN `specgate propose --from-brief` runs
- THEN its output names `specgate propose --from-brief --guide cards`
