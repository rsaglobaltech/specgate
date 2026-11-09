# Proposal: studio-review-redraft

## Intent

In the studio, **Ask for a change** under a draft's requirement appends the
request to the change's `review.md` (REQ-212) and says "done". Nothing ever
reads that file: the agent that drafts does not see it, there is no way to
draft again with it, and approving ignores it. A person who asks for a change
sees a success notice and the same requirement as before — the notice tells
them something happened that did not.

## Scope

In scope:

- **The note says what it did**: the notice says the request was noted in
  `review.md` and that the draft changes only when it is drafted again with
  the notes; each note shows whether it is open or was addressed.
- **Draft again with the notes**: one action hands the draft back to the
  agent with its open notes, each tied to its requirement, inside the
  draft's guide (`DRAFTING.md`, "Changes the reviewer asked for"); the agent
  edits the draft, it does not start over. The same holds in the terminal:
  `specgate propose --from-brief <module>` puts the open notes in the guide.
  When the draft is checked again, each note it was given is marked
  addressed, and the studio shows the requirement before and after.
- **Approving with open notes is said**: approving a draft with notes still
  open says how many and which; it asks before approving.

Out of scope:

- Notes on a change that is not a brief's draft (a ticket's or an idea's).
- The agent deciding a note should not be followed: it writes why in the
  note's row, and the person decides.

## Approach

`review.md` keeps its table and gains a `Status` column (open / addressed,
with the date), read as before when the column is missing. The drafting
guide reads the open notes; `propose --from-brief` records which notes the
run was given, and its check marks them addressed. The studio offers
**Draft again with N requested changes** beside the notes, runs the same
background draft job (REQ-216), and keeps the requirement's text from
before the run to show the difference. Spanish and English, keyboard, the
browser journey extended.
