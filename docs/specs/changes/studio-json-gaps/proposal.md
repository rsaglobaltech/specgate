# Proposal: studio-json-gaps

## Intent

specgate-studio, a separate IDE, talks to specgate only through `--json` and
the `@rsaglobaltech/specgate/api` entry; it never parses specgate's prose or
Markdown. Building it found four places where what it needs has no JSON:

- A draft's review notes — the changes asked for in its `review.md` — are
  written by `change note` and read by nobody: `change show --json` does not
  give them, drafting again does not hand them to the agent, and nothing says
  whether one was addressed (studio REQ-082, REQ-083; the intent of the old
  studio's unmerged `studio-review-redraft`, REQ-449…451).
- The brief as a form lives only inside the old studio's server
  (`studio-route.ts`, REQ-214), with no line per field, and its save turns
  CRLF into LF, trims the end of the file and collapses blank lines in
  sections that are not the form's (studio REQ-071).
- Proposing a brief from a client's text kept outside the project leaves
  `docs/specs/BRIEF-SETUP.md` behind when the proposed front matter has
  problems, and answers no form (studio REQ-074).
- `adopt --dry-run` does not list README.md and .gitattributes, which
  `adopt --yes` writes.

## Scope

In scope:

- REQ-484: `change show --json` and the API's `change(dir, id)` give each
  review note with its id, text, requirement, state, file and line, and what
  changed once addressed.
- REQ-485: `propose --from-brief <module> --agent` hands the open notes to
  the agent, says which in its JSON, and marks addressed those it changed.
- REQ-486, REQ-487: `propose --from-brief --form [<file>|-]` reads and writes
  the brief as a form, each field with its line; the write keeps every other
  byte. One module, `BriefForm`, used by the CLI, the API and the old studio.
- REQ-488: `propose --from-brief --brief <outside> --agent --json` answers
  the proposed form and writes nothing inside the project.
- REQ-489: `adopt --dry-run` lists exactly the files `adopt --yes` writes.

Out of scope:

- The studio's screens: specgate-studio builds them on these answers.
- Approving a draft with notes still open (the old REQ-451): approval reads
  the checklist and the questions, as before.
- Notes on a change that is not a brief's draft (a ticket's or an idea's):
  `change show` gives them, nothing drafts them again.

## Approach

`review.md` keeps its table and gains a `Status` column — `open`, or
`addressed <date>` — read as `open` when the column is missing; what a redraft
changed is written below the table, one section per addressed note, with the
requirement's text before and after in fenced blocks. The brief form moves to
`packages/core/src/domain/BriefForm.ts`, pure over the text: it reads every
field with its line and writes back by splicing only the fields and sections
whose values changed, in the file's own line endings. `adopt --dry-run` asks
each writer what it would write instead of printing a fixed list.
