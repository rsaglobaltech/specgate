# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-310 — The roles of a project

The system SHALL read `roles:` from `harness.config.yaml` as a mapping from a role (product, architect, developer, security, …) to the people who hold it, each matched to the git identity of whoever runs a command (`user.email` or `user.name`, case-insensitive); a role nobody is named for SHALL be open to anyone.

#### Scenario: SCN-310a — Ana holds the product role

- GIVEN `roles: { product: [ana@acme.eu], architect: [carlos@acme.eu] }` and a git identity `ana@acme.eu`
- WHEN the roles of that person are asked for
- THEN they are product and developer — developer because nobody is named for it — and not architect

<!-- specgate:trace status=Implemented test=tests/unit/approvals.test.ts actor=Developer kind=functional -->

### Requirement: REQ-311 — A layer is approved by the role that owns it

The system SHALL record `specgate change approve <id> --layer discover|design|tasks` only for a person holding the layer's owning role — product for the Discover, architect for the Design, developer for the Tasks — and SHALL refuse anyone else, naming the role; without `--layer` it SHALL approve every written layer the person owns.

#### Scenario: SCN-311a — The architect cannot approve the business story

- GIVEN roles naming ana@acme.eu as product and carlos@acme.eu as architect, and a change with all three layers written
- WHEN carlos@acme.eu runs `change approve <id> --layer discover`
- THEN it is refused with `approve_not_owner` naming the product role, and `--layer design` is recorded

<!-- specgate:trace status=Implemented test=tests/unit/approvals.test.ts actor=Developer kind=functional -->

### Requirement: REQ-312 — How many people a layer needs

The system SHALL count a layer approved once as many distinct people as `approvals.quorum.<layer>` says (default 1) have approved its current text.

#### Scenario: SCN-312a — Two architects for the design

- GIVEN `approvals: { quorum: { design: 2 } }` and two people in the architect role
- WHEN the first of them approves the design
- THEN the design still waits for one approval, and it is approved once the second does; the same person twice counts once

<!-- specgate:trace status=Implemented test=tests/unit/approvals.test.ts actor=Developer kind=functional -->

### Requirement: REQ-313 — Who approved which version

The system SHALL record each approval in the change's `approvals.json` — the layer, the person's name and email, the role, the hash of the layer's text and the date — so the record moves with the change into the archive.

#### Scenario: SCN-313a — The audit after the change is closed

- GIVEN a change whose three layers were approved
- WHEN `approvals.json` is read
- THEN it lists one entry per approval with layer, name, email, role, a sha256 hash of that layer and the date

<!-- specgate:trace status=Implemented test=tests/unit/approvals.test.ts actor=Developer kind=functional -->

### Requirement: REQ-314 — A changed layer is approved again

The system SHALL count an approval only while the layer's text has the hash approved; a layer changed afterwards SHALL wait for a new approval, and the change SHALL no longer read as approved.

#### Scenario: SCN-314a — The design is rewritten after its approval

- GIVEN a change whose layers were all approved
- WHEN `design.md` is edited
- THEN the design waits for an approval again, the change is not approved, and the Discover's approval still counts

<!-- specgate:trace status=Implemented test=tests/unit/approvals.test.ts actor=Developer kind=functional -->

### Requirement: REQ-315 — Nothing is built before its approvals

The system SHALL have `harness run` skip, before any worktree or agent, a requirement of an open change whose required approvals are missing, naming the layers that wait and the command that approves them. `approvals.required` SHALL say which changes need them: `layered` (the 1.0 default: changes of the layered schema), `always`, or `never` (the 0.27 behaviour).

#### Scenario: SCN-315a — A 1.0 change nobody approved

- GIVEN an open layered change adding REQ-002, not approved
- WHEN `harness run --req REQ-002` runs
- THEN REQ-002 is skipped with `harness_not_approved`, no agent runs, and with `approvals: { required: never }` it is attempted

<!-- specgate:trace status=Implemented test=tests/unit/approvals.test.ts actor=Developer kind=functional -->

### Requirement: REQ-319 — The studio's Review shows and takes layer approvals

The system SHALL return, for each layer of a draft in the studio's `/api/drafts`, its approvals, how many it needs, whether it is approved and whether the viewer owns it; and SHALL record `POST /api/approve` with a `layer` for the viewer's git identity under the same rules as `change approve`.

#### Scenario: SCN-319a — Ana approves the Discover from the studio

- GIVEN a draft with its layers written and ana@acme.eu as product
- WHEN the studio is asked for the drafts and then posts an approval of the Discover as ana@acme.eu
- THEN the Discover reads as owned by the viewer, and after the post it is approved by ana@acme.eu

<!-- specgate:trace status=Implemented test=tests/unit/approvals.test.ts actor=Developer kind=functional -->
