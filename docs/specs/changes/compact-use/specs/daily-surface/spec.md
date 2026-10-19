# Delta — daily-surface

## Purpose

The commands a developer uses every day: one loop of four verbs — propose,
apply, archive, status — over the gates Specgate already has.

## ADDED Requirements

### Requirement: REQ-107 — The default help shows four verbs

The system SHALL show, in `specgate --help`, only `init` under "Start here",
`propose`, `apply`, `status` and `archive` under "Every day" in that order, and
`check` under "CI", and SHALL name `specgate --help --all` as the place for
every other command.

#### Scenario: SCN-107a — A new developer reads the help

- GIVEN a project initialised with `specgate init --yes`
- WHEN the developer runs `specgate --help`
- THEN the developer sees exactly 6 commands: `init`; `propose`, `apply`, `status`, `archive`; `check`
- AND a last line naming `specgate --help --all`
- AND `specgate --help --all` still lists `draft`, `done`, `change` and every other command

<!-- specgate:trace feature=features/daily-surface/REQ-107.feature kind=functional actor=Developer -->

### Requirement: REQ-108 — propose opens a change, from an idea or from the brief

The system SHALL, on `specgate propose` with a change id, open the same change
folder that `specgate change new` opens, and SHALL, on
`specgate propose --from-brief`, do what `specgate draft` does: name the next
module of `docs/brief.md`, or open that module's draft change when it is named.

#### Scenario: SCN-108a — Propose from an idea

- GIVEN a project with no open change
- WHEN the developer runs `specgate propose add-dynamic-pricing`
- THEN the developer sees `docs/specs/changes/add-dynamic-pricing/` with `proposal.md`, `tasks.md`, `change.yaml` and a delta skeleton, and a reserved REQ range
- AND a last line naming the next step, `specgate apply`, once the delta is written

#### Scenario: SCN-108b — Propose from the brief

- GIVEN a project whose `docs/brief.md` has the modules billing and shipping, neither drafted
- WHEN the developer runs `specgate propose --from-brief` and then `specgate propose --from-brief billing`
- THEN the first run names billing as the next module, and the second opens the draft change `draft-billing` with `DRAFTING.md`, exactly as `specgate draft billing` does

<!-- specgate:trace feature=features/daily-surface/REQ-108.feature kind=functional actor=Developer -->

### Requirement: REQ-109 — An open change's requirements count while it is in flight

The system SHALL treat the ADDED and MODIFIED requirements of every open
change as pending requirements for `status`, `apply` and `check`, validated
with the same rules as the capability specs, and SHALL NOT write them into a
capability spec, `spec.md` or `features/` before `archive`.

#### Scenario: SCN-109a — Status shows the change's requirement

- GIVEN an open change `add-dynamic-pricing` that adds REQ-120 with one scenario, and no capability spec holding REQ-120
- WHEN the developer runs `specgate status --json`
- THEN REQ-120 is listed as pending, with change `add-dynamic-pricing`
- AND the capability specs and `features/` are byte-for-byte unchanged

#### Scenario: SCN-109b — Check validates the change's requirement

- GIVEN the same change, whose scenario for REQ-120 has no THEN line
- WHEN the developer runs `specgate check`
- THEN the gate fails naming REQ-120 and the change's delta file

<!-- specgate:trace feature=features/daily-surface/REQ-109.feature kind=functional actor=Developer -->

### Requirement: REQ-110 — apply delivers one requirement: test first, gate, Implemented

The system SHALL, on `specgate apply` with a requirement id, refuse when no
test names that requirement, run the gate for it otherwise (strict validation
for that requirement, the architecture command, the test command), and mark it
Implemented when the gate passes; without an id it SHALL take the next pending
requirement that `status` names.

#### Scenario: SCN-110a — No test yet

- GIVEN pending REQ-120 and no test that mentions REQ-120
- WHEN the developer runs `specgate apply REQ-120`
- THEN the command exits 1 with code `apply_no_test`
- AND the last line reads `fix: write a test that names REQ-120 (and its scenario SCN-120a), then run specgate apply REQ-120`

#### Scenario: SCN-110b — Green gate, Implemented

- GIVEN pending REQ-120, a test that names REQ-120 and SCN-120a, and a test command that passes
- WHEN the developer runs `specgate apply REQ-120`
- THEN REQ-120's status is Implemented, the command exits 0, and its last line names the next pending requirement

#### Scenario: SCN-110c — Red gate, nothing written

- GIVEN pending REQ-120, a test that names it, and a test command that fails
- WHEN the developer runs `specgate apply REQ-120`
- THEN the command exits 1, REQ-120's status is unchanged, and the last line is a `fix:` line naming the failing check

#### Scenario: SCN-110d — No id: the next one

- GIVEN pending REQ-120 and REQ-121, REQ-120 first in `specgate status`
- WHEN the developer runs `specgate apply`
- THEN the command works on REQ-120 and says so in its first line

<!-- specgate:trace feature=features/daily-surface/REQ-110.feature kind=functional actor=Developer -->

### Requirement: REQ-111 — done is apply under its old name

The system SHALL treat `specgate done` with a requirement id as
`specgate apply` with that id, with the same checks, exit codes, output and
`--json` document, and SHALL keep the existing `done` flags for scripts.

#### Scenario: SCN-111a — Same result under both names

- GIVEN two copies of a project with pending REQ-120, a test that names it and a passing test command
- WHEN the developer runs `specgate done REQ-120 --json` in one and `specgate apply REQ-120 --json` in the other
- THEN both exit 0, both leave REQ-120 Implemented, and the two JSON documents are equal apart from the command name

<!-- specgate:trace feature=features/daily-surface/REQ-111.feature kind=functional actor=Developer -->

### Requirement: REQ-112 — archive waits for the code

The system SHALL, on `specgate archive` with a change id, merge the change into
the capability specs, the traceability matrix and `features/` only when every
requirement it adds or modifies is Implemented, keeping those statuses; it
SHALL otherwise refuse, list the requirements still pending, and offer no flag
that skips this rule.

#### Scenario: SCN-112a — A requirement still pending

- GIVEN an open change that adds REQ-120 (Implemented) and REQ-121 (pending)
- WHEN a person runs `specgate archive add-dynamic-pricing`
- THEN the command exits 1 with code `archive_requirements_pending`, nothing is merged, and the message lists REQ-121
- AND the last line reads `fix: specgate apply REQ-121`

#### Scenario: SCN-112b — Everything delivered

- GIVEN the same change with REQ-120 and REQ-121 both Implemented
- WHEN a person runs `specgate archive add-dynamic-pricing`
- THEN both requirements are in the capability spec with status Implemented, their `.feature` files are in `features/`, and the change is under `docs/specs/changes/archive/`

#### Scenario: SCN-112c — A change that only removes

- GIVEN an open change whose delta only removes REQ-050
- WHEN a person runs `specgate archive retire-legacy-export`
- THEN the change is archived without waiting for any requirement

<!-- specgate:trace feature=features/daily-surface/REQ-112.feature kind=business-rule actor=Developer -->

### Requirement: REQ-113 — Every refusal says the fix in one line

The system SHALL end every refusal of `propose`, `apply`, `status`, `archive`
and `check` with exactly one line that starts with `fix:` and names the
command to run or the file to edit, and SHALL carry the same text in the
`fix` field of the diagnostic in the `--json` document.

#### Scenario: SCN-113a — One fix line, human and JSON

- GIVEN a project where `specgate archive add-dynamic-pricing` is refused because REQ-121 is pending
- WHEN the developer runs it once plainly and once with `--json`
- THEN the plain output's last line is the only line starting with `fix:`, and the JSON diagnostic's `fix` holds the same text on one line

<!-- specgate:trace feature=features/daily-surface/REQ-113.feature kind=non-functional actor=Developer -->

### Requirement: REQ-114 — The four verbs and check speak JSON

The system SHALL accept `--json` on `propose`, `apply`, `status`, `archive` and
`check`, writing exactly one JSON document in the agent contract envelope to
stdout and any prose to stderr, on success and on refusal alike.

#### Scenario: SCN-114a — One document per verb

- GIVEN a project with an open change and one pending requirement
- WHEN an agent runs each of `propose`, `apply`, `status`, `archive` and `check` with `--json`
- THEN each stdout parses as exactly one JSON document with the envelope's `schemaVersion`, `ok` and `diagnostics` fields, whether the command succeeded or was refused

<!-- specgate:trace feature=features/daily-surface/REQ-114.feature kind=non-functional actor=Developer -->

### Requirement: REQ-115 — The old names keep working

The system SHALL keep `draft`, `change new`, `change archive` and `done`
working for scripts with the behaviour of the verb that replaces them, and
SHALL name that verb in the first line of each old name's `--help`.

#### Scenario: SCN-115a — A script written for 0.20

- GIVEN a CI script that runs `specgate change new add-dynamic-pricing` and later `specgate done REQ-120`
- WHEN it runs against this version
- THEN both commands succeed as `propose` and `apply` would
- AND `specgate change archive --help` starts with "Same as specgate archive"

<!-- specgate:trace feature=features/daily-surface/REQ-115.feature kind=functional actor=Developer -->

### Requirement: REQ-116 — One loop, four verbs

The system SHALL let a developer take a requirement from nothing to archived
and Implemented using only `init`, `propose`, `apply`, `archive` and `status`,
editing only the change's delta, a test and the code.

#### Scenario: SCN-116a — The loop end to end

- GIVEN an empty Node.js project with a passing `npm test`
- WHEN the developer runs `specgate init --yes`, `specgate propose add-greeting`, writes one requirement in the change's delta, a test naming it and the code, then runs `specgate status`, `specgate apply` and `specgate archive add-greeting`
- THEN every command exits 0, `specgate status` reports no pending requirement, and the requirement is Implemented in its capability spec
- AND no other specgate command was run

<!-- specgate:trace feature=features/daily-surface/REQ-116.feature kind=functional actor=Developer -->
