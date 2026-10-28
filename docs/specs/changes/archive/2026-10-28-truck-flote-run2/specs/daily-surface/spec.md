# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-243 — status points at a brief still to fill in

The system SHALL, when `docs/brief.md` exists and its front matter lists no modules, give as `status`'s next step to fill in the brief and run `specgate draft`, instead of the adoption path.

#### Scenario: SCN-243a — A project forja just generated

- GIVEN `docs/brief.md` with the client's text and `modules: []`, and only the adoption baseline REQ-001
- WHEN `specgate status` runs
- THEN its next step names `docs/brief.md` and `specgate draft`, not `specgate new`

<!-- specgate:trace status=Implemented test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-249 — init --yes where code exists says what it does

The system SHALL, when `specgate init --yes` scaffolds in a folder that already has code, warn that it creates a separate project in a sub-folder and that `specgate init`, without `--yes`, adopts the folder in place.

#### Scenario: SCN-249a — A package.json and --yes

- GIVEN a folder with `package.json`
- WHEN `specgate init --yes --dry-run` runs
- THEN it warns that it scaffolds a separate project and names `specgate init` without `--yes` to adopt the folder

<!-- specgate:trace status=Implemented test=tests/unit/init-wizard.test.ts actor=Developer kind=functional -->

## MODIFIED Requirements

### Requirement: REQ-236 — forja is found, or the person is told how to get it

The system SHALL run forja, for `specgate init --forja` and `specgate add`, from `SPECGATE_FORJA_CMD` when it is set, else from a `forja` on the PATH, else with npx at the pinned major; and SHALL, before running npx for `init --forja`, ask npm whether that package exists and, when it does not, stop with an error that says how to install forja from its GitHub releases and names `SPECGATE_FORJA_CMD`, instead of npm's 404; and SHALL give forja its own version in `SPECGATE_VERSION`, so the project forja generates depends on the Specgate that generated it.

#### Scenario: SCN-236a — No forja anywhere

- GIVEN no `forja` on the PATH, no `SPECGATE_FORJA_CMD`, and an npm registry that does not have `@rsaglobaltech/forja`
- WHEN `specgate init --forja fleet --backend spring` runs
- THEN it exits with an error naming `https://github.com/rsaglobaltech/forja/releases` and `SPECGATE_FORJA_CMD`, and runs nothing

#### Scenario: SCN-236b — forja learns the Specgate that called it

- GIVEN a forja that records its environment
- WHEN `specgate init --forja shop` runs
- THEN forja sees `SPECGATE_VERSION` set to Specgate's own version

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-236.feature kind=functional status=Implemented test=tests/unit/forja-front-door.test.ts -->
