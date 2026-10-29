# Studio

## Requirements

### Requirement: REQ-204 — Studio is an app you use without the commands

The system SHALL serve at studio's root a page with four sections — Home, Questions, Review and Build — each running a specgate command underneath; SHALL offer a simple mode (the default) and an advanced one that shows each action's command and what is written, and Spanish and English, both remembered in the viewer's browser; and SHALL accept its writes only through POST with the token its own page carries, as REQ-201.

#### Scenario: SCN-204a — The app and its sections

- GIVEN studio is running
- WHEN its root is opened
- THEN the page has Home, Questions, Review and Build, a simple/advanced switch and a Spanish/English switch, and carries its token

#### Scenario: SCN-204b — Writes need the token

- GIVEN studio is running
- WHEN an app action is posted without the page's token
- THEN it is refused with 403

<!-- specgate:trace actor=Developer feature=features/studio/REQ-204.feature kind=functional status=Implemented test=tests/unit/studio-app.test.ts -->

### Requirement: REQ-205 — Home says what to do next

The system SHALL give Home the project's counts — requirements built of the total, questions waiting, drafts to review, whether the gate passes — the progress of each module, and one next action, the first of: answer the questions waiting, review the drafts not approved, build the requirements ready, or nothing left.

#### Scenario: SCN-205a — Questions come first

- GIVEN two open questions, an unapproved draft and requirements ready to build
- WHEN Home is read
- THEN its next action is to answer the questions, naming how many

#### Scenario: SCN-205b — Then review, then build, then done

- GIVEN no open question and an unapproved draft, then no draft, then nothing left to build
- WHEN Home is read each time
- THEN the next action is review the draft, then build, then nothing left

<!-- specgate:trace actor=Developer feature=features/studio/REQ-205.feature kind=functional status=Implemented test=tests/unit/studio-app.test.ts -->

### Requirement: REQ-206 — A draft is approved by a person

The system SHALL, with `specgate change approve <id>`, record in the change's change.yaml that a person approved it and when, refusing while the draft checklist has errors or a question it holds is open, and naming them; the record SHALL survive later rewrites of change.yaml; and Review SHALL list each open change not approved with its requirements as statement and Given/When/Then, the checklist as plain checks, and Approve enabled only when nothing blocks it.

#### Scenario: SCN-206a — Approving a ready draft

- GIVEN draft-garaje passes its checklist and has no open question
- WHEN `specgate change approve draft-garaje` runs
- THEN change.yaml says approved with today's date, and the draft leaves Review

#### Scenario: SCN-206b — A draft with an open question is not approved

- GIVEN draft-garaje has an open question
- WHEN it is approved
- THEN it is refused naming the question, and change.yaml is unchanged

<!-- specgate:trace actor=Developer feature=features/studio/REQ-206.feature kind=functional status=Implemented test=tests/unit/studio-app.test.ts -->

### Requirement: REQ-207 — Asking a draft for a change in your own words

The system SHALL, with `specgate change note <id> "<text>" [--req <REQ>]`, append the request with its date and requirement to the change's review.md, and Review SHALL show a draft's open notes beside it and offer to write one per requirement.

#### Scenario: SCN-207a — A note on a requirement

- GIVEN draft-garaje holds REQ-212
- WHEN `specgate change note draft-garaje "Mejor 2 horas antes" --req REQ-212` runs
- THEN review.md holds the note with REQ-212 and the date, and Review lists it under the draft

<!-- specgate:trace actor=Developer feature=features/studio/REQ-207.feature kind=functional status=Implemented test=tests/unit/studio-app.test.ts -->

### Requirement: REQ-208 — Build lists what is ready and starts it

The system SHALL list under Build the requirements left to build that wait for no answer and whose open change, if any, is approved, with an estimate from earlier runs of how long and, when sessions reported it, how much; SHALL start `specgate harness run --chain` on the ones chosen in the background and answer at once; SHALL refuse to start without a configured agent or while a run holds the working copy; and SHALL show the run in progress as its steps in plain words.

#### Scenario: SCN-208a — What is ready, and what is not

- GIVEN REQ-210 in an approved change, REQ-211 waiting for an answer, and REQ-213 in a change not approved
- WHEN Build is read
- THEN only REQ-210 is ready

#### Scenario: SCN-208b — Starting a build

- GIVEN a configured agent and REQ-210 ready
- WHEN Build is started for REQ-210
- THEN it answers at once and a harness run for REQ-210 is under way

#### Scenario: SCN-208c — No agent, no build

- GIVEN no agent is configured
- WHEN Build is started
- THEN it is refused, saying how to configure one

<!-- specgate:trace actor=Developer feature=features/studio/REQ-208.feature kind=functional status=Implemented test=tests/unit/studio-app.test.ts -->

### Requirement: REQ-209 — Stopping a run after the requirement in progress

The system SHALL let a person ask a harness run to stop once the requirement in progress ends — from Build, or by a stop file beside the events — so the run starts no other requirement, reports the rest as not attempted because a stop was asked, and removes the request.

#### Scenario: SCN-209a — The run stops between requirements

- GIVEN a chain of REQ-001 and REQ-002, and a stop asked while REQ-001 runs
- WHEN REQ-001 ends
- THEN REQ-002 is not attempted, the reason says a stop was asked, and the stop request is gone

<!-- specgate:trace actor=Developer feature=features/studio/REQ-209.feature kind=functional status=Implemented test=tests/unit/harness-run.test.ts -->

### Requirement: REQ-210 — Questions in the app

The system SHALL list under Questions every open question with where it comes from (the agent, a draft, the project), what it blocks and the options it lists, with the form that answers it, and the answers whose assumption is still to review, with the action that marks them reviewed.

#### Scenario: SCN-210a — Open and to review

- GIVEN Q6 is open with options listed and Q1 is answered with its assumption to review
- WHEN Questions is read
- THEN Q6 is listed with its options and form, and Q1 under the answers to confirm

<!-- specgate:trace actor=Developer feature=features/studio/REQ-210.feature kind=functional status=Implemented test=tests/unit/studio-app.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/studio/REQ-211.feature kind=functional status=Implemented test=tests/unit/studio-route.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/studio/REQ-212.feature kind=functional status=Implemented test=tests/unit/studio-route.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/studio/REQ-213.feature kind=functional status=Implemented test=tests/unit/studio-route.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/studio/REQ-214.feature kind=functional status=Implemented test=tests/unit/studio-route.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/studio/REQ-215.feature kind=functional status=Implemented test=tests/unit/studio-route.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/studio/REQ-216.feature kind=functional status=Implemented test=tests/unit/studio-route.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/studio/REQ-217.feature kind=functional status=Implemented test=tests/unit/studio-route.test.ts -->

### Requirement: REQ-233 — The studio saves the specification in git before a build

The system SHALL, when a build is started from the studio, commit what the studio and the drafting wrote — docs/brief.md, spec.md, docs/specs/, features/, harness.config.yaml and .harness/profiles.yaml and prompt-prefix.md — with the person's own git identity and a message that says it came from the studio, so the harness finds the clean tree it needs; and SHALL refuse the build, naming the files, when anything else is uncommitted, or when git has no identity, saying how to set it.

#### Scenario: SCN-233a — The brief edited in the studio is committed

- GIVEN docs/brief.md and a change's change.yaml modified and not committed, and a requirement ready to build
- WHEN a build is started from the studio
- THEN both files are in a new commit whose message says it came from the studio, the tree is clean, and the build starts

#### Scenario: SCN-233b — Code left uncommitted stops the build

- GIVEN src/app.ts modified and not committed
- WHEN a build is started from the studio
- THEN it is refused naming src/app.ts, and nothing is committed

<!-- specgate:trace actor=Developer feature=features/studio/REQ-233.feature kind=functional status=Implemented test=tests/unit/studio-commit.test.ts -->

### Requirement: REQ-275 — The studio's Build follows the gate's steps

The system SHALL place the running requirement of the studio's Build in Programa until its gate starts, in Prueba while the specification, architecture and test steps run, in Revisa la calidad while a quality check runs, and in Guarda once it merges; and SHALL name the step that is running, with how long it has run.

#### Scenario: SCN-275a — Building while a quality check runs

- GIVEN the studio page
- WHEN it is served
- THEN its Build reads `gate-start` events, puts a `quality:` step in the third stage, and shows the running step's name

<!-- specgate:trace actor=Developer feature=features/studio/REQ-275.feature kind=functional status=Implemented test=tests/unit/live-gate-steps.test.ts -->

### Requirement: REQ-270 — The studio's report judges the project as check does

The system SHALL judge the specification gate of the studio's report against the project as it will be after its open changes are archived, as `specgate check` does, so a requirement of a reviewed draft that the harness delivered — its feature file written, its row not yet in the written matrix — does not make the report fail.

#### Scenario: SCN-270a — A draft's requirement delivered before the draft is archived

- GIVEN REQ-002 is only in the open change `draft-flota`, and `features/flota/REQ-002.feature` is written
- WHEN the studio's report runs its specification gate
- THEN the gate passes, while the bare `validate --strict` still names the feature missing from the matrix

<!-- specgate:trace actor=Developer feature=features/studio/REQ-270.feature kind=functional status=Implemented test=tests/unit/studio-inflight.test.ts -->

### Requirement: REQ-280 — The report titles a scenario from the specification

The system SHALL take the title of each scenario in the studio's report from the specification only — `spec.md`, the capability specs and the deltas of open changes, a delta first — and never from a draft's `DRAFTING.md`, a proposal, or an archived change.

#### Scenario: SCN-280a — A delivered requirement of a draft

- GIVEN REQ-002 is in the open change `draft-fleet-tracking`, whose delta names `SCN-002 — A registered tracker reports a position` and whose `DRAFTING.md` shows `SCN-002 — <what happens>`
- WHEN the studio's report lists REQ-002's scenarios
- THEN SCN-002 is titled "A registered tracker reports a position"

<!-- specgate:trace actor=Developer feature=features/studio/REQ-280.feature kind=functional status=Implemented test=tests/unit/harness-run7.test.ts -->
