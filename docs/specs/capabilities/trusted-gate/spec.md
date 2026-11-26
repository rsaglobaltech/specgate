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

### Requirement: REQ-169 — A merge driver that is gone falls back to git's own merge

The system SHALL register each merge driver so that, when the specgate file it runs no longer exists, the file is merged by lines as git would merge it without the driver, with conflict markers wherever the two sides conflict, and stderr says the driver is missing and to re-run `specgate harness init`; and `specgate doctor` SHALL warn when a registered merge driver points at a file that does not exist.

#### Scenario: SCN-169a — The copy of specgate the driver ran is gone

- GIVEN a repository where `specgate harness init` registered the merge drivers, and the specgate copy they run has since been removed
- WHEN a branch that rewrote a line of a capability spec is merged into one that rewrote the same line differently
- THEN the merge stops with git's conflict markers around that line, holding both texts, and stderr says the merge driver is missing

#### Scenario: SCN-169b — Doctor names the missing driver

- GIVEN the same repository
- WHEN the developer runs `specgate doctor`
- THEN it warns that the spec merge driver points at a file that does not exist

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-169.feature kind=functional status=Implemented test=tests/cli.test.ts -->

### Requirement: REQ-172 — A clone registers the merge drivers alone

The system SHALL, on `specgate harness init --merge-drivers`, register the merge drivers in the clone's git config, adding their rules to `.gitattributes` only when they are missing, and write no other file; and the messages that tell a clone to register the drivers SHALL name `specgate harness init --merge-drivers`.

#### Scenario: SCN-172a — A developer's fresh clone

- GIVEN a clone whose committed `.gitattributes` routes the capability specs and the matrix to the drivers, with a committed `harness.config.yaml`, and no driver in its git config
- WHEN the developer runs `specgate harness init --merge-drivers`
- THEN `merge.specgate-spec.driver` and `merge.specgate-matrix.driver` are set in its git config, and `git status --porcelain` is empty

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-172.feature kind=functional status=Implemented test=tests/cli.test.ts -->

### Requirement: REQ-183 — The gate fills the test command's placeholders outside the harness

The system SHALL run the test command of `specgate check` with `{req}`, `{scenario}` and `{feature_file}` empty, as the gate of the whole project, and the one of `apply` and `done` for a single requirement with `{req}` set to it; several requirements at once run it with `{req}` empty.

#### Scenario: SCN-183a — check runs it for the whole project

- GIVEN the test command `npm test && node e2e-names.mjs {req} {scenario} {feature_file}`
- WHEN `specgate check` plans its gate
- THEN it runs `npm test && node e2e-names.mjs`

#### Scenario: SCN-183b — done and apply run it for their requirement

- GIVEN the test command `npm test && node e2e-names.mjs {req}`
- WHEN REQ-007 is delivered
- THEN the gate runs `npm test && node e2e-names.mjs REQ-007`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-183.feature kind=functional status=Implemented test=packages/core/test/unit/done-verification.test.ts -->

### Requirement: REQ-281 — A release candidate is never what people install by default

The system SHALL publish a version whose number has a prerelease part (`1.0.0-rc.1`), when its tag is pushed, under the npm and GitHub Packages dist-tag `next` and as a Docker image tagged with its version only, never `latest`; a final version (`0.27.9`) SHALL stay `latest` on all three.

#### Scenario: SCN-281a — The first 1.0 release candidate

- GIVEN the tag `v1.0.0-rc.1` is pushed with `package.json` at `1.0.0-rc.1`
- WHEN the npm, GitHub Packages and Docker publish workflows run
- THEN npm and GitHub Packages publish it under `next`, the image is tagged `1.0.0-rc.1` and not `latest`, and the image's smoke test runs `1.0.0-rc.1`

#### Scenario: SCN-281b — A final version

- GIVEN the tag `v0.27.9` is pushed with `package.json` at `0.27.9`
- WHEN the same workflows run
- THEN npm and GitHub Packages publish it under `latest`, and the image is tagged `0.27.9`, `0.27` and `latest`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-281.feature kind=functional status=Implemented test=tests/unit/release-workflows.test.ts -->

### Requirement: REQ-556 — npm publishes through trusted publishing

The system SHALL run the npm publish job with `id-token: write` and npm 11.5.1 or later, so that npm authenticates the publish through trusted publishing (OIDC) when the package's trusted publisher names this repository and `publish-npm.yml`; the job SHALL NOT pass a token to any step other than the publish steps and the version check; and `docs/release-process.md` SHALL describe configuring the trusted publisher and removing the token after the first trusted publish.

#### Scenario: SCN-556a — The publish job is ready for OIDC

- GIVEN the repository's `publish-npm.yml`
- WHEN a maintainer reads its publish job
- THEN it grants `id-token: write`, installs npm 11.5.1 or later before publishing, and passes `NPM_TOKEN` only to the version check and the publish steps

<!-- specgate:trace actor=Maintainer feature=features/trusted-gate/REQ-556.feature kind=functional status=Implemented -->

### Requirement: REQ-568 — The public surface is frozen within a major version

The system SHALL list its public surface — commands and sub-commands, the flags each `--help` lists, every diagnostic code, the exit codes, the MCP tools, the library API's exports and members, the configuration keys, and every key with its type of the JSON answers a tool reads — from its own code and CLI; SHALL keep the list of the last release in `contract/surface.json`; and `npm run contract:check`, run by CI on every pull request, SHALL fail when an item of that list is gone or a key's type changed within the same major version, list what was added, and with `--release <version>` fail a version that adds to the surface without raising at least the minor.

#### Scenario: SCN-568a — A flag removed in a minor

- GIVEN `contract/surface.json` frozen at 1.0.0 with `status --json`
- WHEN a pull request for 1.1.0 removes `--json` from `status`
- THEN `contract:check` fails, naming `flag:status --json` and that removing it waits for 2.0.0

<!-- specgate:trace actor=Maintainer feature=features/trusted-gate/REQ-568.feature kind=functional status=Implemented -->

### Requirement: REQ-569 — Deprecation before removal

The system SHALL allow an item of the public surface to be removed only in a new major version and only once `contract/deprecations.json` listed it — with the version that deprecated it and what to use instead — and SHALL list, on every check, the deprecated items still present.

#### Scenario: SCN-569a — A removal in a major, after a deprecation

- GIVEN `status --json` deprecated in 1.4.0 for `--format json`
- WHEN 2.0.0 removes it, and another 2.0.0 removes an item never deprecated
- THEN the first passes, and the second fails, saying to deprecate it in a minor release first

<!-- specgate:trace actor=Maintainer feature=features/trusted-gate/REQ-569.feature kind=functional status=Implemented -->

### Requirement: REQ-570 — Every release's project keeps working

The system SHALL keep, under `tests/compat/<version>/`, a project as each release since 0.35.0 wrote it, and its test suite SHALL read each one with the CLI being built — `validate`, `status --json`, `config list`, `change validate` of each open change — and, for a project from before 1.0, run `migrate 1.0` and then `validate --strict`, failing when any of them fails.

#### Scenario: SCN-570a — A project 0.35.0 wrote

- GIVEN the project 0.35.0 wrote with `init --yes` and `propose pdf-invoices`, its lanes under `roles:`
- WHEN the test suite runs
- THEN it validates as it is, status names the migration, `migrate 1.0` succeeds, and it passes `validate --strict`, `config list` and `change validate` afterwards

<!-- specgate:trace actor=Maintainer feature=features/trusted-gate/REQ-570.feature kind=functional status=Implemented -->

### Requirement: REQ-571 — A version is checked against the surface before it is published

The system SHALL, in the npm publish job and before publishing, run `contract:check --release <version>`, so that a version adding to the public surface without raising at least the minor, or removing from it outside a new major, is not published; while the frozen surface is a candidate's or a 0.x one, the diff SHALL be reported without stopping the release.

#### Scenario: SCN-571a — The publish job checks the version

- GIVEN the publish workflow
- WHEN it runs for a tag
- THEN it runs `contract:check --release` with the version, after the test suite and before publishing

<!-- specgate:trace actor=Maintainer feature=features/trusted-gate/REQ-571.feature kind=functional status=Implemented -->

### Requirement: REQ-572 — A published version is installed and used

The system SHALL, after publishing a version to npm, install it from the registry as a user would — once the registry serves it — check that the dist-tag it was meant for names it, and run `specgate --version`, `sgate --version`, `specgate init --yes` and `specgate status --json` with it, failing the workflow when any of them fails.

#### Scenario: SCN-572a — The published package, installed

- GIVEN the publish workflow
- WHEN a version is published
- THEN a job after it installs that version from npm, checks its dist-tag, and runs `--version`, `init` and `status`

<!-- specgate:trace actor=Maintainer feature=features/trusted-gate/REQ-572.feature kind=functional status=Implemented -->

### Requirement: REQ-660 — An approved change's scenarios are feature files before any code

The system SHALL, when a change's three layers are approved, write each of its requirements' scenarios as `features/<capability>/<REQ>.feature` — or the file its trace names — tagged `@change:<change>` while the change is open, so the scenarios are executable before the code is written (BDD, then TDD); SHALL write them again with `specgate change features <change>` when the delta changes after approval; and SHALL drop the tag when the change is archived.

> "¿No debería escribirse el feature antes de empezar a programar, para que los tests de TDD con Cucumber pasen? BDD y TDD son importantes: ese es el sentido de specgate, un gate siempre" (2026-11-22). Two requirements were built and no feature file existed: they were written only at archive.

#### Scenario: SCN-660a — Approved, before any code

- GIVEN a project whose draft-pedidos has REQ-031 with the scenarios SCN-031 and SCN-032
- WHEN the Developer approves draft-pedidos's discover, design and tasks layers
- THEN `features/pedidos/REQ-031.feature` exists, tagged `@change:draft-pedidos`, with SCN-031 and SCN-032 tagged in it

#### Scenario: SCN-660b — Archived, the tag dropped

- GIVEN draft-pedidos approved and every requirement applied
- WHEN the Developer archives draft-pedidos
- THEN `features/pedidos/REQ-031.feature` keeps its scenarios and no longer has `@change:draft-pedidos`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-660.feature kind=functional status=Implemented -->

### Requirement: REQ-661 — The gate requires executable scenarios in every project

The system SHALL, in a project whose `.specgate/gate.yaml` says `bdd: required`, fail the gate when a change is approved and the harness has no `bdd_cmd` — the command that runs the feature files, `{tags}` standing for the scenarios to run; before, it warns — or when a requirement of an approved change has no feature file, or one whose scenarios differ from its delta's, each with its fix; and SHALL warn, in a project that does not say it yet, that its scenarios are not executable, with `specgate migrate bdd` as the fix.

#### Scenario: SCN-661a — Required, no runner

- GIVEN a project with `bdd: required`, no `bdd_cmd`, and draft-pedidos approved
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `bdd_cmd_missing` naming draft-pedidos, whose fix names `specgate config set bdd_cmd`

#### Scenario: SCN-661b — An approved requirement without its feature

- GIVEN a project with `bdd: required`, a `bdd_cmd`, and draft-pedidos approved whose `features/pedidos/REQ-031.feature` was deleted
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `bdd_feature_missing` for REQ-031, whose fix is `specgate change features draft-pedidos`

#### Scenario: SCN-661c — Not set up yet

- GIVEN a project adopted before, with no `bdd` in its gate.yaml
- WHEN the Developer runs `specgate check`
- THEN the gate warns `bdd_not_set_up` with `specgate migrate bdd`, and passes as it did

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-661.feature kind=functional status=Implemented -->

### Requirement: REQ-662 — Apply runs the requirement's scenarios

The system SHALL, on `specgate apply <REQ>` in a project with `bdd: required`, run its `bdd_cmd` with `{tags}` as `@<REQ>`, and refuse to mark the requirement delivered unless it ends well, saying which scenarios failed when it does not.

#### Scenario: SCN-662a — A scenario failing

- GIVEN a project with `bdd: required` and a `bdd_cmd` that fails for `@REQ-031`
- WHEN the Developer runs `specgate apply REQ-031`
- THEN apply refuses with `apply_bdd_failed`, the command it ran naming `@REQ-031`, and REQ-031 is not Implemented

#### Scenario: SCN-662b — Its scenarios pass, it is delivered

- GIVEN the same project whose `bdd_cmd` passes for `@REQ-031`
- WHEN the Developer runs `specgate apply REQ-031`
- THEN REQ-031 is Implemented

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-662.feature kind=functional status=Implemented -->

### Requirement: REQ-663 — New, adopted and migrated projects run their scenarios

The system SHALL, on `specgate migrate bdd` and on `init --forja` once forja has made the project — and on `specgate init` and `specgate adopt` only when the project has a runner for its feature files, a `bdd_cmd` already set or one its stack says —, write `bdd: required` in `.specgate/gate.yaml` and, when the stack says how, the `bdd_cmd` that runs the feature files — the project's own `test:bdd` script when it has one (`npm run test:bdd --silent -- --grep "{tags}"`, as forja writes it), `npx bddgen && npx playwright test --grep "{tags}"` for a project with Playwright (playwright-bdd), `mvn -q test -Dcucumber.filter.tags="{tags}"` for a Maven one (Cucumber) — and SHALL write the feature files of every approved change; and, when the stack does not say, leave `bdd_cmd` to set, the gate saying so; `init` and `adopt` without a runner leave `bdd` unset, the gate warning `bdd_not_set_up` with `specgate migrate bdd` and `apply` delivering as before.

#### Scenario: SCN-663c — A new project with no runner

- GIVEN a Node project with no `test:bdd` script and no Playwright or Cucumber
- WHEN the Developer runs `specgate init`
- THEN gate.yaml does not say `bdd: required`, `specgate check` warns `bdd_not_set_up` with `specgate migrate bdd`, and `specgate apply` delivers a requirement whose test passes

#### Scenario: SCN-663d — A new project with its own test:bdd script

- GIVEN a Node project whose package.json has the script `test:bdd`
- WHEN the Developer runs `specgate init`
- THEN gate.yaml says `bdd: required` and harness.config.yaml's `bdd_cmd` is `npm run test:bdd --silent -- --grep "{tags}"`

#### Scenario: SCN-663b — A project with its own test:bdd script

- GIVEN a project whose package.json has the script `test:bdd`
- WHEN the Developer runs `specgate migrate bdd`
- THEN harness.config.yaml's `bdd_cmd` is `npm run test:bdd --silent -- --grep "{tags}"`

#### Scenario: SCN-663a — A web project migrated

- GIVEN a project with `apps/web/package.json` depending on `@playwright/test` and no `bdd` in its gate.yaml
- WHEN the Developer runs `specgate migrate bdd`
- THEN gate.yaml says `bdd: required` and harness.config.yaml's `bdd_cmd` is `npx bddgen && npx playwright test --grep "{tags}"`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-663.feature kind=functional status=Implemented -->

### Requirement: REQ-510 — check --affected runs the tests of what the change touches

The system SHALL, with `specgate check --affected`, compare the project with its base — `--base <ref>`, else `SPECGATE_BASE`, else origin's default branch, `main`, `master` or `develop`, the first HEAD shares history with — counting the working tree's changes and its untracked files, and SHALL take as touched each requirement whose section in a spec file has a changed line or names its id on a changed line, whose feature file changed, or whose code or test file in the matrix changed; it SHALL run the test files the matrix links to the touched requirements, every changed test file, and, in JavaScript and TypeScript, each test file whose relative imports reach a changed file; and every `check --json` answer SHALL give `selection` with its `mode` (`affected` or `full`), its `reason`, the `base`, the `changed` files, the touched `requirements`, the `tests` it selected, the `cached` ones it did not run again and the `command` it ran.

#### Scenario: SCN-510a — One requirement's code changed on a branch

- GIVEN a git project on `main` whose REQ-001 and REQ-002 each have a source file and a test file that name them, with `test_cmd` `node run-tests.js {files}`, and a branch where only REQ-001's source file changed
- WHEN a tool runs `specgate check --affected --json`
- THEN it exits 0, `selection.mode` is `affected`, `requirements` is `["REQ-001"]`, `tests` is REQ-001's test file alone, and the tests stage ran `node run-tests.js` with that one file

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-510.feature kind=functional status=Implemented -->

### Requirement: REQ-511 — A change to what every test depends on runs the whole suite

The system SHALL, when a changed file is one every test can depend on — `package.json`, a lockfile, `harness.config.yaml`, a `tsconfig` or `jsconfig` file, a build or test-runner configuration such as `pom.xml`, `build.gradle`, `pyproject.toml`, `go.mod` or `jest.config.js`, or a file matching one of the globs listed under `full_on:` in `harness.config.yaml` — run the whole suite under `check --affected`, with `selection.mode` `full` and a `reason` that names the file.

#### Scenario: SCN-511a — The lockfile changed

- GIVEN the project of SCN-510a on a branch where REQ-001's source file and `package-lock.json` changed
- WHEN a tool runs `specgate check --affected --json`
- THEN `selection.mode` is `full`, its `reason` names `package-lock.json`, and the tests stage ran `node run-tests.js` with no file

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-511.feature kind=functional status=Implemented -->

### Requirement: REQ-512 — When nothing maps, the whole suite runs, and says why

The system SHALL never run no test silently under `check --affected`: when nothing changed since the base, when no base can be found, when a changed file no requirement, test or import links to, or when the change links to no test file, it SHALL run the whole suite, with `selection.mode` `full` and a `reason` that says which of these it was.

#### Scenario: SCN-512a — Only an unlinked file changed

- GIVEN the project of SCN-510a on a branch where only `src/helpers.sql`, which no requirement, test or import names, changed
- WHEN a tool runs `specgate check --affected --json`
- THEN `selection.mode` is `full`, its `reason` names `src/helpers.sql` as linked to nothing, and the tests stage ran the whole suite

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-512.feature kind=functional status=Implemented -->

### Requirement: REQ-513 — The test command takes the selected files

The system SHALL fill `{files}` in the test command with the selected test files, each quoted for the platform's shell, and `{req}` with the touched requirement when there is exactly one; SHALL, under `check --affected`, run `test_cmd_affected:` from `harness.config.yaml` when it is set and `test_cmd` otherwise; and SHALL, when that command has neither placeholder, run it whole with `selection.mode` `full`, giving the finding `affected_needs_files` whose fix says how to add `{files}`. When the whole suite runs, `{files}` and `{req}` SHALL be empty.

#### Scenario: SCN-513a — A command with no placeholder, then a path with a space

- GIVEN the project of SCN-510a whose `test_cmd` is `node run-tests.js`, and REQ-001's test file at `test/my req.test.js`
- WHEN a tool runs `specgate check --affected --json`, then sets `test_cmd_affected` to `node run-tests.js {files}` and runs it again
- THEN the first answer has `selection.mode` `full` and the finding `affected_needs_files` naming `{files}`; the second ran `node run-tests.js` with `test/my req.test.js` as one argument

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-513.feature kind=functional status=Implemented -->

### Requirement: REQ-514 — The whole suite stays the default, and CI always runs it

The system SHALL run the whole suite on `specgate check` with no flag, as before, with `selection.mode` `full`; and on `specgate check --ci`, even with `--affected`, SHALL run the whole suite, never read or write the result cache, and give the finding `affected_ignored_ci`.

#### Scenario: SCN-514a — --ci with --affected

- GIVEN the project of SCN-510a on its branch
- WHEN a tool runs `specgate check --json`, then `specgate check --ci --affected --json`
- THEN both ran the whole suite with `selection.mode` `full`; the second has the finding `affected_ignored_ci` and no test file `cached`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-514.feature kind=functional status=Implemented -->

### Requirement: REQ-515 — apply runs the tests of the requirement it delivers

The system SHALL, when `specgate apply <REQ>` runs the tests, fill `{files}` with the test files the matrix links to that requirement — to the requirements given, when several are — and `{req}` as before; and SHALL use `test_cmd_affected` when it is set, and `test_cmd` otherwise.

#### Scenario: SCN-515a — apply with {files}

- GIVEN the project of SCN-510a with REQ-001 Approved and `test_cmd_affected` `node run-tests.js {files}`
- WHEN a person runs `specgate apply REQ-001`
- THEN REQ-001 is Implemented and the tests that ran were REQ-001's test file alone

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-515.feature kind=functional status=Implemented -->

### Requirement: REQ-516 — A test that passed on the same code is not run again

The system SHALL, under `check --affected` with a command that takes `{files}`, keep in the repository's git folder, beside the last gate result, each test file that passed with the hashes of its content and of the files it depends on — the code files the matrix links to its requirements and, in JavaScript and TypeScript, the files its relative imports reach, or every source file of the project when an import cannot be followed — under the test command, the lockfiles and the files every test depends on; SHALL not run again a selected test file whose hashes are all unchanged, listing it under `selection.cached` and saying so; and SHALL read and write nothing of it with `--no-cache` or `--ci`.

#### Scenario: SCN-516a — The same check twice, then a change to the code under test

- GIVEN the project of SCN-510a on its branch, where `specgate check --affected` passed
- WHEN `specgate check --affected --json` runs again, then REQ-001's source file changes and it runs a third time, then it runs with `--no-cache`
- THEN the second answer lists REQ-001's test file under `cached` and ran no test; the third ran it; the fourth ran it and cached nothing

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-516.feature kind=functional status=Implemented -->

### Requirement: REQ-517 — validate, status and matrix grow linearly with the project

The system SHALL keep the time `validate --strict`, `status --json` and `matrix --json` take about linear in the number of requirements: on generated projects of 500, 1,000 and 2,000 requirements, each with a feature, a test and a source file, each command on 2,000 SHALL take less than six times what it takes on 500 and finish within a budget a CI runner meets.

#### Scenario: SCN-517a — 500, 1,000 and 2,000 requirements

- GIVEN three generated projects of 500, 1,000 and 2,000 requirements in temporary folders
- WHEN the benchmark runs `validate --strict`, `status --json` and `matrix --json` on each
- THEN every run exits 0, and for each command the time on 2,000 is less than six times the time on 500

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-517.feature kind=functional status=Implemented -->

### Requirement: REQ-518 — The architecture check and the tests run side by side

The system SHALL, in `specgate check`, run `validate --strict` first and stop there when it fails; then run `arch_cmd` and the tests at the same time, each with its own output, and report both before the gate decides; then the quality checks by their `when:` stage, as before; and SHALL run them one after the other when `harness.config.yaml` sets `gate_parallel: false`.

#### Scenario: SCN-518a — Two stages of one second each

- GIVEN a project whose `arch_cmd` and `test_cmd` each wait one second, print a line and pass
- WHEN a tool runs `specgate check --json`, then sets `gate_parallel: false` and runs it again
- THEN the first answer's architecture and tests stages both passed and overlapped in time; the second's ran one after the other

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-518.feature kind=functional status=Implemented -->

### Requirement: REQ-519 — Each stage says how long it took

The system SHALL give each entry of `stages` in `specgate check --json`, and of the last result kept, `ms`: the milliseconds the stage took, or null for a stage that did not run; and SHALL show each stage's time on its line when the output is a terminal.

#### Scenario: SCN-519a — A passing check

- GIVEN a project whose test command waits a quarter of a second and passes
- WHEN a tool runs `specgate check --json`, then `specgate check --last --json`
- THEN the validate and tests stages have `ms` of at least 0 and 250, the architecture stage has `ms` null, and the last result gives the same

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-519.feature kind=functional status=Implemented -->

### Requirement: REQ-675 — Code under a folder named spec is not a test

The system SHALL, when it derives the matrix, read a file as a test only when its name is a test's, or when it sits under a test folder — `spec` or `specs` counting as one only as the first folder of its path — so that source code in a folder named `spec` deeper in the tree, that mentions a requirement, fills the code column and never the test column.

> Found migrating specgate's own matrix (2026-11-23): `scripts/cli/commands/spec/DoneCommand.ts` was listed as the test of REQ-662.

#### Scenario: SCN-675a — A command folder named spec

- GIVEN a project whose `scripts/commands/spec/Done.ts` and `tests/done.test.ts` both mention REQ-062
- WHEN the Developer runs `specgate matrix --json`
- THEN REQ-062's tests are `tests/done.test.ts` only, and its code names `scripts/commands/spec/Done.ts`

#### Scenario: SCN-675b — RSpec's spec folder

- GIVEN a Ruby project whose `spec/models/order_spec.rb` and `spec/support/order_helper.rb` mention REQ-063
- WHEN the Developer runs `specgate matrix --json`
- THEN REQ-063's tests are both files

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-675.feature kind=functional status=Implemented -->

### Requirement: REQ-676 — The migration leaves an open change's requirements to it

The system SHALL, on `specgate matrix --migrate`, never write into `spec.md` a section for a requirement stated in a capability spec or added by an open change; SHALL compare the generated matrix with the hand-kept one without the rows of requirements an open change adds or modifies, which take their place in the matrix when their change is archived; and SHALL report those rows as `matrix_rows_in_changes`, naming each change.

> Found migrating specgate's own matrix (2026-11-23): REQ-660…666, in the open change bdd-gate, were about to be appended to spec.md without their feature files.

#### Scenario: SCN-676a — A requirement still in its change

- GIVEN a hand-kept matrix with a row for REQ-020, stated in spec.md, and one for REQ-021, added by the open change draft-pedidos
- WHEN the Developer runs `specgate matrix --migrate`
- THEN the migration succeeds, spec.md has no section for REQ-021, and the output names draft-pedidos with `matrix_rows_in_changes`

#### Scenario: SCN-676b — A requirement an open change modifies

- GIVEN a hand-kept matrix whose REQ-030 row lists the scenario SCN-030b that the open change draft-avisos adds to REQ-030, stated in a capability spec
- WHEN the Developer runs `specgate matrix --migrate`
- THEN the migration succeeds, REQ-030's row is the capability spec's, and the output names draft-avisos with `matrix_rows_in_changes`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-676.feature kind=functional status=Implemented -->

### Requirement: REQ-677 — A row the generated matrix fills in further is kept

The system SHALL, on `specgate matrix --migrate`, count a hand-kept row as kept when the generated row has the same requirement, scenario, feature, use case, command, aggregate, event and status, and names every code file and test the hand-kept row names — more allowed, since the generated matrix finds every file that mentions the requirement; SHALL write into the requirement's trace only the code or tests the generated matrix would miss, leaving the rest to be found by mention; and SHALL report those rows as `matrix_rows_richer` so the Developer reviews them before committing.

> Found migrating specgate's own matrix (2026-11-23): 291 of its rows differed only because the generated matrix named more code and tests than the hand-kept one ever listed.

#### Scenario: SCN-677a — More code than the hand-kept row listed

- GIVEN a hand-kept matrix whose REQ-020 row names no code, and `src/orders.ts` mentioning REQ-020
- WHEN the Developer runs `specgate matrix --migrate`
- THEN the migration succeeds, REQ-020's row names `src/orders.ts`, and the output reports one row with `matrix_rows_richer`

#### Scenario: SCN-677b — A test the hand-kept row named and no file mentions

- GIVEN a hand-kept matrix whose REQ-020 row names `tests/orders.test.ts`, and no file mentioning REQ-020
- WHEN the Developer runs `specgate matrix --migrate`
- THEN REQ-020's section in spec.md says `test=tests/orders.test.ts` in its trace, and its row still names it

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-677.feature kind=functional status=Implemented -->

### Requirement: REQ-483 — A requirement id in a scenario's title declares nothing

The system SHALL read a requirement as declared only from a requirement heading or a requirement table row, never from a scenario heading: an id a scenario's title names — "#### Scenario: SCN-252 — Apply on REQ-030 in the browser" — is not a requirement of the spec, and `validate --strict` asks no matrix row for it.

#### Scenario: SCN-483a — A scenario that names another requirement

- GIVEN a change whose delta declares REQ-086 with the scenario "#### Scenario: SCN-252 — Apply on REQ-030 in the browser", and no REQ-030 anywhere else
- WHEN the developer runs `specgate validate . --strict`
- THEN it reports no TDD-3 finding for REQ-030, and REQ-086 is still declared

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-483.feature kind=functional status=Implemented -->

### Requirement: REQ-666 — A requirement's scenarios run one by one

The system SHALL, on `specgate scenarios <REQ> [--json]`, run each scenario of the requirement's feature files — every scenario tagged with one of its `@SCN-` ids — through the project's `bdd_cmd`, `{tags}` its own tag, one after the other, and answer for each its id, its name, its file and 1-based line, whether it passed, its exit and the last lines of its output; with no `bdd_cmd` it SHALL refuse with `bdd_cmd_missing`, and with no scenario `scenarios_none`; a scenario that fails SHALL be a `scenario_failed` finding, the command exiting 1.

> Studio (agent-panel 4c, 2026-11-22): each scenario green or red in the feature file's margin, and the requirement's way — scenarios, red, code, green, gate, apply — from what really ran.

#### Scenario: SCN-666a — One scenario passes, one fails

- GIVEN REQ-031's feature with SCN-031a and SCN-031b, and a `bdd_cmd` that passes only `@SCN-031a`
- WHEN the Developer runs `specgate scenarios REQ-031 --json`
- THEN SCN-031a passed and SCN-031b did not, each with its line, and the answer exits 1 with `scenario_failed` naming SCN-031b

#### Scenario: SCN-666b — No runner

- GIVEN a project with no `bdd_cmd`
- WHEN the Developer runs `specgate scenarios REQ-031 --json`
- THEN it is refused with `bdd_cmd_missing`, its fix `specgate config set bdd_cmd`

<!-- specgate:trace actor=Developer artifact="scripts/cli/commands/spec/ScenariosCommand.ts, scripts/scenarios.ts" feature=features/trusted-gate/REQ-666.feature kind=functional status=Implemented -->

### Requirement: REQ-503 — Every check answer lists its stages

The system SHALL include in every `specgate check --json` answer, whether the gate passed or failed, `stages`: each stage of the gate in the order it runs — `ids`, `changes`, `validate`, `architecture`, `tests`, then one `quality` stage per check with its `name` — with its `command` (null when it has none), its `result` (`passed`, `failed`, `skipped` when it is not configured or could not run, or `not run` when an earlier stage failed) and its `findings`, each with `code`, `message`, `fix`, `file` and `line` when it has them; the `validate` stage SHALL carry validate's own findings.

#### Scenario: SCN-503a — validate fails on an Approved requirement no test names

- GIVEN a project whose REQ-001 is Approved and no test names it, with `test_cmd` set
- WHEN a tool runs `specgate check --json`
- THEN it exits 1, `ids` and `changes` are `passed` or `skipped`, `validate` is `failed` with validate's own `strict_tdd_1` finding, and `tests` is `not run` with its command

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-503.feature kind=functional status=Implemented -->

### Requirement: REQ-504 — The last gate result is kept and read back

The system SHALL record, each time `specgate check` reaches a verdict, when it ran, the commit and branch it ran on, whether the working tree had uncommitted changes, whether it passed, its stages and its findings, in `last-check.json` in the repository's git folder (in `.specgate/`, ignored there, outside git), so the working tree is left as it was; and SHALL give it back with `specgate check --last --json` and the API's `lastCheck(dir)` as `lastCheck`, and, when no check has run, `lastCheck` null with the finding `last_check_none` whose fix is `specgate check`, exiting 0.

#### Scenario: SCN-504a — No check yet, then a failed one

- GIVEN a git repository with a specgate project where no check has run
- WHEN a tool runs `specgate check --last --json`, then `specgate check` with a failing test command, then `specgate check --last --json` and calls `lastCheck(dir)`
- THEN the first answer has `lastCheck` null and `last_check_none` with the fix `specgate check`; the second says the check failed, at what time and on the commit `git rev-parse HEAD` prints, with its `tests` stage `failed`; `lastCheck(dir)` gives the same; and `git status --porcelain` shows nothing new

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-504.feature kind=functional status=Implemented -->

### Requirement: REQ-613 — After adoption CI runs the test command the project saved

The system SHALL, when `adopt` detects the test command, add `npm run build` to an `npm` command of a project with a `build` script, print, save as `test_cmd` and state in `AGENTS.md` that one command, and take a command given with `--var TEST_CMD` as written; SHALL, when it wrote the CI file and saved `test_cmd` in the same run, have the job run `check .` with no `--test-cmd`; SHALL leave a CI file that was already there as it is; and SHALL, when the repository has no agent folder, say `Agent commands: not installed`.

#### Scenario: SCN-613a — A build script

- GIVEN a project whose `package.json` has `test` and `build` scripts
- WHEN the developer runs `specgate adopt`
- THEN it prints `Test command: npm test && npm run build`, `harness.config.yaml` holds that as `test_cmd`, `AGENTS.md` states it, and the job runs `check . --base` with no `--test-cmd`

#### Scenario: SCN-613b — No build script, and a command given

- GIVEN a project with a `test` script only, and another with `test` and `build` adopted with `--var TEST_CMD="npm test"`
- WHEN the developer runs `specgate adopt` in each
- THEN both save `test_cmd: "npm test"`, and the first job has no `--test-cmd`

#### Scenario: SCN-613c — A CI file already there

- GIVEN a project whose `.github/workflows/spec-gate.yml` says `# ours`
- WHEN the developer runs `specgate adopt`
- THEN the file still says `# ours`

#### Scenario: SCN-613d — The agent's commands

- GIVEN a project with no agent folder
- WHEN the developer runs `specgate adopt`
- THEN it says `Agent commands: not installed` and not `Agent: none detected`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-613.feature kind=functional status=Implemented -->

### Requirement: REQ-610 — The CI job of a Python project installs what its tests need

The system SHALL, when `ci init` or `adopt` writes the CI job of a Python project, add before the gate `pip install -r <file>` for each of `requirements.txt`, `requirements-dev.txt`, `requirements-test.txt`, `dev-requirements.txt` and `test-requirements.txt` the repository has, `pip install -e .` when `pyproject.toml` declares a `[build-system]` — with its `dev`, `test`, `tests` or `testing` extra when it declares one — and `pip install pytest` when the test command runs pytest and none of those files names it; and SHALL, when `pyproject.toml` has a `[tool.poetry]`, `[tool.pdm]` or `[tool.uv]` table, write no install command and a comment naming that tool.

#### Scenario: SCN-610a — Only pytest is missing

- GIVEN a project with a `pyproject.toml` that declares no build system, whose test command is `pytest`
- WHEN the install commands are read
- THEN they are `pip install pytest`

#### Scenario: SCN-610b — What the repository states

- GIVEN a project with `requirements.txt`, a `requirements-dev.txt` naming pytest, and a `pyproject.toml` with a `[build-system]` and a `test` extra
- WHEN the install commands are read for the test command `pytest -q`
- THEN they are `pip install -r requirements.txt`, `pip install -r requirements-dev.txt` and `pip install -e ".[test]"`

#### Scenario: SCN-610c — In the job, and Poetry

- GIVEN the first project, and another whose `pyproject.toml` has `[tool.poetry]`
- WHEN the developer runs `specgate ci init --provider github` in each
- THEN the first job runs `pip install pytest` after `setup-python`, and the second has no install command and the comment `poetry manages this project`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-610.feature kind=functional status=Implemented -->

### Requirement: REQ-611 — A delivery says everything to rewrite in one refusal

The system SHALL, when `validate --strict --delivering <id>` fails on the scenarios of the requirement being delivered, report in the same refusal that requirement's `requirement_template_obligation` when its obligation is still the sentence Specgate wrote, in text and in `--json`, unless the policy reports or skips the `requirements` rule.

#### Scenario: SCN-611a — Fresh from new

- GIVEN an adopted project and REQ-002 as `specgate new` wrote it, with a test that names it
- WHEN the developer runs `specgate apply REQ-002`
- THEN it is refused once, naming `scenario_placeholder_step` and `requirement_template_obligation`

#### Scenario: SCN-611b — Both rewritten

- GIVEN the same requirement with its scenario's steps and its obligation written
- WHEN the developer runs `specgate apply REQ-002`
- THEN REQ-002 is marked Implemented

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-611.feature kind=functional status=Implemented -->

### Requirement: REQ-604 — The gate's policy is a file of the repository

The system SHALL read what the gate requires from `.specgate/gate.yaml`: a `preset` among `minimal`, `standard` and `strict`, and under `rules:` any of the rules `tdd`, `scenarios`, `requirements`, `links`, `coverage`, `ids` and `quality` set to `error`, `warning` or `off`, overriding the preset; SHALL treat a project without the file as `strict`, every rule `error`; and SHALL, when the file names an unknown preset, rule, level or key, or an `enforce_from` that is not a date, fail `validate --strict` with `gate_policy_invalid` naming every problem with its fix.

#### Scenario: SCN-604a — A preset and an override

- GIVEN a project whose `.specgate/gate.yaml` says `preset: standard` and `rules: { links: off }`
- WHEN the policy is read
- THEN coverage is `warning`, links is `off`, and every other rule is `error`

#### Scenario: SCN-604b — A policy that cannot be read

- GIVEN a `.specgate/gate.yaml` saying `preset: lax` and a rule `speed: error`
- WHEN the developer runs `specgate validate . --strict`
- THEN it exits 1 with `gate_policy_invalid`, naming `lax` and `speed` and the presets and rules to use

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-604.feature kind=functional status=Implemented test="tests/unit/gate-policy.test.ts, packages/core/test/unit/use-case-coverage.test.ts" -->

### Requirement: REQ-605 — The gate fails, reports or skips each rule as the policy says

The system SHALL, under `validate --strict` and `check`, report the findings of a rule set to `warning` as warnings with one `gate_rule_reported` naming the rule, and pass; SHALL not run a rule set to `off`; SHALL fail on a rule its own `--strict-<rule>` flag asks for, whatever the policy says; SHALL, while today is before the policy's `enforce_from`, report every `error` rule's findings as warnings, saying the date; SHALL judge the `ids` and `quality` stages of `check` the same way; and SHALL print, under `check`'s header, the policy in force and the rules it relaxes.

#### Scenario: SCN-605a — Tdd reported, not failed

- GIVEN a project where REQ-003 is Implemented with no test naming it, and `.specgate/gate.yaml` sets `tdd: warning`
- WHEN the developer runs `specgate check`
- THEN it exits 0, prints `Policy` with `tdd warning`, and its `--json` status carries `gate_rule_reported` and its validate stage `strict_tdd_1`, both as warnings

#### Scenario: SCN-605b — The flag still fails, and the date relaxes

- GIVEN the same project
- WHEN the developer runs `specgate validate . --strict --strict-tdd`, then sets the policy to `preset: strict` with `enforce_from: 2099-01-01` and runs `specgate validate . --strict`
- THEN the first exits 1 and the second exits 0, saying errors are enforced from 2099-01-01

#### Scenario: SCN-605c — No policy, the gate as it was

- GIVEN the same project with no `.specgate/gate.yaml`
- WHEN the developer runs `specgate check`
- THEN it exits 1 with `check_validate_failed`, and prints no `Policy` line

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-605.feature kind=functional status=Implemented test="tests/unit/gate-policy.test.ts, packages/core/test/unit/use-case-coverage.test.ts" -->

### Requirement: REQ-606 — The policy is configured, and a new project starts standard

The system SHALL accept `specgate config set gate.preset <preset>`, `gate.rules.<rule> <level>` and `gate.enforce_from <date>`, writing `.specgate/gate.yaml` and refusing with `config_value_invalid` a value the policy could not read; SHALL list those keys in `specgate config keys`; and SHALL, on `specgate init` and `specgate adopt`, write `.specgate/gate.yaml` with the `standard` preset and every rule on its own line when the project has none, `--no-ci` included, and never touch one that exists.

#### Scenario: SCN-606a — Set through config

- GIVEN a project with no policy
- WHEN the developer runs `specgate config set gate.rules.coverage off`, then `specgate config set gate.preset loose`
- THEN `.specgate/gate.yaml` holds `coverage: off`, and the second exits 2 with `config_value_invalid` naming minimal, standard and strict

#### Scenario: SCN-606b — A new project's policy

- GIVEN an empty folder
- WHEN the developer runs `specgate init --no-ci`
- THEN `.specgate/gate.yaml` says `preset: standard` and lists the seven rules

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-606.feature kind=functional status=Implemented test="tests/unit/gate-policy.test.ts, packages/core/test/unit/use-case-coverage.test.ts" -->

### Requirement: REQ-654 — A command that takes time tells how far it is

The system SHALL, when SPECGATE_PROGRESS_FILE names a file, have `specgate apply` and `specgate check` append to it one JSON line per stage as it starts and as it ends — `{ at, stage, state }`, the stage being validate, architecture, tests or the gate's others, the state running, passed, failed or skipped — a running architecture or tests stage naming in `log` the file its output goes to as it is written; it SHALL answer as it would without it, and write nothing when the variable is not set.

> A studio showed "Apply REQ-001" with a spinner for minutes: specgate said nothing until the end.

#### Scenario: SCN-654a — Apply, stage by stage

- GIVEN a project whose REQ-001 passes, and SPECGATE_PROGRESS_FILE set
- WHEN the Developer runs `specgate apply REQ-001 --json` with a test command that prints "health › reports healthy"
- THEN the file says validate running then passed, tests running then passed, each line with its time, and the tests' log holds "health › reports healthy"

#### Scenario: SCN-654b — A failing stage

- GIVEN the same project with a failing test
- WHEN the Developer runs `specgate apply REQ-001 --json`
- THEN the file's last line is tests failed, and apply still refuses with its evidence

#### Scenario: SCN-654c — The gate, stage by stage

- GIVEN the same project with its test command in harness.config.yaml
- WHEN the Developer runs `specgate check`
- THEN the file says validate running and how it ended, then tests running and how it ended

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-654.feature kind=functional status=Implemented -->

### Requirement: REQ-739 — Approving a change seals each of its requirements

The system SHALL, on `specgate change approve <id>`, record for each requirement of the change's delta a seal of its heading, its statement and its scenarios — the `specgate:trace` comment left out —, at every rigor, a change of lite rigor with nothing written in its layers included.

> Found on 2026-11-24: an approval remembered the discover, the design and the tasks, and not the requirements; at lite rigor, a date.

#### Scenario: SCN-739a — Sealed at lite rigor

- GIVEN draft-pedidos of lite rigor with REQ-031 and nothing written in its layers
- WHEN the Developer runs `specgate change approve draft-pedidos`
- THEN approvals.json has a seal for REQ-031

#### Scenario: SCN-739b — Delivering is not changing

- GIVEN draft-pedidos approved with REQ-031 sealed
- WHEN `specgate apply REQ-031` writes its status in the delta
- THEN REQ-031's seal still matches, and the gate says nothing of it

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-739.feature kind=functional status=Implemented -->

### Requirement: REQ-740 — The gate fails when an approved requirement changed

The system SHALL fail `specgate validate --strict` — and so `check`, `apply` and the harness gate — with `approved_requirement_changed` for each requirement of an approved change whose statement or scenarios differ from its seal, that was added after the approval, or that was sealed and is gone, naming the requirement and which of the three, whose fix is to approve the change again; and SHALL pass once it is approved again.

> Measured on 2026-11-24: an approved requirement rewritten from "0.50 a day, at most 10.00" to "1.00 a day, at most 20.00", and `specgate check` passed.

#### Scenario: SCN-740a — A requirement rewritten after approval

- GIVEN draft-pedidos approved, then REQ-031's statement changed to let a shipped order be cancelled
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `approved_requirement_changed` naming REQ-031 as changed, whose fix is `specgate change approve draft-pedidos`

#### Scenario: SCN-740b — A scenario loosened

- GIVEN draft-pedidos approved, then SCN-032's THEN changed from "is not cancelled" to "is cancelled"
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `approved_requirement_changed` naming REQ-031

#### Scenario: SCN-740c — Approved again

- GIVEN the same change after its requirement was rewritten
- WHEN the Developer runs `specgate change approve draft-pedidos` and then `specgate check`
- THEN the finding is gone

#### Scenario: SCN-740d — A requirement slipped in

- GIVEN draft-pedidos approved, then REQ-032 added to its delta
- WHEN the Developer runs `specgate check`
- THEN the gate fails with `approved_requirement_changed` naming REQ-032 as added after the approval

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-740.feature kind=functional status=Implemented -->

### Requirement: REQ-741 — A change approved before seals existed is said to be unsealed

The system SHALL, for a change approved with no seals recorded, warn `approval_not_sealed` naming the change, whose fix is `specgate change approve <id>`, and pass the gate as it did.

> Every project approved its changes before this: they are not broken by it.

#### Scenario: SCN-741a — Approved by an earlier Specgate

- GIVEN draft-pedidos approved with only `approved: 2026-11-01` in its change.yaml
- WHEN the Developer runs `specgate check`
- THEN the gate passes with the warning `approval_not_sealed` naming draft-pedidos

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-741.feature kind=functional status=Implemented -->

### Requirement: REQ-733 — The harness gate runs the requirement's scenarios

The system SHALL, on `specgate harness run` in a project with `bdd: required`, run the requirement's scenarios through `bdd_cmd` as the gate's stage `scenarios`, after the test command; fail the attempt when they do not end well, telling the next attempt which scenarios failed and what they printed; and mark no requirement delivered whose scenarios failed.

> Found on 2026-11-24: the harness marked a requirement delivered without running its scenarios — it skips apply's gate, having run its own, and the scenarios were in neither.

#### Scenario: SCN-733a — Built to a test that says something else

- GIVEN a project with `bdd: required`, REQ-004 pending, and an agent whose code passes the test command and fails REQ-004's scenarios
- WHEN the Developer runs `specgate harness run --req REQ-004 --max-attempts 1`
- THEN REQ-004 fails at the stage `scenarios`, is not Implemented, and the report names the scenario that failed

#### Scenario: SCN-733b — Its scenarios pass

- GIVEN the same project and an agent whose code passes the test command and REQ-004's scenarios
- WHEN the Developer runs `specgate harness run --req REQ-004`
- THEN the gate's stages include `scenarios`, passed, and REQ-004 is Implemented

#### Scenario: SCN-733c — Not required, not run

- GIVEN a project whose gate.yaml does not say `bdd: required`
- WHEN the Developer runs `specgate harness run --req REQ-004`
- THEN the gate has no stage `scenarios`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-733.feature kind=functional status=Implemented -->

### Requirement: REQ-734 — Check runs the delivered requirements' scenarios

The system SHALL, on `specgate check` in a project with `bdd: required` and a `bdd_cmd`, run as the stage `scenarios` the scenarios of each delivered requirement that has a feature file, one requirement after the other, and fail naming each requirement and scenario that did not end well; with `--no-scenarios` it SHALL leave the stage out and report it as skipped at the Developer's word.

> What CI runs is `specgate check`: code changed after its requirement was delivered, to say something else than its scenario, passed there.

#### Scenario: SCN-734a — Code changed after delivery

- GIVEN a project with `bdd: required`, REQ-004 Implemented, and code changed so REQ-004's scenario SCN-004a fails while the test command passes
- WHEN the Developer runs `specgate check`
- THEN the gate fails at the stage `scenarios` with `check_scenarios_failed` naming REQ-004 and SCN-004a

#### Scenario: SCN-734b — Left out at the Developer's word

- GIVEN the same project
- WHEN the Developer runs `specgate check --no-scenarios`
- THEN the stage `scenarios` is reported skipped, naming the flag, and the other stages decide

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-734.feature kind=functional status=Implemented -->

### Requirement: REQ-735 — A delivery on a test alone says so

The system SHALL, in a project whose gate does not require executable scenarios, say on `specgate apply <REQ>` that the requirement was delivered on a test that names it and that its scenarios were not run, with `specgate migrate bdd` as the way; and show on `specgate status` how many delivered requirements stand so.

> One warning for the whole project let every requirement look checked against its scenarios.

#### Scenario: SCN-735a — Delivered, and said plainly

- GIVEN a project without `bdd: required` and REQ-004 with a passing test that names it
- WHEN the Developer runs `specgate apply REQ-004`
- THEN REQ-004 is Implemented and the output says its scenarios were not run, naming `specgate migrate bdd`

#### Scenario: SCN-735b — Status counts the requirements delivered on a test alone

- GIVEN that project with three requirements delivered
- WHEN the Developer runs `specgate status --json`
- THEN the answer says 3 requirements were delivered without their scenarios run

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-735.feature kind=functional status=Implemented -->

### Requirement: REQ-742 — Source written by any means before its test stops the session

The system SHALL, where Specgate's hooks run in the agent's tool, refuse the agent's next tool call — its shell included — while the working tree holds a new or changed source file and no new or changed test names a requirement of the open change, naming the file and the requirement whose test is owed; and SHALL allow a call that reads, and a call that writes a test.

> Measured on 2026-11-24: refused a write to src/fees.js, an agent wrote it with `cat > src/fees.js` in its shell, five times of six.

#### Scenario: SCN-742a — Written through the shell

- GIVEN draft-fees open with REQ-002 and no test changed, and src/fees.js written by a shell command
- WHEN the agent calls its shell again
- THEN the call is refused, naming src/fees.js and REQ-002

#### Scenario: SCN-742b — The test puts it right

- GIVEN the same session, refused
- WHEN the agent writes test/fees.test.js naming REQ-002, then calls its shell
- THEN the write is allowed, and the shell call after it

#### Scenario: SCN-742c — Reading is not stopped

- GIVEN the same session, refused
- WHEN the agent reads spec.md
- THEN the call is allowed

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-742.feature kind=functional status=Implemented -->

### Requirement: REQ-743 — Step definitions changed after the code began fail the gate

The system SHALL record the step definitions of a requirement's scenarios as they are when the first source file of its delivery is written, and SHALL fail `specgate apply` and the harness gate with `steps_changed_after_code` when a step definition was added or changed after that, naming the file, whose fix is for a person to review it and run `specgate apply <REQ> --steps-reviewed`; and SHALL say, where nothing recorded them, that the steps were written in the same delivery as the code.

> Measured on 2026-11-24: its code built to a test that said otherwise, an agent wrote the step "the fee is {float}" as `assert.equal(fee, expected * 2)`, and the gate's scenarios passed, three times of three.

#### Scenario: SCN-743a — Steps bent to the code

- GIVEN REQ-002's steps recorded when src/fees.js was first written
- WHEN features/step_definitions/fees.steps.js is changed, and the Developer runs `specgate apply REQ-002`
- THEN apply fails with `steps_changed_after_code` naming features/step_definitions/fees.steps.js

#### Scenario: SCN-743b — Steps first

- GIVEN REQ-002's step definitions written before any source file, and not changed since
- WHEN the Developer runs `specgate apply REQ-002`
- THEN the gate says nothing of the steps

#### Scenario: SCN-743c — A person looked

- GIVEN the finding of SCN-743a
- WHEN the Developer runs `specgate apply REQ-002 --steps-reviewed`
- THEN REQ-002 is delivered, and its evidence says the steps were reviewed and by whom

#### Scenario: SCN-743d — Nothing recorded them

- GIVEN REQ-002 delivered with no hook and no harness, its step definitions new in the working tree
- WHEN the Developer runs `specgate apply REQ-002`
- THEN apply passes, saying the steps were written in the same delivery as the code and were not reviewed

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-743.feature kind=functional status=Implemented -->

### Requirement: REQ-744 — A delivery says the source files its change's design does not name

The system SHALL, when the design of an approved change names source files, report `file_outside_design` for each new source file of a delivery that the design does not name, as a warning, and as an error where the gate's rule `scope` is `error`, whose fix is to name the file in the design and have it approved again, or to open a change for it; and SHALL say nothing where the design names no source file.

> Measured on 2026-11-24: asked for a function no requirement asked for, an agent wrote src/export.js and a test that named REQ-002, the late fee, and the gate passed, three times of three.

#### Scenario: SCN-744a — A file nobody designed

- GIVEN draft-fees approved, its design naming src/fees.js, and the rule `scope: error`
- WHEN a delivery adds src/export.js and the Developer runs `specgate check`
- THEN the gate fails with `file_outside_design` naming src/export.js

#### Scenario: SCN-744b — A warning by default

- GIVEN the same project with no `scope` rule
- WHEN the Developer runs `specgate check`
- THEN the gate passes with the warning `file_outside_design` naming src/export.js

#### Scenario: SCN-744c — A design that names no file

- GIVEN draft-fees of lite rigor, its design not written
- WHEN a delivery adds src/export.js and the Developer runs `specgate check`
- THEN the gate says nothing of it

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-744.feature kind=functional status=Implemented -->

### Requirement: REQ-745 — A requirement of a change nobody approved is not delivered

The system SHALL refuse `specgate apply` for a requirement of an open change that is not approved, where the project's approvals are required, with `change_not_approved`, naming the change and the approval it waits for, whose fix is `specgate change approve`, by a person; and SHALL deliver as before a requirement of an approved change, a requirement no change owns, and any requirement where `approvals.required` is `never`.

> Measured on 2026-11-25: asked for something no requirement asks for, an agent opened a change, wrote REQ-005 itself and delivered it with `specgate apply`. Nobody approved it.

#### Scenario: SCN-745a — Its own requirement

- GIVEN export-loans open with REQ-005, written in the session and approved by nobody
- WHEN `specgate apply REQ-005` runs with the gate green
- THEN apply fails with `change_not_approved` naming export-loans, and REQ-005 stays as it was

#### Scenario: SCN-745b — An approved change is delivered

- GIVEN the same change, approved
- WHEN `specgate apply REQ-005` runs
- THEN REQ-005 is delivered

#### Scenario: SCN-745c — A project that asks for no approvals

- GIVEN the change of SCN-745a and `approvals: { required: never }`
- WHEN `specgate apply REQ-005` runs
- THEN REQ-005 is delivered

#### Scenario: SCN-745d — No change owns it

- GIVEN REQ-001 written straight into spec.md
- WHEN `specgate apply REQ-001` runs
- THEN apply says nothing of approvals

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-745.feature kind=functional status=Implemented -->

### Requirement: REQ-746 — A person's acts are refused to the agent's session

The system SHALL, where Specgate's hooks run in the agent's tool, refuse a tool call of the agent's that approves a change, switches the guard, says a person reviewed the steps, or writes, moves or removes the files the controls keep — the guard's switch, the gate's policy, the evidence, a change's approvals — saying the act is a person's; SHALL allow a call that reads them; SHALL NOT say, in any refusal of the guard, how to switch the guard off; and SHALL, in OpenCode, keep the guard as it was when the session started.

> Measured on 2026-11-25: refused, an agent ran `specgate config set agent_guard off` — the refusal had told it to — in two runs of twelve, removed `.specgate/evidence` in three, and ran `specgate apply --steps-reviewed` inside a terminal it made for itself in one.

#### Scenario: SCN-746a — Switching the guard off

- GIVEN a session of the agent's in a project with the guard on
- WHEN the agent's shell runs `specgate config set agent_guard off`
- THEN the call is refused, saying that switching the guard is a person's

#### Scenario: SCN-746b — Approving its own change

- GIVEN the same session
- WHEN the agent's shell runs `specgate change approve draft-fees`
- THEN the call is refused, saying that approving is a person's

#### Scenario: SCN-746c — A review nobody made

- GIVEN the same session
- WHEN the agent's shell runs `specgate apply REQ-002 --steps-reviewed`
- THEN the call is refused, saying that reviewing the steps is a person's

#### Scenario: SCN-746d — The record removed

- GIVEN the same session
- WHEN the agent's shell runs `rm -rf .specgate/evidence`, or its file tool writes `.specgate/config.json`
- THEN the call is refused, naming the file

#### Scenario: SCN-746e — Reading is allowed

- GIVEN the same session
- WHEN the agent's shell runs `cat .specgate/evidence/REQ-002/steps.json`
- THEN the call is allowed

#### Scenario: SCN-746f — No way out in the refusal

- GIVEN source written before its test
- WHEN the guard refuses
- THEN the refusal does not name `agent_guard`

#### Scenario: SCN-746g — The switch, after the session started

- GIVEN an OpenCode session started with the guard on
- WHEN `.specgate/config.json` comes to say `agent_guard: off`, and the agent writes source before its test
- THEN the write is refused

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-746.feature kind=functional status=Implemented -->

### Requirement: REQ-747 — A run that changed the controls fails, judged from outside it

The system SHALL, in `specgate harness run` and in `specgate compat run`, read the controls before the agent starts — the guard's switch, the gate's policy, each open change's approvals, the evidence, the steps said to be reviewed — keep that reading where the agent does not write, and fail the attempt or the run with `controls_changed_by_session` when the agent stops, naming each one that changed; SHALL read the steps against the record the guard wrote to the hook log, where there is one, so a record removed from the project is still seen; and SHALL say nothing of a run that changed none.

> Measured on 2026-11-25: every control a run went around was a file in the folder the run was writing.

#### Scenario: SCN-747a — The guard switched off

- GIVEN a run whose project has the guard on when the agent starts
- WHEN the agent stops with `agent_guard: off` in the project
- THEN the run fails with `controls_changed_by_session`, naming the guard

#### Scenario: SCN-747b — Approved by the session

- GIVEN a run whose change export-loans has no approval when the agent starts
- WHEN the agent stops with export-loans approved
- THEN the run fails with `controls_changed_by_session`, naming the approval of export-loans

#### Scenario: SCN-747c — The record removed

- GIVEN a run whose guard wrote REQ-002's steps to the hook log
- WHEN the agent stops with no record in the project and features/fees/REQ-002.steps.js changed since
- THEN the run fails with `controls_changed_by_session`, naming the steps of REQ-002

#### Scenario: SCN-747d — A run that kept to them

- GIVEN a run that wrote its test, its code and its evidence
- WHEN the agent stops
- THEN the judge says nothing of the controls

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-747.feature kind=functional status=Implemented -->

### Requirement: REQ-748 — Approving takes a person at a terminal

The system SHALL refuse `specgate change approve` when its input is not a terminal and `SPECGATE_ASSUME_TTY` is not set, with `approve_needs_person`, saying approving is a person's act and recording nothing; and SHALL approve as before at a terminal and through the studio's Review.

> Measured on 2026-11-25: Codex, which runs Specgate with no hooks, ran `specgate change approve export-csv --layer design` on the change it had just written, and the command approved it.

#### Scenario: SCN-748a — An agent's command

- GIVEN export-csv open and not approved
- WHEN `specgate change approve export-csv` runs with no terminal
- THEN it fails with `approve_needs_person`, and export-csv has no approval

#### Scenario: SCN-748b — A person at a terminal

- GIVEN the same change
- WHEN a person runs `specgate change approve export-csv` at a terminal
- THEN export-csv is approved

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-748.feature kind=functional status=Implemented -->

### Requirement: REQ-754 — A branch's changes to the controls are named for its reviewer

The system SHALL, when `specgate check` compares the project with a base, name with `controls_changed_on_branch` each control the branch changed against the merge base — the guard switched off, the gate's policy, an open change's approval, a requirement's evidence removed —, leaving out the approval of a change the branch archived; SHALL report them as warnings unless the gate's policy sets `controls: error`, which fails the gate; and SHALL say nothing of a branch that changed none.

> Measured on 2026-11-25: every control an agent went around was a file of the project. On a branch, nothing told the reviewer that one had changed.

#### Scenario: SCN-754a — The guard switched off on a branch

- GIVEN a branch of main whose `.specgate/config.json` switches the guard off
- WHEN `specgate check --base main` runs
- THEN it warns with `controls_changed_on_branch` that the guard was switched off, and the gate passes

#### Scenario: SCN-754b — The policy says error

- GIVEN the same branch, and `controls: error` in `.specgate/gate.yaml` on main
- WHEN `specgate check --base main` runs
- THEN the gate fails with `controls_changed_on_branch`

#### Scenario: SCN-754c — An archived change, and a branch that changed nothing

- GIVEN a branch of main that archived an approved change, and one that only changed the code
- WHEN `specgate check --base main` runs on each
- THEN neither is told of `controls_changed_on_branch`

<!-- specgate:trace actor=Developer feature=features/trusted-gate/REQ-754.feature kind=functional status=Implemented -->
