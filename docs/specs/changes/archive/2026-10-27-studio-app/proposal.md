# Proposal: studio-app

## Intent

Specgate asked a person to learn its commands to take a brief to a delivered app. Studio showed the project and the harness at work but could not act.

## Scope

In scope:

- Studio at its root as an app: Home, Questions, Review and Build, simple and advanced modes, Spanish and English (REQ-204, REQ-205, REQ-210).
- `specgate change approve` and `specgate change note`, which Review runs (REQ-206, REQ-207).
- Build starting and stopping the harness (REQ-208, REQ-209).

Out of scope:

- Editing the brief, the requirements list and the settings from the app: the next version.
- Sending a note to the agent to rewrite the draft: notes are kept in review.md for whoever rewrites it.

## Approach

Every read is built from what the commands read and every write runs the code the command runs, through POST with the page token of REQ-201.
