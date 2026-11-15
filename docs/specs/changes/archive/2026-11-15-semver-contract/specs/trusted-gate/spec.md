# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-568 — The public surface is frozen within a major version

The system SHALL list its public surface — commands and sub-commands, the flags each `--help` lists, every diagnostic code, the exit codes, the MCP tools, the library API's exports and members, the configuration keys, and every key with its type of the JSON answers a tool reads — from its own code and CLI; SHALL keep the list of the last release in `contract/surface.json`; and `npm run contract:check`, run by CI on every pull request, SHALL fail when an item of that list is gone or a key's type changed within the same major version, list what was added, and with `--release <version>` fail a version that adds to the surface without raising at least the minor.

#### Scenario: SCN-568a — A flag removed in a minor

- GIVEN `contract/surface.json` frozen at 1.0.0 with `status --json`
- WHEN a pull request for 1.1.0 removes `--json` from `status`
- THEN `contract:check` fails, naming `flag:status --json` and that removing it waits for 2.0.0

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-568.feature actor=Maintainer kind=functional -->

### Requirement: REQ-569 — Deprecation before removal

The system SHALL allow an item of the public surface to be removed only in a new major version and only once `contract/deprecations.json` listed it — with the version that deprecated it and what to use instead — and SHALL list, on every check, the deprecated items still present.

#### Scenario: SCN-569a — A removal in a major, after a deprecation

- GIVEN `status --json` deprecated in 1.4.0 for `--format json`
- WHEN 2.0.0 removes it, and another 2.0.0 removes an item never deprecated
- THEN the first passes, and the second fails, saying to deprecate it in a minor release first

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-569.feature actor=Maintainer kind=functional -->
