# Discover: agent-hunks

## Context

The studio's agent panel shows a plan's diff hunk by hunk, as an IDE does, and takes an applied plan back (agent-panel 4b, 2026-11-22). specgate writes the files; the studio never does.

## Acceptance criteria

- AC-1: apply --hunk path#n writes only the hunks named.
- AC-2: revert puts back what an applied plan wrote, when nothing changed since.
