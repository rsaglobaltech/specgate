# Proposal: studio-route

## Intent

The studio app (REQ-204..210) covers the middle of the path — questions,
review, build — and leaves the start and the end to the terminal: creating
the project, writing the brief, drafting each module, choosing which agent
works, and seeing what was delivered. A person who does not know the
commands cannot start a project from the studio, nor tell at the end what
the app now does and how it was proven.

## Scope

In scope:

- A route of seven steps — Project, Brief, Drafts, Questions, Review, Build,
  Report — each with its state read from the project's files, and one next
  action.
- A new project from an empty folder: name, kind, stack and agent, then
  `specgate init` and the harness configuration underneath.
- The brief as a form (product, who uses it, modules with rules, examples and
  questions) and as markdown, with the brief rules shown while it is written;
  pasting a client's text for the agent to structure.
- Drafting each module in the background with the agent chosen, its progress,
  and the draft checklist in plain words.
- Choosing the agent per run from `.harness/profiles.yaml`: `harness run
  --profile` and `propose --from-brief --profile`.
- A report of what was built: per module, each requirement with the example
  that proves it, what is missing, the decisions taken, cost and time,
  downloadable.

Out of scope:

- Editing profiles' commands from the page beyond the presets offered at
  project creation.
- Live token usage for agents other than Claude Code (`harness events --from`
  reads only its stream).
- Merging, opening pull requests or tagging from the studio.

## Approach

Each step reads what the CLI reads (`moduleStatus`, `checkBrief`, the draft
checklist, the live matrix, the harness runs) and each action runs the CLI
command that does it, in the background when an agent works, as REQ-208 does
for Build. The profiles become selectable per run, so the same choice works in
the terminal.
