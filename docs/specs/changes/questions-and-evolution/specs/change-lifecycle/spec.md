# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-190 — Modifying a delivered requirement starts from its text

The system SHALL, with `specgate change new <id> --modify <REQ>` (repeatable), write into the change a `MODIFIED Requirements` delta for each requirement's capability holding the requirement as the capability spec has it, its statement, scenarios and trace, with its status set to `Draft`, and SHALL refuse a requirement no capability spec defines, or one an open change already modifies, naming that change.

#### Scenario: SCN-190a — The requirement copied, reopened alone

- GIVEN capability fichas defines REQ-017 as Implemented with scenarios SCN-048 to SCN-050
- WHEN `specgate change new gears --modify REQ-017` runs
- THEN the change's fichas delta has REQ-017 under MODIFIED with its statement, SCN-048 to SCN-050 and status Draft, and no other requirement of fichas changes status

#### Scenario: SCN-190b — What cannot be modified is refused

- GIVEN REQ-999 is defined nowhere and change gears already modifies REQ-017
- WHEN `specgate change new other --modify REQ-999` or `--modify REQ-017` runs
- THEN it is refused, saying REQ-999 is not in a capability spec, or that gears already modifies REQ-017

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-191 — What a change to a requirement touches

The system SHALL list with `specgate change impact <REQ|change>` (`--json` too), for each requirement, the spec file and line that define it, its feature files, the tests that name it, the files its commits changed (commits whose message names it), and the other requirements whose text or scenarios name it; for a change, it SHALL do so for every requirement the change modifies or removes.

#### Scenario: SCN-191a — The impact of one requirement

- GIVEN REQ-017 is defined in capabilities/fichas, has features/fichas/REQ-017.feature, a test naming it, a commit "feat(REQ-017)" that changed FichasContent.ts, and REQ-085 names REQ-017
- WHEN `specgate change impact REQ-017` runs
- THEN it lists the spec file and line, the feature, the test, FichasContent.ts and REQ-085

#### Scenario: SCN-191b — The impact of a change

- GIVEN change gears modifies REQ-017 and REQ-018
- WHEN `specgate change impact gears` runs
- THEN it lists the impact of REQ-017 and of REQ-018

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-192 — A new requirement for a module the brief already covers

The system SHALL, with `specgate brief add <module> "<text>"`, refuse a module the brief's front matter does not list, append the text to the brief under "Additions" with the module and the date, and add to the module's open change (or create one, `<module>-additions`, reserving an id) an ADDED requirement whose title and statement are left for the author and whose source quotes the text, so the draft checklist asks for them.

#### Scenario: SCN-192a — A module already archived gets a change

- GIVEN module fichas is listed in the brief and has no open change
- WHEN `specgate brief add fichas "Subir de marcha paso a paso"` runs
- THEN the brief gains the line under "Additions" with fichas and the date, and change fichas-additions is created with one ADDED requirement quoting "Subir de marcha paso a paso"

#### Scenario: SCN-192b — A module with an open change grows it

- GIVEN module examen has the open change draft-examen
- WHEN `specgate brief add examen "Situaciones de noche"` runs
- THEN draft-examen gains an ADDED requirement quoting the text, with the next id of its range or a newly reserved one

#### Scenario: SCN-192c — An unknown module is refused

- GIVEN the brief lists no module "garaje"
- WHEN `specgate brief add garaje "x"` runs
- THEN it is refused with the modules the brief lists, and nothing is written

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
