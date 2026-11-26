# Delta — harness

## ADDED Requirements

### Requirement: REQ-643 — A repository with no commit is refused before any agent runs

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL refuse `harness run`, before any agent runs and in every format, when the base it cuts worktrees from names no commit — `harness_no_commit` when the repository has no commit yet, saying to make the first one with the command that does it; `harness_no_base` when `--base-branch` names none — instead of git's "invalid reference: HEAD" in each requirement's result.

> Found from the studio: Build on pintamundo-ai, a project created but never committed, failed every requirement with `git worktree add failed: fatal: invalid reference: HEAD`.

#### Scenario: SCN-643a — No commit yet

- GIVEN a scaffolded project in a git repository with no commit
- WHEN the Developer runs `specgate harness run --req REQ-000 --allow-dirty --format jsonl`
- THEN the run ends with harness_no_commit, its message saying the repository has no commit yet and `git add -A && git commit`, and no "invalid reference"
