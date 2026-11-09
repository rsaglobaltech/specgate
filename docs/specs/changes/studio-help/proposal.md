# Proposal: studio-help

## Intent

The studio's buttons write files, run `specgate` and the agent, commit and
push; most say none of it. "Ask for a change" said "done" while it only
appended a line to `review.md` that nothing reads (see
`studio-review-redraft`). A person must be able to know, at any moment, what
a feature does in the background before pressing it, and what it did after.

## Scope

In scope:

- **A "?" beside each feature**: a small round button next to every action
  that writes, runs, commits, pushes or sends. Pressed, it opens a short
  explanation: what it does, the command it runs, the files it changes, what
  it does not do, and what comes next. Keyboard and screen reader: a real
  button, `aria-expanded`, Escape closes it, the focus returns to the "?".
  In Spanish and English, in the studio's tokens, light and dark.
- **Notices that say what happened**: an action's notice names what it wrote
  or ran and the next step — never a bare "done".
- **No feature without its explanation**: every action the studio runs
  (REQ-438) and every write endpoint has its explanation in both languages;
  a test fails when one is missing, so a new feature cannot ship without it.

Out of scope:

- A guided tour or an onboarding flow.
- Help for the CLI (its `--help` stays as it is).

## Approach

One table of explanations, keyed by action, each with `does`, `runs`,
`writes`, `not` and `next`, in both languages. A `Help` component renders
the "?" and its popover; sections place it beside their buttons. Notices
take their text from the same table, with the real outcome filled in. A unit
test walks the action list and the write endpoints against the table; the
browser journey opens one "?" with the keyboard.
