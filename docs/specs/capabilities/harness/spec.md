# Harness

## Requirements

### Requirement: REQ-184 — The harness does not fill the disk

The system SHALL copy into the in-flight view only the files git tracks or would track, never what the project ignores (build caches, dependencies, test output), and SHALL not start a requirement when less than 2 GB (or `SPECGATE_HARNESS_MIN_FREE_GB`) is free where its worktree goes, failing it with the free space, the threshold and how to change it.

#### Scenario: SCN-184a — The in-flight copy takes what git keeps

- GIVEN a project whose `.next/`, `test-results/` and `node_modules/` are ignored, with a tracked file and an untracked one
- WHEN the files to copy are listed
- THEN they are the tracked file, the untracked one and `.gitignore`, and nothing under the ignored folders

#### Scenario: SCN-184b — A nearly full disk stops the requirement before it starts

- GIVEN 0.1 GB free and a threshold of 2 GB
- WHEN a requirement is about to start
- THEN it is not started, and the reason gives 0.1 GB free, the 2 GB needed and where

<!-- specgate:trace actor=Developer feature=features/harness/REQ-184.feature kind=functional status=Implemented test=tests/unit/harness-hardening.test.ts -->

### Requirement: REQ-185 — Re-running delivered requirements works in the order asked

The system SHALL run the requirements `--req` names in the order given, and SHALL recreate, without `--force`, a requirement's branch whose own commits are all merged into the base and that no worktree holds; a branch with no commit of its own, or with work not merged, still needs `--resume` or `--force`.

#### Scenario: SCN-185a — --req runs in the order given

- GIVEN a plan ordering REQ-085, REQ-017, REQ-052
- WHEN the run is asked for REQ-017, REQ-052, REQ-085
- THEN it runs REQ-017, REQ-052, REQ-085; and without `--req` the plan's order stands

#### Scenario: SCN-185b — A merged branch is recreated

- GIVEN harness/REQ-017 exists and is merged into the base
- WHEN REQ-017 runs without `--force`
- THEN its branch is recreated; and an unmerged branch is skipped unless `--force` or `--resume` is given

<!-- specgate:trace actor=Developer feature=features/harness/REQ-185.feature kind=functional status=Implemented test=tests/unit/harness-hardening.test.ts -->

### Requirement: REQ-186 — One harness run per working copy

The system SHALL hold a lock beside the git-ignored events while a harness run works in a project, SHALL refuse a second run while the holder is alive, SHALL ignore a lock whose process is gone, SHALL warn `specgate check` that its tests can break the run's post-merge gate, and SHALL say, when a post-merge gate fails, that it ran in the working copy.

#### Scenario: SCN-186a — A second run is refused

- GIVEN a harness run holds the working copy
- WHEN another run tries to take it
- THEN it is refused, and once released no lock remains

#### Scenario: SCN-186b — A stale lock does not block

- GIVEN a lock left by a process that no longer exists
- WHEN a run starts
- THEN it takes the working copy

<!-- specgate:trace actor=Developer feature=features/harness/REQ-186.feature kind=functional status=Implemented test=tests/unit/harness-hardening.test.ts -->

### Requirement: REQ-196 — The harness and its tests work on Windows

The system SHALL write Cucumber's message stream to a path with forward slashes on every platform, so the gate reads what the run did on Windows too; its test suite SHALL pass on Windows, stopping studio's whole process tree before removing a project and removing the temporary folders it makes, with retries; and `docs:terminal` and `docs:journey` SHALL say they need a POSIX shell instead of failing at `git init` on Windows, recording with the spec reporter whatever the Node version.

#### Scenario: SCN-196a — A Cucumber filter that matches nothing fails the gate on Windows

- GIVEN a test command `npx cucumber-js --tags "@does-not-exist"`
- WHEN the harness runs the gate on Windows
- THEN it fails at "cucumber messages", as on Linux

<!-- specgate:trace actor=Developer feature=features/harness/REQ-196.feature kind=non-functional status=Implemented test=tests/unit/harness-run.test.ts -->

### Requirement: REQ-198 — A requirement an open change modifies is reworked

The system SHALL give the harness a requirement that an open change modifies, and whose tests already exist, as NEEDS_REWORK instead of NEEDS_STATUS_UPDATE, and its prompt SHALL say its tests and code are for the old text and must be brought to the new one, tests first.

#### Scenario: SCN-198a — Modified with tests needs rework

- GIVEN REQ-017 is modified by an open change and has tests
- WHEN the harness reads the plan
- THEN REQ-017 is NEEDS_REWORK, and the in-flight view says the change modifies it

#### Scenario: SCN-198b — The prompt says what changed

- GIVEN REQ-017 is NEEDS_REWORK
- WHEN its prompt is built
- THEN it says the tests and code are for the old text and the tests must fail against the current behaviour first

<!-- specgate:trace actor=Developer feature=features/harness/REQ-198.feature kind=functional status=Implemented test=packages/core/test/unit/rework.test.ts -->

### Requirement: REQ-199 — A requirement used on a screen needs an e2e test

The system SHALL read `e2e_dir` from harness.config.yaml and, for a requirement whose own `surfaces=` or whose actor's surfaces in the brief include web, mobile, tablet or desktop, SHALL fail the gate at "e2e test" until a file under that folder names the requirement, and SHALL say so in its prompt.

#### Scenario: SCN-199a — On a screen by its surfaces or its actor's

- GIVEN the brief gives the Fahrschüler the web and Sistema the api, and REQ-024 says surfaces=mobile
- WHEN their surfaces are read
- THEN REQ-022 of the Fahrschüler and REQ-024 are on a screen and REQ-023 of Sistema is not

#### Scenario: SCN-199b — The prompt asks for the e2e test

- GIVEN e2e_dir is apps/web/e2e and REQ-022 is on a screen
- WHEN its prompt is built
- THEN it asks for an end-to-end test under apps/web/e2e that names REQ-022

#### Scenario: SCN-199c — The gate waits for the e2e test

- GIVEN e2e_dir is e2e and REQ-000 is on the web
- WHEN the agent writes only code, then also e2e/health.spec.js naming REQ-000
- THEN the first run fails with "No file under e2e names REQ-000" and the second does not

<!-- specgate:trace actor=Developer feature=features/harness/REQ-199.feature kind=functional status=Implemented test=tests/unit/screen-requirements.test.ts -->

### Requirement: REQ-200 — The harness template shows the streaming agent

The system's harness.config.yaml template and agent guide SHALL show the Claude Code command that streams to studio's live view, and the `e2e_dir` key.

#### Scenario: SCN-200a — The template proposes the streaming command

- GIVEN `specgate harness init`
- WHEN it writes harness.config.yaml
- THEN the file shows `claude -p --output-format stream-json --verbose … | specgate harness events --from claude` and `e2e_dir`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-200.feature kind=functional status=Implemented test=tests/unit/harness-init.test.ts -->

### Requirement: REQ-264 — The harness gives Claude Code permission to write

The system SHALL, when the agent command of `harness run` runs Claude Code in print mode (`claude -p`) with no permission flag of its own, add `--permission-mode acceptEdits` right after `claude` and say so, as the drafting commands do; and SHALL end a requirement after an attempt that wrote no file, naming the agent's permissions and `docs/agent-setup.md`, instead of running the same command again.

#### Scenario: SCN-264a — The documented Claude Code command

- GIVEN the agent command `claude -p < {prompt_file} | specgate harness events --from claude`
- WHEN the harness prepares it
- THEN it runs `claude --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude`, and a command that already says `--allowedTools` runs as written

#### Scenario: SCN-264b — An agent that writes nothing

- GIVEN an agent that exits 0 and writes no file, and three attempts allowed
- WHEN `harness run` runs the requirement
- THEN it makes one attempt, and says the agent produced no files and to see `docs/agent-setup.md`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-264.feature kind=functional status=Implemented test=tests/unit/harness-run6.test.ts -->

### Requirement: REQ-268 — Every prompt reads the requirement where the harness found it

The system SHALL build every prompt of a harness run — the implementer's, the reviewer's and the adversary's — from the project as it will be after its open changes are archived, so a requirement of a reviewed, unarchived draft reaches each of them with its statement and scenarios.

#### Scenario: SCN-268a — The review of a draft's requirement

- GIVEN REQ-005 is written only in the open change `draft-flota`
- WHEN the harness builds the reviewer's prompt for REQ-005
- THEN the prompt holds REQ-005's statement, and does not say that `spec.md` has no section for it

<!-- specgate:trace actor=Developer feature=features/harness/REQ-268.feature kind=functional status=Implemented test=tests/unit/harness-run6.test.ts -->

### Requirement: REQ-269 — The harness report counts each requirement once

The system SHALL count, in `harness report`, each requirement once with the outcome of its latest run, while the cost per delivered requirement keeps the time of every run; and SHALL keep in the ledger a run that was stopped before it finished, with the requirement it was on reported as stopped.

#### Scenario: SCN-269a — A failed run, then a passing one

- GIVEN two recorded runs of REQ-002, the first failed after 7 minutes and the second passed after 11
- WHEN `harness report` sums them up
- THEN it says 1 of 1 requirements passed, none failed, nothing spent every attempt, and 18 minutes per delivered requirement

#### Scenario: SCN-269b — A run stopped by hand

- GIVEN a `harness run` on REQ-002 that is killed while its agent works
- WHEN `harness report` reads the ledger
- THEN the run is there, with REQ-002 reported as stopped

<!-- specgate:trace actor=Developer feature=features/harness/REQ-269.feature kind=functional status=Implemented test=tests/unit/harness-run6.test.ts -->

### Requirement: REQ-271 — The agent is kept in harness.config.yaml

The system SHALL keep the agent command with `specgate config set agent "<command>"`, written to `harness.config.yaml` with the permission REQ-264 adds and, for Claude Code, the live stream REQ-278 adds; SHALL name the step in `status` while requirements are to do and no agent is set; and SHALL end a `harness run` given `--agent` on a project with none set with the command that keeps it.

#### Scenario: SCN-271a — Setting the agent once

- GIVEN a project with requirements to do and no `agent:` in `harness.config.yaml`
- WHEN the person runs `status`, then `specgate config set agent "claude -p < {prompt_file}"`
- THEN `status` named `specgate config set agent`, and `harness.config.yaml` keeps the agent with `--permission-mode acceptEdits`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-271.feature kind=functional status=Implemented test=tests/unit/harness-run6.test.ts -->

### Requirement: REQ-278 — The kept Claude Code agent is seen live

The system SHALL write, for `specgate config set agent` given a Claude Code print command that neither pipes its output nor sets an output format, the command streamed into the live view — `--output-format stream-json --verbose` after `claude`, and `| specgate harness events --from claude` at the end — and SHALL keep any other command as it is given.

#### Scenario: SCN-278a — The command status suggests

- GIVEN a project with no agent set
- WHEN the person runs `specgate config set agent "claude -p < {prompt_file}"`
- THEN `harness.config.yaml` says `agent: "claude --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude"`

#### Scenario: SCN-278b — A command that already streams or pipes

- GIVEN the commands `claude -p --output-format json < {prompt_file}` and `claude -p < {prompt_file} | tee agent.log`
- WHEN each is set as the agent
- THEN neither gets `stream-json` nor `specgate harness events`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-278.feature kind=functional status=Implemented test=tests/unit/agent-stream.test.ts -->

### Requirement: REQ-279 — Docker is checked before the first attempt

The system SHALL, before the first attempt of `harness run` and before the studio's Build starts one, check that Docker runs Linux containers when the project needs it — a quality check with `runner: docker` or `docker: true`, or Testcontainers in a build file — and, when it does not, refuse before any agent runs, naming the fix (start Docker Desktop, or the docker daemon); and SHALL treat a test command whose output says Docker cannot be reached as an environment failure: told to the person with its output, never handed to the agent, and stopping the requirement without a further attempt.

#### Scenario: SCN-279a — Docker Desktop is stopped

- GIVEN a project whose quality check runs in Docker, an agent that writes a file, and Docker not running
- WHEN `harness run` starts
- THEN it exits non-zero saying Docker is not running and to start Docker Desktop, and the agent never runs

#### Scenario: SCN-279b — A project that needs no Docker

- GIVEN a project with no Docker check and no Testcontainers, and Docker not running
- WHEN `harness run` starts
- THEN the agent runs

#### Scenario: SCN-279c — Testcontainers cannot find Docker during the tests

- GIVEN a test command that prints "Could not find a valid Docker environment" and exits 1, and three attempts allowed
- WHEN `harness run` reaches the test command
- THEN it makes one attempt and says the tests need Docker, without handing the failure to the agent

<!-- specgate:trace actor=Developer feature=features/harness/REQ-279.feature kind=functional status=Implemented test=tests/unit/harness-run7.test.ts -->

### Requirement: REQ-300 — A person classifies a requirement's gap

The system SHALL record `specgate harness report --classify REQ-NNN --gap spec-impl|intent-spec --reason "<text>"` as one line of `.harness/gaps.jsonl`, with the time it was made; SHALL refuse a classification without a reason or with another gap; and SHALL count, for a requirement classified more than once, the latest classification.

#### Scenario: SCN-300a — Classifying a requirement

- GIVEN a project whose ledger records REQ-002
- WHEN the person runs `harness report --classify REQ-002 --gap intent-spec --reason "the brief never said a truck can carry two drivers"`
- THEN `.harness/gaps.jsonl` holds that classification and the report counts REQ-002 as intent → spec, marked by a person

#### Scenario: SCN-300b — A classification without a reason

- GIVEN the same project
- WHEN the person runs `harness report --classify REQ-002 --gap spec-impl` with no `--reason`
- THEN the command fails naming `--reason`, and nothing is written

<!-- specgate:trace actor=Developer feature=features/harness/REQ-300.feature kind=functional status=Implemented test=tests/unit/harness-gaps.test.ts -->

### Requirement: REQ-301 — Specgate suggests the gap from what it recorded

The system SHALL suggest, for a requirement no person classified, *spec → implementation* when an attempt the gate rejected was followed by a passing attempt, naming the gate stage that rejected it (a quality check by its name), and *intent → spec* when the requirement changed after review — a question that blocked it was answered, a review note names it, a change modifies it, or an attempt ended because the gate failed on the specification; intent → spec SHALL win when both apply, and a person's classification SHALL win over any suggestion. The ledger SHALL record the gate stage of each rejected attempt.

#### Scenario: SCN-301a — A rejection the agent fixed

- GIVEN REQ-002's attempt 1 was rejected at `quality check: pmd` and attempt 2 passed
- WHEN the report is read
- THEN REQ-002 is suggested as spec → implementation, caught by `pmd`

#### Scenario: SCN-301b — A requirement changed after review

- GIVEN REQ-010 passed on attempt 1, and the draft's `questions.md` has an answered question that blocks REQ-010
- WHEN the report is read
- THEN REQ-010 is suggested as intent → spec

<!-- specgate:trace actor=Developer feature=features/harness/REQ-301.feature kind=functional status=Implemented test=tests/unit/harness-gaps.test.ts -->

### Requirement: REQ-302 — Both gaps, overall and per module

The system SHALL show in `harness report`, and in its `--json` summary as `gaps`, the number and share of requirements with each gap among the requirements the ledger records, overall and per module, and how many classifications a person made and how many were suggested.

#### Scenario: SCN-302a — Two modules

- GIVEN four requirements in the ledger, REQ-002 and REQ-003 of `flota` and REQ-012 and REQ-013 of `tracking`; REQ-002 spec → implementation and REQ-012 intent → spec
- WHEN the report is read
- THEN each gap is 1 of 4 (25 %), and `flota` shows 1 spec → implementation of 2 and `tracking` 1 intent → spec of 2

<!-- specgate:trace actor=Developer feature=features/harness/REQ-302.feature kind=functional status=Implemented test=tests/unit/harness-gaps.test.ts -->

### Requirement: REQ-303 — What to strengthen

The system SHALL name, under the two gaps, what to strengthen: for spec → implementation the gate stage that caught most of them, and for intent → spec the module with most of them — on a tie, the one whose latest classification or evidence is newest.

#### Scenario: SCN-303a — The check that catches most

- GIVEN three requirements suggested as spec → implementation, two caught by `pmd` and one by `test command`
- WHEN the report is read
- THEN it says to strengthen `pmd`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-303.feature kind=functional status=Implemented test=tests/unit/harness-gaps.test.ts -->

### Requirement: REQ-316 — A role's constraints reach the work they concern

The system SHALL read every `harness/<role>.md` — a front matter with `role`, `owner`, `version` and `applies-to` (`kind`, `capability`, `tag` lists) — and SHALL add to the prompt of each requirement it applies to a "Role constraints" section with its text; a package applies when every dimension it lists matches the requirement, and with no `applies-to` to every requirement.

#### Scenario: SCN-316a — Security constraints on a payment requirement

- GIVEN `harness/security.md` applying to the capability `payments`, and REQ-002 in `payments` and REQ-003 in `fleet`
- WHEN the prompts of REQ-002 and REQ-003 are built
- THEN REQ-002's prompt has the security package under "Role constraints" and REQ-003's has no such section

<!-- specgate:trace actor=Developer feature=features/harness/REQ-316.feature kind=functional status=Implemented test=tests/unit/role-packages.test.ts -->

### Requirement: REQ-317 — The report and the live view say which packages were used

The system SHALL name the packages given to an attempt as `role@version` in its `prompt` event and in the run record, show them in the live view of the requirement, and SHALL list in `harness report` each package with the number of requirements it reached.

#### Scenario: SCN-317a — Two runs with the security package

- GIVEN two recorded runs whose results name `security@2`, one of them also `performance@1`
- WHEN `harness report --json` is read and the live model folds a `prompt` event naming `security@2`
- THEN the report lists security@2 for 2 requirements and performance@1 for 1, and the live requirement shows security@2

<!-- specgate:trace actor=Developer feature=features/harness/REQ-317.feature kind=functional status=Implemented test=tests/unit/role-packages.test.ts -->

### Requirement: REQ-318 — A reviewer per package, that only advises

The system SHALL ask the builtin review check, when packages apply to the requirement, for one line per package — `- <role>: OK` or `- <role>: ADVICE — …` — and SHALL never fail the review on that advice.

#### Scenario: SCN-318a — The review instruction names each package

- GIVEN the security and performance packages apply to REQ-002
- WHEN the review instruction is written
- THEN it asks for a line for security and one for performance, and says the advice does not decide the verdict

<!-- specgate:trace actor=Developer feature=features/harness/REQ-318.feature kind=functional status=Implemented test=tests/unit/role-packages.test.ts -->

### Requirement: REQ-372 — A scratch file that cannot be removed never fails the command

The system SHALL remove the prompt files it writes for an agent (`change author`, the drafting agents, the harness) without ever failing the command when the file cannot be removed yet: it retries briefly on `EBUSY` or `EPERM`, then leaves the file to the system.

#### Scenario: SCN-372a — Windows still holds the prompt file

- GIVEN removing a prompt file fails with `EBUSY` twice, then succeeds
- WHEN the file is removed
- THEN it is removed on the third try and nothing is thrown

#### Scenario: SCN-372b — The file stays held

- GIVEN removing a prompt file always fails with `EBUSY`
- WHEN the file is removed
- THEN nothing is thrown, and the file is reported as left

<!-- specgate:trace actor=Developer feature=features/harness/REQ-372.feature kind=functional status=Implemented test=tests/unit/rc3-approvals.test.ts -->

### Requirement: REQ-375 — Ticking a task is not an edit of the contract

The system SHALL not refuse an attempt as `agent_touched_protected_path` for a change to a change's `tasks.md` whose only difference is the box of its tasks (`- [ ]`, `- [x]`, `- [X]`), as delivering a requirement writes it, and SHALL keep refusing any other edit of that file; the implementing prompt SHALL say that the harness ticks the requirement's tasks itself.

#### Scenario: SCN-375a — The agent ticks the task it delivered

- GIVEN an approved layered change of two requirements
- WHEN the agent implements REQ-002 and ticks its task in tasks.md
- THEN the attempt is not refused for a protected path

#### Scenario: SCN-375b — The agent rewrites a task

- GIVEN the same change
- WHEN the agent rewords REQ-002's task in tasks.md
- THEN the attempt is refused with `agent_touched_protected_path`, naming tasks.md

<!-- specgate:trace actor=Developer feature=features/harness/REQ-375.feature kind=functional status=Implemented test=tests/unit/rc4-ticks.test.ts -->

### Requirement: REQ-417 — An empty attempt after a written one is retried once

The system SHALL attempt a requirement once more, with attempts left, when its agent produced no files and an attempt earlier in the same run did, telling the agent it wrote nothing; and SHALL stop as before when no attempt of the run wrote, or after that one retry.

#### Scenario: SCN-417a — The agent writes nothing for one requirement of the run

- GIVEN a project with REQ-000, REQ-001 and REQ-002, and an agent that writes the first time for each, except the first time for REQ-001
- WHEN the developer runs `specgate harness run --max-attempts 2`
- THEN REQ-001 says the agent produced no files and is retried once, and all three pass

<!-- specgate:trace actor=Developer feature=features/harness/REQ-417.feature kind=functional status=Implemented test=tests/unit/harness-run.test.ts -->

### Requirement: REQ-532 — A tester and an implementer, as separate sessions

The system SHALL, when `harness.config.yaml` sets `lanes: [tester, implementer]`, run each attempt as two agent sessions in the requirement's worktree, in that order: the tester, told to write the failing tests the requirement's scenarios call for and no production code, then the implementer, told to make those tests pass without changing them; each session SHALL get `SPECGATE_LANE` set to its lane in its environment and its role in the run's attempt log; and without `lanes:` the harness SHALL keep a single session per attempt.

#### Scenario: SCN-532a — Two sessions, in order

- GIVEN a project whose harness config sets `lanes: [tester, implementer]` and an agent that appends `SPECGATE_ROLE` to a log outside the worktree
- WHEN a tool runs `specgate harness run --req REQ-000`
- THEN the log holds `tester` then `implementer`, and the run's attempt log names both roles

<!-- specgate:trace actor=Developer feature=features/harness/REQ-532.feature kind=functional status=Implemented -->

### Requirement: REQ-533 — Each role stays in its lane

The system SHALL, with `roles:` set, revert after the tester's session every file it created or changed that is not a test file, and after the implementer's session every test file it created or changed — a test file by the conventions the derived matrix uses — keeping build manifests (`package.json`, `pom.xml`, `build.gradle`, `build.gradle.kts`) and the prompt archive; and SHALL report each reverted file as `lane_crossed`, naming the role and the path.

#### Scenario: SCN-533a — The implementer rewrites a test

- GIVEN the project of SCN-532a and an agent that, as tester, writes `tests/a.test.js`, and as implementer writes `src/a.js` and overwrites `tests/a.test.js`
- WHEN a tool runs `specgate harness run --req REQ-000`
- THEN the output reports `lane_crossed` for `implementer` and `tests/a.test.js`, and the tester's content of `tests/a.test.js` is what the gate ran

<!-- specgate:trace actor=Developer feature=features/harness/REQ-533.feature kind=functional status=Implemented -->

### Requirement: REQ-534 — The agent's own instructions are protected by default

The system SHALL protect by default, besides the specification paths it protects today, the files that steer the agent — `CLAUDE.md`, `.claude/**`, `.cursor/**`, `.github/**` and `.mcp.json` — so that an attempt that changes one fails with `agent_touched_protected_path` naming it, as for any protected path; SHALL count creating one of those files, or `AGENTS.md` or `AI_RULES.md`, as changing it, where a new file under the other protected paths stays allowed; and `protected_paths` in `harness.config.yaml` SHALL still replace the default list.

#### Scenario: SCN-534a — The agent edits its own instructions

- GIVEN a project with the default protected paths and an agent that writes a source file and appends a line to `CLAUDE.md`
- WHEN a tool runs `specgate harness run --req REQ-000`
- THEN the attempt fails with `agent_touched_protected_path` naming `CLAUDE.md`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-534.feature kind=functional status=Implemented -->

### Requirement: REQ-535 — A requirement has a cost budget

The system SHALL sum, per requirement, the `cost` each agent session's final usage line reports, and when `max_cost_usd` in `harness.config.yaml` is set and the sum reaches it after a session, SHALL start no further session for that requirement — neither the rest of the attempt, recorded at the stage `budget`, nor a retry — while the gate still judges the work already done; a requirement that does not pass SHALL end `fail`, reporting `budget_exceeded` with the cost and the limit; and a session that reports no cost SHALL count as zero, with the warning `cost_unknown` once per requirement while a budget is set.

#### Scenario: SCN-535a — The first attempt spends the budget

- GIVEN `max_cost_usd: 0.5` and an agent that writes a usage line with a cost of 0.6 and a test that fails the gate
- WHEN a tool runs `specgate harness run --req REQ-000`
- THEN the requirement fails after one attempt, and the output reports `budget_exceeded` with 0.60 and 0.5

<!-- specgate:trace actor=Developer feature=features/harness/REQ-535.feature kind=functional status=Implemented -->

### Requirement: REQ-559 — The lanes are not the roles

The system SHALL refuse a `harness.config.yaml` whose `roles:` is a list — 0.35's spelling of the lanes — naming `lanes: [tester, implementer]` and `specgate migrate 1.0` as the fix, and SHALL never read such a list as the people who hold a role; and `specgate migrate 1.0` SHALL rename that one line to `lanes:`, keeping the rest of the file byte for byte.

#### Scenario: SCN-559a — A 0.35 project's lanes

- GIVEN a committed project whose harness config has the line `roles: [tester, implementer]`
- WHEN a developer runs `specgate migrate 1.0`
- THEN the line reads `lanes: [tester, implementer]`, every other byte of the file is unchanged, and the report still asks who holds product, architect and developer

<!-- specgate:trace actor=Developer feature=features/harness/REQ-559.feature kind=functional status=Implemented -->

### Requirement: REQ-616 — The drafting commands give Claude Code its flags in Claude's own command, not after a pipe

The system SHALL, when a drafting command (`propose --from-brief --agent`, `draft <module> --agent`, and every other command that runs the agent confined to the change) adds `--permission-mode acceptEdits` or `--add-dir "<dir>"` to a Claude Code print-mode command, insert each flag right after `claude`, so that it reaches Claude Code also when the command pipes its output — as the command `harness init` writes, `claude … -p < {prompt_file} | specgate harness events --from claude`, does; and SHALL leave a command that already sets the flag as it is.

> Studio report (#530): on a project whose agent is the piped command specgate writes when Claude Code is detected, `propose --from-brief --brief <file outside the project> --agent …` failed every time with `draft_no_front_matter`: `--add-dir` was appended after the pipe, so it went to `specgate harness events` and Claude Code could not write the brief.

#### Scenario: SCN-616a — The piped agent proposes the front matter of a brief outside the project

- GIVEN the agent `claude --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude` and a brief in a folder outside the project
- WHEN the Developer runs `specgate propose --from-brief --brief <that file> --agent <that command>`
- THEN the command run is `claude --add-dir "<that folder>" --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude`, and `specgate harness events` gets no flag of Claude's

#### Scenario: SCN-616b — Edit permission for a piped agent without one

- GIVEN the agent `claude -p < {prompt_file} | specgate harness events --from claude`
- WHEN a drafting command runs it
- THEN the command run is `claude --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-616.feature kind=functional status=Implemented -->

### Requirement: REQ-490 — A run on a dirty tree, when asked, says what it left out

The system SHALL, with `specgate harness run --allow-dirty`, run on a working tree with uncommitted or untracked files, cutting every requirement's branch and worktree from the last commit and leaving those files as they are in the working copy; SHALL say so in the JSON result as `dirty`, with `allowed` and `leftOut`, the paths left out; SHALL refuse `--allow-dirty` with `--chain`, which merges into that working copy; and without `--allow-dirty` SHALL still refuse a tree that is not clean, naming the flag in the message.

#### Scenario: SCN-490a — An uncommitted note stays out of the run

- GIVEN a committed project with `notes.md` untracked and `README.md` edited and not committed
- WHEN `specgate harness run --allow-dirty --format json` delivers REQ-000 with a fake agent
- THEN REQ-000 passes, its branch has no `notes.md`, the result has `dirty.allowed` true and `dirty.leftOut` listing `README.md` and `notes.md`, and both files are still in the working copy as they were

#### Scenario: SCN-490b — Without the flag, or with --chain

- GIVEN the same dirty project
- WHEN `specgate harness run --format json` runs, and then `specgate harness run --allow-dirty --chain --format json`
- THEN the first is refused with `harness_run_error` and a message that names `--allow-dirty`, and the second is refused because `--chain` merges into the working copy

<!-- specgate:trace actor=Developer feature=features/harness/REQ-490.feature kind=functional status=Implemented -->

### Requirement: REQ-491 — Stopping a run after the requirement in progress, from the command line

The system SHALL provide `specgate harness stop --after-current [--json]`, which asks the harness run working in the project to finish the requirement in progress and start no other, and answers `stop` with `requested` and the `run` it asked (its pid, its requirements and when it started); SHALL, when no run is working there, request nothing and answer `requested` false with the warning `harness_not_running`; and the run so stopped SHALL say in its JSON result `stopped`, with `by` `request`, the reason and the requirements `notAttempted`.

#### Scenario: SCN-491a — The run stops after REQ-000

- GIVEN a run of REQ-000, REQ-001 and REQ-002 whose agent for REQ-000 runs `specgate harness stop --after-current --json`
- WHEN the run ends
- THEN the stop answered `requested` true with the run's pid, REQ-000 passed, REQ-001 and REQ-002 were not attempted, and the run's JSON has `stopped.by` `request` and `stopped.notAttempted` REQ-001 and REQ-002

#### Scenario: SCN-491b — No run to stop

- GIVEN a project where no harness run is working
- WHEN `specgate harness stop --after-current --json` runs, and `specgate harness stop --json` without the flag
- THEN the first exits 0 with `requested` false and the warning `harness_not_running`, and writes no stop request; the second is a usage error whose fix names `--after-current`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-491.feature kind=functional status=Implemented -->

### Requirement: REQ-492 — The API asks a run to stop as the command does

The system SHALL export `harnessStop(dir, { afterCurrent: true })` from `@rsaglobaltech/specgate/api`, resolving to the same answer `specgate harness stop --after-current --json` prints for that project, typed in `types/api.d.ts`, and rejecting with `not_a_project` for a folder that is not a specgate project.

#### Scenario: SCN-492a — In-process and from the command line

- GIVEN a project where a harness run holds the run lock
- WHEN a program calls `harnessStop(dir, { afterCurrent: true })`, and later, with no run, both it and `specgate harness stop --after-current --json` answer
- THEN the first answer has `requested` true with the run's pid and the stop request exists; the two later answers are equal, with `requested` false

<!-- specgate:trace actor=Developer feature=features/harness/REQ-492.feature kind=functional status=Implemented -->

### Requirement: REQ-493 — Each pending requirement has an estimate that says its basis

The system SHALL add to `specgate plan --json` an `estimates` list, one entry per pending requirement, with its `time` in milliseconds and, when a profile in `.harness/profiles.yaml` declares `cost_per_run_hint`, its `cost`; each number SHALL carry its `basis` — `history` from that requirement's recorded runs, `size` from the time delivered requirements took per scenario step times its own steps, `average` from the project's time per delivered requirement — and the `samples` it rests on, and SHALL be `null` with basis `none` when nothing recorded supports it.

#### Scenario: SCN-493a — History, size, and nothing at all

- GIVEN a ledger in which REQ-001 failed once in 90 s and REQ-000 was delivered in 60 s, REQ-000 having 3 scenario steps and REQ-002 6, and a profile `fast` declaring `cost_per_run_hint` 0.5 that ran every attempt
- WHEN `specgate plan --json` runs, and again on the project with no ledger
- THEN REQ-001's time is 90000 ms and its cost 0.5, both with basis `history`; REQ-002's time is 120000 ms and its cost 1, both with basis `size`; and with no ledger every time is `null` with basis `none`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-493.feature kind=functional status=Implemented -->

### Requirement: REQ-494 — A question is recorded with its id as soon as the agent asks it

The system SHALL, while a harness run's agent works, write a question the agent records with `specgate ask` into the project and commit it as soon as it is asked, not when the run ends, and SHALL append to the requirement's events file a `question` event carrying its `id`, its `change` and its `file`, so that the question can be answered while the run goes on.

#### Scenario: SCN-494a — The id before the agent has finished

- GIVEN a fake agent that runs `specgate ask REQ-000 "Which currency?"` and then waits until the project's questions list Q1
- WHEN the harness runs REQ-000
- THEN the agent sees Q1 in the project while it still runs, the events file has a `question` event with `id` Q1, and the question is committed

<!-- specgate:trace actor=Developer feature=features/harness/REQ-494.feature kind=functional status=Implemented -->

### Requirement: REQ-495 — A requirement whose agent asked ends waiting for the answer

The system SHALL end the requirement whose agent asked as `question`, without waiting within the run for the answer, and SHALL say in its JSON result `waitingForAnswer`, with the question's `id`, `text`, `change`, `file` and the command that answers it, so that the requirement is run again once its answer is reviewed.

#### Scenario: SCN-495a — The result names the question to answer

- GIVEN a fake agent that asks "Which currency?" for REQ-000
- WHEN `specgate harness run --format json` ends
- THEN REQ-000's result is `question` after one attempt, with `waitingForAnswer.id` Q1, its text, and `answer` naming `specgate answer Q1`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-495.feature kind=functional status=Implemented -->

### Requirement: REQ-496 — The run streams one JSON event per line

The system SHALL, with `specgate harness run --format jsonl`, write on stdout one JSON object per line and nothing else: `run-start` with the queue and the files `--allow-dirty` left out; every event the run and the agent's adapter write to `.harness/events/<REQ>.jsonl`, the question with its id among them; `agent-start` and `agent-end` around each agent step; `output` with the agent's output as it comes; `result` with each requirement's result; and last `run-end` with the document `--format json` prints. It SHALL keep the events files as they are, and SHALL document the event schema in `types/api.d.ts` and `docs/harness-control.md`, the harness guide for tools that drive it.

#### Scenario: SCN-496a — A run of one requirement, line by line

- GIVEN a fake agent that prints "working on it" and writes a usage event
- WHEN `specgate harness run --format jsonl` delivers REQ-000
- THEN every stdout line parses as JSON; the first is `run-start` and the last `run-end`, whose `report` has the shape `--format json` prints and the result of the `result` event; between them come `attempt`, `agent-start`, an `output` with "working on it" before `agent-end`, the `usage` event, `gate` events and a `result` for REQ-000

<!-- specgate:trace actor=Developer feature=features/harness/REQ-496.feature kind=functional status=Implemented -->

### Requirement: REQ-497 — A parallel run streams every requirement's events whole

The system SHALL, with `--format jsonl` and `--concurrency` above 1, stream on the run's own stdout the events of every requirement that runs in a worker, each line whole, and SHALL end with a single `run-end` for the whole run.

#### Scenario: SCN-497a — Two requirements at once

- GIVEN REQ-001 and REQ-002, independent, and a fake agent that prints a line longer than a pipe writes at once
- WHEN `specgate harness run --format jsonl --concurrency 2` delivers both
- THEN every stdout line parses as JSON, there are `output` and `result` events for both requirements, and exactly one `run-end`, the last line

<!-- specgate:trace actor=Developer feature=features/harness/REQ-497.feature kind=functional status=Implemented -->

### Requirement: REQ-502 — The harness report for one capability

The system SHALL accept `--capability <name>` on `specgate harness report` and then summarise only the recorded results of the requirements of that capability, naming it as `capability` in `report` of the JSON answer; and SHALL refuse a capability the project does not have with `capability_unknown`, exit 2, whose fix lists the capabilities it has.

#### Scenario: SCN-502a — Two runs over two capabilities

- GIVEN a project whose REQ-002 is in the capability `orders` and REQ-003 in `billing`, and a recorded run where REQ-002 passed and REQ-003 failed
- WHEN a tool runs `specgate harness report --json --capability orders`
- THEN `report.capability` is `orders`, one requirement was attempted and it passed

<!-- specgate:trace actor=Developer feature=features/harness/REQ-502.feature kind=functional status=Implemented -->

### Requirement: REQ-509 — The harness report gives the measured cost beside the estimate

The system SHALL record, for each agent step of an attempt whose stream reported its tokens, the profile and its input, output, cache-read and cache-write tokens in the run's ledger; and `specgate harness report --json` SHALL give `costByProfile`, one entry per profile that ran, with its attempts, its tokens, the `estimated` cost from `cost_per_run_hint`, the `measured` cost from its tokens and the prices per token the profile declares in `.harness/profiles.yaml` (`price_per_input_token`, `price_per_output_token`, and `price_per_cache_read_token` and `price_per_cache_write_token`, which default to the input price), and `basis`: `measured` when its cost could be measured, `estimated` when only the hint gives one, and null when neither; and `measuredCost` with the total, the attempts measured and those not measured, or null when none was.

#### Scenario: SCN-509a — One profile measured, one only estimated

- GIVEN `.harness/profiles.yaml` where `fast` declares `price_per_input_token: 0.000001` and `price_per_output_token: 0.000005` and `cheap` declares only `cost_per_run_hint: 0.2`, and a recorded run where `fast` used 1000 input and 200 output tokens and `cheap` ran once with no tokens recorded
- WHEN a tool runs `specgate harness report --json`
- THEN `fast` has `measured` 0.002 and `basis` `measured`, `cheap` has `estimated` 0.2, `measured` null and `basis` `estimated`, and `measuredCost.total` is 0.002

<!-- specgate:trace actor=Developer feature=features/harness/REQ-509.feature kind=functional status=Implemented -->

### Requirement: REQ-614 — The agent can run the project's test command

The system SHALL, when the agent command of `harness run` runs Claude Code in print mode with `--permission-mode acceptEdits` and names no tools of its own, add `--allowedTools` with one `Bash(<part>:*)` rule for each part of the test command, right after that flag, and say which parts it allowed; SHALL leave out a part that holds a quote, `$`, a pipe or a placeholder; SHALL leave a command that says `--allowedTools` or `--dangerously-skip-permissions` as written; and SHALL state in the prompt the parts of the test command to run, when a test command is known.

#### Scenario: SCN-614a — The documented command and a two-part test command

- GIVEN the agent `claude -p < {prompt_file}` and the test command `npm test && npm run build`
- WHEN the developer runs `specgate harness run`
- THEN the agent runs as `claude --permission-mode acceptEdits --allowedTools "Bash(npm test:*)" "Bash(npm run build:*)" -p < {prompt_file}`, and the run says `Claude Code may run the test command and no other`

#### Scenario: SCN-614b — Permissions the person chose

- GIVEN an agent command that says `--allowedTools Read Write`, one that says `--dangerously-skip-permissions`, one for another tool, and one with no test command known
- WHEN the test permission is worked out for each
- THEN each command is unchanged

#### Scenario: SCN-614c — A part a rule cannot carry

- GIVEN the test command `mvn -B test && sh -c "echo $HOME" ; npx cucumber-js --tags {req}`
- WHEN the test permission is worked out
- THEN only `mvn -B test` is allowed

#### Scenario: SCN-614d — The prompt names the command

- GIVEN a project whose test command is `mvn -B test`
- WHEN the developer runs `specgate harness run --dry-run`
- THEN the prompt says to run the tests with `mvn -B test` and to see the new test fail first

<!-- specgate:trace actor=Developer feature=features/harness/REQ-614.feature kind=functional status=Implemented -->

### Requirement: REQ-600 — Built in the brief's module order

The system SHALL, when `docs/brief.md` lists its modules, take requirements — in `status`, in `apply` with no requirement named, and in the harness's queue — module by module in the order the brief lists them, each module's requirements in the order the matrix lists them, a requirement outside every module keeping its side (before the modules when the matrix lists it before them, after them otherwise); SHALL lead the reason `status` gives for the next step with the requirement's module and its place in the brief; and SHALL, without a brief listing modules, keep the matrix's order.

#### Scenario: SCN-600a — Users before billing

- GIVEN a brief listing the modules users, then billing; billing declares REQ-002 and users REQ-022
- WHEN the person runs `specgate status`, then `specgate harness run --dry-run`
- THEN REQ-022 comes before REQ-002 in both, and status says "users, the brief's 1st module of 2"

<!-- specgate:trace actor=Developer feature=features/harness/REQ-600.feature kind=functional status=Implemented -->

### Requirement: REQ-583 — A run ended at once, and resumable

The system SHALL, on `specgate harness stop --now`, end the harness run working in the project together with every command it started, keep the requirement's worktree for `--resume`, and answer with `stop.now: true` and the run it ended; with no run working, it SHALL end nothing and say so.

#### Scenario: SCN-583a — Stop now while the agent works

- GIVEN a harness run whose agent ignores SIGTERM
- WHEN the person runs `specgate harness stop --now`
- THEN the agent is no longer running, the answer says `now: true`, and the worktree is kept

<!-- specgate:trace actor=Developer feature=features/harness/REQ-583.feature kind=functional status=Implemented -->

### Requirement: REQ-584 — A time limit per kind of command

The system SHALL read `timeouts:` in `harness.config.yaml` — `agent`, `setup`, `tests`, `review`, each in seconds — and run each kind of command under its own limit, under `--timeout` where none is set, refusing any other key.

#### Scenario: SCN-584a — An agent's hour and the tests' five minutes

- GIVEN `timeouts: { agent: 1800, tests: 300 }`
- WHEN the harness runs the agent, the tests and the setup
- THEN the agent may take 1800 s, the tests 300 s, and the setup the run's `--timeout`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-584.feature kind=functional status=Implemented -->

### Requirement: REQ-585 — The run's budget, a token ceiling, and no free sessions

The system SHALL stop starting requirements once the cost the run's sessions reported, its workers' included, reaches `max_run_cost_usd`, with `run_max_cost_reached`; SHALL stop a requirement's sessions once their tokens reach `max_tokens`; and SHALL, with `require_known_cost: true`, fail a requirement whose session reported no cost, with `cost_unknown`, instead of counting it as free.

#### Scenario: SCN-585a — The run's ceiling reached

- GIVEN `max_run_cost_usd: 5` and the run's sessions reporting $5.20
- WHEN the run is about to start another requirement
- THEN it starts none, naming `max_run_cost_usd` and what was reported

#### Scenario: SCN-585b — A session that reports no cost

- GIVEN `require_known_cost: true` and an agent that reports no usage
- WHEN the harness runs a requirement
- THEN the requirement fails with `cost_unknown`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-585.feature kind=functional status=Implemented -->

### Requirement: REQ-586 — An agent that cannot run now gives way

The system SHALL, when an agent session fails because the agent cannot run now (out of quota, rate-limited), go on with the first later attempt whose `attempt_profiles` rung names another profile, and stop retrying only when no such attempt remains.

#### Scenario: SCN-586a — Out of quota, with another agent configured

- GIVEN `attempt_profiles: [claude, codex]` and claude out of quota on attempt 1
- WHEN the harness meets the failure
- THEN attempt 2 runs with codex instead of the run stopping

<!-- specgate:trace actor=Developer feature=features/harness/REQ-586.feature kind=functional status=Implemented -->

### Requirement: REQ-587 — The project chooses the agent's environment

The system SHALL, with `agent_env: [NAME, …]`, give the agent, the reviewer and the adversary only the variables listed, those every process needs (search path, home and temp folders, locale, Windows' own) and the harness's own; and SHALL, without it, say which variables that look like secrets the agent inherits, by name only.

#### Scenario: SCN-587a — A cloud key the agent does not need

- GIVEN `agent_env: [ANTHROPIC_API_KEY]` and a shell holding `ANTHROPIC_API_KEY` and `AWS_SECRET_ACCESS_KEY`
- WHEN the harness runs the agent
- THEN the agent has `ANTHROPIC_API_KEY`, `PATH` and `SPECGATE_REQ`, and no `AWS_SECRET_ACCESS_KEY`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-587.feature kind=functional status=Implemented -->

### Requirement: REQ-588 — The agent in a container

The system SHALL, when `harness.config.yaml` sets `sandbox:` (an image, a network of `none` or `default`, an engine of `docker` or `podman`), run the agent, reviewer and adversary sessions in that container as the user running the harness, seeing only the requirement's worktree, its prompt file, the run's events folder and the dependency cache at their own paths, with no network unless `default` is set, and with only the variables `agent_env:` names and the harness's own.

#### Scenario: SCN-588a — An agent with no network and no credentials but its own

- GIVEN `sandbox: { image: ghcr.io/acme/agent:1 }` and `agent_env: [ANTHROPIC_API_KEY]`
- WHEN the harness runs the agent
- THEN the command runs in `ghcr.io/acme/agent:1` with `--network none`, the worktree as its working directory, and `-e ANTHROPIC_API_KEY` among the variables

#### Scenario: SCN-588b — A real container

- GIVEN Docker, an image holding the agent's CLI, `sandbox: { image: <it>, network: none }` and `agent_env: [ANTHROPIC_API_KEY]`
- WHEN the harness runs the agent with `ANTHROPIC_API_KEY` and `AWS_SECRET_ACCESS_KEY` in its environment
- THEN the agent reads its prompt, finds no network, has `ANTHROPIC_API_KEY` and `SPECGATE_REQ` but no `AWS_SECRET_ACCESS_KEY`, and writes in its worktree, at its own path, files owned by the person running the harness

<!-- specgate:trace actor=Developer feature=features/harness/REQ-588.feature kind=functional status=Implemented -->

### Requirement: REQ-589 — One download cache for every worktree

The system SHALL, with `dependency_cache: true`, point the download caches of npm, Yarn, pnpm, pip, uv, Go and NuGet at `.harness/cache/` of the project — made if absent and ignored by git — for each worktree's setup command and agent, leaving alone a variable the person already set and never sharing an installed dependency tree.

#### Scenario: SCN-589a — The second worktree reads from disk

- GIVEN `dependency_cache: true`
- WHEN a worktree's setup runs
- THEN `npm_config_cache` names `.harness/cache/npm` of the project, and git shows nothing new

<!-- specgate:trace actor=Developer feature=features/harness/REQ-589.feature kind=functional status=Implemented -->

### Requirement: REQ-590 — A run as an OpenTelemetry trace

The system SHALL, when `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is set, send each finished run to it as an OTLP/JSON trace — the run, each requirement, each attempt with the stage it failed at, and each agent session, with results, attempts, tokens and cost as attributes — honouring `OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_SERVICE_NAME`, and SHALL only warn when the collector cannot be reached.

#### Scenario: SCN-590a — A run in the team's tracing tool

- GIVEN `OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318`
- WHEN a harness run of REQ-000 ends
- THEN the collector receives `/v1/traces` with the spans `harness run` and `REQ-000`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-590.feature kind=functional status=Implemented -->

### Requirement: REQ-591 — A pause between attempts

The system SHALL, with `harness run --pause-between-attempts`, wait after a failed attempt and before the next one, saying so and writing where it paused, until `specgate harness continue` lets the next attempt start or `specgate harness continue --stop` (or a stop request) ends the requirement without it; `harness continue` with no paused run SHALL say so with `harness_not_paused`.

#### Scenario: SCN-591a — Stopped at the pause

- GIVEN a run with `--pause-between-attempts` and `--max-attempts 3` whose first attempt fails
- WHEN the person runs `specgate harness continue --stop`
- THEN the requirement ends failed after one attempt

<!-- specgate:trace actor=Developer feature=features/harness/REQ-591.feature kind=functional status=Implemented -->

### Requirement: REQ-578 — One run holds a working copy, and a dead run does not keep it

The system SHALL let only one harness run take a project's working copy, creating its lock only when none exists, SHALL take over a lock whose run is no longer alive, and SHALL hold the worktree lock in the repository's common git directory, also when the project is itself a worktree or a submodule, without waiting on a lock it cannot make.

#### Scenario: SCN-578a — A second run while the first holds the lock

- GIVEN a run holding the project's lock
- WHEN a second run asks for it, and later a run asks for a lock whose process has ended
- THEN the second run is refused, and the later run takes the dead run's lock

#### Scenario: SCN-578b — A project that is itself a worktree

- GIVEN a project whose `.git` is a file naming its repository
- WHEN the harness takes the worktree lock
- THEN it takes it at once, in the repository's git directory

<!-- specgate:trace actor=Developer feature=features/harness/REQ-578.feature kind=functional status=Implemented -->

### Requirement: REQ-579 — A run leaves nothing half-done behind

The system SHALL write the run record whole or not at all, SHALL create each prompt file readable by its owner only and remove it even when a step fails unexpectedly, SHALL delete the `harness/base/*` branches a run made once the run ends, and SHALL fail a requirement whose existing branch cannot be deleted to recreate it, with git's reason.

#### Scenario: SCN-579a — Throwaway bases after the run

- GIVEN a project with `harness/base/REQ-004` and `harness/REQ-004` branches
- WHEN a run ends
- THEN `harness/base/REQ-004` is gone and `harness/REQ-004` stays

<!-- specgate:trace actor=Developer feature=features/harness/REQ-579.feature kind=functional status=Implemented -->

### Requirement: REQ-580 — A value put in a command is one argument

The system SHALL put each value it substitutes into a gate command (`{req}`, `{scenario}`, `{feature_file}`) or into `pr_cmd` (`{branch}`, `{req}`) as one shell argument, leaving a value of letters, digits and `_./:@=,+-` as it is.

#### Scenario: SCN-580a — A feature path with a space

- GIVEN a requirement whose feature file is `features/the shop/REQ-007.feature`
- WHEN the test command `npx cucumber-js {feature_file}` is resolved
- THEN the path is one argument, and `{req}` alone is left as `REQ-007`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-580.feature kind=functional status=Implemented -->

### Requirement: REQ-581 — No pass that was not said, and a timeout said as one

The system SHALL count a `builtin:review` check whose reviewer gave no `VERDICT:` line as failed, and SHALL report a test command ended at the deadline as timed out, with the time.

#### Scenario: SCN-581a — A reviewer that answers without a verdict

- GIVEN a gating review check whose reviewer prints no `VERDICT:` line
- WHEN the harness delivers a requirement
- THEN the requirement fails and the report says the reviewer gave no verdict

<!-- specgate:trace actor=Developer feature=features/harness/REQ-581.feature kind=functional status=Implemented -->

### Requirement: REQ-582 — Secrets stay out of what the run writes

The system SHALL replace with `***`, in the run record, in the prompt archive committed with each branch, in the gate's stage names and in the dry run, every token-like value and every value of an environment variable whose name says it holds a secret.

#### Scenario: SCN-582a — A gate output with a key in it

- GIVEN a run whose environment holds `MY_API_KEY` and whose output quotes it, a URL with a password and a GitHub token
- WHEN the run writes its record
- THEN none of the three appears in it; `***` does

<!-- specgate:trace actor=Developer feature=features/harness/REQ-582.feature kind=functional status=Implemented -->

### Requirement: REQ-643 — A repository with no commit is refused before any agent runs

The system SHALL refuse `harness run`, before any agent runs and in every format, when the base it cuts worktrees from names no commit — `harness_no_commit` when the repository has no commit yet, saying to make the first one with the command that does it; `harness_no_base` when `--base-branch` names none — instead of git's "invalid reference: HEAD" in each requirement's result.

> Found from the studio: Build on pintamundo-ai, a project created but never committed, failed every requirement with `git worktree add failed: fatal: invalid reference: HEAD`.

#### Scenario: SCN-643a — No commit yet

- GIVEN a scaffolded project in a git repository with no commit
- WHEN the Developer runs `specgate harness run --req REQ-000 --allow-dirty --format jsonl`
- THEN the run ends with harness_no_commit, its message saying the repository has no commit yet and `git add -A && git commit`, and no "invalid reference"

<!-- specgate:trace actor=Developer feature=features/harness/REQ-643.feature kind=functional status=Implemented -->

### Requirement: REQ-573 — An interrupted run ends what it started and keeps its work

The system SHALL, when a harness run is interrupted — a signal to it or to the command it is running, or the run's process ending — end every command the run started, including those in a process group of their own, keep the requirement's worktree for `--resume`, and exit with status 130 and the finding `harness_run_error`.

#### Scenario: SCN-573a — Ctrl-C while the agent works

- GIVEN a harness run whose agent ignores SIGINT and SIGTERM
- WHEN the person presses Ctrl-C
- THEN the agent is no longer running and the requirement's worktree is still registered

#### Scenario: SCN-573b — The run killed outright

- GIVEN a harness run whose agent ignores SIGTERM
- WHEN the run's process is killed with SIGKILL
- THEN the agent is no longer running within seconds

<!-- specgate:trace actor=Developer feature=features/harness/REQ-573.feature kind=functional status=Implemented -->

### Requirement: REQ-574 — A chain undoes a merge to where the branch stood

The system SHALL, in `harness run --chain`, check that the merge commit and any amendment of it were recorded, and SHALL, when either fails or the gate fails after the merge, put the branch back to the commit it pointed at before the merge, leaving no change staged.

#### Scenario: SCN-574a — A merge commit the repository refuses

- GIVEN a chain run on a branch whose last commit is the person's, and a commit-msg hook that refuses the chain's merge commit
- WHEN the first requirement passes and is merged
- THEN the requirement fails naming the refused merge commit, and the branch points at the person's commit with its own tree and nothing staged

<!-- specgate:trace actor=Developer feature=features/harness/REQ-574.feature kind=functional status=Implemented -->

### Requirement: REQ-575 — Every command the harness runs ends at its deadline

The system SHALL run the architecture and test commands, the reviewer and adversary agents and the adversary's tests, the setup command and the PR command under the run's `--timeout`, ending each one and every process it started when the time is up.

#### Scenario: SCN-575a — A test command that hangs

- GIVEN a harness run with `--timeout 4` whose test command ignores SIGTERM and never ends
- WHEN the gate runs the test command
- THEN the run ends within the deadline's margin and the test command is no longer running

<!-- specgate:trace actor=Developer feature=features/harness/REQ-575.feature kind=functional status=Implemented -->

### Requirement: REQ-576 — A worker runs with every option of its run

The system SHALL give each worker of a run with `--concurrency` above 1 the options `--resume`, `--skip-not-ready`, `--strict-artifacts`, `--verbose`, `--push` and `--remote` the run was given, and SHALL pass the agent, test and PR commands in the worker's environment rather than on its command line, removing them from that environment once read.

#### Scenario: SCN-576a — Four requirements at once, resumed

- GIVEN a run with `--concurrency 4 --resume --push` and an agent command that holds a key
- WHEN each worker starts
- THEN each worker's arguments include `--resume` and `--push` and none of them holds the agent's command

<!-- specgate:trace actor=Developer feature=features/harness/REQ-576.feature kind=functional status=Implemented -->

### Requirement: REQ-577 — The agent does not choose the command that checks it

The system SHALL resolve the profile of a quality check (`builtin:review`, `builtin:adversary`) from the project the run belongs to, never from the requirement's worktree, where the agent writes.

#### Scenario: SCN-577a — A profiles file written by the agent

- GIVEN a requirement's worktree where the agent wrote `.harness/profiles.yaml`
- WHEN a review check's profile is resolved
- THEN it is read from the project's folder, not from the worktree

<!-- specgate:trace actor=Developer feature=features/harness/REQ-577.feature kind=functional status=Implemented -->

### Requirement: REQ-593 — A reused process number does not keep a lock

The system SHALL treat a run's lock, and the worktree lock, as held only while the process they name is alive and started no later than the lock was written, so that a process the system later gave the same number to does not keep the project locked; where the system does not say when a process started, the process number alone SHALL decide.

#### Scenario: SCN-593a — The number of a crashed run, taken by another program

- GIVEN a run lock written an hour ago naming a process number that a program started a moment ago now holds
- WHEN a new run asks for the lock
- THEN it takes it, and the lock it writes names its own process

<!-- specgate:trace actor=Developer feature=features/harness/REQ-593.feature kind=functional status=Implemented -->

### Requirement: REQ-592 — Nothing a command started outlives it

The system SHALL, whenever a command the harness runs ends — on its own, at its deadline, or by a signal to it, to its shell or to the run — end every process left in that command's process group before the harness goes on.

#### Scenario: SCN-592a — The shell ended by a signal

- GIVEN the harness running an agent that ignores SIGTERM, through a shell
- WHEN the shell is ended by SIGTERM
- THEN the agent is no longer running when the harness goes on

<!-- specgate:trace actor=Developer feature=features/harness/REQ-592.feature kind=functional status=Implemented -->

### Requirement: REQ-649 — A requirement no test proved ends unverified, never passed

The system SHALL warn, before any agent runs, when the project has no test command — the gate cannot run the tests and each requirement ends unverified — and SHALL end a requirement whose gate passed with no test command as `unverified`, not `pass`: after one attempt, its work committed on its branch as "attempt is UNVERIFIED — do not merge as is", not delivered, counted apart in the report, the run not passing, its dependants not built and `--chain` stopping, with the error saying to set the test command.

> Found on pintamundo-ai: REQ-001 ended `pass` with its test never run — the project had no test command, and the agent could run none.

#### Scenario: SCN-649a — No test command

- GIVEN a scaffolded project with no test command and an agent that writes REQ-000's code
- WHEN the Developer runs `specgate harness run --req REQ-000 --max-attempts 3 --format json`
- THEN the run warns "No test command", REQ-000 ends unverified after one attempt, its branch's last commit says it is UNVERIFIED, the matrix does not say it is implemented, and the run does not pass

<!-- specgate:trace actor=Developer feature=features/harness/REQ-649.feature kind=functional status=Implemented -->

### Requirement: REQ-650 — The agent runs without the person's MCP servers, and may run the gate's checks

The system SHALL run Claude Code in print mode — drafting, building, answering in `agent ask` — with `--strict-mcp-config`, loading none of the person's MCP servers, unless the command names its own MCP configuration; and SHALL allow the building agent the architecture check the gate runs, besides its test command, and no other command.

> On pintamundo-ai each call loaded 345 tools of the person's account; a question in the studio took minutes.

#### Scenario: SCN-650a — No MCP server

- GIVEN the harness's agent, a drafting agent and one with its own permission
- WHEN Specgate runs them
- THEN each carries `--strict-mcp-config` once, and one naming `--mcp-config` is kept as it is

#### Scenario: SCN-650b — The gate's checks allowed

- GIVEN the test command `npm test` and the architecture check `npm run arch`
- WHEN the harness gives the agent its permissions
- THEN it may run both, and no other command

<!-- specgate:trace actor=Developer feature=features/harness/REQ-650.feature kind=functional status=Implemented -->

### Requirement: REQ-692 — The agent reads the principles

The system SHALL, when `docs/specs/principles.md` exists, put each principle's id, title and statement into the harness prompt under a "Principles" heading, so that the agent knows them before it writes code.

> Found on 2026-11-23: P1 was checked only by `specgate check`; the agent complied by imitating existing code.

#### Scenario: SCN-692a — P1 in the prompt

- GIVEN principles.md with `## P1 — Code names its requirement`
- WHEN the Developer runs `specgate harness run --req REQ-004 --dry-run`
- THEN the prompt has a "Principles" section naming P1 and its statement

<!-- specgate:trace actor=Developer feature=features/harness/REQ-692.feature kind=functional status=Implemented -->

### Requirement: REQ-693 — The harness gate runs the principles

The system SHALL, in the harness gate after the test command, run each principle that declares `run=` in the worktree as the stage `principles`, failing the attempt on an error-level principle that exits non-zero — naming its id and command, which the next attempt is told — and reporting a warn-level one without failing.

#### Scenario: SCN-693a — Code without its requirement's id

- GIVEN P1 `run="! grep -L 'REQ-[0-9]' src/*.js | grep ."` and an agent that writes `src/x.js` without a requirement id
- WHEN the harness gates the attempt
- THEN the attempt fails at the stage `principles` naming P1

<!-- specgate:trace actor=Developer feature=features/harness/REQ-693.feature kind=functional status=Implemented -->

### Requirement: REQ-695 — A dry run shows the trust skip

The system SHALL, on `specgate harness run --dry-run`, print for each requirement the trust level would refuse `skipped (trust_level)` and the reason, instead of its prompt.

#### Scenario: SCN-695a — ausleihe at level 2, without --req

- GIVEN `trust: { ausleihe: 2 }` and REQ-006 of ausleihe pending
- WHEN the Developer runs `specgate harness run --dry-run`
- THEN REQ-006 shows `skipped (trust_level)` with "needs 3", and no prompt for it

<!-- specgate:trace actor=Developer feature=features/harness/REQ-695.feature kind=functional status=Implemented -->

### Requirement: REQ-688 — A module has its own agent

The system SHALL match a profile rule of `.harness/profiles.yaml` that says `match: { module: <name> }` against the capability of the requirement being built, as it matches the other keys — first match wins —, so that the harness hands that module's requirements to that profile's agent.

> "I could choose per module or per requirement which one I want to use" (2026-11-23).

#### Scenario: SCN-688a — ausleihe with its own agent

- GIVEN profiles `careful` with `match: { module: ausleihe }` and `cheap` with `match: { module: "*" }`, and REQ-006 of ausleihe and REQ-004 of katalog pending
- WHEN the harness builds them
- THEN REQ-006 is built by careful's agent and REQ-004 by cheap's

<!-- specgate:trace actor=Developer feature=features/harness/REQ-688.feature kind=functional status=Implemented -->

### Requirement: REQ-689 — The agent that drafts, set apart

The system SHALL read `draft_profile` in harness.config.yaml as the profile whose agent drafts, and SHALL run it on `specgate draft <module>` and `specgate propose --from-brief <module>` when neither `--agent` nor `--profile` is given; and SHALL keep writing the drafting guide for the Developer's own agent, running none, with `--no-agent` or when no `draft_profile` is set.

#### Scenario: SCN-689a — Drafted by its own agent

- GIVEN `draft_profile: writer` and the profile writer whose agent writes the module's delta
- WHEN the Developer runs `specgate draft pedidos`
- THEN writer's agent ran with the drafting guide, and not the harness's agent

<!-- specgate:trace actor=Developer feature=features/harness/REQ-689.feature kind=functional status=Implemented -->

### Requirement: REQ-690 — Every agent checked before it is used

The system SHALL, on `specgate harness doctor [--json] [--no-probe]`, list each pending requirement with its module and the profile and agent it gets; and SHALL check each distinct agent once — the drafting one too —: its program on the PATH, and, unless `--no-probe`, a probe that runs it on a prompt saying `Reply with exactly: OK`, passing when it exits 0 within 120 seconds and its output says OK; each failure with the last line the agent printed and a fix; exiting 1 when one fails.

#### Scenario: SCN-690a — One agent answers, one has an expired key

- GIVEN the default agent answers OK, and careful's agent prints "This API key has expired" and exits 1
- WHEN the Developer runs `specgate harness doctor --json`
- THEN the default agent passes, careful's fails with "This API key has expired", the requirements of ausleihe name careful, and the doctor exits 1

#### Scenario: SCN-690b — Not installed

- GIVEN a profile whose agent is `nosuchagent -p {prompt_file}`
- WHEN the Developer runs `specgate harness doctor --no-probe --json`
- THEN that agent fails as not installed, `nosuchagent` named, and no agent was run

<!-- specgate:trace actor=Developer feature=features/harness/REQ-690.feature kind=functional status=Implemented -->

### Requirement: REQ-691 — A run checks its agents before it starts

The system SHALL, on `specgate harness run`, before any worktree, run the doctor for the agents of the requirements it will process, and refuse to start with `harness_agent_unavailable` — naming the requirements, the agent and why — when one fails; and SHALL start anyway with `--skip-doctor`.

#### Scenario: SCN-691a — The agent of ausleihe does not answer

- GIVEN careful's agent prints "Free usage limit reached" and exits 1, and REQ-006 of ausleihe pending
- WHEN the Developer runs `specgate harness run`
- THEN the harness refuses with `harness_agent_unavailable` naming REQ-006 and "Free usage limit reached", and no worktree was created

<!-- specgate:trace actor=Developer feature=features/harness/REQ-691.feature kind=functional status=Implemented -->

### Requirement: REQ-698 — The agent in its module's sandbox

The system SHALL, when harness.config.yaml sets `sandbox:` with `engine: sbx`, run each agent session of a requirement inside the Docker sandbox of its change and module, `sg-<change>-<module>`: made by the first requirement of that module with the sandbox's `kit` and the harness's worktrees as its workspace, its `setup` command run once, and recorded in `.harness/sandboxes.json`; later requirements of the module reuse it; the gate runs on the host.

> Found on 2026-11-23: three sandboxes, clones and installs done by hand for one run.

#### Scenario: SCN-698a — Two requirements of ausleihe, one sandbox

- GIVEN `sandbox: { engine: sbx, kit: opencode, setup: "install-node" }`, and REQ-006 and REQ-007 of ausleihe in change draft-ausleihe pending
- WHEN the Developer runs `specgate harness run --req REQ-006 --req REQ-007`
- THEN one sandbox `sg-draft-ausleihe-ausleihe` was created, `install-node` ran in it once, both agents ran in it in their worktrees, and `.harness/sandboxes.json` records it

<!-- specgate:trace actor=Developer feature=features/harness/REQ-698.feature kind=functional status=Implemented -->

### Requirement: REQ-699 — The hosts each sandbox may reach

The system SHALL open each host of `sandbox.allow` for that sandbox alone, record the rules it added, read the sandbox's whole network policy after creating it and record the hosts its kit added apart; and SHALL say, when the run starts a sandbox, how many hosts it may reach — the Developer's and the kit's.

#### Scenario: SCN-699a — Two hosts opened, twenty-nine from the kit

- GIVEN `allow: [registry.npmjs.org, opencode.ai]`, and a kit whose policy allows 29 hosts
- WHEN the harness creates the sandbox for ausleihe
- THEN registry.npmjs.org and opencode.ai are allowed for that sandbox alone, the record names those 2 and the kit's 29, and the run says "sg-draft-ausleihe-ausleihe may reach 31 hosts: 2 yours, 29 from the kit opencode"

<!-- specgate:trace actor=Developer feature=features/harness/REQ-699.feature kind=functional status=Implemented -->

### Requirement: REQ-700 — Archive removes the change's sandboxes

The system SHALL, on `specgate archive <change>`, remove each sandbox recorded for that change together with the network rules the harness added for it, and drop its record.

#### Scenario: SCN-700a — draft-ausleihe archived

- GIVEN `sg-draft-ausleihe-ausleihe` recorded for draft-ausleihe with 2 rules, and `sg-draft-katalog-katalog` for draft-katalog
- WHEN the Developer runs `specgate archive draft-ausleihe`
- THEN `sg-draft-ausleihe-ausleihe` and its 2 rules are removed, and `sg-draft-katalog-katalog` stays recorded

<!-- specgate:trace actor=Developer feature=features/harness/REQ-700.feature kind=functional status=Implemented -->

### Requirement: REQ-701 — No sandbox left behind unseen

The system SHALL, on `specgate harness sandboxes [--json]`, list each recorded sandbox — its change, module, creation date, the hosts allowed and the kit's, and whether it still exists — and each sbx sandbox named `sg-…` that nobody recorded; and SHALL, with `--prune`, remove those whose change is archived or gone and the unrecorded `sg-…` ones, with their rules.

#### Scenario: SCN-701a — One left behind, one stray

- GIVEN `sg-old-pagos` recorded for a change already archived, `sg-stray` existing and unrecorded, and `sg-draft-katalog-katalog` of an open change
- WHEN the Developer runs `specgate harness sandboxes --prune`
- THEN `sg-old-pagos` and `sg-stray` are removed, and `sg-draft-katalog-katalog` stays

<!-- specgate:trace actor=Developer feature=features/harness/REQ-701.feature kind=functional status=Implemented -->
