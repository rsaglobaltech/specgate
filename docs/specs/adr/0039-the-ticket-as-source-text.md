# ADR-0039 — The ticket as source text

## Status

Accepted — 2026-10-20. Amends [ADR-0021](0021-alm-is-a-mirror.md), clause 4.

## Context

ADR-0021 says the ALM is a mirror, and it gives a reason for leaving the
scenarios of a pulled ticket empty: "a Jira ticket does not contain an
executable acceptance criterion." For the boards that ADR had in mind, that was
true. For the boards of large organisations it is often false. In those
organisations a business analyst writes every story with a description and a
list of acceptance criteria, often already in Given/When/Then, and gets them
reviewed before a sprint takes the story. Under a heading such as "Acceptance
Criteria", "Akzeptanzkriterien" or "Criterios de aceptación", the ticket holds
exactly what a scenario needs. The analyst will not write a brief as well.

The first test against a real Jira Cloud site (65 stories in 9 epics) found
three more problems:

- `alm pull` no longer works. It calls `/rest/api/3/search`, which Atlassian
  removed (HTTP 410). Its replacement is `/rest/api/3/search/jql`.
- A token created with scopes only authenticates through
  `https://api.atlassian.com/ex/jira/<cloudId>`. Atlassian steers new tokens
  that way, and the site URL refuses them with `AUTHENTICATED_FAILED`.
- Nothing connects the change to the repository. A team that links Jira to its
  Git host sees a ticket's branch, commits and pull request in the ticket, but
  only when they carry the ticket key.

## Decision

**A ticket with acceptance criteria is source text, as a brief is (ADR-0038).**

1. **The ticket enters as a change, as before.** `specgate propose
   --from-ticket <KEY>` opens one change per ticket and copies the ticket into
   it, unedited, as `ticket.md`. The change records the copy's SHA-256.
   `ticket.md` takes the brief's place: the D-checklist runs against it, so D6
   refuses every value the ticket does not state. If `ticket.md` is edited
   later, the checklist refuses the draft.

2. **The scenarios are drafted from the criteria, not left empty.** Each
   criterion is quoted, and a person reviews the draft before it is archived,
   as with a module of the brief. A ticket that has no criteria still opens
   nothing. It fails the Definition of Ready (`ticket_no_criteria`), and the
   analyst gets the fix to write in Jira.

3. **The board is still a mirror.** Jira is only read. Specgate never writes a
   comment, a transition or a field there. Traceability back to the board comes
   from the ticket key in the branch name, the commit messages and the pull
   request title, which the Git host's own Jira integration shows in the ticket.

4. **The pull request belongs to the repository, not the ALM.** `specgate alm
   pr` opens or updates one pull request per ticket on the Git host. The code
   lives outside the ALM port, which still only creates, reads, closes and
   lists issues.

5. **Credentials stay out of files.** `alm.config.yaml` names environment
   variables only. JQL is pinned to the configured project, and the text of a
   ticket is treated as untrusted. It is quoted to the agent, never executed,
   and the agent runs confined to the change.

## Consequences

- A team whose analysts already write criteria can use the gate without new
  documents. A team whose analysts do not now has a check (T1–T9) that tells
  them what is missing, in their own tool's words.
- The brief stays the source text for new products. The ticket is the source
  text for products that already exist and are run from a board. For the gate
  both are the same thing: text a draft is checked against.
- The spec of a large system grows one ticket at a time, in the capability its
  epic maps to. What no ticket touches never needs a spec.
- The ticket can change after the draft. `propose --from-ticket <KEY> --check`
  reports `ticket_changed` with the difference from `ticket.md`, so the copy
  remains the record of what was agreed.

## Alternatives considered

**A custom field per criterion, synced both ways.** This makes Jira a second
writer of the contract, which ADR-0021 rejected for good reasons.

**Leave the scenarios empty, as `alm pull` does.** The criteria are already
written. Asking a developer to retype them invites drift between the ticket and
the spec, which is the problem the gate exists to remove.

**Read tickets through an MCP server.** This needs an Atlassian administrator
to enable it, and it is not available on every plan. A read-only REST call with
a scoped token works everywhere, and an exported issue (`--from-ticket
issue.json`) works offline.
