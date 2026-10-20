# Design: ticket-source

## Technical approach

Reading stays in `scripts/alm/`: the Jira provider gains `readIssue(key)` and a
paged `listIssues`, and an API base that is either the site or the Atlassian
gateway. A pure module in core, `TicketText`, turns an issue — Atlassian
Document Format or plain text — into its parts (intent, source, criteria,
questions, type, parent) and runs T1–T9 over them.

Writing stays in the change lifecycle, as `alm pull` already does:
`TicketCommand` (behind `propose --from-ticket`) opens the change and writes
`ticket.md`, `proposal.md`, `questions.md`, `DRAFTING.md` and the delta. The
change's `change.yaml` names `ticket.md` as its `brief:`, so `draftReport`, the
D-checklist and `archive`'s refusal of an unready draft work unchanged.

The pull request lives in `scripts/vcs/`, outside the ALM port (ADR-0039 §4).

## Decisions

### Decision: the copy is the contract, not the board

`ticket.md` is written once, with its SHA-256 in `change.yaml`. The checklist
refuses a draft whose copy was edited; a ticket edited on the board is a
`ticket_changed` finding with the difference, never a silent update.

### Decision: the epic picks the capability

`alm.config.yaml` maps epics to capabilities (`epics: { KAN-5: entry-exit }`).
A story whose epic is not mapped asks for `--capability <name>`: guessing a
capability from a title would put requirements where nobody looks for them.

### Decision: no Smart Commits

The commit message Specgate proposes is `KAN-13 REQ-150: <summary>`. Smart
Commit commands (`#comment`, `#done`) write to Jira and are never generated.

### Decision: an exported issue works offline

`--from-ticket issue.json` reads Jira's own issue JSON. Tests, air-gapped
teams and the first try-out need no credentials.

## Affected files

- `scripts/alm/providers/jira.ts`, `http-client.ts`, `port.ts`
- `packages/core/src/domain/TicketText.ts` (new)
- `scripts/cli/commands/change/TicketCommand.ts` (new), `scripts/propose.ts`
- `scripts/vcs/github-pr.ts` (new), `scripts/alm/cli.ts`
- `docs/from-a-ticket.md` (new), `docs/commands.md`, `CHANGELOG.md`
