# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-251 — A brief at the root is pointed at

The system SHALL, when `docs/brief.md` lists no modules and a `brief.md` at the project's root holds text that `docs/brief.md` does not, say in `status` and `draft` that the root file looks like the brief and that its text goes below the front matter of `docs/brief.md`.

#### Scenario: SCN-251a — The client's brief pushed first, forja's template beside it

- GIVEN `brief.md` at the root with the client's text, and `docs/brief.md` with forja's front matter and template body
- WHEN `specgate status` and `specgate draft` run
- THEN both name `brief.md` at the root and `docs/brief.md` as where its text goes

<!-- specgate:trace status=Implemented test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-252 — An incomplete front matter is called incomplete

The system SHALL, when `draft` explains the four fields over a front matter that exists but needs fixes, say the front matter is incomplete, and say "no front matter yet" only when there is none.

#### Scenario: SCN-252a — forja's front matter, modules empty

- GIVEN forja's front matter with `modules: []`
- WHEN `specgate draft` runs
- THEN it says the front matter is incomplete and does not say "no front matter yet"

<!-- specgate:trace status=Implemented test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->

### Requirement: REQ-253 — The setup guide asks for the brief's own names

The system SHALL write in `BRIEF-SETUP.md` that each actor is named as the brief writes it, in the brief's language; that a brief has three to eight modules; and that, when `forja.config.json` lists the project's platforms, actors get only those surfaces, the others noted with `# check:`.

#### Scenario: SCN-253a — The guide an agent reads

- GIVEN any brief
- WHEN `specgate draft --agent` writes `docs/specs/BRIEF-SETUP.md`
- THEN it says to name actors as the brief writes them, in its language, three to eight modules, and only the surfaces `forja.config.json` lists

<!-- specgate:trace status=Implemented test=tests/unit/brief-cards.test.ts actor=Developer kind=functional -->
