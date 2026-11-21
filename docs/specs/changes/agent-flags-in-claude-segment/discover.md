# Discover: agent-flags-in-claude-segment

## Context

Specgate writes a piped agent command when it finds Claude Code
(`claude … -p < {prompt_file} | specgate harness events --from claude`).
The drafting commands then appended `--add-dir` and `--permission-mode` at
the end of the line, which is after the pipe: they reached
`specgate harness events`, not Claude Code. Importing a client's text from
Specgate Studio — a brief kept outside the project — failed on every new
project with `draft_no_front_matter` (#530).

## Use case

1. A Developer imports the client's text in the studio, or runs
   `propose --from-brief --brief <outside file> --agent <the piped command>`.
2. Claude Code gets `--add-dir` and can write the brief's front matter.

## Acceptance criteria

- AC-1: `--add-dir` reaches Claude Code in a piped command.
- AC-2: `--permission-mode acceptEdits` reaches Claude Code in a piped command.
- AC-3: a command that already sets either flag is left as it is.
