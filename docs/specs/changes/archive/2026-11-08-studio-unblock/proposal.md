# Proposal: studio-unblock

## Intent

A person using the studio on a forja project (specgate 0.27.10, Windows,
2026-11-08) could not get past the first draft:

- Answering a question in the studio said "Saved" and changed nothing: the
  drafting guide writes `questions.md` with four columns and no `Answer`
  column, and the answer is written only into a column that exists. The
  person answered by hand, adding the column.
- The list of answers to confirm grew a row per click, one "it is in the
  spec" emptied them all, the next click failed with 422, and every action
  and every five-second refresh spawned `specgate status` on a
  single-threaded server — seconds per action on Windows.
- "Approve the draft" stayed disabled forever: a question stayed open, and a
  question answered by hand had no action in the studio to clear it.
- Build always said the agent was not configured: forja never configures one,
  the studio detects `claude` on the PATH but does not offer it, and its hint
  names a command that does not write it.

Nothing of this was fixed after 0.27.10.

## Scope

In scope:

- Answers written whatever columns the table has; the drafting guide's table
  with `Answer` and `Status`; one way to read an answer for the studio and the
  CLI; `questions.md` line endings kept.
- One answer to confirm per question; confirming lifts the question's
  `Needs Clarification`, for answers given by hand too.
- Every blocker of an approval named with the action that clears it; question
  ids matched exactly (Q1 is not Q10).
- The agent chosen from the studio, the installed ones offered; `{prompt_file}`
  quoted for paths with spaces; the hint corrected.
- Reads without spawning the CLI; a button busy while its request is in
  flight; a failed read shown with a retry; no redraw when nothing changed.

Out of scope:

- The new design and the missing CLI features in the studio: phases 2 and 3.
- forja: its pin and its postinstall are changed in forja itself.

## Approach

`Clarification.ts` gains the columns it needs before writing; the drafting
guide's template carries them. The studio's answer and review actions key on
the question. `approvalBlockers` returns each blocker with an action. A new
token-guarded `POST /api/agent` writes the profile or `agent:`. Status is read
in-process with a cache keyed on the spec files' modification times.
