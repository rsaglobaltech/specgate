# Delta — studio-ticket

## ADDED Requirements

### Requirement: REQ-446 — A ticket reviewed before its change is opened

The system SHALL, when the studio is given a ticket key to open a change from, first run `specgate propose --from-ticket <KEY> --check --json` and show whether the ticket is ready, each finding with its fix, and the capability the change will go into; SHALL, when there is no capability, offer the project's capabilities to choose from and open the change in the chosen one with `--capability`; and SHALL not open a change for a ticket that is not ready.

#### Scenario: SCN-446a — A story without an epic

- GIVEN a project with the capabilities `billing` and `orders`, and the story PAY-123, ready, with no epic
- WHEN PAY-123 is reviewed in the studio
- THEN it is shown ready, with no capability, `billing` and `orders` offered, and opening it in `orders` runs `propose --from-ticket PAY-123 --capability orders`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-447 — The ticket's branch, known before the change is opened

The system SHALL read the branch the project is on and, when it names a ticket — `<feature|bugfix|hotfix>/<KEY>` or `<feature|bugfix|hotfix>/<team>/<KEY>`, as `check` reads it — show on Home the ticket and the team; SHALL open a change for that ticket on that branch with `--no-branch`, and otherwise name the branch it will create; and SHALL show in Changes the ticket of a change opened from one, linked to it when `alm.config.yaml` names the ALM's address.

#### Scenario: SCN-447a — On the branch agentkit made

- GIVEN a project on the branch `feature/parking/KAN-13`
- WHEN Home is opened, and KAN-13 is then opened from Changes
- THEN Home says the branch is KAN-13's, of the team parking, and the change is opened on `feature/parking/KAN-13` with `--no-branch`, no other branch created

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-448 — Publishing a ticket's change, said and confirmed

The system SHALL say, before a ticket's change is opened, that it will commit the change's folder and nothing else, naming the branch, and push that branch; SHALL open it only once the person confirms; and SHALL, when "Don't push yet" is chosen, open it with `--no-push`.

#### Scenario: SCN-448a — Opened without pushing

- GIVEN KAN-13 reviewed and ready on `feature/parking/KAN-13`
- WHEN it is opened with "Don't push yet" and confirmed
- THEN the command run is `propose --from-ticket KAN-13 --no-branch --no-push`, the branch holds the change's commit, and nothing was pushed

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
