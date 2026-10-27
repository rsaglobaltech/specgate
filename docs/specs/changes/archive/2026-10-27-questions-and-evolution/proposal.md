# Proposal: questions-and-evolution

## Intent

Taking a brief to a delivered app showed two gaps. Clarifying was table editing: every answer typed into a `questions.md` cell, nothing writing the assumption or checking the spec took it in, a question raised while implementing (which photo for REQ-049) had nowhere to go but the chat, and no view of everything still waiting. And evolving was manual: a design change over nineteen delivered requirements could only be written as new requirements, a MODIFIED delta meant copying a requirement by hand, nothing said what a change to a requirement touches, and a new requirement for a module already archived did not start from the brief.

## Scope

In scope:

- `specgate questions` (REQ-187), `specgate answer` (REQ-188), and `specgate ask` for people and the harness's agent, shown by the live view (REQ-189).
- `change new --modify` (REQ-190), `change impact` (REQ-191) and `brief add` (REQ-192).

Out of scope:

- Answering from the live view: studio writes no file today; the live view shows the command instead.
- Rewriting the requirement text from an answer: the answer is the author's to apply; the checklist waits until they say it is.

## Approach

The question table and the assumptions table keep their format and are read with the parser the draft checklist already uses; the new commands write rows into them. `--modify` reads the requirement from the capability spec and renders it with the delta renderer `change new` already has. Impact joins what `live/req` already finds (spec, features, tests) with `git log --grep` and a scan of the specs.
