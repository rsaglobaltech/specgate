# Delta — workspace

## ADDED Requirements

### Requirement: REQ-360 — An agent proposes the stories of the brief

The system SHALL, on `specgate workspace draft --agent "<cmd>"` while the workspace brief names no story, let the agent fill the front matter's `stories:` (each with its id, title and repositories, uncertain ones under a `# check:` comment), allowing it to write only `docs/brief.md` and putting back the client's text below the front matter if the agent changed it; and SHALL refuse `--agent` without a story id once stories are named, naming the command that drafts one.

#### Scenario: SCN-360a — The agent names follow-shipment

- GIVEN a workspace whose brief names no story, and an agent that writes a `stories:` entry and also edits the brief's text
- WHEN the developer runs `specgate workspace draft --agent "<cmd>"`
- THEN the front matter names follow-shipment with its repositories, the client's text is as before, and a second `workspace draft --agent` without a story id is refused

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-361 — Each criterion names the repositories that answer it

The system SHALL read, in a story's `## Repositories` section, the criteria each repository answers (`` - `fleet`: AC-1, AC-2 ``), ask the agent drafting a story to write them, and write in each sub-change's `discover.md`, on `workspace propose`, a section naming the criteria that repository answers and those the others answer.

#### Scenario: SCN-361a — fleet answers AC-1, tracking AC-2

- GIVEN follow-shipment whose `story.md` maps AC-1 to fleet and AC-2 to tracking
- WHEN the developer runs `specgate workspace propose follow-shipment`
- THEN fleet's Discover says it answers AC-1 and tracking answers AC-2, and tracking's says the reverse

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-362 — A criterion unanswered, or claimed twice, is reported

The system SHALL warn, on `workspace check`, when a story that maps its criteria to repositories leaves one criterion to no repository (`workspace_criterion_unanswered`) or gives one to two (`workspace_criterion_shared`).

#### Scenario: SCN-362a — AC-3 is nobody's, AC-1 is twice

- GIVEN follow-shipment with AC-1..AC-3, mapping AC-1 to fleet and tracking and AC-2 to tracking
- WHEN the developer runs `specgate workspace check --json`
- THEN it warns that AC-3 is answered by no repository and that AC-1 is claimed by fleet and tracking

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-363 — A story's questions wait for their answers

The system SHALL keep a story's questions for the client in `docs/stories/<id>/questions.md`, in a draft's format, ask the agent drafting the story to write them there, and refuse `workspace propose` while one is open (`workspace_story_questions_open`, naming them) unless `--allow-open-questions` is given.

#### Scenario: SCN-363a — Q1 is open

- GIVEN follow-shipment whose `questions.md` has Q1 with no answer
- WHEN the developer runs `specgate workspace propose follow-shipment`, then answers Q1 and runs it again
- THEN the first is refused naming Q1, and the second opens the story's changes

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-364 — A drafted story keeps none of its form's hints

The system SHALL remove, once the agent has written a story, the template's `<!-- … -->` hint of every section that holds text.

#### Scenario: SCN-364a — The agent fills Intent and criteria

- GIVEN a story scaffolded with its hints, and an agent that writes the Intent and AC-1 below them
- WHEN the developer runs `specgate workspace draft follow-shipment --agent "<cmd>"`
- THEN `story.md` holds the agent's text and no `<!--` line under Intent or Acceptance criteria

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-365 — The business layer Specgate writes reads as business

The system SHALL write, on `workspace propose`, nothing in a sub-change's `discover.md` that `layer_discover_technical` reports: the guidance on `depends=` and `api=` goes in the sub-change's `design.md`.

#### Scenario: SCN-365a — follow-shipment proposed with a contracts repository

- GIVEN a workspace with fleet, tracking and a contracts repository, and follow-shipment drafted
- WHEN the developer proposes it and runs `specgate change validate follow-shipment --json` in fleet
- THEN no `layer_discover_technical` is reported, and fleet's `design.md` says how to write `depends=` and `api=`

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-366 — Whoever writes a part of a story hears of the others

The system SHALL record, on `workspace propose`, in each sub-change where its workspace is (`story.json`), and SHALL include, in the prompt `change author` gives for any artefact of that change, the story's other repositories, their requirements with their status, and how to name what this part waits for (`depends=<repo>:REQ-NNN`, an `api=` operation of the contracts repository).

#### Scenario: SCN-366a — tracking's delta is written after fleet's

- GIVEN follow-shipment split across fleet and tracking, fleet's part adding REQ-003
- WHEN the developer runs `specgate change author follow-shipment --artifact specs --dry-run` in tracking
- THEN the prompt names fleet:REQ-003 and `depends=`

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-367 — A requirement waits for what it depends on

The system SHALL start, on `workspace harness run --story`, at each level only the requirements whose every `depends=` is delivered, print the others as waiting on the requirements they name, and exit non-zero when a requirement was left waiting or a repository's run failed.

#### Scenario: SCN-367a — tracking's REQ-005 waits on fleet's REQ-003, which fails

- GIVEN follow-shipment where tracking's REQ-005 depends on fleet's REQ-003 and tracking's REQ-006 depends on nothing, and fleet's harness does not deliver REQ-003
- WHEN the developer runs `specgate workspace harness run --story follow-shipment`
- THEN tracking's harness is started for REQ-006 only, REQ-005 is reported waiting on fleet:REQ-003, and the run exits 1

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

## MODIFIED Requirements

### Requirement: REQ-344 — The story's other repositories, named to each

The system SHALL write in each sub-change's `discover.md` the story's other repositories and the contracts repository, by name and role, and in its `design.md` how a requirement names what it needs from them (`depends=<repo>:REQ-NNN`, and an `api=` operation of the contracts repository); and SHALL, on `workspace harness run`, hand each repository's harness the other repositories' requirements of the story, which the implementing prompt includes.

#### Scenario: SCN-344a — Tracking is told of fleet

- GIVEN follow-shipment split across fleet and tracking, fleet's part adding REQ-003
- WHEN the developer proposes it and runs `specgate workspace harness run --story follow-shipment --dry-run --json`, then `specgate harness prompt REQ-005` in tracking with that context
- THEN tracking's `discover.md` names fleet, its `design.md` says `depends=fleet:REQ-NNN`, its run's context names fleet:REQ-003, and the prompt includes it

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-344.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->
