# Delta — docs-site

## ADDED Requirements

### Requirement: REQ-762 — The landing page shows the agent without and with the gate

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL show, in the first screen of `docs/index.html`, a figure of an agent without Specgate and one with it, each with the measured share of exam runs that met the specification — from the replication on the released version: 44% (16 of 36) without, 92% (33 of 36) with, and its p-value, below 0.001.

#### Scenario: SCN-762a — The first screen

- GIVEN the landing page as published
- WHEN a reader opens it
- THEN before any other section it shows "Without Specgate" with 44% (16 of 36) and "With Specgate" with 92% (33 of 36) and p < 0.001

### Requirement: REQ-763 — The landing page shows where each control runs

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL show on `docs/index.html` a figure of the trust boundary — the guard and the gate inside the agent's session, the person and the outside judge outside it — and a figure of the guard's decision on one tool call, each a `<figure>` whose drawing has `role="img"` and an `aria-label`, and a `<figcaption>`.

#### Scenario: SCN-763a — Named figures

- GIVEN the landing page as published
- WHEN a screen reader reads it
- THEN it finds a figure named for the trust boundary that names the outside judge, and one named for the guard's decision

### Requirement: REQ-764 — The landing page lists the nine controls and what agents tried

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL list on `docs/index.html` and `docs/es/index.html` the controls C1 to C9, each with what it refuses and, where the exam saw one, what an agent tried against it.

#### Scenario: SCN-764a — Both languages

- GIVEN the two landing pages as published
- WHEN a reader looks for the controls
- THEN each page lists C1 to C9, and the Spanish one in Spanish
