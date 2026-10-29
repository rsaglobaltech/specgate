# Delta — workspace

## ADDED Requirements

### Requirement: REQ-339 — The workspace repository takes the client's brief

The system SHALL, on `specgate workspace draft` in a workspace repository, put the client's brief — a root `brief.md` — below a front matter in `docs/brief.md`, keeping its text, and SHALL list the stories its front matter names (`stories:` with an id, a title and the repositories of each), each with the next step to draft it.

#### Scenario: SCN-339a — The brief saved at the root

- GIVEN a workspace of fleet and tracking whose repository holds the client's `brief.md`
- WHEN the developer runs `specgate workspace draft`, writes `stories: [{ id: follow-shipment, title: El cliente sigue su envío, repos: [fleet, tracking] }]` in its front matter and runs it again
- THEN `docs/brief.md` holds the brief's text below a front matter, and the second run lists follow-shipment with fleet and tracking

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-340 — An agent drafts a story, and writes nothing else

The system SHALL, on `specgate workspace draft <story> --agent <cmd>`, hand the agent the brief and the story's id, title and repositories, let it write that story's `story.md` — its intent and acceptance criteria `AC-n` — and undo anything it writes elsewhere; without `--agent` it SHALL write `story.md` with the sections to fill.

#### Scenario: SCN-340a — The agent writes the story and touches the brief

- GIVEN the workspace above with follow-shipment in its brief's front matter, and an agent that writes the story's intent and AC-1 and also edits `docs/brief.md`
- WHEN the developer runs `specgate workspace draft follow-shipment --agent …`
- THEN `docs/stories/follow-shipment/story.md` holds the intent and AC-1, the prompt carried the brief, and `docs/brief.md` is as it was

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-341 — The status of a workspace repository

The system SHALL, on `specgate status` in a folder that holds `specgate.workspace.yaml` and no traceability matrix, print the workspace's repositories and stories and the next step — `workspace draft` when there is no story, `workspace propose` for a drafted story not yet split — and exit 0.

#### Scenario: SCN-341a — A workspace with its brief and no story

- GIVEN the workspace above, before any story
- WHEN the developer runs `specgate status` in the workspace repository
- THEN it exits 0, names the workspace and its repositories, and says `specgate workspace draft`

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-342 — Every repository receives the story

The system SHALL, on `specgate workspace propose <story>`, take a story already drafted — its repositories from the brief's front matter when `--repos` is not given — and copy its intent and acceptance criteria into each sub-change's `discover.md`, naming the story `<workspace>:<story>` and no file the repository cannot read.

#### Scenario: SCN-342a — follow-shipment, drafted, split

- GIVEN follow-shipment drafted with its intent and AC-1 "El cliente ve el camión"
- WHEN the developer runs `specgate workspace propose follow-shipment`
- THEN fleet's and tracking's `discover.md` hold the intent and AC-1, name truck-flote:follow-shipment, and do not say "in the workspace repository"

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-343 — A repository whose criteria drift from the story

The system SHALL, on `specgate workspace check`, warn `workspace_story_diverged` for each open sub-change whose acceptance criteria are not the story's.

#### Scenario: SCN-343a — Fleet rewrites AC-1

- GIVEN follow-shipment split across fleet and tracking, and fleet's `discover.md` AC-1 reworded
- WHEN the developer runs `specgate workspace check --json`
- THEN it warns `workspace_story_diverged` for fleet, and not for tracking

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-344 — The story's other repositories, named to each

The system SHALL write in each sub-change's `discover.md` the story's other repositories and the contracts repository, and how a requirement names what it needs from them (`depends=<repo>:REQ-NNN`, and an `api=` operation of the contracts repository); and SHALL, on `workspace harness run`, hand each repository's harness the other repositories' requirements of the story, which the implementing prompt includes.

#### Scenario: SCN-344a — Tracking is told of fleet

- GIVEN follow-shipment split across fleet and tracking, fleet's part adding REQ-003
- WHEN the developer proposes it and runs `specgate workspace harness run --story follow-shipment --dry-run --json`, then `specgate harness prompt REQ-005` in tracking with that context
- THEN tracking's `discover.md` names fleet and `depends=fleet:REQ-NNN`, its run's context names fleet:REQ-003, and the prompt includes it

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-345 — A repository waiting on another's requirement is built after it

The system SHALL order `specgate workspace harness run --story` in levels: a repository whose part depends on a requirement of another part not yet delivered starts after that part's repository has finished; repositories of one level run at once, and the dry run shows each level.

#### Scenario: SCN-345a — Tracking waits on fleet

- GIVEN follow-shipment across fleet and tracking, tracking's REQ-005 with `depends=fleet:REQ-003`, fleet's REQ-003 not delivered
- WHEN the developer runs `specgate workspace harness run --story follow-shipment --dry-run --json`
- THEN fleet is in level 1 and tracking in level 2

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-346 — The live view shows a story's title as it is written

The system SHALL serve every JSON document of the studio with `charset=utf-8`, so a title written "El cliente sigue su envío" reads the same in `/live.json`.

#### Scenario: SCN-346a — A title with an accent

- GIVEN follow-shipment titled "El cliente sigue su envío"
- WHEN the developer reads `/live.json` from the studio of the workspace
- THEN its content type says charset=utf-8 and the story's title is "El cliente sigue su envío"

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-347 — A story's cost counts its delivered parts

The system SHALL count, in a story's cost, the requirements of its archived sub-changes as well as of its open ones.

#### Scenario: SCN-347a — Fleet's part archived after two minutes

- GIVEN follow-shipment whose fleet part, REQ-003, is archived and whose fleet ledger records REQ-003 for 120 seconds
- WHEN the developer runs `specgate workspace live --json`
- THEN the story's cost is 2 minutes

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-348 — Short names, and a readable table

The system SHALL, on `specgate workspace init` from sibling folders that share a prefix, name each repository without it (`truck-flote-fleet` → `fleet`), keeping its path, and print each repository's name, path and role in separate columns.

#### Scenario: SCN-348a — truck-flote-fleet and truck-flote-web

- GIVEN the sibling projects truck-flote-fleet and truck-flote-web
- WHEN the developer runs `specgate workspace init`
- THEN the repositories are fleet at ../truck-flote-fleet and web at ../truck-flote-web, and the output separates name and path

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->

### Requirement: REQ-349 — What a story's build writes is not committed

The system SHALL, on `specgate workspace init`, add `.specgate/workspace-runs/` — where `workspace harness run` writes each repository's log — to the workspace's `.gitignore`.

#### Scenario: SCN-349a — After init

- GIVEN a new workspace
- WHEN the developer runs `specgate workspace init`
- THEN `.gitignore` lists `.specgate/workspace-runs/`

<!-- specgate:trace status=Implemented test=tests/unit/workspace-rc2.test.ts actor=Developer kind=functional -->
