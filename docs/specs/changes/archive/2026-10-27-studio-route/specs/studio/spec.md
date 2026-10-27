# Delta — studio

## ADDED Requirements

### Requirement: REQ-211 — The agent is chosen per run from the profiles

The system SHALL accept `--profile <name>` on `specgate harness run` and on `specgate propose --from-brief`, running that profile's agent from `.harness/profiles.yaml` for that run instead of the configured one, and refusing a name the file does not declare, naming the ones it does; and the studio SHALL list the profiles with whether each is the default, its cost hint, and whether its agent streams usage, and SHALL pass the one the person picks to Brief, Drafts and Build.

#### Scenario: SCN-211a — A run with a chosen profile

- GIVEN `.harness/profiles.yaml` declares `fast` and `deep`, and the configured agent is `fast`
- WHEN `specgate harness run --req REQ-002 --profile deep --dry-run` runs
- THEN the agent it would run is `deep`'s

#### Scenario: SCN-211b — An unknown profile is refused

- GIVEN the profiles `fast` and `deep`
- WHEN a run asks for `--profile other`
- THEN it is refused naming `fast` and `deep`

#### Scenario: SCN-211c — The studio lists the profiles

- GIVEN the profiles `fast`, whose agent pipes into `specgate harness events --from claude`, and `deep` with a cost hint of 1.9
- WHEN the studio reads the profiles
- THEN `fast` streams usage and is the default, and `deep` carries its cost hint

<!-- specgate:trace status=Implemented test=tests/unit/studio-route.test.ts actor=Developer kind=functional -->

### Requirement: REQ-212 — The route says where the project is

The system SHALL give the studio a route of seven steps — Project, Brief, Drafts, Questions, Review, Build, Report — each done, current, open or locked as the project's files say, with a one-line summary, and one next action: the first step not done that is not locked.

#### Scenario: SCN-212a — A project with a brief and no draft

- GIVEN a project with a brief of three modules and no draft
- WHEN the route is read
- THEN Project and Brief are done, Drafts is current with "0 of 3", Build and Report are locked, and the next action is to draft the first module

#### Scenario: SCN-212b — A folder that is not a project

- GIVEN a folder with no specgate project
- WHEN the route is read
- THEN Project is current and every other step is locked

<!-- specgate:trace status=Implemented test=tests/unit/studio-route.test.ts actor=Developer kind=functional -->

### Requirement: REQ-213 — A project is created from an empty folder

The system SHALL, when the studio runs in an empty folder, create the project there from a name, a kind (web, API or mobile), a stack and an agent preset, running `specgate init` non-interactively and writing the harness configuration with a profile for the agent chosen, or none when the person defers it; and SHALL refuse a folder that already holds files, naming the command that adopts it.

#### Scenario: SCN-213a — Creating a project

- GIVEN an empty folder
- WHEN a project named "Autoescuela" of kind web, stack Node.js and React, agent Claude, is created
- THEN the folder holds spec.md and a brief to fill, harness.config.yaml names the profile, and .harness/profiles.yaml declares it

#### Scenario: SCN-213b — A folder with files is not overwritten

- GIVEN a folder holding a README.md
- WHEN a project is created there
- THEN it is refused with `specgate init` named, and the README.md is unchanged

<!-- specgate:trace status=Implemented test=tests/unit/studio-route.test.ts actor=Developer kind=functional -->

### Requirement: REQ-214 — The brief is written as a form

The system SHALL read docs/brief.md into a form — the product, each actor with its surfaces, and each module with its rules, examples and questions — and write the form back as the brief's front matter and `## Module:` sections, keeping each module's other text; SHALL also save the brief as markdown; and SHALL return with each read and save the brief's findings (B1–B11) in plain words.

#### Scenario: SCN-214a — A form round trip

- GIVEN a brief with two modules, one of them with prose under its heading
- WHEN it is read as a form, a rule is added to one module, and the form is saved
- THEN the brief has the new rule, the other module's cards and the prose are unchanged, and the front matter lists both modules

#### Scenario: SCN-214b — The findings come back with the save

- GIVEN a module with rules and no example
- WHEN the form is saved
- THEN a finding names that module as having no example

<!-- specgate:trace status=Implemented test=tests/unit/studio-route.test.ts actor=Developer kind=functional -->

### Requirement: REQ-215 — A client's text becomes the brief

The system SHALL, given a pasted text and a profile, save the text as docs/brief.md when there is none (refusing to replace a brief that exists unless asked) and run `specgate propose --from-brief --profile <name>` in the background so the agent proposes the front matter and the module cards, reporting while it works and when it ends.

#### Scenario: SCN-215a — Pasting a text

- GIVEN a project with no brief and a profile `fast`
- WHEN a client's text is pasted
- THEN docs/brief.md holds the text and the agent's run has started with `fast`

#### Scenario: SCN-215b — An existing brief is kept

- GIVEN a project with a brief
- WHEN a text is pasted without asking to replace
- THEN it is refused and the brief is unchanged

<!-- specgate:trace status=Implemented test=tests/unit/studio-route.test.ts actor=Developer kind=functional -->

### Requirement: REQ-216 — Each module is drafted from the studio

The system SHALL list the brief's modules with where each stands — not started, being drafted, to review, approved, archived — and its requirements and open questions; SHALL start drafting a module in the background with `specgate propose --from-brief <module> --profile <name>`, one at a time, showing its progress from what the draft holds so far, and stop it on request; and SHALL give the draft checklist of the module in plain words.

#### Scenario: SCN-216a — Starting a draft

- GIVEN a brief with a module `reservas` not started
- WHEN its drafting is started with the profile `fast`
- THEN a run of `propose --from-brief reservas --profile fast` is working, and the module reads as being drafted

#### Scenario: SCN-216b — One draft at a time

- GIVEN a module being drafted
- WHEN another is started
- THEN it is refused naming the module in progress

<!-- specgate:trace status=Implemented test=tests/unit/studio-route.test.ts actor=Developer kind=functional -->

### Requirement: REQ-217 — The report says what was built and how it was proven

The system SHALL give a report of the project: requirements built of the total, the examples proven, whether the gate passes, the agent's cost and time from the harness runs, per module what is built, each built requirement with the scenario that proves it, what is missing and why (not built, waiting for an answer), and the questions answered and assumptions reviewed; and SHALL serve it as a standalone HTML page to download.

#### Scenario: SCN-217a — The report of a project half built

- GIVEN a module with two requirements Implemented and one waiting for an answer
- WHEN the report is read
- THEN it counts 2 built of 3, lists both with their scenario, and names the one waiting with its question

#### Scenario: SCN-217b — The report downloads

- GIVEN studio is running
- WHEN the report's download is opened
- THEN it is an HTML page that names the project and needs nothing else to open

<!-- specgate:trace status=Implemented test=tests/unit/studio-route.test.ts actor=Developer kind=functional -->
