# Delta — steering

## ADDED Requirements

### Requirement: REQ-684 — The lessons that keep coming back

<!-- specgate:trace status=Implemented feature=features/steering/REQ-684.feature actor=Developer kind=functional -->

The system SHALL, on `specgate learn [--json]`, list the lessons that repeat: review notes alike — sharing at least 60 % of their significant words — in two changes or more, open or archived, as a lesson `review` with each note, its change and its date; and a stage of the gate the harness failed in three attempts or more over two requirements or more, as a lesson `harness` with the stage and the requirements; each lesson numbered `L1`, `L2`… from the most repeated, with the command that proposes it as a rule.

> Phase 4 of the trust curve: a review comment that keeps coming back becomes a rule.

#### Scenario: SCN-684a — The same note in two drafts

- GIVEN draft-pedidos with the review note "Prices always with their currency, never a bare number" and draft-pagos with "Show every price with its currency, not a bare number"
- WHEN the Developer runs `specgate learn --json`
- THEN L1 is a lesson `review` with both notes and their changes, and its next command is `specgate learn promote L1 --title "<rule>"`

#### Scenario: SCN-684b — The agent keeps failing the architecture check

- GIVEN harness events where the stage `architecture` failed in two attempts of REQ-040 and one of REQ-041
- WHEN the Developer runs `specgate learn --json`
- THEN a lesson `harness` names the stage `architecture`, 3 failures and REQ-040 and REQ-041

### Requirement: REQ-685 — A lesson becomes a principle through an approved change

<!-- specgate:trace status=Implemented feature=features/steering/REQ-685.feature actor=Developer kind=functional -->

The system SHALL, on `specgate learn promote <L> --title "<rule>" [--forbid "<regex>" --in "<glob>" | --run "<command>"] [--level warn]`, open the change `learn-<the title in kebab case>` with the lesson's evidence in its Discover and no delta; and, once a person approves its three layers, SHALL append the rule to `docs/specs/principles.md` as `## P<next> — <title>` — with its `specgate:principle` comment when it is a barrier, as prose when it is an instruction —, creating the file at `principles_version: 1.0.0` when there is none; and SHALL write nothing to principles.md before that approval.

#### Scenario: SCN-685a — A barrier, once approved

- GIVEN the lesson L1 of SCN-684a
- WHEN the Developer runs `specgate learn promote L1 --title "Prices carry their currency" --forbid "price:\s*\d" --in "src/**"`, and a person approves the change learn-prices-carry-their-currency
- THEN principles.md has `## P1 — Prices carry their currency` with `forbid="price:\s*\d" in="src/**"`, and before the approval it had no such principle

#### Scenario: SCN-685b — An instruction

- GIVEN the lesson L1 of SCN-684a
- WHEN the Developer promotes it with only `--title "Prices carry their currency"` and the change is approved
- THEN principles.md has `## P1 — Prices carry their currency` with no `specgate:principle` comment
