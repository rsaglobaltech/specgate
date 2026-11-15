# Proposal: studio-ticket

## Intent

With #375, `specgate propose --from-ticket` knows a team's branch
(`feature/<team>/<KEY>`, the way agentkit names it), can open the change on a
branch another tool made (`--no-branch`), says before anything exists which
capability the change will go into (`--check`), and **commits the change's
folder and pushes the branch** so the team sees the reservation. The studio
already offers "From a ticket", but runs the bare command: it checks nothing
first, cannot choose the capability, does not know the branch it is on, and
would now push to the remote without saying so.

## Scope

In scope:

- **Review the ticket before opening its change**: `--check --json` read and
  shown — ready or not, each finding, and the capability the change will go
  into; with none, the project's capabilities to choose from (`--capability`).
- **The ticket's branch, known before opening**: when the branch the project
  is on names the ticket — a team's branch included — the change is opened on
  it (`--no-branch`); otherwise the studio names the branch it will create.
  Home says which ticket and team the branch is for; Changes shows each
  change's ticket, linked to it when an ALM is configured.
- **Publishing said and confirmed**: before opening, the studio says it will
  commit only the change's folder and push the branch, and asks to confirm;
  "Don't push yet" opens it with `--no-push`. Pushing is the default, as in
  the CLI.

Out of scope:

- Creating a ticket, or editing it in the ALM.
- The team's branch convention itself (agentkit's setup owns it).

## Approach

The actions the studio may run (REQ-438) gain checked arguments: an existing
capability, `noBranch`, `noPush` and the check. The command's JSON is read
from its standard output, kept apart from its prose. A read endpoint gives
the current branch and the ticket and team it names, with the same pattern
`check` uses (REQ-170). The new studio's Changes keeps its form; "From a
ticket" becomes review → choose → confirm. Spanish and English, keyboard, the
browser journey extended against a mock Jira.
