# Studio

## Requirements

### Requirement: REQ-204 — Studio is an app you use without the commands

The system SHALL serve at studio's root one app with the sections Home, Brief, Changes, Questions, Build, Live, Report and Settings, each running a specgate command underneath and each with its own address, so that Back, Forward, reloading and a link open the same section; SHALL offer a simple mode (the default) and an advanced one that shows each action's command and what is written, Spanish and English, a light and a dark theme that follow the system until one is chosen, and a sidebar that folds to its icons, all remembered in the viewer's browser; and SHALL accept its writes only through POST with the token its own page carries, as REQ-201.

> Amended by studio-redesign: four sections in one page without addresses become the sidebar of one app, each section at its own address.

#### Scenario: SCN-204a — The app and its sections

- GIVEN studio is running
- WHEN its root is opened, then Questions is chosen, then the page is reloaded
- THEN the page lists Home, Brief, Changes, Questions, Build, Live, Report and Settings, carries its token, and opens Questions again after the reload

#### Scenario: SCN-204b — Writes need the token

- GIVEN studio is running
- WHEN an app action is posted without the page's token
- THEN it is refused with 403

<!-- specgate:trace actor=Developer feature=features/studio/REQ-204.feature kind=functional status=Implemented -->

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

The system SHALL, with `specgate change approve <id>`, record in the change's change.yaml that a person approved it and when, refusing while the draft checklist has errors or a question it holds is open, and naming them; the record SHALL survive later rewrites of change.yaml; and Review SHALL list each open change not approved with its requirements as statement and Given/When/Then, the checklist as plain checks, and Approve enabled only when nothing blocks it. Each blocker SHALL be listed with the action that clears it — answering a question, confirming that the spec says an answer, opening the requirement the checklist names — and a question SHALL be matched by its exact id.

> Amended by studio-unblock: on 2026-11-08 Approve stayed disabled with no way to clear what blocked it, and a blocker naming Q10 hid Q1.

#### Scenario: SCN-206a — Approving a ready draft

- GIVEN draft-garaje passes its checklist and has no open question
- WHEN `specgate change approve draft-garaje` runs
- THEN change.yaml says approved with today's date, and the draft leaves Review

#### Scenario: SCN-206b — A draft with an open question is not approved

- GIVEN draft-garaje has an open question
- WHEN it is approved
- THEN it is refused naming the question, and change.yaml is unchanged

#### Scenario: SCN-206c — Every blocker with its action

- GIVEN draft-garaje with Q1 open and Q10 answered by hand but still blocking REQ-214
- WHEN Review is read
- THEN Approve is disabled, Q1 is listed with "answer" and Q10 with "it is in the spec", each once

<!-- specgate:trace actor=Developer feature=features/studio/REQ-206.feature kind=functional status=Implemented -->

### Requirement: REQ-207 — Asking a draft for a change in your own words

The system SHALL, with `specgate change note <id> "<text>" [--req <REQ>]`, append the request with its date and requirement to the change's review.md, and Review SHALL show a draft's open notes beside it and offer to write one per requirement.

#### Scenario: SCN-207a — A note on a requirement

- GIVEN draft-garaje holds REQ-212
- WHEN `specgate change note draft-garaje "Mejor 2 horas antes" --req REQ-212` runs
- THEN review.md holds the note with REQ-212 and the date, and Review lists it under the draft

<!-- specgate:trace actor=Developer feature=features/studio/REQ-207.feature kind=functional status=Implemented test=tests/unit/studio-app.test.ts -->

### Requirement: REQ-208 — Build lists what is ready and starts it

The system SHALL list under Build the requirements left to build that wait for no answer and whose open change, if any, is approved, with an estimate from earlier runs of how long and, when sessions reported it, how much; SHALL start `specgate harness run --chain` on the ones chosen in the background and answer at once; SHALL refuse to start without a configured agent or while a run holds the working copy; and SHALL show the run in progress as its steps in plain words. Without a configured agent, Build SHALL offer to choose one (REQ-431) instead of naming a command.

> Amended by studio-unblock: Build said the agent was missing and named `specgate harness init`, which does not write one.

#### Scenario: SCN-208a — What is ready, and what is not

- GIVEN REQ-210 in an approved change, REQ-211 waiting for an answer, and REQ-213 in a change not approved
- WHEN Build is read
- THEN only REQ-210 is ready

#### Scenario: SCN-208b — Starting a build

- GIVEN a configured agent and REQ-210 ready
- WHEN Build is started for REQ-210
- THEN it answers at once and a harness run for REQ-210 is under way

#### Scenario: SCN-208c — No agent, no build

- GIVEN no agent is configured and `claude` is on the PATH
- WHEN Build is read and started
- THEN the start is refused, and Build offers Claude Code as the agent to choose

<!-- specgate:trace actor=Developer feature=features/studio/REQ-208.feature kind=functional status=Implemented -->

### Requirement: REQ-209 — Stopping a run after the requirement in progress

The system SHALL let a person ask a harness run to stop once the requirement in progress ends — from Build, or by a stop file beside the events — so the run starts no other requirement, reports the rest as not attempted because a stop was asked, and removes the request.

#### Scenario: SCN-209a — The run stops between requirements

- GIVEN a chain of REQ-001 and REQ-002, and a stop asked while REQ-001 runs
- WHEN REQ-001 ends
- THEN REQ-002 is not attempted, the reason says a stop was asked, and the stop request is gone

<!-- specgate:trace actor=Developer feature=features/studio/REQ-209.feature kind=functional status=Implemented test=tests/unit/harness-run.test.ts -->

### Requirement: REQ-210 — Questions in the app

The system SHALL list under Questions every open question with where it comes from (the agent, a draft, the project), what it blocks and the options it lists, with the form that answers it, and the answers still to confirm in the spec, one per question, with the action that confirms them. Answering SHALL write the answer into `questions.md` whatever columns its table has, keeping its line endings, and SHALL fail, saying why, when it writes nothing; answering again SHALL replace the answer, not add a second one to confirm. Confirming SHALL mark the question reviewed and lift `Needs Clarification` from the requirements it blocks, whether the answer came from the studio or was written by hand.

> Amended by studio-unblock: on 2026-11-08 an answer was reported saved and never written, each click added a row to confirm, and answers written by hand could not be confirmed.

#### Scenario: SCN-210a — Open and to review

- GIVEN Q6 is open with options listed and Q1 is answered with its assumption to review
- WHEN Questions is read
- THEN Q6 is listed with its options and form, and Q1 under the answers to confirm

#### Scenario: SCN-210b — An answer into a table without an Answer column

- GIVEN `questions.md` with the columns `# | Question | Blocks | Options seen`, CRLF line endings, and Q1 open
- WHEN Q1 is answered twice in the studio
- THEN `questions.md` has `Answer` and `Status` columns, Q1's latest answer, CRLF endings, and Q1 is listed once to confirm

#### Scenario: SCN-210c — Confirming an answer given by hand

- GIVEN Q2 answered by hand in `questions.md` and REQ-215 marked `Needs Clarification` for it
- WHEN Q2 is confirmed in the studio
- THEN Q2 is reviewed, REQ-215 no longer says `Needs Clarification`, and Q2 no longer blocks approval

<!-- specgate:trace actor=Developer feature=features/studio/REQ-210.feature kind=functional status=Implemented -->

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

The system SHALL show on Home a route of seven steps — Project, Brief, Drafts, Questions, Review, Build, Report — each done, current, open or locked as the project's files say, with a one-line summary, and one next action: the first step not done that is not locked, as a link to the section where it is done.

> Amended by studio-redesign: the route moves from the header to Home, and its next action opens the section that does it.

#### Scenario: SCN-212a — A project with a brief and no draft

- GIVEN a project with a brief of three modules and no draft
- WHEN the route is read
- THEN Project and Brief are done, Drafts is current with "0 of 3", Build and Report are locked, and the next action is to draft the first module

#### Scenario: SCN-212b — A folder that is not a project

- GIVEN a folder with no specgate project
- WHEN the route is read
- THEN Project is current and every other step is locked

<!-- specgate:trace actor=Developer feature=features/studio/REQ-212.feature kind=functional status=Implemented -->

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

### Requirement: REQ-429 — One way to write and read an answer

The drafting guide SHALL tell the agent to write `questions.md` with the columns `# | Question | Blocks | Options seen | Answer | Status`; `specgate questions`, the studio and the draft checklist SHALL read an answer the same way — the `Answer` (or `Respuesta`) cell, or a line `Answer (Qn): …` under the table — and SHALL not count an empty cell or a placeholder (`TBD`, `pending`, `pendiente`) as an answer.

#### Scenario: SCN-429a — The same answer everywhere

- GIVEN Q1 answered in its `Answer` cell and Q2 by a line `Answer (Q2): 30 days` under the table
- WHEN `specgate questions`, the studio and the draft checklist read `questions.md`
- THEN all three count Q1 and Q2 as answered

<!-- specgate:trace actor=Developer feature=features/studio/REQ-429.feature kind=functional status=Implemented -->

### Requirement: REQ-430 — The studio answers quickly and never fails in silence

The studio SHALL read the project's state without starting a CLI process, reusing it until a spec file changes; SHALL keep a button busy, refusing a second click, while its request is in flight; SHALL show a read that fails, with the reason and a retry, instead of keeping the last view without a word; and SHALL redraw a view only when what it shows changed.

#### Scenario: SCN-430a — A refresh that costs nothing

- GIVEN the studio open on Home and no spec file changed
- WHEN the view refreshes
- THEN no process is started and the page is not redrawn

#### Scenario: SCN-430b — A failed read is said

- GIVEN a `questions.md` the studio cannot read
- WHEN Questions refreshes
- THEN the page says it could not read it, why, and offers to retry

<!-- specgate:trace actor=Developer feature=features/studio/REQ-430.feature kind=functional status=Implemented -->

### Requirement: REQ-431 — The agent is chosen in the studio

The studio SHALL offer, where no agent is configured, Claude Code, Codex and a command of one's own, the ones found on the PATH marked so and the first of them chosen; choosing SHALL write the agent as `specgate config set agent` does, through a request that needs the studio's token, and Build SHALL then start. A configured command SHALL have `{prompt_file}` replaced by the file's path in quotes, so a path with spaces reaches the agent whole.

#### Scenario: SCN-431a — Claude Code chosen from the studio

- GIVEN a project with no agent configured and `claude` on the PATH
- WHEN Claude Code is chosen in Build
- THEN `harness.config.yaml` holds the Claude Code agent, and Build can start

#### Scenario: SCN-431b — A temporary folder with a space

- GIVEN the agent `claude -p < {prompt_file}` and a prompt file under `C:\Users\Juan Perez\AppData\Local\Temp`
- WHEN the command is built
- THEN the path reaches it quoted, as one argument

<!-- specgate:trace actor=Developer feature=features/studio/REQ-431.feature kind=functional status=Implemented -->

### Requirement: REQ-432 — The studio is built from typed source and carries no runtime dependency

The studio's page SHALL be built from typed source at build time into static files Specgate serves from its own package; installing Specgate SHALL add no runtime dependency; and the page SHALL work without a network beyond the studio itself.

#### Scenario: SCN-432a — What the package ships

- GIVEN Specgate built and packed
- WHEN its package is read
- THEN it holds the studio's script and styles, its `dependencies` are empty, and the page loads nothing from another host

<!-- specgate:trace actor=Developer feature=features/studio/REQ-432.feature kind=functional status=Implemented -->

### Requirement: REQ-433 — Live is a section of the studio

The system SHALL show, in the studio's Live section, the run in progress — the requirement, its stages (codes, tests, checks quality, saves) with the current one marked, its log as it streams, the queue, the time and the cost so far — updated through server-sent events without reloading; SHALL let the viewer answer there a question the agent asked and stop the run after the current requirement or at once; and `/live` SHALL open that section.

#### Scenario: SCN-433a — A run followed live

- GIVEN a harness run on REQ-025 in its tests stage
- WHEN the Live section is open and the run writes a test result
- THEN the result appears in the log without a reload, Tests is the current stage, and REQ-026 is listed as queued

<!-- specgate:trace actor=Developer feature=features/studio/REQ-433.feature kind=functional status=Implemented -->

### Requirement: REQ-434 — The studio says what it is doing and what went wrong

The studio SHALL show the shape of a section while its first read is under way; SHALL mark a button busy, refusing a second press, while its request runs, and then say in a notice what happened; SHALL keep a notice that reports a failure until it is closed, with the action that retries; SHALL say when it cannot reach the studio's server and when it reaches it again, keeping what it showed marked as possibly old; and SHALL show a failed read inside its own section, the rest of the page still usable.

#### Scenario: SCN-434a — The server goes away and comes back

- GIVEN the studio open on Questions
- WHEN its server stops and starts again
- THEN the page says it is reconnecting, keeps the questions shown, and says it is connected once the server answers

<!-- specgate:trace actor=Developer feature=features/studio/REQ-434.feature kind=functional status=Implemented -->

### Requirement: REQ-435 — The studio is used with the keyboard and a screen reader

Every action of the studio SHALL be reachable and usable with the keyboard, with a visible focus; its sections, forms and notices SHALL carry the roles and names a screen reader announces; a refresh SHALL not announce the whole page again; and its motion SHALL stop when the system asks for reduced motion.

#### Scenario: SCN-435a — Answering with the keyboard

- GIVEN the studio open on Questions with Q1 open
- WHEN the viewer moves with Tab to Q1's answer, types it and presses Enter
- THEN the answer is saved, the focus stays on Q1, and a notice is announced once

<!-- specgate:trace actor=Developer feature=features/studio/REQ-435.feature kind=functional status=Implemented -->

### Requirement: REQ-436 — The studio is tested in a browser on the three systems

The repository SHALL test the studio in a real browser on Windows, macOS and Linux in CI, against a project made for the test: opening each section, answering a question, confirming it, approving a draft, choosing an agent, and following a run in Live.

#### Scenario: SCN-436a — The studio's journey in CI

- GIVEN the CI workflow on Windows, macOS and Linux
- WHEN its browser tests run
- THEN each section opens without a script error and the journey from an open question to a run in Live passes

<!-- specgate:trace actor=Developer feature=features/studio/REQ-436.feature kind=functional status=Implemented -->

### Requirement: REQ-437 — A module written under a plain heading stays one section

The system SHALL, when the studio saves the brief form, write a module whose brief has no `## Module: <name>` section but a plain `## <name>` heading for a module the front matter lists as that module's `## Module: <name>` section in the heading's place, keeping the heading's prose inside it, so the brief holds one section for the module; and SHALL leave a plain heading that names no listed module as it is.

#### Scenario: SCN-437a — A hand-written module section is kept as the module's

- GIVEN `docs/brief.md` listing `modules: [orders]`, with a `## Context` section and a `## orders` section whose prose says "Shipping is free above some amount."
- WHEN the form is saved with the rule "An order has at least one item" for orders
- THEN the brief has one `## Module: orders` section holding that prose and the rule, no `## orders` heading, and the `## Context` section unchanged

<!-- specgate:trace actor=Developer feature=features/studio/REQ-437.feature kind=functional status=Implemented -->

### Requirement: REQ-438 — The studio runs the commands it offers, and only those

The system SHALL let the studio run a Specgate command only from a fixed list of actions, each naming the command it runs and the arguments it accepts, checked before anything runs; SHALL refuse any other action or argument, even with the page's token; SHALL run one such command at a time, in the project folder, keeping its output in the git-ignored events folder; and SHALL show that output as it grows and say, when it ends, whether it succeeded.

#### Scenario: SCN-438a — An offered command runs, anything else is refused

- GIVEN a studio open on a project with the change `draft-orders`
- WHEN the page asks to preview archiving `draft-orders`, and then to run `rm -rf .` and to archive a change id with `../` in it
- THEN the preview runs `specgate archive draft-orders --dry-run` and its output is shown, and the other two are refused, naming why, and run nothing

<!-- specgate:trace actor=Developer feature=features/studio/REQ-438.feature kind=functional status=Implemented -->

### Requirement: REQ-439 — Every change, from proposal to archive

The system SHALL list in the studio's Changes every open change with its task progress — not only the brief's drafts — and open each into its proposal, its deltas and its tasks; SHALL validate a change and show each finding; SHALL archive a change only once every requirement in it is delivered, after showing what the archive would write; and SHALL open a new change from an idea, or from a ticket key when an ALM is configured.

#### Scenario: SCN-439a — A delivered change archived from the studio

- GIVEN the change `checkout` with every requirement Implemented, and the change `orders` with one still Draft
- WHEN Changes is opened
- THEN both are listed with their progress, `checkout` offers Archive with its preview and `orders` does not, and archiving `checkout` moves it to the archive

<!-- specgate:trace actor=Developer feature=features/studio/REQ-439.feature kind=functional status=Implemented -->

### Requirement: REQ-440 — The gate and the doctor from the studio

The system SHALL run `specgate check` from the studio with the project's test command and show each stage — specification, tests, architecture, quality — passed or failed with its findings; and SHALL run `specgate doctor` and show each finding with the fix it ships.

#### Scenario: SCN-440a — The gate fails on a test, and says so

- GIVEN a project whose test command fails
- WHEN the gate is run from the studio
- THEN Specification is shown passed, Tests failed with the command's output, and the gate as not passed

<!-- specgate:trace actor=Developer feature=features/studio/REQ-440.feature kind=functional status=Implemented -->

### Requirement: REQ-441 — A requirement coded by hand, delivered from the studio

The system SHALL offer, for a requirement that is not delivered, to deliver it with `specgate apply`: its test first, then the gate, then Implemented; and SHALL show, when apply refuses, the reason and the step it stopped at.

#### Scenario: SCN-441a — Apply refused because no test names the requirement

- GIVEN REQ-001 with no test that names it
- WHEN it is delivered from the studio
- THEN it stays Draft, and the studio says no test names REQ-001 yet

<!-- specgate:trace actor=Developer feature=features/studio/REQ-441.feature kind=functional status=Implemented -->

### Requirement: REQ-442 — The project's preferences and the agents, in Settings

The system SHALL show in Settings the project's preferences as `specgate config list` gives them and let each be changed with `config set`, checked against the keys and values Specgate knows; and SHALL install the agent guards for this project — Claude Code's or OpenCode's, with `agents init --tool claude-plugin` or `--tool opencode-plugin`, never `agents install`, which installs them for every project of the user — and the integrations for the agent tools with `agents init`, saying what each wrote.

#### Scenario: SCN-442a — The test command changed in Settings

- GIVEN a project whose `test_cmd` is `npm test`
- WHEN Settings sets it to `npm run test:unit`
- THEN `specgate config get test_cmd` answers `npm run test:unit`, and an unknown key is refused

<!-- specgate:trace actor=Developer feature=features/studio/REQ-442.feature kind=functional status=Implemented -->

### Requirement: REQ-443 — A repository that has code, adopted from the studio

The system SHALL offer, in a folder with files and no Specgate project, to adopt it in place with `specgate adopt`: first a preview of every file it would write, then the adoption, which writes those files, overwrites none and changes no other.

#### Scenario: SCN-443a — Adopting a repository with a README and code

- GIVEN a folder with a README.md and src/index.js and no spec.md
- WHEN Settings previews the adoption and then adopts it
- THEN the preview lists spec.md among the files to write, and afterwards spec.md exists while README.md and src/index.js are unchanged

<!-- specgate:trace actor=Developer feature=features/studio/REQ-443.feature kind=functional status=Implemented -->

### Requirement: REQ-444 — Jira and Azure Boards from the studio

The system SHALL show in Settings, when `alm.config.yaml` exists, the requirement ↔ issue mapping as `specgate alm status` gives it, a sync previewed with `alm sync --dry-run`, and the sync itself; and SHALL never ask for, show or store the ALM token, which stays in the environment variable the config names.

#### Scenario: SCN-444a — A sync previewed, then run

- GIVEN `alm.config.yaml` naming `JIRA_TOKEN`, and REQ-007 not linked to an issue
- WHEN the sync is previewed
- THEN the preview says an issue would be created for REQ-007, nothing is written, and no field asks for a token

<!-- specgate:trace actor=Developer feature=features/studio/REQ-444.feature kind=functional status=Implemented -->

### Requirement: REQ-445 — A studio already running is found, not fought

The system SHALL, when the studio's port is taken, ask what answers there: when it is a studio of the same project, say it is already running with its address and its process id and end without an error; when it is anything else and no `--port` was given, serve on the next free port among the ten that follow and say which; and when `--port` named the port, refuse naming what holds it.

#### Scenario: SCN-445a — The same project's studio is already running

- GIVEN a studio of the project serving on port 4173
- WHEN `specgate studio` is run again in that project
- THEN it says a studio of this project is already running at http://localhost:4173 with that studio's process id, ends with exit code 0, and starts no second server

<!-- specgate:trace actor=Developer feature=features/studio/REQ-445.feature kind=functional status=Implemented -->

