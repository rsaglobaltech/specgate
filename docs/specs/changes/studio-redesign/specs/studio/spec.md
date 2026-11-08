# Delta — studio

## MODIFIED Requirements

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

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

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

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

## ADDED Requirements

### Requirement: REQ-432 — The studio is built from typed source and carries no runtime dependency

The studio's page SHALL be built from typed source at build time into static files Specgate serves from its own package; installing Specgate SHALL add no runtime dependency; and the page SHALL work without a network beyond the studio itself.

#### Scenario: SCN-432a — What the package ships

- GIVEN Specgate built and packed
- WHEN its package is read
- THEN it holds the studio's script and styles, its `dependencies` are empty, and the page loads nothing from another host

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-433 — Live is a section of the studio

The system SHALL show, in the studio's Live section, the run in progress — the requirement, its stages (codes, tests, checks quality, saves) with the current one marked, its log as it streams, the queue, the time and the cost so far — updated through server-sent events without reloading; SHALL let the viewer answer there a question the agent asked and stop the run after the current requirement or at once; and `/live` SHALL open that section.

#### Scenario: SCN-433a — A run followed live

- GIVEN a harness run on REQ-025 in its tests stage
- WHEN the Live section is open and the run writes a test result
- THEN the result appears in the log without a reload, Tests is the current stage, and REQ-026 is listed as queued

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-434 — The studio says what it is doing and what went wrong

The studio SHALL show the shape of a section while its first read is under way; SHALL mark a button busy, refusing a second press, while its request runs, and then say in a notice what happened; SHALL keep a notice that reports a failure until it is closed, with the action that retries; SHALL say when it cannot reach the studio's server and when it reaches it again, keeping what it showed marked as possibly old; and SHALL show a failed read inside its own section, the rest of the page still usable.

#### Scenario: SCN-434a — The server goes away and comes back

- GIVEN the studio open on Questions
- WHEN its server stops and starts again
- THEN the page says it is reconnecting, keeps the questions shown, and says it is connected once the server answers

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-435 — The studio is used with the keyboard and a screen reader

Every action of the studio SHALL be reachable and usable with the keyboard, with a visible focus; its sections, forms and notices SHALL carry the roles and names a screen reader announces; a refresh SHALL not announce the whole page again; and its motion SHALL stop when the system asks for reduced motion.

#### Scenario: SCN-435a — Answering with the keyboard

- GIVEN the studio open on Questions with Q1 open
- WHEN the viewer moves with Tab to Q1's answer, types it and presses Enter
- THEN the answer is saved, the focus stays on Q1, and a notice is announced once

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-436 — The studio is tested in a browser on the three systems

The repository SHALL test the studio in a real browser on Windows, macOS and Linux in CI, against a project made for the test: opening each section, answering a question, confirming it, approving a draft, choosing an agent, and following a run in Live.

#### Scenario: SCN-436a — The studio's journey in CI

- GIVEN the CI workflow on Windows, macOS and Linux
- WHEN its browser tests run
- THEN each section opens without a script error and the journey from an open question to a run in Live passes

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
