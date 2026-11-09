# Proposal: run6-harness

## Intent

The sixth truck-flote run built its first requirement with the harness and lost 46 minutes on it, most of
them to the harness itself (truck-flote `docs/specgate-issues.md`):

- **S50** — the Claude Code command the docs give writes nothing: three attempts, 7 min 40 s, "the agent
  produced no files", a fix line pointing at a page that does not mention permissions.
- **S51** — the Windows rewrite of REQ-255 turned `'Bash(./mvnw:*)'` into `'Bash(.\mvnw:*)'`.
- **S52** — semgrep in Docker could not read the harness worktree's git folder, hung 15 minutes, and the
  agent was told to "fix what the check found".
- **S53** — the review check's agent was told REQ-002 had no text: it lives in an unarchived draft.
- **S55** — `harness report` counted two runs of REQ-002 as two requirements, one of them failed.
- **S56, S57** — after `--chain` merged REQ-002, the studio's report said "No pasa": `validate --strict`
  judged the tree without the open draft that holds REQ-002.
- **S58** — nothing sets the agent the studio's Build needs.

## Scope

- REQ-264: the harness gives a `claude -p` command write permission, as drafting does, and ends a
  requirement on an attempt that wrote nothing.
- REQ-265: `forShell` rewrites `./` only where a command starts, outside quotes.
- REQ-266: a Docker check in a worktree mounts the repository's git folder.
- REQ-267: a gate check that wrote no report is the person's to fix, not the agent's.
- REQ-268: every prompt reads the requirement from the project as `check` judges it.
- REQ-269: `harness report` counts each requirement once; a run that was stopped is in the ledger.
- REQ-270: the studio's report judges the project as `check` does.
- REQ-271: `config set agent` keeps the agent; `status` and `harness run` say how.

## The choice for S57

`check`, `status`, `apply` and the harness already read the project as it will be after its open changes
are archived (ADR-0035): REQ-002 is known there, and `check` passes on the branch the chain merged. The
studio's report was the one place that ran the bare `validate --strict`, the specification as written,
where a delivered draft requirement's feature has no matrix row until the draft is archived. So the report
judges the in-flight view, like `check`: the same verdict the gate gave. Archiving the delivered
requirement early would split a reviewed draft in two; listing open changes in the written matrix would
make `traceability.md` say something `spec.md` does not yet.
