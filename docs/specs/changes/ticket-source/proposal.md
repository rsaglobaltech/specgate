# Proposal: ticket-source

## Intent

In a large organisation the work is described in Jira, not in a brief: a
business analyst writes each story with a description and acceptance criteria,
often in Given/When/Then, and will not write a second document. Specgate reads
such a board only through `alm pull`, which leaves the scenarios empty — and
which stopped working, because Atlassian removed the search endpoint it calls.
Tokens created with scopes, the kind Atlassian now issues, are refused too.
And nothing ties the change to the branch and the pull request the board shows.

Decision record: [ADR-0039](../../adr/0039-the-ticket-as-source-text.md),
amending ADR-0021. Tested against a Jira Cloud site with 65 stories in 9 epics.

## Scope

In scope:

- Jira search through `/rest/api/3/search/jql`, page by page (REQ-143).
- Scoped tokens through the Atlassian gateway, `cloud_id: auto` (REQ-144).
- A ticket read into its parts, from Jira or an exported issue (REQ-145).
- `propose --from-ticket <KEY> --check`: the Definition of Ready, T1–T9 (REQ-146).
- `propose --from-ticket <KEY>`: the change, its `ticket.md`, the capability
  from the epic, the drafting guide, the D-checklist against the ticket (REQ-147).
- The ticket key in the branch and the commits, and `ticket_changed` (REQ-148).
- `alm pr <change>`: one pull request per ticket on GitHub (REQ-149).
- The page "From a Jira ticket", the help and the changelog (REQ-150).

Out of scope:

- Writing anything to Jira: comments, transitions, fields.
- Merging a pull request, or deciding whether a criterion is right.
- Git hosts other than GitHub, and agentkit's `ticket` command.

## Approach

The ticket takes the brief's place. Its copy, `ticket.md`, is the text the
draft is checked against, so everything that keeps a draft honest to a brief —
the D-checklist, D6 above all, the confined agent, the review before archive —
keeps it honest to the ticket.
