# Proposal: ticket-branch-push

## Intent

Testing on a real board: a team that moves tickets with Jira Automation —
"branch created → In Progress", "pull request created → In Review" — only
sees the branch once it is on the Git host. The branch `propose --from-ticket`
created stayed local until the first `alm pr`, so the ticket did not move when
work started.

Specgate still writes nothing to Jira (ADR-0039 §3): the board moves itself,
from what the Git host tells it.

## Scope

In scope: push the ticket's branch when it is created (REQ-148, modified),
`--no-push`, and the page.

Out of scope: transitions written by Specgate.
