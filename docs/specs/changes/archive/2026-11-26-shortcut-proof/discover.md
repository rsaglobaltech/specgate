# Discover: shortcut-proof

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The compatibility exam of 2026-11-24 ran two models inside a sandbox, with and
without Specgate, three runs a cell. One, with Specgate, did the four tasks
right twelve times of twelve. The other got three of twelve: it looks for the
shortest way to a green gate, and found three.

1. Refused a write to the code before its test, it wrote the same file through its shell. The guard watches the write tool and nothing else.
2. Its code built to a test that contradicted the scenario, it wrote the scenario's steps to agree with the code — "the fee is 1.50" checked as twice 1.50 — and the gate's scenarios passed.
3. Asked for something no requirement asks for, it wrote it, and a test for it that names a requirement about something else.

None of the three is a model being unable: each is a place where Specgate
takes the agent's word.

## Use case

1. An agent takes a shortcut: code before its test by another door, steps bent to the code, a file nobody designed.
2. Specgate stops it, or says so where a person will read it, naming the file.
3. The honest way stays as short as it was: test, code, apply.

## Acceptance criteria

- AC-1: code written before its test is stopped whatever wrote it, where Specgate's hooks run.
- AC-2: steps changed after the code began do not pass unseen: a person reviews them.
- AC-3: a source file the approved design does not name is reported, and fails where the project asks for that.
- AC-4: a project that takes no shortcut sees nothing new, and nothing is installed in it.
