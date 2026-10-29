# Proposal: run7-a

## Intent

Two findings of the seventh truck-flote run.

- S60: D6 read `at 2026-10-29 10:00:00` as the numbers "29", "00" and so on, and the agent had to list each
  fragment in `assumptions.md` before the draft could be reviewed.
- S62: `status` suggests `config set agent "claude -p < {prompt_file}"`, and the studio's live view then shows
  the gate but nothing of the agent: its output reaches `/live` only through
  `--output-format stream-json --verbose … | specgate harness events --from claude`.

## Scope

- D6 reads an ISO date, a time and a date-time as one value each (REQ-277). The unnamed test that read
  `07:42` as "07" and "42" now reads it as "07:42": that was the behaviour this requirement changes.
- `config set agent` writes a bare Claude Code print command streamed into `specgate harness events`, so
  the live view shows the agent (REQ-278, and REQ-271's scenario says what is written).
