# Proposal: ticket-branch-given

## Intent

agentkit, the developer's front door, reads the Jira ticket and creates its branch the team's way, `feature/<team>/KAN-13`, across several repositories. It then hands the specification to Specgate with `propose --from-ticket <issue.json> --no-branch`. Two things break that today: Specgate does not read `feature/<team>/KAN-13` as KAN-13's branch, so `check` stops asking commits for the key; and with `--no-branch` it commits nothing, so the requirement ids it reserved never reach the other developers (REQ-165).

## Scope

A team segment before the key is read as the ticket's branch wherever a ticket branch is read. With `--no-branch`, on a branch that already names the ticket, the opening is committed (only the change's folder) and pushed, as when Specgate creates the branch.

## Out of scope

Creating branches with a team segment: the branch Specgate creates stays `feature/<KEY>-<slug>`; a tool that wants another name creates it and passes `--no-branch`.
