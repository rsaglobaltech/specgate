# Design: agent-hunks

- AC-1 — agent-plan.ts: `hunksOf(diff)`, `applyHunks(text, diff, chosen)`; agentApply takes `hunks`; the CLI parses `--hunk`.
- AC-2 — agentApply keeps `specgate/applied/<id>/` in the git folder: each file's bytes before and its hash after; `agentRevert` restores them when every hash still matches.
