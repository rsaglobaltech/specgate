# Delta — trusted-gate

## Purpose

A gate a team can trust: it never fails on text that is not a defect, two
branches cannot hand out the same requirement id unnoticed, the generated
matrix never blocks a merge, and the harness delivers a sequence of
requirements without wrapper scripts.

## ADDED Requirements

### Requirement: REQ-117 — Code and quotes in a step are not placeholders

The system SHALL ignore text inside backtick code spans and double-quoted strings when it looks for unfilled `<placeholder>` steps and vague steps in a scenario, and SHALL keep flagging a placeholder or a vague word written in the step itself.

#### Scenario: SCN-117a — A command in a step

- GIVEN a delivered requirement whose scenario reads "THEN the developer sees `agentkit verify` followed by a module name in angle brackets and `--level fast`", written as a code span
- WHEN the developer runs `specgate check`
- THEN no `scenario_placeholder_step` and no `vague_step` finding is reported for that step
- AND a step reading "GIVEN a customer named" followed by a bare angle-bracket placeholder still fails with `scenario_placeholder_step`

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-117.feature kind=functional actor=Developer -->

### Requirement: REQ-118 — Only a requirement heading needs a matrix row

The system SHALL require a traceability row (TDD-3) only for a requirement declared by a heading or a requirement table row outside fenced code, and SHALL NOT require one for an id that is only mentioned in prose, a scenario, a code span or a fenced block.

#### Scenario: SCN-118a — An id mentioned in prose

- GIVEN a capability spec whose prose says "replaces REQ-003" inside a sentence and a fenced example that names REQ-002, neither declared by a heading in that spec
- WHEN the developer runs `specgate validate . --strict`
- THEN no TDD-3 finding names REQ-003 or REQ-002 for those mentions
- AND a `### Requirement: REQ-004` heading with no row still fails TDD-3

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-118.feature kind=business-rule actor=Developer -->

### Requirement: REQ-119 — A real project's specification as a regression corpus

The system SHALL keep a copy of a real project's specification — agentkit's capability specs, features and matrix — as a test fixture that `validate --strict` passes with no finding, including the two texts that produced false positives before.

#### Scenario: SCN-119a — The corpus stays green

- GIVEN the corpus fixture with the scenario step that names a command with an angle-bracket argument in a code span, and a prose mention of an undeclared id
- WHEN the test suite runs `specgate validate --strict` on it
- THEN it exits 0 and reports no error and no warning

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-119.feature kind=non-functional actor=Maintainer -->

### Requirement: REQ-120 — An id taken on the base branch is refused before merge

The system SHALL, in `specgate check`, compare every requirement the branch declares — in capability specs and in open changes — with the requirements on the base branch, and SHALL fail with `id_taken_on_base` when an id exists on the base with a different title, naming both titles and the next free id; it SHALL skip the comparison, saying so, when there is no git repository or no base reference.

#### Scenario: SCN-120a — Two branches, one id

- GIVEN a base branch `develop` whose capability spec declares REQ-003 "Export orders as CSV", and a branch whose open change adds REQ-003 "Refund an order"
- WHEN the developer runs `specgate check --base develop` on the branch
- THEN the gate fails with `id_taken_on_base`, the message names both titles, and the fix names the next id free on both sides
- AND the same requirement with the same title on both sides is not a collision

#### Scenario: SCN-120b — No base to compare with

- GIVEN a project with no git repository
- WHEN the developer runs `specgate check`
- THEN the gate does not fail for ids, and says the base comparison was skipped

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-120.feature kind=business-rule actor=Developer -->

### Requirement: REQ-121 — New ids skip the ranges open changes reserved

The system SHALL allocate the id of `specgate new` and `specgate req add` above every id an open change has reserved in its `req_range`, as `propose` already does.

#### Scenario: SCN-121a — A requirement added while a change is open

- GIVEN an open change that reserved REQ-002 to REQ-004, and no requirement above REQ-001 anywhere else
- WHEN the developer runs `specgate new "Totals are rounded half-up"`
- THEN the new requirement is REQ-005

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-121.feature kind=business-rule actor=Developer -->

### Requirement: REQ-122 — The generated matrix never blocks a merge

The system SHALL declare the generated `docs/specs/traceability.md` with git's built-in `union` merge in `.gitattributes` whenever it writes a generated matrix, so that two branches delivering different requirements merge without a conflict, and `specgate check` SHALL regenerate the matrix from its sources after such a merge.

#### Scenario: SCN-122a — Two branches deliver two requirements

- GIVEN a project with a generated matrix and two branches, each delivering a different requirement through `specgate apply`
- WHEN the second branch is merged with `git merge`
- THEN git reports no conflict, and `specgate check` on the result passes with both requirements Implemented in the matrix

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-122.feature kind=functional actor=Developer -->

### Requirement: REQ-123 — The harness installs dependencies without being told

The system SHALL, when `setup_cmd` is not configured, run in each new harness worktree the install command its lockfile implies — `npm ci`, `pnpm install --frozen-lockfile` or `yarn install --frozen-lockfile` — before the agent, and SHALL run nothing when `--setup-cmd none` is given or no lockfile is found.

#### Scenario: SCN-123a — A Node project with a lockfile

- GIVEN a project with `package-lock.json` and no `setup_cmd` in harness.config.yaml
- WHEN the developer runs `specgate harness run --dry-run`
- THEN the plan names `npm ci --silent --no-audit --no-fund` as the setup step of each worktree
- AND with `--setup-cmd none` it names no setup step

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-123.feature kind=functional actor=Developer -->

### Requirement: REQ-124 — Harness prompts stay out of commits

The system SHALL keep the prompts the harness hands an agent under `.harness/prompts/`, which git ignores, and SHALL NOT commit them on a requirement's branch, green or failed.

#### Scenario: SCN-124a — A delivered requirement's branch

- GIVEN a project whose harness delivers one requirement
- WHEN the developer lists the files changed on its `harness/` branch
- THEN no prompt file is among them, and the prompt is under `.harness/prompts/` in the project

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-124.feature kind=functional actor=Developer -->

### Requirement: REQ-125 — The agent knows which requirement it works on

The system SHALL set `SPECGATE_REQ` and `SPECGATE_ATTEMPT` in the environment of every agent the harness runs.

#### Scenario: SCN-125a — An agent reads its requirement

- GIVEN an agent command that writes the value of `SPECGATE_REQ` and `SPECGATE_ATTEMPT` to a file
- WHEN the harness runs it for REQ-002
- THEN the file reads `REQ-002 1`

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-125.feature kind=functional actor=Developer -->

### Requirement: REQ-126 — A chain of requirements, each merged only on a green gate

The system SHALL, on `specgate harness run --chain`, deliver the requirements one at a time in order, cut each requirement's branch from the current head of the branch it runs on, merge a passing one into that branch with a merge commit, run the gate again on the merged result, undo the merge and stop when that gate fails, and stop at the first requirement that does not pass; without `--chain` the harness SHALL keep never merging.

#### Scenario: SCN-126a — Two requirements in a chain

- GIVEN a clean project on branch `develop` with two pending requirements and an agent that delivers both
- WHEN the developer runs `specgate harness run --chain`
- THEN `develop` gains two merge commits in order, the second requirement's branch was cut after the first merge, and `specgate check` passes on `develop`

#### Scenario: SCN-126b — The chain stops at the first failure

- GIVEN the same project and an agent that fails the first requirement's gate
- WHEN the developer runs `specgate harness run --chain`
- THEN `develop` is unchanged, the second requirement is reported as skipped, and the run exits 1

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-126.feature kind=functional actor=Developer -->

### Requirement: REQ-127 — The base is never left red by a chain

The system SHALL, when the gate on a merged result fails during `--chain`, restore the branch to the commit it had before that merge and report the requirement as failed at `post-merge gate`.

#### Scenario: SCN-127a — Green alone, red together

- GIVEN a chain whose second requirement passes on its own branch but breaks a test once merged
- WHEN the developer runs `specgate harness run --chain`
- THEN the branch ends at the first requirement's merge commit, and the second is reported failed at `post-merge gate`

<!-- specgate:trace test=tests/unit/trust-gate.test.ts feature=features/trusted-gate/REQ-127.feature kind=business-rule actor=Developer -->
