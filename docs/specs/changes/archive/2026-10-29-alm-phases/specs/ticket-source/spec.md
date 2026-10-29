# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-305 — The board follows the change's phase

The system SHALL, on `specgate alm sync`, move the ticket of each change — its `ticket:` or `origin: alm:<key>` in `change.yaml` — to the board state of the change's phase: `proposed` while it is open and none of its requirements is being built, `building` once one has a `harness/REQ-NNN` branch or is Implemented, `archived` once the change is archived. The state of each phase SHALL default per provider (Jira status category, Azure Boards state, a GitHub label or a closed issue, a Linear state type) and SHALL be named in `phases:` of `alm.config.yaml` when a board uses its own; a move already made SHALL NOT be made again, and `--dry-run` SHALL print each move without making it.

#### Scenario: SCN-305a — A change whose first requirement is being built

- GIVEN the open change `alerts` with `ticket: FLEET-12` and a branch `harness/REQ-040` for its requirement REQ-040
- WHEN `specgate alm sync` runs twice
- THEN FLEET-12 is moved once to the provider's building state, and the second run reports it in sync without a request

#### Scenario: SCN-305b — A board with its own states

- GIVEN `phases: { building: "Doing" }` in `alm.config.yaml` and the change `alerts` being built
- WHEN `specgate alm sync --dry-run` runs
- THEN it prints that FLEET-12 would move to "Doing", and nothing is sent to the board

<!-- specgate:trace status=Implemented test=tests/unit/alm-phases.test.ts actor=Developer kind=functional -->

### Requirement: REQ-306 — What the ticket gains comes back as notes

The system SHALL, on `specgate alm pull`, bring into each open change with a ticket the ticket's comments it has not brought before and, when the ticket's description changed since the last pull, a note saying so with its new text, as notes in the change's `review.md` (the same rows as `change note`); it SHALL never rewrite the change's proposal or delta, and a provider that cannot read comments SHALL be reported, not fail the pull.

#### Scenario: SCN-306a — A comment and a new description

- GIVEN the open change `alerts` with `ticket: FLEET-12`, pulled once, and FLEET-12 then gains the comment "Also by SMS" and a changed description
- WHEN `specgate alm pull` runs twice
- THEN `alerts/review.md` gains one note with the comment and one saying the description changed, the second pull adds nothing, and the delta is unchanged

<!-- specgate:trace status=Implemented test=tests/unit/alm-phases.test.ts actor=Developer kind=functional -->

### Requirement: REQ-307 — One sub-issue per repository of a change

The system SHALL, on `specgate alm sync`, create under the ticket of a change that lists `repositories:` in its `change.yaml` one sub-issue per repository, titled with the ticket key, the repository and the change, record each in `.specops/alm-phases.json`, and create none twice; a provider that cannot create sub-issues, or a change with no ticket, SHALL be reported per change.

#### Scenario: SCN-307a — A change across three repositories

- GIVEN the change `follow-shipment` with `ticket: FLEET-20` and `repositories: [fleet, tracking, web]`
- WHEN `specgate alm sync` runs twice
- THEN three sub-issues of FLEET-20 exist, one per repository, and the second run creates none

<!-- specgate:trace status=Implemented test=tests/unit/alm-phases.test.ts actor=Developer kind=functional -->

### Requirement: REQ-308 — Linear is a built-in provider

The system SHALL offer `provider: linear`, which reads `team_key` and the token from the environment variable named by `token_env` (never from the file), and creates, reads, closes, searches, moves and nests issues of that team through Linear's GraphQL API, passing the same conformance suite as the other built-in providers.

#### Scenario: SCN-308a — The conformance suite against Linear

- GIVEN `provider: linear`, `team_key: ENG` and `token_env: LINEAR_TOKEN` in `alm.config.yaml`
- WHEN the ALM conformance suite runs against recorded Linear responses
- THEN creating returns the issue identifier and its URL, a completed issue reads as done, a cancelled one as open, and closing writes a state change

<!-- specgate:trace status=Implemented test=tests/unit/alm-conformance.test.ts actor=Developer kind=functional -->

### Requirement: REQ-309 — An agent reads and moves a change's phase over MCP

The system SHALL offer `specgate alm phase <change>`, which reports the change's phase, its ticket and the board state last set, without network access, and `specgate alm move <change> [<phase>]`, which moves that change's ticket to its phase (or to the phase named), both with `--json` and both exposed as MCP tools.

#### Scenario: SCN-309a — An agent drives the board

- GIVEN the change `alerts` with `ticket: FLEET-12` and a requirement being built
- WHEN an agent calls the MCP tools `specgate_alm_phase` and then `specgate_alm_move` for `alerts`
- THEN the first answers `building` with FLEET-12 and no board state yet, and the second moves FLEET-12 to the building state

<!-- specgate:trace status=Implemented test=tests/unit/alm-phases.test.ts actor=Developer kind=functional -->
