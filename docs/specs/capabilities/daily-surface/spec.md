# Daily Surface

## Purpose

The commands a developer uses every day: one loop of four verbs — propose,
apply, archive, status — over the gates Specgate already has.

## Requirements

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

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-107.feature kind=functional status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-108 — propose opens a change, from an idea or from the brief

The system SHALL, on `specgate propose` with a change id, open the same change
folder that `specgate change new` opens, with a delta skeleton for the
capability `--capability` names or, without it, for a capability named after
the change, and SHALL, on
`specgate propose --from-brief`, do what `specgate draft` does: name the next
module of `docs/brief.md`, or open that module's draft change when it is named.

#### Scenario: SCN-108a — Propose from an idea

- GIVEN a project with no open change
- WHEN the developer runs `specgate propose add-dynamic-pricing`
- THEN the developer sees `docs/specs/changes/add-dynamic-pricing/` with `proposal.md`, `tasks.md`, `change.yaml`, a delta skeleton at `specs/add-dynamic-pricing/spec.md`, and a reserved REQ range
- AND the output ends with the next step, `specgate apply`, once the delta is written

#### Scenario: SCN-108b — Propose from the brief

- GIVEN a project whose `docs/brief.md` has the modules billing and shipping, neither drafted
- WHEN the developer runs `specgate propose --from-brief` and then `specgate propose --from-brief billing`
- THEN the first run names billing as the next module, and the second opens the draft change `draft-billing` with `DRAFTING.md`, exactly as `specgate draft billing` does

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-108.feature kind=functional status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-109 — An open change's requirements count while it is in flight

The system SHALL treat the ADDED and MODIFIED requirements of every open
change as pending requirements for `status`, `apply`, `check` and
`harness run`, validated
with the same rules as the capability specs, and SHALL NOT write them into a
capability spec, `spec.md` or `features/` before `archive`.

#### Scenario: SCN-109a — Status shows the change's requirement

- GIVEN an open change `add-dynamic-pricing` that adds REQ-002 with one scenario, and no capability spec holding REQ-002
- WHEN the developer runs `specgate status --json`
- THEN REQ-002 is listed as pending, with change `add-dynamic-pricing`
- AND the capability specs and `features/` are byte-for-byte unchanged

#### Scenario: SCN-109b — Check validates the change's requirement

- GIVEN the same change, whose scenario for REQ-002 has no THEN line
- WHEN the developer runs `specgate check`
- THEN the gate fails naming REQ-002 and the change's delta file

#### Scenario: SCN-109c — The harness delivers the change's requirement

- GIVEN the open change with REQ-002 committed, and an agent that writes a test naming REQ-002 and SCN-002a and the code
- WHEN the developer runs `specgate harness run --req REQ-002`
- THEN the run reports 1 passed, and on the branch `harness/REQ-002` REQ-002's status in the change's delta is Implemented
- AND once that branch is merged, `specgate archive add-dynamic-pricing` succeeds

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-109.feature kind=functional status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-110 — apply delivers one requirement: test first, gate, Implemented

The system SHALL, on `specgate apply` with a requirement id, refuse when no
test names that requirement, run the gate for it otherwise (strict validation
for that requirement, the architecture command, the test command), and mark it
Implemented when the gate passes; without an id it SHALL take the next pending
requirement that `status` names.

#### Scenario: SCN-110a — No test yet

- GIVEN pending REQ-002 and no test that mentions REQ-002
- WHEN the developer runs `specgate apply REQ-002`
- THEN the command exits 1 with code `apply_no_test`
- AND the last line reads `fix: write a test that names REQ-002 (and its scenario SCN-002a), then run specgate apply REQ-002`

#### Scenario: SCN-110b — Green gate, Implemented

- GIVEN pending REQ-002, a test that names REQ-002 and SCN-002a, and a test command that passes
- WHEN the developer runs `specgate apply REQ-002`
- THEN REQ-002's status is Implemented, the command exits 0, and its output ends with the next step naming the next pending requirement

#### Scenario: SCN-110c — Red gate, nothing written

- GIVEN pending REQ-002, a test that names it, and a test command that fails
- WHEN the developer runs `specgate apply REQ-002`
- THEN the command exits 1, REQ-002's status is unchanged, and the last line is a `fix:` line naming the failing check

#### Scenario: SCN-110d — No id: the next one

- GIVEN pending REQ-002 and REQ-003, REQ-002 first in `specgate status`
- WHEN the developer runs `specgate apply`
- THEN the command works on REQ-002 and says so in its first line

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-110.feature kind=functional status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-111 — done is apply under its old name

The system SHALL treat `specgate done` with a requirement id as
`specgate apply` with that id, with the same checks, exit codes, output and
`--json` document, and SHALL keep the existing `done` flags for scripts.

#### Scenario: SCN-111a — Same result under both names

- GIVEN two copies of a project with pending REQ-002, a test that names it and a passing test command
- WHEN the developer runs `specgate done REQ-002 --json` in one and `specgate apply REQ-002 --json` in the other
- THEN both exit 0, both leave REQ-002 Implemented, and the two JSON documents are equal apart from the command name

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-111.feature kind=functional status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-112 — archive waits for the code

The system SHALL, on `specgate archive` with a change id, merge the change into
the capability specs, the traceability matrix and `features/` only when every
requirement it adds or modifies is Implemented, keeping those statuses; it
SHALL otherwise refuse, list the requirements still pending, and offer no flag
that skips this rule. Unchecked tasks SHALL only be a warning when the change
has a requirement to deliver, since the gate is the evidence; a change with
none keeps refusing unchecked tasks.

#### Scenario: SCN-112a — A requirement still pending

- GIVEN an open change that adds REQ-002 (Implemented) and REQ-003 (pending)
- WHEN a person runs `specgate archive add-dynamic-pricing`
- THEN the command exits 1 with code `archive_requirements_pending`, nothing is merged, and the message lists REQ-003
- AND the last line reads `fix: specgate apply REQ-003`

#### Scenario: SCN-112b — Everything delivered

- GIVEN the same change with REQ-002 and REQ-003 both Implemented
- WHEN a person runs `specgate archive add-dynamic-pricing`
- THEN both requirements are in the capability spec with status Implemented, their `.feature` files are in `features/`, and the change is under `docs/specs/changes/archive/`
- AND an unchecked task in its `tasks.md` is reported as a warning, not a refusal

#### Scenario: SCN-112c — A change that only removes

- GIVEN an open change whose delta only removes REQ-002
- WHEN a person runs `specgate archive retire-legacy-export`
- THEN the change is archived without waiting for any requirement

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-112.feature kind=business-rule status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-113 — Every refusal says the fix in one line

The system SHALL end every refusal of `propose`, `apply`, `status`, `archive`
and `check` with exactly one line that starts with `fix:` and names the
command to run or the file to edit, and SHALL carry the same text in the
`fix` field of the diagnostic in the `--json` document.

#### Scenario: SCN-113a — One fix line, human and JSON

- GIVEN a project where `specgate archive add-dynamic-pricing` is refused because REQ-003 is pending
- WHEN the developer runs it once plainly and once with `--json`
- THEN the plain output's last line is the only line starting with `fix:`, and the JSON diagnostic's `fix` holds the same text on one line

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-113.feature kind=non-functional status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-114 — The four verbs and check speak JSON

The system SHALL accept `--json` on `propose`, `apply`, `status`, `archive` and
`check`, writing exactly one JSON document in the agent contract envelope to
stdout and any prose to stderr, on success and on refusal alike.

#### Scenario: SCN-114a — One document per verb

- GIVEN a project with an open change and one pending requirement
- WHEN an agent runs each of `propose`, `apply`, `status`, `archive` and `check` with `--json`
- THEN each stdout parses as exactly one JSON document carrying the command's own key and a `status` array of diagnostics (ADR-0017), whether the command succeeded or was refused

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-114.feature kind=non-functional status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-115 — The old names keep working

The system SHALL keep `draft`, `change new`, `change archive` and `done`
working for scripts with the behaviour of the verb that replaces them, and
SHALL name that verb in the first line of each old name's `--help`.

#### Scenario: SCN-115a — A script written for 0.20

- GIVEN a CI script that runs `specgate change new add-dynamic-pricing` and later `specgate done REQ-002`
- WHEN it runs against this version
- THEN both commands succeed as `propose` and `apply` would
- AND `specgate change archive --help` starts with "Same as specgate archive"

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-115.feature kind=functional status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-116 — One loop, four verbs

The system SHALL let a developer take a requirement from nothing to archived
and Implemented using only `init`, `propose`, `apply`, `archive` and `status`,
editing only the change's delta, a test and the code.

#### Scenario: SCN-116a — The loop end to end

- GIVEN a Node.js repository with code, a `package.json` and a passing `npm test`
- WHEN the developer runs `specgate init`, `specgate propose add-greeting`, writes one requirement in the change's delta, a test naming it and the code, then runs `specgate status`, `specgate apply` and `specgate archive add-greeting`
- THEN every command exits 0, the requirement is Implemented in its capability spec, and `specgate status` no longer lists it as pending
- AND no other specgate command was run

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-116.feature kind=functional status=Implemented test=tests/unit/compact-use.test.ts -->

### Requirement: REQ-173 — Approved owes a test, as the strict gate says

The system SHALL refuse `specgate apply` and `specgate done` with a `--status` that is not Draft, Approved, Implemented, Verified, Released or Deprecated, and SHALL refuse a status that owes a test under TDD-1 (Approved, Implemented, Verified, Released) while no test names the requirement, naming TDD-1 and the fix and writing nothing; with `--no-check` the status is written and a warning says that `validate --strict` fails TDD-1 until a test names the requirement.

#### Scenario: SCN-173a — Approved before the test is refused

- GIVEN a project with REQ-002 in Draft and no test that names it
- WHEN the developer runs `specgate apply REQ-002 --status Approved`
- THEN the command exits 1 naming TDD-1 and the fix "write a test that names REQ-002", and REQ-002 is still Draft

#### Scenario: SCN-173b — Approved once a test names it

- GIVEN the same project with a test that names REQ-002 and SCN-002
- WHEN the developer runs `specgate apply REQ-002 --status Approved`
- THEN REQ-002 is Approved

#### Scenario: SCN-173c — An unknown status is refused

- GIVEN the same project
- WHEN the developer runs `specgate apply REQ-002 --status Aproved`
- THEN the command exits 2 naming the statuses it accepts, and REQ-002 is still Draft

#### Scenario: SCN-173d — `--no-check` writes it and warns

- GIVEN the project with no test that names REQ-002
- WHEN the developer runs `specgate apply REQ-002 --status Approved --no-check`
- THEN REQ-002 is Approved and stderr warns that `validate --strict` fails TDD-1 until a test names REQ-002

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-173.feature kind=functional status=Implemented test=tests/unit/approved-needs-test.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-178.feature kind=functional status=Implemented test=tests/unit/adopter-papercuts.test.ts -->

### Requirement: REQ-193 — Status names the module of the next use case

The system SHALL, in a forja project, propose for the next requirement `specgate add usecase <module>/<Name>` with the module taken from the open change that holds it (`draft-diario` → `diario`) or from its feature's folder (`features/diario/…`), and SHALL print `<module>` only when neither says.

#### Scenario: SCN-193a — The module from the change or the feature's folder

- GIVEN REQ-022 is in change draft-diario, or its feature is features/diario/registrar-clase.feature
- WHEN status proposes the next command
- THEN it is `specgate add usecase diario/<Name> --req REQ-022`, or `specgate add usecase diario/RegistrarClase --req REQ-022`

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-193.feature kind=functional status=Implemented test=tests/unit/forja-front-door.test.ts -->

### Requirement: REQ-194 — DRAFTING.md gives the draft's real limit

The system SHALL say in DRAFTING.md how many requirement ids the draft holds — its range, never more than the review limit — and how to grow the range, instead of a review limit larger than the range.

#### Scenario: SCN-194a — The range is the limit

- GIVEN a draft reserving REQ-002 to REQ-011 with a review limit of 25
- WHEN DRAFTING.md is written
- THEN it says "`REQ-002` … `REQ-011`: 10 ids, no others" and names `specgate draft --reserve <n>`, and not "at most 25 requirements"

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-194.feature kind=functional status=Implemented test=tests/unit/forja-front-door.test.ts -->

### Requirement: REQ-195 — No inline code split across lines in the changelog

The system's CHANGELOG.md SHALL open and close every inline code span on one line, checked by a test.

#### Scenario: SCN-195a — Every code span on one line

- GIVEN CHANGELOG.md
- WHEN its lines outside code fences are read
- THEN none has an odd number of backticks

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-195.feature kind=non-functional status=Implemented test=tests/unit/changelog-format.test.ts -->

### Requirement: REQ-197 — Opening a module says which drafts stop growing

The system SHALL, when `specgate draft <module>` opens a draft while another open draft holds no requirement yet, add a note naming it, saying it can no longer grow its range, and how to avoid it.

#### Scenario: SCN-197a — Opening the second module warns about the first

- GIVEN draft-bookings is open and unwritten
- WHEN `specgate draft coupons` opens a draft
- THEN its status has draft_other_unwritten naming draft-bookings, with `--reserve` in its fix

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-197.feature kind=functional status=Implemented test=tests/unit/draft-from-brief.test.ts -->
