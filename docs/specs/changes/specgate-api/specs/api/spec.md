# Delta — api

## ADDED Requirements

### Requirement: REQ-466 — The API answers what --json prints

The system SHALL export from `@rsaglobaltech/specgate/api` the functions `status(dir)`, `questions(dir)` and `matrix(dir)`, each resolving to the same answer `specgate status --json`, `specgate questions --json` and `specgate matrix --json` print for that project: the data, and the findings under `status`, each with its code, message and fix.

#### Scenario: SCN-466a — Questions in-process and from the CLI

- GIVEN a project with the draft `draft-orders`, whose open question Q2 blocks REQ-003
- WHEN a program calls `questions(dir)` and runs `specgate questions --json` on the same project
- THEN both answers are equal, and Q2 in them names `draft-orders` and blocks `REQ-003`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-467 — The API only reads

The system SHALL answer `status`, `questions` and `matrix` from the API without writing any file of the project and without starting a process.

#### Scenario: SCN-467a — A derived matrix behind its specs

- GIVEN a derived project whose `docs/specs/traceability.md` is behind its capability specs
- WHEN a program calls `matrix(dir)`
- THEN the answer has the rows as they would be derived, and `traceability.md` is unchanged byte for byte

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-468 — The API is typed, versioned, and breaks no import

The system SHALL publish the API's types with it and export `API_VERSION`, whose major number changes only when an answer's shape breaks; and SHALL keep resolving `@rsaglobaltech/specgate/package.json` and every path under the package that resolves today.

#### Scenario: SCN-468a — A TypeScript program and the studio's bin lookup

- GIVEN specgate installed in a TypeScript project with `strict` on
- WHEN it imports `questions` and `API_VERSION` from `@rsaglobaltech/specgate/api`, and resolves `@rsaglobaltech/specgate/package.json`
- THEN it compiles with no error, `API_VERSION` is `1.0.0`, and `package.json` resolves

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-469 — A folder that is not a project is refused

The system SHALL reject a call of the API on a folder that has no specgate project with an error whose code is `not_a_project`, whose message names the folder, and whose fix is `specgate init`.

#### Scenario: SCN-469a — An empty folder

- GIVEN an empty folder
- WHEN a program calls `status(dir)` on it
- THEN the call rejects with code `not_a_project`, the folder in its message, and the fix `specgate init`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
