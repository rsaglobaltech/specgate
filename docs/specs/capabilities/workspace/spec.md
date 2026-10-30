# Workspace

## Purpose

The repositories of one product, named in one file: where the product stands,
one gate across them, the requirements of one that wait for another's, and a
business story split into a change in each (ADR-0041).

## Requirements

### Requirement: REQ-290 — The workspace names its repositories

The system SHALL read the repositories of a product from `specgate.workspace.yaml` in a workspace repository — for each, a name, a path, an optional git URL, a role (service, web, library or contracts) and its capabilities — refusing a file with a repository named twice, without a path or with another role; and `specgate workspace init` SHALL write it from `--repo <name>=<path>[:<role>]`, or, without one, from every sibling folder that holds a Specgate project.

#### Scenario: SCN-290a — Init names the sibling projects

- GIVEN the folders fleet and contracts, each a Specgate project, beside an empty folder ws
- WHEN the developer runs `specgate workspace init --name truck-flote` in ws
- THEN specgate.workspace.yaml names contracts at ../contracts with the role contracts and fleet at ../fleet with the role service

#### Scenario: SCN-290b — A repo with an unknown role is refused

- GIVEN a specgate.workspace.yaml whose repo fleet has the role backend
- WHEN the workspace is read
- THEN it is refused with "fleet has the role backend: a role is service, web, library, contracts"

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-290.feature kind=functional status=Implemented test=tests/unit/workspace.test.ts -->

### Requirement: REQ-291 — Where each repository stands

The system SHALL show, with `specgate workspace status`, each repository of the workspace: its role, whether its folder exists, its branch, its requirements done of its total as its own `status` counts them, and its gate as the last `workspace check` left it — passed, failed or not run.

#### Scenario: SCN-291a — Status shows each repository

- GIVEN a workspace with fleet on its branch main and web, and no check run yet
- WHEN the developer runs `specgate workspace status --json`
- THEN fleet is a service on main with 1 requirement and its gate not run

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-291.feature kind=functional status=Implemented test=tests/unit/workspace.test.ts -->

### Requirement: REQ-292 — One check across the repositories

The system SHALL run, with `specgate workspace check`, each repository's own `specgate check`, report which pass, record the result for `workspace status`, and exit non-zero when any repository fails.

#### Scenario: SCN-292a — One repository's gate fails the workspace

- GIVEN a workspace whose repositories fleet and tracking both pass, then tracking's test command exits 3
- WHEN the developer runs `specgate workspace check`
- THEN it exits 1, and `workspace status` shows fleet passed and tracking failed

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-292.feature kind=functional status=Implemented test=tests/unit/workspace.test.ts -->

### Requirement: REQ-293 — A qualified id names a requirement that exists

The system SHALL fail `workspace check` when a repository's specification or a workspace story names `<repo>:REQ-NNN` and the repository is not in the workspace, or does not have that requirement.

#### Scenario: SCN-293a — A qualified id that names nothing

- GIVEN fleet's spec.md names contracts:REQ-000, contracts:REQ-099 and billing:REQ-001, and contracts has only REQ-000
- WHEN the developer runs `specgate workspace check`
- THEN it fails on contracts:REQ-099, which contracts does not have, and on billing:REQ-001, since billing is not a repo of the workspace, and not on contracts:REQ-000

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-293.feature kind=functional status=Implemented test=tests/unit/workspace.test.ts -->

### Requirement: REQ-294 — A repository leaves another's requirement to the workspace

The system SHALL, inside a repository, accept `depends=<repo>:REQ-NNN` on a requirement as a dependency on another repository of its workspace — neither an unknown dependency nor an edge of the repository's own graph — so its own validation does not fail on it.

#### Scenario: SCN-294a — A repository leaves another's id to the workspace

- GIVEN REQ-002 declares depends=contracts:REQ-003 and depends=REQ-001
- WHEN the repository's dependency graph is built
- THEN REQ-002 depends on REQ-001, nothing is unknown, and contracts:REQ-003 is left to the workspace

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-294.feature kind=functional status=Implemented test=tests/unit/workspace.test.ts -->

### Requirement: REQ-295 — A requirement waits for the one it depends on in another repository

The system SHALL fail `workspace check` when a requirement depends on another repository's requirement that is not delivered (Implemented, Verified or Released), naming both and the status it has, and pass once it is.

#### Scenario: SCN-295a — A dependency on another repository not delivered yet

- GIVEN tracking's REQ-005 depends on contracts:REQ-000, which is Draft
- WHEN the developer runs `specgate workspace check`
- THEN it fails with "tracking:REQ-005 depends on contracts:REQ-000, which is Draft", and no longer once contracts:REQ-000 is Implemented

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-295.feature kind=functional status=Implemented test=tests/unit/workspace.test.ts -->

### Requirement: REQ-296 — A business story split across repositories

The system SHALL, with `specgate workspace propose <story> --repos <a,b,…>`, open a change named after the story in each repository listed, each linked back to the story, and record the story and its sub-changes in the workspace repository under `docs/stories/<story>/`; refusing a story that exists or a change already open under that name.

#### Scenario: SCN-296a — A story split across three repositories

- GIVEN a workspace truck-flote with fleet, tracking and web
- WHEN the developer runs `specgate workspace propose follow-shipment --repos fleet,tracking,web`
- THEN each of the three has the change follow-shipment, whose proposal says it is part of the workspace story truck-flote:follow-shipment, the story lists its three sub-changes, and proposing it again is refused

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-296.feature kind=functional status=Implemented test=tests/unit/workspace.test.ts -->

### Requirement: REQ-297 — A story is done when every repository delivered its part

The system SHALL show a workspace story as done only when every one of its sub-changes is archived in its repository, and each sub-change as open, archived or missing.

#### Scenario: SCN-297a — The story is done when every repository archived its part

- GIVEN the story follow-shipment across fleet and web
- WHEN fleet archives its change, and then web archives its own
- THEN the story is not done with fleet archived and web open, and done once both are archived

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-297.feature kind=functional status=Implemented test=tests/unit/workspace.test.ts -->

### Requirement: REQ-298 — The workspace as a model other views read

The system SHALL give `specgate workspace status --json` a stable model — `schemaVersion`, `name`, `dir`, `repos` (each with `name`, `role`, `path`, `url`, `exists`, `branch`, `requirements` and `gate`) and `stories` — and, without a workspace file, the null shape with the fix.

#### Scenario: SCN-298a — The model other views read

- GIVEN a workspace with the repository fleet
- WHEN the developer runs `specgate workspace status --json`, and then in a folder with no workspace file
- THEN the model has exactly those keys, and without the file `workspace` is null with workspace_missing

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-298.feature kind=functional status=Implemented test=tests/unit/workspace.test.ts -->

### Requirement: REQ-320 — Each repository's harness, seen from the workspace

The system SHALL show, in the workspace's live model, one panel per repository of the workspace: its harness queue, the requirement in flight — the most recently updated one still running — with its attempt, the gate step running and since when, where it runs, and its agent's last step; and no requirement in flight for a repository whose harness is idle.

#### Scenario: SCN-320a — Tracking is on a quality check, fleet is idle

- GIVEN a workspace of fleet and tracking, and tracking's harness on REQ-005 with the gate step "quality: semgrep" started in Docker after its agent edited TrackingController.java
- WHEN the developer runs `specgate workspace live --json`
- THEN tracking's panel shows REQ-005 in flight on "quality: semgrep" in docker with the agent's last step an edit of TrackingController.java, and fleet's panel shows nothing in flight

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-320.feature kind=functional status=Implemented test=tests/unit/workspace-live.test.ts -->

### Requirement: REQ-321 — A story's parts, building and blocked

The system SHALL show, for each story of the workspace, its sub-change in every repository as open, building — a requirement of its delta has harness events — archived or missing, and SHALL name, for a sub-change, each `repo:REQ-NNN` that a requirement of its delta depends on and that is not delivered in that repository.

#### Scenario: SCN-321a — Tracking builds, and waits on fleet

- GIVEN the story follow-shipment across fleet and tracking, whose tracking delta adds REQ-005 with `depends=fleet:REQ-000`, fleet's REQ-000 still Draft, and harness events for REQ-005
- WHEN the developer runs `specgate workspace live --json`
- THEN follow-shipment's tracking part is building and blocked by fleet:REQ-000, and its fleet part is open

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-321.feature kind=functional status=Implemented test=tests/unit/workspace-live.test.ts -->

### Requirement: REQ-322 — What each repository and each story has cost

The system SHALL show, per repository, the money its agents reported and the minutes its harness ledger recorded, and per story the same sums over the requirements of its sub-changes.

#### Scenario: SCN-322a — Tracking's REQ-005 cost 0.42 and 2 minutes

- GIVEN tracking's harness ledger records REQ-005 for 120000 ms and its events report a cost of 0.42
- WHEN the developer runs `specgate workspace live --json`
- THEN tracking's cost is 0.42 and 2 minutes, and the story follow-shipment's cost is 0.42 and 2 minutes

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-322.feature kind=functional status=Implemented test=tests/unit/workspace-live.test.ts -->

### Requirement: REQ-323 — The workspace's live view

The system SHALL serve, when `specgate studio` runs in a workspace repository, the workspace's live model at `/live.json`, its changes at `/live/stream` and a page at `/live` with the repositories' panels, the stories and the costs; and `specgate workspace live` SHALL start that studio, or print the model with `--json`.

#### Scenario: SCN-323a — Studio in the workspace repository

- GIVEN a workspace of fleet and tracking
- WHEN the developer starts `specgate studio` in the workspace repository and opens /live.json and /live
- THEN /live.json is the workspace model with both repositories, and /live is the workspace's page

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-323.feature kind=functional status=Implemented test=tests/unit/workspace-live.test.ts -->

### Requirement: REQ-324 — Build a story in every repository at once

The system SHALL start, with `specgate workspace harness run --story <id>`, one harness per repository holding an open sub-change of the story, for that sub-change's requirements, all at once and each its own process, passing on the arguments after `--`; and SHALL start none when a repository's base already fails the gate on requirements outside its part, naming the repository.

#### Scenario: SCN-324a — A dry run names each repository's harness

- GIVEN the story follow-shipment with an open sub-change in fleet adding REQ-003 and in tracking adding REQ-005
- WHEN the developer runs `specgate workspace harness run --story follow-shipment --dry-run`
- THEN it names a harness for fleet on REQ-003 and one for tracking on REQ-005, and starts none

#### Scenario: SCN-324b — One red base, no harness

- GIVEN the same story, and fleet's REQ-000 Implemented with no test
- WHEN the developer runs `specgate workspace harness run --story follow-shipment`
- THEN it exits non-zero naming fleet, and no harness has started in either repository

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-324.feature kind=functional status=Implemented test=tests/unit/workspace-live.test.ts -->

### Requirement: REQ-339 — The workspace repository takes the client's brief

The system SHALL, on `specgate workspace draft` in a workspace repository, put the client's brief — a root `brief.md` — below a front matter in `docs/brief.md`, keeping its text, and SHALL list the stories its front matter names (`stories:` with an id, a title and the repositories of each), each with the next step to draft it.

#### Scenario: SCN-339a — The brief saved at the root

- GIVEN a workspace of fleet and tracking whose repository holds the client's `brief.md`
- WHEN the developer runs `specgate workspace draft`, writes `stories: [{ id: follow-shipment, title: El cliente sigue su envío, repos: [fleet, tracking] }]` in its front matter and runs it again
- THEN `docs/brief.md` holds the brief's text below a front matter, and the second run lists follow-shipment with fleet and tracking

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-339.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-340 — An agent drafts a story, and writes nothing else

The system SHALL, on `specgate workspace draft <story> --agent <cmd>`, hand the agent the brief and the story's id, title and repositories, let it write that story's `story.md` — its intent and acceptance criteria `AC-n` — and undo anything it writes elsewhere; without `--agent` it SHALL write `story.md` with the sections to fill.

#### Scenario: SCN-340a — The agent writes the story and touches the brief

- GIVEN the workspace above with follow-shipment in its brief's front matter, and an agent that writes the story's intent and AC-1 and also edits `docs/brief.md`
- WHEN the developer runs `specgate workspace draft follow-shipment --agent …`
- THEN `docs/stories/follow-shipment/story.md` holds the intent and AC-1, the prompt carried the brief, and `docs/brief.md` is as it was

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-340.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-341 — The status of a workspace repository

The system SHALL, on `specgate status` in a folder that holds `specgate.workspace.yaml` and no traceability matrix, print the workspace's repositories and stories and the next step — `workspace draft` when there is no story, `workspace propose` for a drafted story not yet split — and exit 0.

#### Scenario: SCN-341a — A workspace with its brief and no story

- GIVEN the workspace above, before any story
- WHEN the developer runs `specgate status` in the workspace repository
- THEN it exits 0, names the workspace and its repositories, and says `specgate workspace draft`

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-341.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-342 — Every repository receives the story

The system SHALL, on `specgate workspace propose <story>`, take a story already drafted — its repositories from the brief's front matter when `--repos` is not given — and copy its intent and acceptance criteria into each sub-change's `discover.md`, naming the story `<workspace>:<story>` and no file the repository cannot read.

#### Scenario: SCN-342a — follow-shipment, drafted, split

- GIVEN follow-shipment drafted with its intent and AC-1 "El cliente ve el camión"
- WHEN the developer runs `specgate workspace propose follow-shipment`
- THEN fleet's and tracking's `discover.md` hold the intent and AC-1, name truck-flote:follow-shipment, and do not say "in the workspace repository"

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-342.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-343 — A repository whose criteria drift from the story

The system SHALL, on `specgate workspace check`, warn `workspace_story_diverged` for each open sub-change whose acceptance criteria are not the story's.

#### Scenario: SCN-343a — Fleet rewrites AC-1

- GIVEN follow-shipment split across fleet and tracking, and fleet's `discover.md` AC-1 reworded
- WHEN the developer runs `specgate workspace check --json`
- THEN it warns `workspace_story_diverged` for fleet, and not for tracking

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-343.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-344 — The story's other repositories, named to each

The system SHALL write in each sub-change's `discover.md` the story's other repositories and the contracts repository, by name and role, and in its `design.md` how a requirement names what it needs from them (`depends=<repo>:REQ-NNN`, and an `api=` operation of the contracts repository); and SHALL, on `workspace harness run`, hand each repository's harness the other repositories' requirements of the story, which the implementing prompt includes.

#### Scenario: SCN-344a — Tracking is told of fleet

- GIVEN follow-shipment split across fleet and tracking, fleet's part adding REQ-003
- WHEN the developer proposes it and runs `specgate workspace harness run --story follow-shipment --dry-run --json`, then `specgate harness prompt REQ-005` in tracking with that context
- THEN tracking's `discover.md` names fleet, its `design.md` says `depends=fleet:REQ-NNN`, its run's context names fleet:REQ-003, and the prompt includes it

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-344.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-345 — A repository waiting on another's requirement is built after it

The system SHALL order `specgate workspace harness run --story` in levels: a repository whose part depends on a requirement of another part not yet delivered starts after that part's repository has finished; repositories of one level run at once, and the dry run shows each level.

#### Scenario: SCN-345a — Tracking waits on fleet

- GIVEN follow-shipment across fleet and tracking, tracking's REQ-005 with `depends=fleet:REQ-003`, fleet's REQ-003 not delivered
- WHEN the developer runs `specgate workspace harness run --story follow-shipment --dry-run --json`
- THEN fleet is in level 1 and tracking in level 2

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-345.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-346 — The live view shows a story's title as it is written

The system SHALL serve every JSON document of the studio with `charset=utf-8`, so a title written "El cliente sigue su envío" reads the same in `/live.json`.

#### Scenario: SCN-346a — A title with an accent

- GIVEN follow-shipment titled "El cliente sigue su envío"
- WHEN the developer reads `/live.json` from the studio of the workspace
- THEN its content type says charset=utf-8 and the story's title is "El cliente sigue su envío"

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-346.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-347 — A story's cost counts its delivered parts

The system SHALL count, in a story's cost, the requirements of its archived sub-changes as well as of its open ones.

#### Scenario: SCN-347a — Fleet's part archived after two minutes

- GIVEN follow-shipment whose fleet part, REQ-003, is archived and whose fleet ledger records REQ-003 for 120 seconds
- WHEN the developer runs `specgate workspace live --json`
- THEN the story's cost is 2 minutes

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-347.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-348 — Short names, and a readable table

The system SHALL, on `specgate workspace init` from sibling folders that share a prefix, name each repository without it (`truck-flote-fleet` → `fleet`), keeping its path, and print each repository's name, path and role in separate columns.

#### Scenario: SCN-348a — truck-flote-fleet and truck-flote-web

- GIVEN the sibling projects truck-flote-fleet and truck-flote-web
- WHEN the developer runs `specgate workspace init`
- THEN the repositories are fleet at ../truck-flote-fleet and web at ../truck-flote-web, and the output separates name and path

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-348.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-349 — What a story's build writes is not committed

The system SHALL, on `specgate workspace init`, add `.specgate/workspace-runs/` — where `workspace harness run` writes each repository's log — to the workspace's `.gitignore`.

#### Scenario: SCN-349a — After init

- GIVEN a new workspace
- WHEN the developer runs `specgate workspace init`
- THEN `.gitignore` lists `.specgate/workspace-runs/`

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-349.feature kind=functional status=Implemented test=tests/unit/workspace-rc2.test.ts -->

### Requirement: REQ-360 — An agent proposes the stories of the brief

The system SHALL, on `specgate workspace draft --agent "<cmd>"` while the workspace brief names no story, let the agent fill the front matter's `stories:` (each with its id, title and repositories, uncertain ones under a `# check:` comment), allowing it to write only `docs/brief.md` and putting back the client's text below the front matter if the agent changed it; and SHALL refuse `--agent` without a story id once stories are named, naming the command that drafts one.

#### Scenario: SCN-360a — The agent names follow-shipment

- GIVEN a workspace whose brief names no story, and an agent that writes a `stories:` entry and also edits the brief's text
- WHEN the developer runs `specgate workspace draft --agent "<cmd>"`
- THEN the front matter names follow-shipment with its repositories, the client's text is as before, and a second `workspace draft --agent` without a story id is refused

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-360.feature kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-361 — Each criterion names the repositories that answer it

The system SHALL read, in a story's `## Repositories` section, the criteria each repository answers (`` - `fleet`: AC-1, AC-2 ``), ask the agent drafting a story to write them, and write in each sub-change's `discover.md`, on `workspace propose`, a section naming the criteria that repository answers and those the others answer.

#### Scenario: SCN-361a — fleet answers AC-1, tracking AC-2

- GIVEN follow-shipment whose `story.md` maps AC-1 to fleet and AC-2 to tracking
- WHEN the developer runs `specgate workspace propose follow-shipment`
- THEN fleet's Discover says it answers AC-1 and tracking answers AC-2, and tracking's says the reverse

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-361.feature kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-362 — A criterion unanswered, or claimed twice, is reported

The system SHALL warn, on `workspace check`, when a story that maps its criteria to repositories leaves one criterion to no repository (`workspace_criterion_unanswered`) or gives one to two (`workspace_criterion_shared`).

#### Scenario: SCN-362a — AC-3 is nobody's, AC-1 is twice

- GIVEN follow-shipment with AC-1..AC-3, mapping AC-1 to fleet and tracking and AC-2 to tracking
- WHEN the developer runs `specgate workspace check --json`
- THEN it warns that AC-3 is answered by no repository and that AC-1 is claimed by fleet and tracking

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-362.feature kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-363 — A story's questions wait for their answers

The system SHALL keep a story's questions for the client in `docs/stories/<id>/questions.md`, in a draft's format, ask the agent drafting the story to write them there, and refuse `workspace propose` while one is open (`workspace_story_questions_open`, naming them) unless `--allow-open-questions` is given.

#### Scenario: SCN-363a — Q1 is open

- GIVEN follow-shipment whose `questions.md` has Q1 with no answer
- WHEN the developer runs `specgate workspace propose follow-shipment`, then answers Q1 and runs it again
- THEN the first is refused naming Q1, and the second opens the story's changes

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-363.feature kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-364 — A drafted story keeps none of its form's hints

The system SHALL remove, once the agent has written a story, the template's `<!-- … -->` hint of every section that holds text.

#### Scenario: SCN-364a — The agent fills Intent and criteria

- GIVEN a story scaffolded with its hints, and an agent that writes the Intent and AC-1 below them
- WHEN the developer runs `specgate workspace draft follow-shipment --agent "<cmd>"`
- THEN `story.md` holds the agent's text and no `<!--` line under Intent or Acceptance criteria

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-364.feature kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-365 — The business layer Specgate writes reads as business

The system SHALL write, on `workspace propose`, nothing in a sub-change's `discover.md` that `layer_discover_technical` reports: the guidance on `depends=` and `api=` goes in the sub-change's `design.md`.

#### Scenario: SCN-365a — follow-shipment proposed with a contracts repository

- GIVEN a workspace with fleet, tracking and a contracts repository, and follow-shipment drafted
- WHEN the developer proposes it and runs `specgate change validate follow-shipment --json` in fleet
- THEN no `layer_discover_technical` is reported, and fleet's `design.md` says how to write `depends=` and `api=`

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-365.feature kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-366 — Whoever writes a part of a story hears of the others

The system SHALL record, on `workspace propose`, in each sub-change where its workspace is (`story.json`), and SHALL include, in the prompt `change author` gives for any artefact of that change, the story's other repositories, their requirements with their status, and how to name what this part waits for (`depends=<repo>:REQ-NNN`, an `api=` operation of the contracts repository).

#### Scenario: SCN-366a — tracking's delta is written after fleet's

- GIVEN follow-shipment split across fleet and tracking, fleet's part adding REQ-003
- WHEN the developer runs `specgate change author follow-shipment --artifact specs --dry-run` in tracking
- THEN the prompt names fleet:REQ-003 and `depends=`

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-366.feature kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-367 — A requirement waits for what it depends on

The system SHALL start, on `workspace harness run --story`, at each level only the requirements whose every `depends=` is delivered, print the others as waiting on the requirements they name, and exit non-zero when a requirement was left waiting or a repository's run failed.

#### Scenario: SCN-367a — tracking's REQ-005 waits on fleet's REQ-003, which fails

- GIVEN follow-shipment where tracking's REQ-005 depends on fleet's REQ-003 and tracking's REQ-006 depends on nothing, and fleet's harness does not deliver REQ-003
- WHEN the developer runs `specgate workspace harness run --story follow-shipment`
- THEN tracking's harness is started for REQ-006 only, REQ-005 is reported waiting on fleet:REQ-003, and the run exits 1

<!-- specgate:trace actor=Developer feature=features/workspace/REQ-367.feature kind=functional status=Implemented test=tests/unit/workspace-rc3.test.ts -->

### Requirement: REQ-382 — The contracts repository writes its contracts, and the others cite them

The system SHALL tell whoever writes a part of a story in the repository whose role is `contracts` to write the OpenAPI or AsyncAPI file its requirements describe under `contracts/` and to cite each operation in its requirement's trace as `api=contracts/<file>#<operationId>`, and SHALL tell whoever writes a part in another repository to cite the contracts repository's requirements it uses with `depends=<contracts>:REQ-NNN` and their operations with `api=` once the contract file exists.

#### Scenario: SCN-382a — Writing the contracts part, then the panel's

- GIVEN a story across fleet, tracking and contracts, its sub-changes opened
- WHEN `change author --artifact specs` is prepared in contracts, and then in tracking
- THEN the contracts prompt asks for the contract file under contracts/ and `api=contracts/`, and the tracking prompt asks to cite `depends=contracts:REQ-NNN`

<!-- specgate:trace actor=Architect feature=features/workspace/REQ-382.feature kind=functional status=Implemented test=tests/unit/rc4-deps.test.ts -->
