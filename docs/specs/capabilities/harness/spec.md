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
