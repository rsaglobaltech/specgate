# Trusted Gate

## Purpose

A gate a team can trust: it never fails on text that is not a defect, two
branches cannot hand out the same requirement id unnoticed, the generated
matrix never blocks a merge, and the harness delivers a sequence of
requirements without wrapper scripts.

## Requirements

### Requirement: REQ-117 — Code and quotes in a step are not placeholders

The system SHALL ignore text inside backtick code spans when it looks for unfilled `<placeholder>` steps, and text inside code spans and double-quoted strings when it looks for vague steps, and SHALL keep flagging a placeholder or a vague word written in the step itself — a quoted `"<name>"` is still a placeholder.

#### Scenario: SCN-117a — A command in a step

- GIVEN a delivered requirement whose scenario reads "THEN the developer sees `agentkit verify` followed by a module name in angle brackets and `--level fast`", written as a code span
- WHEN the developer runs `specgate check`
- THEN no `scenario_placeholder_step` and no `vague_step` finding is reported for that step
- AND a step reading "GIVEN a customer named" followed by a bare angle-bracket placeholder still fails with `scenario_placeholder_step`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-117.feature kind=functional status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-118 — Only a requirement heading needs a matrix row

The system SHALL require a traceability row (TDD-3) only for a requirement declared by a heading or a requirement table row outside fenced code, and SHALL NOT require one for an id that is only mentioned in prose, a scenario, a code span or a fenced block.

#### Scenario: SCN-118a — An id mentioned in prose

- GIVEN a capability spec whose prose says "replaces REQ-003" inside a sentence and a fenced example that names REQ-002, neither declared by a heading in that spec
- WHEN the developer runs `specgate validate . --strict`
- THEN no TDD-3 finding names REQ-003 or REQ-002 for those mentions
- AND a `### Requirement: REQ-004` heading with no row still fails TDD-3

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-118.feature kind=business-rule status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-119 — Real specification shapes as a regression corpus

The system SHALL keep, as a test fixture, a project whose specification reproduces the shapes that produced false positives on a real project — a command with an angle-bracket argument in a code span, ids mentioned in prose, scenarios and fenced examples — and that `validate --strict` passes with no finding; and SHALL run the same test over every project directory listed in `SPECGATE_CORPUS`, so a maintainer can check private specifications without copying them into this repository.

#### Scenario: SCN-119a — The corpus stays green

- GIVEN the corpus fixture, and `SPECGATE_CORPUS` naming a second project that passes the gate
- WHEN the test suite runs `specgate validate --strict` on each
- THEN each exits 0 and reports no error and no warning

<!-- specgate:trace actor=Maintainer feature=features/trusted-gate/REQ-119.feature kind=non-functional status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-120 — An id taken on the base branch is refused before merge

The system SHALL, in `specgate check`, compare every requirement the branch declares — in capability specs and in open changes — with the requirements on the base branch, and SHALL fail with `id_taken_on_base` when an id this branch introduced — one absent where the branch and the base last met — exists on the base with a different title, naming both titles and the next free id; the base branch SHALL be `--base`, else `SPECGATE_BASE`, else the `pr: base:` of `alm.config.yaml` when that branch exists, else the remote's default branch; it SHALL skip the comparison, saying so, when there is no git repository or no base reference.

#### Scenario: SCN-120a — Two branches, one id

- GIVEN a base branch `develop` whose capability spec declares REQ-003 "Export orders as CSV", and a branch whose open change adds REQ-003 "Refund an order"
- WHEN the developer runs `specgate check --base develop` on the branch
- THEN the gate fails with `id_taken_on_base`, the message names both titles, and the fix names the next id free on both sides
- AND the same requirement with the same title on both sides is not a collision

#### Scenario: SCN-120b — No base to compare with

- GIVEN a project with no git repository
- WHEN the developer runs `specgate check`
- THEN the gate does not fail for ids, and says the base comparison was skipped

#### Scenario: SCN-120c — A gitflow project compares with develop

- GIVEN a clone whose remote's default branch is `main`, an `alm.config.yaml` with `pr: base: develop`, and a `develop` branch that declares REQ-003 "Export orders as CSV"
- WHEN the developer runs `specgate check` with no `--base` on a branch whose open change adds REQ-003 "Refund an order"
- THEN the gate fails with `id_taken_on_base` and says the ids were compared with `develop`

#### Scenario: SCN-120d — A requirement the base changed is not an id taken

- GIVEN a branch started from `develop` when REQ-009 was "An owner's telephone is exactly 10 digits", and `develop` has since renamed REQ-009 "An owner's telephone is 10 digits, or an international number"
- WHEN the developer runs `specgate check` on the branch, which has not touched REQ-009
- THEN the gate does not fail with `id_taken_on_base` for REQ-009

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-120.feature kind=business-rule status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-121 — New ids skip the ranges open changes reserved

The system SHALL allocate the id of `specgate new` and `specgate req add` above every id an open change has reserved in its `req_range`, as `propose` already does.

#### Scenario: SCN-121a — A requirement added while a change is open

- GIVEN an open change that reserved REQ-002 to REQ-004, and no requirement above REQ-001 anywhere else
- WHEN the developer runs `specgate new "Totals are rounded half-up"`
- THEN the new requirement is REQ-005

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-121.feature kind=business-rule status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-122 — The generated matrix never blocks a merge

The system SHALL declare the generated `docs/specs/traceability.md` with git's built-in `union` merge in `.gitattributes` whenever it writes a generated matrix, so that two branches delivering different requirements merge without a conflict, and `specgate check` SHALL regenerate the matrix from its sources after such a merge.

#### Scenario: SCN-122a — Two branches deliver two requirements

- GIVEN a project with a generated matrix and two branches, each delivering a different requirement through `specgate apply`
- WHEN the second branch is merged with `git merge`
- THEN git reports no conflict, and `specgate check` on the result passes with both requirements Implemented in the matrix

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-122.feature kind=functional status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-123 — The harness installs dependencies without being told

The system SHALL, when `setup_cmd` is not configured, run in each new harness worktree the install command its lockfile implies — `npm ci`, `pnpm install --frozen-lockfile` or `yarn install --frozen-lockfile` — before the agent, and SHALL run nothing when `--setup-cmd none` is given or no lockfile is found.

#### Scenario: SCN-123a — A Node project with a lockfile

- GIVEN a project with `package-lock.json` and no `setup_cmd` in harness.config.yaml
- WHEN the developer runs `specgate harness run --dry-run`
- THEN the plan names `npm ci --silent --no-audit --no-fund` as the setup step of each worktree
- AND with `--setup-cmd none` it names no setup step

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-123.feature kind=functional status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-124 — Harness prompts never reach the base branch

The system SHALL keep the prompts the harness hands an agent on the requirement's own branch, where a reviewer reads them and `--resume` finds them, and SHALL leave them out of the merge commit `--chain` writes, so they never reach the branch it merges into.

#### Scenario: SCN-124a — A chained requirement's merge

- GIVEN a project whose harness delivers one requirement with `--chain`
- WHEN the developer lists the files the merge commit adds to the base branch
- THEN no file under `.specops/harness-prompts/` is among them, and the requirement's `harness/` branch still holds its prompt

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-124.feature kind=functional status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-125 — The agent knows which requirement it works on

The system SHALL set `SPECGATE_REQ` and `SPECGATE_ATTEMPT` in the environment of every agent the harness runs.

#### Scenario: SCN-125a — An agent reads its requirement

- GIVEN an agent command that writes the value of `SPECGATE_REQ` and `SPECGATE_ATTEMPT` to a file
- WHEN the harness runs it for REQ-002
- THEN the file reads `REQ-002 1`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-125.feature kind=functional status=Implemented test=tests/unit/trust-gate.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-126.feature kind=functional status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-127 — The base is never left red by a chain

The system SHALL, when the gate on a merged result fails during `--chain`, restore the branch to the commit it had before that merge and report the requirement as failed at `post-merge gate`.

#### Scenario: SCN-127a — Green alone, red together

- GIVEN a chain whose second requirement passes on its own branch but breaks a test once merged
- WHEN the developer runs `specgate harness run --chain`
- THEN the branch ends at the first requirement's merge commit, and the second is reported failed at `post-merge gate`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-127.feature kind=business-rule status=Implemented test=tests/unit/trust-gate.test.ts -->

### Requirement: REQ-152 — New ids are free on every branch, not only this one

The system SHALL, when it reserves requirement ids for a new change (`propose`, `propose --from-brief`, `propose --from-ticket`, `new`, `req`) or numbers the first scenario of a draft, start above every `REQ-` and `SCN-` number used by a change on any local branch or remote-tracking branch of the repository, as well as above those of the working tree, so that two changes opened on two branches never mint the same id; and SHALL work as before outside a git repository.

#### Scenario: SCN-152a — Two tickets, two branches

- GIVEN a repository whose branch `feature/KAN-14-vehicle-type-catalog` holds a change reserving REQ-002 to REQ-005 with scenarios SCN-002 to SCN-006, and the developer is on `develop`, which has none of them
- WHEN the developer runs `specgate propose --from-ticket KAN-13.json --capability parking`
- THEN the change `kan-13-register-vehicle-entry` reserves ids from REQ-006 up, and its `DRAFTING.md` starts scenarios at SCN-007

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-152.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-160 — Two changes that rewrite the same requirement are reported

The system SHALL, on `specgate check` and when it reports on a change opened from a ticket, warn with `change_overlap` for every requirement that an open change in the working tree modifies or removes and that another open change — on the same branch, or on any local or remote-tracking branch not yet merged into the current one — also modifies or removes, naming the other change and its branch and saying how to resolve it; and SHALL say nothing about a branch whose tip is already part of the current branch, nor about the same change seen on its own pushed branch.

#### Scenario: SCN-160a — Two tickets rewrite REQ-012

- GIVEN a repository whose branch `feature/KAN-16-exit` holds an open change `kan-16-exit` that modifies REQ-012, and the developer is on `feature/KAN-13-entry`, whose open change `kan-13-entry` also modifies REQ-012
- WHEN the developer runs `specgate check`
- THEN it warns `change_overlap` for REQ-012, naming `kan-16-exit` and `feature/KAN-16-exit`

#### Scenario: SCN-160b — The other branch is already merged

- GIVEN the same two changes, where `feature/KAN-16-exit` has since been merged into `feature/KAN-13-entry`
- WHEN the developer runs `specgate check`
- THEN it does not warn `change_overlap` for `kan-16-exit`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-160.feature kind=functional status=Implemented test=tests/unit/change-overlap.test.ts -->

### Requirement: REQ-163 — A ticket's change sees the branches pushed meanwhile

The system SHALL, when `specgate propose --from-ticket <KEY>` opens a change in a repository with an `origin` remote, fetch `origin` before it reserves requirement and scenario ids, so the ids other developers' ticket branches already reserved are known; and SHALL go on, saying so, when the fetch fails.

#### Scenario: SCN-163a — A colleague pushed a ticket branch a minute ago

- GIVEN a clone whose `origin` has a branch `feature/PET-104-walk-in` this clone has never fetched, holding a change that reserves REQ-010
- WHEN the developer runs `specgate propose --from-ticket PET-103.json --capability owners`
- THEN PET-103's change reserves ids above REQ-010

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-163.feature kind=functional status=Implemented test=tests/unit/change-overlap.test.ts -->

### Requirement: REQ-164 — Two changes that add the same id are reported

The system SHALL, on `specgate check` and when it reports on a change opened from a ticket, warn with `change_id_clash` for every requirement id that an open change in the working tree adds and that another open change on any local or remote-tracking branch not merged into the current one also adds, naming the other change and its branch and saying to renumber the one not yet merged.

#### Scenario: SCN-164a — Both opened at the same second

- GIVEN a branch `feature/PET-104-walk-in` whose open change adds REQ-010, and the developer on `feature/PET-103-international`, whose open change adds REQ-010 too
- WHEN the developer runs `specgate check`
- THEN it warns `change_id_clash` for REQ-010, naming the PET-104 change and its branch

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-164.feature kind=functional status=Implemented test=tests/unit/change-overlap.test.ts -->

### Requirement: REQ-166 — Capability specs merge requirement by requirement

The system SHALL, once `specgate harness init` has registered it, merge `docs/specs/capabilities/*/spec.md` requirement by requirement: a requirement only one side added, changed or removed takes that side; one both sides changed alike takes that text; the result lists the requirements in id order; and only a requirement both sides changed differently is left in conflict, with markers around that requirement alone. `specgate doctor` SHALL report a clone where `.gitattributes` names the driver and its git config does not.

#### Scenario: SCN-166a — Two branches add to a capability that did not exist

- GIVEN a repository with the merge drivers registered, a branch that archived REQ-009 into a new `owners` capability, and another that archived REQ-006 and REQ-007 into it
- WHEN the second branch is merged into the first
- THEN the merge succeeds without a conflict and `owners/spec.md` lists REQ-006, REQ-007 and REQ-009, in that order

#### Scenario: SCN-166b — Both sides rewrote the same requirement

- GIVEN the same requirement REQ-009 rewritten differently on each side
- WHEN the branches are merged
- THEN the merge stops with a conflict around REQ-009 only, and every other requirement is merged

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-166.feature kind=functional status=Implemented test=packages/core/test/unit/capability-spec-merge.test.ts -->

### Requirement: REQ-168 — A change never replaces a requirement that moved under it

The system SHALL record in an open change's `change.yaml`, as `based_on`, a fingerprint of each requirement the change modifies or removes, taken from the capability spec when `specgate check` or `specgate change validate` first sees it, and ignoring its trace comment; SHALL warn with `change_base_moved` on `check`, and refuse to archive with `change_base_moved`, when that requirement in the capability spec no longer matches its fingerprint; SHALL warn with `change_base_moved` on `check` when the requirement differs between the base branch and the commit where this branch and the base last met; and SHALL record the requirement's current text again on `specgate change validate <change> --rebased`.

#### Scenario: SCN-168a — The other ticket merged first

- GIVEN an open change that modifies REQ-009, checked once while REQ-009 read "An owner's telephone is exactly 10 digits", and a capability spec where REQ-009 now reads "An owner's telephone is 10 digits, or an international number"
- WHEN the developer runs `specgate archive` for that change
- THEN it refuses with `change_base_moved` naming REQ-009, and the capability spec is unchanged

#### Scenario: SCN-168b — The base moved before the branch caught up

- GIVEN a branch whose open change modifies REQ-009, and a base branch `develop` where REQ-009 has been rewritten since the branch started
- WHEN the developer runs `specgate check --base develop`
- THEN it warns `change_base_moved` for REQ-009, naming `develop`

#### Scenario: SCN-168c — The delta was rewritten over the new text

- GIVEN the change of SCN-168a, with its delta rewritten over the new REQ-009
- WHEN the developer runs `specgate change validate` for it with `--rebased`, then `specgate check`
- THEN `check` reports no `change_base_moved`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-168.feature kind=functional status=Implemented test=tests/unit/change-base.test.ts -->
