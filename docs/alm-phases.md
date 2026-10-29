# The board follows the change

A ticket on the board moves as its change does, what product writes on the
ticket comes back to the change, and a change across repositories gets one
sub-issue per repository. The spec stays the contract
([ADR-0021](specs/adr/0021-alm-is-a-mirror.md)): the board is told where a
change stands, and never decides it.

## Which ticket

A change is on the board when its `change.yaml` names a ticket:
`ticket: FLEET-12` (written by `specgate propose --from-ticket`) or
`origin: alm:FLEET-12` (written by `specgate alm pull`). A project whose
tickets are the source sets `mirror: false` in `alm.config.yaml`, so
`alm sync` does not also create an issue per requirement.

## The phases

| Phase | When | Jira | Azure Boards | GitHub | Linear |
| --- | --- | --- | --- | --- | --- |
| `proposed` | the change is open and nothing is built | a "To Do" status | `New` | label `specgate:proposed` | an unstarted state |
| `building` | one of its requirements has a `harness/REQ-NNN` branch, or is Implemented | an "In Progress" status | `Active` | label `specgate:building` | a started state |
| `archived` | `specgate archive` moved it | a "Done" status | `done_state` (`Done`) | closed, completed | a completed state |

A board with its own words names them:

```yaml
phases:
  proposed: Backlog
  building: Doing
  archived: Shipped
```

`specgate alm sync` moves each change's ticket to its phase. What it told the
board is kept in `.specops/alm-phases.json` (commit it): a move already made is
not made again, so running it on every merge costs one request per change that
moved. `--dry-run` prints `would-move alerts FLEET-12 → Doing` and sends
nothing.

## What the ticket gains

`specgate alm pull` brings back, for each open change with a ticket, the
comments it has not brought before and — when the description changed since the
last pull — a note saying so with the new text. They land in the change's
`review.md`, the same rows as `specgate change note`, for a person to fold into
the proposal or the delta. Nothing is rewritten. The first pull of a ticket
records its description and comes back with its comments. Azure Boards'
comments are a preview API and are not read; the pull says so.

## One sub-issue per repository

A change that spans repositories lists them:

```yaml
ticket: FLEET-20
repositories: [fleet, tracking, web]
```

`alm sync` creates one sub-issue of FLEET-20 per repository —
`FLEET-20 — tracking: follow-shipment` — and records it, so none is created
twice: a Jira sub-task (`subtask_type`, "Sub-task" by default), an Azure Boards
child work item, a GitHub sub-issue, a Linear sub-issue.

## For an agent

```bash
specgate alm phase alerts --json      # {"phase": {"phase": "building", "ticket": "FLEET-12", "state": null, …}}
specgate alm move alerts --json       # moves FLEET-12 to the building state now
specgate alm move alerts archived     # or to the phase named
```

`alm phase` reads the repository and `.specops/alm-phases.json`, never the
network. Both are MCP tools: `specgate_alm_phase` and `specgate_alm_move`
([MCP](mcp.md)).

## Linear

```yaml
alm_version: 1
provider: linear
team_key: ENG
token_env: LINEAR_API_KEY
```

The key is a personal API key, sent in `Authorization` as Linear expects and
never written to the file. Issues are addressed by their identifier (`ENG-123`);
a cancelled issue reads as open, since nobody delivered it.

## Next

- [Jira, Azure Boards, GitHub and Linear](alm.md)
- [From a Jira ticket](from-a-ticket.md)
