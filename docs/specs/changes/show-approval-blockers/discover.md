# Discover: show-approval-blockers

## Context

Specgate Studio lists a draft to review with an Approve button. When the draft
still has findings, `change approve` refuses with `approve_blocked` — after
the person pressed the button. The blockers exist (`approvalBlockers`), but
`change show --json` did not carry them (#538).

## Acceptance criteria

- AC-1: `change show --json` lists what blocks approval, each with its fix.
- AC-2: a change nothing blocks says so with an empty list.
