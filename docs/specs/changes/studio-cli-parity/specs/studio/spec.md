# Delta — studio-cli-parity

## ADDED Requirements

### Requirement: REQ-438 — The studio runs the commands it offers, and only those

The system SHALL let the studio run a Specgate command only from a fixed list of actions, each naming the command it runs and the arguments it accepts, checked before anything runs; SHALL refuse any other action or argument, even with the page's token; SHALL run one such command at a time, in the project folder, keeping its output in the git-ignored events folder; and SHALL show that output as it grows and say, when it ends, whether it succeeded.

#### Scenario: SCN-438a — An offered command runs, anything else is refused

- GIVEN a studio open on a project with the change `draft-orders`
- WHEN the page asks to preview archiving `draft-orders`, and then to run `rm -rf .` and to archive a change id with `../` in it
- THEN the preview runs `specgate archive draft-orders --dry-run` and its output is shown, and the other two are refused, naming why, and run nothing

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-439 — Every change, from proposal to archive

The system SHALL list in the studio's Changes every open change with its task progress — not only the brief's drafts — and open each into its proposal, its deltas and its tasks; SHALL validate a change and show each finding; SHALL archive a change only once every requirement in it is delivered, after showing what the archive would write; and SHALL open a new change from an idea, or from a ticket key when an ALM is configured.

#### Scenario: SCN-439a — A delivered change archived from the studio

- GIVEN the change `checkout` with every requirement Implemented, and the change `orders` with one still Draft
- WHEN Changes is opened
- THEN both are listed with their progress, `checkout` offers Archive with its preview and `orders` does not, and archiving `checkout` moves it to the archive

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-440 — The gate and the doctor from the studio

The system SHALL run `specgate check` from the studio with the project's test command and show each stage — specification, tests, architecture, quality — passed or failed with its findings; and SHALL run `specgate doctor` and show each finding with the fix it ships.

#### Scenario: SCN-440a — The gate fails on a test, and says so

- GIVEN a project whose test command fails
- WHEN the gate is run from the studio
- THEN Specification is shown passed, Tests failed with the command's output, and the gate as not passed

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-441 — A requirement coded by hand, delivered from the studio

The system SHALL offer, for a requirement that is not delivered, to deliver it with `specgate apply`: its test first, then the gate, then Implemented; and SHALL show, when apply refuses, the reason and the step it stopped at.

#### Scenario: SCN-441a — Apply refused because no test names the requirement

- GIVEN REQ-001 with no test that names it
- WHEN it is delivered from the studio
- THEN it stays Draft, and the studio says no test names REQ-001 yet

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-442 — The project's preferences and the agents, in Settings

The system SHALL show in Settings the project's preferences as `specgate config list` gives them and let each be changed with `config set`, checked against the keys and values Specgate knows; and SHALL install the agent guards for the project with `agents install` and the integrations for the chosen agents with `agents init`, saying what each wrote.

#### Scenario: SCN-442a — The test command changed in Settings

- GIVEN a project whose `test_cmd` is `npm test`
- WHEN Settings sets it to `npm run test:unit`
- THEN `specgate config get test_cmd` answers `npm run test:unit`, and an unknown key is refused

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-443 — A repository that has code, adopted from the studio

The system SHALL offer, in a folder with files and no Specgate project, to adopt it: first a preview of every file `specgate init` would write, then the adoption, which writes those files and changes no other.

#### Scenario: SCN-443a — Adopting a repository with a README and code

- GIVEN a folder with a README.md and src/index.js and no spec.md
- WHEN Settings previews the adoption and then adopts it
- THEN the preview lists spec.md among the files to write, and afterwards spec.md exists while README.md and src/index.js are unchanged

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-444 — Jira and Azure Boards from the studio

The system SHALL show in Settings, when `alm.config.yaml` exists, the requirement ↔ issue mapping as `specgate alm status` gives it, a sync previewed with `alm sync --dry-run`, and the sync itself; and SHALL never ask for, show or store the ALM token, which stays in the environment variable the config names.

#### Scenario: SCN-444a — A sync previewed, then run

- GIVEN `alm.config.yaml` naming `JIRA_TOKEN`, and REQ-007 not linked to an issue
- WHEN the sync is previewed
- THEN the preview says an issue would be created for REQ-007, nothing is written, and no field asks for a token

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
