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
