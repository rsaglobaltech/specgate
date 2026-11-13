# Delta — transition

## ADDED Requirements

### Requirement: REQ-542 — Release notes come from what was archived

The system SHALL, with `specgate release-notes <from>..<to> [--out <file>] [--json]`, list the changes archived between the two git refs, grouped by their kind (`Enhancement`, `Bug`, then changes with no kind), each with its proposal's intent and the requirements it delivered with their titles; SHALL write Markdown to `--out` or to standard output; and SHALL refuse an unknown ref with `ref_unknown`.

#### Scenario: SCN-542a — One enhancement and one bug between two tags

- GIVEN a repository where the change `pdf-invoices` (kind `enhancement`, REQ-007) and the change `rounding` (kind `bug`, REQ-009) were archived between the tags `v1.0.0` and `v1.1.0`
- WHEN a tool runs `specgate release-notes v1.0.0..v1.1.0`
- THEN the output has an `Enhancements` section with `pdf-invoices` and REQ-007's title, then a `Fixes` section with `rounding` and REQ-009's title

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-543 — Acceptance is a checklist a person signs

The system SHALL, with `specgate acceptance <change>`, write `docs/specs/changes/<change>/acceptance.md` with one unchecked item per scenario of the change, under its requirement, each with its steps; and with `specgate acceptance <change> --sign "<name>"`, SHALL refuse with `acceptance_incomplete` while an item is unchecked, and otherwise record the name and date in the file and set each of the change's requirements that is `Implemented` to `Verified`.

#### Scenario: SCN-543a — Signed only when every item is checked

- GIVEN a change with REQ-007 `Implemented` and two scenarios
- WHEN a tool runs `specgate acceptance pdf-invoices`, checks one item, runs `--sign "Ana Pérez"`, checks the other and runs `--sign "Ana Pérez"` again
- THEN the first sign is refused with `acceptance_incomplete`; after the second, the file records the name and date and REQ-007 is `Verified`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-544 — A user guide per actor

The system SHALL, with `specgate guide [--actor <name>]`, write `docs/guide/<actor>.md` for each actor — or the one named — with one section per delivered requirement whose `actor=` is that actor, ordered by capability, each holding the requirement's text and its scenarios as numbered steps; and SHALL leave out requirements that are not delivered.

#### Scenario: SCN-544a — The customer's chapter

- GIVEN REQ-001 `Implemented` for `Customer`, REQ-002 `Draft` for `Customer` and REQ-003 `Implemented` for `Clerk`
- WHEN a tool runs `specgate guide --actor Customer`
- THEN `docs/guide/customer.md` has a section for REQ-001 with its scenario as steps, and none for REQ-002 or REQ-003

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-545 — A change says whether it is a bug or an enhancement

The system SHALL accept `specgate propose <change-id> --kind bug|enhancement`, record it as `kind:` in the change's `change.yaml`, and show it in `specgate change show` and `specgate status`; SHALL refuse any other kind with `change_kind_unknown`; and `propose --from-ticket` SHALL set `bug` for a Jira issue of type Bug and `enhancement` otherwise.

#### Scenario: SCN-545a — A bug from the command line

- GIVEN a specgate project
- WHEN a tool runs `specgate propose rounding --kind bug`, then `specgate propose other --kind chore`
- THEN `docs/specs/changes/rounding/change.yaml` has `kind: bug`, and the second is refused with `change_kind_unknown`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
